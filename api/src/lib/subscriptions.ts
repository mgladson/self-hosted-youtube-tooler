import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { writeAuditLog } from './audit.js';

// The Stripe events that drive Supporter (Pro) subscription state. invoice.* are
// intentionally omitted: Stripe also fires customer.subscription.updated whenever a
// renewal advances the period or a failed payment flips status to past_due, so the
// three events below fully cover entitlement without depending on invoice fields
// (which have shifted across Stripe API versions).
const SUBSCRIPTION_EVENTS = new Set<string>([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

export function isSubscriptionEvent(type: string): boolean {
  return SUBSCRIPTION_EVENTS.has(type);
}

function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === 'string' ? v : v.id;
}

// current_period_end sits on the subscription in some Stripe API versions and on its
// items in others — read whichever is present so we stay version-tolerant.
function periodEndIso(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const epoch = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return typeof epoch === 'number' ? new Date(epoch * 1000).toISOString() : null;
}

// past_due rides Stripe dunning — keep Supporter access until computeIsPro's period
// boundary actually lapses.
function planForStatus(status: string): 'pro' | 'free' {
  return status === 'active' || status === 'past_due' || status === 'trialing' ? 'pro' : 'free';
}

async function bustPlanCache(fastify: FastifyInstance, email: string): Promise<void> {
  await fastify.valkey.del(`plan:${email.toLowerCase()}`).catch(() => {});
}

// Drives the subscriptions table from Stripe webhooks. Called from the checkout
// webhook BEFORE markEventProcessed(), so a throw here makes Stripe retry rather than
// poisoning the dedup key (same ordering rule the order branches follow).
export async function handleStripeSubscriptionEvent(
  fastify: FastifyInstance,
  event: Stripe.Event,
): Promise<void> {
  if (!isSubscriptionEvent(event.type) || !fastify.stripe) return;
  const stripe = fastify.stripe;

  // --- Activation: the Checkout that created the subscription. ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== 'subscription') return; // one-time order checkout — not ours
    const customerId = idOf(session.customer);
    const subscriptionId = idOf(session.subscription);
    const email = (session.customer_details?.email || session.customer_email || '').toLowerCase();
    if (!customerId || !subscriptionId || !email) {
      fastify.log.warn({ eventId: event.id }, 'subscription checkout missing customer/subscription/email');
      return;
    }
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const periodEnd = periodEndIso(sub);

    // Dedupe-to-one-active: if this email already had a *different* live subscription
    // (e.g. a two-tab double checkout), cancel the old one so the customer is never
    // billed twice. The update/delete handler is scoped by subscription id, so the
    // cancellation's webhook won't clobber this fresh row.
    const existing = await fastify.pg.query<{ stripe_subscription_id: string | null }>(
      `SELECT stripe_subscription_id FROM subscriptions WHERE email = $1`,
      [email],
    );
    const oldSubId = existing.rows[0]?.stripe_subscription_id;
    if (oldSubId && oldSubId !== subscriptionId) {
      try {
        await stripe.subscriptions.cancel(oldSubId);
      } catch (err) {
        fastify.log.warn({ err, oldSubId }, 'failed to cancel superseded subscription');
      }
    }

    await fastify.pg.query(
      `INSERT INTO subscriptions
         (email, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, last_event_at, updated_at)
       VALUES ($1, $2, $3, 'pro', $4, $5, to_timestamp($6), NOW())
       ON CONFLICT (email) DO UPDATE SET
         stripe_customer_id     = EXCLUDED.stripe_customer_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         plan                   = 'pro',
         status                 = EXCLUDED.status,
         current_period_end     = EXCLUDED.current_period_end,
         last_event_at          = EXCLUDED.last_event_at,
         updated_at             = NOW()`,
      [email, customerId, subscriptionId, sub.status, periodEnd, event.created],
    );

    await writeAuditLog(fastify, {
      userEmail: email,
      userName: email,
      action: 'payment_success',
      resourceType: 'subscription',
      resourceId: subscriptionId,
      summary: `Supporter subscription activated for ${email} (${subscriptionId})`,
      newState: { plan: 'pro', status: sub.status, currentPeriodEnd: periodEnd },
    });
    await bustPlanCache(fastify, email);
    return;
  }

  // --- Lifecycle: update / cancel, scoped to the customer's current subscription. ---
  const sub = event.data.object as Stripe.Subscription;
  const customerId = idOf(sub.customer);
  if (!customerId) return;
  const deleted = event.type === 'customer.subscription.deleted';
  const status = deleted ? 'canceled' : sub.status;
  const plan = deleted ? 'free' : planForStatus(sub.status);
  const periodEnd = periodEndIso(sub);

  // Apply only to the customer's CURRENT subscription, and only if this event is newer
  // than the last one applied (Stripe may deliver out of order).
  const res = await fastify.pg.query<{ email: string }>(
    `UPDATE subscriptions SET
       plan = $1, status = $2,
       current_period_end = COALESCE($3, current_period_end),
       last_event_at = to_timestamp($4), updated_at = NOW()
     WHERE stripe_customer_id = $5 AND stripe_subscription_id = $6
       AND (last_event_at IS NULL OR last_event_at < to_timestamp($4))
     RETURNING email`,
    [plan, status, periodEnd, event.created, customerId, sub.id],
  );
  const email = res.rows[0]?.email;
  if (!email) return; // stale, unknown customer, or a superseded subscription

  await writeAuditLog(fastify, {
    userEmail: email,
    userName: email,
    action: deleted ? 'delete' : 'update',
    resourceType: 'subscription',
    resourceId: sub.id,
    summary: deleted
      ? `Supporter subscription canceled for ${email}`
      : `Supporter subscription updated for ${email} -> ${status}`,
    newState: { plan, status, currentPeriodEnd: periodEnd },
  });
  await bustPlanCache(fastify, email);
}
