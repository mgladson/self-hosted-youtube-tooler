/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE UNIQUE INDEX orders_one_discount_per_email
      ON orders (discount_code, email)
      WHERE status != 'failed' AND discount_code IS NOT NULL;
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS orders_one_discount_per_email;`);
};
