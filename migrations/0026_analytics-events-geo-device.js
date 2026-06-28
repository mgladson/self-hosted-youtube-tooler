/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumns('analytics_events', {
    country_code: { type: 'char(2)' },
    device_type: { type: 'varchar(16)' },
    browser: { type: 'varchar(32)' },
    os: { type: 'varchar(32)' },
  });

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_country
      ON analytics_events (country_code, event_timestamp)
      WHERE country_code IS NOT NULL AND event_type = 'page_view';
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_device_type
      ON analytics_events (device_type, event_timestamp)
      WHERE device_type IS NOT NULL AND event_type = 'page_view';
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_browser
      ON analytics_events (browser, event_timestamp)
      WHERE browser IS NOT NULL AND event_type = 'page_view';
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_os
      ON analytics_events (os, event_timestamp)
      WHERE os IS NOT NULL AND event_type = 'page_view';
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_analytics_events_country;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_analytics_events_device_type;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_analytics_events_browser;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_analytics_events_os;`);
  pgm.dropColumns('analytics_events', ['country_code', 'device_type', 'browser', 'os']);
};
