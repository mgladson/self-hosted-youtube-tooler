import fp from 'fastify-plugin';
import * as Minio from 'minio';
import { config } from '../config.js';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    minio: Minio.Client;
  }
}

// Anonymous read-only (GetObject) policy. The images bucket is served straight
// to the public by Caddy (/images/* → MinIO), so it must allow anonymous reads.
function publicReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

// Make sure a bucket exists (self-heal if minio-init never ran or the volume is
// fresh) and keep the images bucket publicly readable. Best-effort: failures are
// logged but don't block API startup.
async function ensureBucket(
  fastify: FastifyInstance,
  client: Minio.Client,
  bucket: string,
  publicRead: boolean,
): Promise<void> {
  try {
    if (!(await client.bucketExists(bucket))) {
      await client.makeBucket(bucket);
      fastify.log.warn({ bucket }, 'MinIO: created missing bucket');
    }
    if (publicRead) {
      await client.setBucketPolicy(bucket, publicReadPolicy(bucket));
    }
  } catch (err) {
    fastify.log.error({ err, bucket }, 'MinIO: ensureBucket failed');
  }
}

async function minio(fastify: FastifyInstance) {
  const client = new Minio.Client({
    endPoint: config.minio.endPoint,
    port: config.minio.port,
    useSSL: config.minio.useSSL,
    accessKey: config.minio.accessKey,
    secretKey: config.minio.secretKey,
  });

  await client.listBuckets();
  fastify.log.info('MinIO connected');

  // Files bucket stays private; images bucket is public-read (Caddy serves it).
  await ensureBucket(fastify, client, config.minio.bucketFiles, false);
  await ensureBucket(fastify, client, config.minio.bucketImages, true);

  fastify.decorate('minio', client);
}

export const minioPlugin = fp(minio, { name: 'minio' });
