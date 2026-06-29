import crypto from 'node:crypto';
import Fastify from 'fastify';
import { config } from './config.js';
import { getClientIp } from './lib/client-ip.js';
import { metricsPlugin } from './plugins/metrics.js';
import { postgresPlugin } from './plugins/postgres.js';
import { valkeyPlugin } from './plugins/valkey.js';
import { minioPlugin } from './plugins/minio.js';
import { r2Plugin } from './plugins/r2.js';
import { mailerPlugin } from './plugins/mailer.js';
import { sessionPlugin } from './plugins/session.js';
import { authGuardPlugin } from './plugins/auth-guard.js';
import { botDetectorPlugin } from './plugins/bot-detector.js';
import { healthRoutes } from './routes/health.js';
import { emailRoutes } from './routes/email.js';
import { authRoutes } from './routes/auth.js';
import { analyticsRoutes } from './routes/analytics.js';
import { bannerRoutes } from './routes/banner.js';
import { pagesRoutes } from './routes/pages.js';
import { invoicesRoutes } from './routes/invoices.js';
import { supportRoutes } from './routes/support.js';
import { stripePlugin } from './plugins/stripe.js';
import { sanctionsPlugin } from './plugins/sanctions.js';
import { checkoutRoutes } from './routes/checkout.js';
import { downloadRoutes } from './routes/download.js';
import { newsletterRoutes } from './routes/newsletter.js';
import { auditRoutes } from './routes/audit.js';
import { securityRoutes } from './routes/security.js';
import { reconciliationRoutes } from './routes/reconciliation.js';
import { blogRoutes } from './routes/blog.js';
import { discountRoutes } from './routes/discounts.js';
import { customerOrderRoutes } from './routes/orders.js';
import { customerLeadsRoutes } from './routes/customer-leads.js';
import { reviewRoutes } from './routes/reviews.js';
import { adsRoutes } from './routes/ads.js';
import { adminSyncRoutes } from './routes/admin-sync.js';
import { youtubeRoutes } from './routes/youtube.js';
import { billingRoutes } from './routes/billing.js';
import { runMigrations } from './migrate.js';

export function buildApp() {
  const app = Fastify({
    trustProxy: 1,
    logger: {
      level: config.nodeEnv === 'development' ? 'info' : 'warn',
      base: {
        service: 'shopify-stack-api',
        environment: config.nodeEnv,
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
            clientIp: getClientIp(request),
          };
        },
        res(reply) {
          return {
            statusCode: reply.statusCode,
          };
        },
      },
    },
    genReqId: (request) =>
      (request.headers['x-request-id'] as string) || crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
  });

  const allowedOrigins = new Set(
    (process.env.CORS_ALLOWED_ORIGINS || config.baseUrl).split(',').map((o) => o.trim()),
  );

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      reply.header('Access-Control-Max-Age', '86400');
      return reply.status(204).send();
    }

    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
      const isWebhook = request.url.startsWith('/api/checkout/webhook');
      // Non-browser actors (GH Action toggle workflow, future server-to-server callers)
      // declare themselves by sending X-Service-Token. CSRF protection targets browser
      // CSRF, which is moot when the caller isn't a browser. The token itself is still
      // validated inside the per-route authorizeWriteOrReject — a forged or wrong token
      // gets rejected there.
      const hasServiceToken = typeof request.headers['x-service-token'] === 'string';
      if (!isWebhook && !hasServiceToken) {
        const requestOrigin = request.headers.origin;
        const referer = request.headers.referer;
        if (requestOrigin) {
          if (!allowedOrigins.has(requestOrigin)) {
            return reply.status(403).send({ error: 'Origin not allowed' });
          }
        } else if (referer) {
          try {
            const refOrigin = new URL(referer).origin;
            if (!allowedOrigins.has(refOrigin)) {
              return reply.status(403).send({ error: 'Origin not allowed' });
            }
          } catch {
            return reply.status(403).send({ error: 'Origin not allowed' });
          }
        } else {
          return reply.status(403).send({ error: 'Origin header required' });
        }
      }
    }
  });

  app.register(metricsPlugin);
  app.register(postgresPlugin);
  app.register(valkeyPlugin);
  app.register(minioPlugin);
  app.register(r2Plugin);
  app.register(mailerPlugin);
  app.register(sessionPlugin);
  app.register(stripePlugin);
  app.register(sanctionsPlugin);
  app.register(authGuardPlugin);
  app.register(botDetectorPlugin);
  app.register(healthRoutes);
  app.register(emailRoutes);
  app.register(authRoutes);
  app.register(analyticsRoutes);
  app.register(bannerRoutes);
  app.register(pagesRoutes);
  app.register(invoicesRoutes);
  app.register(supportRoutes);
  app.register(checkoutRoutes);
  app.register(downloadRoutes);
  app.register(newsletterRoutes);
  app.register(auditRoutes);
  app.register(securityRoutes);
  app.register(reconciliationRoutes);
  app.register(blogRoutes);
  app.register(discountRoutes);
  app.register(customerOrderRoutes);
  app.register(customerLeadsRoutes);
  app.register(reviewRoutes);
  app.register(adsRoutes);
  app.register(adminSyncRoutes);
  app.register(youtubeRoutes);
  app.register(billingRoutes);

  // AML-3 / PAY-4: refuse to start if compliance-critical tables are missing.
  // These tables back velocity_flag / sanctions_block / discount-rollback paths;
  // if the migrations haven't run, those code paths fail-open silently.
  // Using onReady so plugins (postgres) are guaranteed registered first.
  app.addHook('onReady', async () => {
    const required = ['compliance_review_queue', 'discount_usage_log'];
    for (const table of required) {
      const res = await app.pg.query<{ to_regclass: string | null }>(
        `SELECT to_regclass($1) AS to_regclass`,
        [`public.${table}`],
      );
      if (res.rows[0]?.to_regclass === null) {
        throw new Error(
          `Required compliance table missing: ${table}. Run migrations before starting the API.`,
        );
      }
    }
  });

  return app;
}

async function start() {
  const app = buildApp();

  try {
    if (config.nodeEnv === 'development') {
      app.log.info('Running database migrations...');
      await runMigrations();
      app.log.info('Migrations complete');
    }

    await app.listen({ host: config.api.host, port: config.api.port });
    app.log.info(`API server running on ${config.api.host}:${config.api.port}`);

    for (const sig of ['SIGTERM', 'SIGINT'] as const) {
      process.on(sig, () => {
        app.log.info(`Received ${sig}, shutting down`);
        void app.close()
          .then(() => process.exit(0))
          .catch((err) => {
            app.log.error({ err }, 'shutdown failed');
            process.exit(1);
          });
      });
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
