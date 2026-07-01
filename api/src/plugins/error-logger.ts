import crypto from 'node:crypto';
import fp from 'fastify-plugin';
import { getClientIp } from '../lib/client-ip.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// Persists every server-side failure (HTTP >= 500) so the admin "Technical" tab
// can group, rank and garbage-collect them for triage. Mirrors bot-detector's
// non-blocking design: enqueue to a Valkey buffer on the response path, then a
// 5s interval batch-inserts into Postgres. Logging an error must never delay or
// fail the response it describes.
//
// Capture is layered so it catches both failure shapes:
//   - onError   — thrown errors (rich: message + stack + code)
//   - onSend    — manually-returned 5xx bodies (e.g. youtube's sendError does
//                 reply.status(502).send({ error, code }) WITHOUT throwing, so
//                 onError never fires — we read the JSON body instead)
//   - onResponse — the single sink: enqueues once per request if the final
//                 status is >= 500, using whatever the above captured.

// 4xx are normal client errors (bad url, rate limited, quota) — not worth
// triaging; only 5xx (our failures + upstream failures) are captured.
const CAPTURE_MIN_STATUS = 500;

const BUFFER_KEY = 'errors:buffer';
const FLUSHING_KEY = 'errors:buffer:flushing';
const BUFFER_CAP = 49_999; // ~50k errors held in Valkey between flushes, then dropped oldest-first
const FLUSH_BATCH = 5_000;
const FLUSH_INTERVAL_MS = 5_000;
const RETENTION_SWEEP_MS = 60 * 60 * 1000; // hourly

// Triaged/old errors are GC'd after this many days. Overridable via env; the
// default keeps the table small on the single prod box without losing a useful
// triage window.
const RETENTION_DAYS = Number(process.env.ERROR_LOG_RETENTION_DAYS) || 30;

// Guard rails so a pathological stack/message can't bloat a row.
const MAX_MESSAGE = 8_000;
const MAX_STACK = 16_000;

type CapturedError = { message?: string; stack?: string; code?: string };

declare module 'fastify' {
  interface FastifyRequest {
    errCapture?: CapturedError;
  }
}

// Collapse the volatile parts of a message (video ids, numbers, urls, hex, uuids)
// so the same class of failure fingerprints to one group regardless of which
// request triggered it — the way Sentry groups "issues".
function normalizeMessage(msg: string): string {
  return msg
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '<uuid>')
    .replace(/\b[A-Za-z0-9_-]{11}\b/g, '<id>') // YouTube video ids
    .replace(/0x[0-9a-fA-F]+/g, '<hex>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function fingerprint(method: string, route: string, code: string, message: string): string {
  return crypto
    .createHash('sha256')
    .update(`${method}|${route}|${code}|${normalizeMessage(message)}`)
    .digest('hex');
}

// Shallow copy of the request query, minus anything that looks secret, capped in
// size. Gives the triage view useful context for free (e.g. the youtube `url`
// and `quality` that failed) without threading context through every route.
function safeContext(request: FastifyRequest): Record<string, unknown> | null {
  const q = request.query as Record<string, unknown> | undefined;
  if (!q || typeof q !== 'object') return null;
  const SECRET = /token|secret|password|pass|key|auth|sig/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) {
    if (SECRET.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 300);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

async function errorLogger(fastify: FastifyInstance) {
  let flushInterval: ReturnType<typeof setInterval> | null = null;
  let retentionInterval: ReturnType<typeof setInterval> | null = null;

  const enqueue = (request: FastifyRequest, reply: FastifyReply, captured: CapturedError) => {
    const method = request.method;
    const route = request.routeOptions?.url || request.url.split('?')[0];
    const status = reply.statusCode;
    const code = captured.code || '';
    const message = (captured.message || `HTTP ${status}`).slice(0, MAX_MESSAGE);
    const stack = captured.stack ? captured.stack.slice(0, MAX_STACK) : null;
    const bytes = Buffer.byteLength(message) + (stack ? Buffer.byteLength(stack) : 0);
    const payload = JSON.stringify({
      ts: Date.now(),
      fp: fingerprint(method, route, code, message),
      method,
      route,
      status,
      code: code || null,
      message,
      stack,
      request_id: request.id,
      ip: getClientIp(request),
      email: request.session?.user?.email ?? null,
      bytes,
      context: safeContext(request),
    });
    // Fire-and-forget: never block response finalization on the error sink.
    fastify.valkey
      .pipeline()
      .lpush(BUFFER_KEY, payload)
      .ltrim(BUFFER_KEY, 0, BUFFER_CAP)
      .exec()
      .catch(() => {});
  };

  // Thrown errors — capture the real message + stack + code. Observational only;
  // Fastify still formats and sends its normal error response.
  fastify.addHook('onError', async (request, _reply, error) => {
    request.errCapture = {
      message: error?.message,
      stack: error?.stack,
      code: (error as { code?: string })?.code,
    };
  });

  // Manually-returned failures never throw, so read their JSON body here. Prefer
  // a message already captured from a thrown error (it carries the stack) and
  // only fill in the app `code` from the body. Must return the payload unchanged.
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (
      reply.statusCode >= CAPTURE_MIN_STATUS &&
      typeof payload === 'string' &&
      payload.length > 0 &&
      payload[0] === '{'
    ) {
      try {
        const body = JSON.parse(payload) as { error?: unknown; message?: unknown; code?: unknown };
        const bodyMsg =
          typeof body.error === 'string'
            ? body.error
            : typeof body.message === 'string'
              ? body.message
              : undefined;
        const prev = request.errCapture ?? {};
        request.errCapture = {
          message: prev.message ?? bodyMsg,
          stack: prev.stack,
          code: prev.code ?? (typeof body.code === 'string' ? body.code : undefined),
        };
      } catch {
        // not JSON we can parse — keep whatever onError captured
      }
    }
    return payload;
  });

  // Single sink: after the response is finalized, persist any 5xx. Runs for every
  // request but short-circuits immediately on success responses.
  fastify.addHook('onResponse', async (request, reply) => {
    if (reply.statusCode < CAPTURE_MIN_STATUS) return;
    enqueue(request, reply, request.errCapture ?? {});
  });

  fastify.addHook('onReady', async () => {
    let tableExists = false;
    const ensureTable = async (): Promise<boolean> => {
      if (tableExists) return true;
      const res = await fastify.pg.query<{ tbl: string | null }>(
        `SELECT to_regclass('public.error_events') AS tbl`,
      );
      if (res.rows[0]?.tbl) tableExists = true;
      return tableExists;
    };

    // Drain the Valkey buffer into Postgres. Same rename-to-flushing dance as
    // bot-detector so events enqueued mid-flush aren't lost.
    const flush = async () => {
      try {
        if (!(await ensureTable())) return;

        // Recover events left in the flushing key by a previous failed flush
        // (RENAME below would otherwise overwrite and lose them).
        const leftover = await fastify.valkey.llen(FLUSHING_KEY);
        if (leftover > 0) {
          const items = await fastify.valkey.lrange(FLUSHING_KEY, 0, -1);
          if (items.length > 0) await fastify.valkey.rpush(BUFFER_KEY, ...items);
          await fastify.valkey.del(FLUSHING_KEY);
        }

        await fastify.valkey.rename(BUFFER_KEY, FLUSHING_KEY);
        const batch = await fastify.valkey.lrange(FLUSHING_KEY, 0, FLUSH_BATCH - 1);
        if (batch.length === 0) {
          await fastify.valkey.del(FLUSHING_KEY);
          return;
        }

        const parsed = batch
          .map((raw) => {
            try {
              return JSON.parse(raw) as Record<string, unknown>;
            } catch {
              return null;
            }
          })
          .filter(Boolean) as Record<string, unknown>[];

        if (parsed.length > 0) {
          const values: unknown[] = [];
          const rows: string[] = [];
          let i = 1;
          for (const e of parsed) {
            rows.push(
              `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9}, $${i + 10}, $${i + 11}, to_timestamp($${i + 12}::bigint / 1000))`,
            );
            values.push(
              e.fp,
              e.method,
              e.route,
              e.status,
              e.code ?? null,
              e.message,
              e.stack ?? null,
              e.request_id ?? null,
              e.ip ?? null,
              e.email ?? null,
              e.bytes ?? 0,
              e.context ? JSON.stringify(e.context) : null,
              (e.ts as number) ?? Date.now(),
            );
            i += 13;
          }
          await fastify.pg.query(
            `INSERT INTO error_events
               (fingerprint, method, route, status_code, code, message, stack, request_id, ip, user_email, bytes, context, created_at)
             VALUES ${rows.join(', ')}`,
            values,
          );
        }
        await fastify.valkey.del(FLUSHING_KEY);
      } catch {
        // RENAME fails when the buffer is empty (no key), or PG is down — skip.
      }
    };

    // Garbage-collect old events, then drop group rows with no surviving events.
    const sweep = async () => {
      try {
        if (!(await ensureTable())) return;
        await fastify.pg.query(
          `DELETE FROM error_events WHERE created_at < NOW() - ($1 || ' days')::interval`,
          [String(RETENTION_DAYS)],
        );
        await fastify.pg.query(
          `DELETE FROM error_groups g
             WHERE NOT EXISTS (SELECT 1 FROM error_events e WHERE e.fingerprint = g.fingerprint)`,
        );
      } catch {
        // table missing or PG down — skip this cycle
      }
    };

    flushInterval = setInterval(flush, FLUSH_INTERVAL_MS);
    retentionInterval = setInterval(sweep, RETENTION_SWEEP_MS);
    void sweep();
  });

  fastify.addHook('onClose', async () => {
    if (flushInterval) clearInterval(flushInterval);
    if (retentionInterval) clearInterval(retentionInterval);
  });
}

export const errorLoggerPlugin = fp(errorLogger, {
  name: 'error-logger',
  dependencies: ['valkey', 'postgres'],
});
