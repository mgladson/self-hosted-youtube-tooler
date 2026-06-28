/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable('analytics_events', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    session_id: {
      type: 'uuid',
      notNull: true,
    },
    event_type: {
      type: 'varchar(30)',
      notNull: true,
    },
    page_path: {
      type: 'varchar(500)',
      notNull: true,
    },
    page_type: {
      type: 'varchar(30)',
    },
    event_data: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    event_timestamp: {
      type: 'timestamptz',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('analytics_events', ['event_type', 'event_timestamp']);
  pgm.createIndex('analytics_events', 'session_id');
  pgm.createIndex('analytics_events', 'page_type');
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('analytics_events');
};
