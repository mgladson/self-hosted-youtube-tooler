/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_hash_chain
      ON audit_logs (resource_type, id DESC) INCLUDE (hash);
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_audit_logs_hash_chain;`);
};
