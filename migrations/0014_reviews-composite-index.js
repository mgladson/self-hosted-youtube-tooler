/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createIndex('reviews', ['product_id', 'status', { name: 'created_at', sort: 'DESC' }], {
    name: 'idx_reviews_product_status_created',
  });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropIndex('reviews', [], { name: 'idx_reviews_product_status_created' });
};
