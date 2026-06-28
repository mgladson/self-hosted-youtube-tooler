/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_time_on_page
      ON analytics_events (((event_data->>'time_on_page_ms')::numeric))
      WHERE event_type = 'page_exit';
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_scroll_depth
      ON analytics_events (((event_data->>'max_scroll_depth_pct')::numeric))
      WHERE event_type = 'page_exit';
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_depth_pct
      ON analytics_events (((event_data->>'depth_pct')::int))
      WHERE event_type = 'scroll_depth';
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_analytics_events_time_on_page;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_analytics_events_scroll_depth;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_analytics_events_depth_pct;`);
};
