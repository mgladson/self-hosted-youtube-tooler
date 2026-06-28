import type { FastifyInstance } from 'fastify';

type DiscountRow = {
  id: number;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order_amount: number;
  max_uses: number | null;
  current_uses: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type ValidateDiscountBody = {
  code: string;
  orderTotal: number;
};

export async function discountRoutes(fastify: FastifyInstance) {
  // POST /api/discounts/validate — PUBLIC
  fastify.post<{ Body: ValidateDiscountBody }>(
    '/api/discounts/validate',
    async (request, reply) => {
      const { code, orderTotal } = request.body;

      if (!code || typeof code !== 'string') {
        return reply.status(400).send({ error: 'Invalid or expired code' });
      }

      if (typeof orderTotal !== 'number' || orderTotal < 0) {
        return reply.status(400).send({ error: 'Invalid order total' });
      }

      const result = await fastify.pg.query<DiscountRow>(
        `SELECT * FROM discounts WHERE UPPER(code) = UPPER($1)`,
        [code.trim()],
      );

      const discount = result.rows[0];

      if (!discount) {
        return reply.status(400).send({ error: 'Invalid or expired code' });
      }

      if (!discount.active) {
        return reply.status(400).send({ error: 'Invalid or expired code' });
      }

      const now = new Date();

      if (discount.starts_at && new Date(discount.starts_at) > now) {
        return reply.status(400).send({ error: 'Invalid or expired code' });
      }

      if (discount.ends_at && new Date(discount.ends_at) < now) {
        return reply.status(400).send({ error: 'Invalid or expired code' });
      }

      if (discount.max_uses !== null && discount.current_uses >= discount.max_uses) {
        return reply.status(400).send({ error: 'Invalid or expired code' });
      }

      const minOrder = discount.min_order_amount ?? 0;
      if (orderTotal < minOrder) {
        const minDollars = (minOrder / 100).toFixed(2);
        return reply.status(400).send({ error: `Minimum order of $${minDollars} required` });
      }

      let discountAmount: number;
      if (discount.type === 'percentage') {
        discountAmount = Math.floor(orderTotal * discount.value / 100);
      } else {
        discountAmount = Math.min(discount.value, orderTotal);
      }

      return reply.send({
        valid: true,
        type: discount.type,
        value: discount.value,
        discountAmount,
      });
    },
  );
}
