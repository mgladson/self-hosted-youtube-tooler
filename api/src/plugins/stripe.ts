import fp from 'fastify-plugin';
import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    stripe: Stripe;
  }
}

async function stripe(fastify: FastifyInstance) {
  if (!config.stripe.secretKey) {
    fastify.log.warn('STRIPE_SECRET_KEY not set — checkout will not work');
    return;
  }

  const client = new Stripe(config.stripe.secretKey);

  fastify.decorate('stripe', client);
  fastify.log.info('Stripe client initialized');
}

export const stripePlugin = fp(stripe, { name: 'stripe' });
