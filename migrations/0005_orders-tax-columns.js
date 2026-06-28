/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumns('orders', {
    tax_amount: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    tax_calculation_id: {
      type: 'varchar(255)',
    },
    billing_country: {
      type: 'varchar(2)',
    },
    billing_state: {
      type: 'varchar(10)',
    },
    billing_postal_code: {
      type: 'varchar(20)',
    },
  });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropColumns('orders', [
    'tax_amount',
    'tax_calculation_id',
    'billing_country',
    'billing_state',
    'billing_postal_code',
  ]);
};
