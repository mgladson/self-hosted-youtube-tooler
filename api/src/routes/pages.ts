import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';
import { meetsMinTier } from '../plugins/auth-guard.js';

type PageState = {
  underConstruction: boolean;
};

type PagesData = {
  pages: Record<string, PageState>;
  updatedAt: string;
};

type UpdatePageBody = {
  underConstruction: boolean;
};

const PAGES_PATH = path.resolve(process.cwd(), '..', 'data', 'pages.json');

const KNOWN_SLUGS = new Set([
  'privacy-policy',
  'terms-of-service',
  'refund-policy',
  'changelog',
  'roadmap',
]);

const DEFAULT_PAGES: PagesData = {
  pages: {},
  updatedAt: '',
};

let cachedPages: PagesData | null = null;
let pagesCacheTime = 0;
const PAGES_CACHE_TTL = 5_000;

async function readPages(): Promise<PagesData> {
  const now = Date.now();
  if (cachedPages && now - pagesCacheTime < PAGES_CACHE_TTL) return cachedPages;
  try {
    const raw = await fs.readFile(PAGES_PATH, 'utf-8');
    const result: PagesData = { ...DEFAULT_PAGES, ...JSON.parse(raw) };
    cachedPages = result;
    pagesCacheTime = now;
    return result;
  } catch {
    return { ...DEFAULT_PAGES };
  }
}

export async function pagesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/pages', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return reply.send(await readPages());
  });

  fastify.put<{ Params: { slug: string }; Body: UpdatePageBody }>(
    '/api/pages/:slug',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { slug } = request.params;

      if (!KNOWN_SLUGS.has(slug)) {
        return reply.status(404).send({ error: 'Page not found' });
      }

      const { underConstruction } = request.body;

      if (typeof underConstruction !== 'boolean') {
        return reply.status(400).send({ error: 'underConstruction must be a boolean' });
      }

      const data = await readPages();
      data.pages[slug] = { underConstruction };
      data.updatedAt = new Date().toISOString();

      try {
        await fs.writeFile(PAGES_PATH, JSON.stringify(data, null, 2) + '\n');
        cachedPages = null;
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write pages.json');
        return reply.status(500).send({ error: 'Failed to save page state' });
      }

      const action = underConstruction ? 'set under construction' : 'restored';
      writeAuditLog(fastify, {
        userEmail: user.email,
        userName: user.name,
        action: 'update',
        resourceType: 'page',
        resourceId: slug,
        summary: `Page /${slug} ${action}`,
        ip: getClientIp(request),
      }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

      return reply.send({ slug, underConstruction, updatedAt: data.updatedAt });
    },
  );
}
