import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';
import { meetsMinTier } from '../plugins/auth-guard.js';
import { getClientIp } from '../lib/client-ip.js';
import { config } from '../config.js';

type Subscriber = {
  email: string;
  subscribedAt: string;
};

type NewsletterData = {
  enabled: boolean;
  subscribers: Subscriber[];
  updatedAt: string;
};

const NEWSLETTER_PATH = path.resolve(process.cwd(), '..', 'data', 'newsletter.json');

const DEFAULT_DATA: NewsletterData = {
  enabled: true,
  subscribers: [],
  updatedAt: '',
};

let cachedNewsletter: NewsletterData | null = null;
let newsletterCacheTime = 0;
const NEWSLETTER_CACHE_TTL = 5_000;

let fileOpQueue: Promise<void> = Promise.resolve();

async function readNewsletter(): Promise<NewsletterData> {
  const now = Date.now();
  if (cachedNewsletter && now - newsletterCacheTime < NEWSLETTER_CACHE_TTL) return cachedNewsletter;
  try {
    const raw = await fs.readFile(NEWSLETTER_PATH, 'utf-8');
    const result: NewsletterData = { ...DEFAULT_DATA, ...JSON.parse(raw) };
    cachedNewsletter = result;
    newsletterCacheTime = now;
    return result;
  } catch {
    return { ...DEFAULT_DATA };
  }
}

// TODO(perf): Newsletter subscribers are stored in a single JSON file and the
// entire array is serialized + rewritten on every subscribe/unsubscribe. This
// is O(N) per write and starts hurting once the list exceeds a few thousand
// rows. Migrate subscribers to a Postgres table (newsletter_subscribers) so
// inserts/deletes are O(log N) and concurrent writes don't have to serialize
// through fileOpQueue. Tracked separately because it requires a DB migration.
async function writeNewsletter(data: NewsletterData): Promise<void> {
  const op = async () => {
    await fs.writeFile(NEWSLETTER_PATH, JSON.stringify(data, null, 2) + '\n');
    cachedNewsletter = null;
  };
  fileOpQueue = fileOpQueue.then(op, op);
  await fileOpQueue;
}

export async function removeSubscriber(email: string): Promise<boolean> {
  const data = await readNewsletter();
  const before = data.subscribers.length;
  data.subscribers = data.subscribers.filter((s) => s.email !== email);
  if (data.subscribers.length < before) {
    data.updatedAt = new Date().toISOString();
    await writeNewsletter(data);
    return true;
  }
  return false;
}

function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const sepIdx = decoded.lastIndexOf(':');
    if (sepIdx === -1) return null;
    const email = decoded.slice(0, sepIdx);
    const hmac = decoded.slice(sepIdx + 1);
    const expected = crypto.createHmac('sha256', config.session.secret).update(email).digest('base64url');
    if (hmac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
      return null;
    }
    return email;
  } catch {
    return null;
  }
}

const SUBSCRIBE_RL_PREFIX = 'newsletter:sub:rl:';
const SUBSCRIBE_RL_MAX = 5;
const SUBSCRIBE_RL_WINDOW = 60;

const UNSUB_RL_PREFIX = 'newsletter:unsub:rl:';
const UNSUB_RL_MAX = 5;
const UNSUB_RL_WINDOW = 60;

export async function newsletterRoutes(fastify: FastifyInstance) {
  fastify.get('/api/newsletter/settings', async (_request, reply) => {
    const data = await readNewsletter();
    reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return reply.send({ enabled: data.enabled });
  });

  fastify.put<{ Body: { enabled: boolean } }>(
    '/api/newsletter/settings',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const { enabled } = request.body;
      if (typeof enabled !== 'boolean') {
        return reply.status(400).send({ error: 'enabled must be a boolean' });
      }
      const data = await readNewsletter();
      data.enabled = enabled;
      data.updatedAt = new Date().toISOString();
      try {
        await writeNewsletter(data);
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write newsletter.json');
        return reply.status(500).send({ error: 'Failed to save settings' });
      }
      writeAuditLog(fastify, {
        userEmail: user.email,
        userName: user.name,
        action: 'update',
        resourceType: 'newsletter',
        summary: `Newsletter ${enabled ? 'enabled' : 'disabled'}`,
        ip: getClientIp(request),
      }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

      return reply.send({ enabled: data.enabled });
    },
  );

  fastify.post<{ Body: { email: string } }>(
    '/api/newsletter/subscribe',
    async (request, reply) => {
      const { email } = request.body ?? {};
      if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.status(400).send({ error: 'Valid email is required' });
      }

      const normalised = email.toLowerCase().trim();

      // Customers may only subscribe their own account email
      const sessionUser = request.session?.user;
      if (sessionUser && sessionUser.role !== 'admin' && sessionUser.email !== normalised) {
        return reply.status(403).send({ error: 'You may only subscribe your own email address' });
      }

      // Per-IP rate limit: 5 subscribe attempts per 60s
      const rlKey = `${SUBSCRIBE_RL_PREFIX}${getClientIp(request)}`;
      const rlResults = await fastify.valkey.multi().incr(rlKey).expire(rlKey, SUBSCRIBE_RL_WINDOW).exec();
      const rlCount = (rlResults?.[0]?.[1] as number) ?? 0;
      if (rlCount > SUBSCRIBE_RL_MAX) {
        return reply.status(429).send({ error: 'Too many requests' });
      }

      const data = await readNewsletter();

      if (!data.enabled) {
        return reply.status(400).send({ error: 'Newsletter is currently disabled' });
      }

      if (data.subscribers.some((s) => s.email === normalised)) {
        return reply.send({ ok: true, message: 'Already subscribed' });
      }

      data.subscribers.push({ email: normalised, subscribedAt: new Date().toISOString() });
      data.updatedAt = new Date().toISOString();

      try {
        await writeNewsletter(data);
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write newsletter.json');
        return reply.status(500).send({ error: 'Failed to save subscription' });
      }

      return reply.send({ ok: true, message: 'Subscribed successfully' });
    },
  );

  // CAN-SPAM: public unsubscribe endpoint — no auth required.
  // Linked from the List-Unsubscribe header in campaign emails.
  // Also accepts RFC 8058 One-Click: application/x-www-form-urlencoded with List-Unsubscribe=One-Click
  // (email passed via query parameter in the List-Unsubscribe URL).
  fastify.post<{ Body: { email?: string; 'List-Unsubscribe'?: string }; Querystring: { email?: string; token?: string } }>(
    '/api/newsletter/unsubscribe',
    async (request, reply) => {
      const rlKey = `${UNSUB_RL_PREFIX}${getClientIp(request)}`;
      const rlResults = await fastify.valkey.multi().incr(rlKey).expire(rlKey, UNSUB_RL_WINDOW).exec();
      const rlCount = (rlResults?.[0]?.[1] as number) ?? 0;
      if (rlCount > UNSUB_RL_MAX) {
        return reply.status(429).send({ error: 'Too many requests' });
      }

      let email: string | undefined;
      const contentType = request.headers['content-type'] ?? '';

      if (request.query.token) {
        const verified = verifyUnsubscribeToken(request.query.token);
        if (!verified) {
          return reply.status(400).send({ error: 'Invalid or expired unsubscribe token' });
        }
        email = verified;
      } else {
        return reply.status(400).send({ error: 'A valid unsubscribe token is required' });
      }

      if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.status(400).send({ error: 'Valid email is required' });
      }

      const normalised = email.toLowerCase().trim();
      try {
        await removeSubscriber(normalised);
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write newsletter.json');
        return reply.status(500).send({ error: 'Failed to process unsubscribe' });
      }
      return reply.send({ ok: true, message: 'Unsubscribed' });
    },
  );

  fastify.get('/api/newsletter/subscribers', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const data = await readNewsletter();
    return reply.send({ subscribers: data.subscribers, enabled: data.enabled, total: data.subscribers.length });
  });

  fastify.delete<{ Params: { email: string } }>(
    '/api/newsletter/subscribers/:email',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const email = decodeURIComponent(request.params.email).toLowerCase().trim();
      const data = await readNewsletter();
      const before = data.subscribers.length;
      data.subscribers = data.subscribers.filter((s) => s.email !== email);
      if (data.subscribers.length === before) {
        return reply.status(404).send({ error: 'Subscriber not found' });
      }
      data.updatedAt = new Date().toISOString();
      try {
        await writeNewsletter(data);
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write newsletter.json');
        return reply.status(500).send({ error: 'Failed to remove subscriber' });
      }
      writeAuditLog(fastify, {
        userEmail: user.email,
        userName: user.name,
        action: 'delete',
        resourceType: 'subscriber',
        resourceId: email,
        summary: `Removed newsletter subscriber ${email}`,
        ip: getClientIp(request),
      }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

      return reply.send({ ok: true });
    },
  );
}
