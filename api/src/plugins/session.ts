import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import RedisStore from 'connect-redis';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

declare module 'fastify' {
  interface Session {
    user?: {
      email: string;
      name: string;
      picture: string;
      role: 'admin' | 'customer';
      adminTier?: 'viewer' | 'editor' | 'admin' | 'super_admin';
    };
  }
}

async function sessionSetup(fastify: FastifyInstance) {
  await fastify.register(cookie);

  const store = new RedisStore({
    client: fastify.valkey,
    prefix: 'sess:',
  });

  const isSecure = config.baseUrl.startsWith('https://');
  if (!isSecure && config.nodeEnv === 'production') {
    fastify.log.warn('[session] Session cookie Secure flag is OFF (BASE_URL is HTTP) but NODE_ENV=production. Cookies will be sent over plaintext — set BASE_URL to https:// for production.');
  }
  if (isSecure && config.nodeEnv === 'development') {
    fastify.log.info('[session] Session cookie Secure flag is ON because BASE_URL uses HTTPS.');
  }

  await fastify.register(session, {
    secret: config.session.secret,
    store,
    cookie: {
      maxAge: 86400000,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
    },
    saveUninitialized: false,
  });
}

export const sessionPlugin = fp(sessionSetup, {
  name: 'session',
  dependencies: ['valkey'],
});
