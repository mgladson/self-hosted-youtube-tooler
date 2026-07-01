// Developer API keys. A key is a random secret shown to the user exactly once at
// creation; we persist only its sha256 hash plus a short display prefix, so a leaked
// database never reveals a usable key. On each API request the presented bearer token
// is hashed and matched against the stored hash (an indexed, constant-work lookup).

import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const KEY_PREFIX = 'sk_live_';
const KEY_RANDOM_BYTES = 24; // 24 bytes -> 32 base64url chars of entropy

export type ApiKeyRow = {
  id: string;
  email: string;
  name: string | null;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type NewApiKey = { row: ApiKeyRow; secret: string };

/** A fresh secret: `sk_live_` + 32 url-safe random characters. */
export function generateSecret(): string {
  return KEY_PREFIX + crypto.randomBytes(KEY_RANDOM_BYTES).toString('base64url');
}

/** sha256 hex of the full secret — the only form we persist. */
export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/** Short, non-sensitive display prefix so a key is identifiable in the UI (e.g.
 *  "sk_live_a1b2c3") without storing the secret. */
export function displayPrefix(secret: string): string {
  return secret.slice(0, KEY_PREFIX.length + 6);
}

const COLUMNS = 'id, email, name, key_prefix, last_used_at, revoked_at, created_at';

/** Create a key for `email`, returning both the persisted row and the one-time secret. */
export async function createApiKey(
  fastify: FastifyInstance,
  email: string,
  name: string | null,
): Promise<NewApiKey> {
  const secret = generateSecret();
  const res = await fastify.pg.query<ApiKeyRow>(
    `INSERT INTO api_keys (email, name, key_prefix, key_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNS}`,
    [email, name, displayPrefix(secret), hashSecret(secret)],
  );
  return { row: res.rows[0], secret };
}

/** All of a subscriber's keys (active and revoked), newest first. */
export async function listApiKeys(fastify: FastifyInstance, email: string): Promise<ApiKeyRow[]> {
  const res = await fastify.pg.query<ApiKeyRow>(
    `SELECT ${COLUMNS} FROM api_keys WHERE email = $1 ORDER BY created_at DESC`,
    [email],
  );
  return res.rows;
}

/** Count a subscriber's active (non-revoked) keys — used to cap creation. */
export async function countActiveKeys(fastify: FastifyInstance, email: string): Promise<number> {
  const res = await fastify.pg.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM api_keys WHERE email = $1 AND revoked_at IS NULL`,
    [email],
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}

/** Revoke a key the caller owns. Returns false if it does not exist, is already
 *  revoked, or belongs to someone else (the email guard prevents cross-account revokes). */
export async function revokeApiKey(
  fastify: FastifyInstance,
  email: string,
  id: string,
): Promise<boolean> {
  const res = await fastify.pg.query(
    `UPDATE api_keys SET revoked_at = NOW()
     WHERE id = $1 AND email = $2 AND revoked_at IS NULL`,
    [id, email],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Resolve a presented bearer token to its owner, or null if unknown/revoked. */
export async function findKeyByToken(
  fastify: FastifyInstance,
  token: string,
): Promise<{ id: string; email: string } | null> {
  const res = await fastify.pg.query<{ id: string; email: string }>(
    `SELECT id, email FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hashSecret(token)],
  );
  return res.rows[0] ?? null;
}

/** Best-effort last-used stamp (fire-and-forget; never blocks or fails a request). */
export function touchLastUsed(fastify: FastifyInstance, id: string): void {
  fastify.pg
    .query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [id])
    .catch((err: unknown) => fastify.log.warn({ err }, 'api key touch failed'));
}
