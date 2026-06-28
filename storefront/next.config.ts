import type { NextConfig } from 'next';

if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SITE_URL) {
  console.warn('WARNING: NEXT_PUBLIC_SITE_URL is not set. Canonical URLs will use fallback domain.');
}

// BUILD_TARGET=static → static export for GitHub Pages (no SSR, no /api/*)
// BUILD_TARGET=server (default) → Next.js standalone server for Docker/VPS
const isStatic = process.env.BUILD_TARGET === 'static';

const nextConfig: NextConfig = {
  output: isStatic ? 'export' : 'standalone',
  poweredByHeader: false,
  trailingSlash: isStatic,
  images: {
    formats: ['image/avif', 'image/webp'],
    unoptimized: isStatic,
  },
};

export default nextConfig;
