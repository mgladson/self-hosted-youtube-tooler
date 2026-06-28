import fp from 'fastify-plugin';
import pg from 'pg';
import { config } from '../config.js';
import type { FastifyInstance } from 'fastify';

const { Pool } = pg;

declare module 'fastify' {
  interface FastifyInstance {
    pg: pg.Pool;
  }
}

async function postgres(fastify: FastifyInstance) {
  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password,
    max: config.postgres.max,
    idleTimeoutMillis: config.postgres.idleTimeoutMillis,
    connectionTimeoutMillis: config.postgres.connectionTimeoutMillis,
    statement_timeout: 30000,
    ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: true } : false,
  });

  const client = await pool.connect();
  client.release();
  fastify.log.info('PostgreSQL connected');

  fastify.decorate('pg', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
}

export const postgresPlugin = fp(postgres, { name: 'postgres' });
