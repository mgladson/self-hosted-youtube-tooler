import type { FastifyInstance } from 'fastify';
import { meetsMinTier } from '../plugins/auth-guard.js';

const VALID_RESOURCE_TYPES = new Set([
  'banner',
  'page',
  'support_ticket',
  'email_campaign',
  'newsletter',
  'subscriber',
  'order',
  'ip_ban',
  'blog_post',
  'reconciliation',
  'ads',
  'customer',
  'sanctions',
]);

export async function auditRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: { page?: string; limit?: string; resource_type?: string };
  }>('/api/audit/logs', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'admin')) {
      return reply.status(403).send({ error: 'Admin only' });
    }

    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '50', 10) || 50));
    const offset = (page - 1) * limit;

    const resourceType =
      request.query.resource_type && VALID_RESOURCE_TYPES.has(request.query.resource_type)
        ? request.query.resource_type
        : null;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (resourceType) {
      conditions.push(`resource_type = $${idx}`);
      params.push(resourceType);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const logsResult = await fastify.pg.query<{
      id: number; user_email: string; user_name: string; action: string;
      resource_type: string; resource_id: string | null; summary: string;
      ip_address: string | null; created_at: string; total: string;
    }>(
      `SELECT id, user_email, user_name, action, resource_type, resource_id, summary, ip_address, created_at,
              COUNT(*) OVER() AS total
       FROM audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    const total = logsResult.rows.length > 0 ? parseInt(logsResult.rows[0].total, 10) : 0;

    return reply.send({
      logs: logsResult.rows.map((r) => ({
        id: r.id,
        userEmail: r.user_email,
        userName: r.user_name,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        summary: r.summary,
        ipAddress: r.ip_address,
        createdAt: r.created_at,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  });
}
