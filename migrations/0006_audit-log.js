/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable('audit_logs', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    user_email: {
      type: 'varchar(255)',
      notNull: true,
    },
    user_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    action: {
      type: 'varchar(50)',
      notNull: true,
    },
    resource_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    resource_id: {
      type: 'varchar(255)',
      notNull: false,
    },
    summary: {
      type: 'varchar(500)',
      notNull: true,
    },
    ip_address: {
      type: 'varchar(45)',
      notNull: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('audit_logs', ['created_at']);
  pgm.createIndex('audit_logs', ['user_email', 'created_at']);
  pgm.createIndex('audit_logs', ['resource_type', 'resource_id']);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (_pgm) => {
  // Intentional no-op — audit logs must be retained for regulatory compliance
  // (SOX: 7 years, PCI-DSS Req 10.7: 12 months minimum).
  // Dropping this table is a compliance violation. Do not add destructive logic here.
};
