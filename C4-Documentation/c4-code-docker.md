# C4 Code — docker

## Overview

The `docker/` directory contains three files:
1. `Caddyfile` — reverse proxy and routing configuration for Caddy 2
2. `backup.sh` — PostgreSQL backup script
3. `minio-init.sh` — MinIO bucket initialisation script

---

## `docker/Caddyfile`

### Purpose

Caddy 2 serves as the single entry point (reverse proxy) for all services. In development it listens on HTTP port 80. In production, when `CADDY_HOSTNAME` is set to a domain name, Caddy automatically obtains and renews Let's Encrypt TLS certificates.

### TLS / Port Behaviour

```
{$CADDY_HOSTNAME::80}
```

- If `CADDY_HOSTNAME` is unset (dev): listens on `:80` (HTTP-only).
- If `CADDY_HOSTNAME` is set to a domain (prod): Caddy requests TLS from Let's Encrypt and redirects HTTP → HTTPS automatically.

### Logging

```
log {
    output stdout
    format json
    level INFO
}
```

All access logs are emitted as JSON to stdout. Docker Compose captures these and they can be forwarded to a log aggregator.

### Security Headers

Applied globally to every response:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Prevents clickjacking via iframes |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `X-XSS-Protection` | `0` | Disables legacy XSS filter (intentional — modern CSP is preferred) |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Denies access to device APIs |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HSTS: enforces HTTPS for 1 year (no-op on HTTP) |
| `-Server` | (removed) | Strips the `Server` header to remove Caddy version fingerprint |

Note: `X-Forwarded-For` and `X-Forwarded-Proto` are added automatically by Caddy on proxied requests. The Fastify API is configured with `trustProxy: 1` to read these correctly.

### Routes (in match order)

#### Honeypot Paths

```
@honeypot {
    path /wp-login.php /.env /phpMyAdmin* /admin.php /xmlrpc.php /wp-admin* /setup.php
}
handle @honeypot {
    reverse_proxy api:3001
}
```

Requests to common exploit scanner targets are proxied to the API rather than rejected outright. The API's bot-detector plugin logs these as security events. This creates an automated honeypot that fingerprints scanners and bots without revealing that the paths do not correspond to real software.

Honeypot paths covered:
- `/wp-login.php` — WordPress login probe
- `/.env` — environment file disclosure probe
- `/phpMyAdmin*` — phpMyAdmin probe
- `/admin.php` — generic PHP admin probe
- `/xmlrpc.php` — WordPress XML-RPC probe
- `/wp-admin*` — WordPress admin area probe
- `/setup.php` — generic setup script probe

#### Admin SPA Redirect

```
@admin-exact path /admin
redir @admin-exact /admin/ permanent
```

Redirects `/admin` → `/admin/` (HTTP 301). Required because the Vite SPA is mounted at the `/admin/` base path; without the trailing slash, relative asset paths break.

#### API

```
handle /api/* {
    reverse_proxy api:3001
}
```

All `/api/*` requests proxy to the Fastify API container on port 3001.

#### Image Proxy → MinIO

```
handle /images/* {
    uri strip_prefix /images
    rewrite * /product-images{uri}
    reverse_proxy minio:9000 {
        header_up Host minio:9000
    }
}
```

Proxies public product images from MinIO's `product-images` bucket. The URL transformation is:
- Incoming: `/images/foo.jpg`
- After strip: `/foo.jpg`
- After rewrite: `/product-images/foo.jpg`
- Proxied to: `http://minio:9000/product-images/foo.jpg`

The `Host` header is explicitly set to `minio:9000` so MinIO's virtual-host routing resolves correctly inside the Docker network. The `product-images` bucket is configured with public-read access (see `minio-init.sh`).

#### Docs

```
handle /docs* {
    reverse_proxy docs:3003
}
```

Proxies all `/docs*` requests to a `docs` service running on port 3003 inside the Docker network.

#### Admin SPA

```
handle /admin/* {
    reverse_proxy {$ADMIN_BACKEND:admin:3002}
}
```

- **Dev**: `ADMIN_BACKEND=admin:3002` — proxies to the Vite dev server running the React SPA with HMR.
- **Prod**: `ADMIN_BACKEND` is unset, falls back to `admin:3002` still (the comment notes it could fall back to `file_server` for static files in a prod-optimised setup).

#### Next.js HMR WebSocket

```
handle /_next/webpack-hmr {
    reverse_proxy storefront:3000
}
```

Forwards the Next.js Hot Module Replacement WebSocket connection to the storefront container. Required for HMR to work in development through the Caddy proxy.

#### Storefront (catch-all)

```
handle {
    reverse_proxy storefront:3000
}
```

All other requests (the default) proxy to the Next.js storefront container on port 3000. This is the catch-all that handles all storefront pages.

### Route Priority Summary

```
/wp-login.php, /.env, /phpMyAdmin*, /admin.php, /xmlrpc.php, /wp-admin*, /setup.php
  → api:3001  (honeypot)

/admin          → 301 redirect to /admin/

/api/*          → api:3001

/images/*       → minio:9000  (with /product-images prefix rewrite)

/docs*          → docs:3003

/admin/*        → admin:3002  (Vite dev) or file_server (prod)

/_next/webpack-hmr  → storefront:3000

(catch-all)     → storefront:3000
```

---

## `docker/backup.sh`

### Purpose

Shell script to create a compressed PostgreSQL dump of the application database and manage backup retention. Intended for daily automated execution via cron.

### Usage

```sh
./docker/backup.sh                    # manual run
# Cron (daily at 3am):
0 3 * * * cd /path/to/project && ./docker/backup.sh
```

### Operations

1. **Resolve project root** — uses `$(dirname "$0")/..` to locate the project root regardless of working directory.

2. **Create backup directory** — `mkdir -p $PROJECT_ROOT/backups/`

3. **Load environment variables** — sources `.env` from the project root if it exists, so `POSTGRES_DB` and `POSTGRES_USER` are available without requiring them to be set in the shell environment.

4. **Resolve database configuration**:
   - `DB_NAME` = `$POSTGRES_DB` or `shopify_stack` (default)
   - `DB_USER` = `$POSTGRES_USER` or `postgres` (default)

5. **Verify container is running** — calls `docker compose ps -q postgres`. Exits with an error message if the postgres container is not found.

6. **Execute backup**:
   ```sh
   docker compose exec -T postgres pg_dump \
     -U "$DB_USER" \
     -d "$DB_NAME" \
     --no-owner \
     --no-privileges \
     --clean \
     --if-exists \
     | gzip > backups/${DB_NAME}_${TIMESTAMP}.sql.gz
   ```
   - `--no-owner` — excludes ownership statements (restore works as any superuser)
   - `--no-privileges` — excludes GRANT/REVOKE statements
   - `--clean` — includes DROP statements before CREATE statements (idempotent restores)
   - `--if-exists` — adds IF EXISTS to DROP statements (prevents errors on clean restores)
   - Output is piped through `gzip` and saved as `{DB_NAME}_{YYYYMMDD_HHMMSS}.sql.gz`

7. **Report file size** — prints the human-readable size of the backup file.

8. **Prune old backups** — finds all `*.sql.gz` files in the backup directory older than 30 days (`-mtime +30`) and deletes them. Reports each deleted file.

### Retention Policy

- 30 days of daily backups are retained.
- Older backups are deleted automatically on each run.

### Error Handling

- Script uses `set -eu` — exits immediately on any error (`-e`) and treats unset variables as errors (`-u`).
- Explicit check for postgres container existence before attempting the dump.

---

## `docker/minio-init.sh`

### Purpose

One-time initialisation script for MinIO object storage. Creates the two required S3 buckets and sets access policies. Runs as part of the Docker Compose `minio-init` service on first startup.

### Operations

1. **Configure MinIO client alias**:
   ```sh
   mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
   ```
   Sets up `mc` (MinIO Client) to point at the `minio` Docker service using the root credentials from environment variables.

2. **Create file-download bucket**:
   ```sh
   mc mb --ignore-existing "local/$MINIO_BUCKET_FILES"
   ```
   Creates the private bucket for digital product file downloads. `--ignore-existing` makes the command idempotent. **Access: private** (default — no anonymous access).

3. **Create product-images bucket**:
   ```sh
   mc mb --ignore-existing "local/$MINIO_BUCKET_IMAGES"
   ```
   Creates the bucket for product images served publicly via Caddy's `/images/*` proxy.

4. **Set public-read policy on images bucket**:
   ```sh
   mc anonymous set download "local/$MINIO_BUCKET_IMAGES"
   ```
   Sets the `download` (anonymous read) policy on the images bucket so that Caddy can proxy image requests without authentication.

### Environment Variables Required

| Variable | Purpose |
|---|---|
| `MINIO_ROOT_USER` | MinIO admin username |
| `MINIO_ROOT_PASSWORD` | MinIO admin password |
| `MINIO_BUCKET_FILES` | Name of the private digital files bucket |
| `MINIO_BUCKET_IMAGES` | Name of the public product images bucket |

### Bucket Access Summary

| Bucket | Variable | Access |
|---|---|---|
| Digital product files | `$MINIO_BUCKET_FILES` | Private (authenticated API access only) |
| Product images | `$MINIO_BUCKET_IMAGES` | Public read (anonymous download via Caddy proxy) |
