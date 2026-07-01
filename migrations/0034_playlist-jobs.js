/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable('playlist_jobs', {
    id:               { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email:            { type: 'varchar(255)', notNull: true }, // owner; playlist is Supporter-only
    playlist_id:      { type: 'varchar(64)', notNull: true },
    playlist_url:     { type: 'text' },
    title:            { type: 'text' },
    status:           { type: 'varchar(20)', notNull: true, default: 'queued' }, // queued|running|completed|canceled|failed
    total_videos:     { type: 'integer', notNull: true, default: 0 },
    completed_videos: { type: 'integer', notNull: true, default: 0 },
    failed_videos:    { type: 'integer', notNull: true, default: 0 },
    partial_reason:   { type: 'varchar(40)' }, // e.g. quota_exhausted / not_entitled; null on a clean finish
    error:            { type: 'text' },
    last_serviced_at: { type: 'timestamptz' }, // round-robin fairness: least-recently-serviced job goes next
    created_at:       { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:       { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    started_at:       { type: 'timestamptz' },
    finished_at:      { type: 'timestamptz' },
  });
  pgm.createIndex('playlist_jobs', ['email', 'created_at']);
  pgm.createIndex('playlist_jobs', 'status'); // the worker scans queued/running

  pgm.createTable('playlist_job_items', {
    job_id:   { type: 'uuid', notNull: true, references: 'playlist_jobs', onDelete: 'CASCADE' },
    position: { type: 'integer', notNull: true }, // playlist order
    video_id: { type: 'varchar(20)', notNull: true },
    title:    { type: 'text' },
    duration: { type: 'integer' }, // seconds, from the flat enumeration
    status:   { type: 'varchar(20)', notNull: true, default: 'pending' }, // pending|done|failed|skipped
    error:    { type: 'text' },
  });
  pgm.addConstraint('playlist_job_items', 'playlist_job_items_pkey', {
    primaryKey: ['job_id', 'position'],
  });
  pgm.createIndex('playlist_job_items', 'job_id');
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('playlist_job_items');
  pgm.dropTable('playlist_jobs');
};
