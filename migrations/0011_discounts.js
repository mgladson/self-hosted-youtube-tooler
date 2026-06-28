exports.up = (pgm) => {
  pgm.createTable('discounts', {
    id:              { type: 'serial', primaryKey: true },
    code:            { type: 'varchar(50)', notNull: true, unique: true },
    type:            { type: 'varchar(10)', notNull: true },  // 'percentage' | 'fixed'
    value:           { type: 'integer', notNull: true },      // percent (0-100) or cents
    min_order_amount:{ type: 'integer', default: 0 },
    max_uses:        { type: 'integer' },                     // null = unlimited
    current_uses:    { type: 'integer', notNull: true, default: 0 },
    active:          { type: 'boolean', notNull: true, default: true },
    starts_at:       { type: 'timestamptz' },
    ends_at:         { type: 'timestamptz' },
    created_at:      { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:      { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('discounts', 'code');

  pgm.addColumns('orders', {
    discount_code:   { type: 'varchar(50)' },
    discount_amount: { type: 'integer', notNull: true, default: 0 },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('orders', ['discount_code', 'discount_amount']);
  pgm.dropTable('discounts');
};
