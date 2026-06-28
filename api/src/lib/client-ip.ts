import { isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';

// Real client IP for attribution (geoip, rate limits, bans). Prefers
// CF-Connecting-IP — trustworthy because UFW restricts :443 to Cloudflare
// ranges, so the header can't be set by a direct-to-origin request.
export function getClientIp(request: FastifyRequest): string {
  const cf = request.headers['cf-connecting-ip'];
  if (typeof cf === 'string') {
    const candidate = cf.trim();
    if (candidate && isIP(candidate)) {
      return candidate;
    }
  }
  return request.ip;
}
