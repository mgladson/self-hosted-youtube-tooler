import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import fp from 'fastify-plugin';
import type { AsnResponse, CountryResponse } from 'maxmind';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getClientIp } from '../lib/client-ip.js';

declare module 'fastify' {
  interface FastifyInstance {
    lookupCountry: (ip: string) => string | null;
  }
}

type GeoReader = { get(ip: string): CountryResponse | null };
type AsnReader = { get(ip: string): AsnResponse | null };

// GeoIP support — loaded lazily; null if .mmdb file not found
let geoReader: GeoReader | null = null;
let asnReader: AsnReader | null = null;

// Known datacenter/hosting ASNs — requests from these ASNs score +0.20
const DATACENTER_ASNS = new Set([
  14061,  // DigitalOcean
  16509,  // Amazon AWS
  14618,  // Amazon AWS (legacy)
  15169,  // Google Cloud
  8075,   // Microsoft Azure
  24940,  // Hetzner Online
  16276,  // OVH
  20473,  // Choopa / Vultr
  63949,  // Linode / Akamai
  13335,  // Cloudflare
  45090,  // Alibaba Cloud
  37963,  // Alibaba Cloud (APAC)
]);

// Tor exit node list — fetched at startup; no extra deps (Tor Project public list)
let torExitNodes: Set<string> = new Set();

async function loadTorExitNodes(): Promise<void> {
  try {
    const res = await fetch('https://check.torproject.org/torbulkexitlist', {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return;
    const text = await res.text();
    const ips = text.split('\n')
      .map((l) => l.trim())
      .filter((l) => /^\d+\.\d+\.\d+\.\d+$/.test(l));
    torExitNodes = new Set(ips);
  } catch {
    // Network unavailable — Tor signal disabled until next restart
  }
}

async function loadGeoIP(): Promise<void> {
  const mmdbPath = path.resolve(process.cwd(), '..', 'geoip-country.mmdb');
  try {
    await fs.promises.access(mmdbPath);
  } catch {
    return;
  }
  try {
    const maxmind = await import('maxmind');
    geoReader = await maxmind.open<CountryResponse>(mmdbPath);
  } catch {
    // maxmind package not installed or file corrupt — skip
  }
}

async function loadAsnDB(): Promise<void> {
  const mmdbPath = path.resolve(process.cwd(), '..', 'geoip-asn.mmdb');
  try {
    await fs.promises.access(mmdbPath);
  } catch {
    return;
  }
  try {
    const maxmind = await import('maxmind');
    asnReader = await maxmind.open<AsnResponse>(mmdbPath);
  } catch {
    // maxmind package not installed or file corrupt — skip
  }
}

function lookupCountry(ip: string): string | null {
  if (!geoReader) return null;
  try {
    return geoReader.get(ip)?.country?.iso_code ?? null;
  } catch {
    return null;
  }
}

function lookupAsn(ip: string): number | null {
  if (!asnReader) return null;
  try {
    return asnReader.get(ip)?.autonomous_system_number ?? null;
  } catch {
    return null;
  }
}

// UA classification
type UaClass = 'browser' | 'good_bot' | 'library' | 'empty' | 'unknown';

const GOOD_BOT_RE = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver/i;
const LIBRARY_RE = /^(curl|python-requests|go-http-client|java\/|ruby\/|axios|node-fetch|httpx|aiohttp|undici|got\/|superagent|okhttp|libwww-perl)/i;

// Known legitimate crawler reverse-DNS suffixes (for rDNS spoof detection)
const LEGIT_CRAWLER_RDNS = [
  '.googlebot.com', '.google.com',
  '.bingbot.com', '.msn.com',
  '.crawl.yahoo.net', '.yandex.com', '.yandex.ru',
  '.baidu.com', '.sogou.com',
];

function classifyUA(ua: string | undefined): UaClass {
  if (!ua || ua.trim() === '') return 'empty';
  if (GOOD_BOT_RE.test(ua)) return 'good_bot';
  if (LIBRARY_RE.test(ua)) return 'library';
  if (/mozilla|webkit|chrome|safari|firefox|opera|edge/i.test(ua)) return 'browser';
  return 'unknown';
}

// Fix #5: rDNS spoof detection — async, results cached in Valkey for 5 minutes
// Real Googlebot/Bingbot reverse DNS resolves to *.googlebot.com, *.bingbot.com etc.
// A spoofed UA claiming to be a known crawler from a non-crawler IP scores 0.50.
async function checkRdnsSpoof(
  ip: string,
  uaClass: UaClass,
  valkeyGet: (key: string) => Promise<string | null>,
  valkeySet: (key: string, value: string, mode: string, ttl: number) => Promise<unknown>,
): Promise<boolean> {
  // Only check IPs claiming to be known good bots
  if (uaClass !== 'good_bot') return false;

  const cacheKey = `sec:rdns:${ip}`;
  const cached = await valkeyGet(cacheKey);
  if (cached !== null) return cached === 'spoof';

  try {
    const hostnames = await dns.promises.reverse(ip);
    const isLegit = hostnames.some((h) =>
      LEGIT_CRAWLER_RDNS.some((suffix) => h.endsWith(suffix)),
    );
    await valkeySet(cacheKey, isLegit ? 'legit' : 'spoof', 'EX', 300);
    return !isLegit;
  } catch (err: unknown) {
    // Fix #4: distinguish NXDOMAIN (no rDNS record = spoof) from DNS unavailability (unknown)
    const code = (err as { code?: string }).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      // Explicit no-record response — definitely spoofed (real crawlers always have rDNS)
      await valkeySet(cacheKey, 'spoof', 'EX', 300);
      return true;
    }
    // DNS server unreachable, timeout, etc. — don't penalise (could be infra issue)
    await valkeySet(cacheKey, 'unknown', 'EX', 60);
    return false;
  }
}

// Bot score signals
function computeBotScore(params: {
  uaClass: UaClass;
  hasAccept: boolean;
  hasAcceptLanguage: boolean;
  honeypotHit: boolean;
  rdnsSpoof: boolean;
  torExit: boolean;
  datacenterAsn: boolean;
  iatUniform: boolean;
  checkoutFast: boolean;
}): number {
  const { uaClass, hasAccept, hasAcceptLanguage, honeypotHit, rdnsSpoof, torExit, datacenterAsn, iatUniform, checkoutFast } = params;

  let score = 0;

  if (uaClass === 'empty' || uaClass === 'library') score += 0.30;
  if (!hasAccept) score += 0.15;
  if (!hasAcceptLanguage) score += 0.10;
  if (honeypotHit) score += 0.60;

  // rDNS spoof — UA claims to be a known crawler but rDNS doesn't confirm it
  if (rdnsSpoof) score += 0.50;

  // Tor exit node — anonymisation layer strongly correlated with automation
  if (torExit) score += 0.40;

  // Datacenter ASN — hosting provider IP space (DigitalOcean, AWS, GCP, etc.)
  if (datacenterAsn) score += 0.20;

  // Metronomic inter-arrival times — coefficient of variation < 0.1 with mean IAT < 2s
  if (iatUniform) score += 0.15;

  // Checkout completed suspiciously fast — set by webhook when PI created < 5s ago
  if (checkoutFast) score += 0.30;

  return Math.min(1.0, score);
}

const HONEYPOT_PATHS = new Set([
  '/wp-login.php',
  '/.env',
  '/admin.php',
  '/xmlrpc.php',
  '/setup.php',
]);

function isHoneypotPath(url: string): boolean {
  const pathname = url.split('?')[0];
  if (HONEYPOT_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/phpMyAdmin')) return true;
  if (pathname.startsWith('/wp-admin')) return true;
  return false;
}

async function botDetector(fastify: FastifyInstance) {
  await Promise.all([loadGeoIP(), loadAsnDB()]);
  fastify.decorate('lookupCountry', lookupCountry);
  if (!geoReader) {
    fastify.log.warn(
      'geoip-country.mmdb not found — country detection disabled. ' +
      'Place a MaxMind GeoLite2-Country or DB-IP Lite Country .mmdb at the project root.',
    );
  }
  if (!asnReader) {
    fastify.log.warn(
      'geoip-asn.mmdb not found — datacenter ASN detection disabled. ' +
      'Place a MaxMind GeoLite2-ASN or DB-IP Lite ASN .mmdb at the project root.',
    );
  }
  void loadTorExitNodes(); // non-blocking — graceful if network unavailable

  let attackInterval: ReturnType<typeof setInterval> | null = null;
  let flushInterval: ReturnType<typeof setInterval> | null = null;
  let retentionInterval: ReturnType<typeof setInterval> | null = null;

  // Per-request hook: rate tracking + UA classification + honeypot detection
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const ip = getClientIp(request);
    const ua = request.headers['user-agent'];
    const uaClass = classifyUA(ua);
    const country = lookupCountry(ip);

    // ASN lookup — used for datacenter signal and per-ASN rate tracking
    const asn = lookupAsn(ip);

    const ipKey = `sec:req:ip:${ip}`;
    const seenKey = 'sec:seen_ips';
    const asnKey = asn !== null ? `sec:req:asn:${asn}` : null;

    const pipeline = fastify.valkey.pipeline();
    pipeline.incr(ipKey);
    pipeline.expire(ipKey, 60);
    pipeline.sadd(seenKey, ip);
    pipeline.expire(seenKey, 60);
    pipeline.incr('sec:counter:req');
    pipeline.expire('sec:counter:req', 60);
    if (asnKey) {
      pipeline.incr(asnKey);
      pipeline.expire(asnKey, 60);
    }
    await pipeline.exec();

    // Classify UA for metrics
    fastify.metrics.httpRequestsByUaClassTotal.inc({
      ua_class: uaClass,
      method: request.method,
    });

    // Honeypot detection
    if (isHoneypotPath(request.url)) {
      const botScore = 1.0; // Definitive bot signal
      const event = JSON.stringify({
        ts: Date.now(),
        ip,
        country,
        ua: ua?.slice(0, 200),
        ua_class: uaClass,
        path: request.url,
        event_type: 'honeypot',
        bot_score: botScore,
        action: 'blocked',
      });
      const honeypotPipeline = fastify.valkey.pipeline();
      honeypotPipeline.set(`sec:honeypot:${ip}`, '1', 'EX', 86400);
      honeypotPipeline.set(`sec:bot:score:${ip}`, String(botScore), 'EX', 300);
      honeypotPipeline.lpush('sec:events:buffer', event);
      honeypotPipeline.ltrim('sec:events:buffer', 0, 9999);
      await honeypotPipeline.exec();

      // Fix #6: immediate ban on honeypot hit (was: progressive counter requiring 6 failures)
      fastify.authGuard.banIp(ip, `Honeypot hit: ${request.url}`);
      return;
    }

    // Gather signals for bot scoring — single pipeline for honeypot + checkout_fast + IAT
    const now = Date.now();
    const iatKey = `sec:iat:${ip}`;
    const signalPipeline = fastify.valkey.pipeline();
    signalPipeline.get(`sec:honeypot:${ip}`);
    signalPipeline.get(`sec:checkout_fast:${ip}`);
    signalPipeline.lpush(iatKey, String(now));
    signalPipeline.ltrim(iatKey, 0, 9);
    signalPipeline.expire(iatKey, 60);
    signalPipeline.lrange(iatKey, 0, -1);
    const signalResults = await signalPipeline.exec();

    const honeypotFlag = signalResults?.[0]?.[1] as string | null;
    const checkoutFastFlag = signalResults?.[1]?.[1] as string | null;
    const honeypotHit = honeypotFlag === '1';
    const checkoutFast = checkoutFastFlag === '1';

    // Compute IAT uniformity from pipeline results
    const iatTimestamps = ((signalResults?.[5]?.[1] as string[]) ?? []).map(Number);
    let iatUniform = false;
    if (iatTimestamps.length >= 3) {
      const deltas: number[] = [];
      for (let i = 0; i < iatTimestamps.length - 1; i++) {
        deltas.push(Math.abs(iatTimestamps[i] - iatTimestamps[i + 1]));
      }
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      if (mean > 0 && mean < 2000) {
        const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length;
        const stdDev = Math.sqrt(variance);
        iatUniform = (stdDev / mean) < 0.1;
      }
    }
    const datacenterAsn = asn !== null && DATACENTER_ASNS.has(asn);

    // Fix #5: rDNS spoof check (only for IPs with good-bot UA — cached in Valkey)
    const rdnsSpoof = await checkRdnsSpoof(
      ip,
      uaClass,
      (key) => fastify.valkey.get(key),
      (key, value, mode, ttl) => fastify.valkey.set(key, value, mode as 'EX', ttl),
    );

    const score = computeBotScore({
      uaClass,
      hasAccept: !!request.headers['accept'],
      hasAcceptLanguage: !!request.headers['accept-language'],
      honeypotHit,
      rdnsSpoof,
      torExit: torExitNodes.has(ip),
      datacenterAsn,
      iatUniform,
      checkoutFast,
    });

    if (score >= 0.20) {
      await fastify.valkey.set(`sec:bot:score:${ip}`, String(score.toFixed(3)), 'EX', 300);
    }

    // Buffer flagged/blocked events
    if (score >= 0.60) {
      const action = score >= 0.85 ? 'blocked' : 'flagged';
      const event = JSON.stringify({
        ts: Date.now(),
        ip,
        country,
        ua: ua?.slice(0, 200),
        ua_class: uaClass,
        path: request.url,
        event_type: 'bot_flag',
        bot_score: parseFloat(score.toFixed(3)),
        action,
      });
      const bufferPipeline = fastify.valkey.pipeline();
      bufferPipeline.lpush('sec:events:buffer', event);
      bufferPipeline.ltrim('sec:events:buffer', 0, 9999);
      await bufferPipeline.exec();

      // Fix #6: immediate ban for definitive bots (was: progressive counter)
      if (score >= 0.85) {
        fastify.authGuard.banIp(ip, `Bot score ${score.toFixed(2)} — auto-banned`);
      }
    }
  });

  // Attack detection loop — runs every 30s
  fastify.addHook('onReady', async () => {
    let securityEventsTableExists: boolean | null = null;

    const checkSecurityEventsTable = async (): Promise<boolean> => {
      if (securityEventsTableExists === true) return true;
      const tableCheck = await fastify.pg.query(
        `SELECT to_regclass('public.security_events') AS tbl`,
      );
      if (tableCheck.rows[0].tbl) {
        securityEventsTableExists = true;
        return true;
      }
      return false;
    };

    // Flush security events from Valkey buffer to PostgreSQL every 5s
    const flushEvents = async () => {
      try {
        if (!await checkSecurityEventsTable()) return;

        // Recover any events left in the flushing key from a previous failed flush
        // (Valkey RENAME would overwrite it, losing those events)
        const leftoverLen = await fastify.valkey.llen('sec:events:buffer:flushing');
        if (leftoverLen > 0) {
          const leftovers = await fastify.valkey.lrange('sec:events:buffer:flushing', 0, -1);
          if (leftovers.length > 0) {
            // Re-queue at tail so they're processed next cycle after the current batch
            await fastify.valkey.rpush('sec:events:buffer', ...leftovers);
          }
          await fastify.valkey.del('sec:events:buffer:flushing');
        }

        // Atomically move buffer to flushing key so new events go to the original key
        await fastify.valkey.rename('sec:events:buffer', 'sec:events:buffer:flushing');
        const batch = await fastify.valkey.lrange('sec:events:buffer:flushing', 0, 4999);
        if (batch.length === 0) {
          await fastify.valkey.del('sec:events:buffer:flushing');
          return;
        }

        const parsed = batch.map((raw) => {
          try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
        }).filter(Boolean) as Record<string, unknown>[];

        if (parsed.length > 0) {
          const values: unknown[] = [];
          const placeholders: string[] = [];
          let idx = 1;
          for (const e of parsed) {
            placeholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, to_timestamp($${idx+8}::bigint / 1000))`);
            values.push(
              e.ip, e.country ?? null, e.event_type, e.path ?? null,
              e.ua ?? null, e.bot_score ?? null, e.action ?? 'flagged',
              JSON.stringify({ ua_class: e.ua_class }),
              (e.ts as number) ?? Date.now(),
            );
            idx += 9;
          }
          await fastify.pg.query(
            `INSERT INTO security_events (ip, country, event_type, endpoint, user_agent, bot_score, action, metadata, created_at)
             VALUES ${placeholders.join(', ')}`,
            values,
          );
        }
        await fastify.valkey.del('sec:events:buffer:flushing');
      } catch {
        // If rename failed (key doesn't exist) or PG is down, silently skip
      }
    };

    // Ensure partition exists for current + next month
    const ensurePartitions = async () => {
      try {
        if (!await checkSecurityEventsTable()) return;

        const now = new Date();
        for (let offset = 0; offset <= 1; offset++) {
          const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          const nextYear = nextMonth.getFullYear();
          const nextMonthStr = String(nextMonth.getMonth() + 1).padStart(2, '0');
          const partName = `security_events_${year}_${month}`;
          if (!/^[a-z_0-9]+$/.test(partName)) throw new Error(`Invalid partition name: ${partName}`);
          if (!/^security_events_\d{4}_\d{2}$/.test(partName)) continue;
          await fastify.pg.query(`
            CREATE TABLE IF NOT EXISTS ${partName} PARTITION OF security_events
            FOR VALUES FROM ('${year}-${month}-01') TO ('${nextYear}-${nextMonthStr}-01')
          `);
        }
      } catch {
        // Table not yet created — skip
      }
    };

    // Daily retention cleanup — drop all partitions older than 90 days
    // Loops up to 24 months back to handle extended server downtime
    const dropOldPartitions = async () => {
      try {
        if (!await checkSecurityEventsTable()) return;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const cutoffMonth = new Date(cutoff.getFullYear(), cutoff.getMonth(), 1);

        for (let offset = 1; offset <= 24; offset++) {
          const target = new Date(cutoffMonth.getFullYear(), cutoffMonth.getMonth() - offset, 1);
          const year = target.getFullYear();
          const month = String(target.getMonth() + 1).padStart(2, '0');
          const partName = `security_events_${year}_${month}`;
          if (!/^[a-z_0-9]+$/.test(partName)) throw new Error(`Invalid partition name: ${partName}`);
          if (!/^security_events_\d{4}_\d{2}$/.test(partName)) continue;

          const exists = await fastify.pg.query(
            `SELECT to_regclass($1) AS tbl`,
            [`public.${partName}`],
          );
          if (exists.rows[0].tbl) {
            await fastify.pg.query(`DROP TABLE IF EXISTS ${partName}`);
            fastify.log.info(`Dropped old security partition: ${partName}`);
          }
        }
      } catch {
        // Silently skip
      }
    };

    await ensurePartitions();

    // Attack detection every 30s
    attackInterval = setInterval(async () => {
      try {
        const [rate429Raw, uniqueIpsRaw] = await Promise.all([
          fastify.valkey.get('sec:counter:429'),
          fastify.valkey.scard('sec:seen_ips'),
        ]);

        const rate429 = parseInt(rate429Raw ?? '0', 10);
        const uniqueIps = uniqueIpsRaw ?? 0;
        const totalReqRaw = await fastify.valkey.get('sec:counter:req');
        const totalReq = parseInt(totalReqRaw ?? '0', 10);

        const rate429Pct = totalReq > 0 ? (rate429 / totalReq) : 0;
        const BASELINE_IPS = 20; // rough baseline unique IPs per minute

        let severity: 'NORMAL' | 'ELEVATED' | 'ATTACK' = 'NORMAL';
        if (rate429Pct > 0.05 && uniqueIps > BASELINE_IPS * 5) {
          severity = 'ATTACK';
        } else if (rate429Pct > 0.01 || uniqueIps > BASELINE_IPS * 2) {
          severity = 'ELEVATED';
        }

        if (severity !== 'NORMAL') {
          await fastify.valkey.set('sec:attacks:active', severity, 'EX', 300);
          if (severity === 'ATTACK') {
            await fastify.valkey.setnx('sec:attack:start', String(Math.floor(Date.now() / 1000)));
            await fastify.valkey.expire('sec:attack:start', 86400);
          }
        }
      } catch {
        // Silently skip
      }
    }, 30_000);

    // Flush buffer every 5s
    flushInterval = setInterval(flushEvents, 5_000);

    // Drop old partitions once per day
    retentionInterval = setInterval(dropOldPartitions, 24 * 60 * 60 * 1000);
  });

  fastify.addHook('onClose', async () => {
    if (attackInterval) clearInterval(attackInterval);
    if (flushInterval) clearInterval(flushInterval);
    if (retentionInterval) clearInterval(retentionInterval);
  });
}

export const botDetectorPlugin = fp(botDetector, {
  name: 'bot-detector',
  dependencies: ['valkey', 'postgres', 'metrics', 'auth-guard'],
});
