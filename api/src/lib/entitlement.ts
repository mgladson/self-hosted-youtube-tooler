import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getClientIp } from './client-ip.js';

export type Tier = 'free' | 'pro';

export interface Entitlement {
  // The quota bucket key: lower-cased email when logged in, else the client IP.
  identity: string;
  email: string | null;
  loggedIn: boolean;
  isPro: boolean;
  tier: Tier;
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfter: number; // seconds until the bucket resets (next UTC midnight)
  resetAt: string; // ISO timestamp of the reset
}

// Daily allowances. Lookups (metadata/tags/transcript) are cheap and cached, so the
// free pools are generous; downloads are the expensive path, so they are tight and
// login-gated. Pro keeps a soft ceiling purely as abuse protection.
export const LOOKUP_LIMITS: Record<Tier, number> = { free: 25, pro: 500 };
export const DOWNLOAD_LIMITS = { free: 3, pro: 100 } as const;

// Free accounts may fetch audio and up to 720p; 1080p/1440p/2160p are Pro-only.
export const FREE_DOWNLOAD_QUALITIES = new Set(['audio', '360', '480', '720']);

// Quota buckets are keyed by UTC day and expire after 48h — the date in the key is
// the real boundary, the TTL is only cleanup.
const QUOTA_TTL_S = 60 * 60 * 48;

// The resolved plan is cached briefly; the Stripe webhooks delete this key on change.
const PLAN_CACHE_PREFIX = 'plan:';
const PLAN_CACHE_TTL_S = 60;

export function utcDayStamp(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function secondsUntilUtcMidnight(now: Date): number {
  return Math.max(1, Math.ceil((nextUtcMidnight(now).getTime() - now.getTime()) / 1000));
}

export function lookupLimitFor(ent: Entitlement): number {
  return ent.isPro ? LOOKUP_LIMITS.pro : LOOKUP_LIMITS.free;
}

export function downloadLimitFor(ent: Entitlement): number {
  return ent.isPro ? DOWNLOAD_LIMITS.pro : DOWNLOAD_LIMITS.free;
}

export function isQualityAllowed(isPro: boolean, quality: string): boolean {
  return isPro || FREE_DOWNLOAD_QUALITIES.has(quality);
}

// Pure: is this subscription row Pro right now? Access is kept through the paid
// period even while past_due (Stripe dunning), and ends at current_period_end or an
// explicit cancel (plan flipped off 'pro').
export function computeIsPro(
  row: { plan?: string | null; status?: string | null; current_period_end?: string | Date | null } | null,
  now: Date,
): boolean {
  if (!row || row.plan !== 'pro') return false;
  if (row.status !== 'active' && row.status !== 'past_due') return false;
  if (!row.current_period_end) return false;
  return now.getTime() < new Date(row.current_period_end).getTime();
}

// Resolve the caller's tier. Anonymous callers never touch the DB. For logged-in
// callers the plan is read through a short Valkey cache that the Stripe webhooks
// bust on change. Any backend failure FAILS OPEN to free — entitlement must never
// 500 the public tools.
export async function resolveEntitlement(
  fastify: FastifyInstance,
  request: FastifyRequest,
): Promise<Entitlement> {
  const email = request.session?.user?.email?.toLowerCase() || null;
  if (!email) {
    return { identity: getClientIp(request), email: null, loggedIn: false, isPro: false, tier: 'free' };
  }

  let isPro = false;
  try {
    const cacheKey = PLAN_CACHE_PREFIX + email;
    const cached = await fastify.valkey.get(cacheKey);
    if (cached !== null) {
      isPro = cached === 'pro';
    } else {
      const res = await fastify.pg.query<{
        plan: string;
        status: string | null;
        current_period_end: string | null;
      }>('SELECT plan, status, current_period_end FROM subscriptions WHERE email = $1', [email]);
      isPro = computeIsPro(res.rows[0] ?? null, new Date());
      await fastify.valkey.set(cacheKey, isPro ? 'pro' : 'free', 'EX', PLAN_CACHE_TTL_S);
    }
  } catch (err) {
    fastify.log.warn({ err }, 'entitlement lookup failed — defaulting to free');
    isPro = false;
  }

  return { identity: email, email, loggedIn: true, isPro, tier: isPro ? 'pro' : 'free' };
}

function quotaResult(allowed: boolean, used: number, limit: number, now: Date): QuotaResult {
  return {
    allowed,
    used,
    limit,
    retryAfter: secondsUntilUtcMidnight(now),
    resetAt: nextUtcMidnight(now).toISOString(),
  };
}

// Charge one lookup against the caller's daily pool, deduplicated per video: the home
// page fetches /extract and /formats in parallel for the same id, and a user may open
// several tools for one video — all of that counts once per UTC day. Invoked on a
// cache MISS only (the request that actually hits YouTube). Best-effort: a Valkey
// failure allows the request (fail open).
export async function chargeLookupQuota(
  fastify: FastifyInstance,
  ent: Entitlement,
  videoId: string,
): Promise<QuotaResult> {
  const now = new Date();
  const limit = lookupLimitFor(ent);
  const day = utcDayStamp(now);
  const markerKey = `yt:counted:${ent.identity}:${videoId}:${day}`;
  const quotaKey = `yt:quota:${ent.identity}:${day}`;
  try {
    const used = Number((await fastify.valkey.get(quotaKey)) || '0');
    const alreadyCounted = (await fastify.valkey.exists(markerKey)) === 1;
    // The only rejection is a new (not-yet-counted) video while already at the limit.
    if (!alreadyCounted && used >= limit) {
      return quotaResult(false, used, limit, now);
    }
    // Claim the video for today; only the first claimer bumps the counter, so the
    // parallel /extract + /formats pair costs a single lookup.
    const claimed = await fastify.valkey.set(markerKey, '1', 'EX', QUOTA_TTL_S, 'NX');
    if (claimed === 'OK') {
      const count = await fastify.valkey.incr(quotaKey);
      if (count === 1) await fastify.valkey.expire(quotaKey, QUOTA_TTL_S);
      return quotaResult(true, count, limit, now);
    }
    return quotaResult(true, used, limit, now);
  } catch (err) {
    fastify.log.warn({ err }, 'youtube lookup quota check failed');
    return quotaResult(true, 0, limit, now);
  }
}

// Charge one download against the caller's daily pool. Downloads are never cached and
// always count; the route guarantees the caller is logged in, so identity is the
// email. Best-effort: a Valkey failure allows the request (fail open).
export async function chargeDownloadQuota(
  fastify: FastifyInstance,
  ent: Entitlement,
): Promise<QuotaResult> {
  const now = new Date();
  const limit = downloadLimitFor(ent);
  const day = utcDayStamp(now);
  const key = `yt:dlquota:${ent.identity}:${day}`;
  try {
    const count = await fastify.valkey.incr(key);
    if (count === 1) await fastify.valkey.expire(key, QUOTA_TTL_S);
    if (count > limit) {
      return quotaResult(false, count - 1, limit, now);
    }
    return quotaResult(true, count, limit, now);
  } catch (err) {
    fastify.log.warn({ err }, 'youtube download quota check failed');
    return quotaResult(true, 0, limit, now);
  }
}

// Read-only snapshot of today's usage for the account page — never mutates the
// counters. Best-effort: a Valkey failure reports zero usage.
export async function getUsageSnapshot(
  fastify: FastifyInstance,
  ent: Entitlement,
): Promise<{ lookups: { used: number; limit: number }; downloads: { used: number; limit: number } }> {
  const day = utcDayStamp(new Date());
  let lookupsUsed = 0;
  let downloadsUsed = 0;
  try {
    const [l, d] = await Promise.all([
      fastify.valkey.get(`yt:quota:${ent.identity}:${day}`),
      fastify.valkey.get(`yt:dlquota:${ent.identity}:${day}`),
    ]);
    lookupsUsed = Number(l || '0');
    downloadsUsed = Number(d || '0');
  } catch (err) {
    fastify.log.warn({ err }, 'youtube usage snapshot failed');
  }
  return {
    lookups: { used: lookupsUsed, limit: lookupLimitFor(ent) },
    downloads: { used: downloadsUsed, limit: downloadLimitFor(ent) },
  };
}
