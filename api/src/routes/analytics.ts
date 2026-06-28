import type { FastifyInstance } from 'fastify';
import { meetsMinTier } from '../plugins/auth-guard.js';
import { getClientIp } from '../lib/client-ip.js';

const VALID_EVENT_TYPES = new Set([
  'page_view',
  'scroll_depth',
  'click',
  'element_visibility',
  'page_exit',
  'web_vital',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AnalyticsEvent = {
  type: string;
  sessionId: string;
  path: string;
  timestamp: number;
  data: Record<string, unknown>;
};

function derivePageType(path: string): string {
  if (path === '/') return 'home';
  if (path === '/products') return 'products';
  if (path.startsWith('/products/')) return 'product';
  if (path === '/collections') return 'collections';
  if (path.startsWith('/collections/')) return 'collection';
  if (path === '/search' || path.startsWith('/search?')) return 'search';
  if (path === '/cart') return 'cart';
  return 'page';
}

function parseUserAgent(ua: string | undefined): { deviceType: string; browser: string; os: string } {
  if (!ua) return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };
  const lower = ua.toLowerCase();

  let deviceType = 'desktop';
  if (/ipad|tablet|playbook|silk/.test(lower) || (/android/.test(lower) && !/mobile/.test(lower))) {
    deviceType = 'tablet';
  } else if (/mobi|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/.test(lower)) {
    deviceType = 'mobile';
  } else if (/bot|crawl|spider|slurp|curl|wget|python-requests|go-http-client|headlesschrome|phantomjs|puppeteer|playwright|node-fetch|axios|okhttp|java\/|go\/|ruby\/|httpx|aiohttp|undici|got\/|superagent|libwww-perl/.test(lower)) {
    deviceType = 'bot';
  }

  let browser = 'unknown';
  if (/edg\//.test(lower)) browser = 'Edge';
  else if (/opr\/|opera/.test(lower)) browser = 'Opera';
  else if (/firefox\//.test(lower)) browser = 'Firefox';
  else if (/chrome\//.test(lower) && !/chromium/.test(lower)) browser = 'Chrome';
  else if (/chromium\//.test(lower)) browser = 'Chromium';
  else if (/safari\//.test(lower) && !/chrome\//.test(lower)) browser = 'Safari';
  else if (/msie |trident\//.test(lower)) browser = 'IE';
  else if (/bot|crawl|spider/.test(lower)) browser = 'Bot';

  let os = 'unknown';
  if (/windows nt/.test(lower)) os = 'Windows';
  else if (/iphone|ipad|ipod/.test(lower)) os = 'iOS';
  else if (/android/.test(lower)) os = 'Android';
  else if (/mac os x|macintosh/.test(lower)) os = 'macOS';
  else if (/cros/.test(lower)) os = 'ChromeOS';
  else if (/linux/.test(lower)) os = 'Linux';

  return { deviceType, browser, os };
}

const RATE_LIMIT_KEY_PREFIX = 'analytics:rl:';
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW = 60;

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: { events: AnalyticsEvent[] } }>(
    '/api/analytics/events',
    async (request, reply) => {
      const { events } = request.body || {};

      if (!Array.isArray(events) || events.length === 0) {
        return reply.status(400).send({ error: 'events array required' });
      }

      if (events.length > 50) {
        return reply.status(400).send({ error: 'Max 50 events per batch' });
      }

      const clientIp = getClientIp(request);
      const rlKey = `${RATE_LIMIT_KEY_PREFIX}${clientIp}`;
      const results = await fastify.valkey.multi()
        .incr(rlKey)
        .expire(rlKey, RATE_LIMIT_WINDOW)
        .exec();
      const count = (results?.[0]?.[1] as number) ?? 0;
      if (count > RATE_LIMIT_MAX) {
        fastify.metrics.rateLimitHitsTotal.inc({ endpoint: '/api/analytics/events' });
        fastify.valkey.incr('sec:counter:429').then(() => fastify.valkey.expire('sec:counter:429', 60)).catch(() => {});
        const rlEvent = JSON.stringify({ ts: Date.now(), ip: clientIp, event_type: 'rate_limit', path: '/api/analytics/events', action: 'blocked', bot_score: null });
        fastify.valkey.lpush('sec:events:buffer', rlEvent).then(() => fastify.valkey.ltrim('sec:events:buffer', 0, 9999)).catch(() => {});
        return reply.status(429).send({ error: 'Rate limited' });
      }

      const valid: AnalyticsEvent[] = [];
      const sessionIds = new Set(events.map((e) => e.sessionId).filter(Boolean));
      const consentWithdrawn = new Set<string>();
      if (sessionIds.size > 0) {
        const sessionArr = [...sessionIds];
        const consentRes = await fastify.pg.query<{ anonymous_id: string; analytics: boolean }>(
          `SELECT DISTINCT ON (anonymous_id) anonymous_id, analytics
           FROM consent_records
           WHERE anonymous_id = ANY($1)
           ORDER BY anonymous_id, created_at DESC`,
          [sessionArr],
        );
        for (const row of consentRes.rows) {
          if (!row.analytics) consentWithdrawn.add(row.anonymous_id);
        }
      }

      for (const e of events) {
        if (
          !e.type ||
          !VALID_EVENT_TYPES.has(e.type) ||
          !e.sessionId ||
          !UUID_RE.test(e.sessionId) ||
          !e.path ||
          !e.path.startsWith('/') ||
          e.path.length > 500 ||
          typeof e.timestamp !== 'number'
        ) {
          continue;
        }
        if (consentWithdrawn.has(e.sessionId)) continue;
        valid.push(e);
      }

      if (valid.length === 0) {
        return reply.status(204).send();
      }

      const countryCode = fastify.lookupCountry(clientIp);
      const { deviceType, browser, os } = parseUserAgent(request.headers['user-agent'] as string | undefined);

      const values: unknown[] = [];
      const placeholders: string[] = [];
      let idx = 1;

      for (const e of valid) {
        const dataStr = JSON.stringify(e.data || {});
        if (dataStr.length > 2048) continue;
        placeholders.push(
          `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, to_timestamp($${idx + 5}::double precision / 1000), $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9})`,
        );
        values.push(
          e.sessionId,
          e.type,
          e.path.slice(0, 500),
          derivePageType(e.path),
          dataStr,
          e.timestamp,
          countryCode,
          deviceType,
          browser,
          os,
        );
        idx += 10;
      }

      if (placeholders.length === 0) {
        return reply.status(204).send();
      }

      await fastify.pg.query(
        `INSERT INTO analytics_events (session_id, event_type, page_path, page_type, event_data, event_timestamp, country_code, device_type, browser, os)
         VALUES ${placeholders.join(', ')}`,
        values,
      );

      return reply.status(204).send();
    },
  );

  // Performance: the behavior queries below cast JSONB fields (e.g. event_data->>'time_on_page_ms')
  // in WHERE/GROUP BY/AVG clauses. For large tables, expression indexes are needed:
  //   CREATE INDEX ON analytics_events (((event_data->>'time_on_page_ms')::numeric)) WHERE event_type = 'page_exit';
  //   CREATE INDEX ON analytics_events (((event_data->>'max_scroll_depth_pct')::numeric)) WHERE event_type = 'page_exit';
  //   CREATE INDEX ON analytics_events (((event_data->>'depth_pct')::int)) WHERE event_type = 'scroll_depth';
  // See migration 0021_analytics-events-expression-indexes.js
  fastify.get<{ Querystring: { start?: string; end?: string } }>(
    '/api/analytics/behavior',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'viewer')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { start, end } = request.query;
      if (!start || !end) {
        return reply.status(400).send({ error: 'start and end query params required' });
      }

      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return reply.status(400).send({ error: 'Invalid date format' });
      }

      const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const bucket = rangeDays <= 60 ? 'day' : 'week';

      const [summary, pageViews, topPages, scrollDepth, topClicks, visibility] =
        await Promise.all([
          fastify.pg.query(
            `SELECT
               COUNT(*) FILTER (WHERE event_type = 'page_view') AS total_page_views,
               COUNT(DISTINCT session_id) AS unique_sessions,
               AVG((event_data->>'time_on_page_ms')::numeric) FILTER (WHERE event_type = 'page_exit') AS avg_time_on_page_ms,
               AVG((event_data->>'max_scroll_depth_pct')::numeric) FILTER (WHERE event_type = 'page_exit') AS avg_scroll_depth
             FROM analytics_events
             WHERE event_timestamp BETWEEN $1 AND $2`,
            [startDate, endDate],
          ),

          fastify.pg.query(
            `SELECT date_trunc($3, event_timestamp) AS bucket,
                    COUNT(*) AS views,
                    COUNT(DISTINCT session_id) AS unique_sessions
             FROM analytics_events
             WHERE event_type = 'page_view'
               AND event_timestamp BETWEEN $1 AND $2
             GROUP BY bucket ORDER BY bucket`,
            [startDate, endDate, bucket],
          ),

          fastify.pg.query(
            `SELECT page_path,
                    page_type,
                    COUNT(*) FILTER (WHERE event_type = 'page_view') AS views,
                    COUNT(DISTINCT session_id) AS unique_sessions,
                    AVG((event_data->>'time_on_page_ms')::numeric) FILTER (WHERE event_type = 'page_exit') AS avg_time_ms,
                    AVG((event_data->>'max_scroll_depth_pct')::numeric) FILTER (WHERE event_type = 'page_exit') AS avg_scroll_depth
             FROM analytics_events
             WHERE event_timestamp BETWEEN $1 AND $2
             GROUP BY page_path, page_type
             ORDER BY views DESC
             LIMIT 20`,
            [startDate, endDate],
          ),

          fastify.pg.query(
            `SELECT page_type,
                    (event_data->>'depth_pct')::int AS depth,
                    COUNT(*) AS count
             FROM analytics_events
             WHERE event_type = 'scroll_depth'
               AND event_timestamp BETWEEN $1 AND $2
             GROUP BY page_type, depth
             ORDER BY page_type, depth`,
            [startDate, endDate],
          ),

          fastify.pg.query(
            `SELECT event_data->>'text' AS element_text,
                    event_data->>'tag' AS element_tag,
                    event_data->>'href' AS element_href,
                    page_path,
                    COUNT(*) AS click_count
             FROM analytics_events
             WHERE event_type = 'click'
               AND event_timestamp BETWEEN $1 AND $2
             GROUP BY element_text, element_tag, element_href, page_path
             ORDER BY click_count DESC
             LIMIT 30`,
            [startDate, endDate],
          ),

          fastify.pg.query(
            `SELECT COALESCE(event_data->>'element_id', event_data->>'element_text') AS label,
                    page_path,
                    COUNT(*) AS impression_count,
                    AVG((event_data->>'visible_duration_ms')::numeric) AS avg_visible_ms
             FROM analytics_events
             WHERE event_type = 'element_visibility'
               AND event_timestamp BETWEEN $1 AND $2
             GROUP BY label, page_path
             ORDER BY impression_count DESC
             LIMIT 20`,
            [startDate, endDate],
          ),
        ]);

      const s = summary.rows[0] || {};

      return reply.send({
        summary: {
          totalPageViews: parseInt(s.total_page_views || '0', 10),
          uniqueSessions: parseInt(s.unique_sessions || '0', 10),
          avgTimeOnPageMs: Math.round(parseFloat(s.avg_time_on_page_ms || '0')),
          avgScrollDepth: Math.round(parseFloat(s.avg_scroll_depth || '0')),
        },
        pageViews: pageViews.rows.map((r) => ({
          bucket: r.bucket,
          views: parseInt(r.views, 10),
          uniqueSessions: parseInt(r.unique_sessions, 10),
        })),
        topPages: topPages.rows.map((r) => ({
          path: r.page_path,
          pageType: r.page_type,
          views: parseInt(r.views, 10),
          uniqueSessions: parseInt(r.unique_sessions, 10),
          avgTimeMs: Math.round(parseFloat(r.avg_time_ms || '0')),
          avgScrollDepth: Math.round(parseFloat(r.avg_scroll_depth || '0')),
        })),
        scrollDepth: scrollDepth.rows.map((r) => ({
          pageType: r.page_type,
          depth: r.depth,
          count: parseInt(r.count, 10),
        })),
        topClicks: topClicks.rows.map((r) => ({
          text: r.element_text,
          tag: r.element_tag,
          href: r.element_href,
          page: r.page_path,
          count: parseInt(r.click_count, 10),
        })),
        elementVisibility: visibility.rows.map((r) => ({
          label: r.label,
          page: r.page_path,
          impressions: parseInt(r.impression_count, 10),
          avgVisibleMs: Math.round(parseFloat(r.avg_visible_ms || '0')),
        })),
      });
    },
  );

  // Country centroids (lat/lng) for map rendering. Source: approximate Natural Earth centroids.
  const COUNTRY_META: Record<string, { name: string; flag: string; lat: number; lng: number }> = {
    US: { name: 'United States', flag: '🇺🇸', lat: 37.09, lng: -95.71 },
    GB: { name: 'United Kingdom', flag: '🇬🇧', lat: 51.51, lng: -0.12 },
    DE: { name: 'Germany', flag: '🇩🇪', lat: 51.16, lng: 10.45 },
    CA: { name: 'Canada', flag: '🇨🇦', lat: 56.13, lng: -106.35 },
    AU: { name: 'Australia', flag: '🇦🇺', lat: -25.27, lng: 133.78 },
    NL: { name: 'Netherlands', flag: '🇳🇱', lat: 52.13, lng: 5.29 },
    FR: { name: 'France', flag: '🇫🇷', lat: 46.23, lng: 2.21 },
    IN: { name: 'India', flag: '🇮🇳', lat: 20.59, lng: 78.96 },
    BR: { name: 'Brazil', flag: '🇧🇷', lat: -14.24, lng: -51.93 },
    SE: { name: 'Sweden', flag: '🇸🇪', lat: 60.13, lng: 18.64 },
    JP: { name: 'Japan', flag: '🇯🇵', lat: 36.20, lng: 138.25 },
    SG: { name: 'Singapore', flag: '🇸🇬', lat: 1.35, lng: 103.82 },
    PL: { name: 'Poland', flag: '🇵🇱', lat: 51.92, lng: 19.15 },
    UA: { name: 'Ukraine', flag: '🇺🇦', lat: 48.38, lng: 31.17 },
    MX: { name: 'Mexico', flag: '🇲🇽', lat: 23.63, lng: -102.55 },
    NO: { name: 'Norway', flag: '🇳🇴', lat: 60.47, lng: 8.47 },
    NZ: { name: 'New Zealand', flag: '🇳🇿', lat: -40.90, lng: 174.89 },
    ES: { name: 'Spain', flag: '🇪🇸', lat: 40.46, lng: -3.75 },
    AR: { name: 'Argentina', flag: '🇦🇷', lat: -38.42, lng: -63.62 },
    ZA: { name: 'South Africa', flag: '🇿🇦', lat: -30.56, lng: 22.94 },
    IT: { name: 'Italy', flag: '🇮🇹', lat: 41.87, lng: 12.57 },
    CN: { name: 'China', flag: '🇨🇳', lat: 35.86, lng: 104.20 },
    KR: { name: 'South Korea', flag: '🇰🇷', lat: 35.91, lng: 127.77 },
    RU: { name: 'Russia', flag: '🇷🇺', lat: 61.52, lng: 105.32 },
    TR: { name: 'Turkey', flag: '🇹🇷', lat: 38.96, lng: 35.24 },
    ID: { name: 'Indonesia', flag: '🇮🇩', lat: -0.79, lng: 113.92 },
    CH: { name: 'Switzerland', flag: '🇨🇭', lat: 46.82, lng: 8.23 },
    BE: { name: 'Belgium', flag: '🇧🇪', lat: 50.50, lng: 4.47 },
    AT: { name: 'Austria', flag: '🇦🇹', lat: 47.52, lng: 14.55 },
    IE: { name: 'Ireland', flag: '🇮🇪', lat: 53.41, lng: -8.24 },
    DK: { name: 'Denmark', flag: '🇩🇰', lat: 56.26, lng: 9.50 },
    FI: { name: 'Finland', flag: '🇫🇮', lat: 61.92, lng: 25.75 },
    PT: { name: 'Portugal', flag: '🇵🇹', lat: 39.40, lng: -8.22 },
    CZ: { name: 'Czechia', flag: '🇨🇿', lat: 49.82, lng: 15.47 },
    GR: { name: 'Greece', flag: '🇬🇷', lat: 39.07, lng: 21.82 },
    IL: { name: 'Israel', flag: '🇮🇱', lat: 31.05, lng: 34.85 },
    AE: { name: 'United Arab Emirates', flag: '🇦🇪', lat: 23.42, lng: 53.85 },
    HK: { name: 'Hong Kong', flag: '🇭🇰', lat: 22.32, lng: 114.17 },
    TW: { name: 'Taiwan', flag: '🇹🇼', lat: 23.70, lng: 120.96 },
    VN: { name: 'Vietnam', flag: '🇻🇳', lat: 14.06, lng: 108.28 },
    TH: { name: 'Thailand', flag: '🇹🇭', lat: 15.87, lng: 100.99 },
    MY: { name: 'Malaysia', flag: '🇲🇾', lat: 4.21, lng: 101.98 },
    PH: { name: 'Philippines', flag: '🇵🇭', lat: 12.88, lng: 121.77 },
    CL: { name: 'Chile', flag: '🇨🇱', lat: -35.68, lng: -71.54 },
    CO: { name: 'Colombia', flag: '🇨🇴', lat: 4.57, lng: -74.30 },
    NG: { name: 'Nigeria', flag: '🇳🇬', lat: 9.08, lng: 8.68 },
    EG: { name: 'Egypt', flag: '🇪🇬', lat: 26.82, lng: 30.80 },
    SA: { name: 'Saudi Arabia', flag: '🇸🇦', lat: 23.89, lng: 45.08 },
    PK: { name: 'Pakistan', flag: '🇵🇰', lat: 30.38, lng: 69.35 },
    BD: { name: 'Bangladesh', flag: '🇧🇩', lat: 23.68, lng: 90.36 },
  };

  function flagFromCode(code: string): string {
    if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
    const A = 0x1F1E6;
    return String.fromCodePoint(A + (code.charCodeAt(0) - 65)) + String.fromCodePoint(A + (code.charCodeAt(1) - 65));
  }

  fastify.get<{ Querystring: { start?: string; end?: string; path?: string } }>(
    '/api/analytics/geo',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'viewer')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { start, end, path: pathFilter } = request.query;
      if (!start || !end) {
        return reply.status(400).send({ error: 'start and end query params required' });
      }
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return reply.status(400).send({ error: 'Invalid date format' });
      }

      const params: unknown[] = [startDate, endDate];
      let pathClause = '';
      if (pathFilter && typeof pathFilter === 'string' && pathFilter.length <= 500) {
        params.push(pathFilter);
        pathClause = ` AND page_path = $${params.length}`;
      }

      const result = await fastify.pg.query<{ country_code: string; visitors: string; views: string }>(
        `SELECT country_code,
                COUNT(DISTINCT session_id) AS visitors,
                COUNT(*) AS views
         FROM analytics_events
         WHERE event_type = 'page_view'
           AND country_code IS NOT NULL
           AND event_timestamp BETWEEN $1 AND $2${pathClause}
         GROUP BY country_code
         ORDER BY visitors DESC
         LIMIT 50`,
        params,
      );

      const countries = result.rows.map((r) => {
        const meta = COUNTRY_META[r.country_code];
        return {
          code: r.country_code,
          name: meta?.name ?? r.country_code,
          flag: meta?.flag ?? flagFromCode(r.country_code),
          lat: meta?.lat ?? 0,
          lng: meta?.lng ?? 0,
          visitors: parseInt(r.visitors, 10),
          views: parseInt(r.views, 10),
          registered: 0,
          paid: 0,
          paying: 0,
          regions: [],
        };
      });

      return reply.send({ countries });
    },
  );

  fastify.get<{ Querystring: { start?: string; end?: string; path?: string } }>(
    '/api/analytics/devices',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'viewer')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { start, end, path: pathFilter } = request.query;
      if (!start || !end) {
        return reply.status(400).send({ error: 'start and end query params required' });
      }
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return reply.status(400).send({ error: 'Invalid date format' });
      }

      const params: unknown[] = [startDate, endDate];
      let pathClause = '';
      if (pathFilter && typeof pathFilter === 'string' && pathFilter.length <= 500) {
        params.push(pathFilter);
        pathClause = ` AND page_path = $${params.length}`;
      }

      const baseWhere = `event_type = 'page_view' AND event_timestamp BETWEEN $1 AND $2${pathClause}`;

      const [byDevice, byBrowser, byOs, byPage] = await Promise.all([
        fastify.pg.query<{ device_type: string; visitors: string; views: string }>(
          `SELECT COALESCE(device_type, 'unknown') AS device_type,
                  COUNT(DISTINCT session_id) AS visitors,
                  COUNT(*) AS views
           FROM analytics_events
           WHERE ${baseWhere}
           GROUP BY device_type
           ORDER BY visitors DESC`,
          params,
        ),
        fastify.pg.query<{ browser: string; visitors: string; views: string }>(
          `SELECT COALESCE(browser, 'unknown') AS browser,
                  COUNT(DISTINCT session_id) AS visitors,
                  COUNT(*) AS views
           FROM analytics_events
           WHERE ${baseWhere}
           GROUP BY browser
           ORDER BY visitors DESC
           LIMIT 20`,
          params,
        ),
        fastify.pg.query<{ os: string; visitors: string; views: string }>(
          `SELECT COALESCE(os, 'unknown') AS os,
                  COUNT(DISTINCT session_id) AS visitors,
                  COUNT(*) AS views
           FROM analytics_events
           WHERE ${baseWhere}
           GROUP BY os
           ORDER BY visitors DESC
           LIMIT 20`,
          params,
        ),
        fastify.pg.query<{ page_path: string; device_type: string; visitors: string; views: string }>(
          `SELECT page_path,
                  COALESCE(device_type, 'unknown') AS device_type,
                  COUNT(DISTINCT session_id) AS visitors,
                  COUNT(*) AS views
           FROM analytics_events
           WHERE ${baseWhere}
           GROUP BY page_path, device_type
           ORDER BY views DESC
           LIMIT 100`,
          params,
        ),
      ]);

      return reply.send({
        byDevice: byDevice.rows.map((r) => ({
          label: r.device_type,
          visitors: parseInt(r.visitors, 10),
          views: parseInt(r.views, 10),
        })),
        byBrowser: byBrowser.rows.map((r) => ({
          label: r.browser,
          visitors: parseInt(r.visitors, 10),
          views: parseInt(r.views, 10),
        })),
        byOs: byOs.rows.map((r) => ({
          label: r.os,
          visitors: parseInt(r.visitors, 10),
          views: parseInt(r.views, 10),
        })),
        byPage: byPage.rows.map((r) => ({
          path: r.page_path,
          deviceType: r.device_type,
          visitors: parseInt(r.visitors, 10),
          views: parseInt(r.views, 10),
        })),
      });
    },
  );

  // === Consent Record (GDPR) ===
  const CONSENT_RL_KEY_PREFIX = 'consent:rl:';
  const CONSENT_RL_MAX = 10;
  const CONSENT_RL_WINDOW = 60;
  const ANONYMOUS_ID_RE = /^[a-f0-9-]{16,64}$/i;

  fastify.post<{ Body: { anonymousId: string; analytics: boolean; marketing: boolean } }>(
    '/api/consent',
    async (request, reply) => {
      const clientIp = getClientIp(request);
      const rlKey = `${CONSENT_RL_KEY_PREFIX}${clientIp}`;
      const rlResults = await fastify.valkey.multi()
        .incr(rlKey)
        .expire(rlKey, CONSENT_RL_WINDOW)
        .exec();
      const rlCount = (rlResults?.[0]?.[1] as number) ?? 0;
      if (rlCount > CONSENT_RL_MAX) {
        fastify.metrics.rateLimitHitsTotal.inc({ endpoint: '/api/consent' });
        fastify.valkey.incr('sec:counter:429').then(() => fastify.valkey.expire('sec:counter:429', 60)).catch(() => {});
        const rlEvent = JSON.stringify({ ts: Date.now(), ip: clientIp, event_type: 'rate_limit', path: '/api/consent', action: 'blocked', bot_score: null });
        fastify.valkey.lpush('sec:events:buffer', rlEvent).then(() => fastify.valkey.ltrim('sec:events:buffer', 0, 9999)).catch(() => {});
        return reply.status(429).send({ error: 'Rate limited' });
      }

      const { anonymousId, analytics, marketing } = request.body || {};

      if (!anonymousId || typeof anonymousId !== 'string' || anonymousId.length > 64) {
        return reply.status(400).send({ error: 'anonymousId is required (max 64 chars)' });
      }
      if (!ANONYMOUS_ID_RE.test(anonymousId)) {
        return reply.status(400).send({ error: 'anonymousId has invalid format' });
      }
      if (typeof analytics !== 'boolean' || typeof marketing !== 'boolean') {
        return reply.status(400).send({ error: 'analytics and marketing must be booleans' });
      }

      const ip = clientIp.slice(0, 45);
      const userAgent = ((request.headers['user-agent'] as string) || '').slice(0, 500) || null;

      await fastify.pg.query(
        `INSERT INTO consent_records (anonymous_id, analytics, marketing, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [anonymousId, analytics, marketing, ip, userAgent],
      );

      return reply.status(201).send({ ok: true });
    },
  );
}
