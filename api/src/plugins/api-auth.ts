// Bearer-token authentication for the public /api/v1 API. Decorates the instance
// with `apiKeyAuth`, which each v1 route calls first: it parses the Authorization
// header, resolves the key to its owner, and returns the caller — or sends a 401 and
// returns null (the route then just returns the reply). The v1 routes are listed as a
// PUBLIC_PREFIX in the auth-guard so the session guard lets them through; this is their
// real gate.

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { findKeyByToken, touchLastUsed } from '../lib/api-keys.js';

export type ApiCaller = { email: string; keyId: string };

declare module 'fastify' {
  interface FastifyInstance {
    apiKeyAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<ApiCaller | null>;
  }
}

async function apiAuth(fastify: FastifyInstance) {
  fastify.decorate(
    'apiKeyAuth',
    async (request: FastifyRequest, reply: FastifyReply): Promise<ApiCaller | null> => {
      const raw = request.headers['authorization'];
      const header = Array.isArray(raw) ? raw[0] : raw || '';
      const match = /^Bearer\s+(.+)$/i.exec(header.trim());
      if (!match) {
        reply.status(401).send({
          error: 'Missing API key. Send "Authorization: Bearer <key>".',
          code: 'unauthorized',
        });
        return null;
      }

      let found: { id: string; email: string } | null = null;
      try {
        found = await findKeyByToken(fastify, match[1].trim());
      } catch (err) {
        fastify.log.warn({ err }, 'api key lookup failed');
        reply.status(500).send({ error: 'Could not verify the API key.', code: 'internal' });
        return null;
      }
      if (!found) {
        reply.status(401).send({ error: 'Invalid or revoked API key.', code: 'invalid_api_key' });
        return null;
      }

      touchLastUsed(fastify, found.id);
      return { email: found.email, keyId: found.id };
    },
  );
}

export const apiAuthPlugin = fp(apiAuth, { name: 'api-auth', dependencies: ['postgres'] });
