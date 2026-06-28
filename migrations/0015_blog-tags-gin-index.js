/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createIndex('blog_posts', 'tags', { method: 'gin', name: 'idx_blog_posts_tags' });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropIndex('blog_posts', [], { name: 'idx_blog_posts_tags' });
};
