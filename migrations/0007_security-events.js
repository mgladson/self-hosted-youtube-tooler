/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE security_events (
      id         BIGSERIAL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip         TEXT NOT NULL,
      asn        TEXT,
      country    TEXT,
      event_type TEXT NOT NULL,
      endpoint   TEXT,
      user_agent TEXT,
      bot_score  NUMERIC(4,3),
      action     TEXT,
      metadata   JSONB,
      PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at)
  `);

  // Create initial monthly partitions (current + next 2 months)
  pgm.sql(`
    CREATE TABLE security_events_2026_03 PARTITION OF security_events
      FOR VALUES FROM ('2026-03-01') TO ('2026-04-01')
  `);
  pgm.sql(`
    CREATE TABLE security_events_2026_04 PARTITION OF security_events
      FOR VALUES FROM ('2026-04-01') TO ('2026-05-01')
  `);
  pgm.sql(`
    CREATE TABLE security_events_2026_05 PARTITION OF security_events
      FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
  `);

  pgm.createIndex('security_events', ['created_at'], { name: 'security_events_created_at_idx' });
  pgm.createIndex('security_events', ['ip'], { name: 'security_events_ip_idx' });
  pgm.createIndex('security_events', ['event_type'], { name: 'security_events_event_type_idx' });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS security_events CASCADE');
};
