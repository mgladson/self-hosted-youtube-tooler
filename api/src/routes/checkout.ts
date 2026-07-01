import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { validateCartItems } from '../products.js';
import { config } from '../config.js';
import { writeAuditLog } from '../lib/audit.js';
import { meetsMinTier } from '../plugins/auth-guard.js';
import { getClientIp } from '../lib/client-ip.js';
import { removeSubscriber } from './newsletter.js';
import { handleStripeSubscriptionEvent } from '../lib/subscriptions.js';
import { grantTopup } from '../lib/credits.js';

type CartItem = {
  productId: string;
  quantity: number;
};

type BillingAddress = {
  country: string;
  state?: string;
  postalCode?: string;
};

type CreatePaymentBody = {
  items: CartItem[];
  email: string;
  billingAddress?: BillingAddress;
  discountCode?: string;
};

function generateOrderNumber(): string {
  const num = crypto.randomInt(100000, 999999);
  return `PF-${num}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function checkoutRoutes(fastify: FastifyInstance) {
  const RL_KEY = 'checkout:rl:';
  const RL_MAX = 10;
  const RL_WINDOW = 60;
  const ORDER_NUMBER_RETRIES = 3;

  // AML velocity check: flag if the same email places this many orders within the window.
  // Does not block (legitimate bulk buyers exist) — flags for compliance review.
  const VELOCITY_LIMIT = 5;
  const VELOCITY_WINDOW_MINUTES = 60;

  async function checkRateLimit(ip: string): Promise<boolean> {
    const key = `${RL_KEY}${ip}`;
    const results = await fastify.valkey.multi().incr(key).expire(key, RL_WINDOW).exec();
    const count = (results?.[0]?.[1] as number) ?? 0;
    return count > RL_MAX;
  }

  // === Checkout Config (tells frontend if tax is enabled) ===
  fastify.get('/api/checkout/config', async () => ({
    taxEnabled: config.stripe.taxEnabled,
  }));

  // === Create Payment Intent ===
  fastify.post<{ Body: CreatePaymentBody }>(
    '/api/checkout/create-payment-intent',
    async (request, reply) => {
      if (!fastify.stripe) {
        return reply.status(503).send({ error: 'Payment service unavailable' });
      }

      const { items, email, billingAddress, discountCode } = request.body;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.status(400).send({ error: 'Valid email required' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return reply.status(400).send({ error: 'Cart items required' });
      }

      // Sanctions screening — checked before any order is created.
      // IMPORTANT: do not reveal to the customer that they are on a blocklist (SAR tip-off prohibition).
      if (fastify.sanctions.isBlocked(email)) {
        const maskedEmail = email.replace(/^(.)(.*)(@.*)$/, (_m: string, first: string, middle: string, domain: string) => first + '*'.repeat(middle.length) + domain);
        fastify.log.warn({ email: maskedEmail, ip: getClientIp(request) }, 'Sanctioned email blocked at checkout');
        // SOX-3 / AML: sanctions_block must be durably recorded before responding.
        // If the audit write fails we cannot prove screening occurred, so refuse the request.
        try {
          await writeAuditLog(fastify, {
            userEmail: maskedEmail,
            userName: maskedEmail,
            action: 'sanctions_block',
            resourceType: 'sanctions',
            summary: `Sanctions screening blocked checkout for ${maskedEmail}`,
            ip: getClientIp(request),
          });
        } catch (err) {
          fastify.log.error({ err }, 'CRITICAL: sanctions_block audit write failed — refusing request');
          return reply.status(503).send({ error: 'Service temporarily unavailable' });
        }
        // AML-3 / SECURITY M-2 (pass-4): Persist sanctions_block to compliance_review_queue
        // with the RAW email so compliance staff can correlate hits across attempts.
        //
        // Atomicity note: writeAuditLog manages its own transaction (audit.ts cannot accept
        // an external client per current scope), so we cannot bind this CRQ INSERT into the
        // same tx as the audit write. We use relaxed atomicity — the audit row above is
        // already durably persisted and contains the sanctions_block evidence (action,
        // userEmail=maskedEmail, ip, summary, timestamp). The CRQ row is operational queue
        // metadata for compliance triage and is recoverable from the audit row if missing.
        //
        // On CRQ INSERT failure we therefore log error and continue rather than returning
        // 503 (which would prompt Stripe/customer retry and produce a duplicate audit row
        // with no corresponding compliance benefit). Compliance evidence is preserved in
        // audit_logs regardless. Future hardening: extend writeAuditLog to accept an
        // external client param so both writes can run in one tx.
        try {
          await fastify.pg.query(
            `INSERT INTO compliance_review_queue (trigger_type, email, details)
             VALUES ($1, $2, $3)`,
            [
              'sanctions_block',
              email,
              JSON.stringify({
                ip: getClientIp(request),
                maskedEmail,
              }),
            ],
          );
        } catch (err) {
          fastify.log.error(
            { err, maskedEmail },
            'sanctions_block compliance_review_queue insert failed — audit row already persisted, continuing',
          );
        }
        return reply.status(400).send({ error: 'Unable to process this order' });
      }

      const taxEnabled = config.stripe.taxEnabled;
      if (taxEnabled) {
        if (!billingAddress || !billingAddress.country || !/^[A-Z]{2}$/.test(billingAddress.country)) {
          return reply.status(400).send({ error: 'Billing country required (2-letter code)' });
        }
        if (billingAddress.country === 'US' && (!billingAddress.state || !billingAddress.postalCode)) {
          return reply.status(400).send({ error: 'US orders require state and postal code' });
        }
      }

      if (await checkRateLimit(getClientIp(request))) {
        fastify.metrics.rateLimitHitsTotal.inc({ endpoint: '/api/checkout/create-payment-intent' });
        fastify.valkey.incr('sec:counter:429').then(() => fastify.valkey.expire('sec:counter:429', 60)).catch(() => {});
        const rlEvent = JSON.stringify({
          ts: Date.now(), ip: getClientIp(request), event_type: 'rate_limit',
          path: '/api/checkout/create-payment-intent', action: 'blocked', bot_score: null,
        });
        fastify.valkey.lpush('sec:events:buffer', rlEvent).then(() => fastify.valkey.ltrim('sec:events:buffer', 0, 9999)).catch(() => {});
        return reply.status(429).send({ error: 'Too many requests' });
      }

      const result = validateCartItems(items);
      if ('error' in result) {
        return reply.status(400).send({ error: result.error });
      }

      const { valid, total } = result;

      // AML velocity check: multiple orders from the same email in a short window may indicate
      // structuring. Flag (log + security event) without blocking to avoid false positives.
      const velocityRes = await fastify.pg.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM orders
         WHERE email = $1 AND created_at > NOW() - make_interval(mins => $2)`,
        [email, VELOCITY_WINDOW_MINUTES],
      );
      const recentOrderCount = parseInt(velocityRes.rows[0].count, 10);
      if (recentOrderCount >= VELOCITY_LIMIT) {
        const maskedEmail = email.replace(/^(.)(.*)(@.*)$/, (_m: string, first: string, middle: string, domain: string) => first + '*'.repeat(middle.length) + domain);
        fastify.log.warn(
          { email: maskedEmail, recentOrderCount, ip: getClientIp(request) },
          'High order velocity — possible structuring; flagged for compliance review',
        );
        const velocityEvent = JSON.stringify({
          ts: Date.now(), ip: getClientIp(request), event_type: 'velocity_flag',
          path: '/api/checkout/create-payment-intent', action: 'flagged',
          bot_score: null, metadata: { email: maskedEmail, recentOrderCount },
        });
        fastify.valkey.lpush('sec:events:buffer', velocityEvent)
          .then(() => fastify.valkey.ltrim('sec:events:buffer', 0, 9999))
          .catch(() => {});

        // AML-3: Persist actionable item for the compliance review queue so a human
        // can decide whether to escalate. Stores raw email (not masked) since this
        // table is privileged and limited to compliance staff for AML investigations.
        fastify.pg.query(
          `INSERT INTO compliance_review_queue (trigger_type, email, details)
           VALUES ($1, $2, $3)`,
          [
            'velocity_flag',
            email,
            JSON.stringify({
              recentOrderCount,
              windowMinutes: VELOCITY_WINDOW_MINUTES,
              ip: getClientIp(request),
              maskedEmail,
            }),
          ],
        ).catch((err) => fastify.log.error({ err }, 'Failed to enqueue compliance_review_queue row'));
      }

      // Tax calculation (when enabled) — runs before the transaction since it calls Stripe
      let taxAmount = 0;
      let taxCalculationId: string | null = null;
      if (taxEnabled && billingAddress) {
        try {
          const calc = await fastify.stripe.tax.calculations.create({
            currency: 'usd',
            line_items: valid.map((p) => ({
              amount: p.price,
              tax_code: 'txcd_10201000',
              reference: p.id,
            })),
            customer_details: {
              address: {
                country: billingAddress.country,
                state: billingAddress.state || undefined,
                postal_code: billingAddress.postalCode || undefined,
              },
              address_source: 'billing',
            },
          });
          taxAmount = calc.tax_amount_exclusive;
          taxCalculationId = calc.id;
        } catch (err) {
          fastify.log.error({ err }, 'Stripe Tax Calculation failed');
          return reply.status(502).send({ error: 'Tax calculation failed — please try again' });
        }
      }

      // Capture user-agent at transaction time for chargeback evidence (card network requirement).
      const userAgent = (request.headers['user-agent'] || '').slice(0, 500) || null;

      let discountAmount = 0;
      let resolvedDiscountCode: string | null = null;
      let orderId!: string;
      let orderToken!: string;
      let orderNumber!: string;
      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');

        // Discount validation inside the transaction with FOR UPDATE to prevent TOCTOU races.
        // Sequence: lock discount row → validate → INSERT order → UPDATE uses → COMMIT.
        if (discountCode) {
          const discountRes = await client.query<{
            id: number;
            code: string;
            type: 'percentage' | 'fixed';
            value: number;
            min_order_amount: number;
            max_uses: number | null;
            current_uses: number;
            active: boolean;
            starts_at: string | null;
            ends_at: string | null;
          }>(
            `SELECT * FROM discounts
             WHERE UPPER(code) = UPPER($1)
               AND active = true
               AND (starts_at IS NULL OR starts_at <= NOW())
               AND (ends_at IS NULL OR ends_at >= NOW())
             FOR UPDATE`,
            [discountCode.trim()],
          );
          const discount = discountRes.rows[0];

          if (!discount) {
            await client.query('ROLLBACK');
            client.release();
            return reply.status(400).send({ error: 'Invalid or expired discount code' });
          }

          if (discount.max_uses !== null && discount.current_uses >= discount.max_uses) {
            await client.query('ROLLBACK');
            client.release();
            return reply.status(400).send({ error: 'Discount code is no longer available' });
          }

          if (total < (discount.min_order_amount ?? 0)) {
            await client.query('ROLLBACK');
            client.release();
            return reply.status(400).send({ error: 'Order total does not meet the minimum for this discount' });
          }

          const emailUsageRes = await client.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM orders WHERE discount_code = $1 AND email = $2 AND status != 'failed'`,
            [discount.code, email],
          );
          if (parseInt(emailUsageRes.rows[0].count, 10) > 0) {
            await client.query('ROLLBACK');
            client.release();
            return reply.status(400).send({ error: 'Discount already used by this account' });
          }

          if (discount.type === 'percentage') {
            discountAmount = Math.floor(total * discount.value / 100);
          } else {
            discountAmount = Math.min(discount.value, total);
          }
          resolvedDiscountCode = discount.code;

          await client.query(
            `UPDATE discounts SET current_uses = current_uses + 1 WHERE id = $1`,
            [discount.id],
          );
        }

        const discountedSubtotal = Math.max(total - discountAmount, 50);
        const grandTotal = Math.max(discountedSubtotal + taxAmount, 50);

        const _maxOrderParsed = parseInt(process.env.MAX_ORDER_AMOUNT_CENTS || '500000', 10);
        const MAX_ORDER_AMOUNT_CENTS = Number.isFinite(_maxOrderParsed) && _maxOrderParsed > 0 ? _maxOrderParsed : 500_000;
        if (grandTotal > MAX_ORDER_AMOUNT_CENTS) {
          await client.query('ROLLBACK');
          client.release();
          return reply.status(400).send({ error: 'Order total exceeds the maximum allowed amount' });
        }

        for (let attempt = 0; attempt < ORDER_NUMBER_RETRIES; attempt++) {
          orderNumber = generateOrderNumber();
          try {
            const orderResult = await client.query<{ id: string; order_token: string }>(
              `INSERT INTO orders
                 (order_number, email, status, payment_status, total, tax_amount,
                  tax_calculation_id, billing_country, billing_state, billing_postal_code, user_agent,
                  discount_code, discount_amount)
               VALUES ($1, $2, 'pending', 'pending', $3, $4, $5, $6, $7, $8, $9, $10, $11)
               RETURNING id, order_token`,
              [
                orderNumber,
                email,
                grandTotal,
                taxAmount,
                taxCalculationId,
                billingAddress?.country || null,
                billingAddress?.state || null,
                billingAddress?.postalCode || null,
                userAgent,
                resolvedDiscountCode,
                discountAmount,
              ],
            );
            orderId = orderResult.rows[0].id;
            orderToken = orderResult.rows[0].order_token;
            break;
          } catch (err: unknown) {
            const pgErr = err as { code?: string };
            if (pgErr.code === '23505' && attempt < ORDER_NUMBER_RETRIES - 1) {
              continue;
            }
            throw err;
          }
        }

        const itemValues: unknown[] = [];
        const itemPlaceholders: string[] = [];
        let idx = 1;
        for (const product of valid) {
          itemPlaceholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, 1)`);
          itemValues.push(orderId, product.id, product.name, product.price);
          idx += 4;
        }
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
           VALUES ${itemPlaceholders.join(', ')}`,
          itemValues,
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }

      const discountedSubtotal = Math.max(total - discountAmount, 50);
      const grandTotal = Math.max(discountedSubtotal + taxAmount, 50);

      // Dev-mode bypass: when Stripe key is a placeholder, skip Stripe and create a paid order directly.
      const isDevPlaceholder =
        config.devFeaturesEnabled &&
        (!config.stripe.secretKey || config.stripe.secretKey.endsWith('...'));

      if (isDevPlaceholder) {
        await fastify.pg.query(
          `UPDATE orders SET status = 'paid', payment_status = 'paid', updated_at = NOW() WHERE id = $1`,
          [orderId],
        );

        const orderRes = await fastify.pg.query(
          `SELECT o.*, json_agg(json_build_object('productName', oi.product_name, 'price', oi.price)) AS items
           FROM orders o JOIN order_items oi ON oi.order_id = o.id
           WHERE o.id = $1 GROUP BY o.id`,
          [orderId],
        );
        if (orderRes.rows.length > 0) {
          await sendConfirmationEmail(fastify, orderRes.rows[0]);
        }

        fastify.log.warn({ orderId }, 'Dev mode: Stripe bypassed — order marked paid immediately');

        return reply.send({
          devMode: true,
          orderId,
          orderToken,
          orderNumber,
          subtotal: total,
          taxAmount,
          grandTotal,
          discountAmount,
        });
      }

      let paymentIntent;
      try {
        paymentIntent = await fastify.stripe.paymentIntents.create(
          {
            amount: grandTotal,
            currency: 'usd',
            metadata: {
              order_id: orderId,
              order_number: orderNumber,
              customer_ip: getClientIp(request),
            },
            receipt_email: email,
          },
          // Idempotency key: same order never creates a second PaymentIntent on retry.
          { idempotencyKey: `pi_${orderId}` },
        );
      } catch (err) {
        fastify.log.error({ err }, 'Stripe PaymentIntent creation failed');
        await fastify.pg.query(
          `UPDATE orders SET status = 'failed', payment_status = 'failed', updated_at = NOW() WHERE id = $1`,
          [orderId],
        );
        if (resolvedDiscountCode) {
          await fastify.pg.query(
            `UPDATE discounts SET current_uses = GREATEST(current_uses - 1, 0) WHERE code = $1`,
            [resolvedDiscountCode],
          );
        }
        return reply.status(502).send({ error: 'Payment service error — please try again' });
      }

      await fastify.pg.query(
        `UPDATE orders SET stripe_payment_intent_id = $1 WHERE id = $2`,
        [paymentIntent.id, orderId],
      );

      // SOX-3: order_created audit must be durably recorded before returning a usable
      // client_secret. If the audit write fails we cannot prove the order existed under
      // the audit policy, so we void the PaymentIntent, mark the order failed, and 503.
      // Order rollback runs outside the original tx (which has already committed) — we
      // use a best-effort UPDATE to flip the status; the cancelled PI guarantees the
      // customer cannot complete payment regardless.
      try {
        await writeAuditLog(fastify, {
          userEmail: email,
          userName: email,
          action: 'order_created',
          resourceType: 'order',
          resourceId: orderId,
          summary: `Order ${orderNumber} created for ${email} — ${grandTotal} cents (tax: ${taxAmount})`,
          ip: getClientIp(request),
          newState: {
            orderId,
            orderNumber,
            total: grandTotal,
            taxAmount,
            itemCount: valid.length,
            stripePaymentIntentId: paymentIntent.id,
          },
        });
      } catch (err) {
        fastify.log.error({ err, orderId, paymentIntentId: paymentIntent.id },
          'CRITICAL: order_created audit write failed — aborting checkout');
        await fastify.stripe.paymentIntents.cancel(paymentIntent.id).catch((cancelErr) =>
          fastify.log.error({ err: cancelErr, paymentIntentId: paymentIntent.id },
            'Failed to cancel PaymentIntent after audit failure'));
        // FINTECH M-2: Route the abort through the same idempotent helper used by the
        // payment_intent.canceled webhook so that discount_usage_log gets a row and the
        // discount counter is decremented inside one transaction. A future
        // payment_intent.canceled retry from Stripe will then ON CONFLICT-skip the
        // discount_usage_log INSERT and avoid double-decrementing.
        const client = await fastify.pg.connect();
        try {
          await client.query('BEGIN');
          if (resolvedDiscountCode) {
            const ins = await client.query<{ ok: number }>(
              `INSERT INTO discount_usage_log (discount_code, order_id, action)
               VALUES ($1, $2, 'canceled')
               ON CONFLICT DO NOTHING
               RETURNING 1 AS ok`,
              [resolvedDiscountCode, orderId],
            );
            if (ins.rowCount && ins.rowCount > 0) {
              await client.query(
                `UPDATE discounts SET current_uses = GREATEST(current_uses - 1, 0) WHERE code = $1`,
                [resolvedDiscountCode],
              );
            }
          }
          await client.query(
            `UPDATE orders SET status = 'failed', payment_status = 'failed', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'`,
            [orderId],
          );
          await client.query('COMMIT');
        } catch (rbErr) {
          await client.query('ROLLBACK').catch(() => {});
          fastify.log.error({ err: rbErr, orderId },
            'Failed to roll back order/discount after audit failure');
        } finally {
          client.release();
        }
        return reply.status(503).send({ error: 'Service temporarily unavailable' });
      }

      return reply.send({
        clientSecret: paymentIntent.client_secret,
        orderId,
        orderToken,
        subtotal: total,
        taxAmount,
        grandTotal,
        discountAmount,
      });
    },
  );

  // === Stripe Webhook (scoped sub-plugin for raw body parsing) ===
  fastify.register(async (instance) => {
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req: unknown, body: Buffer, done: (err: null, result: Buffer) => void) => {
        done(null, body);
      },
    );

    instance.post('/api/checkout/webhook', async (request, reply) => {
      if (!instance.stripe) {
        return reply.status(503).send({ error: 'Payment service unavailable' });
      }

      if (!config.stripe.webhookSecret) {
        instance.log.error('STRIPE_WEBHOOK_SECRET is empty');
        return reply.status(500).send({ error: 'Webhook misconfiguration' });
      }

      const sig = request.headers['stripe-signature'] as string;
      if (!sig) return reply.status(400).send({ error: 'Missing signature' });

      let event;
      try {
        event = instance.stripe.webhooks.constructEvent(
          request.body as unknown as Buffer,
          sig,
          config.stripe.webhookSecret,
        );
      } catch (err) {
        instance.log.error({ err }, 'Webhook signature verification failed');
        return reply.status(400).send({ error: 'Invalid signature' });
      }

      const eventId = event.id;
      // Dedup probe (not claim): GET-then-decide. The actual claim happens AFTER the audit
      // log write commits successfully (see markEventProcessed below) so that an audit-write
      // failure does NOT poison the dedup key — Stripe retries can re-enter the un-deduped
      // path until the audit row is durably persisted.
      const alreadyProcessed = await instance.valkey.get(`webhook:processed:${eventId}`);
      if (alreadyProcessed) {
        instance.log.info({ eventId }, 'Duplicate webhook event — already processed');
        return reply.status(200).send({ received: true });
      }
      async function markEventProcessed(): Promise<void> {
        await instance.valkey.set(`webhook:processed:${eventId}`, '1', 'EX', 604800, 'NX');
      }

      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        const orderId = pi.metadata.order_id;

        const customerIp = pi.metadata.customer_ip ?? null;
        if (customerIp && Date.now() / 1000 - pi.created < 5) {
          instance.valkey.set(`sec:checkout_fast:${customerIp}`, '1', 'EX', 86400).catch(() => {});
          const evt = JSON.stringify({
            ts: Date.now(), ip: customerIp, event_type: 'bot_flag',
            path: '/api/checkout/webhook', action: 'flagged', bot_score: 0.30,
            metadata: { reason: 'checkout_too_fast', pi_id: pi.id },
          });
          instance.valkey.lpush('sec:events:buffer', evt)
            .then(() => instance.valkey.ltrim('sec:events:buffer', 0, 9999))
            .catch(() => {});
        }

        const charge = typeof pi.latest_charge === 'object' && pi.latest_charge !== null
          ? (pi.latest_charge as unknown as Record<string, unknown>)
          : null;
        const pmd = charge?.payment_method_details as Record<string, unknown> | undefined;
        const card = pmd?.card as Record<string, unknown> | undefined;
        const tds = card?.three_d_secure as Record<string, unknown> | undefined;
        const threeDsStatus = (tds?.result as string) ?? null;

        await instance.pg.query(
          `UPDATE orders SET status = 'paid', payment_status = 'paid',
           three_ds_status = $2, updated_at = NOW()
           WHERE id = $1 AND status = 'pending'`,
          [orderId, threeDsStatus],
        );

        const orderRes = await instance.pg.query(
          `SELECT o.*, json_agg(json_build_object(
               'productName', oi.product_name,
               'price', oi.price
             )) AS items
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           WHERE o.id = $1
           GROUP BY o.id`,
          [orderId],
        );

        if (orderRes.rows.length > 0) {
          const order = orderRes.rows[0];

          // Discount usage already claimed atomically at checkout creation time.
          // No increment needed here — the claim is final once payment succeeds.

          // SOX: log payment success with before/after state snapshots
          await writeAuditLog(instance, {
            userEmail: order.email,
            userName: order.email,
            action: 'payment_success',
            resourceType: 'order',
            resourceId: orderId,
            summary: `Payment succeeded for order ${order.order_number} — PI ${pi.id} — ${order.total} cents`,
            previousState: { status: 'pending', paymentStatus: 'pending' },
            newState: { status: 'paid', paymentStatus: 'paid', stripePaymentIntentId: pi.id, amount: order.total, taxAmount: order.tax_amount ?? 0, discountAmount: order.discount_amount ?? 0 },
          });

          await sendConfirmationEmail(instance, order);
        }
      }

      // PAY-4: Idempotent discount decrement + atomic order-status update.
      // Both the discount counter rollback and the order status flip run inside one
      // BEGIN/COMMIT, so a partial failure (e.g. process crash between statements)
      // can no longer leak a discount slot or leave the order in 'pending'.
      //
      // SECURITY LOW-1: SQL hardening. Action is a typed enum; the helper maps it
      // internally to a hardcoded SQL template + params. No caller-supplied SQL —
      // eliminates any injection surface and centralises the rollback semantics.
      //
      // SECURITY M-1 / Fintech M-1 ordering: callers MUST sequence
      //   helper(mutation) → writeAuditLog(...) → markEventProcessed()
      // so that an audit-write failure throws BEFORE the dedup key is claimed. Stripe
      // retries then hit the un-deduped path; the helper is idempotent (discount_usage_log
      // UNIQUE + WHERE-clause-guarded UPDATE) so the second attempt is safe.
      //
      // Idempotency: INSERT into discount_usage_log first; if the row already exists
      // (ON CONFLICT DO NOTHING returns 0 rows) the decrement has already been applied
      // for this (code, order, action) tuple and we skip the discounts UPDATE while still
      // running the order-status UPDATE (which is itself idempotent via WHERE clause).
      // This guards against duplicate webhook deliveries and overlapping rollback paths
      // (e.g. payment_failed followed by charge.refunded).
      type RollbackAction = 'payment_failed' | 'canceled' | 'refunded' | 'dispute' | 'chargeback_lost';
      async function rollbackDiscountAndUpdateOrder(
        code: string | null,
        orderId: string,
        action: RollbackAction,
      ): Promise<void> {
        // Hardcoded SQL templates per action — no caller-supplied SQL.
        let orderUpdateSql: string;
        let orderUpdateParams: unknown[];
        switch (action) {
          case 'payment_failed':
          case 'canceled':
            orderUpdateSql =
              `UPDATE orders SET status = 'failed', payment_status = 'failed', updated_at = NOW()
               WHERE id = $1 AND status = 'pending'`;
            orderUpdateParams = [orderId];
            break;
          case 'refunded':
            orderUpdateSql =
              `UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW()
               WHERE id = $1 AND status != 'refunded'`;
            orderUpdateParams = [orderId];
            break;
          case 'dispute':
            orderUpdateSql =
              `UPDATE orders SET status = 'disputed', updated_at = NOW()
               WHERE id = $1 AND status NOT IN ('disputed', 'chargeback_lost', 'refunded')`;
            orderUpdateParams = [orderId];
            break;
          case 'chargeback_lost':
            orderUpdateSql =
              `UPDATE orders SET status = 'chargeback_lost', updated_at = NOW()
               WHERE id = $1 AND status NOT IN ('chargeback_lost', 'refunded')`;
            orderUpdateParams = [orderId];
            break;
        }

        const client = await instance.pg.connect();
        try {
          await client.query('BEGIN');
          if (code) {
            // discount_usage_log uses the broader action enum constraint; map dispute
            // outcomes to a single 'dispute' tag for the rollback log.
            //
            // SECURITY M-1 (pass-4): Stripe can deliver BOTH payment_intent.payment_failed
            // and payment_intent.canceled for the same PaymentIntent in some failure modes.
            // The order-status SQL switch keeps these distinct (different transitions),
            // but discount_usage_log is keyed on (discount_code, order_id, action) — so two
            // different action labels for the same logical "abandoned payment" event would
            // create two log rows and double-decrement the discount counter.
            // Collapse both to 'canceled' for the discount_usage_log INSERT so the second
            // rollback hits the PK and ON CONFLICT DO NOTHING skips the decrement.
            let logAction: RollbackAction | 'dispute' = action;
            if (action === 'chargeback_lost') logAction = 'dispute';
            else if (action === 'payment_failed') logAction = 'canceled';
            const ins = await client.query<{ ok: number }>(
              `INSERT INTO discount_usage_log (discount_code, order_id, action)
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING
               RETURNING 1 AS ok`,
              [code, orderId, logAction],
            );
            if (ins.rowCount && ins.rowCount > 0) {
              await client.query(
                `UPDATE discounts SET current_uses = GREATEST(current_uses - 1, 0) WHERE code = $1`,
                [code],
              );
            }
          }
          await client.query(orderUpdateSql, orderUpdateParams);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      }

      if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
        const pi = event.data.object;
        const orderId = pi.metadata.order_id;
        if (orderId) {
          const orderRes = await instance.pg.query<{ discount_code: string | null }>(
            `SELECT discount_code FROM orders WHERE id = $1 AND status = 'pending'`,
            [orderId],
          );
          const order = orderRes.rows[0];
          if (order) {
            await rollbackDiscountAndUpdateOrder(
              order.discount_code,
              orderId,
              event.type === 'payment_intent.canceled' ? 'canceled' : 'payment_failed',
            );

            // SOX-3 / SECURITY M-1: audit must succeed BEFORE we claim the dedup key.
            // If this throws Stripe will retry; the helper above is idempotent so the
            // re-attempt is safe.
            await writeAuditLog(instance, {
              userEmail: 'stripe-webhook',
              userName: 'stripe-webhook',
              action: 'payment_failed',
              resourceType: 'order',
              resourceId: orderId,
              summary: `Payment ${event.type === 'payment_intent.canceled' ? 'canceled' : 'failed'} for order ${orderId}`,
              previousState: { status: 'pending' },
              newState: { status: 'failed', paymentStatus: 'failed', piId: pi.id },
            });
          }
        }
      }

      if (event.type === 'charge.refunded') {
        const charge = event.data.object;
        const pi_id = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        if (pi_id) {
          const orderRes = await instance.pg.query<{ id: string; discount_code: string | null; status: string }>(
            `SELECT id, discount_code, status FROM orders WHERE stripe_payment_intent_id = $1`,
            [pi_id],
          );
          const order = orderRes.rows[0];
          if (order) {
            // Roll back discount slot only if the order isn't already refunded.
            const codeForRollback = order.status !== 'refunded' ? order.discount_code : null;
            await rollbackDiscountAndUpdateOrder(
              codeForRollback,
              order.id,
              'refunded',
            );

            // SOX-3 / SECURITY M-1: audit must succeed BEFORE we claim the dedup key.
            await writeAuditLog(instance, {
              userEmail: 'stripe-webhook',
              userName: 'stripe-webhook',
              action: 'refund',
              resourceType: 'order',
              resourceId: order.id,
              summary: `Stripe-initiated refund on order ${order.id} via charge.refunded webhook`,
              previousState: { status: 'paid' },
              newState: { status: 'refunded', refundAmount: charge.amount_refunded },
            });
          }
        }
      }

      // PAY-3: Dispute (chargeback) webhook handlers. Status flips to 'disputed' /
      // 'chargeback_lost'; discount slot is rolled back via the idempotent helper.
      // Evidence submission is intentionally out of scope here.
      if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.funds_withdrawn') {
        const dispute = event.data.object as unknown as Record<string, unknown>;
        const charge = dispute.charge;
        let pi_id: string | null = null;
        // dispute.payment_intent is present on most dispute events; fall back to charge lookup.
        if (typeof dispute.payment_intent === 'string') {
          pi_id = dispute.payment_intent;
        } else if (typeof charge === 'string' && instance.stripe) {
          try {
            const ch = await instance.stripe.charges.retrieve(charge);
            pi_id = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id ?? null;
          } catch (err) {
            instance.log.error({ err, chargeId: charge }, 'Failed to resolve PaymentIntent for dispute');
          }
        }

        if (pi_id) {
          const orderRes = await instance.pg.query<{ id: string; discount_code: string | null; status: string; order_number: string }>(
            `SELECT id, discount_code, status, order_number FROM orders WHERE stripe_payment_intent_id = $1`,
            [pi_id],
          );
          const order = orderRes.rows[0];
          if (order) {
            const newStatus = event.type === 'charge.dispute.funds_withdrawn' ? 'chargeback_lost' : 'disputed';
            const rollbackAction = event.type === 'charge.dispute.funds_withdrawn' ? 'chargeback_lost' : 'dispute';

            await rollbackDiscountAndUpdateOrder(
              order.discount_code,
              order.id,
              rollbackAction,
            );

            // LOW-1: Stripe dispute objects always carry a string `id`, but be defensive
            // since the event body type is loosened to Record<string, unknown> upstream.
            const disputeId = typeof dispute.id === 'string' ? dispute.id : null;

            // ALERT: dispute filed — operations should triage. Logged at error level so
            // it surfaces in alert pipelines (no auto-evidence-submission per scope).
            instance.log.error(
              { orderId: order.id, orderNumber: order.order_number, eventType: event.type, disputeId, amount: dispute.amount, reason: dispute.reason },
              'ALERT: Stripe dispute received',
            );

            // LOW-1 (pass-4): Always write an audit row, even when disputeId is missing.
            // The order status mutation above already happened, so we MUST record an audit
            // entry to preserve the trail — otherwise we have a state change with no
            // forensic record. When disputeId is null we use a sentinel resourceId of
            // 'unknown' and embed the raw dispute object in newState so investigators can
            // still recover the dispute identity (charge id, amount, reason, etc.).
            const disputeAuditResourceId = disputeId ?? 'unknown';
            const disputeAuditSummary = disputeId !== null
              ? `Stripe ${event.type} on order ${order.order_number} (dispute ${disputeId})`
              : `Stripe ${event.type} on order ${order.order_number} (dispute id missing — see newState.dispute)`;
            await writeAuditLog(instance, {
              userEmail: 'stripe-webhook',
              userName: 'stripe-webhook',
              action: 'refund',
              resourceType: 'order',
              resourceId: order.id,
              summary: disputeAuditSummary,
              previousState: { status: order.status },
              newState: {
                status: newStatus,
                disputeId,
                disputeReason: dispute.reason,
                disputeAmount: dispute.amount,
                eventType: event.type,
                ...(disputeId === null ? { dispute, disputeResourceIdSentinel: disputeAuditResourceId } : {}),
              },
            });
            if (disputeId === null) {
              instance.log.error({ orderId: order.id, eventType: event.type },
                'Dispute event missing string id — degraded audit row written with sentinel');
            }
          }
        }
      }

      // API credit-pack top-up: a one-time Checkout (mode: payment) tagged kind=credits.
      // Guarded so it never touches the subscription checkout (mode: subscription), which
      // handleStripeSubscriptionEvent owns. Credits are granted only once the payment has
      // actually SETTLED: synchronous methods (card/wallet) settle by 'completed' with
      // payment_status 'paid', while delayed methods (ACH/SEPA/Boleto/etc.) report 'unpaid'
      // at 'completed' and settle later via async_payment_succeeded. Granting on 'completed'
      // alone would mint paid credits for a payment that can still fail, with no clawback.
      // grantTopup is idempotent on the session id, so if both events fire (or Stripe retries
      // after an audit-write failure) credits are granted exactly once. Same ordering rule:
      // mutation + audit commit here, before markEventProcessed() claims the dedup key.
      if (
        event.type === 'checkout.session.completed' ||
        event.type === 'checkout.session.async_payment_succeeded'
      ) {
        const session = event.data.object;
        if (
          session.mode === 'payment' &&
          session.metadata?.kind === 'credits' &&
          session.payment_status === 'paid'
        ) {
          const email = (
            session.metadata?.email ||
            session.customer_details?.email ||
            session.customer_email ||
            ''
          ).toLowerCase();
          const credits = parseInt(session.metadata?.credits || '0', 10);
          if (email && credits > 0) {
            const { balance, applied } = await grantTopup(instance, email, credits, session.id);
            await writeAuditLog(instance, {
              userEmail: email,
              userName: email,
              action: 'payment_success',
              resourceType: 'credit_account',
              resourceId: email,
              summary: `Purchased ${credits} API credits (${session.id})`,
              newState: { credits, balance, applied },
            });
          } else {
            instance.log.warn({ eventId: event.id }, 'credit checkout missing email/credits');
          }
        }
      }

      // Supporter (Pro) subscription lifecycle — same ordering guarantee: its mutations
      // + audit writes must commit here before the dedup key is claimed below.
      await handleStripeSubscriptionEvent(instance, event);

      // SECURITY M-1 / Fintech M-1: claim the dedup key only after all mutations + audit
      // writes for this event have committed. If any branch above threw, this line never
      // runs — Stripe retries hit the un-deduped path so the audit row eventually lands.
      await markEventProcessed();
      return reply.status(200).send({ received: true });
    });
  });

  // === Get Order (for success page) ===
  fastify.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    '/api/checkout/order/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { token } = request.query;

      if (!/^[0-9a-f-]{36}$/.test(id)) {
        return reply.status(400).send({ error: 'Invalid order ID' });
      }

      if (!token) {
        return reply.status(401).send({ error: 'Access token required' });
      }

      const orderRes = await fastify.pg.query(
        `SELECT o.id, o.order_number, o.email, o.status, o.payment_status,
                o.total, o.tax_amount, o.created_at, o.order_token,
                json_agg(json_build_object(
                  'productId', oi.product_id,
                  'productName', oi.product_name,
                  'price', oi.price,
                  'quantity', oi.quantity
                )) AS items
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.id = $1
         GROUP BY o.id`,
        [id],
      );

      if (orderRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      const order = orderRes.rows[0];

      // Constant-time comparison prevents timing-based token enumeration attacks.
      const expectedToken: string = order.order_token;
      if (
        token.length !== expectedToken.length ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))
      ) {
        return reply.status(403).send({ error: 'Invalid access token' });
      }

      let downloadLinks: { productId: string; productName: string; url: string }[] = [];
      if (order.status === 'paid') {
        downloadLinks = generateDownloadLinks(id, order.order_token, order.items);
      }

      reply.header('Referrer-Policy', 'no-referrer');
      return reply.send({
        id: order.id,
        orderNumber: order.order_number,
        email: order.email,
        status: order.status,
        paymentStatus: order.payment_status,
        total: order.total,
        taxAmount: order.tax_amount,
        items: order.items,
        downloadLinks,
        createdAt: order.created_at,
      });
    },
  );

  // === Admin Refund ===
  fastify.post<{ Params: { id: string }; Body: { amount?: number } }>(
    '/api/admin/orders/:id/refund',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'admin')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { id } = request.params;
      const { amount } = request.body || {};

      const orderRes = await fastify.pg.query<{
        id: string;
        order_number: string;
        status: string;
        total: number;
        stripe_payment_intent_id: string | null;
      }>(
        `SELECT id, order_number, status, total, stripe_payment_intent_id FROM orders WHERE id = $1`,
        [id],
      );

      if (orderRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      const order = orderRes.rows[0];

      // SOX-1: 4-eyes principle. The admin who recorded the order's creation
      // (e.g. a manual create-on-behalf flow) cannot also approve its refund.
      // Only super_admin may override this separation-of-duties block.
      const creationLog = await fastify.pg.query<{ user_email: string }>(
        `SELECT user_email FROM audit_logs WHERE resource_type = 'order' AND resource_id = $1 AND action = 'order_created' LIMIT 1`,
        [id],
      );
      if (creationLog.rows[0]?.user_email === user.email && user.adminTier !== 'super_admin') {
        fastify.log.warn({ orderId: id, adminEmail: user.email },
          'SOX: Self-approval refund blocked — order creator cannot approve their own refund');
        return reply.status(403).send({
          error: 'SOX SoD: refunds require approval by a different admin (4-eyes principle)',
        });
      }

      if (order.status !== 'paid') {
        return reply.status(400).send({ error: 'Only paid orders can be refunded' });
      }

      if (!order.stripe_payment_intent_id) {
        return reply.status(400).send({ error: 'Order has no associated payment intent' });
      }

      if (amount !== undefined && (typeof amount !== 'number' || amount <= 0 || amount > order.total)) {
        return reply.status(400).send({ error: 'Invalid refund amount' });
      }

      if (!fastify.stripe) {
        return reply.status(503).send({ error: 'Payment service unavailable' });
      }

      const isPartial = amount !== undefined && amount < order.total;
      const previousStatus = order.status;

      try {
        const refund = await fastify.stripe.refunds.create(
          {
            payment_intent: order.stripe_payment_intent_id,
            ...(amount ? { amount } : {}),
          },
          { idempotencyKey: `refund_${id}_${amount ?? 'full'}` },
        );

        const newStatus = isPartial ? 'paid' : 'refunded';
        await fastify.pg.query(
          `UPDATE orders SET status = $1, payment_status = $1, updated_at = NOW() WHERE id = $2`,
          [newStatus, id],
        );

        await writeAuditLog(fastify, {
          userEmail: user.email,
          userName: user.name || user.email,
          action: 'refund',
          resourceType: 'order',
          resourceId: id,
          summary: isPartial
            ? `Partial refund of ${amount} cents on order ${order.order_number}`
            : `Full refund on order ${order.order_number}`,
          ip: getClientIp(request),
          previousState: { status: previousStatus },
          newState: { status: newStatus, refundId: refund.id, refundAmount: refund.amount },
        });

        return reply.send({
          refundId: refund.id,
          amount: refund.amount,
          status: refund.status,
          orderStatus: newStatus,
        });
      } catch (err) {
        fastify.log.error({ err }, 'Stripe refund failed');
        return reply.status(502).send({ error: 'Refund failed — please try again' });
      }
    },
  );

  // === GDPR: Customer Account Deletion ===
  fastify.post('/api/customer/delete-account', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'customer') {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const email = user.email;
    const anonHash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 16);
    const anonEmail = `deleted-${anonHash}@anonymized.local`;

    const client = await fastify.pg.connect();
    try {
      await client.query('BEGIN');
      await Promise.all([
        client.query(
          `UPDATE orders SET email = $1, user_agent = NULL,
                  billing_country = NULL, billing_state = NULL, billing_postal_code = NULL,
                  updated_at = NOW() WHERE email = $2`,
          [anonEmail, email],
        ),
        client.query(
          `DELETE FROM reviews WHERE email = $1`,
          [email],
        ),
        client.query(
          `UPDATE support_tickets SET customer_email = $1, customer_name = 'Deleted User', updated_at = NOW() WHERE customer_email = $2`,
          [anonEmail, email],
        ),
        removeSubscriber(email).catch(() => {}),
        client.query(
          `UPDATE ticket_messages SET sender_email = $1, sender_name = 'Deleted User' WHERE sender_email = $2`,
          [anonEmail, email],
        ),
        // analytics_events has no email column and session_id is a random client UUID (not an order ID).
        // There is no reliable way to link analytics_events rows back to a specific user email.
        // consent_records use anonymous_id (not email). Anonymised consent records are retained
        // as lawful basis evidence under GDPR Art. 6(1)(c) and Art. 7(1).
      ]);
      // KNOWN: GDPR redaction invalidates hash chain for affected resource_types.
      // The gdpr_redacted_at timestamp marks which rows were modified so that
      // hash chain verification can account for legitimate GDPR-mandated changes.
      await client.query(
        `UPDATE audit_logs SET user_email = $1,
                user_name = CASE WHEN user_name = $2 THEN $1 ELSE user_name END,
                summary = REPLACE(summary, $2, '[redacted]'),
                new_state = CASE WHEN new_state IS NOT NULL AND new_state ? 'email'
                  THEN jsonb_set(new_state, '{email}', to_jsonb($1::text))
                  ELSE new_state END,
                previous_state = CASE WHEN previous_state IS NOT NULL AND previous_state ? 'email'
                  THEN jsonb_set(previous_state, '{email}', to_jsonb($1::text))
                  ELSE previous_state END,
                gdpr_redacted_at = NOW()
         WHERE user_email = $2`,
        [anonEmail, email],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    // Stripe retains payment records per their data retention policy and regulatory obligations.
    // TODO: If a Stripe Customer ID is stored, call stripe.customers.del(customerId) here
    // to request deletion of the customer object from Stripe. Note that Stripe may still retain
    // payment data as required by financial regulations.

    try {
      await writeAuditLog(fastify, {
        userEmail: anonEmail,
        userName: 'deleted-user',
        action: 'account_deleted',
        resourceType: 'customer',
        summary: `Customer account deleted (GDPR erasure). Original email anonymized.`,
        ip: getClientIp(request),
      });
    } catch (err) {
      fastify.log.warn({ err }, 'Failed to write account_deleted audit log');
    }

    await request.session.destroy();

    return reply.send({ ok: true, message: 'Account data has been deleted' });
  });
}

/**
 * Returns proxy URLs that go through /api/download/:orderId/:productId?token=...
 * The proxy checks order status at download time — revoking a paid order (e.g. chargeback)
 * immediately kills download access without needing to invalidate pre-issued presigned URLs.
 */
function generateDownloadLinks(
  orderId: string,
  orderToken: string,
  items: { productId: string; productName: string }[],
): { productId: string; productName: string; url: string }[] {
  return items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    url: `/api/download/${orderId}/${item.productId}?token=${orderToken}`,
  }));
}

async function sendConfirmationEmail(
  fastify: FastifyInstance,
  order: Record<string, unknown>,
) {
  const items = order.items as { productName: string; price: number }[];
  const itemsHtml = items
    .map((i) => `<li>${escapeHtml(i.productName)} — $${(i.price / 100).toFixed(2)}</li>`)
    .join('');

  const baseUrl = config.baseUrl;
  const totalCents = order.total as number;
  const taxCents = (order.tax_amount as number) || 0;
  const subtotalCents = totalCents - taxCents;
  const orderToken = order.order_token as string;

  const taxLine = taxCents > 0
    ? `<p>Tax: $${(taxCents / 100).toFixed(2)}</p>`
    : '';

  const html = `
    <h1>Order Confirmed!</h1>
    <p>Thank you for your purchase.</p>
    <p><strong>Order #${escapeHtml(order.order_number as string)}</strong></p>
    <ul>${itemsHtml}</ul>
    ${taxCents > 0 ? `<p>Subtotal: $${(subtotalCents / 100).toFixed(2)}</p>` : ''}
    ${taxLine}
    <p><strong>Total: $${(totalCents / 100).toFixed(2)}</strong></p>
    <p>Your download links are available on your order confirmation page.</p>
    <p><a href="${baseUrl}/checkout/success?order_id=${order.id}&amp;order_token=${orderToken}">View Order &amp; Downloads</a></p>
  `;

  try {
    // Transactional email (order receipt) — no List-Unsubscribe header required per CAN-SPAM.
    await fastify.mailer.sendMail(
      order.email as string,
      `Order Confirmed — #${order.order_number}`,
      html,
    );
  } catch (err) {
    fastify.log.error({ err }, 'Failed to send order confirmation email');
  }
}
