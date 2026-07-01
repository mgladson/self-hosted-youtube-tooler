/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  // Live credit balance per account (the API's billing unit). Postgres is the source
  // of truth; the balance is mutated atomically so a debit can never oversell.
  pgm.createTable('credit_accounts', {
    email:      { type: 'varchar(255)', primaryKey: true },
    balance:    { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  // Defence in depth: the atomic debit (UPDATE ... WHERE balance >= cost) already
  // prevents a negative balance; this makes it impossible even via a stray write.
  pgm.addConstraint('credit_accounts', 'credit_accounts_balance_nonneg', 'CHECK (balance >= 0)');

  // Append-only history of every balance change (welcome grant, top-up, per-call debit)
  // for audit + the account page. `delta` is positive for grants, negative for debits;
  // `balance_after` is the resulting balance; `ref` is informational (videoId, Stripe
  // session id) and not unique — grant idempotency comes from the webhook dedup key.
  pgm.createTable('credit_ledger', {
    id:            { type: 'bigserial', primaryKey: true },
    email:         { type: 'varchar(255)', notNull: true },
    delta:         { type: 'integer', notNull: true },
    reason:        { type: 'varchar(40)', notNull: true },
    balance_after: { type: 'integer', notNull: true },
    ref:           { type: 'varchar(120)' },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('credit_ledger', ['email', 'created_at']);

  // Idempotent top-ups: at most one 'topup' ledger row per external reference (a Stripe
  // checkout session id), so a retried webhook can never grant a paid credit pack twice.
  // Partial, so it does not constrain debit/refund rows that legitimately reuse a ref.
  pgm.createIndex('credit_ledger', 'ref', { unique: true, where: "reason = 'topup'" });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('credit_ledger');
  pgm.dropTable('credit_accounts');
};
