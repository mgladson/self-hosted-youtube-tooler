import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export async function downloadRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: { orderId: string; productId: string };
    Querystring: { token?: string };
  }>(
    '/api/download/:orderId/:productId',
    async (request, reply) => {
      const { orderId, productId } = request.params;
      const { token } = request.query;

      if (!token) {
        return reply.status(401).send({ error: 'Access token required' });
      }

      if (!/^[0-9a-f-]{36}$/.test(orderId)) {
        return reply.status(400).send({ error: 'Invalid order ID' });
      }

      const orderRes = await fastify.pg.query<{
        id: string;
        status: string;
        order_token: string;
      }>(
        `SELECT id, status, order_token FROM orders WHERE id = $1`,
        [orderId],
      );

      if (orderRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      const order = orderRes.rows[0];

      // Constant-time comparison prevents timing-based token enumeration attacks.
      if (
        token.length !== order.order_token.length ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(order.order_token))
      ) {
        return reply.status(403).send({ error: 'Invalid access token' });
      }

      // Revocation check — chargebacked or refunded orders cannot download.
      // Marking an order status to anything other than 'paid' instantly revokes access.
      if (order.status !== 'paid') {
        return reply.status(402).send({ error: 'Download not available — order is not in paid status' });
      }

      // Verify the product actually belongs to this order (prevents cross-order access).
      const itemRes = await fastify.pg.query(
        `SELECT product_id FROM order_items WHERE order_id = $1 AND product_id = $2`,
        [orderId, productId],
      );

      if (itemRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Product not found in this order' });
      }

      // Short-lived presigned URL (5 minutes) limits exposure if a URL is leaked or logged.
      // The long-lived links are never sent to the client directly.
      const objectName = `${productId}/download.zip`;
      try {
        const url = await fastify.minio.presignedGetObject(
          config.minio.bucketFiles,
          objectName,
          5 * 60,
        );
        return reply.redirect(url, 302);
      } catch {
        return reply.status(404).send({ error: 'File not available' });
      }
    },
  );
}
