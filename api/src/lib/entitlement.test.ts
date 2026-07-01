import { describe, it, expect } from 'vitest';
import {
  computeIsPro,
  downloadLimitFor,
  isProByEmail,
  isQualityAllowed,
  lookupLimitFor,
  nextUtcMidnight,
  resolveEntitlementByEmail,
  secondsUntilUtcMidnight,
  utcDayStamp,
  type Entitlement,
} from './entitlement.js';

// Free covers everyone who isn't a paying Supporter — anonymous or just signed-in.
const free: Entitlement = { identity: '1.2.3.4', email: null, loggedIn: false, isPro: false, tier: 'free' };
const pro: Entitlement = { identity: 'a@b.com', email: 'a@b.com', loggedIn: true, isPro: true, tier: 'pro' };

describe('utcDayStamp', () => {
  it('formats as YYYYMMDD in UTC', () => {
    expect(utcDayStamp(new Date('2026-06-29T23:30:00Z'))).toBe('20260629');
    expect(utcDayStamp(new Date('2026-01-05T00:00:00Z'))).toBe('20260105');
  });
  it('rolls at UTC midnight regardless of local offset', () => {
    expect(utcDayStamp(new Date('2026-06-29T23:59:59Z'))).toBe('20260629');
    expect(utcDayStamp(new Date('2026-06-30T00:00:00Z'))).toBe('20260630');
  });
});

describe('nextUtcMidnight / secondsUntilUtcMidnight', () => {
  it('returns the following UTC midnight', () => {
    expect(nextUtcMidnight(new Date('2026-06-29T10:00:00Z')).toISOString()).toBe('2026-06-30T00:00:00.000Z');
  });
  it('counts the seconds remaining in the UTC day', () => {
    expect(secondsUntilUtcMidnight(new Date('2026-06-29T23:59:00Z'))).toBe(60);
    expect(secondsUntilUtcMidnight(new Date('2026-06-29T00:00:00Z'))).toBe(86400);
  });
});

describe('limit selection', () => {
  it('scales lookups by paid status', () => {
    expect(lookupLimitFor(free)).toBe(25);
    expect(lookupLimitFor(pro)).toBe(500);
  });
  it('scales downloads by paid status', () => {
    expect(downloadLimitFor(free)).toBe(3);
    expect(downloadLimitFor(pro)).toBe(100);
  });
});

describe('isQualityAllowed', () => {
  it('lets everyone fetch audio and up to 720p', () => {
    for (const q of ['audio', '360', '480', '720']) expect(isQualityAllowed(false, q)).toBe(true);
  });
  it('reserves 1080p/1440p/2160p for Supporters', () => {
    for (const q of ['1080', '1440', '2160']) {
      expect(isQualityAllowed(false, q)).toBe(false);
      expect(isQualityAllowed(true, q)).toBe(true);
    }
  });
});

describe('computeIsPro', () => {
  const now = new Date('2026-06-29T12:00:00Z');
  const future = '2026-07-29T12:00:00Z';
  const past = '2026-06-28T12:00:00Z';
  it('is false with no subscription row', () => {
    expect(computeIsPro(null, now)).toBe(false);
  });
  it('is true for an active sub within the period', () => {
    expect(computeIsPro({ plan: 'pro', status: 'active', current_period_end: future }, now)).toBe(true);
  });
  it('keeps Pro while past_due (Stripe dunning) until the period ends', () => {
    expect(computeIsPro({ plan: 'pro', status: 'past_due', current_period_end: future }, now)).toBe(true);
  });
  it('is false once the period has ended', () => {
    expect(computeIsPro({ plan: 'pro', status: 'active', current_period_end: past }, now)).toBe(false);
  });
  it('is false when canceled or still on the free plan', () => {
    expect(computeIsPro({ plan: 'free', status: 'active', current_period_end: future }, now)).toBe(false);
    expect(computeIsPro({ plan: 'pro', status: 'canceled', current_period_end: future }, now)).toBe(false);
  });
});

describe('resolveEntitlementByEmail', () => {
  type FakeOpts = { cached?: string | null; row?: Record<string, unknown> | null };
  function fakeFastify(opts: FakeOpts) {
    return {
      valkey: {
        get: async () => opts.cached ?? null,
        set: async () => 'OK',
      },
      pg: { query: async () => ({ rows: opts.row ? [opts.row] : [] }) },
      log: { warn: () => {} },
    } as unknown as Parameters<typeof resolveEntitlementByEmail>[0];
  }

  it('returns pro from a cache hit without the db, lower-casing the email', async () => {
    const ent = await resolveEntitlementByEmail(fakeFastify({ cached: 'pro' }), 'A@B.com');
    expect(ent.isPro).toBe(true);
    expect(ent.tier).toBe('pro');
    expect(ent.identity).toBe('a@b.com');
    expect(ent.email).toBe('a@b.com');
    expect(ent.loggedIn).toBe(true);
  });

  it('reads the db on a cache miss and computes pro from an active row', async () => {
    const ent = await resolveEntitlementByEmail(
      fakeFastify({
        cached: null,
        row: { plan: 'pro', status: 'active', current_period_end: '2999-01-01T00:00:00Z' },
      }),
      'x@y.com',
    );
    expect(ent.isPro).toBe(true);
  });

  it('fails open to free when there is no subscription row', async () => {
    const ent = await resolveEntitlementByEmail(fakeFastify({ cached: null, row: null }), 'z@z.com');
    expect(ent.isPro).toBe(false);
    expect(ent.tier).toBe('free');
    expect(ent.loggedIn).toBe(true);
  });
});

describe('isProByEmail', () => {
  function fake(opts: { cached?: string | null; row?: Record<string, unknown> | null; throws?: boolean }) {
    return {
      valkey: {
        get: async () => {
          if (opts.throws) throw new Error('valkey down');
          return opts.cached ?? null;
        },
        set: async () => 'OK',
      },
      pg: { query: async () => ({ rows: opts.row ? [opts.row] : [] }) },
      log: { warn: () => {} },
    } as unknown as Parameters<typeof isProByEmail>[0];
  }

  it('returns true/false when the lookup succeeds', async () => {
    expect(await isProByEmail(fake({ cached: "pro" }), "a@b.com")).toBe(true);
    expect(await isProByEmail(fake({ cached: "free" }), "a@b.com")).toBe(false);
    expect(await isProByEmail(fake({ cached: null, row: null }), "a@b.com")).toBe(false);
  });

  it('returns null (not false) when the lookup errors, so callers can avoid failing open', async () => {
    expect(await isProByEmail(fake({ throws: true }), "a@b.com")).toBeNull();
  });
});
