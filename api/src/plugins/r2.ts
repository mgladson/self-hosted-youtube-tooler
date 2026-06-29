import fp from 'fastify-plugin';
import * as Minio from 'minio';
import { config } from '../config.js';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    // Only decorated when R2 env is configured. Consumers MUST guard
    // (`if (fastify.r2)`) and fall back to direct streaming when it is absent.
    r2?: Minio.Client;
  }
}

// Reclaim cached objects ~a day after upload. The download route also enforces a
// hard 24h freshness on read, so this is just storage hygiene — and tolerant of
// R2 rejecting it (in which case set the same rule in the Cloudflare dashboard).
async function ensureLifecycle(
  fastify: FastifyInstance,
  client: Minio.Client,
  bucket: string,
): Promise<void> {
  try {
    if (!(await client.bucketExists(bucket))) {
      await client.makeBucket(bucket);
      fastify.log.warn({ bucket }, 'R2: created missing bucket');
    }
  } catch (err) {
    fastify.log.error({ err, bucket }, 'R2: bucket check/create failed (continuing)');
  }

  const lifecycle = {
    Rule: [
      {
        ID: 'expire-yt-download-cache',
        Status: 'Enabled',
        Filter: { Prefix: 'yt/' },
        Expiration: { Days: 1 },
      },
    ],
  };
  try {
    await client.setBucketLifecycle(
      bucket,
      lifecycle as Parameters<typeof client.setBucketLifecycle>[1],
    );
  } catch (err) {
    fastify.log.warn(
      { err, bucket },
      'R2: could not set lifecycle rule — add a 1-day expiry on the "yt/" prefix in the Cloudflare dashboard',
    );
  }
}

async function r2(fastify: FastifyInstance) {
  if (!config.r2.enabled) {
    fastify.log.info('R2 not configured — YouTube downloads stream directly (no cache)');
    return;
  }

  const client = new Minio.Client({
    endPoint: config.r2.endPoint,
    port: 443,
    useSSL: true,
    region: 'auto',
    accessKey: config.r2.accessKey,
    secretKey: config.r2.secretKey,
  });

  await ensureLifecycle(fastify, client, config.r2.bucket);

  fastify.decorate('r2', client);
  fastify.log.info('R2 client initialized');
}

export const r2Plugin = fp(r2, { name: 'r2' });
