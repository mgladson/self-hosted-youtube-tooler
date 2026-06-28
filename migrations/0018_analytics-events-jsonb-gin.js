/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createIndex('analytics_events', 'event_data', {
    name: 'idx_analytics_events_event_data_gin',
    method: 'gin',
    ifNotExists: true,
  });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropIndex('analytics_events', 'event_data', { name: 'idx_analytics_events_event_data_gin' });
};
