import type { FastifyInstance } from 'fastify';
import { meetsMinTier } from '../plugins/auth-guard.js';
import { getClientIp } from '../lib/client-ip.js';

type Review = {
  id: number;
  product_id: string;
  email: string;
  name: string;
  rating: number;
  body: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
};

type ReviewSummary = Pick<Review, 'id' | 'name' | 'rating' | 'body' | 'created_at'>;

type CreateReviewInput = {
  name: string;
  email: string;
  rating: number;
  body?: string;
};

type UpdateReviewInput = {
  status: 'approved' | 'rejected';
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function reviewRoutes(fastify: FastifyInstance) {
  // GET /api/products/:productId/reviews — public, approved reviews only
  fastify.get<{
    Params: { productId: string };
    Querystring: { page?: string; limit?: string; sort?: string };
  }>('/api/products/:productId/reviews', async (request, reply) => {
    const { productId } = request.params;
    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(request.query.limit || '10', 10)));
    const sort = request.query.sort || 'newest';
    const offset = (page - 1) * limit;

    const cacheKey = `cache:reviews:${productId}:${page}:${limit}:${sort}`;
    const cached = await fastify.valkey.get(cacheKey);
    if (cached) {
      reply.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return reply.send(JSON.parse(cached));
    }

    let orderBy: string;
    if (sort === 'highest') {
      orderBy = 'rating DESC, created_at DESC';
    } else if (sort === 'lowest') {
      orderBy = 'rating ASC, created_at DESC';
    } else {
      orderBy = 'created_at DESC';
    }

    const reviewsResult = await fastify.pg.query<ReviewSummary & { total: string; average_rating: string | null }>(
      `SELECT id, name, rating, body, created_at,
        COUNT(*) OVER() AS total,
        ROUND(AVG(rating) OVER(), 1) AS average_rating
       FROM reviews
       WHERE product_id = $1 AND status = 'approved'
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [productId, limit, offset],
    );

    const total = reviewsResult.rows.length > 0 ? parseInt(reviewsResult.rows[0].total, 10) : 0;
    const averageRating = reviewsResult.rows.length > 0 && reviewsResult.rows[0].average_rating !== null
      ? parseFloat(reviewsResult.rows[0].average_rating)
      : 0;

    const result = {
      reviews: reviewsResult.rows.map(({ total: _t, average_rating: _a, ...rest }) => rest),
      total,
      page,
      pages: Math.ceil(total / limit),
      averageRating,
    };

    await fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', 60);
    reply.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return reply.send(result);
  });

  const REVIEW_RL_KEY = 'review:rl:';
  const REVIEW_RL_MAX = 5;
  const REVIEW_RL_WINDOW = 300;
  const REVIEW_EMAIL_RL_KEY = 'review:erl:';
  const REVIEW_EMAIL_RL_MAX = 3;
  const REVIEW_EMAIL_RL_WINDOW = 3600;

  // POST /api/products/:productId/reviews — public, submit review for moderation
  fastify.post<{
    Params: { productId: string };
    Body: CreateReviewInput;
  }>('/api/products/:productId/reviews', async (request, reply) => {
    const rlKey = `${REVIEW_RL_KEY}${getClientIp(request)}`;
    const rlResults = await fastify.valkey.multi().incr(rlKey).expire(rlKey, REVIEW_RL_WINDOW).exec();
    const rlCount = (rlResults?.[0]?.[1] as number) ?? 0;
    if (rlCount > REVIEW_RL_MAX) {
      return reply.status(429).send({ error: 'Too many reviews submitted — please try again later' });
    }

    const { email: rawEmail } = request.body;
    if (rawEmail && typeof rawEmail === 'string') {
      const emailRlKey = `${REVIEW_EMAIL_RL_KEY}${rawEmail.trim().toLowerCase()}`;
      const emailRlResults = await fastify.valkey.multi().incr(emailRlKey).expire(emailRlKey, REVIEW_EMAIL_RL_WINDOW).exec();
      const emailRlCount = (emailRlResults?.[0]?.[1] as number) ?? 0;
      if (emailRlCount > REVIEW_EMAIL_RL_MAX) {
        return reply.status(429).send({ error: 'Too many reviews submitted — please try again later' });
      }
    }

    const { productId } = request.params;
    const { name, email, rating, body } = request.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return reply.status(400).send({ error: 'name is required' });
    }
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return reply.status(400).send({ error: 'A valid email is required' });
    }
    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return reply.status(400).send({ error: 'rating must be an integer between 1 and 5' });
    }
    if (body !== undefined && typeof body === 'string' && body.length > 2000) {
      return reply.status(400).send({ error: 'body must be 2000 characters or fewer' });
    }

    try {
      const result = await fastify.pg.query<{ id: number }>(
        `INSERT INTO reviews (product_id, email, name, rating, body, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id`,
        [productId, email.trim().toLowerCase(), name.trim(), rating, body ?? null],
      );

      let cursor = '0';
      do {
        const [nextCursor, keys] = await fastify.valkey.scan(cursor, 'MATCH', `cache:reviews:${productId}:*`, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) await fastify.valkey.del(...keys);
      } while (cursor !== '0');

      return reply.status(201).send({
        id: result.rows[0].id,
        message: 'Review submitted for moderation',
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        return reply.status(409).send({ error: 'You have already reviewed this product' });
      }
      throw err;
    }
  });

  // GET /api/admin/reviews — admin only, all reviews for moderation
  fastify.get<{
    Querystring: { status?: string; page?: string; limit?: string };
  }>('/api/admin/reviews', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'viewer')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const status = request.query.status || 'pending';
    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    let reviewsResult: { rows: Array<Review & { total: string }> };

    if (status === 'all') {
      reviewsResult = await fastify.pg.query<Review & { total: string }>(
        `SELECT id, product_id, email, name, rating, body, status, created_at, updated_at,
                COUNT(*) OVER() AS total
         FROM reviews
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
    } else {
      reviewsResult = await fastify.pg.query<Review & { total: string }>(
        `SELECT id, product_id, email, name, rating, body, status, created_at, updated_at,
                COUNT(*) OVER() AS total
         FROM reviews
         WHERE status = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset],
      );
    }

    const total = reviewsResult.rows.length > 0 ? parseInt(reviewsResult.rows[0].total, 10) : 0;

    return reply.send({
      reviews: reviewsResult.rows.map(({ total: _t, ...rest }) => rest),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  });

  // PATCH /api/admin/reviews/:id — admin only, update review status (editor+ required)
  fastify.patch<{
    Params: { id: string };
    Body: UpdateReviewInput;
  }>('/api/admin/reviews/:id', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = request.params;
    const { status } = request.body;

    if (status !== 'approved' && status !== 'rejected') {
      return reply.status(400).send({ error: 'status must be "approved" or "rejected"' });
    }

    const result = await fastify.pg.query<Review>(
      `UPDATE reviews SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );

    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const updatedReview = result.rows[0];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await fastify.valkey.scan(cursor, 'MATCH', `cache:reviews:${updatedReview.product_id}:*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) await fastify.valkey.del(...keys);
    } while (cursor !== '0');

    return reply.send(updatedReview);
  });
}
