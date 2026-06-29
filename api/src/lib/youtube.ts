// YouTube extraction tool, ported from the Python `yt-design-extractor.py`.
// Pulls a video's metadata (title, description, tags, chapters, counts),
// transcript, and thumbnail by shelling out to `yt-dlp` (already a required
// system binary) — no new npm dependencies. ffmpeg is NOT needed here; it is
// only used by the optional keyframe/OCR features that are not part of this
// core port.

import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const YT_DLP_BIN = process.env.YT_DLP_PATH || 'yt-dlp';
// Optional outbound proxy for yt-dlp (e.g. a rotating residential proxy) so the
// scraping traffic doesn't all originate from one server IP. Empty = direct.
const YT_DLP_PROXY = process.env.YT_DLP_PROXY || '';
const DEFAULT_TIMEOUT_MS = 120_000;

export type YouTubeErrorCode =
  | 'invalid_url'
  | 'yt_dlp_missing'
  | 'unavailable'
  | 'rate_limited'
  | 'timeout'
  | 'fetch_failed';

export class YouTubeError extends Error {
  readonly code: YouTubeErrorCode;
  constructor(message: string, code: YouTubeErrorCode) {
    super(message);
    this.name = 'YouTubeError';
    this.code = code;
  }
}

export type TranscriptEntry = {
  text: string;
  start: number; // seconds
  duration: number; // seconds
};

export type Chapter = {
  title: string;
  start: number; // seconds
};

export type YouTubeThumbnail = {
  url: string;
  width: number | null;
  height: number | null;
};

export type YouTubeMetadata = {
  videoId: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  channel: string;
  channelId: string | null;
  channelUrl: string | null;
  channelFollowerCount: number | null;
  uploadDate: string | null; // YYYY-MM-DD
  duration: number | null; // seconds
  durationText: string | null; // H:MM:SS
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  thumbnail: YouTubeThumbnail | null;
  thumbnails: YouTubeThumbnail[];
  chapters: Chapter[];
};

export type Transcript = {
  available: boolean;
  language: string | null;
  isAutomatic: boolean;
  text: string; // plain, whitespace-collapsed
  entries: TranscriptEntry[];
};

export type YouTubeExtractResult = YouTubeMetadata & { transcript: Transcript };

const EMPTY_TRANSCRIPT: Transcript = {
  available: false,
  language: null,
  isAutomatic: false,
  text: '',
  entries: [],
};

// ---------------------------------------------------------------------------
// URL / id helpers
// ---------------------------------------------------------------------------

const VIDEO_ID_RE =
  /(?:v=|\/v\/|youtu\.be\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/;

/** Pull the 11-char video id out of any common YouTube URL, or a bare id. */
export function extractVideoId(input: string): string | null {
  const s = (input || '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(VIDEO_ID_RE);
  return m ? m[1] : null;
}

export function canonicalUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Public CDN fallback used when metadata carries no thumbnail. */
export function fallbackThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// ---------------------------------------------------------------------------
// yt-dlp process runner
// ---------------------------------------------------------------------------

function runYtDlp(args: string[], timeoutMs: number): Promise<string> {
  const fullArgs = YT_DLP_PROXY ? ['--proxy', YT_DLP_PROXY, ...args] : args;
  return new Promise((resolve, reject) => {
    const child = spawn(YT_DLP_BIN, fullArgs, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(() =>
        reject(new YouTubeError(`yt-dlp timed out after ${timeoutMs}ms`, 'timeout')),
      );
    }, timeoutMs);

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      finish(() => {
        if (err.code === 'ENOENT') {
          reject(
            new YouTubeError(
              `yt-dlp binary not found (looked for "${YT_DLP_BIN}"). Install it or set YT_DLP_PATH.`,
              'yt_dlp_missing',
            ),
          );
        } else {
          reject(new YouTubeError(`yt-dlp failed to start: ${err.message}`, 'fetch_failed'));
        }
      });
    });

    child.on('close', (code) => {
      finish(() => {
        if (code === 0) {
          resolve(stdout);
          return;
        }
        const blob = stderr.toLowerCase();
        if (
          blob.includes('sign in to confirm') ||
          blob.includes('rate') ||
          blob.includes('429') ||
          blob.includes('too many requests') ||
          blob.includes('blocked')
        ) {
          reject(
            new YouTubeError(
              'YouTube rate-limited or blocked this request. Try again later.',
              'rate_limited',
            ),
          );
          return;
        }
        if (
          blob.includes('unavailable') ||
          blob.includes('private') ||
          blob.includes('does not exist') ||
          blob.includes('removed')
        ) {
          reject(
            new YouTubeError('Video is unavailable, private, or does not exist.', 'unavailable'),
          );
          return;
        }
        reject(
          new YouTubeError(
            `yt-dlp exited with code ${code}: ${stderr.trim().slice(0, 500)}`,
            'fetch_failed',
          ),
        );
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

type RawMeta = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function mapMetadata(j: RawMeta, requestedUrl: string): YouTubeMetadata {
  const thumbnails: YouTubeThumbnail[] = (Array.isArray(j.thumbnails) ? j.thumbnails : [])
    .map((t) => {
      const o = t as RawMeta;
      return { url: str(o.url), width: numOrNull(o.width), height: numOrNull(o.height) };
    })
    .filter((t) => t.url);

  const bestThumbUrl = str(j.thumbnail);
  const thumbnail: YouTubeThumbnail | null = bestThumbUrl
    ? { url: bestThumbUrl, width: null, height: null }
    : thumbnails.length > 0
      ? thumbnails[thumbnails.length - 1]
      : null;

  const chapters: Chapter[] = (Array.isArray(j.chapters) ? j.chapters : []).map((c) => {
    const o = c as RawMeta;
    return { title: str(o.title), start: numOrNull(o.start_time) ?? 0 };
  });

  const duration = numOrNull(j.duration);
  const uploadRaw = str(j.upload_date);
  const uploadDate = /^\d{8}$/.test(uploadRaw)
    ? `${uploadRaw.slice(0, 4)}-${uploadRaw.slice(4, 6)}-${uploadRaw.slice(6, 8)}`
    : null;

  return {
    videoId: str(j.id),
    url: str(j.webpage_url) || requestedUrl,
    title: str(j.title),
    description: str(j.description),
    tags: strArray(j.tags),
    categories: strArray(j.categories),
    channel: str(j.channel) || str(j.uploader),
    channelId: str(j.channel_id) || null,
    channelUrl: str(j.channel_url) || str(j.uploader_url) || null,
    channelFollowerCount: numOrNull(j.channel_follower_count),
    uploadDate,
    duration,
    durationText: duration != null ? formatDuration(duration) : null,
    viewCount: numOrNull(j.view_count),
    likeCount: numOrNull(j.like_count),
    commentCount: numOrNull(j.comment_count),
    thumbnail,
    thumbnails,
    chapters,
  };
}

export async function getVideoMetadata(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<YouTubeMetadata> {
  const out = await runYtDlp(
    ['--dump-json', '--no-download', '--no-playlist', url],
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  let parsed: RawMeta;
  try {
    parsed = JSON.parse(out) as RawMeta;
  } catch {
    throw new YouTubeError('yt-dlp returned invalid JSON metadata.', 'fetch_failed');
  }
  return mapMetadata(parsed, url);
}

// ---------------------------------------------------------------------------
// Transcript (subtitles via yt-dlp, parsed from WebVTT)
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

const VTT_TIMING_RE =
  /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/;

function vttTimeToSeconds(t: string): number {
  const m = t.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/** Parse a WebVTT (or SRT-ish) subtitle file into timestamped entries, stripping
 * inline tags and collapsing the rolling duplicate lines YouTube auto-captions
 * emit. Exported for unit testing. */
export function parseVtt(content: string): TranscriptEntry[] {
  const lines = content.replace(/\r/g, '').split('\n');
  const entries: TranscriptEntry[] = [];
  let lastText = '';

  for (let i = 0; i < lines.length; i++) {
    const timing = lines[i].match(VTT_TIMING_RE);
    if (!timing) continue;
    const start = vttTimeToSeconds(timing[1]);
    const end = vttTimeToSeconds(timing[2]);

    const textLines: string[] = [];
    i++;
    // Stop only on a TRULY empty line (the cue separator) or the next timing
    // line — not on a whitespace-only line. YouTube's first auto-caption cue
    // puts a single-space placeholder line before its text; treating that space
    // as the terminator dropped the whole opening cue, so the transcript began
    // at the second cue (e.g. 0:02 instead of 0:00). A blank cue separator is
    // genuinely empty, so `!== ''` still ends the payload correctly.
    for (; i < lines.length && lines[i] !== '' && !VTT_TIMING_RE.test(lines[i]); i++) {
      let t = lines[i].replace(/<[^>]+>/g, '');
      t = decodeEntities(t).trim();
      if (t && textLines[textLines.length - 1] !== t) textLines.push(t);
    }
    i--; // step back so the outer loop re-checks the blank / next timing line

    const text = textLines.join(' ').replace(/\s+/g, ' ').trim();
    if (!text || text === lastText) continue;
    entries.push({ text, start, duration: Math.max(0, end - start) });
    lastText = text;
  }

  return entries;
}

export async function getTranscript(
  url: string,
  opts: { timeoutMs?: number; langs?: string } = {},
): Promise<Transcript> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'yt-subs-'));
  try {
    // Request only the English track(s). A greedy pattern like `en.*` makes
    // yt-dlp pull every "English from <language>" auto-translation, and the
    // burst of requests gets 429'd by YouTube.
    let rateLimited = false;
    await runYtDlp(
      [
        '--skip-download',
        '--write-subs',
        '--write-auto-subs',
        '--sub-langs',
        opts.langs ?? 'en,en-orig',
        '--sub-format',
        'vtt/best',
        '--no-playlist',
        '-o',
        path.join(dir, 'subs'),
        url,
      ],
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ).catch((err: unknown) => {
      if (err instanceof YouTubeError && err.code === 'rate_limited') rateLimited = true;
      return '';
    });

    // Judge success by what landed on disk, not by yt-dlp's exit code: it can
    // exit non-zero after a later language variant is rate-limited even though
    // the English track we want was already written.
    const vtts = (await readdir(dir)).filter((f) => f.endsWith('.vtt'));
    if (vtts.length === 0) {
      if (rateLimited) {
        throw new YouTubeError(
          'YouTube rate-limited the transcript request. Try again later.',
          'rate_limited',
        );
      }
      return { ...EMPTY_TRANSCRIPT };
    }

    // Prefer the plain English track (`subs.en.vtt`, manual when present) over
    // the auto-translation variants (`subs.en-orig.vtt`, `subs.en-xx.vtt`).
    const chosen =
      vtts.find((f) => /\.en\.vtt$/.test(f)) ??
      vtts.find((f) => f.includes('.en')) ??
      vtts[0];
    const langMatch = chosen.match(/\.([a-zA-Z-]+)\.vtt$/);
    const content = await readFile(path.join(dir, chosen), 'utf-8');
    const isAutomatic = /<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(content) || content.includes('<c>');
    const entries = parseVtt(content);
    const text = entries
      .map((e) => e.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      available: entries.length > 0,
      language: langMatch ? langMatch[1] : null,
      isAutomatic,
      text,
      entries,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Merge transcript snippets into chunks of at least `chunkSeconds`. Useful for
 * callers that want coarse, readable segments. Exported for unit testing. */
export function groupTranscript(
  entries: TranscriptEntry[],
  chunkSeconds = 60,
): { start: number; text: string }[] {
  if (entries.length === 0) return [];
  const groups: { start: number; text: string }[] = [];
  let current = { start: entries[0].start, text: '' };
  for (const e of entries) {
    if (e.start - current.start >= chunkSeconds && current.text) {
      groups.push(current);
      current = { start: e.start, text: '' };
    }
    current.text += ` ${e.text}`;
  }
  if (current.text) groups.push(current);
  for (const g of groups) g.text = g.text.replace(/\s+/g, ' ').trim();
  return groups;
}

// ---------------------------------------------------------------------------
// Thumbnail download (server-side proxy of the full image)
// ---------------------------------------------------------------------------

export async function fetchThumbnail(
  thumbUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<{ buffer: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(thumbUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new YouTubeError(`Thumbnail download failed: HTTP ${res.status}`, 'fetch_failed');
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return { buffer, contentType };
  } catch (err) {
    if (err instanceof YouTubeError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new YouTubeError(`Thumbnail download failed: ${message}`, 'fetch_failed');
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function extractYouTube(
  input: string,
  opts: { timeoutMs?: number } = {},
): Promise<YouTubeExtractResult> {
  const videoId = extractVideoId(input);
  if (!videoId) {
    throw new YouTubeError('Could not extract a YouTube video id from the input.', 'invalid_url');
  }
  const url = canonicalUrl(videoId);

  // Run sequentially rather than in parallel: two concurrent yt-dlp processes
  // double the simultaneous hits on YouTube and make a 429 / IP block more
  // likely. Metadata is authoritative (its failure fails the request); the
  // transcript is best-effort and degrades to empty.
  const meta = await getVideoMetadata(url, opts);
  let transcript: Transcript;
  try {
    transcript = await getTranscript(url, opts);
  } catch {
    transcript = { ...EMPTY_TRANSCRIPT };
  }

  return { ...meta, transcript };
}

// ---------------------------------------------------------------------------
// Available formats + media download (video merged via ffmpeg, or audio as mp3)
// ---------------------------------------------------------------------------

export type AvailableFormats = {
  videoId: string;
  title: string;
  heights: number[]; // ascending unique video resolutions, e.g. [144,360,720,1080]
  hasAudio: boolean;
};

/** List the distinct video resolutions a video offers plus whether audio exists.
 *  Cheap (one --dump-json) — used to render only the qualities that are real. */
export async function getAvailableFormats(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<AvailableFormats> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new YouTubeError('Could not extract a YouTube video id from the input.', 'invalid_url');
  }
  const out = await runYtDlp(
    ['--dump-json', '--no-download', '--no-playlist', canonicalUrl(videoId)],
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  let j: RawMeta;
  try {
    j = JSON.parse(out) as RawMeta;
  } catch {
    throw new YouTubeError('yt-dlp returned invalid JSON.', 'fetch_failed');
  }
  const formats = Array.isArray(j.formats) ? (j.formats as RawMeta[]) : [];
  const heightSet = new Set<number>();
  let hasAudio = false;
  for (const f of formats) {
    const vcodec = str(f.vcodec) || 'none';
    const acodec = str(f.acodec) || 'none';
    if (acodec !== 'none') hasAudio = true;
    const height = numOrNull(f.height);
    if (vcodec !== 'none' && height && height > 0) heightSet.add(height);
  }
  return {
    videoId,
    title: str(j.title),
    heights: [...heightSet].sort((a, b) => a - b),
    hasAudio,
  };
}

export type DownloadResult = {
  dir: string; // temp dir the caller must remove after streaming filePath
  filePath: string;
  filename: string; // yt-dlp-sanitized (--restrict-filenames → ASCII, header-safe)
  contentType: string;
};

const DOWNLOAD_QUALITIES = new Set(['audio', '360', '480', '720', '1080', '1440', '2160']);
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;

/** Download a video (best ≤ requested height, merged to mp4 via ffmpeg) or the
 *  audio only (mp3) into a fresh temp dir. The caller streams `filePath` to the
 *  client and is responsible for removing `dir` afterwards. */
export async function downloadMedia(
  url: string,
  quality: string,
  opts: { timeoutMs?: number } = {},
): Promise<DownloadResult> {
  if (!DOWNLOAD_QUALITIES.has(quality)) {
    throw new YouTubeError(`Unsupported quality "${quality}".`, 'invalid_url');
  }
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new YouTubeError('Could not extract a YouTube video id from the input.', 'invalid_url');
  }
  const canonical = canonicalUrl(videoId);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'yt-dl-'));
  const outTemplate = path.join(dir, '%(title).80s.%(ext)s');

  const isAudio = quality === 'audio';
  const ext = isAudio ? 'mp3' : 'mp4';
  const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
  const height = isAudio ? 0 : parseInt(quality, 10);

  const args = isAudio
    ? [
        '-f', 'bestaudio/best',
        '-x', '--audio-format', 'mp3', '--audio-quality', '0',
        '--no-playlist', '--no-progress', '--no-warnings', '--restrict-filenames',
        '-o', outTemplate, canonical,
      ]
    : [
        // Prefer H.264 video + AAC audio for universal playback; fall back to the
        // best available (vp9/av1) for resolutions YouTube only ships in those
        // codecs (typically 1440p/4K), still merged into an mp4 container.
        '-f',
        `bestvideo[height<=${height}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`,
        '--merge-output-format', 'mp4',
        '--no-playlist', '--no-progress', '--no-warnings', '--restrict-filenames',
        '-o', outTemplate, canonical,
      ];

  try {
    await runYtDlp(args, opts.timeoutMs ?? DOWNLOAD_TIMEOUT_MS);
    const files = (await readdir(dir)).filter((f) => !f.endsWith('.part'));
    const file = files.find((f) => f.endsWith(`.${ext}`)) ?? files[0];
    if (!file) {
      throw new YouTubeError('Download produced no output file.', 'fetch_failed');
    }
    return { dir, filePath: path.join(dir, file), filename: file, contentType };
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}
