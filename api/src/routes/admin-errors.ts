import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { meetsMinTier } from '../plugins/auth-guard.js';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';

// Admin "Technical" tab backend: query, triage and garbage-collect the errors
// captured by plugins/error-logger.ts. Errors can contain stack traces, IPs and
// emails, so every endpoint is gated at the admin tier (mirrors security.ts).

const PAGE_SIZE = 50;

// Whitelist of sortable columns → their SELECT aliases (prevents ORDER BY
// injection). "count" = biggest offender, "total_bytes" = largest payload.
const SORTS = { count: 'count', bytes: 'total_bytes', last_seen: 'last_seen' } as const;
type SortKey = keyof typeof SORTS;

const STATUSES = new Set(['open', 'resolved', 'ignored']);
const FINGERPRINT_RE = /^[a-f0-9]{64}$/;

// Group aggregate shared by the list and detail queries — one row per fingerprint.
const GROUP_SELECT = `
  SELECT e.fingerprint,
         COUNT(*)::int                                      AS count,
         SUM(e.bytes)::bigint                               AS total_bytes,
         MAX(e.created_at)                                  AS last_seen,
         MIN(e.created_at)                                  AS first_seen,
         MAX(e.status_code)                                 AS status_code,
         (ARRAY_AGG(e.route   ORDER BY e.created_at DESC))[1] AS route,
         (ARRAY_AGG(e.code    ORDER BY e.created_at DESC))[1] AS code,
         (ARRAY_AGG(e.message ORDER BY e.created_at DESC))[1] AS sample_message,
         COALESCE(g.status, 'open')                         AS status,
         g.note                                             AS note
  FROM error_events e
  LEFT JOIN error_groups g ON g.fingerprint = e.fingerprint`;

type GroupRow = {
  fingerprint: string;
  count: number;
  total_bytes: string;
  last_seen: string;
  first_seen: string;
  status_code: number;
  route: string;
  code: string | null;
  sample_message: string;
  status: string;
  note: string | null;
};

function mapGroup(r: GroupRow) {
  return {
    fingerprint: r.fingerprint,
    count: Number(r.count),
    totalBytes: Number(r.total_bytes),
    lastSeen: r.last_seen,
    firstSeen: r.first_seen,
    statusCode: r.status_code,
    route: r.route,
    code: r.code,
    sampleMessage: r.sample_message,
    status: r.status,
    note: r.note,
  };
}

type SampleRow = {
  id: string;
  method: string;
  route: string;
  status_code: number;
  code: string | null;
  message: string;
  stack: string | null;
  request_id: string | null;
  ip: string | null;
  user_email: string | null;
  bytes: string;
  context: Record<string, unknown> | null;
  created_at: string;
};

function mapSample(r: SampleRow) {
  return {
    id: String(r.id),
    method: r.method,
    route: r.route,
    statusCode: r.status_code,
    code: r.code,
    message: r.message,
    stack: r.stack,
    requestId: r.request_id,
    ip: r.ip,
    userEmail: r.user_email,
    bytes: Number(r.bytes),
    context: r.context,
    createdAt: r.created_at,
  };
}

export async function adminErrorRoutes(fastify: FastifyInstance): Promise<void> {
  // Admin-tier gate, identical to security.ts / audit.ts. Returns the user, or
  // null after sending 403.
  function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'admin')) {
      reply.status(403).send({ error: 'Admin only' });
      return null;
    }
    return user;
  }

  // GET /api/admin/errors — ranked, grouped, filtered, paginated.
  fastify.get<{
    Querystring: {
      page?: string;
      sort?: string;
      status?: string;
      route?: string;
      code?: string;
      q?: string;
    };
  }>('/api/admin/errors', async (request, reply) => {
    const user = requireAdmin(request, reply);
    if (!user) return;

    const q = request.query;
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const sort: SortKey = q.sort && q.sort in SORTS ? (q.sort as SortKey) : 'count';
    const statusFilter = q.status && q.status !== 'all' ? q.status : null;
    const routeFilter = (q.route ?? '').trim();
    const codeFilter = (q.code ?? '').trim();
    const search = (q.q ?? '').trim();

    const where: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (routeFilter) {
      where.push(`e.route = $${p++}`);
      params.push(routeFilter);
    }
    if (codeFilter) {
      where.push(`e.code = $${p++}`);
      params.push(codeFilter);
    }
    if (search) {
      where.push(`e.message ILIKE $${p++}`);
      params.push(`%${search}%`);
    }
    if (statusFilter && STATUSES.has(statusFilter)) {
      where.push(`COALESCE(g.status, 'open') = $${p++}`);
      params.push(statusFilter);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await fastify.pg.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM (
         SELECT e.fingerprint
         FROM error_events e
         LEFT JOIN error_groups g ON g.fingerprint = e.fingerprint
         ${whereSql}
         GROUP BY e.fingerprint
       ) sub`,
      params,
    );
    const total = parseInt(countRes.rows[0]?.n ?? '0', 10);

    const listRes = await fastify.pg.query<GroupRow>(
      `${GROUP_SELECT}
       ${whereSql}
       GROUP BY e.fingerprint, g.status, g.note
       ORDER BY ${SORTS[sort]} DESC, last_seen DESC
       LIMIT $${p++} OFFSET $${p++}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );

    return reply.send({
      groups: listRes.rows.map(mapGroup),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  });

  // GET /api/admin/errors/summary — small header/dashboard stats. Registered
  // before the :fingerprint route; Fastify's router prefers the static path.
  fastify.get('/api/admin/errors/summary', async (request, reply) => {
    const user = requireAdmin(request, reply);
    if (!user) return;

    const res = await fastify.pg.query<{
      total_events: string;
      events_24h: string;
      open_groups: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM error_events)::text AS total_events,
         (SELECT COUNT(*) FROM error_events WHERE created_at > NOW() - INTERVAL '24 hours')::text AS events_24h,
         (SELECT COUNT(DISTINCT e.fingerprint)
            FROM error_events e
            LEFT JOIN error_groups g ON g.fingerprint = e.fingerprint
            WHERE COALESCE(g.status, 'open') = 'open')::text AS open_groups`,
    );
    const row = res.rows[0];
    return reply.send({
      totalEvents: Number(row?.total_events ?? 0),
      events24h: Number(row?.events_24h ?? 0),
      openGroups: Number(row?.open_groups ?? 0),
      retentionDays: Number(process.env.ERROR_LOG_RETENTION_DAYS) || 30,
    });
  });

  // GET /api/admin/errors/:fingerprint — group aggregate + recent raw samples.
  fastify.get<{ Params: { fingerprint: string } }>(
    '/api/admin/errors/:fingerprint',
    async (request, reply) => {
      const user = requireAdmin(request, reply);
      if (!user) return;
      const fpId = request.params.fingerprint;
      if (!FINGERPRINT_RE.test(fpId)) {
        return reply.status(400).send({ error: 'Invalid fingerprint.' });
      }

      const groupRes = await fastify.pg.query<GroupRow>(
        `${GROUP_SELECT}
         WHERE e.fingerprint = $1
         GROUP BY e.fingerprint, g.status, g.note`,
        [fpId],
      );
      if (groupRes.rows.length === 0) {
        return reply.status(404).send({ error: 'No such error group.' });
      }

      const samplesRes = await fastify.pg.query<SampleRow>(
        `SELECT id, method, route, status_code, code, message, stack,
                request_id, ip, user_email, bytes, context, created_at
         FROM error_events
         WHERE fingerprint = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [fpId],
      );

      return reply.send({
        group: mapGroup(groupRes.rows[0]),
        samples: samplesRes.rows.map(mapSample),
      });
    },
  );

  // POST /api/admin/errors/:fingerprint/status — resolve / ignore / reopen.
  fastify.post<{
    Params: { fingerprint: string };
    Body: { status?: string; note?: string };
  }>('/api/admin/errors/:fingerprint/status', async (request, reply) => {
    const user = requireAdmin(request, reply);
    if (!user) return;
    const fpId = request.params.fingerprint;
    if (!FINGERPRINT_RE.test(fpId)) {
      return reply.status(400).send({ error: 'Invalid fingerprint.' });
    }
    const status = (request.body?.status ?? '').trim();
    if (!STATUSES.has(status)) {
      return reply.status(400).send({ error: 'status must be open, resolved, or ignored.' });
    }
    const note =
      typeof request.body?.note === 'string' ? request.body.note.slice(0, 2000) : null;

    const exists = await fastify.pg.query(
      `SELECT 1 FROM error_events WHERE fingerprint = $1 LIMIT 1`,
      [fpId],
    );
    if (exists.rows.length === 0) {
      return reply.status(404).send({ error: 'No such error group.' });
    }

    await fastify.pg.query(
      `INSERT INTO error_groups (fingerprint, status, note, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (fingerprint) DO UPDATE
         SET status = EXCLUDED.status,
             note = EXCLUDED.note,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
      [fpId, status, note, user.email],
    );

    writeAuditLog(fastify, {
      userEmail: user.email,
      userName: user.name,
      action: 'update',
      resourceType: 'error-log',
      resourceId: fpId.slice(0, 12),
      summary: `Marked error group ${fpId.slice(0, 8)} as ${status}`,
      ip: getClientIp(request),
    }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

    return reply.send({ fingerprint: fpId, status, note });
  });

  // DELETE /api/admin/errors/:fingerprint — garbage-collect one group.
  fastify.delete<{ Params: { fingerprint: string } }>(
    '/api/admin/errors/:fingerprint',
    async (request, reply) => {
      const user = requireAdmin(request, reply);
      if (!user) return;
      const fpId = request.params.fingerprint;
      if (!FINGERPRINT_RE.test(fpId)) {
        return reply.status(400).send({ error: 'Invalid fingerprint.' });
      }

      const del = await fastify.pg.query(`DELETE FROM error_events WHERE fingerprint = $1`, [fpId]);
      await fastify.pg.query(`DELETE FROM error_groups WHERE fingerprint = $1`, [fpId]);

      writeAuditLog(fastify, {
        userEmail: user.email,
        userName: user.name,
        action: 'delete',
        resourceType: 'error-log',
        resourceId: fpId.slice(0, 12),
        summary: `Deleted error group ${fpId.slice(0, 8)} (${del.rowCount ?? 0} events)`,
        ip: getClientIp(request),
      }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

      return reply.send({ fingerprint: fpId, deletedEvents: del.rowCount ?? 0 });
    },
  );

  // POST /api/admin/errors/purge — bulk garbage collection. Body is one of:
  //   { all: true }                 — wipe everything
  //   { status: 'resolved' }        — clear a triaged bucket (resolved/ignored)
  //   { olderThanDays: 7 }          — clear anything older than N days
  fastify.post<{
    Body: { olderThanDays?: number; status?: string; all?: boolean };
  }>('/api/admin/errors/purge', async (request, reply) => {
    const user = requireAdmin(request, reply);
    if (!user) return;
    const body = request.body ?? {};

    let deleted = 0;
    let summary = '';

    if (body.all === true) {
      const del = await fastify.pg.query(`DELETE FROM error_events`);
      await fastify.pg.query(`DELETE FROM error_groups`);
      deleted = del.rowCount ?? 0;
      summary = `Purged ALL error events (${deleted})`;
    } else if (typeof body.status === 'string' && STATUSES.has(body.status)) {
      // Events inherit their group's status via the join; untouched errors have
      // no group row (implicit 'open'), so this targets resolved/ignored buckets.
      const del = await fastify.pg.query(
        `DELETE FROM error_events e
           USING error_groups g
          WHERE e.fingerprint = g.fingerprint AND g.status = $1`,
        [body.status],
      );
      await fastify.pg.query(`DELETE FROM error_groups WHERE status = $1`, [body.status]);
      deleted = del.rowCount ?? 0;
      summary = `Purged error events with status ${body.status} (${deleted})`;
    } else if (typeof body.olderThanDays === 'number' && body.olderThanDays >= 0) {
      const days = Math.floor(body.olderThanDays);
      const del = await fastify.pg.query(
        `DELETE FROM error_events WHERE created_at < NOW() - ($1 || ' days')::interval`,
        [String(days)],
      );
      await fastify.pg.query(
        `DELETE FROM error_groups g
           WHERE NOT EXISTS (SELECT 1 FROM error_events e WHERE e.fingerprint = g.fingerprint)`,
      );
      deleted = del.rowCount ?? 0;
      summary = `Purged error events older than ${days} days (${deleted})`;
    } else {
      return reply
        .status(400)
        .send({ error: 'Provide one of: all=true, status, or olderThanDays.' });
    }

    writeAuditLog(fastify, {
      userEmail: user.email,
      userName: user.name,
      action: 'delete',
      resourceType: 'error-log',
      summary,
      ip: getClientIp(request),
    }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

    return reply.send({ deletedEvents: deleted });
  });
}
