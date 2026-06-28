import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';
import { config } from '../config.js';

type Recipient = {
  email: string;
  name: string;
};

type SendRequest = {
  recipients: Recipient[];
  subject: string;
  body: string;
};

export async function emailRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: SendRequest }>('/api/email/send', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || user.adminTier !== 'super_admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { recipients, subject, body } = request.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return reply.status(400).send({ error: 'recipients must be a non-empty array' });
    }
    if (!subject || typeof subject !== 'string') {
      return reply.status(400).send({ error: 'subject is required' });
    }
    if (!body || typeof body !== 'string') {
      return reply.status(400).send({ error: 'body is required' });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        const hmac = crypto.createHmac('sha256', config.session.secret).update(recipient.email).digest('base64url');
        const token = Buffer.from(`${recipient.email}:${hmac}`).toString('base64url');
        const unsubscribeUrl = `${config.baseUrl}/api/newsletter/unsubscribe?token=${token}`;
        await fastify.mailer.sendMail(recipient.email, subject, body, {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        });
        sent++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : 'Unknown error';
        const masked = recipient.email.replace(/^(.)(.*)(@.*)$/, (_m: string, first: string, middle: string, domain: string) => first + '*'.repeat(middle.length) + domain);
        errors.push(`${masked}: ${message}`);
        fastify.log.warn({ err, email: masked }, 'Failed to send email');
      }
    }

    if (request.session?.user) {
      const subjectPreview = subject.slice(0, 60);
      const summary = sent > 0
        ? `Sent email campaign "${subjectPreview}" to ${sent} recipient${sent !== 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}`
        : `Failed to send campaign "${subjectPreview}" — all ${failed} recipient${failed !== 1 ? 's' : ''} failed`;
      writeAuditLog(fastify, {
        userEmail: request.session.user.email,
        userName: request.session.user.name,
        action: 'send',
        resourceType: 'email_campaign',
        summary,
        ip: getClientIp(request),
      }).catch((err) => fastify.log.error({ err }, 'audit write failed'));
    }

    return reply.send({
      sent,
      failed,
      ...(errors.length > 0 ? { errors } : {}),
    });
  });
}
