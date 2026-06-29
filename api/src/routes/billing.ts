import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

type SubRow = {
  stripe_customer_id: string | null;
  status: string | null;
  current_period_end: string | null;
};

// Supporter (Pro) billing. Every action derives the customer strictly from the
// signed-in session email — never from client input — so a viewer can only act on
// their own billing. These routes are not in PUBLIC_PREFIXES, so the auth guard has
// already required a session by the time a handler runs.
export async function billingRoutes(fastify: FastifyInstance) {
  // Resolve (and lazily create) the Stripe customer for this email. Idempotency key
  // collapses double-clicks / two tabs to a single Stripe customer.
  async function ensureCustomer(email: string): Promise<string> {
    const existing = await fastify.pg.query<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id FROM subscriptions WHERE email = $1`,
      [email],
    );
    const found = existing.rows[0]?.stripe_customer_id;
    if (found) return found;

    const customer = await fastify.stripe.customers.create(
      { email },
      { idempotencyKey: `cust-create:${email}` },
    );
    // Seed the row so the customer id is durable even before the first webhook lands.
    await fastify.pg.query(
      `INSERT INTO subscriptions (email, stripe_customer_id)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET
         stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = NOW()`,
      [email, customer.id],
    );
    return customer.id;
  }

  async function portalUrl(customerId: string): Promise<string> {
    const portal = await fastify.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${config.baseUrl}/account`,
    });
    return portal.url;
  }

  fastify.post<{ Body: { interval?: 'monthly' | 'annual' } }>('/api/billing/create-checkout-session', async (request, reply) => {
    if (!fastify.stripe) return reply.status(503).send({ error: 'Payment service unavailable' });
    // Default to monthly so an empty/legacy body still checks out; annual is opt-in.
    const interval = request.body?.interval === 'annual' ? 'annual' : 'monthly';
    const priceId = interval === 'annual' ? config.stripe.priceProAnnual : config.stripe.priceProMonthly;
    if (!priceId) {
      fastify.log.error(`STRIPE_PRICE_PRO_${interval === 'annual' ? 'ANNUAL' : 'MONTHLY'} is not set`);
      return reply.status(500).send({ error: 'Billing is not configured yet.' });
    }
    const email = request.session?.user?.email?.toLowerCase();
    if (!email) return reply.status(401).send({ error: 'Sign in required' });

    const row = await fastify.pg.query<SubRow>(
      `SELECT stripe_customer_id, status, current_period_end FROM subscriptions WHERE email = $1`,
      [email],
    );
    const sub = row.rows[0];

    // Already a live Supporter → send them to the portal instead of buying twice.
    const live =
      !!sub &&
      (sub.status === 'active' || sub.status === 'past_due') &&
      !!sub.current_period_end &&
      new Date(sub.current_period_end).getTime() > Date.now();
    if (live && sub?.stripe_customer_id) {
      return reply.send({ url: await portalUrl(sub.stripe_customer_id) });
    }

    const customerId = await ensureCustomer(email);
    const checkout = await fastify.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.baseUrl}/account?upgraded=1`,
      cancel_url: `${config.baseUrl}/account`,
      allow_promotion_codes: true,
    });
    return reply.send({ url: checkout.url });
  });

  fastify.post('/api/billing/create-portal-session', async (request, reply) => {
    if (!fastify.stripe) return reply.status(503).send({ error: 'Payment service unavailable' });
    const email = request.session?.user?.email?.toLowerCase();
    if (!email) return reply.status(401).send({ error: 'Sign in required' });

    const row = await fastify.pg.query<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id FROM subscriptions WHERE email = $1`,
      [email],
    );
    const customerId = row.rows[0]?.stripe_customer_id;
    if (!customerId) return reply.status(404).send({ error: 'No billing account found.' });

    return reply.send({ url: await portalUrl(customerId) });
  });
}
