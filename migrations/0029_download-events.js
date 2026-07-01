/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable('download_events', {
    id:         { type: 'bigserial', primaryKey: true },
    email:      { type: 'varchar(255)' }, // null for anonymous (non-logged-in) downloads
    video_id:   { type: 'varchar(20)', notNull: true },
    quality:    { type: 'varchar(10)', notNull: true },
    tier:       { type: 'varchar(10)', notNull: true },
    bytes:      { type: 'bigint', notNull: true }, // 4K files exceed int4, so bigint
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // Per-subscriber download history over time (the churn join), plus global
  // time-range scans for aggregate usage.
  pgm.createIndex('download_events', ['email', 'created_at']);
  pgm.createIndex('download_events', 'created_at');
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('download_events');
};
