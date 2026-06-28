import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';
import { meetsMinTier } from '../plugins/auth-guard.js';

export async function reconciliationRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/admin/reconciliation?date=YYYY-MM-DD
   *
   * Compares paid orders in the DB against PaymentIntents that succeeded in Stripe
   * for a given calendar day (UTC). Returns a structured discrepancy report.
   *
   * Run daily — ideally as a scheduled job hitting this endpoint, or via admin UI.
   * All discrepancies must be investigated; unresolved mismatches may indicate fraud.
   */
  fastify.get<{ Querystring: { date?: string } }>(
    '/api/admin/reconciliation',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'admin')) {
        return reply.status(403).send({ error: 'Admin only' });
      }

      if (!fastify.stripe) {
        return reply.status(503).send({ error: 'Stripe not configured' });
      }

      const dateStr = request.query.date ?? new Date().toISOString().split('T')[0];
      const date = new Date(dateStr + 'T00:00:00.000Z');
      if (isNaN(date.getTime())) {
        return reply.status(400).send({ error: 'Invalid date — expected YYYY-MM-DD' });
      }

      const startTs = Math.floor(date.getTime() / 1000);
      const endTs = startTs + 86400 - 1;

      // Our paid orders for the day
      const ordersRes = await fastify.pg.query<{
        id: string;
        stripe_payment_intent_id: string | null;
        total: number;
        email: string;
        order_number: string;
      }>(
        `SELECT id, stripe_payment_intent_id, total, email, order_number
         FROM orders
         WHERE payment_status = 'paid'
           AND created_at >= $1 AND created_at < $2`,
        [new Date(startTs * 1000), new Date((endTs + 1) * 1000)],
      );

      const ourOrders = new Map(
        ordersRes.rows
          .filter((r) => r.stripe_payment_intent_id)
          .map((r) => [r.stripe_payment_intent_id!, r]),
      );
      const ordersWithoutPi = ordersRes.rows.filter((r) => !r.stripe_payment_intent_id);

      const MAX_PI_ITERATIONS = 5000;
      const allPIs: Array<{ id: string; amount: number; status: string; metadata: Record<string, string> }> = [];
      let piIterations = 0;
      for await (const pi of fastify.stripe.paymentIntents.list({
        created: { gte: startTs, lte: endTs },
        limit: 100,
      })) {
        if (++piIterations > MAX_PI_ITERATIONS) {
          fastify.log.warn({ date: dateStr, count: piIterations }, 'Reconciliation: Stripe pagination safety limit reached');
          break;
        }
        if (pi.status === 'succeeded') {
          allPIs.push({ id: pi.id, amount: pi.amount, status: pi.status, metadata: pi.metadata as Record<string, string> });
        }
      }
      const stripeSucceeded = new Map(
        allPIs.map((pi) => [pi.id, pi]),
      );

      type Discrepancy = {
        type: string;
        piId?: string;
        orderId?: string;
        orderNumber?: string;
        detail: string;
      };

      const discrepancies: Discrepancy[] = [];

      // PI succeeded in Stripe but missing from our paid orders
      for (const [piId, pi] of stripeSucceeded) {
        if (!ourOrders.has(piId)) {
          discrepancies.push({
            type: 'missing_in_db',
            piId,
            detail: `PI ${piId} (amount ${pi.amount} cents) succeeded in Stripe but not found in paid orders`,
          });
        }
      }

      // Our paid orders that don't match a succeeded PI in Stripe
      for (const [piId, order] of ourOrders) {
        if (!stripeSucceeded.has(piId)) {
          discrepancies.push({
            type: 'pi_not_succeeded',
            piId,
            orderId: order.id,
            orderNumber: order.order_number,
            detail: `Order ${order.order_number} is marked paid but PI ${piId} not found in Stripe succeeded list`,
          });
        } else {
          const stripeAmount = stripeSucceeded.get(piId)!.amount;
          if (stripeAmount !== order.total) {
            discrepancies.push({
              type: 'amount_mismatch',
              piId,
              orderId: order.id,
              orderNumber: order.order_number,
              detail: `Amount mismatch: DB has ${order.total} cents, Stripe has ${stripeAmount} cents`,
            });
          }
        }
      }

      // Paid orders with no Stripe reference at all
      for (const order of ordersWithoutPi) {
        discrepancies.push({
          type: 'no_stripe_reference',
          orderId: order.id,
          orderNumber: order.order_number,
          detail: `Order ${order.order_number} is marked paid but has no stripe_payment_intent_id`,
        });
      }

      try {
        await writeAuditLog(fastify, {
          userEmail: user.email,
          userName: user.name || user.email,
          action: 'create',
          resourceType: 'reconciliation',
          summary: `Reconciliation for ${dateStr}: ${discrepancies.length} discrepancies found`,
          ip: getClientIp(request),
          newState: {
            date: dateStr,
            discrepancyCount: discrepancies.length,
            status: discrepancies.length === 0 ? 'CLEAN' : 'DISCREPANCIES_FOUND',
            discrepancies: discrepancies.slice(0, 50),
          },
        });
      } catch (err) {
        fastify.log.error({ err }, 'CRITICAL: Failed to write reconciliation audit log');
      }

      return reply.send({
        date: dateStr,
        generatedAt: new Date().toISOString(),
        summary: {
          dbPaidOrders: ordersRes.rows.length,
          stripeSucceededPIs: stripeSucceeded.size,
          discrepancyCount: discrepancies.length,
        },
        discrepancies,
        status: discrepancies.length === 0 ? 'CLEAN' : 'DISCREPANCIES_FOUND',
      });
    },
  );
}
