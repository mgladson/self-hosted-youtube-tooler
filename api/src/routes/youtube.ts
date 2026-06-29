import type { FastifyInstance, FastifyReply } from 'fastify';
import { createReadStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { getClientIp } from '../lib/client-ip.js';
import {
  canonicalUrl,
  downloadMedia,
  type DownloadResult,
  extractVideoId,
  extractYouTube,
  getAvailableFormats,
  getTranscript,
  YouTubeError,
  type YouTubeErrorCode,
  type YouTubeExtractResult,
} from '../lib/youtube.js';
import {
  resolveEntitlement,
  chargeLookupQuota,
  chargeDownloadQuota,
  isQualityAllowed,
} from '../lib/entitlement.js';
import { config } from '../config.js';

const EXTRACT_TIMEOUT_MS = 120_000;

// Transcripts are immutable, so a long cache is safe and is the main defense
// against YouTube rate-limiting: each video is fetched from YouTube at most once.
const CACHE_PREFIX = 'youtube:extract:';
const CACHE_TTL_S = 60 * 60 * 24 * 30; // 30 days

// Per-IP throttle applied ONLY to cache-miss (YouTube-hitting) requests, so
// browsing already-cached videos is never limited.
const RATE_PREFIX = 'youtube:rl:';
const RATE_LIMIT = 20;
const RATE_WINDOW_S = 60;

function statusForCode(code: YouTubeErrorCode): number {
  switch (code) {
    case 'invalid_url':
      return 400;
    case 'unavailable':
      return 404;
    case 'rate_limited':
      return 429;
    case 'timeout':
      return 504;
    case 'yt_dlp_missing':
      return 500;
    case 'fetch_failed':
    default:
      return 502;
  }
}

function sendError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof YouTubeError) {
    return reply.status(statusForCode(err.code)).send({ error: err.message, code: err.code });
  }
  return reply.status(500).send({ error: 'Internal error processing the video.' });
}

export async function youtubeRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { url?: string } }>(
    '/api/youtube/extract',
    async (request, reply) => {
      const input = (request.query.url || '').trim();
      if (!input) {
        return reply.status(400).send({ error: 'The "url" query parameter is required.' });
      }
      const videoId = extractVideoId(input);
      if (!videoId) {
        return reply.status(400).send({ error: 'Not a valid YouTube URL or video id.' });
      }

      const cacheKey = CACHE_PREFIX + videoId;

      // 1) Cache hit → serve instantly, no YouTube traffic, no rate limiting.
      try {
        const cached = await fastify.valkey.get(cacheKey);
        if (cached) {
          reply.header('X-Cache', 'HIT');
          reply.header('Cache-Control', 'public, max-age=3600');
          return reply.send(JSON.parse(cached) as YouTubeExtractResult);
        }
      } catch (err) {
        fastify.log.warn({ err }, 'youtube cache read failed');
      }

      // 2) Cache miss → throttle per client IP (this is the request that hits YouTube).
      try {
        const rlKey = RATE_PREFIX + getClientIp(request);
        const count = await fastify.valkey.incr(rlKey);
        if (count === 1) await fastify.valkey.expire(rlKey, RATE_WINDOW_S);
        if (count > RATE_LIMIT) {
          reply.header('Retry-After', String(RATE_WINDOW_S));
          return reply.status(429).send({
            error: 'Too many new lookups from your network. Wait a minute and try again.',
            code: 'rate_limited',
          });
        }
      } catch (err) {
        fastify.log.warn({ err }, 'youtube rate-limit check failed');
      }

      // Per-tier daily quota — pooled lookups, charged once per video per day, only on
      // the cache-miss path (this is the request that hits YouTube).
      const ent = await resolveEntitlement(fastify, request);
      const quota = await chargeLookupQuota(fastify, ent, videoId);
      if (!quota.allowed) {
        fastify.metrics.quotaExceededTotal.inc({ tier: ent.tier, feature: 'lookup' });
        reply.header('Retry-After', String(quota.retryAfter));
        return reply.status(429).send({
          error: "You've reached today's free limit — upgrade to the Paid plan for more.",
          code: 'quota_exceeded',
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt,
          upgrade: true,
        });
      }

      // 3) Fetch (yt-dlp Android-client method; routed through YT_DLP_PROXY if set), then cache.
      try {
        const result = await extractYouTube(input, { timeoutMs: EXTRACT_TIMEOUT_MS });
        try {
          await fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_S);
        } catch (err) {
          fastify.log.warn({ err }, 'youtube cache write failed');
        }
        reply.header('X-Cache', 'MISS');
        reply.header('Cache-Control', 'public, max-age=3600');
        return reply.send(result);
      } catch (err) {
        fastify.log.warn(
          { err: err instanceof Error ? err.message : err, videoId },
          'youtube extract failed',
        );
        return sendError(reply, err);
      }
    },
  );

  // Transcript-only — lighter than /extract (skips the metadata fetch). Returns
  // the same Transcript shape (+ videoId), valkey-cached, and shares the per-IP
  // YouTube rate limit since a cache miss hits YouTube for the subtitles.
  const TRANSCRIPT_CACHE_PREFIX = 'youtube:transcript:';

  fastify.get<{ Querystring: { url?: string } }>(
    '/api/youtube/transcript',
    async (request, reply) => {
      const input = (request.query.url || '').trim();
      if (!input) {
        return reply.status(400).send({ error: 'The "url" query parameter is required.' });
      }
      const videoId = extractVideoId(input);
      if (!videoId) {
        return reply.status(400).send({ error: 'Not a valid YouTube URL or video id.' });
      }
      const cacheKey = TRANSCRIPT_CACHE_PREFIX + videoId;
      try {
        const cached = await fastify.valkey.get(cacheKey);
        if (cached) {
          reply.header('X-Cache', 'HIT');
          reply.header('Cache-Control', 'public, max-age=3600');
          return reply.send(JSON.parse(cached));
        }
      } catch (err) {
        fastify.log.warn({ err }, 'youtube transcript cache read failed');
      }

      try {
        const rlKey = RATE_PREFIX + getClientIp(request);
        const count = await fastify.valkey.incr(rlKey);
        if (count === 1) await fastify.valkey.expire(rlKey, RATE_WINDOW_S);
        if (count > RATE_LIMIT) {
          reply.header('Retry-After', String(RATE_WINDOW_S));
          return reply.status(429).send({
            error: 'Too many new lookups from your network. Wait a minute and try again.',
            code: 'rate_limited',
          });
        }
      } catch (err) {
        fastify.log.warn({ err }, 'youtube transcript rate-limit check failed');
      }

      const ent = await resolveEntitlement(fastify, request);
      const quota = await chargeLookupQuota(fastify, ent, videoId);
      if (!quota.allowed) {
        fastify.metrics.quotaExceededTotal.inc({ tier: ent.tier, feature: 'lookup' });
        reply.header('Retry-After', String(quota.retryAfter));
        return reply.status(429).send({
          error: "You've reached today's free limit — upgrade to the Paid plan for more.",
          code: 'quota_exceeded',
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt,
          upgrade: true,
        });
      }

      try {
        const transcript = await getTranscript(canonicalUrl(videoId));
        const result = { videoId, ...transcript };
        try {
          await fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_S);
        } catch (err) {
          fastify.log.warn({ err }, 'youtube transcript cache write failed');
        }
        reply.header('X-Cache', 'MISS');
        reply.header('Cache-Control', 'public, max-age=3600');
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Same-origin thumbnail proxy. Browsers ignore the <a download> attribute for
  // cross-origin resources, so the frontend can't trigger a real download
  // straight from i.ytimg.com — it routes through here, which streams the image
  // back with Content-Disposition: attachment. Host is fixed (no SSRF surface);
  // id + res are validated against tight allowlists.
  const THUMB_RES = new Set([
    'maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default', '1', '2', '3',
  ]);

  fastify.get<{ Querystring: { id?: string; res?: string } }>(
    '/api/youtube/thumbnail',
    async (request, reply) => {
      const id = (request.query.id || '').trim();
      const res = (request.query.res || 'hqdefault').trim();
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return reply.status(400).send({ error: 'Invalid or missing video id.' });
      }
      if (!THUMB_RES.has(res)) {
        return reply.status(400).send({ error: 'Invalid thumbnail resolution.' });
      }
      try {
        const upstream = await fetch(`https://i.ytimg.com/vi/${id}/${res}.jpg`);
        if (!upstream.ok) {
          return reply.status(404).send({ error: 'Thumbnail not available at this resolution.' });
        }
        const buf = Buffer.from(await upstream.arrayBuffer());
        reply.header('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
        reply.header('Content-Disposition', `attachment; filename="${id}-${res}.jpg"`);
        reply.header('Cache-Control', 'public, max-age=86400');
        return reply.send(buf);
      } catch (err) {
        fastify.log.warn(
          { err: err instanceof Error ? err.message : err, id, res },
          'youtube thumbnail proxy failed',
        );
        return reply.status(502).send({ error: 'Failed to fetch thumbnail.' });
      }
    },
  );

  // Available video resolutions + audio flag, so the UI only offers real options.
  const FORMATS_CACHE_PREFIX = 'youtube:formats:';

  fastify.get<{ Querystring: { url?: string } }>(
    '/api/youtube/formats',
    async (request, reply) => {
      const input = (request.query.url || '').trim();
      if (!input) {
        return reply.status(400).send({ error: 'The "url" query parameter is required.' });
      }
      const videoId = extractVideoId(input);
      if (!videoId) {
        return reply.status(400).send({ error: 'Not a valid YouTube URL or video id.' });
      }
      const cacheKey = FORMATS_CACHE_PREFIX + videoId;
      try {
        const cached = await fastify.valkey.get(cacheKey);
        if (cached) {
          reply.header('X-Cache', 'HIT');
          reply.header('Cache-Control', 'public, max-age=3600');
          return reply.send(JSON.parse(cached));
        }
      } catch (err) {
        fastify.log.warn({ err }, 'youtube formats cache read failed');
      }

      const ent = await resolveEntitlement(fastify, request);
      const quota = await chargeLookupQuota(fastify, ent, videoId);
      if (!quota.allowed) {
        fastify.metrics.quotaExceededTotal.inc({ tier: ent.tier, feature: 'lookup' });
        reply.header('Retry-After', String(quota.retryAfter));
        return reply.status(429).send({
          error: "You've reached today's free limit — upgrade to the Paid plan for more.",
          code: 'quota_exceeded',
          used: quota.used,
          limit: quota.limit,
          resetAt: quota.resetAt,
          upgrade: true,
        });
      }

      try {
        const result = await getAvailableFormats(input);
        try {
          await fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_S);
        } catch (err) {
          fastify.log.warn({ err }, 'youtube formats cache write failed');
        }
        reply.header('X-Cache', 'MISS');
        reply.header('Cache-Control', 'public, max-age=3600');
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Streaming download. yt-dlp fetches (+ ffmpeg merges) to a temp file, which we
  // stream back as an attachment, then clean up. Heavy, so it's throttled per IP.
  const DL_RATE_PREFIX = 'youtube:dl:rl:';
  const DL_RATE_LIMIT = 10;
  const DL_RATE_WINDOW_S = 600;
  const DL_QUALITIES = new Set(['audio', '360', '480', '720', '1080', '1440', '2160']);
  // R2 download cache: serve a stored merged file when it's still fresh, else
  // re-fetch. 24h freshness is enforced on read here; a 1-day R2 lifecycle rule
  // reclaims the storage. Presigned URLs are short-lived (mirrors download.ts).
  const R2_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const R2_PRESIGN_TTL_S = 5 * 60;

  fastify.get<{ Querystring: { url?: string; quality?: string } }>(
    '/api/youtube/download',
    async (request, reply) => {
      const input = (request.query.url || '').trim();
      const quality = (request.query.quality || '').trim();
      if (!input) {
        return reply.status(400).send({ error: 'The "url" query parameter is required.' });
      }
      if (!DL_QUALITIES.has(quality)) {
        return reply.status(400).send({ error: 'Invalid or missing "quality".' });
      }
      const videoId = extractVideoId(input);
      if (!videoId) {
        return reply.status(400).send({ error: 'Not a valid YouTube URL or video id.' });
      }

      // Downloads are the expensive path: basic quality (audio + up to 720p) is free
      // to everyone with a daily allowance; HD/4K is reserved for Supporters.
      const ent = await resolveEntitlement(fastify, request);
      if (!isQualityAllowed(ent.isPro, quality)) {
        return reply.status(402).send({
          error: 'HD and 4K downloads need the Paid plan. Upgrade to download this quality.',
          code: 'upgrade_required',
          upgrade: true,
        });
      }

      try {
        const rlKey = DL_RATE_PREFIX + getClientIp(request);
        const count = await fastify.valkey.incr(rlKey);
        if (count === 1) await fastify.valkey.expire(rlKey, DL_RATE_WINDOW_S);
        if (count > DL_RATE_LIMIT) {
          reply.header('Retry-After', String(DL_RATE_WINDOW_S));
          return reply.status(429).send({
            error: 'Too many downloads from your network. Wait a few minutes and try again.',
            code: 'rate_limited',
          });
        }
      } catch (err) {
        fastify.log.warn({ err }, 'youtube download rate-limit check failed');
      }

      // Per-tier daily download allowance (downloads always count — never cached).
      const dlQuota = await chargeDownloadQuota(fastify, ent);
      if (!dlQuota.allowed) {
        fastify.metrics.quotaExceededTotal.inc({ tier: ent.tier, feature: 'download' });
        reply.header('Retry-After', String(dlQuota.retryAfter));
        return reply.status(429).send({
          error: "You've reached today's free download limit — upgrade to the Paid plan for more.",
          code: 'quota_exceeded',
          used: dlQuota.used,
          limit: dlQuota.limit,
          resetAt: dlQuota.resetAt,
          upgrade: true,
        });
      }

      // Stream a freshly-downloaded temp file straight to the client. This is the
      // pre-R2 behavior and the fallback when R2 is unavailable; it owns cleanup.
      const streamTemp = async (media: DownloadResult) => {
        const { dir, filePath, filename, contentType } = media;
        const cleanup = () => {
          rm(dir, { recursive: true, force: true }).catch(() => {});
        };
        let size = 0;
        try {
          size = (await stat(filePath)).size;
        } catch {
          // non-fatal — stream without a Content-Length
        }
        const stream = createReadStream(filePath);
        stream.on('error', cleanup);
        stream.on('close', cleanup);

        reply.header('Content-Type', contentType);
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        if (size > 0) reply.header('Content-Length', String(size));
        reply.header('Cache-Control', 'no-store');
        return reply.send(stream);
      };

      // With R2 configured, cache merged downloads there and hand the client a
      // short-lived presigned URL (302). Repeat downloads of the same video then
      // skip yt-dlp/ffmpeg and serve from R2's free egress. Any R2 error falls
      // back to direct streaming, so a download never hard-fails because of it.
      const r2 = fastify.r2;
      if (r2) {
        const ext = quality === 'audio' ? 'mp3' : 'mp4';
        const r2ContentType = quality === 'audio' ? 'audio/mpeg' : 'video/mp4';
        const bucket = config.r2.bucket;
        const key = `yt/${videoId}/${quality}.${ext}`;

        // Cache hit: a stored copy still inside the 24h freshness window.
        try {
          const st = await r2.statObject(bucket, key);
          if (Date.now() - st.lastModified.getTime() <= R2_CACHE_TTL_MS) {
            const name = (st.metaData as Record<string, string>)['filename'] || `${videoId}.${ext}`;
            const url = await r2.presignedGetObject(bucket, key, R2_PRESIGN_TTL_S, {
              'response-content-disposition': `attachment; filename="${name}"`,
            });
            return reply.redirect(url, 302);
          }
        } catch {
          // object missing or a transient stat error → fetch it below
        }

        let media: DownloadResult;
        try {
          media = await downloadMedia(input, quality);
        } catch (err) {
          fastify.log.warn(
            { err: err instanceof Error ? err.message : err, quality },
            'youtube download failed',
          );
          return sendError(reply, err);
        }

        try {
          await r2.fPutObject(bucket, key, media.filePath, {
            'Content-Type': r2ContentType,
            filename: media.filename,
          });
          const url = await r2.presignedGetObject(bucket, key, R2_PRESIGN_TTL_S, {
            'response-content-disposition': `attachment; filename="${media.filename}"`,
          });
          rm(media.dir, { recursive: true, force: true }).catch(() => {});
          return reply.redirect(url, 302);
        } catch (err) {
          // R2 store/presign failed — serve the file we already have on local disk.
          fastify.log.warn({ err }, 'R2 store failed; streaming download directly');
          return streamTemp(media);
        }
      }

      // No R2 configured: download and stream straight back.
      let media: DownloadResult;
      try {
        media = await downloadMedia(input, quality);
      } catch (err) {
        fastify.log.warn(
          { err: err instanceof Error ? err.message : err, quality },
          'youtube download failed',
        );
        return sendError(reply, err);
      }
      return streamTemp(media);
    },
  );
}
