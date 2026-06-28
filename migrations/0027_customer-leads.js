exports.up = (pgm) => {
  pgm.createTable('customer_leads', {
    email:       { type: 'varchar(255)', primaryKey: true },
    name:        { type: 'varchar(255)', notNull: true, default: '' },
    picture:     { type: 'text' },
    first_seen:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_seen:   { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    login_count: { type: 'integer', notNull: true, default: 1 },
  });
  pgm.createIndex('customer_leads', 'last_seen');
};

exports.down = (pgm) => {
  pgm.dropTable('customer_leads');
};
