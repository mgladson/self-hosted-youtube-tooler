/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable('consent_records', {
    id: { type: 'serial', primaryKey: true },
    anonymous_id: { type: 'varchar(64)', notNull: true },
    analytics: { type: 'boolean', notNull: true, default: false },
    marketing: { type: 'boolean', notNull: true, default: false },
    ip_address: { type: 'varchar(45)' },
    user_agent: { type: 'varchar(500)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('consent_records', 'anonymous_id', { name: 'idx_consent_records_anonymous_id' });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('consent_records');
};
