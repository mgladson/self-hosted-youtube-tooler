/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE compliance_review_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trigger_type VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL,
      details JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolved_by VARCHAR(255)
    );
  `);
  pgm.sql(`
    CREATE INDEX compliance_review_queue_status_created_idx
      ON compliance_review_queue(status, created_at);
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS compliance_review_queue;`);
};
