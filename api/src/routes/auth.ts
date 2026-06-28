import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getClientIp } from '../lib/client-ip.js';

type OAuthState = {
  role: 'admin' | 'customer';
  nonce: string;
  returnTo?: string;
};

// Only same-site absolute paths may be used as a post-login redirect target.
// Blocks protocol-relative (//host), backslash tricks (/\host), absolute URLs
// (http://…), and any whitespace (CR/LF header-injection vector) — i.e.
// open-redirect prevention. Returns undefined for anything unsafe.
function safeReturnTo(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return undefined;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return undefined;
  if (/\s/.test(raw)) return undefined;
  return raw;
}

function parseState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if ((parsed.role === 'admin' || parsed.role === 'customer') && typeof parsed.nonce === 'string' && parsed.nonce.length > 0) {
      return { role: parsed.role, nonce: parsed.nonce, returnTo: safeReturnTo(parsed.returnTo) };
    }
  } catch {}
  return null;
}

const NONCE_TTL = 300; // 5 minutes

// Rate limit admin OAuth initiation: 5 attempts per IP per 15 minutes.
// Prevents enumeration of admin email list and nonce flooding.
const ADMIN_OAUTH_RL_MAX = 5;
const ADMIN_OAUTH_RL_WINDOW = 15 * 60;

// Record (or refresh) a customer lead whenever someone signs in to view the
// login-gated helper profiles. Fire-and-forget — a slow or failed write must
// never block login. Dedup by email via upsert; repeat visits bump last_seen
// and login_count.
function recordCustomerLead(
  fastify: FastifyInstance,
  lead: { email: string; name: string; picture: string },
): void {
  fastify.pg
    .query(
      `INSERT INTO customer_leads (email, name, picture)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET last_seen = NOW(),
             login_count = customer_leads.login_count + 1,
             name = EXCLUDED.name,
             picture = EXCLUDED.picture`,
      [lead.email.toLowerCase(), lead.name, lead.picture],
    )
    .catch((err: unknown) => fastify.log.error({ err }, 'Failed to record customer lead'));
}

export async function authRoutes(fastify: FastifyInstance) {
  const oauth2Client = new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.callbackUrl,
  );

  fastify.get('/api/auth/google', async (request, reply) => {
    // Rate-limit admin OAuth initiations per IP
    const rlKey = `oauth:admin:rl:${getClientIp(request)}`;
    const count = await fastify.valkey.incr(rlKey);
    if (count === 1) {
      await fastify.valkey.expire(rlKey, ADMIN_OAUTH_RL_WINDOW);
    }
    if (count > ADMIN_OAUTH_RL_MAX) {
      return reply.status(429).send({ error: 'Too many requests' });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    await fastify.valkey.set(`oauth:nonce:${nonce}`, 'admin', 'EX', NONCE_TTL);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',
      state: JSON.stringify({ role: 'admin', nonce }),
    });
    return reply.redirect(url);
  });

  fastify.get<{ Querystring: { returnTo?: string } }>(
    '/api/auth/customer/google',
    async (request, reply) => {
      const nonce = crypto.randomBytes(16).toString('hex');
      await fastify.valkey.set(`oauth:nonce:${nonce}`, 'customer', 'EX', NONCE_TTL);
      const returnTo = safeReturnTo(request.query.returnTo);
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['openid', 'email', 'profile'],
        prompt: 'select_account',
        state: JSON.stringify({ role: 'customer', nonce, returnTo }),
      });
      return reply.redirect(url);
    },
  );

  fastify.get<{ Querystring: { code?: string; error?: string; state?: string } }>(
    '/api/auth/google/callback',
    async (request, reply) => {
      const { code, error, state } = request.query;

      const parsed = parseState(state);
      if (!parsed) {
        return reply.redirect('/login?error=invalid_state');
      }

      const { role, nonce } = parsed;
      const errorRedirect = role === 'customer' ? '/login' : '/admin/login';
      const successRedirect = role === 'customer' ? (parsed.returnTo ?? '/account') : '/admin/';

      // Verify and consume the nonce atomically — prevents CSRF and replay
      const storedRole = await fastify.valkey.getdel(`oauth:nonce:${nonce}`);
      if (!storedRole || storedRole !== role) {
        return reply.redirect(`${errorRedirect}?error=invalid_state`);
      }

      if (error || !code) {
        return reply.redirect(`${errorRedirect}?error=oauth_denied`);
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.id_token) {
          const result = await fastify.authGuard.recordFailedAttempt(getClientIp(request));
          if (result.banned) return reply.status(403).send({ error: 'Forbidden' });
          if (result.cooldown) return reply.redirect(`${errorRedirect}?error=rate_limited`);
          return reply.redirect(`${errorRedirect}?error=oauth_failed`);
        }

        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token,
          audience: config.google.clientId,
        });
        const payload = ticket.getPayload();
        const email = payload?.email;

        if (!email) {
          const result = await fastify.authGuard.recordFailedAttempt(getClientIp(request));
          if (result.banned) return reply.status(403).send({ error: 'Forbidden' });
          if (result.cooldown) return reply.redirect(`${errorRedirect}?error=rate_limited`);
          return reply.redirect(`${errorRedirect}?error=no_email`);
        }

        if (role === 'admin') {
          if (!fastify.authGuard.isAdminEmail(email)) {
            const result = await fastify.authGuard.recordFailedAttempt(getClientIp(request));
            if (result.banned) return reply.status(403).send({ error: 'Forbidden' });
            if (result.cooldown) return reply.redirect(`${errorRedirect}?error=rate_limited`);
            return reply.redirect(`${errorRedirect}?error=not_authorized`);
          }
        }

        request.session.user = {
          email,
          name: payload?.name || email.split('@')[0],
          picture: payload?.picture || '',
          role,
          ...(role === 'admin' ? { adminTier: fastify.authGuard.getAdminTier(email) ?? 'viewer' } : {}),
        };

        if (role === 'customer') {
          recordCustomerLead(fastify, {
            email,
            name: payload?.name || email.split('@')[0],
            picture: payload?.picture || '',
          });
        }

        return reply.redirect(successRedirect);
      } catch (err) {
        fastify.log.error({ err }, 'OAuth callback error');
        const result = await fastify.authGuard.recordFailedAttempt(getClientIp(request));
        if (result.banned) return reply.status(403).send({ error: 'Forbidden' });
        if (result.cooldown) return reply.redirect(`${errorRedirect}?error=rate_limited`);
        return reply.redirect(`${errorRedirect}?error=oauth_failed`);
      }
    },
  );

  if (config.devFeaturesEnabled) {
    fastify.post<{ Body: { email?: string; role?: 'admin' | 'customer' } }>(
      '/api/auth/dev-login',
      async (request, reply) => {
        const email = request.body?.email || 'test@pixelcart.com';
        const role = request.body?.role || 'admin';

        if (fastify.authGuard.isBannedIp(getClientIp(request))) {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        if (role === 'admin' && !fastify.authGuard.isAdminEmail(email)) {
          return reply.status(403).send({ error: 'Email not in admin list' });
        }

        request.session.user = {
          email,
          name: email.split('@')[0],
          picture: '',
          role,
          ...(role === 'admin' ? { adminTier: fastify.authGuard.getAdminTier(email) ?? 'viewer' } : {}),
        };

        if (role === 'customer') {
          recordCustomerLead(fastify, { email, name: email.split('@')[0], picture: '' });
        }

        return reply.send({ ok: true });
      },
    );
  }

  fastify.get('/api/auth/me', async (request, reply) => {
    if (!request.session?.user) {
      return reply.send({ user: null });
    }
    return reply.send({ user: request.session.user });
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    await request.session.destroy();
    return reply.send({ ok: true });
  });
}
