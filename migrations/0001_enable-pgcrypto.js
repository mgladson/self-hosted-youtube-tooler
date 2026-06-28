/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropExtension('pgcrypto', { ifExists: true });
};
