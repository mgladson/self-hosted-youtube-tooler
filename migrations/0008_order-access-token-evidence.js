/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  // order_token — unforgeable access token required to view an order or download files.
  // Prevents IDOR (Insecure Direct Object Reference) on the unauthenticated order endpoint.
  // Guest customers receive this token in the PI creation response and in the confirmation email link.
  pgm.addColumn('orders', {
    order_token: {
      type: 'uuid',
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
  });
  pgm.createIndex('orders', 'order_token', { unique: true });

  // Chargeback evidence — captured at transaction time per PCI Req 12 / card network rules.
  // 3DS authentication result shifts liability to the card issuer on disputed charges.
  pgm.addColumn('orders', {
    user_agent: {
      type: 'varchar(500)',
      notNull: false,
    },
    three_ds_status: {
      type: 'varchar(50)',
      notNull: false,
    },
  });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropIndex('orders', 'order_token', { unique: true });
  pgm.dropColumn('orders', ['order_token', 'user_agent', 'three_ds_status']);
};
