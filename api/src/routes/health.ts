import type { FastifyInstance } from 'fastify';

interface ServiceStatus {
  postgres: 'up' | 'down';
  valkey: 'up' | 'down';
  minio: 'up' | 'down';
}

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/api/health', async (request, reply) => {
    const services: ServiceStatus = {
      postgres: 'down',
      valkey: 'down',
      minio: 'down',
    };

    await Promise.allSettled([
      fastify.pg.query('SELECT 1').then(() => { services.postgres = 'up'; }),
      fastify.valkey.ping().then(() => { services.valkey = 'up'; }),
      fastify.minio.listBuckets().then(() => { services.minio = 'up'; }),
    ]);

    if (fastify.metrics) {
      fastify.metrics.serviceUp.set({ service_name: 'postgres' }, services.postgres === 'up' ? 1 : 0);
      fastify.metrics.serviceUp.set({ service_name: 'valkey' }, services.valkey === 'up' ? 1 : 0);
      fastify.metrics.serviceUp.set({ service_name: 'minio' }, services.minio === 'up' ? 1 : 0);
    }

    const allUp = Object.values(services).every((s) => s === 'up');
    const statusCode = allUp ? 200 : 503;

    // Only expose per-service detail to authenticated admins; public callers get pass/fail only
    const isAdmin = request.session?.user?.role === 'admin';

    return reply.status(statusCode).send({
      status: allUp ? 'ok' : 'degraded',
      ...(isAdmin ? { services } : {}),
    });
  });
}
