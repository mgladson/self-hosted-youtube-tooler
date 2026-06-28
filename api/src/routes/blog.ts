import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';
import { meetsMinTier } from '../plugins/auth-guard.js';
import { getClientIp } from '../lib/client-ip.js';
import { config } from '../config.js';

type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  author_name: string;
  status: 'draft' | 'published' | 'hidden';
  tags: string[];
  featured_image_url: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type BlogPostSummary = Omit<BlogPost, 'content'>;

type CreateBlogPostInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  author_name: string;
  status: 'draft' | 'published' | 'hidden';
  tags?: string[];
  featured_image_url?: string;
  seo_description?: string;
};

type UpdateBlogPostInput = Partial<CreateBlogPostInput>;

function toSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeCdata(s: string): string {
  return s.replace(/]]>/g, ']]]]><![CDATA[>');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function blogRoutes(fastify: FastifyInstance) {
  const SITE_URL = process.env.SITE_URL || config.baseUrl;

  async function invalidateBlogCache() {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await fastify.valkey.scan(cursor, 'MATCH', 'cache:blog:*', 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) await fastify.valkey.del(...keys);
    } while (cursor !== '0');
  }

  // IMPORTANT: feed.xml must be registered BEFORE :slug. Fastify resolves static
  // segments before parametric ones only when they appear first in registration order.
  // If :slug were registered first, /api/blog/feed.xml would match as slug="feed.xml".
  fastify.get('/api/blog/feed.xml', async (_request, reply) => {
    const cached = await fastify.valkey.get('cache:blog:feed');
    if (cached) {
      reply.header('Content-Type', 'application/rss+xml; charset=utf-8');
      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return reply.send(cached);
    }

    const result = await fastify.pg.query<BlogPost>(
      `SELECT id, title, slug, excerpt, content, author_name, published_at, updated_at
       FROM blog_posts WHERE status = 'published'
       ORDER BY published_at DESC LIMIT 20`,
    );

    // Cap content at 5 KB per item to keep feed payload small for crawlers.
    // Full HTML still served on the post page; readers wanting full content can follow <link>.
    const CONTENT_LIMIT_BYTES = 5 * 1024;
    const truncateContent = (content: string): string => {
      if (Buffer.byteLength(content, 'utf8') <= CONTENT_LIMIT_BYTES) return content;
      // Slice by code units, then drop any partial multi-byte at the tail.
      let truncated = content.slice(0, CONTENT_LIMIT_BYTES);
      while (Buffer.byteLength(truncated, 'utf8') > CONTENT_LIMIT_BYTES) {
        truncated = truncated.slice(0, -1);
      }
      return truncated + '…';
    };

    const items = result.rows.map((post) => {
      const pubDate = post.published_at ? new Date(post.published_at).toUTCString() : '';
      return `    <item>
      <title><![CDATA[${escapeCdata(post.title)}]]></title>
      <link>${escapeXml(`${SITE_URL}/blog/${post.slug}`)}</link>
      <guid isPermaLink="true">${escapeXml(`${SITE_URL}/blog/${post.slug}`)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${escapeCdata(post.excerpt ?? '')}]]></description>
      <content:encoded><![CDATA[${escapeCdata(truncateContent(post.content))}]]></content:encoded>
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PixelForge Blog</title>
    <link>${escapeXml(`${SITE_URL}/blog`)}</link>
    <description>Articles on design, development, and digital products.</description>
    <language>en</language>
    <atom:link href="${escapeXml(`${SITE_URL}/api/blog/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    await fastify.valkey.set('cache:blog:feed', xml, 'EX', 60);
    reply.header('Content-Type', 'application/rss+xml; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return reply.send(xml);
  });

  // GET /api/blog — paginated list of published posts
  fastify.get<{ Querystring: { page?: string; limit?: string; tag?: string } }>(
    '/api/blog',
    async (request, reply) => {
      const page = Math.max(1, parseInt(request.query.page || '1', 10));
      const limit = Math.min(50, Math.max(1, parseInt(request.query.limit || '12', 10)));
      const offset = (page - 1) * limit;
      const tag = request.query.tag || '';
      const safeTag = tag ? tag.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50) : '';

      const cacheKey = `cache:blog:list:${page}:${limit}:${safeTag}`;
      const cached = await fastify.valkey.get(cacheKey);
      if (cached) {
        reply.header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
        return reply.send(JSON.parse(cached));
      }

      // NOTE (perf, known): COUNT(*) OVER() runs a window aggregate per row to avoid
      // a separate COUNT query. With Valkey caching the response for 60s + SWR=120s,
      // the hot path almost never executes this — deferred refactor (split into two
      // queries with cached count) until cache hit rate falls below ~90%.
      let total: number;
      let posts: BlogPostSummary[];

      if (tag) {
        const postsResult = await fastify.pg.query<BlogPostSummary & { total: string }>(
          `SELECT id, title, slug, excerpt, author_name, status, tags, featured_image_url, seo_description, published_at, created_at, updated_at,
                  COUNT(*) OVER() AS total
           FROM blog_posts WHERE status = 'published' AND $1 = ANY(tags)
           ORDER BY published_at DESC LIMIT $2 OFFSET $3`,
          [tag, limit, offset],
        );
        total = postsResult.rows.length > 0 ? parseInt(postsResult.rows[0].total, 10) : 0;
        posts = postsResult.rows.map(({ total: _t, ...rest }) => rest);
      } else {
        const postsResult = await fastify.pg.query<BlogPostSummary & { total: string }>(
          `SELECT id, title, slug, excerpt, author_name, status, tags, featured_image_url, seo_description, published_at, created_at, updated_at,
                  COUNT(*) OVER() AS total
           FROM blog_posts WHERE status = 'published'
           ORDER BY published_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset],
        );
        total = postsResult.rows.length > 0 ? parseInt(postsResult.rows[0].total, 10) : 0;
        posts = postsResult.rows.map(({ total: _t, ...rest }) => rest);
      }

      const result = { posts, total, page, pages: Math.ceil(total / limit) };
      await fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', 60);
      reply.header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
      return reply.send(result);
    },
  );

  // GET /api/blog/:slug — single published post (returns 404 if not published)
  fastify.get<{ Params: { slug: string } }>('/api/blog/:slug', async (request, reply) => {
    const { slug } = request.params;
    const cacheKey = `cache:blog:${slug}`;
    const cached = await fastify.valkey.get(cacheKey);
    if (cached) {
      reply.header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
      return reply.send(JSON.parse(cached));
    }

    const result = await fastify.pg.query<BlogPost>(
      `SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published'`,
      [slug],
    );
    if (!result.rows[0]) {
      return reply.status(404).send({ error: 'Not found' });
    }

    await fastify.valkey.set(cacheKey, JSON.stringify(result.rows[0]), 'EX', 60);
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
    return reply.send(result.rows[0]);
  });

  // --- Admin routes ---

  // GET /api/admin/blog — all posts (all statuses), paginated
  fastify.get<{ Querystring: { page?: string; limit?: string } }>('/api/admin/blog', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '50', 10)));
    const offset = (page - 1) * limit;
    const result = await fastify.pg.query<BlogPostSummary & { total: string }>(
      `SELECT id, title, slug, excerpt, author_name, status, tags, featured_image_url, seo_description, published_at, created_at, updated_at,
              COUNT(*) OVER() AS total
       FROM blog_posts ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total, 10) : 0;
    const posts = result.rows.map(({ total: _t, ...rest }) => rest);
    return reply.send({ posts, total, page, pages: Math.ceil(total / limit) });
  });

  // GET /api/admin/blog/:slug — single post regardless of status
  fastify.get<{ Params: { slug: string } }>('/api/admin/blog/:slug', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const result = await fastify.pg.query<BlogPost>(
      `SELECT * FROM blog_posts WHERE slug = $1`,
      [request.params.slug],
    );
    if (!result.rows[0]) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.send(result.rows[0]);
  });

  // POST /api/admin/blog — create post
  fastify.post<{ Body: CreateBlogPostInput }>('/api/admin/blog', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { title, slug: rawSlug, excerpt, content, author_name, status, tags, featured_image_url, seo_description } = request.body;

    if (!title || !content || !author_name || !status) {
      return reply.status(400).send({ error: 'title, content, author_name, and status are required' });
    }
    if (content.length > 200_000) {
      return reply.status(400).send({ error: 'content must be 200,000 characters or fewer' });
    }

    const baseSlug = rawSlug
      ? rawSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : toSlug(title);

    // For auto-generated slugs, append -2, -3, etc. on conflict (single query)
    let finalSlug = baseSlug;
    if (!rawSlug) {
      const existing = await fastify.pg.query<{ slug: string }>(
        `SELECT slug FROM blog_posts WHERE slug = $1 OR slug LIKE $2`,
        [baseSlug, `${baseSlug}-%`],
      );
      if (existing.rows.length > 0) {
        const taken = new Set(existing.rows.map((r) => r.slug));
        let suffix = 2;
        while (taken.has(`${baseSlug}-${suffix}`)) suffix++;
        finalSlug = `${baseSlug}-${suffix}`;
      }
    }

    try {
      const result = await fastify.pg.query<BlogPost>(
        `INSERT INTO blog_posts (title, slug, excerpt, content, author_name, status, tags, featured_image_url, seo_description${status === 'published' ? ', published_at' : ''})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9${status === 'published' ? ', NOW()' : ''})
         RETURNING *`,
        [title, finalSlug, excerpt ?? null, content, author_name, status, tags ?? [], featured_image_url ?? null, seo_description ?? null],
      );

      const post = result.rows[0];
      await invalidateBlogCache();
      try {
        await writeAuditLog(fastify, {
          userEmail: user.email,
          userName: user.name,
          action: 'create',
          resourceType: 'blog_post',
          resourceId: post.slug,
          summary: `Created blog post: ${post.slug}`,
          ip: getClientIp(request),
        });
      } catch (auditErr) {
        fastify.log.error({ err: auditErr }, 'Failed to write blog create audit log');
      }

      return reply.status(201).send(post);
    } catch (err: unknown) {
      if (rawSlug && (err as { code?: string }).code === '23505') {
        return reply.status(409).send({ error: 'Slug already in use — choose a different one' });
      }
      throw err;
    }
  });

  // PUT /api/admin/blog/:slug — update post
  fastify.put<{ Params: { slug: string }; Body: UpdateBlogPostInput }>(
    '/api/admin/blog/:slug',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { slug } = request.params;

      const currentResult = await fastify.pg.query<BlogPost>(
        `SELECT * FROM blog_posts WHERE slug = $1`,
        [slug],
      );
      if (!currentResult.rows[0]) {
        return reply.status(404).send({ error: 'Not found' });
      }
      const prev = currentResult.rows[0];

      const { title, slug: newRawSlug, excerpt, content, author_name, status, tags, featured_image_url, seo_description } = request.body;

      if (content !== undefined && content.length > 200_000) {
        return reply.status(400).send({ error: 'content must be 200,000 characters or fewer' });
      }

      const newStatus = status ?? prev.status;
      // Set published_at to NOW() on first transition to published
      const setPublishedAt = newStatus === 'published' && prev.published_at === null;

      const updatedTitle = title ?? prev.title;
      const updatedSlug = newRawSlug
        ? newRawSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : prev.slug;
      const updatedExcerpt = excerpt !== undefined ? excerpt : prev.excerpt;
      const updatedContent = content ?? prev.content;
      const updatedAuthor = author_name ?? prev.author_name;
      const updatedTags = tags ?? prev.tags;
      const updatedFeaturedImage = featured_image_url !== undefined ? featured_image_url : prev.featured_image_url;
      const updatedSeoDesc = seo_description !== undefined ? seo_description : prev.seo_description;

      try {
        const result = await fastify.pg.query<BlogPost>(
          `UPDATE blog_posts
           SET title=$1, slug=$2, excerpt=$3, content=$4, author_name=$5, status=$6,
               tags=$7, featured_image_url=$8, seo_description=$9,
               updated_at=NOW()${setPublishedAt ? ', published_at=NOW()' : ''}
           WHERE slug=$10
           RETURNING *`,
          [updatedTitle, updatedSlug, updatedExcerpt, updatedContent, updatedAuthor, newStatus, updatedTags, updatedFeaturedImage, updatedSeoDesc, slug],
        );
        if (!result.rows[0]) {
          return reply.status(404).send({ error: 'Not found' });
        }

        const post = result.rows[0];
        await invalidateBlogCache();
        const statusChanged = prev.status !== newStatus;
        try {
          await writeAuditLog(fastify, {
            userEmail: user.email,
            userName: user.name,
            action: 'update',
            resourceType: 'blog_post',
            resourceId: post.slug,
            summary: statusChanged
              ? `Updated blog post: ${post.slug} — status: ${prev.status} → ${newStatus}`
              : `Updated blog post: ${post.slug}`,
            ip: getClientIp(request),
          });
        } catch (auditErr) {
          fastify.log.error({ err: auditErr }, 'Failed to write blog update audit log');
        }

        return reply.send(post);
      } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({ error: 'Slug already in use — choose a different one' });
        }
        throw err;
      }
    },
  );

  // DELETE /api/admin/blog/:slug — hard delete
  fastify.delete<{ Params: { slug: string } }>('/api/admin/blog/:slug', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { slug } = request.params;
    const result = await fastify.pg.query(
      `DELETE FROM blog_posts WHERE slug = $1 RETURNING slug`,
      [slug],
    );
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    await invalidateBlogCache();
    try {
      await writeAuditLog(fastify, {
        userEmail: user.email,
        userName: user.name,
        action: 'delete',
        resourceType: 'blog_post',
        resourceId: slug,
        summary: `Deleted blog post: ${slug}`,
        ip: getClientIp(request),
      });
    } catch (auditErr) {
      fastify.log.error({ err: auditErr }, 'Failed to write blog delete audit log');
    }

    return reply.send({ ok: true });
  });
}
