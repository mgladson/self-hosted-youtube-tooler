import { createServer } from 'node:http';
import fp from 'fastify-plugin';
import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
  Gauge,
} from 'prom-client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    metrics: {
      registry: Registry;
      serviceUp: Gauge;
      authFailuresTotal: Counter;
      rateLimitHitsTotal: Counter;
      ipBansTotal: Counter;
      httpRequestsByUaClassTotal: Counter;
    };
  }
}

const BUSINESS_PERIODS = [
  { label: '24h', interval: '24 hours' },
  { label: '7d', interval: '7 days' },
  { label: '30d', interval: '30 days' },
  { label: '90d', interval: '90 days' },
  { label: '365d', interval: '365 days' },
];

async function collectBusinessMetrics(
  fastify: FastifyInstance,
  gauges: {
    revenue: Gauge;
    orders: Gauge;
    aov: Gauge;
    grossProfit: Gauge;
    products: Gauge;
    customers: Gauge;
  },
) {
  try {
    const cached = await fastify.valkey.get('metrics:business');
    if (cached) return;

    const tableCheck = await fastify.pg.query(
      `SELECT to_regclass('public.orders') AS orders, to_regclass('public.products') AS products`,
    );
    const { orders: ordersTable, products: productsTable } = tableCheck.rows[0];
    if (!ordersTable) return;

    await Promise.all(BUSINESS_PERIODS.map(async (p) => {
      const res = await fastify.pg.query(
        `WITH order_costs AS (
           SELECT order_id, SUM(price * quantity) AS item_total
           FROM order_items GROUP BY order_id
         )
         SELECT
           COALESCE(SUM(o.total), 0)::bigint AS revenue_cents,
           COUNT(*)::int AS order_count,
           CASE WHEN COUNT(*) > 0 THEN (SUM(o.total) / COUNT(*))::bigint ELSE 0 END AS aov_cents,
           COALESCE(SUM(o.total - COALESCE(o.tax_amount, 0) - COALESCE(oc.item_total, 0)), 0)::bigint AS gross_profit_cents
         FROM orders o
         LEFT JOIN order_costs oc ON oc.order_id = o.id
         WHERE o.status IN ('paid', 'paid_held')
           AND o.created_at >= NOW() - $1::interval`,
        [p.interval],
      );
      const row = res.rows[0];
      gauges.revenue.set({ period: p.label }, Number(row.revenue_cents));
      gauges.orders.set({ period: p.label }, row.order_count);
      gauges.aov.set({ period: p.label }, Number(row.aov_cents));
      gauges.grossProfit.set({ period: p.label }, Number(row.gross_profit_cents));
    }));

    if (productsTable) {
      const prodRes = await fastify.pg.query(
        `SELECT status, COUNT(*)::int AS count FROM products GROUP BY status`,
      );
      gauges.products.reset();
      for (const row of prodRes.rows) {
        gauges.products.set({ status: row.status }, row.count);
      }

      const custRes = await fastify.pg.query(
        `SELECT COUNT(DISTINCT email)::int AS count FROM orders WHERE email IS NOT NULL`,
      );
      gauges.customers.set(custRes.rows[0].count);
    }

    await fastify.valkey.set('metrics:business', '1', 'EX', 55).catch(() => {});
  } catch {
    // Tables don't exist yet — silently skip
  }
}

async function metrics(fastify: FastifyInstance) {
  const registry = new Registry();

  registry.setDefaultLabels({ service: 'shopify-stack-api' });

  collectDefaultMetrics({ register: registry });

  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
  });

  const serviceUp = new Gauge({
    name: 'service_up',
    help: 'Whether an infrastructure service is up (1) or down (0)',
    labelNames: ['service_name'] as const,
    registers: [registry],
  });

  // Security counters
  const authFailuresTotal = new Counter({
    name: 'auth_failures_total',
    help: 'Total number of authentication failures',
    labelNames: ['reason'] as const,
    registers: [registry],
  });

  const rateLimitHitsTotal = new Counter({
    name: 'rate_limit_hits_total',
    help: 'Total number of rate limit hits (429 responses)',
    labelNames: ['endpoint'] as const,
    registers: [registry],
  });

  const ipBansTotal = new Counter({
    name: 'ip_bans_total',
    help: 'Total number of IP bans issued',
    registers: [registry],
  });

  const httpRequestsByUaClassTotal = new Counter({
    name: 'http_requests_by_ua_class_total',
    help: 'Total requests by user-agent classification',
    labelNames: ['ua_class', 'method'] as const,
    registers: [registry],
  });

  // Business metrics
  const storeRevenue = new Gauge({
    name: 'store_revenue_cents',
    help: 'Total revenue in cents for the given period',
    labelNames: ['period'] as const,
    registers: [registry],
  });

  const storeOrders = new Gauge({
    name: 'store_orders_total',
    help: 'Total number of paid orders for the given period',
    labelNames: ['period'] as const,
    registers: [registry],
  });

  const storeAov = new Gauge({
    name: 'store_avg_order_value_cents',
    help: 'Average order value in cents for the given period',
    labelNames: ['period'] as const,
    registers: [registry],
  });

  const storeGrossProfit = new Gauge({
    name: 'store_gross_profit_cents',
    help: 'Gross profit in cents for the given period',
    labelNames: ['period'] as const,
    registers: [registry],
  });

  const storeProducts = new Gauge({
    name: 'store_products_total',
    help: 'Total number of products by status',
    labelNames: ['status'] as const,
    registers: [registry],
  });

  const storeCustomers = new Gauge({
    name: 'store_customers_total',
    help: 'Total unique customers',
    registers: [registry],
  });

  const businessGauges = {
    revenue: storeRevenue,
    orders: storeOrders,
    aov: storeAov,
    grossProfit: storeGrossProfit,
    products: storeProducts,
    customers: storeCustomers,
  };

  // Collect business metrics every 60s
  let businessInterval: ReturnType<typeof setInterval> | null = null;

  fastify.addHook('onReady', async () => {
    await collectBusinessMetrics(fastify, businessGauges);
    businessInterval = setInterval(
      () => collectBusinessMetrics(fastify, businessGauges),
      60_000,
    );
  });

  fastify.addHook('onClose', async () => {
    if (businessInterval) clearInterval(businessInterval);
  });

  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const route = request.routeOptions?.url || 'NOT_FOUND';
    const labels = {
      method: request.method,
      route,
      status_code: reply.statusCode.toString(),
    };

    const duration = reply.elapsedTime / 1000;
    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
    done();
  });

  fastify.decorate('metrics', {
    registry,
    serviceUp,
    authFailuresTotal,
    rateLimitHitsTotal,
    ipBansTotal,
    httpRequestsByUaClassTotal,
  });

  const metricsPort = Number(process.env.METRICS_PORT ?? 9091);
  const metricsAddr = process.env.METRICS_LISTEN_ADDR ?? '0.0.0.0';

  const metricsServer = createServer(async (req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method !== 'GET' || path !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await registry.metrics();
      res.writeHead(200, { 'Content-Type': registry.contentType });
      res.end(body);
    } catch (err) {
      fastify.log.error({ err }, 'metrics server: failed to serialize');
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });

  metricsServer.on('error', (err) => {
    fastify.log.error({ err, metricsPort, metricsAddr }, 'metrics server failed to bind');
  });

  metricsServer.listen(metricsPort, metricsAddr, () => {
    fastify.log.info({ addr: metricsServer.address() }, 'metrics server listening');
  });

  fastify.addHook('onClose', () =>
    new Promise<void>((resolve, reject) =>
      metricsServer.close((err) => (err ? reject(err) : resolve())),
    ),
  );
}

export const metricsPlugin = fp(metrics, { name: 'metrics' });
