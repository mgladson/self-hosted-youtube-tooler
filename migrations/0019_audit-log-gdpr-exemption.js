/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_audit_log_update()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Allow GDPR PII anonymization: only user_email, user_name, summary,
      -- new_state, and previous_state may change. All compliance-critical
      -- fields (hash, action, resource_type, resource_id, ip_address,
      -- created_at) must remain identical.
      IF NEW.hash = OLD.hash
         AND NEW.action = OLD.action
         AND NEW.resource_type = OLD.resource_type
         AND NEW.resource_id IS NOT DISTINCT FROM OLD.resource_id
         AND NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address
         AND NEW.created_at = OLD.created_at THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'audit_logs are append-only and cannot be updated (SOX / PCI Req 10.3)';
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_audit_log_update()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'audit_logs are append-only and cannot be updated (SOX / PCI Req 10.3)';
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);
};
