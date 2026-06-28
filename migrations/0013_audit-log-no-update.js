/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_audit_log_update()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'audit_logs are append-only and cannot be updated (SOX / PCI Req 10.3)';
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER audit_logs_no_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (_pgm) => {
  // Intentional no-op — audit log immutability protections cannot be safely reversed in
  // a production environment. Rolling back this migration is a compliance violation.
};
