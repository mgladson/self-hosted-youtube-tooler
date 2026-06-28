import type { FastifyInstance } from 'fastify';

type OrderItem = {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  tax_amount: number;
  created_at: string;
  order_token: string;
};

export async function customerOrderRoutes(fastify: FastifyInstance) {
  // GET /api/customer/orders — list all orders for the authenticated customer
  fastify.get('/api/customer/orders', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'customer') {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const ordersResult = await fastify.pg.query<OrderRow>(
      `SELECT id, order_number, status, payment_status, total, tax_amount, created_at
       FROM orders
       WHERE email = $1
       ORDER BY created_at DESC`,
      [user.email],
    );

    const orders = ordersResult.rows;

    if (orders.length === 0) {
      return reply.send({ orders: [] });
    }

    const orderIds = orders.map((o) => o.id);
    const itemsResult = await fastify.pg.query<{ order_id: string } & OrderItem>(
      `SELECT order_id, product_id, product_name, price, quantity
       FROM order_items
       WHERE order_id = ANY($1)`,
      [orderIds],
    );

    const itemsByOrderId = new Map<string, OrderItem[]>();
    for (const item of itemsResult.rows) {
      const existing = itemsByOrderId.get(item.order_id) ?? [];
      existing.push({
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
      });
      itemsByOrderId.set(item.order_id, existing);
    }

    const result = orders.map((order) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      total: order.total,
      tax_amount: order.tax_amount,
      created_at: order.created_at,
      items: itemsByOrderId.get(order.id) ?? [],
    }));

    return reply.send({ orders: result });
  });

  // GET /api/customer/orders/:id — single order for the authenticated customer
  fastify.get<{ Params: { id: string } }>('/api/customer/orders/:id', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'customer') {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    const orderResult = await fastify.pg.query<OrderRow>(
      `SELECT id, order_number, status, payment_status, total, tax_amount, created_at, order_token
       FROM orders
       WHERE id = $1 AND email = $2`,
      [id, user.email],
    );

    if (!orderResult.rows[0]) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const order = orderResult.rows[0];

    const itemsResult = await fastify.pg.query<OrderItem>(
      `SELECT product_id, product_name, price, quantity
       FROM order_items
       WHERE order_id = $1`,
      [order.id],
    );

    return reply.send({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      total: order.total,
      tax_amount: order.tax_amount,
      created_at: order.created_at,
      items: itemsResult.rows,
    });
  });
}
