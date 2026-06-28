import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';
import { meetsMinTier } from '../plugins/auth-guard.js';

export async function supportRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: { subject?: string; body?: string; priority?: string };
  }>('/api/support/tickets', async (request, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { subject, body, priority } = request.body || {};
    if (!subject || !body) {
      return reply.status(400).send({ error: 'subject and body required' });
    }
    if (subject.length > 500 || body.length > 5000) {
      return reply.status(400).send({ error: 'Content too long' });
    }

    const validPriorities = ['low', 'medium', 'high'];
    const ticketPriority = validPriorities.includes(priority || '') ? priority : 'medium';

    const ticketResult = await fastify.pg.query(
      `INSERT INTO support_tickets (customer_email, customer_name, subject, priority)
       VALUES ($1, $2, $3, $4)
       RETURNING id, status, priority, created_at`,
      [user.email, user.name, subject.slice(0, 500), ticketPriority],
    );

    const ticket = ticketResult.rows[0];

    await fastify.pg.query(
      `INSERT INTO ticket_messages (ticket_id, sender_role, sender_name, sender_email, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [ticket.id, user.role || 'customer', user.name, user.email, body.slice(0, 5000)],
    );

    return reply.status(201).send({
      id: ticket.id,
      subject,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.created_at,
    });
  });

  fastify.get<{
    Querystring: { status?: string; customer_email?: string };
  }>('/api/support/tickets', async (request, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const isAdmin = user.role === 'admin' && meetsMinTier(user.adminTier, 'editor');
    const { status, customer_email } = request.query;

    let query = `SELECT id, customer_email, customer_name, subject, status, priority, created_at, updated_at
                 FROM support_tickets`;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (!isAdmin) {
      conditions.push(`customer_email = $${params.length + 1}`);
      params.push(user.email);
    } else if (customer_email) {
      conditions.push(`customer_email = $${params.length + 1}`);
      params.push(customer_email);
    }

    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY updated_at DESC`;

    const result = await fastify.pg.query(query, params);

    return reply.send({
      tickets: result.rows.map((r) => ({
        id: r.id,
        customerEmail: r.customer_email,
        customerName: r.customer_name,
        subject: r.subject,
        status: r.status,
        priority: r.priority,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  });

  fastify.get<{
    Params: { id: string };
  }>('/api/support/tickets/:id', async (request, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const ticketId = parseInt(request.params.id, 10);
    if (isNaN(ticketId)) return reply.status(400).send({ error: 'Invalid ticket ID' });

    const isAdmin = user.role === 'admin' && meetsMinTier(user.adminTier, 'editor');

    const ticketResult = await fastify.pg.query(
      `SELECT id, customer_email, customer_name, subject, status, priority, created_at, updated_at
       FROM support_tickets WHERE id = $1`,
      [ticketId],
    );

    if (ticketResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];

    if (!isAdmin && ticket.customer_email !== user.email) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const messagesResult = await fastify.pg.query(
      `SELECT id, sender_role, sender_name, sender_email, body, created_at
       FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [ticketId],
    );

    return reply.send({
      ticket: {
        id: ticket.id,
        customerEmail: ticket.customer_email,
        customerName: ticket.customer_name,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
      },
      messages: messagesResult.rows.map((m) => ({
        id: m.id,
        senderRole: m.sender_role,
        senderName: m.sender_name,
        senderEmail: m.sender_email,
        body: m.body,
        createdAt: m.created_at,
      })),
    });
  });

  fastify.post<{
    Params: { id: string };
    Body: { body?: string };
  }>('/api/support/tickets/:id/messages', async (request, reply) => {
    const user = request.session?.user;
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const ticketId = parseInt(request.params.id, 10);
    if (isNaN(ticketId)) return reply.status(400).send({ error: 'Invalid ticket ID' });

    const { body } = request.body || {};
    if (!body) return reply.status(400).send({ error: 'body required' });
    if (body.length > 5000) return reply.status(400).send({ error: 'Message too long' });

    const isAdmin = user.role === 'admin' && meetsMinTier(user.adminTier, 'editor');

    const ticketResult = await fastify.pg.query(
      `SELECT id, customer_email, status FROM support_tickets WHERE id = $1`,
      [ticketId],
    );

    if (ticketResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];

    if (!isAdmin && ticket.customer_email !== user.email) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    if (ticket.status === 'closed') {
      return reply.status(400).send({ error: 'Ticket is closed' });
    }

    await fastify.pg.query(
      `INSERT INTO ticket_messages (ticket_id, sender_role, sender_name, sender_email, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [ticketId, user.role || 'customer', user.name, user.email, body.slice(0, 5000)],
    );

    await fastify.pg.query(
      `UPDATE support_tickets SET updated_at = NOW() WHERE id = $1`,
      [ticketId],
    );

    return reply.status(201).send({ ok: true });
  });

  fastify.patch<{
    Params: { id: string };
    Body: { status?: string; priority?: string };
  }>('/api/support/tickets/:id', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Admin only' });
    }

    const ticketId = parseInt(request.params.id, 10);
    if (isNaN(ticketId)) return reply.status(400).send({ error: 'Invalid ticket ID' });

    const { status, priority } = request.body || {};

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      updates.push(`status = $${idx}`);
      params.push(status);
      idx++;
    }

    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      updates.push(`priority = $${idx}`);
      params.push(priority);
      idx++;
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(ticketId);

    const result = await fastify.pg.query(
      `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const t = result.rows[0];

    const parts: string[] = [];
    if (status) parts.push(`status → ${status}`);
    if (priority) parts.push(`priority → ${priority}`);
    writeAuditLog(fastify, {
      userEmail: user.email,
      userName: user.name,
      action: 'update',
      resourceType: 'support_ticket',
      resourceId: String(ticketId),
      summary: `Ticket #${ticketId} updated: ${parts.join(', ')}`,
      ip: getClientIp(request),
    }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

    return reply.send({
      id: t.id,
      status: t.status,
      priority: t.priority,
      updatedAt: t.updated_at,
    });
  });
}
