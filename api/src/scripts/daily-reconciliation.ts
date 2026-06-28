/*
 * PAY-2 — Scheduled daily reconciliation between Stripe and the orders table
 * ----------------------------------------------------------------------------
 * Stripe is the system-of-record for money movement (see docs/COMPLIANCE.md
 * "Payment processing model"). The orders table is a derived projection. This
 * job reconciles the two daily and flags drift into compliance_review_queue.
 *
 * THIS IS A STUB. Wiring (Fastify bootstrap, lock, alerting) is deferred.
 *
 * Cron sidecar example (in docker-compose.yml or k8s CronJob):
 *   recon:
 *     image: shopify-stack-api:latest
 *     command: ["node", "dist/scripts/daily-reconciliation.js"]
 *     # cron: 0 3 * * *
 */

// TODO: Replace with the real bootstrap once an implementation is approved.
//
// import { buildApp } from '../index.js';
//
// async function main() {
//   const app = await buildApp();
//   try {
//     const got = await app.valkey.set('pay:recon:lock', '1', 'EX', 3600, 'NX');
//     if (!got) {
//       app.log.info('reconciliation already running');
//       return;
//     }
//
//     // 1. Pull yesterday's Stripe charges (paginated).
//     const charges: Array<{ id: string; payment_intent: string; amount: number; status: string; created: number }> = [];
//     // ... stripe.charges.list({ created: { gte, lte }, limit: 100, starting_after }) ...
//
//     // 2. Pull the same window from orders.
//     const orderRes = await app.pg.query<{
//       id: string; stripe_payment_intent_id: string; status: string; total: number; created_at: string;
//     }>(
//       `SELECT id, stripe_payment_intent_id, status, total, created_at FROM orders
//          WHERE created_at >= NOW() - INTERVAL '36 hours'
//          AND created_at < NOW() - INTERVAL '12 hours'
//          AND stripe_payment_intent_id IS NOT NULL`,
//     );
//
//     // 3. Persist the run + drift rows. Schema TBD; suggested columns:
//     //    reconciliation_runs (id, started_at, finished_at, charges_seen, orders_seen, drift_count)
//     //    reconciliation_drift (run_id, kind, stripe_id, order_id, expected, actual, details)
//
//     // 4. For every drift row, insert a compliance_review_queue entry of
//     //    trigger_type='reconciliation_drift' so it gets human review.
//
//     // 5. Page on-call if drift_count exceeds threshold (e.g. >5 / day).
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
