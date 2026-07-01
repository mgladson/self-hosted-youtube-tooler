// Public, versioned developer API. Every route here is authenticated by an API key
// (Authorization: Bearer <key>), rate-limited per key, and metered in credits — as
// opposed to the internal /api/youtube/* web-tool routes, which are session/IP gated.
// The heavy lifting is delegated to the same extraction lib and shares the same Valkey
// caches as the website, so an API call warms (and is warmed by) the web tools.
//
// Billing model: the credit cost is debited up front (so we never do expensive work for
// a caller who can't pay) and refunded if the upstream fetch fails, giving the
// competitor's "0 credits on error" semantics. Successful cache hits still cost — the
// product is the data, not the compute.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createReadStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import {
  canonicalUrl,
  type DownloadResult,
  downloadMedia,
  extractVideoId,
  extractYouTube,
  getAvailableFormats,
  getTranscript,
  getVideoMetadata,
  mediaKey,
  YouTubeError,
  type YouTubeErrorCode,
} from '../lib/youtube.js';
import { charge, downloadCost, grant, LOOKUP_COST } from '../lib/credits.js';
import type { ApiCaller } from '../plugins/api-auth.js';
import { config } from '../config.js';

// Shared cache prefixes + TTL, matching api/src/routes/youtube.ts so API and web hit the
// same cached rows. Transcripts/metadata are immutable, so a long TTL is safe.
const CACHE_TTL_S = 60 * 60 * 24 * 30; // 30 days
const EXTRACT_TIMEOUT_MS = 120_000;
const EXTRACT_CACHE_PREFIX = 'youtube:extract:';
const META_CACHE_PREFIX = 'youtube:meta:';
const TRANSCRIPT_CACHE_PREFIX = 'youtube:transcript:';
const FORMATS_CACHE_PREFIX = 'youtube:formats:';

// Per-key rate limits (fixed window). Lookups are cheap; downloads are heavy, so they
// get their own tighter bucket.
const RL_LIMIT = 120;
const RL_WINDOW_S = 60;
const DL_RL_LIMIT = 30;
const DL_RL_WINDOW_S = 600;

const DL_QUALITIES = new Set(['audio', '360', '480', '720', '1080', '1440', '2160']);
const R2_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const R2_PRESIGN_TTL_S = 5 * 60;

// Canonical YouTube thumbnail renditions. These are predictable CDN URLs derived from
// the video id (no upstream call); maxresdefault/sddefault are not present for every
// video, which the docs call out.
const THUMB_RENDITIONS = [
  { quality: 'maxresdefault', width: 1280, height: 720 },
  { quality: 'sddefault', width: 640, height: 480 },
  { quality: 'hqdefault', width: 480, height: 360 },
  { quality: 'mqdefault', width: 320, height: 180 },
  { quality: 'default', width: 120, height: 90 },
];

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
  return reply.status(500).send({ error: 'Internal error processing the request.', code: 'internal' });
}

// Fixed-window per-key limiter. Always sets the X-RateLimit-* headers; sends a 429 and
// returns false when the bucket is over its limit. Fails OPEN on a Valkey hiccup so the
// limiter never blocks paid traffic.
async function rateLimit(
  fastify: FastifyInstance,
  reply: FastifyReply,
  bucket: string,
  limit: number,
  windowS: number,
): Promise<boolean> {
  try {
    const count = await fastify.valkey.incr(bucket);
    if (count === 1) await fastify.valkey.expire(bucket, windowS);
    const ttl = await fastify.valkey.ttl(bucket);
    const window = ttl > 0 ? ttl : windowS;
    reply.header('X-RateLimit-Limit', String(limit));
    reply.header('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
    reply.header('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + window));
    if (count > limit) {
      reply.header('Retry-After', String(window));
      reply.status(429).send({ error: 'Rate limit exceeded. Slow down and retry.', code: 'rate_limited' });
      return false;
    }
    return true;
  } catch (err) {
    fastify.log.warn({ err }, 'v1 rate limit check failed');
    return true;
  }
}

// Best-effort credit refund used when the upstream fetch fails after we debited.
async function refund(fastify: FastifyInstance, email: string, cost: number, ref: string): Promise<void> {
  try {
    await grant(fastify, email, cost, 'refund', ref);
  } catch (err) {
    fastify.log.warn({ err }, 'v1 credit refund failed');
  }
}

export async function v1Routes(fastify: FastifyInstance) {
  // Authenticate + rate-limit. Returns the caller, or null after having already sent a
  // 401/429. Downloads use their own tighter bucket.
  async function begin(
    request: FastifyRequest,
    reply: FastifyReply,
    opts: { download?: boolean } = {},
  ): Promise<ApiCaller | null> {
    const caller = await fastify.apiKeyAuth(request, reply);
    if (!caller) return null;
    const bucket = opts.download
      ? { key: `apiv1:dlrl:${caller.keyId}`, limit: DL_RL_LIMIT, window: DL_RL_WINDOW_S }
      : { key: `apiv1:rl:${caller.keyId}`, limit: RL_LIMIT, window: RL_WINDOW_S };
    if (!(await rateLimit(fastify, reply, bucket.key, bucket.limit, bucket.window))) return null;
    return caller;
  }

  // Debit `cost` credits. Returns false after sending a 402 when the balance is short.
  async function chargeOr402(
    reply: FastifyReply,
    caller: ApiCaller,
    cost: number,
    reason: string,
    ref: string,
  ): Promise<boolean> {
    const res = await charge(fastify, caller.email, cost, reason, ref);
    if (!res.ok) {
      reply.status(402).send({
        error: 'Insufficient credits. Add credits to continue.',
        code: 'insufficient_credits',
        balance: res.balance,
        required: cost,
      });
      return false;
    }
    fastify.metrics.apiCreditsChargedTotal.inc({ endpoint: reason }, cost);
    return true;
  }

  const INVALID_URL = { error: 'Provide a valid YouTube URL or 11-character video id.', code: 'invalid_url' };

  // GET /api/v1/youtube/video — full metadata + transcript.
  fastify.get<{ Querystring: { url?: string } }>('/api/v1/youtube/video', async (request, reply) => {
    const caller = await begin(request, reply);
    if (!caller) return reply;
    const input = (request.query.url || '').trim();
    const videoId = extractVideoId(input);
    if (!videoId) return reply.status(400).send(INVALID_URL);
    if (!(await chargeOr402(reply, caller, LOOKUP_COST, 'video', videoId))) return reply;

    const cacheKey = EXTRACT_CACHE_PREFIX + videoId;
    try {
      const cached = await fastify.valkey.get(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return reply.send(JSON.parse(cached));
      }
    } catch (err) {
      fastify.log.warn({ err }, 'v1 video cache read failed');
    }
    try {
      const result = await extractYouTube(input, { timeoutMs: EXTRACT_TIMEOUT_MS });
      fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_S).catch(() => {});
      reply.header('X-Cache', 'MISS');
      return reply.send(result);
    } catch (err) {
      await refund(fastify, caller.email, LOOKUP_COST, videoId);
      return sendError(reply, err);
    }
  });

  // GET /api/v1/youtube/metadata — metadata only (no transcript).
  fastify.get<{ Querystring: { url?: string } }>('/api/v1/youtube/metadata', async (request, reply) => {
    const caller = await begin(request, reply);
    if (!caller) return reply;
    const input = (request.query.url || '').trim();
    const videoId = extractVideoId(input);
    if (!videoId) return reply.status(400).send(INVALID_URL);
    if (!(await chargeOr402(reply, caller, LOOKUP_COST, 'metadata', videoId))) return reply;

    const cacheKey = META_CACHE_PREFIX + videoId;
    try {
      const cached = await fastify.valkey.get(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return reply.send(JSON.parse(cached));
      }
    } catch (err) {
      fastify.log.warn({ err }, 'v1 metadata cache read failed');
    }
    try {
      const meta = await getVideoMetadata(canonicalUrl(videoId), { timeoutMs: EXTRACT_TIMEOUT_MS });
      fastify.valkey.set(cacheKey, JSON.stringify(meta), 'EX', CACHE_TTL_S).catch(() => {});
      reply.header('X-Cache', 'MISS');
      return reply.send(meta);
    } catch (err) {
      await refund(fastify, caller.email, LOOKUP_COST, videoId);
      return sendError(reply, err);
    }
  });

  // GET /api/v1/youtube/transcript — transcript only.
  fastify.get<{ Querystring: { url?: string } }>('/api/v1/youtube/transcript', async (request, reply) => {
    const caller = await begin(request, reply);
    if (!caller) return reply;
    const input = (request.query.url || '').trim();
    const videoId = extractVideoId(input);
    if (!videoId) return reply.status(400).send(INVALID_URL);
    if (!(await chargeOr402(reply, caller, LOOKUP_COST, 'transcript', videoId))) return reply;

    const cacheKey = TRANSCRIPT_CACHE_PREFIX + videoId;
    try {
      const cached = await fastify.valkey.get(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return reply.send(JSON.parse(cached));
      }
    } catch (err) {
      fastify.log.warn({ err }, 'v1 transcript cache read failed');
    }
    try {
      const transcript = await getTranscript(canonicalUrl(videoId));
      const result = { videoId, ...transcript };
      fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_S).catch(() => {});
      reply.header('X-Cache', 'MISS');
      return reply.send(result);
    } catch (err) {
      await refund(fastify, caller.email, LOOKUP_COST, videoId);
      return sendError(reply, err);
    }
  });

  // GET /api/v1/youtube/formats — available resolutions + audio flag (multi-source).
  fastify.get<{ Querystring: { url?: string } }>('/api/v1/youtube/formats', async (request, reply) => {
    const caller = await begin(request, reply);
    if (!caller) return reply;
    const input = (request.query.url || '').trim();
    if (!input) return reply.status(400).send({ error: 'The "url" query parameter is required.', code: 'invalid_url' });
    let idKey: string;
    try {
      idKey = mediaKey(input);
    } catch (err) {
      return sendError(reply, err);
    }
    if (!(await chargeOr402(reply, caller, LOOKUP_COST, 'formats', idKey))) return reply;

    const cacheKey = FORMATS_CACHE_PREFIX + idKey;
    try {
      const cached = await fastify.valkey.get(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return reply.send(JSON.parse(cached));
      }
    } catch (err) {
      fastify.log.warn({ err }, 'v1 formats cache read failed');
    }
    try {
      const result = await getAvailableFormats(input);
      fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_S).catch(() => {});
      reply.header('X-Cache', 'MISS');
      return reply.send(result);
    } catch (err) {
      await refund(fastify, caller.email, LOOKUP_COST, idKey);
      return sendError(reply, err);
    }
  });

  // GET /api/v1/youtube/thumbnails — canonical thumbnail URLs (no upstream fetch).
  fastify.get<{ Querystring: { url?: string } }>('/api/v1/youtube/thumbnails', async (request, reply) => {
    const caller = await begin(request, reply);
    if (!caller) return reply;
    const input = (request.query.url || '').trim();
    const videoId = extractVideoId(input);
    if (!videoId) return reply.status(400).send(INVALID_URL);
    if (!(await chargeOr402(reply, caller, LOOKUP_COST, 'thumbnails', videoId))) return reply;
    const thumbnails = THUMB_RENDITIONS.map((t) => ({
      quality: t.quality,
      width: t.width,
      height: t.height,
      url: `https://i.ytimg.com/vi/${videoId}/${t.quality}.jpg`,
    }));
    return reply.send({ videoId, thumbnails });
  });

  // GET /api/v1/youtube/download — media as an attachment, or a 302 to a short-lived R2
  // URL when the cache is configured + warm. Cost scales with quality.
  fastify.get<{ Querystring: { url?: string; quality?: string } }>(
    '/api/v1/youtube/download',
    async (request, reply) => {
      const caller = await begin(request, reply, { download: true });
      if (!caller) return reply;
      const input = (request.query.url || '').trim();
      const quality = (request.query.quality || '').trim();
      if (!input) return reply.status(400).send({ error: 'The "url" query parameter is required.', code: 'invalid_url' });
      if (!DL_QUALITIES.has(quality)) {
        return reply.status(400).send({
          error: 'Invalid or missing "quality". Use audio, 360, 480, 720, 1080, 1440, or 2160.',
          code: 'invalid_quality',
        });
      }
      let idKey: string;
      try {
        idKey = mediaKey(input);
      } catch (err) {
        return sendError(reply, err);
      }

      const cost = downloadCost(quality);
      const ref = `${idKey}:${quality}`;
      if (!(await chargeOr402(reply, caller, cost, 'download', ref))) return reply;

      // Stream a freshly-downloaded temp file to the client, owning its cleanup. This is
      // the fallback when R2 is unavailable.
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

      const r2 = fastify.r2;
      if (r2) {
        const ext = quality === 'audio' ? 'mp3' : 'mp4';
        const r2ContentType = quality === 'audio' ? 'audio/mpeg' : 'video/mp4';
        const bucket = config.r2.bucket;
        const key = `yt/${idKey.replace(/^yt:/, '').replace(/:/g, '/')}/${quality}.${ext}`;

        try {
          const st = await r2.statObject(bucket, key);
          if (Date.now() - st.lastModified.getTime() <= R2_CACHE_TTL_MS) {
            const name =
              (st.metaData as Record<string, string>)['filename'] ||
              `${idKey.replace(/^yt:/, '').replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;
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
          await refund(fastify, caller.email, cost, ref);
          fastify.log.warn({ err: err instanceof Error ? err.message : err, quality }, 'v1 download failed');
          return sendError(reply, err);
        }
        fastify.metrics.downloadBytesTotal.inc({ quality, tier: 'api' }, media.bytes);

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
          fastify.log.warn({ err }, 'v1 R2 store failed; streaming download directly');
          return streamTemp(media);
        }
      }

      let media: DownloadResult;
      try {
        media = await downloadMedia(input, quality);
      } catch (err) {
        await refund(fastify, caller.email, cost, ref);
        fastify.log.warn({ err: err instanceof Error ? err.message : err, quality }, 'v1 download failed');
        return sendError(reply, err);
      }
      fastify.metrics.downloadBytesTotal.inc({ quality, tier: 'api' }, media.bytes);
      return streamTemp(media);
    },
  );
}
