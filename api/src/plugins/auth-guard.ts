import fs from 'node:fs';
import path from 'node:path';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getClientIp } from '../lib/client-ip.js';
export type AdminTier = 'viewer' | 'editor' | 'admin' | 'super_admin';

const TIER_ORDER: readonly AdminTier[] = ['viewer', 'editor', 'admin', 'super_admin'];

/** Returns true if `tier` is at or above `min` in the privilege ladder. */
export function meetsMinTier(tier: AdminTier | undefined, min: AdminTier): boolean {
  if (!tier) return false;
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min);
}

export type BannedIp = {
  ip: string;
  reason: string;
  bannedAt: string;
};

export type AuthGuard = {
  isAdminEmail: (email: string) => boolean;
  getAdminTier: (email: string) => AdminTier | null;
  isBannedIp: (ip: string) => boolean;
  recordFailedAttempt: (ip: string) => Promise<{ banned: boolean; cooldown: boolean; remaining: number }>;
  /** Immediately ban an IP and persist to banned-ips.json. No-op if already banned. */
  banIp: (ip: string, reason: string) => Promise<void>;
  /** Remove an IP from the ban list. Returns true if the IP was found and removed. */
  unbanIp: (ip: string) => Promise<boolean>;
  /** Return a copy of the current banned-IPs list. */
  getBannedList: () => BannedIp[];
  /** Force-reload banned-IPs from disk (e.g. after an external write). */
  reloadBannedIps: () => Promise<void>;
};

declare module 'fastify' {
  interface FastifyInstance {
    authGuard: AuthGuard;
  }
}

const PUBLIC_PREFIXES = [
  '/api/health',
  '/api/auth/',
  '/api/analytics/events',
  '/api/auth/customer/',
  '/api/banner',
  '/api/pages',
  '/api/checkout/',
  '/api/download/', // order-token-gated; no session required
  '/api/blog',      // public blog listing, post detail, and RSS feed
  '/api/youtube',   // public youtube extractor (cached + per-IP rate limited)
  '/api/v1/',       // public developer API — authenticated per-request by API key (Bearer)
  // NOT publicly readable — every invoice route requires an admin session. Listed
  // here only so the Create Invoice GH Action's X-Service-Token request reaches the
  // route's own guard (POST create + POST :id/email validate the token there).
  '/api/invoices',
  '/api/discounts/validate', // public discount code validation
  '/api/products/', // public product reviews (GET) — WARNING: all sub-paths under /api/products/ are public
  '/api/newsletter/subscribe',
  '/api/newsletter/unsubscribe',
  '/api/consent',
  '/api/coin-price/',
];

// Routes that must match exactly (no sub-paths). /api/ads is public but /api/ads/config is not.
const PUBLIC_EXACT = [
  '/api/ads',
  '/api/newsletter/settings',
];

function isPublicRoute(url: string): boolean {
  // Non-API routes (e.g. honeypot paths like /wp-login.php) are not guarded here
  if (!url.startsWith('/api/')) return true;
  // Strip query string for matching
  const path = url.split('?')[0];
  if (PUBLIC_EXACT.includes(path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => {
    if (!url.startsWith(prefix)) return false;
    // Prefixes ending with '/' already enforce a path boundary
    if (prefix.endsWith('/')) return true;
    // Otherwise ensure the match ends at a segment boundary to avoid /api/blog matching /api/blog-foo
    const next = url[prefix.length];
    return next === undefined || next === '/' || next === '?';
  });
}

const MAX_FAILURES = 6;
const COOLDOWN_SECONDS = 15 * 60;
const FAIL_KEY_PREFIX = 'auth:fails:';
const COOLDOWN_KEY_PREFIX = 'auth:cooldown:';

// ---- IPv4 CIDR matching ----

function isIPv4InCidr(ip: string, cidr: string): boolean {
  try {
    const [network, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    if (isNaN(bits) || bits < 0 || bits > 32) return false;
    const toUint32 = (s: string) =>
      s.split('.').reduce((acc, o) => ((acc << 8) | parseInt(o, 10)) >>> 0, 0);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (toUint32(ip) & mask) === (toUint32(network) & mask);
  } catch {
    return false;
  }
}

// ---- IPv6 CIDR matching ----

function ipv6ToBytes(ip: string): Uint8Array | null {
  try {
    const halves = ip.split('::');
    if (halves.length > 2) return null;

    let groups: string[];
    if (halves.length === 2) {
      const left = halves[0] ? halves[0].split(':') : [];
      const right = halves[1] ? halves[1].split(':') : [];
      const fill = 8 - left.length - right.length;
      if (fill < 0) return null;
      groups = [...left, ...Array<string>(fill).fill('0'), ...right];
    } else {
      groups = halves[0].split(':');
    }

    if (groups.length !== 8) return null;

    const bytes = new Uint8Array(16);
    for (let i = 0; i < 8; i++) {
      const val = parseInt(groups[i], 16);
      if (isNaN(val) || val < 0 || val > 0xffff) return null;
      bytes[i * 2] = (val >> 8) & 0xff;
      bytes[i * 2 + 1] = val & 0xff;
    }
    return bytes;
  } catch {
    return null;
  }
}

function isIPv6InCidr(ip: string, cidr: string): boolean {
  try {
    const [network, bitsStr] = cidr.split('/');
    const prefixLen = parseInt(bitsStr, 10);
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 128) return false;

    const ipBytes = ipv6ToBytes(ip);
    const netBytes = ipv6ToBytes(network);
    if (!ipBytes || !netBytes) return false;

    const fullBytes = Math.floor(prefixLen / 8);
    const remainBits = prefixLen % 8;

    for (let i = 0; i < fullBytes; i++) {
      if (ipBytes[i] !== netBytes[i]) return false;
    }

    if (remainBits > 0) {
      const mask = 0xff & (0xff << (8 - remainBits));
      if ((ipBytes[fullBytes] & mask) !== (netBytes[fullBytes] & mask)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isIpInCidr(ip: string, cidr: string): boolean {
  return ip.includes(':') || cidr.includes(':')
    ? isIPv6InCidr(ip, cidr)
    : isIPv4InCidr(ip, cidr);
}

// ---- Plugin ----

async function authGuard(fastify: FastifyInstance) {
  const adminsPath = path.resolve(process.cwd(), '..', 'data', 'admins.json');
  const bannedPath = path.resolve(process.cwd(), '..', 'data', 'banned-ips.json');

  let adminEmails = new Map<string, AdminTier>();
  let bannedIps = new Set<string>();
  let bannedCidrs: string[] = [];
  let bannedIpsList: BannedIp[] = [];

  function checkIsBanned(ip: string): boolean {
    if (bannedIps.has(ip)) return true;
    return bannedCidrs.some((cidr) => isIpInCidr(ip, cidr));
  }

  async function loadAdmins() {
    try {
      const raw = await fs.promises.readFile(adminsPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      const newMap = new Map<string, AdminTier>();

      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === 'string') {
            // Backward-compat: plain email string → default tier 'admin'
            newMap.set(entry.toLowerCase(), 'admin');
          } else if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).email === 'string') {
            const e = entry as Record<string, unknown>;
            const tier: AdminTier = (['viewer', 'editor', 'admin', 'super_admin'] as AdminTier[]).includes(e.tier as AdminTier)
              ? (e.tier as AdminTier)
              : 'admin';
            newMap.set((e.email as string).toLowerCase(), tier);
          }
        }
      }

      adminEmails = newMap;
      fastify.log.info(`Loaded ${adminEmails.size} admin email(s)`);
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to load admins.json');
    }
  }

  async function loadBannedIps() {
    try {
      const raw = await fs.promises.readFile(bannedPath, 'utf-8');
      bannedIpsList = JSON.parse(raw);
      bannedIps = new Set(bannedIpsList.filter((b) => !b.ip.includes('/')).map((b) => b.ip));
      bannedCidrs = bannedIpsList.filter((b) => b.ip.includes('/')).map((b) => b.ip);
      fastify.log.info(`Loaded ${bannedIps.size} banned IP(s), ${bannedCidrs.length} CIDR(s)`);
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to load banned-ips.json');
      bannedIpsList = [];
      bannedIps = new Set();
      bannedCidrs = [];
    }
  }

  await loadAdmins();
  await loadBannedIps();

  // Event-based file watch (no polling). Debounce reloads to coalesce rapid writes
  // (e.g., editor save sequences emit several events within milliseconds).
  let adminsReloadTimer: NodeJS.Timeout | null = null;
  const scheduleAdminsReload = () => {
    if (adminsReloadTimer) clearTimeout(adminsReloadTimer);
    adminsReloadTimer = setTimeout(() => {
      adminsReloadTimer = null;
      loadAdmins().catch((err: unknown) => fastify.log.warn({ err }, 'Failed to reload admins.json'));
    }, 200);
  };

  let bannedReloadTimer: NodeJS.Timeout | null = null;
  const scheduleBannedReload = () => {
    if (bannedReloadTimer) clearTimeout(bannedReloadTimer);
    bannedReloadTimer = setTimeout(() => {
      bannedReloadTimer = null;
      loadBannedIps().catch((err: unknown) => fastify.log.warn({ err }, 'Failed to reload banned-ips.json'));
    }, 200);
  };

  let adminsWatcher: fs.FSWatcher | null = null;
  let bannedWatcher: fs.FSWatcher | null = null;
  try {
    adminsWatcher = fs.watch(adminsPath, { persistent: false }, () => scheduleAdminsReload());
    adminsWatcher.on('error', (err) => {
      fastify.log.warn({ err }, 'admins.json watcher error');
    });
  } catch (err) {
    fastify.log.warn({ err }, 'failed to attach admins.json watcher');
  }
  try {
    bannedWatcher = fs.watch(bannedPath, { persistent: false }, () => scheduleBannedReload());
    bannedWatcher.on('error', (err) => {
      fastify.log.warn({ err }, 'banned-ips.json watcher error');
    });
  } catch (err) {
    fastify.log.warn({ err }, 'failed to attach banned-ips.json watcher');
  }

  fastify.addHook('onClose', () => {
    if (adminsReloadTimer) clearTimeout(adminsReloadTimer);
    if (bannedReloadTimer) clearTimeout(bannedReloadTimer);
    if (adminsWatcher) adminsWatcher.close();
    if (bannedWatcher) bannedWatcher.close();
  });

  async function writeBan(ip: string, reason: string) {
    // Dedup — no-op if already banned (prevents double-increment of ipBansTotal)
    if (bannedIps.has(ip) || bannedCidrs.includes(ip)) return;
    bannedIpsList.push({ ip, reason, bannedAt: new Date().toISOString() });
    if (ip.includes('/')) {
      bannedCidrs.push(ip);
    } else {
      bannedIps.add(ip);
    }
    try {
      await fs.promises.writeFile(bannedPath, JSON.stringify(bannedIpsList, null, 2) + '\n');
    } catch (err) {
      fastify.log.error({ err }, 'Failed to write banned-ips.json');
    }
    fastify.metrics.ipBansTotal.inc();
  }

  async function unbanIp(ip: string): Promise<boolean> {
    if (!bannedIps.has(ip) && !bannedCidrs.includes(ip)) return false;
    bannedIpsList = bannedIpsList.filter((b) => b.ip !== ip);
    bannedIps.delete(ip);
    bannedCidrs = bannedCidrs.filter((c) => c !== ip);
    try {
      await fs.promises.writeFile(bannedPath, JSON.stringify(bannedIpsList, null, 2) + '\n');
    } catch (err) {
      fastify.log.error({ err }, 'Failed to write banned-ips.json after unban');
    }
    return true;
  }

  async function recordFailedAttempt(ip: string): Promise<{ banned: boolean; cooldown: boolean; remaining: number }> {
    const failKey = `${FAIL_KEY_PREFIX}${ip}`;
    const cooldownKey = `${COOLDOWN_KEY_PREFIX}${ip}`;

    const inCooldown = await fastify.valkey.exists(cooldownKey);

    if (inCooldown) {
      await writeBan(ip, 'Repeated failed login attempts after cooldown');
      return { banned: true, cooldown: false, remaining: 0 };
    }

    const count = await fastify.valkey.incr(failKey);
    if (count === 1) {
      await fastify.valkey.expire(failKey, COOLDOWN_SECONDS);
    }

    if (count >= MAX_FAILURES) {
      fastify.metrics.authFailuresTotal.inc({ reason: 'max_failures' });
      await fastify.valkey.set(cooldownKey, '1', 'EX', COOLDOWN_SECONDS * 2);
      await fastify.valkey.del(failKey);
      return { banned: false, cooldown: true, remaining: 0 };
    }

    fastify.metrics.authFailuresTotal.inc({ reason: 'failed_attempt' });

    // Buffer auth_fail event so security_events table (Panel 7) can show auth attack timelines
    const event = JSON.stringify({
      ts: Date.now(),
      ip,
      event_type: 'auth_fail',
      action: 'flagged',
      bot_score: null,
    });
    fastify.valkey.lpush('sec:events:buffer', event)
      .then(() => fastify.valkey.ltrim('sec:events:buffer', 0, 9999))
      .catch(() => {});

    return { banned: false, cooldown: false, remaining: MAX_FAILURES - count };
  }

  fastify.decorate('authGuard', {
    isAdminEmail: (email: string) => adminEmails.has(email.toLowerCase()),
    getAdminTier: (email: string) => adminEmails.get(email.toLowerCase()) ?? null,
    isBannedIp: checkIsBanned,
    recordFailedAttempt,
    banIp: writeBan,
    unbanIp,
    getBannedList: () => [...bannedIpsList],
    reloadBannedIps: loadBannedIps,
  });

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (checkIsBanned(getClientIp(request))) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    if (isPublicRoute(request.url)) {
      return;
    }

    if (!request.session?.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
}

export const authGuardPlugin = fp(authGuard, {
  name: 'auth-guard',
  dependencies: ['valkey', 'postgres', 'session', 'metrics'],
});
