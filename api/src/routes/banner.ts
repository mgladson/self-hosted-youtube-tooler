import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';
import { meetsMinTier } from '../plugins/auth-guard.js';

type BannerData = {
  active: boolean;
  text: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  updatedAt: string;
};

type BannerUpdate = {
  active: boolean;
  text: string;
  imageUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
};

const BANNER_PATH = path.resolve(process.cwd(), '..', 'data', 'banner.json');
const BANNER_CACHE_KEY = 'banner:active';
const BANNER_CACHE_TTL_S = 60;

const DEFAULT_BANNER: BannerData = {
  active: false,
  text: '',
  imageUrl: '',
  linkUrl: '',
  linkLabel: '',
  updatedAt: '',
};

async function readBannerFromDisk(): Promise<BannerData> {
  try {
    const raw = await fs.readFile(BANNER_PATH, 'utf-8');
    return { ...DEFAULT_BANNER, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_BANNER };
  }
}

export async function bannerRoutes(fastify: FastifyInstance) {
  async function readBanner(): Promise<BannerData> {
    try {
      const cached = await fastify.valkey.get(BANNER_CACHE_KEY);
      if (cached) return JSON.parse(cached) as BannerData;
    } catch (err) {
      fastify.log.warn({ err }, 'banner cache GET failed');
    }
    const banner = await readBannerFromDisk();
    try {
      await fastify.valkey.set(BANNER_CACHE_KEY, JSON.stringify(banner), 'EX', BANNER_CACHE_TTL_S);
    } catch (err) {
      fastify.log.warn({ err }, 'banner cache SET failed');
    }
    return banner;
  }

  fastify.get('/api/banner', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return reply.send(await readBanner());
  });

  fastify.put<{ Body: BannerUpdate }>('/api/banner', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { active, text, imageUrl, linkUrl, linkLabel } = request.body;

    if (typeof active !== 'boolean') {
      return reply.status(400).send({ error: 'active must be a boolean' });
    }
    if (active && (!text || typeof text !== 'string' || text.trim().length === 0)) {
      return reply.status(400).send({ error: 'text is required when banner is active' });
    }

    const trimmedLinkUrl = (linkUrl || '').trim();
    if (trimmedLinkUrl && !/^https?:\/\//i.test(trimmedLinkUrl) && !trimmedLinkUrl.startsWith('/')) {
      return reply.status(400).send({ error: 'linkUrl must be an absolute HTTP(S) URL or a relative path' });
    }

    const banner: BannerData = {
      active,
      text: (text || '').trim(),
      imageUrl: (imageUrl || '').trim(),
      linkUrl: trimmedLinkUrl,
      linkLabel: (linkLabel || '').trim(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await fs.writeFile(BANNER_PATH, JSON.stringify(banner, null, 2) + '\n');
      // Invalidate Valkey cache so next read picks up the new banner immediately.
      try {
        await fastify.valkey.del(BANNER_CACHE_KEY);
      } catch (err) {
        fastify.log.warn({ err }, 'banner cache DEL failed');
      }
    } catch (err) {
      fastify.log.error({ err }, 'Failed to write banner.json');
      return reply.status(500).send({ error: 'Failed to save banner' });
    }

    const statusLabel = active ? 'enabled' : 'disabled';
    const textPreview = banner.text ? `: "${banner.text.slice(0, 80)}"` : '';
    writeAuditLog(fastify, {
      userEmail: user.email,
      userName: user.name,
      action: 'update',
      resourceType: 'banner',
      summary: `Banner ${statusLabel}${textPreview}`,
      ip: getClientIp(request),
    }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

    return reply.send(banner);
  });
}
