import type { FastifyInstance, FastifyReply } from 'fastify';
import { createReadStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { getClientIp } from '../lib/client-ip.js';
import {
  downloadMedia,
  extractVideoId,
  extractYouTube,
  getAvailableFormats,
  YouTubeError,
  type YouTubeErrorCode,
  type YouTubeExtractResult,
} from '../lib/youtube.js';

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
      if (!extractVideoId(input)) {
        return reply.status(400).send({ error: 'Not a valid YouTube URL or video id.' });
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

      let media;
      try {
        media = await downloadMedia(input, quality);
      } catch (err) {
        fastify.log.warn(
          { err: err instanceof Error ? err.message : err, quality },
          'youtube download failed',
        );
        return sendError(reply, err);
      }

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
    },
  );
}
