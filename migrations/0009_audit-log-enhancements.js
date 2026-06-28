/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  // State snapshots for SOX change tracking — required for financial audit trail.
  // previous_state / new_state capture the before/after of any resource mutation.
  pgm.addColumn('audit_logs', {
    previous_state: { type: 'jsonb', notNull: false },
    new_state: { type: 'jsonb', notNull: false },
    // SHA-256 hash over (previous_hash | userEmail | action | resourceType | summary).
    // Hash-chaining detects retroactive tampering — a changed record breaks the chain.
    hash: { type: 'varchar(64)', notNull: false },
  });

  // Prevent row deletion — audit logs are append-only (SOX / PCI Req 10.3).
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'audit_logs are append-only and cannot be deleted (SOX / PCI Req 10.3)';
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER audit_logs_no_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_delete();
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (_pgm) => {
  // Intentional no-op — audit log immutability protections cannot be safely reversed in
  // a production environment. Rolling back this migration is a compliance violation.
  // If columns need removal, do so via a new forward migration with appropriate approval.
};
