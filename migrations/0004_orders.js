/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable('orders', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    order_number: {
      type: 'varchar(20)',
      notNull: true,
      unique: true,
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: "'pending'",
    },
    payment_status: {
      type: 'varchar(20)',
      notNull: true,
      default: "'pending'",
    },
    stripe_payment_intent_id: {
      type: 'varchar(255)',
    },
    total: {
      type: 'integer',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createTable('order_items', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      references: '"orders"',
      onDelete: 'CASCADE',
    },
    product_id: {
      type: 'varchar(50)',
      notNull: true,
    },
    product_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    price: {
      type: 'integer',
      notNull: true,
    },
    quantity: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
  });

  pgm.createIndex('orders', 'email');
  pgm.createIndex('orders', 'status');
  pgm.createIndex('orders', 'stripe_payment_intent_id');
  pgm.createIndex('orders', 'created_at');
  pgm.createIndex('order_items', 'order_id');
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('order_items');
  pgm.dropTable('orders');
};
