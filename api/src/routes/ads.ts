import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';
import { meetsMinTier } from '../plugins/auth-guard.js';

type DirectAd = {
  id: string;
  placement: string;
  imageUrl: string;
  linkUrl: string;
  altText: string;
  startDate: string;
  endDate: string;
};

type AdsConfig = {
  enabled: boolean;
  placements: Record<string, boolean>;
  providers: {
    googleAdsense: { enabled: boolean; clientId: string; autoAds: boolean };
    mediaNet: { enabled: boolean; customerId: string; widgetId: string };
    customDirect: { enabled: boolean };
  };
  settings: {
    respectDoNotTrack: boolean;
    disableOnCheckout: boolean;
    inFeedEveryN: number;
    inGridEveryN: number;
    lazyLoad: boolean;
  };
  directAds: DirectAd[];
  updatedAt: string;
};

const ADS_PATH = path.resolve(process.cwd(), '..', 'data', 'ads.json');
const ADS_CACHE_KEY = 'ads:config';
const ADS_CACHE_TTL_S = 60;

const VALID_PLACEMENTS = new Set([
  'homepage_banner', 'homepage_in_feed', 'collection_banner', 'collection_in_grid',
  'product_below_fold', 'blog_list_in_feed', 'blog_post_below_content',
  'search_banner', 'search_in_grid', 'cart_bottom',
]);

function isSafeUrl(url: string): boolean {
  if (!url) return true; // empty is allowed (optional fields)
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function validateDirectAds(ads: unknown): { valid: boolean; error?: string; cleaned: DirectAd[] } {
  if (!Array.isArray(ads)) return { valid: false, error: 'directAds must be an array', cleaned: [] };
  const cleaned: DirectAd[] = [];
  for (let i = 0; i < ads.length; i++) {
    const ad = ads[i];
    if (!ad || typeof ad !== 'object') return { valid: false, error: `directAds[${i}] must be an object`, cleaned: [] };
    const { id, placement, imageUrl, linkUrl, altText, startDate, endDate } = ad as Record<string, unknown>;
    if (typeof imageUrl === 'string' && !isSafeUrl(imageUrl)) {
      return { valid: false, error: `directAds[${i}].imageUrl must be an http(s) URL`, cleaned: [] };
    }
    if (typeof linkUrl === 'string' && !isSafeUrl(linkUrl)) {
      return { valid: false, error: `directAds[${i}].linkUrl must be an http(s) URL`, cleaned: [] };
    }
    cleaned.push({
      id: typeof id === 'string' ? id : crypto.randomUUID(),
      placement: typeof placement === 'string' && VALID_PLACEMENTS.has(placement) ? placement : 'homepage_banner',
      imageUrl: typeof imageUrl === 'string' ? imageUrl : '',
      linkUrl: typeof linkUrl === 'string' ? linkUrl : '',
      altText: typeof altText === 'string' ? altText : '',
      startDate: typeof startDate === 'string' ? startDate : '',
      endDate: typeof endDate === 'string' ? endDate : '',
    });
  }
  return { valid: true, cleaned };
}

const DEFAULT_CONFIG: AdsConfig = {
  enabled: false,
  placements: {
    homepage_banner: false,
    homepage_in_feed: false,
    collection_banner: false,
    collection_in_grid: false,
    product_below_fold: false,
    blog_list_in_feed: false,
    blog_post_below_content: false,
    search_banner: false,
    search_in_grid: false,
    cart_bottom: false,
  },
  providers: {
    googleAdsense: { enabled: false, clientId: '', autoAds: false },
    mediaNet: { enabled: false, customerId: '', widgetId: '' },
    customDirect: { enabled: false },
  },
  settings: {
    respectDoNotTrack: true,
    disableOnCheckout: true,
    inFeedEveryN: 6,
    inGridEveryN: 8,
    lazyLoad: true,
  },
  directAds: [],
  updatedAt: '',
};

async function readAdsConfigFromDisk(): Promise<AdsConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(ADS_PATH, 'utf-8'));
    const result: AdsConfig = {
      ...DEFAULT_CONFIG,
      ...raw,
      providers: {
        googleAdsense: { ...DEFAULT_CONFIG.providers.googleAdsense, ...raw.providers?.googleAdsense },
        mediaNet: { ...DEFAULT_CONFIG.providers.mediaNet, ...raw.providers?.mediaNet },
        customDirect: { ...DEFAULT_CONFIG.providers.customDirect, ...raw.providers?.customDirect },
      },
      settings: { ...DEFAULT_CONFIG.settings, ...raw.settings },
      directAds: Array.isArray(raw.directAds) ? raw.directAds : [],
    };
    return result;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function getActiveDirectAds(config: AdsConfig): DirectAd[] {
  if (!config.providers.customDirect.enabled) return [];
  const now = new Date();
  return config.directAds.filter((ad) => {
    if (ad.startDate && new Date(ad.startDate) > now) return false;
    if (ad.endDate && new Date(ad.endDate) < now) return false;
    return true;
  });
}

export async function adsRoutes(fastify: FastifyInstance) {
  async function readAdsConfig(): Promise<AdsConfig> {
    try {
      const cached = await fastify.valkey.get(ADS_CACHE_KEY);
      if (cached) return JSON.parse(cached) as AdsConfig;
    } catch (err) {
      fastify.log.warn({ err }, 'ads cache GET failed');
    }
    const config = await readAdsConfigFromDisk();
    try {
      await fastify.valkey.set(ADS_CACHE_KEY, JSON.stringify(config), 'EX', ADS_CACHE_TTL_S);
    } catch (err) {
      fastify.log.warn({ err }, 'ads cache SET failed');
    }
    return config;
  }

  fastify.get('/api/ads', async (_request, reply) => {
    const config = await readAdsConfig();
    reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return reply.send({
      enabled: config.enabled,
      placements: config.placements,
      providers: {
        googleAdsense: {
          enabled: config.providers.googleAdsense.enabled,
          clientId: config.providers.googleAdsense.clientId,
          autoAds: config.providers.googleAdsense.autoAds,
        },
        mediaNet: {
          enabled: config.providers.mediaNet.enabled,
        },
        customDirect: {
          enabled: config.providers.customDirect.enabled,
        },
      },
      settings: config.settings,
      directAds: getActiveDirectAds(config),
      updatedAt: config.updatedAt,
    });
  });

  fastify.get('/api/ads/config', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    return reply.send(await readAdsConfig());
  });

  fastify.put<{ Body: Partial<AdsConfig> }>('/api/ads/config', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const current = await readAdsConfig();
    const body = request.body;

    // Validate directAds if provided
    let directAds = current.directAds;
    if (body.directAds !== undefined) {
      const result = validateDirectAds(body.directAds);
      if (!result.valid) {
        return reply.status(400).send({ error: result.error });
      }
      directAds = result.cleaned;
    }

    // Only accept known placement keys
    let placements = current.placements;
    if (body.placements && typeof body.placements === 'object') {
      placements = { ...current.placements };
      for (const [key, value] of Object.entries(body.placements)) {
        if (VALID_PLACEMENTS.has(key) && typeof value === 'boolean') {
          placements[key] = value;
        }
      }
    }

    // Strip providers to known fields only
    let providers = current.providers;
    if (body.providers) {
      const ga = body.providers.googleAdsense;
      const mn = body.providers.mediaNet;
      const cd = body.providers.customDirect;
      providers = {
        googleAdsense: {
          enabled: typeof ga?.enabled === 'boolean' ? ga.enabled : current.providers.googleAdsense.enabled,
          clientId: typeof ga?.clientId === 'string' ? ga.clientId : current.providers.googleAdsense.clientId,
          autoAds: typeof ga?.autoAds === 'boolean' ? ga.autoAds : current.providers.googleAdsense.autoAds,
        },
        mediaNet: {
          enabled: typeof mn?.enabled === 'boolean' ? mn.enabled : current.providers.mediaNet.enabled,
          customerId: typeof mn?.customerId === 'string' ? mn.customerId : current.providers.mediaNet.customerId,
          widgetId: typeof mn?.widgetId === 'string' ? mn.widgetId : current.providers.mediaNet.widgetId,
        },
        customDirect: {
          enabled: typeof cd?.enabled === 'boolean' ? cd.enabled : current.providers.customDirect.enabled,
        },
      };
    }

    // Strip settings to known fields only
    let settings = current.settings;
    if (body.settings) {
      const s = body.settings;
      settings = {
        respectDoNotTrack: typeof s.respectDoNotTrack === 'boolean' ? s.respectDoNotTrack : current.settings.respectDoNotTrack,
        disableOnCheckout: true,
        inFeedEveryN: typeof s.inFeedEveryN === 'number' ? s.inFeedEveryN : current.settings.inFeedEveryN,
        inGridEveryN: typeof s.inGridEveryN === 'number' ? s.inGridEveryN : current.settings.inGridEveryN,
        lazyLoad: typeof s.lazyLoad === 'boolean' ? s.lazyLoad : current.settings.lazyLoad,
      };
    }

    const updated: AdsConfig = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
      placements,
      providers,
      settings,
      directAds,
      updatedAt: new Date().toISOString(),
    };

    // Clamp interval values
    updated.settings.inFeedEveryN = Math.max(2, updated.settings.inFeedEveryN || 6);
    updated.settings.inGridEveryN = Math.max(2, updated.settings.inGridEveryN || 8);

    try {
      await fs.writeFile(ADS_PATH, JSON.stringify(updated, null, 2) + '\n');
      // Invalidate Valkey cache so next read returns the new config immediately.
      try {
        await fastify.valkey.del(ADS_CACHE_KEY);
      } catch (err) {
        fastify.log.warn({ err }, 'ads cache DEL failed');
      }
    } catch (err) {
      fastify.log.error({ err }, 'Failed to write ads.json');
      return reply.status(500).send({ error: 'Failed to save ads config' });
    }

    const statusLabel = updated.enabled ? 'enabled' : 'disabled';
    writeAuditLog(fastify, {
      userEmail: user.email,
      userName: user.name,
      action: 'update',
      resourceType: 'ads',
      summary: `Ads ${statusLabel}`,
      ip: getClientIp(request),
    }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

    return reply.send(updated);
  });
}
