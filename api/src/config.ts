const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';

if (!process.env.NODE_ENV) {
  console.warn('[config] NODE_ENV is not set — defaulting to "development". Set NODE_ENV=production in production.');
}

if (process.env.ENABLE_DEV_FEATURES === 'true' && nodeEnv === 'production') {
  throw new Error('ENABLE_DEV_FEATURES cannot be true in production. Refusing to start.');
}

const devFeaturesEnabled = process.env.ENABLE_DEV_FEATURES === 'true' && nodeEnv === 'development';

import crypto from 'node:crypto';

if (!process.env.SESSION_SECRET && nodeEnv === 'production') {
  throw new Error('SESSION_SECRET must be set in production. Refusing to start with the default dev secret.');
}

if (nodeEnv === 'production' && (!process.env.VALKEY_PASSWORD || process.env.VALKEY_PASSWORD === 'changeme_in_production')) {
  throw new Error('VALKEY_PASSWORD must be set to a strong value in production. Refusing to start with a weak default.');
}

const stripeEnabled = process.env.STRIPE_ENABLED !== 'false' && !!process.env.STRIPE_SECRET_KEY;

if (process.env.STRIPE_ENABLED === 'true' && !process.env.STRIPE_SECRET_KEY) {
  console.warn('[config] STRIPE_ENABLED=true but STRIPE_SECRET_KEY is empty — Stripe will be treated as disabled. Set STRIPE_SECRET_KEY or remove STRIPE_ENABLED=true.');
}

if (nodeEnv === 'production' && stripeEnabled && !process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET must be set in production when Stripe is enabled. Refusing to start without webhook signature verification. Set STRIPE_ENABLED=false to disable Stripe entirely.');
}

if (nodeEnv === 'production') {
  if (!process.env.BASE_URL) {
    throw new Error('BASE_URL must be set in production. Refusing to start — required for secure session cookies and absolute URL generation.');
  }
  if (!process.env.BASE_URL.startsWith('https://')) {
    throw new Error('BASE_URL must use https:// in production. Refusing to start — secure session cookies require an HTTPS origin.');
  }
}

const sessionSecret = process.env.SESSION_SECRET || (() => {
  const secret = crypto.randomBytes(32).toString('hex');
  console.warn('[config] SESSION_SECRET not set — using random ephemeral secret (sessions will not survive restarts)');
  return secret;
})();

const r2Enabled =
  !!process.env.R2_ACCOUNT_ID &&
  !!process.env.R2_ACCESS_KEY_ID &&
  !!process.env.R2_SECRET_ACCESS_KEY &&
  !!process.env.R2_BUCKET;

export const config = {
  api: {
    host: process.env.API_HOST || '0.0.0.0',
    port: parseInt(process.env.API_PORT || '3001', 10),
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'shopify_stack',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    max: parseInt(process.env.DATABASE_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DATABASE_POOL_CONNECT_TIMEOUT || '5000', 10),
  },
  valkey: {
    host: process.env.VALKEY_HOST || 'localhost',
    port: parseInt(process.env.VALKEY_PORT || '6379', 10),
    password: process.env.VALKEY_PASSWORD || undefined,
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD || '',
    bucketFiles: process.env.MINIO_BUCKET_FILES || 'product-files',
    bucketImages: process.env.MINIO_BUCKET_IMAGES || 'product-images',
  },
  images: {
    // Public URL base under which uploaded images (testimonials, recipes) are
    // served to browsers; the object key is appended, e.g.
    // `${publicBase}/testimonials/<uuid>.jpg`.
    //   - app-native / local dev default: /images (this app's own docker/Caddyfile
    //     maps /images/* -> MinIO product-images)
    //   - a deployment whose proxy exposes the bucket elsewhere overrides this:
    //     the Ansible IAC serves it at /cdn and sets IMAGE_PUBLIC_BASE=/cdn
    // Trailing slashes are trimmed so the appended `/testimonials/...` is clean.
    publicBase: (process.env.IMAGE_PUBLIC_BASE || '/images').replace(/\/+$/, ''),
  },
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.SMTP_FROM || 'contact@findcarehelper.com',
    // Optional SMTP auth. Empty in dev (Mailpit relays unauthenticated); set
    // SMTP_USER/SMTP_PASS in prod when relaying through an authenticated
    // provider (Gmail app password, SES, SendGrid, etc.).
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost/api/auth/google/callback',
  },
  session: {
    secret: sessionSecret,
  },
  stripe: {
    enabled: stripeEnabled,
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    taxEnabled: process.env.STRIPE_TAX_ENABLED === 'true',
    priceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    priceProAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL || '',
    // One-time price for a developer API credit pack (mode: payment checkout).
    priceCreditPack: process.env.STRIPE_PRICE_CREDIT_PACK || '',
  },
  // API credits sold as one-time packs: `packSize` credits are granted per successful
  // purchase of the STRIPE_PRICE_CREDIT_PACK price.
  credits: {
    packSize: parseInt(process.env.CREDIT_PACK_SIZE || '1000', 10),
  },
  // Cloudflare R2 (S3-compatible) cache for merged YouTube downloads. Optional:
  // when unset the API streams downloads directly (no cache). R2's zero egress
  // fees are the point — repeat downloads of the same video serve from R2 free.
  r2: {
    enabled: r2Enabled,
    endPoint: process.env.R2_ACCOUNT_ID
      ? `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : '',
    accessKey: process.env.R2_ACCESS_KEY_ID || '',
    secretKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
  },
  // Playlist batch tools (Supporter-only). Default OFF so a code deploy never exposes
  // the routes before the playlist_jobs migration is applied; enable explicitly in prod.
  // maxVideos bounds enumeration and per-job work; the delay/concurrency knobs are used
  // by the background worker (added in a later slice).
  playlist: {
    enabled: process.env.PLAYLIST_ENABLED === 'true',
    maxVideos: parseInt(process.env.PLAYLIST_MAX_VIDEOS || '50', 10),
    perVideoDelayMs: parseInt(process.env.PLAYLIST_PER_VIDEO_DELAY_MS || '1500', 10),
    maxConcurrentJobs: parseInt(process.env.PLAYLIST_MAX_CONCURRENT_JOBS || '1', 10),
  },
  baseUrl: process.env.BASE_URL || 'http://localhost',
  nodeEnv,
  devFeaturesEnabled,
} as const;
