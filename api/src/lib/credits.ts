// Credit accounting for the public API. Postgres is authoritative: the balance lives
// in `credit_accounts` and is mutated atomically, with every change appended to
// `credit_ledger`. A debit is a single `UPDATE ... WHERE balance >= cost` so it is
// race-free (concurrent requests can never drive the balance negative).

import type { FastifyInstance } from 'fastify';

// New accounts get a one-time welcome grant so a developer can try the API before
// buying credits (mirrors the competitor's free testing tier).
export const WELCOME_CREDITS = 100;

// Flat cost for a metadata/transcript/formats/thumbnails/video lookup.
export const LOOKUP_COST = 1;

// Downloads cost more than a lookup because they pull the media through the proxy
// (real egress), scaled by resolution. Audio + SD are cheapest; 4K is the priciest.
export function downloadCost(quality: string): number {
  switch (quality) {
    case 'audio':
    case '360':
    case '480':
    case '720':
      return 2;
    case '1080':
      return 4;
    case '1440':
    case '2160':
      return 8;
    default:
      return 2;
  }
}

export type LedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  balance_after: number;
  ref: string | null;
  created_at: string;
};

export type ChargeResult = { ok: boolean; balance: number };

/** Current credit balance for an account (0 when no account row exists yet). */
export async function getBalance(fastify: FastifyInstance, email: string): Promise<number> {
  const res = await fastify.pg.query<{ balance: number }>(
    `SELECT balance FROM credit_accounts WHERE email = $1`,
    [email],
  );
  return res.rows[0]?.balance ?? 0;
}

/** Debit `cost` credits atomically, appending a ledger row in the same transaction.
 *  Returns { ok:false } (and writes nothing) when the balance can't cover the cost —
 *  the `WHERE balance >= cost` guard makes the check-and-debit a single race-free step. */
export async function charge(
  fastify: FastifyInstance,
  email: string,
  cost: number,
  reason: string,
  ref: string | null = null,
): Promise<ChargeResult> {
  const client = await fastify.pg.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query<{ balance: number }>(
      `UPDATE credit_accounts SET balance = balance - $2, updated_at = NOW()
       WHERE email = $1 AND balance >= $2
       RETURNING balance`,
      [email, cost],
    );
    if ((upd.rowCount ?? 0) === 0) {
      const cur = await client.query<{ balance: number }>(
        `SELECT balance FROM credit_accounts WHERE email = $1`,
        [email],
      );
      await client.query('ROLLBACK');
      return { ok: false, balance: cur.rows[0]?.balance ?? 0 };
    }
    const balance = upd.rows[0].balance;
    await client.query(
      `INSERT INTO credit_ledger (email, delta, reason, balance_after, ref)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, -cost, reason, balance, ref],
    );
    await client.query('COMMIT');
    return { ok: true, balance };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Add `amount` credits (top-up / manual adjustment) and record it in the ledger.
 *  Idempotency for Stripe top-ups is provided by the webhook's own dedup key, so this
 *  simply applies the grant. Returns the new balance. */
export async function grant(
  fastify: FastifyInstance,
  email: string,
  amount: number,
  reason: string,
  ref: string | null = null,
): Promise<number> {
  const client = await fastify.pg.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query<{ balance: number }>(
      `INSERT INTO credit_accounts (email, balance) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE
         SET balance = credit_accounts.balance + $2, updated_at = NOW()
       RETURNING balance`,
      [email, amount],
    );
    const balance = upd.rows[0].balance;
    await client.query(
      `INSERT INTO credit_ledger (email, delta, reason, balance_after, ref)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, amount, reason, balance, ref],
    );
    await client.query('COMMIT');
    return balance;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Idempotently apply a paid credit top-up, keyed by an external `ref` (the Stripe
 *  checkout session id). A retried webhook delivering the same session is a no-op: the
 *  partial unique index on ('topup', ref) rejects the second ledger row, and we roll
 *  back the balance bump. Returns whether this call actually applied the credits. */
export async function grantTopup(
  fastify: FastifyInstance,
  email: string,
  amount: number,
  ref: string,
): Promise<{ balance: number; applied: boolean }> {
  const client = await fastify.pg.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query<{ balance: number }>(
      `INSERT INTO credit_accounts (email, balance) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE
         SET balance = credit_accounts.balance + $2, updated_at = NOW()
       RETURNING balance`,
      [email, amount],
    );
    const balance = upd.rows[0].balance;
    const led = await client.query(
      `INSERT INTO credit_ledger (email, delta, reason, balance_after, ref)
       VALUES ($1, $2, 'topup', $3, $4)
       ON CONFLICT (ref) WHERE reason = 'topup' DO NOTHING`,
      [email, amount, balance, ref],
    );
    if ((led.rowCount ?? 0) === 0) {
      // Already granted for this ref (retry) — undo the balance bump.
      await client.query('ROLLBACK');
      return { balance: await getBalance(fastify, email), applied: false };
    }
    await client.query('COMMIT');
    return { balance, applied: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Create the account with a one-time welcome grant on first use. Idempotent: the
 *  welcome credits + ledger row are written only when this call actually creates the
 *  row (ON CONFLICT DO NOTHING), so calling it on every key-create never double-grants.
 *  Best-effort — a failure here must not block key creation. */
export async function ensureAccountWithWelcomeGrant(
  fastify: FastifyInstance,
  email: string,
): Promise<void> {
  const client = await fastify.pg.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query<{ balance: number }>(
      `INSERT INTO credit_accounts (email, balance) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING balance`,
      [email, WELCOME_CREDITS],
    );
    if ((ins.rowCount ?? 0) > 0) {
      await client.query(
        `INSERT INTO credit_ledger (email, delta, reason, balance_after, ref)
         VALUES ($1, $2, 'welcome', $2, NULL)`,
        [email, WELCOME_CREDITS],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    fastify.log.warn({ err }, 'welcome grant failed');
  } finally {
    client.release();
  }
}

/** Most recent ledger entries for the account page. */
export async function recentLedger(
  fastify: FastifyInstance,
  email: string,
  limit = 20,
): Promise<LedgerEntry[]> {
  const res = await fastify.pg.query<LedgerEntry>(
    `SELECT id, delta, reason, balance_after, ref, created_at
     FROM credit_ledger WHERE email = $1
     ORDER BY created_at DESC, id DESC LIMIT $2`,
    [email, limit],
  );
  return res.rows;
}
