/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  // Multi-source downloads store a namespaced key (e.g. "vimeo:<hash>") in
  // video_id, which no longer fits the original varchar(20). Widen it.
  pgm.alterColumn('download_events', 'video_id', { type: 'varchar(64)' });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.alterColumn('download_events', 'video_id', { type: 'varchar(20)' });
};
