/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addConstraint('orders', 'orders_total_positive', {
    check: 'total >= 50',
  });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropConstraint('orders', 'orders_total_positive');
};
