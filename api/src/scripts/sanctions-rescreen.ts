/*
 * AML-2 — Re-screen historical orders against the current sanctions blocklist
 * ----------------------------------------------------------------------------
 * Runs nightly (or on-demand after an OFAC SDN update). Matches every order
 * placed in the last N days against the in-memory blocklist; any hit produces
 * a compliance_review_queue entry of trigger_type='sanctions_rescreen_hit' so
 * compliance staff can determine whether a SAR is required.
 *
 * THIS IS A STUB. The wiring (Fastify bootstrap, valkey lock, exit code) is
 * deliberately omitted — see docs/COMPLIANCE.md before implementing.
 */

// TODO: Replace with the real bootstrap once an implementation is approved.
//
// import { buildApp } from '../index.js';
//
// async function main() {
//   const app = await buildApp();
//   try {
//     // Acquire a Valkey advisory lock so concurrent cron invocations don't
//     // double-enqueue. Lock TTL = 30m, key = 'aml:rescreen:lock'.
//     const got = await app.valkey.set('aml:rescreen:lock', '1', 'EX', 1800, 'NX');
//     if (!got) {
//       app.log.info('rescreen already running');
//       return;
//     }
//
//     // Re-screen window: 30 days catches recent designations that may apply to
//     // already-fulfilled orders within the chargeback / SAR review window.
//     const res = await app.pg.query<{ id: string; email: string; created_at: string }>(
//       `SELECT id, email, created_at FROM orders
//          WHERE created_at > NOW() - INTERVAL '30 days'
//          AND status IN ('paid', 'pending')
//          ORDER BY created_at DESC`,
//     );
//
//     for (const order of res.rows) {
//       if (app.sanctions.isBlocked(order.email)) {
//         await app.pg.query(
//           `INSERT INTO compliance_review_queue (trigger_type, email, details)
//            VALUES ($1, $2, $3)`,
//           [
//             'sanctions_rescreen_hit',
//             order.email,
//             JSON.stringify({ orderId: order.id, orderCreatedAt: order.created_at }),
//           ],
//         );
//         app.log.warn({ orderId: order.id }, 'AML: Historical order matched current sanctions list');
//       }
//     }
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
