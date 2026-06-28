import type { FastifyInstance } from 'fastify';
import { meetsMinTier } from '../plugins/auth-guard.js';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';

// IP and CIDR validation
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-f:]+$/i;
const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[1-2]\d|3[0-2])$/;

function isValidIpOrCidr(value: string): boolean {
  return IPV4_RE.test(value) || IPV6_RE.test(value) || CIDR_RE.test(value);
}

// Honeypot paths — always return 404, bot-detector handles buffering + ban
const HONEYPOT_PATHS = [
  '/wp-login.php', '/.env', '/admin.php', '/xmlrpc.php', '/setup.php',
];

let securityEventsTableExists: boolean | null = null;
let ordersTableExists: boolean | null = null;

async function securityRoutesImpl(fastify: FastifyInstance) {
  // === Honeypot handlers ===
  for (const p of HONEYPOT_PATHS) {
    fastify.get(p, async (request, reply) => {
      fastify.log.info({ ip: getClientIp(request), path: p }, 'honeypot hit');
      return reply.status(404).send({ error: 'Not found' });
    });
    fastify.post(p, async (request, reply) => {
      fastify.log.info({ ip: getClientIp(request), path: p }, 'honeypot hit');
      return reply.status(404).send({ error: 'Not found' });
    });
  }

  // Wildcard honeypots
  for (const prefix of ['/phpMyAdmin', '/wp-admin']) {
    fastify.get(`${prefix}/*`, async (request, reply) => {
      fastify.log.info({ ip: getClientIp(request), path: request.url }, 'honeypot hit');
      return reply.status(404).send({ error: 'Not found' });
    });
  }

  // === Dashboard API ===

  fastify.get('/api/security/dashboard', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'admin')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const cacheKey = 'cache:security:dashboard';
    const cached = await fastify.valkey.get(cacheKey);
    if (cached) return reply.send(JSON.parse(cached));

    // Fix #9: use authGuard.getBannedList() — all file I/O owned by auth-guard plugin
    const bannedList = fastify.authGuard.getBannedList();

    let recentEvents: unknown[] = [];
    let topThreatActors: unknown[] = [];
    let rateLimitByEndpoint: unknown[] = [];
    let blockedBreakdown: { byReason: unknown[]; byCountry: unknown[]; byUaClass: unknown[] } = {
      byReason: [], byCountry: [], byUaClass: [],
    };
    let authStats: { recentBans: unknown[]; failedLoginsCount: number } = {
      recentBans: [], failedLoginsCount: 0,
    };
    let eventTimeline: unknown[] = [];
    let degraded = false;
    let infraStats: { valkeyMemoryMb: number; pgActiveConnections: number } = {
      valkeyMemoryMb: 0,
      pgActiveConnections: 0,
    };
    let checkoutStats: { attemptsLast24h: number; successLast24h: number } = {
      attemptsLast24h: 0,
      successLast24h: 0,
    };

    let hasSecurityEvents = securityEventsTableExists === true;
    let hasOrders = ordersTableExists === true;
    if (!hasSecurityEvents || !hasOrders) {
      const tableCheck = await fastify.pg.query(
        `SELECT to_regclass('public.security_events') AS se_tbl, to_regclass('public.orders') AS orders_tbl`,
      );
      hasSecurityEvents = !!tableCheck.rows[0].se_tbl;
      hasOrders = !!tableCheck.rows[0].orders_tbl;
      if (hasSecurityEvents) securityEventsTableExists = true;
      if (hasOrders) ordersTableExists = true;
    }

    if (!hasSecurityEvents) degraded = true;

    const parallelPromises: Promise<unknown>[] = [
      // Valkey stats
      fastify.valkey.get('sec:attacks:active'),
      fastify.valkey.get('sec:attack:start'),
      fastify.valkey.get('sec:counter:429'),
      fastify.valkey.get('sec:counter:req'),
      fastify.valkey.scard('sec:seen_ips'),
      // Panel 7: Recent bans from audit_logs
      fastify.pg.query(
        `SELECT user_email, action, ip_address, summary, created_at
         FROM audit_logs
         WHERE action IN ('ban', 'unblock')
         ORDER BY created_at DESC
         LIMIT 20`,
      ).catch(() => ({ rows: [] })),
      // Panel 9: Infrastructure health
      fastify.valkey.info('memory').catch(() => ''),
      fastify.pg.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE state = 'active'`).catch(() => ({ rows: [{ count: 0 }] })),
    ];

    if (hasSecurityEvents) {
      parallelPromises.push(
        // [8] Panel 6: Bot detection feed
        fastify.pg.query(
          `SELECT id, created_at, ip, country, event_type, endpoint, user_agent, bot_score, action, metadata
           FROM security_events
           WHERE created_at > NOW() - INTERVAL '24 hours'
             AND bot_score >= 0.5
           ORDER BY created_at DESC
           LIMIT 100`,
        ),
        // [9] Panel 3: Top threat actors (last 5 min)
        fastify.pg.query(
          `SELECT ip, country,
                  COUNT(*) AS total_req,
                  SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) AS blocked_req,
                  AVG(bot_score) AS avg_bot_score,
                  MIN(created_at) AS first_seen,
                  MAX(created_at) AS last_seen
           FROM security_events
           WHERE created_at > NOW() - INTERVAL '5 minutes'
           GROUP BY ip, country
           ORDER BY total_req DESC
           LIMIT 20`,
        ),
        // [10] Panel 5: Rate limit hits by endpoint (24h)
        fastify.pg.query(
          `SELECT endpoint,
                  COUNT(*) AS hits
           FROM security_events
           WHERE event_type = 'rate_limit'
             AND created_at > NOW() - INTERVAL '24 hours'
           GROUP BY endpoint
           ORDER BY hits DESC`,
        ),
        // [11] Panel 4: Blocked traffic breakdown by reason
        fastify.pg.query(
          `SELECT event_type, COUNT(*) AS count
           FROM security_events
           WHERE action = 'blocked'
             AND created_at > NOW() - INTERVAL '24 hours'
           GROUP BY event_type
           ORDER BY count DESC`,
        ),
        // [12] Panel 4: Blocked traffic by country
        fastify.pg.query(
          `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS count
           FROM security_events
           WHERE action = 'blocked'
             AND created_at > NOW() - INTERVAL '24 hours'
           GROUP BY country
           ORDER BY count DESC
           LIMIT 15`,
        ),
        // [13] Panel 4: Blocked traffic by UA class
        fastify.pg.query(
          `SELECT metadata->>'ua_class' AS ua_class, COUNT(*) AS count
           FROM security_events
           WHERE action = 'blocked'
             AND created_at > NOW() - INTERVAL '24 hours'
           GROUP BY ua_class
           ORDER BY count DESC`,
        ),
        // [14] Panel 7: Auth fail count last hour
        fastify.pg.query(
          `SELECT COUNT(*) AS count
           FROM security_events
           WHERE event_type = 'auth_fail'
             AND created_at > NOW() - INTERVAL '1 hour'`,
        ),
        // [15] Panel 2: Event timeline (hourly, last 24h)
        fastify.pg.query(
          `SELECT date_trunc('hour', created_at) AS bucket,
                  COUNT(*) AS total,
                  SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) AS blocked,
                  SUM(CASE WHEN action = 'flagged' THEN 1 ELSE 0 END) AS flagged
           FROM security_events
           WHERE created_at > NOW() - INTERVAL '24 hours'
           GROUP BY bucket
           ORDER BY bucket`,
        ),
      );
    }

    if (hasOrders) {
      // Panel 8: Checkout/business impact
      parallelPromises.push(
        fastify.pg.query(
          `SELECT
             COUNT(*) AS attempts,
             SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS success
           FROM orders
           WHERE created_at > NOW() - INTERVAL '24 hours'`,
        ),
      );
    }

    const results = await Promise.all(parallelPromises);

    const attackStatusRaw = results[0] as string | null;
    const attackStartRaw = results[1] as string | null;
    const counter429Raw = results[2] as string | null;
    const totalReqRaw = results[3] as string | null;
    const uniqueIpsRaw = results[4] as number;
    const bansRes = results[5] as { rows: unknown[] };
    const valkeyInfo = results[6] as string;
    const pgConns = results[7] as { rows: { count: number }[] };

    const attackStatus = (attackStatusRaw as 'NORMAL' | 'ELEVATED' | 'ATTACK') ?? 'NORMAL';
    const attackStartTs = attackStartRaw ? parseInt(attackStartRaw, 10) : null;
    const attackDurationMinutes = attackStartTs
      ? Math.floor((Date.now() / 1000 - attackStartTs) / 60)
      : null;
    const counter429 = parseInt(counter429Raw ?? '0', 10);
    const totalReq = parseInt(totalReqRaw ?? '0', 10);
    const uniqueIps = uniqueIpsRaw ?? 0;

    authStats.recentBans = bansRes.rows;

    const memMatch = valkeyInfo.match(/used_memory:(\d+)/);
    if (memMatch) {
      infraStats.valkeyMemoryMb = Math.round(parseInt(memMatch[1], 10) / 1024 / 1024 * 10) / 10;
    }
    infraStats.pgActiveConnections = pgConns.rows[0]?.count ?? 0;

    if (hasSecurityEvents) {
      const eventsRes = results[8] as { rows: unknown[] };
      const actorsRes = results[9] as { rows: unknown[] };
      const rlRes = results[10] as { rows: unknown[] };
      const byReasonRes = results[11] as { rows: unknown[] };
      const byCountryRes = results[12] as { rows: unknown[] };
      const byUaClassRes = results[13] as { rows: Record<string, unknown>[] };
      const authCountRes = results[14] as { rows: Record<string, unknown>[] };
      const timelineRes = results[15] as { rows: unknown[] };

      recentEvents = eventsRes.rows;
      topThreatActors = actorsRes.rows;
      rateLimitByEndpoint = rlRes.rows;
      blockedBreakdown = {
        byReason: byReasonRes.rows,
        byCountry: byCountryRes.rows,
        byUaClass: byUaClassRes.rows.filter((r) => r.ua_class != null),
      };
      authStats.failedLoginsCount = parseInt((authCountRes.rows[0]?.count as string) || '0', 10);
      eventTimeline = timelineRes.rows;
    }

    if (hasOrders) {
      const checkoutIdx = hasSecurityEvents ? 16 : 8;
      const checkoutRes = results[checkoutIdx] as { rows: Record<string, unknown>[] };
      checkoutStats.attemptsLast24h = parseInt((checkoutRes.rows[0]?.attempts as string) || '0', 10);
      checkoutStats.successLast24h = parseInt((checkoutRes.rows[0]?.success as string) || '0', 10);
    }

    const result = {
      degraded,
      attackStatus,
      attackDurationMinutes,
      stats: {
        counter429,
        totalReq,
        uniqueIps,
        rate429Pct: totalReq > 0 ? +(counter429 / totalReq * 100).toFixed(1) : 0,
      },
      bannedIps: bannedList,
      recentEvents,
      topThreatActors,
      rateLimitByEndpoint,
      blockedBreakdown,
      authStats,
      eventTimeline,
      infraStats,
      checkoutStats,
    };
    await fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', 30);
    return reply.send(result);
  });

  // === Report API ===

  fastify.get<{ Querystring: { start?: string; end?: string } }>(
    '/api/security/report',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'admin')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { start, end } = request.query;
      const startDate = start ? new Date(start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = end ? new Date(end) : new Date();

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return reply.status(400).send({ error: 'Invalid date format' });
      }

      // Cap at 90 days
      const maxMs = 90 * 24 * 60 * 60 * 1000;
      if (endDate.getTime() - startDate.getTime() > maxMs) {
        return reply.status(400).send({ error: 'Maximum report range is 90 days' });
      }

      try {
        if (securityEventsTableExists !== true) {
          const tableCheck = await fastify.pg.query(
            `SELECT to_regclass('public.security_events') AS tbl`,
          );
          if (!tableCheck.rows[0].tbl) {
            return reply.send({ degraded: true, message: 'security_events table not yet created — run migrations' });
          }
          securityEventsTableExists = true;
        }

        const [summaryRes, timelineRes, actorsRes, eventsByTypeRes, rateLimitRes, botBreakdownRes] =
          await Promise.all([
            // Section 1: Executive Summary
            fastify.pg.query(
              `SELECT
                 COUNT(*) AS total_events,
                 SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) AS blocked,
                 SUM(CASE WHEN action = 'flagged' THEN 1 ELSE 0 END) AS flagged,
                 COUNT(DISTINCT ip) AS unique_ips
               FROM security_events
               WHERE created_at BETWEEN $1 AND $2`,
              [startDate, endDate],
            ),
            // Section 2: Attack Timeline (hourly buckets)
            fastify.pg.query(
              `SELECT
                 date_trunc('hour', created_at) AS bucket,
                 COUNT(*) AS total,
                 SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) AS blocked,
                 COUNT(DISTINCT ip) AS unique_ips
               FROM security_events
               WHERE created_at BETWEEN $1 AND $2
               GROUP BY bucket
               ORDER BY bucket`,
              [startDate, endDate],
            ),
            // Section 3: Top Threat Actors (top 50)
            fastify.pg.query(
              `SELECT ip, country,
                      COUNT(*) AS total_req,
                      SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) AS blocked_req,
                      MIN(created_at) AS first_seen,
                      MAX(created_at) AS last_seen,
                      MAX(action) AS status
               FROM security_events
               WHERE created_at BETWEEN $1 AND $2
               GROUP BY ip, country
               ORDER BY total_req DESC
               LIMIT 50`,
              [startDate, endDate],
            ),
            // Section 4 (part): Event breakdown by type
            fastify.pg.query(
              `SELECT event_type, COUNT(*) AS count
               FROM security_events
               WHERE created_at BETWEEN $1 AND $2
               GROUP BY event_type
               ORDER BY count DESC`,
              [startDate, endDate],
            ),
            // Section 4: Rate Limit & Auth Events
            fastify.pg.query(
              `SELECT event_type, endpoint, COUNT(*) AS count,
                      COUNT(DISTINCT ip) AS unique_ips,
                      MAX(created_at) AS last_seen
               FROM security_events
               WHERE event_type IN ('rate_limit', 'auth_fail')
                 AND created_at BETWEEN $1 AND $2
               GROUP BY event_type, endpoint
               ORDER BY count DESC`,
              [startDate, endDate],
            ),
            // Section 5: Bot Traffic Breakdown (good / suspicious / malicious)
            fastify.pg.query(
              `SELECT
                 metadata->>'ua_class' AS ua_class,
                 action,
                 COUNT(*) AS count
               FROM security_events
               WHERE created_at BETWEEN $1 AND $2
               GROUP BY ua_class, action
               ORDER BY count DESC`,
              [startDate, endDate],
            ),
          ]);

        // Section 6: Infrastructure Alerts (P99 from metrics, simplified)
        let infraAlerts: { valkeyMemoryMb: number; pgActiveConnections: number } = {
          valkeyMemoryMb: 0,
          pgActiveConnections: 0,
        };
        try {
          const [valkeyInfo, pgConns] = await Promise.all([
            fastify.valkey.info('memory'),
            fastify.pg.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE state = 'active'`),
          ]);
          const memMatch = valkeyInfo.match(/used_memory:(\d+)/);
          if (memMatch) {
            infraAlerts.valkeyMemoryMb = Math.round(parseInt(memMatch[1], 10) / 1024 / 1024 * 10) / 10;
          }
          infraAlerts.pgActiveConnections = pgConns.rows[0]?.count ?? 0;
        } catch {
          // Silently skip
        }

        const summary = summaryRes.rows[0] || {};
        const totalBlocked = parseInt(summary.blocked || '0', 10);
        const totalFlagged = parseInt(summary.flagged || '0', 10);

        // Section 7: Auto-generated Actionable Tasks
        const actionableTasks: { severity: string; task: string; evidence: string; action: string }[] = [];
        const topActor = actorsRes.rows[0];
        if (topActor && parseInt(topActor.total_req, 10) > 100) {
          actionableTasks.push({
            severity: 'HIGH',
            task: `Review top threat actor ${topActor.ip}`,
            evidence: `${topActor.total_req} requests in period, ${topActor.blocked_req} blocked`,
            action: `Block ${topActor.ip} via POST /api/security/block`,
          });
        }
        if (rateLimitRes.rows.some((r) => parseInt(r.count, 10) > 50)) {
          const hotEndpoint = rateLimitRes.rows[0];
          actionableTasks.push({
            severity: 'MEDIUM',
            task: `Tighten rate limit on ${hotEndpoint?.endpoint || 'high-traffic endpoint'}`,
            evidence: `${hotEndpoint?.count} rate-limit hits in period`,
            action: 'Lower RL_MAX constant or add IP-subnet-level limiting',
          });
        }
        if (totalBlocked > 1000) {
          actionableTasks.push({
            severity: 'MEDIUM',
            task: 'Review high block volume — consider Caddy rate limiting',
            evidence: `${totalBlocked} blocked events in period`,
            action: 'Add caddy-ratelimit module to absorb pre-app-layer load',
          });
        }
        if (infraAlerts.pgActiveConnections > 80) {
          actionableTasks.push({
            severity: 'HIGH',
            task: 'PostgreSQL connection count near limit',
            evidence: `${infraAlerts.pgActiveConnections} active connections`,
            action: 'Increase max_connections or add PgBouncer connection pooler',
          });
        }

        return reply.send({
          period: { start: startDate.toISOString(), end: endDate.toISOString() },
          generatedAt: new Date().toISOString(),
          preparedFor: user.email,
          gdprNote: 'IP addresses in this report are retained for 90 days for security purposes per GDPR Art. 6(1)(f).',
          summary: {
            totalEvents: parseInt(summary.total_events || '0', 10),
            blocked: totalBlocked,
            flagged: totalFlagged,
            uniqueIps: parseInt(summary.unique_ips || '0', 10),
          },
          attackTimeline: timelineRes.rows.map((r) => ({
            bucket: r.bucket,
            total: parseInt(r.total, 10),
            blocked: parseInt(r.blocked, 10),
            uniqueIps: parseInt(r.unique_ips, 10),
          })),
          topThreatActors: actorsRes.rows.map((r) => ({
            ip: r.ip,
            country: r.country,
            totalReq: parseInt(r.total_req, 10),
            blockedReq: parseInt(r.blocked_req, 10),
            firstSeen: r.first_seen,
            lastSeen: r.last_seen,
            status: r.status,
          })),
          rateLimitAndAuthEvents: rateLimitRes.rows.map((r) => ({
            eventType: r.event_type,
            endpoint: r.endpoint,
            count: parseInt(r.count, 10),
            uniqueIps: parseInt(r.unique_ips, 10),
            lastSeen: r.last_seen,
          })),
          botTrafficBreakdown: botBreakdownRes.rows.map((r) => ({
            uaClass: r.ua_class,
            action: r.action,
            count: parseInt(r.count, 10),
          })),
          eventsByType: eventsByTypeRes.rows.map((r) => ({
            eventType: r.event_type,
            count: parseInt(r.count, 10),
          })),
          infraAlerts,
          actionableTasks,
        });
      } catch (err) {
        fastify.log.error({ err }, 'Security report query failed');
        return reply.status(500).send({ error: 'Report generation failed' });
      }
    },
  );

  // === Block IP / CIDR ===

  fastify.post<{ Body: { ip: string; reason?: string } }>(
    '/api/security/block',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'admin')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { ip, reason = 'Manually blocked by admin' } = request.body || {};
      if (!ip || typeof ip !== 'string' || !isValidIpOrCidr(ip.trim())) {
        return reply.status(400).send({ error: 'ip must be a valid IPv4/IPv6 address or CIDR (e.g. 1.2.3.4 or 1.2.3.0/24)' });
      }

      const target = ip.trim();

      // Fix #10: exact IP match only — IPv6 compatible, CIDR subnet self-lockout not checked
      if (getClientIp(request) === target) {
        return reply.status(400).send({ error: 'Cannot block your own IP' });
      }

      if (fastify.authGuard.isBannedIp(target)) {
        return reply.status(409).send({ error: 'IP already blocked' });
      }

      // Fix #9: route through authGuard.banIp — single owner of banned-ips.json
      await fastify.authGuard.banIp(target, reason);

      try {
        await writeAuditLog(fastify, {
          userEmail: user.email,
          userName: user.name || user.email,
          action: 'ban',
          resourceType: 'ip_ban',
          ip: target,
          summary: reason,
        });
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write ban audit log');
      }

      return reply.status(201).send({ ok: true });
    },
  );

  // === Unblock IP ===

  fastify.delete<{ Params: { ip: string } }>(
    '/api/security/block/:ip',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'admin')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { ip } = request.params;

      // Fix #9: route through authGuard.unbanIp — single owner of banned-ips.json
      const removed = await fastify.authGuard.unbanIp(ip);
      if (!removed) {
        return reply.status(404).send({ error: 'IP not found in ban list' });
      }

      try {
        await writeAuditLog(fastify, {
          userEmail: user.email,
          userName: user.name || user.email,
          action: 'unblock',
          resourceType: 'ip_ban',
          ip,
          summary: `IP ${ip} unblocked by admin`,
        });
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write unblock audit log');
      }

      return reply.send({ ok: true });
    },
  );
}

// Consistent with other route files (analyticsRoutes, checkoutRoutes) — plain async function
export { securityRoutesImpl as securityRoutes };
