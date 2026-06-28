# C4 Container -- Shopify Stack Clone

## System Overview

The Shopify Stack Clone (branded **PixelForge**) is a self-hosted digital product storefront that enables operators to sell downloadable digital goods (UI kits, icon packs, fonts, templates, illustrations, marketing assets) with full checkout, payment processing, customer accounts, and administrative tooling. The platform runs as a Docker Compose stack of nine containers communicating over a single bridge network (`app-network`), with Caddy as the single network entry point handling TLS termination and path-based routing.

The system separates concerns across four application containers (API Server, Customer Storefront, Admin Dashboard, Documentation Site) and five infrastructure containers (PostgreSQL, Valkey, MinIO, Caddy, Mailpit). All state mutations flow through the API Server, which acts as the sole integration point between front-end applications and infrastructure services. External system dependencies include Google OAuth 2.0 for authentication, Stripe for payment processing, and an SMTP relay for transactional email in production.

---

## Containers

### 1. Caddy Reverse Proxy

| Field | Value |
|---|---|
| **Type** | Reverse Proxy |
| **Technology** | Caddy 2 |
| **Docker Image** | `caddy:2-alpine` |
| **Ports** | `${CADDY_PORT}` (default 80) HTTP, `${CADDY_HTTPS_PORT}` (default 443) HTTPS |
| **Volumes** | `./docker/Caddyfile:/etc/caddy/Caddyfile:ro`, `caddy_data:/data`, `caddy_config:/config` |
| **Healthcheck** | None (depends on upstream services being started/healthy) |

**Purpose**: Single network entry point for all external traffic. Provides TLS termination (auto-provisioned Let's Encrypt certificates in production), path-based request routing to backend services, security response headers on every proxied response, and honeypot path forwarding for bot detection.

**Components**: [c4-component-infrastructure.md](c4-component-infrastructure.md) -- Section 3.4

**Interfaces**:

| # | Path Matcher | Target | Purpose |
|---|---|---|---|
| 1 | `/wp-login.php`, `/.env`, `/phpMyAdmin*`, `/admin.php`, `/xmlrpc.php`, `/wp-admin*`, `/setup.php` | `api:3001` | Honeypot paths forwarded to API bot-detector |
| 2 | `/admin` (exact) | `301 -> /admin/` | Trailing-slash redirect for SPA asset resolution |
| 3 | `/api/*` | `api:3001` | REST API and webhook requests |
| 4 | `/images/*` | `minio:9000` (rewritten to `/product-images/*`) | Public image proxy with Host header override |
| 5 | `/docs*` | `docs:3003` | Documentation site |
| 6 | `/admin/*` | `${ADMIN_BACKEND}` (default `admin:3002`) | Admin SPA |
| 7 | `/_next/webpack-hmr` | `storefront:3000` | Next.js HMR WebSocket (development) |
| 8 | `*` (catch-all) | `storefront:3000` | Customer storefront |

**Security Headers** (applied globally):

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `0` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `-Server` | (removed -- strips Caddy version fingerprint) |

**TLS Behaviour**:
- Development (`CADDY_HOSTNAME` unset): listens on `:80`, HTTP only.
- Production (`CADDY_HOSTNAME` set to a domain): Caddy auto-obtains Let's Encrypt TLS certificates and redirects HTTP to HTTPS.

**Dependencies**: storefront (started), admin (started), docs (started), api (healthy)

**Infrastructure config**: `docker-compose.yml` (caddy service), [`docker/Caddyfile`](../docker/Caddyfile)

---

### 2. API Server

| Field | Value |
|---|---|
| **Type** | API |
| **Technology** | Fastify 5, TypeScript, Node.js |
| **Docker Image** | Built from `api/Dockerfile` |
| **Port** | `${API_PORT}` (default 3001) |
| **Healthcheck** | `wget --spider -q http://127.0.0.1:3001/api/health` every 10s, 15s start period |
| **Stop Grace Period** | 30s |

**Purpose**: Central backend service orchestrating all server-side concerns. Handles authentication (Google OAuth), payment processing (Stripe), token-gated file downloads (MinIO presigned URLs), bot detection and IP banning, OFAC/sanctions compliance, tamper-evident audit logging (SHA-256 hash chain), analytics event ingestion, storefront content management, support tickets, newsletter subscriptions, and Prometheus metrics. Acts as the single integration point between all front-end applications and all infrastructure dependencies.

**Components**: [c4-component-api-server.md](c4-component-api-server.md)

**Interfaces**: 43+ REST endpoints organized into 13 route modules. Full specification: [apis/api-server-api.yaml](apis/api-server-api.yaml)

| Tag | Endpoint Count | Auth Level |
|---|---|---|
| auth | 5 | Public / Session |
| checkout | 4 | Public / Token / Stripe signature |
| download | 1 | Token |
| analytics | 2 | Public / Session |
| security | 4 + honeypots | Admin >= admin |
| audit | 1 | Admin >= admin |
| support | 5 | Session / Admin >= editor |
| email | 1 | Admin = super_admin |
| newsletter | 5 | Public / Session / Admin |
| banner | 2 | Public / Admin >= editor |
| pages | 2 | Public / Admin >= editor |
| reconciliation | 1 | Admin >= admin |
| health | 1 | Public (detail for admin) |
| metrics | 1 | Admin session |

**Dependencies**:

| Service | Protocol | Purpose |
|---|---|---|
| PostgreSQL 16 | TCP:5432 | Orders, analytics, support tickets, audit logs, security events |
| Valkey 8 | TCP:6379 | Sessions, rate limiting, bot detection state, security event buffer |
| MinIO | HTTP:9000 | Digital product file storage, presigned download URLs |
| Mailpit / SMTP | SMTP:1025 (dev) / 465,587 (prod) | Transactional and campaign email |
| Google OAuth 2.0 | HTTPS | User authentication |
| Stripe API | HTTPS | Payment processing, tax calculation, webhook verification |

**Prometheus Labels**: `prometheus.scrape: "true"`, `prometheus.port: "3001"`, `prometheus.path: "/api/metrics"`

**Infrastructure config**: `docker-compose.yml` (api service), `api/Dockerfile`

---

### 3. Customer Storefront

| Field | Value |
|---|---|
| **Type** | Web Application |
| **Technology** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| **Docker Image** | Built from `storefront/Dockerfile` |
| **Port** | `${STOREFRONT_PORT}` (default 3000) |
| **Output Mode** | Standalone |

**Purpose**: Public-facing web application providing the complete customer journey: product browsing with category filtering and search, collection pages, shopping cart (localStorage-persisted), two-phase Stripe checkout with optional tax calculation, Google OAuth login, account management (order history, downloads, support tickets), static legal/marketing pages, SEO (metadata, JSON-LD, sitemap, robots.txt), consent-gated analytics tracking, light/dark/system theming, promotional banner, and newsletter signup.

**Components**: [c4-component-storefront.md](c4-component-storefront.md)

**Interfaces**:

| Interface | Description |
|---|---|
| 21 App Router pages | `/`, `/products`, `/products/[slug]`, `/collections`, `/collections/[slug]`, `/cart`, `/checkout`, `/checkout/success`, `/search`, `/login`, `/account`, `/account/orders`, `/account/orders/[id]`, `/account/downloads`, `/account/support`, `/account/support/[id]`, `/account/support/new`, `/[slug]`, `/robots.txt`, `/sitemap.xml` |
| 16 API calls | Auth, checkout, analytics, banner, pages, newsletter, support -- all via HTTP to the API Server |
| Stripe.js | Payment UI rendering via `@stripe/react-stripe-js` |

**Dependencies**:

| Service | Protocol | Purpose |
|---|---|---|
| API Server | HTTP:3001 (internal) / `/api/*` (via Caddy) | All backend operations |
| Stripe.js | External CDN script | Payment UI and `stripe.confirmPayment()` |
| Google OAuth | HTTPS (via API redirect) | Customer authentication |

**Environment Variables**: `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`

**Infrastructure config**: `docker-compose.yml` (storefront service), `storefront/Dockerfile`

---

### 4. Admin Dashboard

| Field | Value |
|---|---|
| **Type** | Web Application (Single-Page Application) |
| **Technology** | Vite 6, React 19, TypeScript, Tailwind CSS, React Router, Recharts |
| **Docker Image** | Built from `admin/Dockerfile` |
| **Port** | `${ADMIN_PORT}` (default 3002) |
| **Base Path** | `/admin/` |

**Purpose**: Store management SPA for administrators. Provides dashboard overview with revenue charts, product and collection management, order management, customer management with segmentation, discount management, analytics and user behaviour insights, email campaign dispatch, promotional banner configuration, page visibility toggles, support ticket management, newsletter subscriber management, financial and tax reports, audit log viewer, real-time security monitoring dashboard with IP block/unblock, and store settings.

**Components**: [c4-component-admin-dashboard.md](c4-component-admin-dashboard.md)

**Interfaces**:

| Interface | Description |
|---|---|
| 29 client-side routes | Under `/admin/` -- login, dashboard, products, collections, orders, customers, discounts, analytics, insights, email, banner, pages, support, newsletter, reports, audit-log, security, settings |
| 21 API calls | Auth, analytics, banner, pages, email, support, newsletter, audit, security -- all via HTTP to the API Server |
| GitHub API (optional) | Commit history in audit log when `VITE_GITHUB_REPO` is configured |

**Data Sourcing**:
- **Mock data (client-side only)**: Products, collections, orders, customers, discounts sourced from `lib/mock-data.ts`. Save operations are UI-only (toast confirmation, no persistence).
- **Live API data**: Banner, Pages, Support Tickets, Newsletter, Audit Log, Security, Email, User Insights, Customer Detail support tickets tab.

**Dependencies**:

| Service | Protocol | Purpose |
|---|---|---|
| API Server | HTTP / `/api/*` (via Caddy) | All admin operations |
| Google OAuth | HTTPS (via API redirect) | Admin authentication |

**Environment Variables**: `VITE_API_URL`, `VITE_GITHUB_REPO`

**Infrastructure config**: `docker-compose.yml` (admin service), `admin/Dockerfile`

---

### 5. Documentation Site

| Field | Value |
|---|---|
| **Type** | Web Application |
| **Technology** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3 |
| **Docker Image** | Built from `docs/Dockerfile` (Node 20 Alpine) |
| **Port** | `${DOCS_PORT}` (default 3003) |
| **Base Path** | `/docs` |

**Purpose**: Developer and operator documentation site (branded StackDocs). Provides getting started guides, platform architecture overview, API endpoint reference, security and payments documentation, integration patterns, and compliance guidance. Read-only static content site with no API calls, no data fetching, and no authentication.

**Components**: [c4-component-docs-site.md](c4-component-docs-site.md)

**Interfaces**:

| Route | Description |
|---|---|
| `/docs/` | Introduction and landing page |
| `/docs/getting-started` | Prerequisites, installation, project structure |
| `/docs/platform-overview` | Storefront, Admin, infrastructure; comparison table |
| `/docs/api-reference` | Endpoints, auth, pagination, error format |
| `/docs/security` | Stripe integration, sessions, RBAC, compliance |
| `/docs/integrations` | Payment providers, email, storage, analytics, webhooks |

**Notable Absences**: No MDX, no syntax highlighting library, no search library, no icon library, no external data sources.

**Dependencies**:

| Service | Protocol | Purpose |
|---|---|---|
| Caddy | HTTP (reverse proxy) | Routes `/docs*` traffic to `docs:3003` |

**Infrastructure config**: `docker-compose.yml` (docs service), `docs/Dockerfile`

---

### 6. PostgreSQL 16

| Field | Value |
|---|---|
| **Type** | Relational Database |
| **Technology** | PostgreSQL 16 |
| **Docker Image** | `postgres:16-alpine` |
| **Port** | `${POSTGRES_PORT}` (default 5432) |
| **Volume** | `postgres_data:/var/lib/postgresql/data` |
| **Healthcheck** | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` every 5s |

**Purpose**: Primary relational store for all transactional, analytical, and compliance data. Managed by `node-pg-migrate` with 9 sequential migrations stored in `migrations/`. Extension: `pgcrypto` for `gen_random_uuid()`.

**Tables** (7):

| Table | PK Type | Purpose |
|---|---|---|
| `orders` | UUID | E-commerce order records (Stripe-backed) |
| `order_items` | BIGSERIAL | Line items belonging to an order |
| `analytics_events` | BIGSERIAL | Storefront page-view and interaction tracking |
| `support_tickets` | SERIAL | Customer support ticket headers |
| `ticket_messages` | SERIAL | Message thread entries within a ticket |
| `audit_logs` | BIGSERIAL | Immutable admin action audit trail (append-only, delete trigger protection) |
| `security_events` | BIGSERIAL (partitioned) | High-volume bot/threat event log (RANGE partitioned by `created_at`, monthly) |

**Compliance Protections**:
- `audit_logs` has a `BEFORE DELETE` trigger (`audit_logs_no_delete`) raising an exception -- append-only at the database level.
- `audit_logs.hash` implements a SHA-256 hash chain for tamper detection.
- Down migrations for audit log migrations are intentional no-ops.

**Dependencies**: None (leaf infrastructure service)

**Infrastructure config**: `docker-compose.yml` (postgres service), `migrations/` (9 migration files), `docker/backup.sh`

---

### 7. Valkey 8

| Field | Value |
|---|---|
| **Type** | Cache / Session Store |
| **Technology** | Valkey 8 (Redis-compatible) |
| **Docker Image** | `valkey/valkey:8-alpine` |
| **Port** | `${VALKEY_PORT}` (default 6379) |
| **Volume** | `valkey_data:/data` |
| **Healthcheck** | `valkey-cli ping` every 5s |

**Purpose**: In-memory key-value store serving four workload categories: (1) server-side session storage via `connect-redis`, (2) rate limiting with atomic `INCR`/`EXPIRE` counters, (3) security event buffering with async flush to PostgreSQL every 5 seconds, (4) bot detection state including cached bot scores, honeypot flags, rDNS verification, and inter-arrival time tracking.

**Key Namespace Summary**:

| Category | Key Prefix Examples | TTL Range |
|---|---|---|
| Sessions | `sess:*` | 24h |
| Auth brute-force | `auth:fail:{ip}`, `auth:cooldown:{ip}` | 15-30 min |
| OAuth nonces | `oauth:nonce:{nonce}` | 5 min |
| Rate limiting | `rl:checkout:{ip}`, `rl:analytics:{ip}`, `rl:newsletter:{ip}` | 60s |
| Bot detection | `sec:bot:score:{ip}`, `sec:honeypot:{ip}`, `sec:rdns:{ip}` | 60s-24h |
| Security counters | `sec:counter:req`, `sec:counter:429`, `sec:seen_ips` | 60s |
| Event buffer | `sec:events:buffer` | None (flushed every 5s) |
| Attack state | `sec:attacks:active`, `sec:attack:start` | 5min-24h |

**Dependencies**: None (leaf infrastructure service)

**Infrastructure config**: `docker-compose.yml` (valkey service)

---

### 8. MinIO

| Field | Value |
|---|---|
| **Type** | Object Storage |
| **Technology** | MinIO (S3-compatible) |
| **Docker Image** | `minio/minio:latest` |
| **Ports** | `${MINIO_PORT}` (default 9000) API, 9001 Console (internal only) |
| **Volume** | `minio_data:/data` |
| **Healthcheck** | `mc ready local` every 5s |
| **Init Sidecar** | `minio/mc:latest` runs `docker/minio-init.sh` (one-shot) |

**Purpose**: S3-compatible object storage hosting two buckets for digital product operations.

**Buckets**:

| Bucket | Access Policy | Purpose |
|---|---|---|
| `product-files` | Private (authenticated API access only) | Digital product download files. API generates 5-minute presigned URLs for authorized downloads. |
| `product-images` | Public read (anonymous download) | Product images served to the storefront via Caddy's `/images/*` proxy. |

**Integration Points**:
- **API Server**: MinIO SDK generates presigned download URLs for `product-files` bucket objects.
- **Caddy**: Public image requests at `GET /images/{filename}` are rewritten to `/product-images/{filename}` and proxied to `minio:9000` with the `Host` header set for correct virtual-host routing.

**Dependencies**: None (leaf infrastructure service)

**Infrastructure config**: `docker-compose.yml` (minio, minio-init services), `docker/minio-init.sh`

---

### 9. Mailpit

| Field | Value |
|---|---|
| **Type** | Development Tool (Email Capture) |
| **Technology** | Mailpit |
| **Docker Image** | `axllent/mailpit:latest` |
| **Ports** | `${MAILPIT_SMTP_PORT}` (default 1025) SMTP, `${MAILPIT_UI_PORT}` (default 8025) Web UI |
| **Healthcheck** | `wget --spider http://localhost:8025/` every 5s |

**Purpose**: Captures all outbound SMTP email from the API Server in development. Provides a web UI at port 8025 for inspecting intercepted messages (order confirmations, campaign emails). In production, the `SMTP_HOST` and `SMTP_PORT` environment variables would point at a real mail relay (e.g. Amazon SES, Postmark).

**Dependencies**: None (leaf infrastructure service)

**Infrastructure config**: `docker-compose.yml` (mailpit service)

---

## Container Diagram

```
C4Container
  title Container Diagram -- Shopify Stack Clone

  Person(customer, "Customer", "Purchases digital products")
  Person(admin, "Store Admin", "Manages store via dashboard")
  Person(developer, "Developer/Operator", "Monitors and maintains")

  Container_Boundary(system, "Shopify Stack Clone") {
    Container(caddy, "Caddy Reverse Proxy", "Caddy 2", "TLS termination, routing, security headers, honeypots")
    Container(storefront, "Customer Storefront", "Next.js 15", "Product browsing, cart, checkout, account management")
    Container(admin_app, "Admin Dashboard", "Vite + React 19", "Store management SPA")
    Container(api, "API Server", "Fastify 5 / Node.js", "REST API: auth, checkout, downloads, analytics, security")
    Container(docs_app, "Documentation Site", "Next.js", "Developer and operator docs")
    ContainerDb(db, "PostgreSQL 16", "PostgreSQL", "Orders, analytics, support tickets, audit log, security events")
    ContainerDb(cache, "Valkey 8", "Valkey (Redis-compatible)", "Sessions, rate limiting, security event buffer")
    ContainerDb(storage, "MinIO", "S3-compatible", "Product files and images")
    Container(mailpit, "Mailpit", "SMTP + Web UI", "Development email capture")
  }

  SystemExt(google, "Google OAuth 2.0", "Customer and admin authentication")
  SystemExt(stripe, "Stripe", "Payment processing and webhooks")
  SystemExt(smtp_prod, "Production SMTP", "Transactional email (Postmark/SES/etc.)")

  Rel(customer, caddy, "Uses", "HTTPS")
  Rel(admin, caddy, "Manages", "HTTPS")
  Rel(developer, caddy, "Monitors", "HTTPS")
  Rel(caddy, storefront, "Proxies /", "HTTP")
  Rel(caddy, admin_app, "Proxies /admin/*", "HTTP")
  Rel(caddy, api, "Proxies /api/*", "HTTP")
  Rel(caddy, docs_app, "Proxies /docs", "HTTP")
  Rel(caddy, storage, "Proxies /images/*", "HTTP")
  Rel(storefront, api, "API calls", "HTTP/REST")
  Rel(admin_app, api, "API calls", "HTTP/REST")
  Rel(api, db, "Reads/writes", "PostgreSQL TCP")
  Rel(api, cache, "Sessions/cache", "Redis protocol")
  Rel(api, storage, "File storage", "S3 API")
  Rel(api, mailpit, "Sends email", "SMTP")
  Rel(api, google, "OAuth flow", "HTTPS")
  Rel(api, stripe, "Payments", "HTTPS/REST")
  Rel(stripe, api, "Webhooks", "HTTPS/POST")
```

---

## Container Interaction Diagram

```
                              +-------------------+
                              |    Customers /     |
                              |    Admins /        |
                              |    Developers      |
                              +--------+----------+
                                       |
                                HTTPS / HTTP
                                       |
                              +--------v----------+
                              |  Caddy 2          |    <--- Let's Encrypt (prod)
                              |  Reverse Proxy    |
                              |  :80 / :443       |
                              +--+--+--+--+--+----+
                                 |  |  |  |  |
            +--------------------+  |  |  |  +------------------+
            |                       |  |  |                     |
      /api/* &               catch-all |  /admin/*          /images/*
      honeypot                |     |  |     |                  |
            |                 |     |  |     |                  |
      +-----v------+  +------v--+  |  | +---v------+   +-------v--------+
      |  API        |  | Store-  |  |  | |  Admin   |   |     MinIO      |
      |  Server     |  | front   |  |  | |  Dash-   |   |  product-images|
      |  Fastify 5  |  | Next.js |  |  | |  board   |   |  product-files |
      |  :3001      |  | :3000   |  |  | |  :3002   |   |  :9000         |
      +--+--+--+----+  +--------+   |  | +----------+   +----------------+
         |  |  |                     |  |
         |  |  |               +-----v--+
         |  |  |               |  Docs   |
         |  |  |               | Next.js |
         |  |  |               |  :3003  |
         |  |  |               +---------+
         |  |  |
         |  |  +--------> Mailpit (SMTP :1025, UI :8025)
         |  |
         |  +-----------> Valkey 8 (:6379)
         |                  sessions, rate limits,
         |                  bot state, event buffer
         |
         +--------------> PostgreSQL 16 (:5432)
                            orders, analytics,
                            support, audit, security

      External:
         API -----------> Google OAuth 2.0 (HTTPS)
         API <----------> Stripe API (HTTPS)
         Stripe --------> API /api/checkout/webhook (HTTPS POST)
```

---

## Service Dependency Graph

Startup order enforced by Docker Compose `depends_on` with health/start conditions:

```
postgres (healthy) ----+
valkey   (healthy) ----+
minio    (healthy) ----+----> api (healthy) ----+----> storefront (started) ---+
mailpit  (healthy) ----+                        |                              |
                                                +----> admin (started) --------+
                                                |                              +----> caddy
minio (healthy) ----> minio-init (one-shot)     +----> docs (started) ---------+
```

---

## Network and Volumes

### Network

All services connect to a single bridge network: `app-network`. Services reference each other by Docker Compose service name (e.g., `postgres`, `valkey`, `minio:9000`, `api:3001`, `storefront:3000`, `admin:3002`, `docs:3003`).

### Named Volumes

| Volume | Service | Purpose |
|---|---|---|
| `postgres_data` | postgres | Persistent database storage |
| `valkey_data` | valkey | Persistent cache/session data |
| `minio_data` | minio | Persistent object storage |
| `caddy_data` | caddy | TLS certificates and ACME state |
| `caddy_config` | caddy | Caddy runtime configuration |

---

## External Systems

| System | Protocol | Integration Point | Purpose |
|---|---|---|---|
| Google OAuth 2.0 | HTTPS | API Server (`auth.ts`) | User authentication for both admin and customer login flows |
| Stripe API | HTTPS | API Server (`stripe` plugin, `checkout.ts`, `reconciliation.ts`) | PaymentIntent creation, Tax Calculations, webhook verification, daily reconciliation |
| Stripe Webhooks | HTTPS POST (inbound) | API Server (`POST /api/checkout/webhook`) | Payment confirmation events (`payment_intent.succeeded`) |
| Production SMTP | SMTP:465/587 | API Server (`mailer` plugin) | Transactional email in production (order confirmations, campaigns) |
| Tor Project | HTTPS (startup) | API Server (`bot-detector` plugin) | Bulk exit node list download for bot scoring |
| MaxMind GeoIP | Local filesystem | API Server (`bot-detector` plugin) | Optional IP geolocation and ASN lookup databases |
| GitHub API | HTTPS (optional) | Admin Dashboard (`AuditLog` page) | Commit history display when `VITE_GITHUB_REPO` is configured |

---

## API Specifications

- API Server REST API: [apis/api-server-api.yaml](apis/api-server-api.yaml)

---

## Infrastructure

| Resource | Location | Description |
|---|---|---|
| Docker Compose | `docker-compose.yml` | Defines all 10 services, 5 volumes, 1 network |
| Reverse Proxy Config | `docker/Caddyfile` | Caddy routing rules, security headers, honeypot paths |
| Database Migrations | `migrations/` | 9 sequential `node-pg-migrate` JS migrations |
| Backup Script | `docker/backup.sh` | Daily `pg_dump` with gzip compression, 30-day retention |
| MinIO Init Script | `docker/minio-init.sh` | One-shot bucket creation and access policy setup |
| Data Files | `data/` | 6 JSON config files (admins, banner, pages, newsletter, banned-ips, sanctions-blocklist) |
| Environment Config | `.env.example` | All environment variables with defaults |

---

## Authorization Model

The API Server enforces a tiered authorization model across all endpoints:

| Layer | Mechanism | Where |
|---|---|---|
| IP Ban | In-memory banned IP set (from `data/banned-ips.json`) | `auth-guard` `onRequest` hook |
| Bot Scoring | Multi-signal score 0.0--1.0; >= 0.85 triggers auto-ban | `bot-detector` `onRequest` hook |
| Session Check | Valid session cookie required for non-public routes | `auth-guard` `onRequest` hook |
| Tier Check | Admin tier >= required level | Route-level via `meetsMinTier()` |
| Rate Limiting | Per-IP Valkey counters with TTL windows | Individual route handlers |

**Admin Tier Privilege Ladder**:

| Tier | Level | Capabilities |
|---|---|---|
| `viewer` | 1 | Read-only admin access |
| `editor` | 2 | Support ticket updates, newsletter/banner/pages management |
| `admin` | 3 | Security dashboard, IP block/unblock, audit logs, reconciliation, metrics |
| `super_admin` | 4 | Email campaign dispatch |

---

## Cross-Cutting Concerns

### Observability

- **Prometheus Metrics**: API Server exposes `GET /api/metrics` with HTTP request histograms, security counters (auth failures, rate limits, IP bans, bot classifications), and business gauges (revenue, orders, AOV, gross profit) across 5 time periods. Business metrics polled from PostgreSQL every 60s.
- **Access Logs**: Caddy writes JSON-formatted access logs to stdout; Docker captures them for log aggregation.
- **Health Checks**: `GET /api/health` probes PostgreSQL, Valkey, and MinIO connectivity. Public callers see pass/fail; authenticated admins see per-service detail.

### Security

- **Honeypot Endpoints**: Common attack paths (`/wp-login.php`, `/.env`, `/admin.php`, etc.) forwarded from Caddy to API for bot detection scoring and automatic IP banning.
- **Tamper-Evident Audit Log**: SHA-256 hash chain with PostgreSQL advisory lock serialization; delete-protected at the database level.
- **Sanctions Screening**: OFAC/domain blocklist checked before every checkout transaction.
- **Progressive Ban Escalation**: 6 auth failures in 15 minutes trigger cooldown; attempt during cooldown triggers permanent IP ban.

### Data Persistence Strategy

| Data Type | Store | Rationale |
|---|---|---|
| Transactional data (orders, tickets, audit) | PostgreSQL | ACID guarantees, relational queries |
| Ephemeral state (sessions, rate limits, bot scores) | Valkey | Sub-millisecond access, automatic TTL expiry |
| Digital product files | MinIO | S3-compatible, presigned URLs, bucket-level access control |
| Admin configuration (banner, pages, newsletter) | Flat JSON files | Simple read/write, no DB dependency for content toggles |
| Security blocklists (IPs, sanctions) | Flat JSON files with hot-reload | Instant updates via `fs.watchFile`, no restart required |
