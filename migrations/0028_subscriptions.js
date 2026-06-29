/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable('subscriptions', {
    email:                  { type: 'varchar(255)', primaryKey: true },
    stripe_customer_id:     { type: 'varchar(255)', unique: true },
    stripe_subscription_id: { type: 'varchar(255)' },
    plan:                   { type: 'varchar(20)', notNull: true, default: "'free'" },
    status:                 { type: 'varchar(20)' },
    current_period_end:     { type: 'timestamptz' },
    last_event_at:          { type: 'timestamptz' },
    created_at:             { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:             { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('subscriptions');
};
