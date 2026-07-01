/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  // Raw error occurrences from the API's global 5xx capture (see
  // plugins/error-logger.ts). One row per failed request; the admin "Technical"
  // tab groups these by fingerprint for triage and garbage-collects them.
  pgm.createTable('error_events', {
    id:          { type: 'bigserial', primaryKey: true },
    // sha256(method|route|code|normalized-message) — identical failures share it,
    // so the triage view can COUNT(*) / SUM(bytes) per group and rank offenders.
    fingerprint: { type: 'varchar(64)', notNull: true },
    method:      { type: 'varchar(10)', notNull: true },
    route:       { type: 'varchar(255)', notNull: true },
    status_code: { type: 'smallint', notNull: true },
    code:        { type: 'varchar(64)' }, // app error code (e.g. timeout, fetch_failed); null if none
    message:     { type: 'text', notNull: true },
    stack:       { type: 'text' },
    request_id:  { type: 'varchar(64)' },
    ip:          { type: 'varchar(64)' }, // varchar (not inet) — tolerates odd values, IPv6-safe
    user_email:  { type: 'varchar(255)' }, // set when the failing request was authenticated
    // Byte size of message+stack — powers the "largest error" sort in the tab.
    bytes:       { type: 'integer', notNull: true, default: 0 },
    context:     { type: 'jsonb' }, // sanitized request query (e.g. { url, quality })
    created_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // Grouped ranking + drill-in both scan by fingerprint; retention sweep and
  // "last 24h" summaries scan by time; the list filters by route.
  pgm.createIndex('error_events', ['fingerprint', 'created_at']);
  pgm.createIndex('error_events', 'created_at');
  pgm.createIndex('error_events', 'route');

  // Per-fingerprint triage state, kept separate from the raw events so marking a
  // group resolved/ignored survives both new occurrences and GC of old rows.
  pgm.createTable('error_groups', {
    fingerprint: { type: 'varchar(64)', primaryKey: true },
    status:      { type: 'varchar(16)', notNull: true, default: 'open' }, // open | resolved | ignored
    note:        { type: 'text' },
    updated_by:  { type: 'varchar(255)' },
    updated_at:  { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('error_groups');
  pgm.dropTable('error_events');
};
