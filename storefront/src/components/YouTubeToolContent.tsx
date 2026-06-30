"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import {
  ToolErrorNotice,
  toToolError,
  type ToolError,
  type ToolErrorBody,
} from "./ToolErrorNotice";
import Link from "next/link";
import { PageShell } from "./PageShell";
import { DownloadButton } from "./DownloadButton";
import type { ToolView } from "./SiteHeader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type TranscriptEntry = { text: string; start: number; duration: number };
type Transcript = {
  available: boolean;
  language: string | null;
  isAutomatic: boolean;
  text: string;
  entries: TranscriptEntry[];
};
type Thumbnail = { url: string; width: number | null; height: number | null };
type Chapter = { title: string; start: number };
type HeatmapSegment = { start: number; end: number; value: number };
type ExtractResult = {
  videoId: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  channel: string;
  channelUrl: string | null;
  channelFollowerCount: number | null;
  durationText: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  uploadDate: string | null;
  thumbnail: Thumbnail | null;
  chapters: Chapter[];
  heatmap: HeatmapSegment[];
  transcript: Transcript;
};
type FormatsResult = {
  videoId: string;
  title: string;
  heights: number[];
  hasAudio: boolean;
};

// ---- Thumbnails (mirrors /thumbnails) -------------------------------------
type Res = { key: string; label: string; w: number; h: number };

const STANDARD: readonly Res[] = [
  { key: "maxresdefault", label: "Max-res", w: 1280, h: 720 },
  { key: "sddefault", label: "SD", w: 640, h: 480 },
  { key: "hqdefault", label: "HQ", w: 480, h: 360 },
  { key: "mqdefault", label: "MQ", w: 320, h: 180 },
  { key: "default", label: "Default", w: 120, h: 90 },
];

const FRAMES: readonly Res[] = [
  { key: "1", label: "Frame 1", w: 120, h: 90 },
  { key: "2", label: "Frame 2", w: 120, h: 90 },
  { key: "3", label: "Frame 3", w: 120, h: 90 },
];

// ---- Download (mirrors /download) -----------------------------------------
const HEIGHT_LABELS: Record<number, string> = {
  2160: "4K",
  1440: "2K",
  1080: "1080p",
  720: "720p",
  480: "480p",
  360: "360p",
};

// The backend only merges/serves these heights as a download quality.
const DOWNLOADABLE = [2160, 1440, 1080, 720, 480, 360];

// ---- Tags & SEO (mirrors /tags) -------------------------------------------
// YouTube enforces a 500-character cap across all tags (commas included).
const TAG_CHAR_LIMIT = 500;

const STOPWORDS = new Set(
  "the a an and or but if then else for to of in on at by with from as is are was were be been being it its this that these those you your we our us they them their he she his her i me my mine do does did done how what when where which who why will would can could should your you'll about into out up down over under more most very just so than too can't won't not no yes get got make made how-to".split(
    /\s+/,
  ),
);

function keywordIdeas(title: string, description: string, tags: string[]): string[] {
  const text = `${title} ${description} ${tags.join(" ")}`.toLowerCase();
  const words = text.match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    if (/^\d+$/.test(w)) continue; // bare numbers (years, timestamps)
    if (/^(?:https?|www|com|net|org|co)$/.test(w)) continue; // URL fragments
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([w]) => w);
}

// ---- Transcript (mirrors /transcript) -------------------------------------
function formatTime(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function srtTime(total: number): string {
  const ms = Math.round((total - Math.floor(total)) * 1000);
  const s = Math.floor(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`;
}

function toSrt(entries: TranscriptEntry[]): string {
  return entries
    .map((e, i) => {
      const start = srtTime(e.start);
      const end = srtTime(e.start + (e.duration || 0));
      return `${i + 1}\n${start} --> ${end}\n${e.text}`;
    })
    .join("\n\n");
}

// YouTube auto-captions "roll": each cue repeats the tail of the previous one,
// so naively joining entries duplicates most of the text. Rebuild clean prose by
// appending only the words of each cue that extend past the running overlap.
function dedupeRolling(entries: TranscriptEntry[]): string {
  const words: string[] = [];
  for (const e of entries) {
    const ew = e.text.split(/\s+/).filter(Boolean);
    let overlap = 0;
    const maxK = Math.min(words.length, ew.length);
    for (let k = maxK; k > 0; k--) {
      let match = true;
      for (let j = 0; j < k; j++) {
        if (words[words.length - k + j].toLowerCase() !== ew[j].toLowerCase()) {
          match = false;
          break;
        }
      }
      if (match) {
        overlap = k;
        break;
      }
    }
    for (let j = overlap; j < ew.length; j++) words.push(ew[j]);
  }
  return words.join(" ");
}

// Same rolling de-overlap as dedupeRolling, but timestamp-preserving: emit one
// entry per cue holding only the words that cue ADDS past the running text, kept
// at that cue's start. This turns the duplicated short/long cue pairs YouTube
// auto-captions emit into a clean, non-repeating timeline for the timestamped
// view and SRT export. Each line's duration is stretched to the next line's
// start so SRT cues stay contiguous (the source durations belonged to the
// overlapping rolling cues, not these rebuilt lines).
function dedupeRollingEntries(entries: TranscriptEntry[]): TranscriptEntry[] {
  const out: TranscriptEntry[] = [];
  const words: string[] = [];
  for (const e of entries) {
    const ew = e.text.split(/\s+/).filter(Boolean);
    let overlap = 0;
    const maxK = Math.min(words.length, ew.length);
    for (let k = maxK; k > 0; k--) {
      let match = true;
      for (let j = 0; j < k; j++) {
        if (words[words.length - k + j].toLowerCase() !== ew[j].toLowerCase()) {
          match = false;
          break;
        }
      }
      if (match) {
        overlap = k;
        break;
      }
    }
    const fresh = ew.slice(overlap);
    if (fresh.length === 0) continue;
    for (const w of fresh) words.push(w);
    out.push({ text: fresh.join(" "), start: e.start, duration: e.duration });
  }
  for (let i = 0; i < out.length - 1; i++) {
    out[i].duration = Math.max(0, out[i + 1].start - out[i].start);
  }
  return out;
}

// Plain text should be words only: strip caption sound cues like [music],
// [Music], [♪♪♪], [Applause] and the musical-note glyphs that bracket sung
// lyrics, then collapse the whitespace they leave. Parenthesised text is kept:
// in songs "(Ooh, give you up)" is a lyric, not a sound cue.
function stripNonSpeech(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[♪♫♬]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function saveFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Local "YYYY-MM-DD HH:MM" stamp for the report's "Extracted" line.
function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Turn a video title into a filename that is safe on every OS (Windows, macOS,
// Linux, Android, iOS): drop diacritics, keep only broadly-legal characters, turn
// spaces into "-", trim leading/trailing dots/dashes, and dodge Windows' reserved
// device names. Falls back to "video" if nothing usable remains.
function safeFilename(title: string): string {
  let s = (title || "")
    .normalize("NFKD") // decompose accents so the whitelist drops the marks
    .replace(/[^A-Za-z0-9._ -]/g, "") // keep only broadly-legal chars
    .replace(/\s+/g, "-") // spaces → -
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^[-.]+|[-.]+$/g, "") // no leading/trailing - or .
    .slice(0, 120)
    .replace(/[-.]+$/g, ""); // re-trim after the length cap
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) s = `_${s}`;
  return s || "video";
}

// ASCII bar for a heatmap value (0..1), 20 chars wide at full intensity.
function heatmapBar(value: number): string {
  return "#".repeat(Math.max(0, Math.floor(value * 20)));
}

// Build the downloadable video report (data-only for now — the Topic/Perspective
// LLM analysis sections are a later addition). `thumbnailRef` is what goes in the
// ![thumbnail](...) line: a YouTube URL for the standalone .md, or "thumbnail.jpg"
// for the zip bundle.
function toReportMarkdown(
  result: ExtractResult,
  thumbnailRef: string,
  extractedAt: string,
): string {
  const watchUrl = `https://www.youtube.com/watch?v=${result.videoId}`;
  const num = (n: number | null) => (n != null ? n.toLocaleString() : "N/A");
  const lines: string[] = [`# ${result.title}`, "", `![thumbnail](${thumbnailRef})`, ""];

  const meta: string[] = [
    `**Title:** ${result.title}`,
    `**Source:** [${result.channel}](${watchUrl})`,
  ];
  if (result.durationText) meta.push(`**Duration:** ${result.durationText}`);
  if (result.uploadDate) meta.push(`**Uploaded:** ${result.uploadDate}`);
  if (result.categories.length) meta.push(`**Category:** ${result.categories.join(", ")}`);
  meta.push(`**Extracted:** ${extractedAt}`);
  if (result.tags.length) meta.push(`**Tags:** ${result.tags.join(", ")}`);
  lines.push(meta.map((m) => `> ${m}  `).join("\n"), "");

  lines.push("## Engagement", "");
  lines.push("| Metric | Value |", "|--------|-------|");
  lines.push(`| Views | ${num(result.viewCount)} |`);
  lines.push(`| Likes | ${num(result.likeCount)} |`);
  lines.push(`| Comments | ${num(result.commentCount)} |`);
  lines.push(`| Subscribers | ${num(result.channelFollowerCount)} |`);
  const ratio =
    result.likeCount != null && result.viewCount
      ? `${((result.likeCount / result.viewCount) * 100).toFixed(2)}%`
      : "N/A";
  lines.push(`| Like ratio | ${ratio} |`, "");

  lines.push("## Heatmap (Viewer Retention)", "");
  if (result.heatmap.length) {
    lines.push("Shows which segments viewers rewatched or skipped.", "");
    lines.push("| Timestamp | Engagement |", "|-----------|------------|");
    for (const h of result.heatmap) {
      lines.push(`| \`${formatTime(h.start)}\` | ${heatmapBar(h.value)} ${h.value.toFixed(2)} |`);
    }
    lines.push("");
  } else {
    lines.push("_No heatmap data available for this video._", "");
  }

  lines.push("## Video Description", "");
  lines.push("```", result.description || "(no description)", "```", "");

  lines.push("## Chapters", "");
  if (result.chapters.length) {
    lines.push("| Timestamp | Title |", "|-----------|-------|");
    for (const c of result.chapters) {
      lines.push(`| \`${formatTime(c.start)}\` | ${c.title} |`);
    }
    lines.push("");
  } else {
    lines.push("_This video has no chapters._", "");
  }

  return lines.join("\n");
}

// Minimal CRC-32 (for the hand-rolled zip below; avoids a zip dependency).
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Build an uncompressed ("stored") ZIP from a few small files. Stored is fine:
// the only binary entry is an already-compressed JPEG.
function buildZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const parts: Uint8Array[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const local = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0),
      ...name,
    ]);
    parts.push(local, f.data);
    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name,
    );
    offset += local.length + size;
  }

  const centralBytes = Uint8Array.from(central);
  const eocd = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralBytes.length), ...u32(offset), ...u16(0),
  ]);
  return new Blob([...parts, centralBytes, eocd] as BlobPart[], { type: "application/zip" });
}

// Markdown export: clean prose under a heading with source context. Markdown is
// the most token-efficient, structure-preserving format to hand to an LLM.
function toMarkdown(result: { videoId: string; language: string | null; isAutomatic: boolean }, plainText: string): string {
  const src = `https://www.youtube.com/watch?v=${result.videoId}`;
  const lang = result.language
    ? `${result.language}${result.isAutomatic ? " (auto-generated)" : ""}`
    : result.isAutomatic
      ? "auto-generated"
      : "unknown";
  return `# Transcript\n\n- **Source:** ${src}\n- **Language:** ${lang}\n\n${plainText}\n`;
}

function formatCount(n: number | null): string {
  return n == null ? "" : n.toLocaleString();
}

// Compact stat for the Statistics tiles (93,183 -> "93.2K"); the exact value is
// kept for the tile's hover title. "N/A" when the count is hidden/unavailable.
function abbreviate(n: number | null): string {
  if (n == null) return "N/A";
  if (n < 1000) return n.toLocaleString();
  if (n < 1_000_000) return `${+(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  return `${+(n / 1_000_000_000).toFixed(1)}B`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "2024-09-28" -> "September 28, 2024". Parsed by hand (not new Date) so it never
// shifts a day across time zones.
function formatDate(iso: string): string {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso.slice(0, 10);
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1] ?? ""} ${Number(d)}, ${y}`.trim();
}

export function YouTubeToolContent() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ToolError | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [formats, setFormats] = useState<FormatsResult | null>(null);
  // Which tool view is active on this single page. "overview" shows everything;
  // the others narrow to one tool. All views are driven by the same one-paste
  // extraction, so switching never re-fetches or makes the visitor re-enter the URL.
  const [tool, setTool] = useState<ToolView>("overview");

  // Thumbnails
  const [unavailable, setUnavailable] = useState<Record<string, boolean>>({});
  const [copiedThumb, setCopiedThumb] = useState<string | null>(null);
  // Tags
  const [copiedTags, setCopiedTags] = useState(false);
  // Description (rich Overview card)
  const [copiedDesc, setCopiedDesc] = useState(false);
  // Transcript
  const [view, setView] = useState<"plain" | "timestamped">("plain");
  const [copiedTx, setCopiedTx] = useState(false);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const value = url.trim();
      if (!value || loading) return;
      setLoading(true);
      setError(null);
      setResult(null);
      setFormats(null);
      setUnavailable({});
      setView("plain");
      try {
        // One paste, one go: metadata/tags/thumbnail/transcript and the
        // downloadable formats are fetched together. The formats lookup
        // (yt-dlp) is the slower of the two, so it runs in parallel and a
        // failure there only degrades the Download section.
        const [extractRes, formatsRes] = await Promise.allSettled([
          fetch(`${API_BASE}/youtube/extract?url=${encodeURIComponent(value)}`),
          fetch(`${API_BASE}/youtube/formats?url=${encodeURIComponent(value)}`),
        ]);

        if (extractRes.status !== "fulfilled") {
          setError({
            message:
              extractRes.reason instanceof Error
                ? extractRes.reason.message
                : String(extractRes.reason),
          });
          return;
        }
        const res = extractRes.value;
        const body = (await res.json().catch(() => ({}))) as Partial<ExtractResult> &
          ToolErrorBody;
        if (!res.ok) {
          setError(toToolError(body, res.status));
          return;
        }
        setResult(body as ExtractResult);

        if (formatsRes.status === "fulfilled" && formatsRes.value.ok) {
          const fBody = (await formatsRes.value
            .json()
            .catch(() => null)) as FormatsResult | null;
          setFormats(fBody);
        }
      } catch (err) {
        setError({ message: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    },
    [url, loading],
  );

  // ---- Thumbnail helpers -------------------------------------------------
  const markUnavailable = useCallback((key: string) => {
    setUnavailable((u) => (u[key] ? u : { ...u, [key]: true }));
  }, []);

  const copyUrl = useCallback((key: string, src: string) => {
    navigator.clipboard.writeText(src).then(() => {
      setCopiedThumb(key);
      setTimeout(() => setCopiedThumb((c) => (c === key ? null : c)), 1500);
    });
  }, []);

  const videoId = result?.videoId ?? "";
  // Base name for every download on this page: the sanitized video title.
  const titleSlug = result ? safeFilename(result.title) : "video";
  const previewSrc = (key: string) => `https://i.ytimg.com/vi/${videoId}/${key}.jpg`;
  const downloadThumbHref = (key: string) =>
    `${API_BASE}/youtube/thumbnail?id=${videoId}&res=${key}`;

  // YouTube returns a 120×90 gray placeholder (HTTP 200, not a 404) when a larger
  // size was never generated, so width-checking on load catches what onError misses.
  const guardPlaceholder = (r: Res) => (e: { currentTarget: HTMLImageElement }) => {
    if (r.w > 120 && e.currentTarget.naturalWidth <= 120) markUnavailable(r.key);
  };

  // Highest available size becomes the hero; everything still loading defaults in.
  const hero = STANDARD.find((r) => !unavailable[r.key]) ?? null;
  const otherSizes = STANDARD.filter((r) => r !== hero && !unavailable[r.key]);
  const frames = FRAMES.filter((r) => !unavailable[r.key]);

  const renderThumbCard = (r: Res) => {
    const src = previewSrc(r.key);
    return (
      <div key={r.key} className="overflow-hidden border border-rule">
        <a href={src} target="_blank" rel="noopener noreferrer" title="Open full size">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${r.label} thumbnail`}
            className="block aspect-video w-full bg-paper-deep object-cover"
            onError={() => markUnavailable(r.key)}
            onLoad={guardPlaceholder(r)}
          />
        </a>
        <div className="flex items-center justify-between gap-2 border-t border-rule px-3 py-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {r.label} · {r.w}×{r.h}
          </span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => copyUrl(r.key, src)}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-ochre"
            >
              {copiedThumb === r.key ? "Copied" : "Copy"}
            </button>
            <a
              href={downloadThumbHref(r.key)}
              download={`${titleSlug}-${r.key}.jpg`}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-ochre-deep transition-colors hover:text-ochre"
            >
              Download
            </a>
          </span>
        </div>
      </div>
    );
  };

  // ---- Download helpers --------------------------------------------------
  const videoUrl = result ? `https://www.youtube.com/watch?v=${result.videoId}` : "";
  const dlHref = (quality: string) =>
    `${API_BASE}/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=${quality}`;
  const videoQualities = formats
    ? DOWNLOADABLE.filter((h) => formats.heights.includes(h))
    : [];

  // ---- Tags & SEO --------------------------------------------------------
  const tags = result?.tags ?? [];
  const tagsString = useMemo(() => tags.join(", "), [tags]);
  const keywords = useMemo(
    () => (result ? keywordIdeas(result.title, result.description, tags) : []),
    [result, tags],
  );
  const tagsOverLimit = tagsString.length > TAG_CHAR_LIMIT;

  const copyTags = useCallback(() => {
    navigator.clipboard.writeText(tagsString).then(() => {
      setCopiedTags(true);
      setTimeout(() => setCopiedTags(false), 1500);
    });
  }, [tagsString]);

  const copyDescription = useCallback(() => {
    const text = result?.description;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedDesc(true);
      setTimeout(() => setCopiedDesc(false), 1500);
    });
  }, [result]);

  // ---- Report download (.md and .zip-with-thumbnail) ---------------------
  const [zipBusy, setZipBusy] = useState(false);

  const downloadReportMd = useCallback(() => {
    if (!result) return;
    const thumb =
      result.thumbnail?.url || `https://i.ytimg.com/vi/${result.videoId}/hqdefault.jpg`;
    saveFile(
      `${safeFilename(result.title)}.md`,
      toReportMarkdown(result, thumb, formatStamp(new Date())),
    );
  }, [result]);

  const downloadReportZip = useCallback(async () => {
    if (!result || zipBusy) return;
    setZipBusy(true);
    try {
      const md = toReportMarkdown(result, "thumbnail.jpg", formatStamp(new Date()));
      // Thumbnail bytes via our same-origin proxy (i.ytimg blocks cross-origin fetch).
      let img: Uint8Array | null = null;
      for (const res of ["maxresdefault", "hqdefault"]) {
        try {
          const r = await fetch(`${API_BASE}/youtube/thumbnail?id=${result.videoId}&res=${res}`);
          if (r.ok) {
            img = new Uint8Array(await r.arrayBuffer());
            break;
          }
        } catch {
          // try the next resolution
        }
      }
      const enc = new TextEncoder();
      const files: { name: string; data: Uint8Array }[] = [
        { name: "report.md", data: enc.encode(md) },
      ];
      if (img) files.push({ name: "thumbnail.jpg", data: img });
      // Both transcript views, when the video has captions.
      const tx = result.transcript;
      if (tx?.available) {
        const plain = stripNonSpeech(tx.isAutomatic ? dedupeRolling(tx.entries) : tx.text);
        const timed = tx.isAutomatic ? dedupeRollingEntries(tx.entries) : tx.entries;
        files.push({ name: "transcript-plain.txt", data: enc.encode(plain) });
        files.push({
          name: "transcript-timestamped.txt",
          data: enc.encode(timed.map((e) => `[${formatTime(e.start)}] ${e.text}`).join("\n")),
        });
      }
      saveBlob(`${safeFilename(result.title)}.zip`, buildZip(files));
    } finally {
      setZipBusy(false);
    }
  }, [result, zipBusy]);

  // ---- Transcript --------------------------------------------------------
  const transcript = result?.transcript;
  const plainText = useMemo(() => {
    if (!transcript) return "";
    // Auto-captions roll (cues overlap heavily); manual captions are already clean.
    const raw = transcript.isAutomatic ? dedupeRolling(transcript.entries) : transcript.text;
    // Plain view is words only: drop [music]/[♪♪♪] cues and note glyphs.
    return stripNonSpeech(raw);
  }, [transcript]);
  const timedEntries = useMemo(() => {
    if (!transcript) return [];
    return transcript.isAutomatic
      ? dedupeRollingEntries(transcript.entries)
      : transcript.entries;
  }, [transcript]);
  const wordCount = useMemo(
    () => (plainText ? plainText.trim().split(/\s+/).length : 0),
    [plainText],
  );

  const copyTranscript = useCallback(() => {
    if (!transcript) return;
    const content =
      view === "plain"
        ? plainText
        : timedEntries.map((e) => `[${formatTime(e.start)}] ${e.text}`).join("\n");
    navigator.clipboard.writeText(content).then(() => {
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 1500);
    });
  }, [transcript, view, plainText, timedEntries]);

  const fileBase = titleSlug;
  const toolBtn =
    "border border-ink/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre";

  // Section header shared by the four bundled tools.
  const sectionClass = "mt-14 border-t border-rule-strong/40 pt-10";
  const sectionTitleClass = "font-display text-[22px] font-bold leading-tight text-ink";

  // Embedded player shown above the extracted details. The standard YouTube
  // iframe renders the thumbnail, title, and play button until the viewer
  // clicks to play in place.
  const videoEmbed = videoId ? (
    <iframe
      className="block aspect-video w-full"
      src={`https://www.youtube.com/embed/${videoId}`}
      title={`YouTube video player: ${videoId}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      loading="lazy"
    />
  ) : null;

  // View gating for the in-page switcher: Overview shows every section; each
  // focused tool shows only its own. Hidden sections stay mounted so switching is
  // instant and keeps the already-extracted data.
  const isOverview = tool === "overview";
  const showThumbnails = isOverview || tool === "thumbnails";
  const showDownload = isOverview || tool === "download";
  const showTags = isOverview || tool === "tags";
  const showTranscript = isOverview || tool === "transcript";

  // "Most replayed" graph data (empty unless YouTube computed one for this video).
  // Each segment's value is 0..1; points map the curve into a 0..100 SVG box.
  const heatmap = result?.heatmap ?? [];
  const heatmapPeak =
    heatmap.length > 0 ? heatmap.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const heatmapPoints = heatmap
    .map((h, i) => `${i},${(100 - h.value * 100).toFixed(2)}`)
    .join(" ");

  // One Statistics tile: a muted label over a large value, with the exact count
  // (when abbreviated) shown on hover.
  const statTile = (
    label: string,
    value: string,
    valueClass = "text-ink",
    title?: string,
  ) => (
    <div className="rounded-lg border border-rule bg-paper p-4 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <p className={`mt-1.5 font-display text-[22px] font-bold ${valueClass}`} title={title}>
        {value}
      </p>
    </div>
  );

  // Clipboard glyph for the card's copy buttons; swaps to a check once copied.
  const copyIcon = (copied: boolean) =>
    copied ? (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ) : (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    );

  return (
    <PageShell
      title="YouTube Transcript, Downloader & Thumbnail Tools"
      intro="Paste one YouTube link to pull everything at once: the full transcript, video and audio downloads, every thumbnail size, and the video's tags and keyword ideas. It is free, runs in your browser, and needs no account."
      wide
      toolTabs
      compact={!!result}
      toolView={tool}
      onToolView={setTool}
      input={
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="flex-1 border border-ink/70 bg-paper px-4 py-3 font-body text-[16px] text-ink outline-none focus:border-ochre"
            aria-label="YouTube URL"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="whitespace-nowrap border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Extracting…" : "Extract"}
          </button>
        </form>
      }
    >
      {error && <ToolErrorNotice error={error} />}

      {result && (
        <div className="mt-12">
          {isOverview ? (
            // Rich video card (Overview only): a two-column metadata panel — media
            // + a Statistics card on the left, title/author/tags/description on the
            // right — modeled on the competitor layout. Focused tool views keep the
            // lean title+stats header in the else branch.
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
              <div className="flex flex-col gap-6">
                <div className="overflow-hidden rounded-xl border border-rule-strong">
                  {videoEmbed}
                </div>
                <div className="rounded-xl border border-rule-strong bg-paper-deep p-5">
                  <h3 className="font-display text-[18px] font-bold text-ink">Statistics</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {statTile("Views", abbreviate(result.viewCount), "text-ink", formatCount(result.viewCount) || undefined)}
                    {statTile("Likes", abbreviate(result.likeCount), "text-jade", formatCount(result.likeCount) || undefined)}
                    {statTile("Comments", abbreviate(result.commentCount), "text-ochre", formatCount(result.commentCount) || undefined)}
                    {statTile("Duration", result.durationText ?? "N/A")}
                  </div>
                  <div className="mt-5 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                      Video ID
                    </p>
                    <p className="mt-1 font-mono text-[13px] text-ink-soft">{videoId}</p>
                  </div>
                </div>
                {heatmap.length > 0 && (
                  <div className="rounded-xl border border-rule-strong bg-paper-deep p-5">
                    <h3 className="font-display text-[18px] font-bold text-ink">
                      Most Replayed
                    </h3>
                    <svg
                      viewBox={`0 0 ${heatmap.length - 1} 100`}
                      preserveAspectRatio="none"
                      className="mt-4 h-16 w-full text-ochre"
                      aria-hidden="true"
                    >
                      <polygon
                        points={`0,100 ${heatmapPoints} ${heatmap.length - 1},100`}
                        fill="currentColor"
                        fillOpacity={0.22}
                      />
                      <polyline
                        points={heatmapPoints}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    {heatmapPeak && (
                      <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                        Peak at{" "}
                        <a
                          href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(heatmapPeak.start)}s`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ochre-deep transition-colors hover:text-ochre"
                        >
                          {formatTime(heatmapPeak.start)}
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <h2 className="font-display text-[28px] font-black leading-[1.12] tracking-[-0.01em] text-ink md:text-[32px]">
                  {result.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-[14px] text-ink-soft">
                  <span className="inline-flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="h-4 w-4 text-ink-muted"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                    </svg>
                    {result.channelUrl ? (
                      <a
                        href={result.channelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ink transition-colors hover:text-ochre"
                      >
                        {result.channel}
                      </a>
                    ) : (
                      <span className="font-medium text-ink">{result.channel}</span>
                    )}
                    {result.channelFollowerCount != null && (
                      <span className="text-ink-muted">
                        · {abbreviate(result.channelFollowerCount)} subscribers
                      </span>
                    )}
                  </span>
                  {result.uploadDate && (
                    <span className="inline-flex items-center gap-2">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="h-4 w-4 text-ink-muted"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M3 10h18M8 2v4M16 2v4" />
                      </svg>
                      {formatDate(result.uploadDate)}
                    </span>
                  )}
                  <div className="ml-auto flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={downloadReportMd}
                      className="inline-flex items-center gap-1.5 border border-ink/60 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
                    >
                      <span aria-hidden="true">⬇️</span>
                      <span>Markdown (.md)</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadReportZip}
                      disabled={zipBusy}
                      className="inline-flex items-center gap-1.5 border border-ink/60 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span aria-hidden="true">⬇️</span>
                      <span>{zipBusy ? "Preparing…" : "Bundle (.zip)"}</span>
                    </button>
                  </div>
                </div>

                {result.categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.categories.map((c) => (
                      <span
                        key={c}
                        className="inline-block rounded-md border border-rule bg-paper px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ochre-deep"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="label-eyebrow text-ink">Tags</h3>
                      {tags.length > 0 && (
                        <button
                          type="button"
                          onClick={copyTags}
                          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ochre-deep transition-colors hover:text-ochre"
                        >
                          {copyIcon(copiedTags)}
                          {copiedTags ? "Copied" : "Copy Tags"}
                        </button>
                      )}
                    </div>
                    {tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tags.map((tag, i) => (
                          <span
                            key={`${tag}-${i}`}
                            className="rounded-lg border border-rule bg-paper px-2.5 py-1 font-mono text-[12px] text-ink-soft"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 font-body text-[14px] italic text-ink-muted">
                        This video has no public tags.
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="label-eyebrow text-ink">
                      Chapters{result.chapters.length > 0 ? ` (${result.chapters.length})` : ""}
                    </h3>
                    {result.chapters.length > 0 ? (
                      <ol className="mt-3 max-h-[280px] overflow-y-auto rounded-xl border border-rule bg-paper">
                        {result.chapters.map((c, i) => (
                          <li key={i} className="border-b border-rule last:border-b-0">
                            <a
                              href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(c.start)}s`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex gap-3 px-4 py-2 transition-colors hover:bg-paper-warm"
                            >
                              <span className="shrink-0 font-mono text-[12px] text-ochre-deep">
                                {formatTime(c.start)}
                              </span>
                              <span className="font-body text-[14px] leading-snug text-ink-soft">
                                {c.title}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-3 font-body text-[14px] italic text-ink-muted">
                        This video has no chapters.
                      </p>
                    )}
                  </div>
                </div>

                {result.description && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="label-eyebrow text-ink">Description</h3>
                      <button
                        type="button"
                        onClick={copyDescription}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ochre-deep transition-colors hover:text-ochre"
                      >
                        {copyIcon(copiedDesc)}
                        {copiedDesc ? "Copied" : "Copy Description"}
                      </button>
                    </div>
                    <div className="mt-3 max-h-[280px] overflow-y-auto rounded-xl border border-rule bg-paper p-4">
                      <pre className="whitespace-pre-wrap font-body text-[14px] leading-[1.65] text-ink-soft">
                        {result.description}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-display text-[26px] font-bold leading-tight text-ink">
                {result.title}
              </h2>
              <p className="mt-2 font-body text-[15px] text-ink-soft">
                {result.channel}
                {result.durationText && <> · {result.durationText}</>}
                {result.viewCount != null && <> · {formatCount(result.viewCount)} views</>}
                {result.uploadDate && <> · {result.uploadDate.slice(0, 10)}</>}
              </p>
            </>
          )}

          {/* ===== Thumbnails ===== */}
          <section className={`${sectionClass} ${showThumbnails ? "" : "hidden"}`}>
            <h2 className={sectionTitleClass}>Thumbnails</h2>
            {hero && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="label-eyebrow text-ink">{hero.label}</span>
                    <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-soft">
                      {hero.w}×{hero.h} · highest available
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <a
                      href={downloadThumbHref(hero.key)}
                      download={`${titleSlug}-${hero.key}.jpg`}
                      className="inline-block border border-ochre bg-ochre px-6 py-3 text-center font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep"
                    >
                      Download {hero.w}×{hero.h}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyUrl(hero.key, previewSrc(hero.key))}
                      className="inline-flex items-center gap-2 border border-ink/60 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
                    >
                      {copiedThumb === hero.key ? (
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                      {copiedThumb === hero.key ? "Copied" : "Copy URL"}
                    </button>
                    <a
                      href={previewSrc(hero.key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 border border-ink/60 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M15 3h6v6" />
                        <path d="M9 21H3v-6" />
                        <path d="M21 3l-7 7" />
                        <path d="M3 21l7-7" />
                      </svg>
                      Open full size
                    </a>
                  </div>
                </div>
                <a
                  href={previewSrc(hero.key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open full size"
                  className="mt-5 block overflow-hidden border border-rule"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc(hero.key)}
                    alt={`${hero.label} thumbnail`}
                    width={hero.w}
                    height={hero.h}
                    className="block h-auto w-full bg-paper-deep"
                    onError={() => markUnavailable(hero.key)}
                    onLoad={guardPlaceholder(hero)}
                  />
                </a>
              </div>
            )}

            {otherSizes.length > 0 && (
              <div className="mt-12">
                <h3 className="label-eyebrow text-ink">Other sizes</h3>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {otherSizes.map(renderThumbCard)}
                </div>
              </div>
            )}

            {frames.length > 0 && (
              <details className="mt-12">
                <summary className="cursor-pointer label-eyebrow text-ink-soft transition-colors hover:text-ochre">
                  Frame grabs ({frames.length})
                </summary>
                <p className="mt-2 font-body text-[14px] italic text-ink-muted">
                  Auto-extracted still frames from points along the video timeline.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {frames.map(renderThumbCard)}
                </div>
              </details>
            )}
          </section>

          {/* ===== Download ===== */}
          <section className={`${sectionClass} ${showDownload ? "" : "hidden"}`}>
            <h2 className={sectionTitleClass}>Download</h2>
            {formats ? (
              <>
                <h3 className="label-eyebrow mt-6 text-ink">Video</h3>
                {videoQualities.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {videoQualities.map((h) => (
                      <DownloadButton
                        key={h}
                        href={dlHref(String(h))}
                        label={HEIGHT_LABELS[h] ?? `${h}p`}
                        quality={String(h)}
                        filename={`${titleSlug}.mp4`}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 font-body text-[15px] italic text-ink-muted">
                    No downloadable video resolutions found for this video.
                  </p>
                )}

                {formats.hasAudio && (
                  <>
                    <h3 className="label-eyebrow mt-10 text-ink">Audio</h3>
                    <div className="mt-3">
                      <DownloadButton
                        href={dlHref("audio")}
                        label="Audio (MP3)"
                        quality="audio"
                        variant="secondary"
                        filename={`${titleSlug}.mp3`}
                      />
                    </div>
                  </>
                )}

                <p className="mt-10 max-w-[640px] font-body text-[14px] italic leading-[1.6] text-ink-muted">
                  Files are prepared on the server before the download begins, so it
                  may sit &ldquo;pending&rdquo; for a moment. 1080p and up
                  (especially 4K) can take a minute or two before the file starts
                  saving.
                </p>
              </>
            ) : (
              <p className="mt-6 font-body text-[15px] italic text-ink-muted">
                Couldn&rsquo;t load the downloadable formats for this video.
              </p>
            )}
          </section>

          {/* ===== Tags & SEO ===== */}
          <section className={`${sectionClass} ${showTags ? "" : "hidden"}`}>
            <h2 className={sectionTitleClass}>Tags &amp; SEO</h2>
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="label-eyebrow text-ink">Tags ({tags.length})</h3>
                {tags.length > 0 && (
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
                        tagsOverLimit ? "text-crimson" : "text-ink-muted"
                      }`}
                    >
                      {tagsString.length} / {TAG_CHAR_LIMIT} chars
                    </span>
                    <button
                      type="button"
                      onClick={copyTags}
                      className="whitespace-nowrap border border-ink/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
                    >
                      {copiedTags ? "Copied" : "Copy all"}
                    </button>
                  </div>
                )}
              </div>

              {tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className="border border-rule px-2 py-1 font-mono text-[12px] text-ink-soft"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 font-body text-[15px] italic text-ink-muted">
                  This video has no public tags.
                </p>
              )}
            </div>

            {keywords.length > 0 && (
              <div className="mt-10">
                <h3 className="label-eyebrow mb-2 text-ink">
                  Keyword ideas (from title, description &amp; tags)
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="border border-rule bg-paper-warm px-2 py-1 font-mono text-[12px] text-ink-soft"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ===== Transcript ===== */}
          <section className={`${sectionClass} ${showTranscript ? "" : "hidden"}`}>
            <h2 className={sectionTitleClass}>Transcript</h2>
            {transcript?.available ? (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h3 className="label-eyebrow text-ink">
                    {timedEntries.length} lines · {wordCount} words
                    {transcript.language ? ` · ${transcript.language}` : ""}
                    {transcript.isAutomatic ? " · auto" : ""}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex border border-rule">
                      <button
                        type="button"
                        onClick={() => setView("plain")}
                        className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors ${
                          view === "plain"
                            ? "bg-ochre text-paper"
                            : "text-ink-soft hover:text-ochre"
                        }`}
                      >
                        Plain
                      </button>
                      <button
                        type="button"
                        onClick={() => setView("timestamped")}
                        className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors ${
                          view === "timestamped"
                            ? "bg-ochre text-paper"
                            : "text-ink-soft hover:text-ochre"
                        }`}
                      >
                        Timestamps
                      </button>
                    </div>
                    <button type="button" onClick={copyTranscript} className={toolBtn}>
                      {copiedTx ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveFile(`${fileBase}.txt`, plainText)}
                      className={`${toolBtn} inline-flex items-center gap-1.5`}
                    >
                      <span aria-hidden="true">⬇️</span>
                      .TXT
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        saveFile(
                          `${fileBase}.md`,
                          toMarkdown(
                            {
                              videoId,
                              language: transcript.language,
                              isAutomatic: transcript.isAutomatic,
                            },
                            plainText,
                          ),
                        )
                      }
                      className={`${toolBtn} inline-flex items-center gap-1.5`}
                    >
                      <span aria-hidden="true">⬇️</span>
                      .MD
                    </button>
                    <button
                      type="button"
                      onClick={() => saveFile(`${fileBase}.srt`, toSrt(timedEntries))}
                      className={`${toolBtn} inline-flex items-center gap-1.5`}
                    >
                      <span aria-hidden="true">⬇️</span>
                      .SRT
                    </button>
                  </div>
                </div>

                {view === "plain" ? (
                  <div className="mt-4 max-h-[560px] overflow-y-auto border border-rule bg-paper-warm p-6">
                    <p className="whitespace-pre-wrap font-body text-[15px] leading-[1.75] text-ink-soft">
                      {plainText}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 max-h-[560px] overflow-y-auto border border-rule">
                    <table className="w-full border-collapse">
                      <tbody>
                        {timedEntries.map((entry, i) => (
                          <tr
                            key={i}
                            className={`align-top ${i % 2 === 1 ? "bg-paper-warm" : ""}`}
                          >
                            <td className="w-20 px-3 py-2 font-mono text-[12px] text-ochre-deep">
                              {formatTime(entry.start)}
                            </td>
                            <td className="px-3 py-2 font-body text-[15px] leading-[1.5] text-ink-soft">
                              {entry.text}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-6 font-body text-[15px] italic text-ink-muted">
                This video has no captions available.
              </p>
            )}
          </section>
        </div>
      )}

      <section
        className={`mt-20 border-t-2 border-rule-strong pt-12 ${result ? "hidden" : ""}`}
      >
        <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          Everything from one YouTube link
        </h2>
        <p className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"This is a free, all-in-one YouTube toolkit that runs in your browser. Paste a single link and it pulls the transcript, download options, thumbnails, and tags together, so you do not need a separate site for each job. Prefer a focused tool? Each one has its own page:"}
        </p>
        <ul className="mt-4 max-w-[720px] list-disc space-y-2 pl-5 font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          <li>
            <Link href="/transcript" className="text-ochre-deep underline hover:text-ochre">
              YouTube transcript generator
            </Link>
            {": the full caption track as clean text or SRT subtitles."}
          </li>
          <li>
            <Link href="/download" className="text-ochre-deep underline hover:text-ochre">
              YouTube video downloader
            </Link>
            {": save the video up to 4K, or just the audio as an MP3."}
          </li>
          <li>
            <Link href="/thumbnails" className="text-ochre-deep underline hover:text-ochre">
              YouTube thumbnail downloader
            </Link>
            {": every thumbnail size plus auto-extracted frame grabs."}
          </li>
          <li>
            <Link href="/tags" className="text-ochre-deep underline hover:text-ochre">
              YouTube tag extractor
            </Link>
            {": a video's hidden tags and keyword ideas for your own metadata."}
          </li>
        </ul>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          How it works
        </h2>
        <ol className="mt-4 max-w-[720px] list-decimal space-y-2 pl-5 font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          <li>{"Copy the link to any public YouTube video."}</li>
          <li>{"Paste it into the box above and select Extract."}</li>
          <li>{"Use the transcript, downloads, thumbnails, and tags from the results."}</li>
        </ol>

        <p className="mt-8 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"Every tool is free with no account. For daily limits and HD or 4K downloads, see "}
          <Link href="/pricing" className="text-ochre-deep underline hover:text-ochre">
            pricing
          </Link>
          {", or read the "}
          <Link href="/faq" className="text-ochre-deep underline hover:text-ochre">
            FAQ
          </Link>
          {"."}
        </p>
      </section>
    </PageShell>
  );
}
