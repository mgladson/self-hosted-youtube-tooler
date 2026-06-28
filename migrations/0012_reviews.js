exports.up = (pgm) => {
  pgm.createTable('reviews', {
    id:          { type: 'serial', primaryKey: true },
    product_id:  { type: 'varchar(50)', notNull: true },
    email:       { type: 'varchar(255)', notNull: true },
    name:        { type: 'varchar(255)', notNull: true },
    rating:      { type: 'integer', notNull: true },       // 1-5
    body:        { type: 'text' },
    status:      { type: 'varchar(20)', notNull: true, default: pgm.func("'pending'") }, // 'pending'|'approved'|'rejected'
    created_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('reviews', 'reviews_rating_check', 'CHECK (rating >= 1 AND rating <= 5)');
  pgm.addConstraint('reviews', 'reviews_one_per_product_email', 'UNIQUE (product_id, email)');
  pgm.createIndex('reviews', 'product_id');
  pgm.createIndex('reviews', 'status');
};

exports.down = (pgm) => {
  pgm.dropTable('reviews');
};
