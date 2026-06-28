import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { config } from '../config.js';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    valkey: Redis;
  }
}

async function valkey(fastify: FastifyInstance) {
  const client = new Redis({
    host: config.valkey.host,
    port: config.valkey.port,
    password: config.valkey.password,
    lazyConnect: true,
    tls: config.nodeEnv === 'production' ? {} : undefined,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times: number) {
      return Math.min(times * 200, 5000);
    },
  });

  await client.connect();
  fastify.log.info('Valkey connected');

  fastify.decorate('valkey', client);

  fastify.addHook('onClose', async () => {
    await client.quit();
  });
}

export const valkeyPlugin = fp(valkey, { name: 'valkey' });
