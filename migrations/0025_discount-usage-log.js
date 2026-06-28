/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE discount_usage_log (
      discount_code VARCHAR(50) NOT NULL,
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      action VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (discount_code, order_id, action)
    );
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS discount_usage_log;`);
};
