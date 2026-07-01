/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  // Developer API keys. Each row belongs to a customer (email) and stores only the
  // sha256 of the secret — never the secret itself, which is shown once at creation.
  // gen_random_uuid() comes from pgcrypto (enabled in migration 0001).
  pgm.createTable('api_keys', {
    id:           { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email:        { type: 'varchar(255)', notNull: true },
    name:         { type: 'varchar(80)' }, // optional user label ("production", "cli")
    key_prefix:   { type: 'varchar(24)', notNull: true }, // display-only, e.g. "sk_live_a1b2c3"
    key_hash:     { type: 'varchar(64)', notNull: true, unique: true }, // sha256 hex of the full secret
    last_used_at: { type: 'timestamptz' },
    revoked_at:   { type: 'timestamptz' },
    created_at:   { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // The account page lists a subscriber's active keys; auth lookups also skip revoked
  // rows. A partial index on the live keys per owner serves both. (key_hash already has
  // a unique index from the column constraint, which the per-request lookup uses.)
  pgm.createIndex('api_keys', 'email', { where: 'revoked_at IS NULL' });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('api_keys');
};
