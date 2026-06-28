import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/*
 * SOX-2 — Hash chain vs. GDPR redaction: known limitation
 * --------------------------------------------------------
 * GDPR Article 17 erasure mutates user_email / user_name / summary / new_state /
 * previous_state on existing audit_logs rows (see migration 0023). The append-only
 * trigger permits these specific columns to change while keeping `hash` immutable —
 * but that means a naive verifier that recomputes sha256(prev_hash | ts | email |
 * action | resource_type | summary) will mismatch on any row that has been
 * GDPR-redacted, even though the redaction is a lawful, audited transformation.
 *
 * TODO (full implementation deferred — see docs/COMPLIANCE.md "Redaction-aware
 * verifier" section):
 *   1. External witness service signs each row's `hash` at insert time and stores
 *      the signature off-DB (e.g. transparency log / KMS-signed receipts).
 *   2. Verifier walks the chain. When `gdpr_redacted_at IS NOT NULL`, it does not
 *      re-derive the hash from current row contents; instead it verifies the
 *      witness signature on the recorded `hash` value, which proves the row was
 *      genuine before redaction.
 *   3. Every redaction event itself produces a separate `account_deleted` audit row
 *      so the redaction is itself recorded in the chain.
 *
 * Until the witness is implemented, hash-chain verification scripts must skip rows
 * where gdpr_redacted_at IS NOT NULL and rely on the fact that the redaction
 * column-set is constrained at the trigger layer.
 */

type AuditPayload = {
  userEmail: string;
  userName: string;
  action:
    | 'update'
    | 'create'
    | 'delete'
    | 'send'
    | 'ban'
    | 'unblock'
    | 'order_created'
    | 'payment_success'
    | 'payment_failed'
    | 'refund'
    | 'account_deleted'
    | 'sanctions_block'
    | 'sanctions_add'
    | 'sanctions_remove';
  resourceType: string;
  resourceId?: string;
  summary: string;
  ip?: string;
  /** State of the resource before this action (for SOX change tracking). */
  previousState?: Record<string, unknown>;
  /** State of the resource after this action (for SOX change tracking). */
  newState?: Record<string, unknown>;
};

// Base advisory lock key for the audit log hash chain.
// We partition by resource_type so that e.g. a banner audit write does not
// block a checkout audit write. Each type gets its own lock via djb2 hash.
const AUDIT_CHAIN_LOCK_BASE = 7_432_918_500;

function hashResourceType(resourceType: string): number {
  let hash = 5381;
  for (let i = 0; i < resourceType.length; i++) {
    hash = ((hash << 5) + hash + resourceType.charCodeAt(i)) | 0;
  }
  return AUDIT_CHAIN_LOCK_BASE + Math.abs(hash % 100_000);
}

export async function writeAuditLog(fastify: FastifyInstance, payload: AuditPayload): Promise<void> {
  const client = await fastify.pg.connect();
  try {
    await client.query('BEGIN');

    // Serialise writers per resource_type: lock is held until COMMIT/ROLLBACK.
    const lockId = hashResourceType(payload.resourceType);
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

    const lastRes = await client.query<{ hash: string }>(
      'SELECT hash FROM audit_logs WHERE resource_type = $1 ORDER BY id DESC LIMIT 1',
      [payload.resourceType],
    );
    const previousHash = lastRes.rows[0]?.hash ?? 'genesis';

    // Get DB timestamp first, then compute hash, then INSERT with final values.
    // This avoids an UPDATE which is blocked by the no-update trigger (SOX).
    const tsRes = await client.query<{ now: string }>('SELECT clock_timestamp() AS now');
    const dbTimestamp = tsRes.rows[0].now;

    const chainInput = `${previousHash}|${dbTimestamp}|${payload.userEmail}|${payload.action}|${payload.resourceType}|${payload.summary}`;
    const hash = crypto.createHash('sha256').update(chainInput).digest('hex');

    await client.query(
      `INSERT INTO audit_logs
         (user_email, user_name, action, resource_type, resource_id, summary, ip_address,
          previous_state, new_state, hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        payload.userEmail,
        payload.userName,
        payload.action,
        payload.resourceType,
        payload.resourceId ?? null,
        payload.summary,
        payload.ip ?? null,
        payload.previousState ? JSON.stringify(payload.previousState) : null,
        payload.newState ? JSON.stringify(payload.newState) : null,
        hash,
        dbTimestamp,
      ],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
