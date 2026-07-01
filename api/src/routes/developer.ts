import type { FastifyInstance } from 'fastify';
import {
  countActiveKeys,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../lib/api-keys.js';
import { ensureAccountWithWelcomeGrant, getBalance, recentLedger } from '../lib/credits.js';
import { config } from '../config.js';

// Developer dashboard routes: manage the API keys (and, from Slice 2, the credit
// balance) that back the public /api/v1 API. Every action derives the owner strictly
// from the signed-in session email — never from client input — so a viewer can only
// touch their own keys. These routes are NOT in the auth-guard's PUBLIC_PREFIXES, so a
// session is already required by the time a handler runs; the email check is defence in
// depth.
const MAX_ACTIVE_KEYS = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function developerRoutes(fastify: FastifyInstance) {
  function sessionEmail(request: { session?: { user?: { email?: string } } }): string | null {
    return request.session?.user?.email?.toLowerCase() || null;
  }

  fastify.get('/api/developer/api-keys', async (request, reply) => {
    const email = sessionEmail(request);
    if (!email) return reply.status(401).send({ error: 'Sign in required' });
    const keys = await listApiKeys(fastify, email);
    return reply.send({ keys });
  });

  fastify.post<{ Body: { name?: string } }>('/api/developer/api-keys', async (request, reply) => {
    const email = sessionEmail(request);
    if (!email) return reply.status(401).send({ error: 'Sign in required' });

    const active = await countActiveKeys(fastify, email);
    if (active >= MAX_ACTIVE_KEYS) {
      return reply.status(409).send({
        error: `You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`,
        code: 'key_limit',
      });
    }

    // First key for this account also opens a credit account with the welcome grant so
    // the developer has credits to spend immediately. Idempotent + best-effort.
    await ensureAccountWithWelcomeGrant(fastify, email);

    const name = (request.body?.name ?? '').toString().trim().slice(0, 80) || null;
    const { row, secret } = await createApiKey(fastify, email, name);
    // `secret` is returned exactly once, here — it is never persisted or recoverable.
    return reply.send({ key: row, secret });
  });

  fastify.get('/api/developer/credits', async (request, reply) => {
    const email = sessionEmail(request);
    if (!email) return reply.status(401).send({ error: 'Sign in required' });
    const [balance, ledger] = await Promise.all([
      getBalance(fastify, email),
      recentLedger(fastify, email),
    ]);
    return reply.send({ balance, ledger });
  });

  // Start a Stripe Checkout to buy a credit pack. The pack size is granted by the
  // checkout.session.completed webhook (routes/checkout.ts), keyed on the session id so
  // a retried webhook can't double-grant.
  fastify.post('/api/developer/credits/checkout', async (request, reply) => {
    const email = sessionEmail(request);
    if (!email) return reply.status(401).send({ error: 'Sign in required' });
    if (!fastify.stripe) return reply.status(503).send({ error: 'Payment service unavailable' });
    const priceId = config.stripe.priceCreditPack;
    if (!priceId) {
      fastify.log.error('STRIPE_PRICE_CREDIT_PACK is not set');
      return reply.status(500).send({ error: 'Credit purchases are not configured yet.' });
    }
    const credits = config.credits.packSize;
    const checkout = await fastify.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { kind: 'credits', email, credits: String(credits) },
      success_url: `${config.baseUrl}/account?credits=1`,
      cancel_url: `${config.baseUrl}/account`,
      allow_promotion_codes: true,
    });
    return reply.send({ url: checkout.url });
  });

  fastify.delete<{ Params: { id: string } }>(
    '/api/developer/api-keys/:id',
    async (request, reply) => {
      const email = sessionEmail(request);
      if (!email) return reply.status(401).send({ error: 'Sign in required' });
      const { id } = request.params;
      if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid key id' });
      const ok = await revokeApiKey(fastify, email, id);
      if (!ok) return reply.status(404).send({ error: 'Key not found' });
      return reply.send({ ok: true });
    },
  );
}
