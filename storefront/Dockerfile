FROM node:20-alpine AS base

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY storefront/package.json ./storefront/
COPY shared/package.json ./shared/

# Install dependencies
RUN npm install --workspace=storefront --workspace=shared

# Copy source (volumes override in dev)
COPY tsconfig.json ./
COPY storefront/ ./storefront/
COPY shared/ ./shared/

WORKDIR /app/storefront

# ---- Dev: run next dev server ----
FROM base AS development
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- Builder: build Next.js standalone output ----
FROM base AS builder
RUN npm run build

# ---- Production: serve standalone output ----
# Next.js `output: 'standalone'` in an npm workspaces monorepo nests the
# entry under the workspace dir — the build emits
# `storefront/.next/standalone/storefront/server.js` plus a hoisted
# `node_modules/` at the standalone root. So WORKDIR must be `/app`
# (the standalone root) and the entry is `storefront/server.js`. Static
# assets and `public/` need to land where the server expects them
# (under `/app/storefront/...`). HOSTNAME=0.0.0.0 is required —
# Next.js standalone defaults to 127.0.0.1 which breaks Docker port mapping.
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder --chown=appuser:appgroup /app/storefront/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/storefront/.next/static ./storefront/.next/static
COPY --from=builder --chown=appuser:appgroup /app/storefront/public ./storefront/public
USER appuser
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "storefront/server.js"]
