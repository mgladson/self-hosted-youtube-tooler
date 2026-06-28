exports.up = (pgm) => {
  pgm.createTable('blog_posts', {
    id:                 { type: 'serial', primaryKey: true },
    title:              { type: 'varchar(500)', notNull: true },
    slug:               { type: 'varchar(500)', notNull: true, unique: true },
    excerpt:            { type: 'text' },
    content:            { type: 'text', notNull: true },
    author_name:        { type: 'varchar(255)', notNull: true },
    status:             { type: 'varchar(20)', notNull: true, default: "'draft'" },
    tags:               { type: 'text[]', default: pgm.func("'{}'") },
    featured_image_url: { type: 'varchar(1000)' },
    seo_description:    { type: 'varchar(500)' },
    published_at:       { type: 'timestamptz' },
    created_at:         { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:         { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('blog_posts', 'slug');
  pgm.createIndex('blog_posts', 'status');
  pgm.createIndex('blog_posts', ['status', 'published_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('blog_posts');
};
