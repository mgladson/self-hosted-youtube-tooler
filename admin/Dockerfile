FROM node:20-alpine AS base

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY admin/package.json ./admin/
COPY shared/package.json ./shared/

# Install dependencies
# macOS-generated package-lock.json omits rollup's Linux native bindings,
# causing vite to fail on Alpine (musl) containers. Detect the build host's
# architecture and install the matching native binding. Covers both
# Hetzner-style x86_64 boxes and Apple Silicon CI runners.
RUN npm install --workspace=admin --workspace=shared && \
    ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)  npm install @rollup/rollup-linux-x64-musl  --no-save 2>/dev/null || true ;; \
      aarch64) npm install @rollup/rollup-linux-arm64-musl --no-save 2>/dev/null || true ;; \
      *) echo "Unsupported arch '$ARCH' for rollup native bindings" >&2 ; exit 1 ;; \
    esac

# Copy source (volumes override in dev)
COPY tsconfig.json ./
COPY admin/ ./admin/
COPY shared/ ./shared/

WORKDIR /app/admin

# ---- Production: build static files ----
FROM base AS build
RUN npm run build

# ---- Dev: run vite dev server ----
FROM base AS dev
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser
EXPOSE 3002
CMD ["npm", "run", "dev"]

# ---- Production: just the static dist ----
FROM alpine:3.20 AS prod
COPY --from=build /app/admin/dist /srv/admin
