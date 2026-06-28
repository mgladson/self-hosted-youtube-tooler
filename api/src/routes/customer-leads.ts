import type { FastifyInstance } from 'fastify';
import { meetsMinTier } from '../plugins/auth-guard.js';

type CustomerLeadRow = {
  email: string;
  name: string;
  picture: string | null;
  first_seen: string;
  last_seen: string;
  login_count: number;
};

export async function customerLeadsRoutes(fastify: FastifyInstance) {
  // Admin-only: list captured customer leads — anyone who signed in with Google
  // to view gated helper profiles — most-recent activity first. Not under a
  // public prefix, so the global guard already requires a session; the tier
  // check restricts it to editor+ admins.
  fastify.get('/api/customer-leads', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = await fastify.pg.query<CustomerLeadRow>(
      `SELECT email, name, picture, first_seen, last_seen, login_count
       FROM customer_leads
       ORDER BY last_seen DESC
       LIMIT 1000`,
    );

    reply.header('Cache-Control', 'no-store');
    return reply.send({ leads: result.rows });
  });
}
