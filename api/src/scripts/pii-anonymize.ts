/*
 * PCI-1 — PII retention / anonymization sweep
 * --------------------------------------------
 * After the chargeback window closes (18 months from order creation; see
 * docs/COMPLIANCE.md "Retention policy") customer PII on completed orders is
 * no longer needed for chargeback evidence and must be anonymized to honour
 * data-minimization principles.
 *
 * THIS IS A STUB. The wiring is deferred. The SQL below is the policy.
 */

// TODO: Replace with the real bootstrap once an implementation is approved.
//
// import { buildApp } from '../index.js';
//
// async function main() {
//   const app = await buildApp();
//   try {
//     // 1. Anonymize order PII outside the 18-month chargeback window.
//     await app.pg.query(`
//       UPDATE orders
//       SET email             = 'anonymized-' || encode(digest(email, 'sha256'), 'hex')
//                                || '@anonymized.local',
//           user_agent        = NULL,
//           billing_country   = NULL,
//           billing_state     = NULL,
//           billing_postal_code = NULL,
//           updated_at        = NOW()
//       WHERE created_at < NOW() - INTERVAL '18 months'
//         AND email NOT LIKE 'anonymized-%@anonymized.local'
//         AND email NOT LIKE 'deleted-%@anonymized.local'
//     `);
//
//     // 2. Drop ticket message bodies older than the support retention window
//     //    (12 months) but keep the row + ticket_id for SOX auditability.
//     await app.pg.query(`
//       UPDATE ticket_messages
//       SET body = '[redacted — retention policy]'
//       WHERE created_at < NOW() - INTERVAL '12 months'
//         AND body <> '[redacted — retention policy]'
//     `);
//
//     // 3. Analytics events older than 13 months are deleted entirely
//     //    (anonymous_id only, no PII, but no business value beyond a year).
//     await app.pg.query(`
//       DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '13 months'
//     `);
//   } finally {
//     await app.close();
//   }
// }
//
// main().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });

export {};
