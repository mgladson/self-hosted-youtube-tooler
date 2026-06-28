# C4 Component -- API Server

## 1. Overview

- **Name**: API Server
- **Type**: Service
- **Technology**: Fastify 5, TypeScript, Node.js
- **Location**: `api/`
- **Deployment**: Docker container, port 3001
- **Reverse Proxy**: Caddy routes `/api/*` to port 3001

## 2. Purpose

The API Server is the central backend service for the Shopify Stack Clone, a self-hosted digital product storefront. It orchestrates every server-side concern: authenticating users via Google OAuth, processing payments through Stripe, serving token-gated file downloads from MinIO, detecting and banning malicious bots, enforcing OFAC/sanctions compliance, recording tamper-evident audit logs, ingesting front-end analytics, managing storefront content, handling customer support tickets, and exposing Prometheus metrics for observability.

The service acts as the single point of integration between the Storefront (Next.js), the Admin Dashboard (Vite/React), and all infrastructure dependencies (PostgreSQL, Valkey, MinIO, SMTP, Stripe, Google OAuth). It exposes a REST API consumed by both front-end applications and external webhooks (Stripe). All state mutations flow through this service, ensuring centralized authorization enforcement (role- and tier-based), rate limiting, and audit trail generation.

The API is built on Fastify 5 with a plugin architecture where 10 plugins provide infrastructure connectivity and cross-cutting security concerns, and 13 route modules implement all HTTP endpoints. A static in-memory product catalog eliminates the need for a products database table. Configuration is environment-variable-driven with hard guards that prevent production startup without a proper session secret.

## 3. Software Features

### Authentication (Google OAuth)
Dual-role Google OAuth 2.0 login flow for admin and customer users, with nonce-based CSRF protection, progressive rate limiting per IP (6 failures trigger cooldown, subsequent attempt triggers permanent ban), session management backed by Valkey/Redis, and a development-only direct-login bypass.

### Checkout and Payments (Stripe Integration)
Full purchase lifecycle: cart validation against the in-memory product catalog, OFAC/sanctions screening on buyer email, Stripe PaymentIntent creation with optional automatic tax calculation (Stripe Tax), webhook processing for payment confirmation, order persistence in PostgreSQL, and HTML confirmation email dispatch.

### File Downloads (Token-Gated Presigned URLs)
Serves digital product files via short-lived (5-minute) MinIO presigned URL redirects, gated by order token with constant-time comparison to prevent timing attacks. Downloads are instantly revocable on chargeback or refund by checking order status on every request.

### Security (Bot Detection, IP Banning, Honeypots, Sanctions Screening)
Multi-signal bot scoring system (0.0-1.0 scale) combining user-agent classification, missing headers, honeypot path hits, rDNS spoofing detection, Tor exit node membership, datacenter ASN identification, inter-arrival time analysis, and fast-checkout anomaly detection. Scores above 0.85 trigger automatic IP bans. Honeypot endpoints mimic common attack targets (`/wp-login.php`, `/.env`, `/admin.php`). An email/domain sanctions blocklist screens checkout transactions. IP bans support CIDR notation and are persisted to disk with hot-reload.

### Analytics (Event Ingestion and Reporting)
Public endpoint for batch ingestion of anonymous front-end behavioural events (page views, scroll depth, clicks, element visibility, page exits) with per-IP rate limiting. Admin reporting endpoint runs 6 parallel queries to produce summaries, time series, top pages, scroll distributions, click heatmaps, and element impression rankings.

### Audit Logging (Tamper-Evident Hash Chain)
SHA-256 cryptographic hash chain where each entry's hash incorporates the previous entry's hash, the actor's email, the action, the resource type, and the summary. Serialized via PostgreSQL advisory transaction locks to maintain chain integrity under concurrent writes. Captures before/after state for SOX-style change tracking on mutations.

### Support Tickets
Full ticket lifecycle: customer creation, message threading, admin triage with status and priority management. Customers see only their own tickets (no information leakage on 404). Admin agents at editor tier or above can view all tickets and update status/priority.

### Newsletter Management
Newsletter subscription with email validation, rate limiting, and deduplication. Flat-file persistence (`data/newsletter.json`). Admin controls for enabling/disabling subscriptions, viewing the subscriber list, and removing subscribers. All mutations are audit-logged.

### Banner Management
Storefront announcement banner with active/inactive toggle, text content, optional image and link. Flat-file persistence (`data/banner.json`). Public read, admin write (editor tier+). All mutations are audit-logged.

### Pages Management
Under-construction toggle for five known content pages (`privacy-policy`, `terms-of-service`, `refund-policy`, `changelog`, `roadmap`). Flat-file persistence (`data/pages.json`). Public read, admin write (editor tier+). All mutations are audit-logged.

### Email (Transactional and Campaign)
Transactional emails sent automatically on payment confirmation. Campaign dispatch available to super_admin tier only, with per-recipient error collection and audit logging of send results.

### Metrics (Prometheus)
Prometheus-format metrics endpoint (`/api/metrics`) exposing HTTP request duration/count histograms, security counters (auth failures, rate limit hits, IP bans, bot classifications), and business metric gauges (revenue, orders, AOV, gross profit, products, customers) across five time periods. Business metrics are polled from PostgreSQL every 60 seconds.

### Order Reconciliation
Daily reconciliation of local paid orders against Stripe PaymentIntents, identifying four discrepancy types: missing in database, PI not succeeded, amount mismatch, and missing Stripe reference. Admin access only (admin tier+).

## 4. Code Elements

| Document | Location | Description |
|----------|----------|-------------|
| [c4-code-api-src.md](c4-code-api-src.md) | `api/src/` | Entry point (`buildApp`, `start`), centralized configuration (`config`), and in-memory product catalog (`products.ts` with 12 digital products) |
| [c4-code-api-src-lib.md](c4-code-api-src-lib.md) | `api/src/lib/` | Library utilities -- currently the tamper-evident audit log writer (`writeAuditLog`) with SHA-256 hash chain and PostgreSQL advisory lock serialization |
| [c4-code-api-src-plugins.md](c4-code-api-src-plugins.md) | `api/src/plugins/` | 10 Fastify plugins providing infrastructure connectivity (postgres, valkey, minio), authentication/sessions (session, auth-guard), payments (stripe), email (mailer), security (bot-detector, sanctions), and observability (metrics) |
| [c4-code-api-src-routes.md](c4-code-api-src-routes.md) | `api/src/routes/` | 13 route modules implementing all HTTP endpoints across authentication, checkout, downloads, analytics, security, audit, support, email, newsletter, banner, pages, reconciliation, and health |

## 5. Interfaces

### HTTP REST API

#### Public Endpoints (No Authentication)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None (admin gets detail) | Infrastructure liveness check for PostgreSQL, Valkey, MinIO |
| GET | `/api/auth/google` | None | Initiate admin Google OAuth flow (rate-limited 5/15min/IP) |
| GET | `/api/auth/customer/google` | None | Initiate customer Google OAuth flow |
| GET | `/api/auth/google/callback` | None | Google OAuth callback; validates nonce, exchanges code, issues session |
| POST | `/api/auth/dev-login` | None (dev only) | Direct login bypass for development environment |
| GET | `/api/checkout/config` | None | Return Stripe Tax enabled flag |
| POST | `/api/checkout/create-payment-intent` | None | Validate cart, screen sanctions, create order + Stripe PaymentIntent (rate-limited 10/60s/IP) |
| POST | `/api/checkout/webhook` | Stripe signature | Stripe webhook -- mark order paid, detect fast-checkout anomaly, send confirmation email |
| GET | `/api/checkout/order/:id` | Token | Fetch order detail + presigned download links (constant-time token comparison) |
| GET | `/api/download/:orderId/:productId` | Token | Redirect to 5-minute MinIO presigned URL (revocable on chargeback) |
| POST | `/api/analytics/events` | None | Ingest batch of up to 50 client-side behaviour events (rate-limited 60/60s/IP) |
| GET | `/api/newsletter/settings` | None | Get newsletter enabled flag |
| POST | `/api/newsletter/subscribe` | None | Subscribe an email address (rate-limited 5/60s/IP) |
| GET | `/api/banner` | None | Get storefront announcement banner state |
| GET | `/api/pages` | None | Get page under-construction flags |
| GET/POST | `/wp-login.php` | None | Honeypot (always 404, may trigger IP ban) |
| GET/POST | `/.env` | None | Honeypot (always 404, may trigger IP ban) |
| GET/POST | `/admin.php` | None | Honeypot (always 404, may trigger IP ban) |
| GET/POST | `/xmlrpc.php` | None | Honeypot (always 404, may trigger IP ban) |
| GET/POST | `/setup.php` | None | Honeypot (always 404, may trigger IP ban) |
| GET | `/phpMyAdmin/*` | None | Wildcard honeypot (always 404, may trigger IP ban) |
| GET | `/wp-admin/*` | None | Wildcard honeypot (always 404, may trigger IP ban) |

#### Authenticated Endpoints (Any Session)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/me` | Session | Return current session user object |
| POST | `/api/auth/logout` | None | Destroy session |
| GET | `/api/analytics/behavior` | Session | Aggregated behaviour analytics report (6 parallel queries) |
| POST | `/api/support/tickets` | Session | Create a support ticket |
| GET | `/api/support/tickets` | Session | List support tickets (customers see own only) |
| GET | `/api/support/tickets/:id` | Session | Get ticket + messages (customers see own only) |
| POST | `/api/support/tickets/:id/messages` | Session | Reply to a ticket |

#### Admin Endpoints (Tier >= editor)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/api/support/tickets/:id` | Admin >= editor | Update ticket status and/or priority |
| PUT | `/api/newsletter/settings` | Admin >= editor | Enable/disable newsletter subscriptions |
| DELETE | `/api/newsletter/subscribers/:email` | Admin >= editor | Remove a subscriber |
| PUT | `/api/banner` | Admin >= editor | Update storefront announcement banner |
| PUT | `/api/pages/:slug` | Admin >= editor | Toggle under-construction for a content page |

#### Admin Endpoints (Tier >= admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/security/dashboard` | Admin >= admin | Real-time security operations dashboard (8 parallel queries) |
| GET | `/api/security/report` | Admin >= admin | Structured security report with actionable tasks (up to 90 days) |
| POST | `/api/security/block` | Admin >= admin | Ban an IP or CIDR range |
| DELETE | `/api/security/block/:ip` | Admin >= admin | Unban an IP or CIDR range |
| GET | `/api/audit/logs` | Admin >= admin | Paginated, filterable audit log |
| GET | `/api/admin/reconciliation` | Admin >= admin | Daily Stripe payment reconciliation report |
| GET | `/api/metrics` | Admin session | Prometheus scrape endpoint |

#### Admin Endpoints (Tier = super_admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/email/send` | Admin = super_admin | Send bulk email campaign to recipient list |

#### Admin Endpoints (Any Admin Tier)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/newsletter/subscribers` | Admin (any tier) | List all newsletter subscribers |

### Plugin Decorators

All plugins use `fastify-plugin` (`fp`) to escape Fastify's encapsulation scope, making their decorators globally available across the application instance.

| Decorator | Type | Registered by | Description |
|-----------|------|---------------|-------------|
| `fastify.pg` | `pg.Pool` | `postgres` plugin | Shared PostgreSQL connection pool (max 20 connections, probed at startup) |
| `fastify.valkey` | `ioredis.Redis` | `valkey` plugin | Shared Valkey/Redis client (lazy connect, probed at startup) |
| `fastify.minio` | `Minio.Client` | `minio` plugin | S3-compatible object storage client (probed via `listBuckets` at startup) |
| `fastify.mailer` | `Mailer` | `mailer` plugin | SMTP mail sender with `sendMail(to, subject, html)` method |
| `fastify.stripe` | `Stripe` | `stripe` plugin | Stripe API client (not registered if secret key missing) |
| `fastify.sanctions` | `SanctionsGuard` | `sanctions` plugin | Email/domain blocklist with `isBlocked`, `addEntry`, `removeEntry`, `getList` |
| `fastify.authGuard` | `AuthGuard` | `auth-guard` plugin | IP ban management, admin email verification, failed-attempt tracking, progressive banning |
| `fastify.metrics` | `MetricsRegistry` | `metrics` plugin | Prometheus registry, service health gauge, and security/business counters |
| `request.session` | `Session` | `session` plugin | Server-side session with `user` property (`email`, `name`, `picture`, `role`, `adminTier?`) |

### Fastify Lifecycle Hooks

| Hook | Registered by | Purpose |
|------|---------------|---------|
| `onRequest` | `auth-guard` plugin | IP ban check + unauthenticated route guard for non-public paths |
| `onRequest` | `bot-detector` plugin | Per-request rate tracking, UA classification, bot scoring, honeypot detection |
| `onResponse` | `metrics` plugin | Record HTTP request duration and total count (excludes `/api/metrics`) |
| `onReady` | `metrics` plugin | Start business metrics polling interval (every 60 seconds) |
| `onReady` | `bot-detector` plugin | Start attack detection (30s), event flush (5s), and retention cleanup (24h) intervals |
| `onClose` | `postgres` plugin | Drain connection pool |
| `onClose` | `valkey` plugin | Graceful disconnect |
| `onClose` | `mailer` plugin | Close SMTP transport |
| `onClose` | `auth-guard` plugin | Stop file watchers |
| `onClose` | `sanctions` plugin | Stop file watcher |
| `onClose` | `metrics` plugin | Clear business metrics polling interval |
| `onClose` | `bot-detector` plugin | Clear all background intervals |

## 6. Dependencies

### Internal (Infrastructure Services)

| Service | Protocol | Plugin | Default (dev) | Purpose |
|---------|----------|--------|---------------|---------|
| PostgreSQL 16 | TCP:5432 | `postgres` | `localhost:5432`, db `shopify_stack` | Orders, analytics events, support tickets, audit logs, security events |
| Valkey 8 (Redis-compatible) | TCP:6379 | `valkey` | `localhost:6379` | Sessions (`sess:*`), rate limiting, security counters, bot scores, event buffers |
| MinIO (S3-compatible) | HTTP:9000 | `minio` | `localhost:9000` | Digital product file storage, presigned download URLs |

### External Systems

| System | Protocol | Plugin/Module | Purpose |
|--------|----------|---------------|---------|
| Google OAuth 2.0 | HTTPS | `auth.ts` via `google-auth-library` | User authentication (admin and customer login) |
| Stripe API | HTTPS | `stripe` plugin, `checkout.ts`, `reconciliation.ts` | Payment processing (PaymentIntents, Tax Calculations, webhook verification) |
| SMTP Server | SMTP:1025 (dev) / 465,587 (prod) | `mailer` plugin | Transactional emails (order confirmation) and campaign dispatch |
| MaxMind GeoIP | Local filesystem | `bot-detector` plugin | Optional IP geolocation and ASN lookup (`GeoLite2-Country.mmdb`, `GeoLite2-ASN.mmdb`) |
| Tor Project | HTTPS (startup only) | `bot-detector` plugin | Bulk exit node list download for bot scoring |

### Flat-File Data Dependencies

| File | Hot-Reload | Read by | Written by |
|------|------------|---------|------------|
| `data/admins.json` | Yes (5s interval) | `auth-guard` plugin | Manual (external) |
| `data/banned-ips.json` | Yes (1s interval) | `auth-guard` plugin | `auth-guard` plugin, `security.ts` routes |
| `data/sanctions-blocklist.json` | Yes (5s interval) | `sanctions` plugin | `sanctions` plugin |
| `data/banner.json` | No (read per request) | `banner.ts` route | `banner.ts` route |
| `data/pages.json` | No (read per request) | `pages.ts` route | `pages.ts` route |
| `data/newsletter.json` | No (read per request) | `newsletter.ts` route | `newsletter.ts` route |

### PostgreSQL Tables

| Table | Used by | Description |
|-------|---------|-------------|
| `orders` | `checkout.ts`, `download.ts`, `reconciliation.ts` | Order records with status, payment status, Stripe PI reference |
| `order_items` | `checkout.ts`, `download.ts` | Line items for each order |
| `analytics_events` | `analytics.ts` | Front-end behavioural events |
| `support_tickets` | `support.ts` | Support ticket metadata |
| `ticket_messages` | `support.ts` | Support ticket message thread |
| `audit_logs` | `lib/audit.ts`, `audit.ts`, `auth-guard` plugin | Tamper-evident hash-chained audit entries |
| `security_events` | `bot-detector` plugin, `security.ts` | Security events (partitioned monthly, 90-day retention) |

### npm Package Dependencies

| Package | Used by | Purpose |
|---------|---------|---------|
| `fastify` | All modules | HTTP server framework (v5) |
| `fastify-plugin` | All plugins | Encapsulation escape for global decorator visibility |
| `pg` | `postgres` plugin | PostgreSQL client and connection pool |
| `ioredis` | `valkey` plugin | Redis/Valkey client |
| `minio` | `minio` plugin | S3-compatible object storage client |
| `nodemailer` | `mailer` plugin | SMTP mail transport |
| `stripe` | `stripe` plugin | Stripe Payments SDK |
| `@fastify/cookie` | `session` plugin | Cookie parsing |
| `@fastify/session` | `session` plugin | Server-side session management |
| `connect-redis` | `session` plugin | Redis-backed session store |
| `prom-client` | `metrics` plugin | Prometheus metrics instrumentation |
| `google-auth-library` | `auth.ts` | Google OAuth 2.0 token exchange and ID token verification |
| `maxmind` | `bot-detector` plugin | Optional GeoIP/ASN database reader |
| `node:crypto` | Multiple modules | SHA-256 hashing, UUID generation, `timingSafeEqual` |
| `node:fs` | `banner.ts`, `pages.ts`, `newsletter.ts`, plugins | Flat-file read/write, file watching |

## 7. Component Diagram

```
C4Component
  title API Server -- Component Diagram

  Container_Boundary(api, "API Server (Fastify 5, TypeScript, Node.js) [port 3001]") {

    Component(config, "Configuration", "TypeScript", "Env-based config with 7 namespaced sub-objects; production guard on SESSION_SECRET")
    Component(products, "Product Catalog", "TypeScript", "In-memory Map of 12 digital products; getProductById + validateCartItems")

    Component_Group(plugins, "Fastify Plugins") {
      Component(pg_plugin, "postgres", "pg.Pool", "Connection pool (max 20), startup probe, onClose drain")
      Component(vk_plugin, "valkey", "ioredis.Redis", "Redis-compatible client, lazy connect, startup probe")
      Component(mn_plugin, "minio", "Minio.Client", "S3-compatible object storage, startup bucket probe")
      Component(ml_plugin, "mailer", "nodemailer", "SMTP transporter with sendMail(to, subject, html)")
      Component(st_plugin, "stripe", "Stripe SDK", "Payment processing client (skipped if key missing)")
      Component(se_plugin, "session", "@fastify/session + connect-redis", "Server-side sessions in Valkey with sess: prefix, 24h TTL")
      Component(ag_plugin, "auth-guard", "TypeScript", "IP ban enforcement, admin email/tier lookup, progressive rate limiting, onRequest hook")
      Component(bd_plugin, "bot-detector", "TypeScript", "Multi-signal bot scoring (0-1), honeypot detection, attack detection, event flush to PG")
      Component(sa_plugin, "sanctions", "TypeScript", "Email/domain blocklist with hot-reload from data/sanctions-blocklist.json")
      Component(me_plugin, "metrics", "prom-client", "Prometheus registry, HTTP/security/business gauges, /api/metrics endpoint")
    }

    Component_Group(routes, "Route Handlers") {
      Component(r_auth, "auth", "TypeScript", "Google OAuth login/callback, dev-login, session introspection, logout")
      Component(r_checkout, "checkout", "TypeScript", "Cart validation, PI creation, webhook processing, order retrieval")
      Component(r_download, "download", "TypeScript", "Token-gated MinIO presigned URL redirect")
      Component(r_health, "health", "TypeScript", "Liveness check for PG, Valkey, MinIO")
      Component(r_analytics, "analytics", "TypeScript", "Event ingestion + 6-query behaviour report")
      Component(r_security, "security", "TypeScript", "Dashboard, report, block/unblock, honeypot endpoints")
      Component(r_audit, "audit", "TypeScript", "Paginated read-only audit log")
      Component(r_support, "support", "TypeScript", "Ticket CRUD + message threading")
      Component(r_email, "email", "TypeScript", "Bulk email campaign dispatch (super_admin)")
      Component(r_newsletter, "newsletter", "TypeScript", "Subscribe, unsubscribe, settings, subscriber list")
      Component(r_banner, "banner", "TypeScript", "Storefront announcement banner CRUD")
      Component(r_pages, "pages", "TypeScript", "Page under-construction flag toggle")
      Component(r_recon, "reconciliation", "TypeScript", "Daily Stripe vs DB order reconciliation")
    }

    Component(lib_audit, "Audit Log Writer", "TypeScript + SHA-256", "writeAuditLog with advisory-lock-serialized hash chain")
  }

  System_Ext(postgres, "PostgreSQL 16", "Relational database: orders, analytics, tickets, audit logs, security events")
  System_Ext(valkey, "Valkey 8", "Redis-compatible cache: sessions, rate limits, bot scores, event buffers")
  System_Ext(minio, "MinIO", "S3-compatible object storage: product files and images")
  System_Ext(google, "Google OAuth 2.0", "User identity provider for admin and customer login")
  System_Ext(stripe, "Stripe API", "Payment processing: PaymentIntents, Tax, webhooks")
  System_Ext(smtp, "SMTP Server", "Email delivery (Mailpit in dev, production SMTP in prod)")
  System_Ext(tor, "Tor Project", "Bulk exit node list (fetched at startup)")
  System_Ext(maxmind, "MaxMind GeoIP", "Optional .mmdb files for IP geolocation and ASN lookup")

  Rel(pg_plugin, postgres, "TCP:5432", "pg.Pool")
  Rel(vk_plugin, valkey, "TCP:6379", "ioredis")
  Rel(mn_plugin, minio, "HTTP:9000", "minio.Client")
  Rel(ml_plugin, smtp, "SMTP:1025/465/587", "nodemailer")
  Rel(st_plugin, stripe, "HTTPS", "Stripe SDK")

  Rel(se_plugin, vk_plugin, "Uses", "connect-redis session store (sess: prefix)")
  Rel(ag_plugin, vk_plugin, "Uses", "Rate limit counters, event buffer")
  Rel(ag_plugin, pg_plugin, "Uses", "Audit log inserts for ban/unban")
  Rel(ag_plugin, me_plugin, "Uses", "authFailuresTotal, ipBansTotal counters")
  Rel(bd_plugin, vk_plugin, "Uses", "Request counters, bot scores, IAT windows, event buffer")
  Rel(bd_plugin, pg_plugin, "Uses", "security_events INSERT, partition DDL")
  Rel(bd_plugin, ag_plugin, "Uses", "banIp for high-confidence bots")
  Rel(bd_plugin, me_plugin, "Uses", "httpRequestsByUaClassTotal counter")
  Rel(bd_plugin, tor, "HTTPS", "Startup fetch of exit node list")
  Rel(bd_plugin, maxmind, "Filesystem", "Optional .mmdb lookup")

  Rel(r_auth, google, "HTTPS", "OAuth token exchange + ID token verification")
  Rel(r_auth, ag_plugin, "Uses", "isAdminEmail, getAdminTier, recordFailedAttempt")
  Rel(r_auth, vk_plugin, "Uses", "OAuth nonce storage, rate limit counters")

  Rel(r_checkout, st_plugin, "Uses", "PaymentIntent creation, Tax Calculations")
  Rel(r_checkout, sa_plugin, "Uses", "Sanctions screening on buyer email")
  Rel(r_checkout, products, "Uses", "validateCartItems for cart pricing")
  Rel(r_checkout, lib_audit, "Uses", "order_created, payment_success, payment_failed")
  Rel(r_checkout, pg_plugin, "Uses", "Order + order_items persistence")
  Rel(r_checkout, ml_plugin, "Uses", "Order confirmation email")

  Rel(r_download, pg_plugin, "Uses", "Order status + token verification")
  Rel(r_download, mn_plugin, "Uses", "Presigned URL generation")

  Rel(r_analytics, pg_plugin, "Uses", "Event INSERT + behaviour report queries")
  Rel(r_security, pg_plugin, "Uses", "Security dashboard + report queries")
  Rel(r_support, pg_plugin, "Uses", "Ticket + message CRUD")
  Rel(r_support, lib_audit, "Uses", "create, update audit entries")
  Rel(r_recon, pg_plugin, "Uses", "Order queries for reconciliation")
  Rel(r_recon, st_plugin, "Uses", "Stripe PI listing for reconciliation")

  Rel(r_email, ml_plugin, "Uses", "Campaign email dispatch")
  Rel(r_email, lib_audit, "Uses", "send audit entry")

  Rel(r_banner, lib_audit, "Uses", "update, create, delete audit entries")
  Rel(r_pages, lib_audit, "Uses", "update, create, delete audit entries")
  Rel(r_newsletter, lib_audit, "Uses", "create, delete audit entries")

  Rel(lib_audit, pg_plugin, "Uses", "Advisory lock + INSERT into audit_logs")
```

## 8. Plugin Registration Order

Fastify resolves plugin `dependencies` arrays at registration time. The required order is:

```
1. metrics      (no deps)
2. postgres     (no deps)          --|
3. valkey       (no deps)          --+--> session --> auth-guard --> bot-detector
4. minio        (no deps)          --|
5. mailer       (no deps)
6. stripe       (no deps)
7. session      (needs valkey)
8. sanctions    (no deps -- can go anywhere)
9. auth-guard   (needs valkey, postgres, session, metrics)
10. bot-detector (needs valkey, postgres, metrics, auth-guard)
```

After all plugins are registered, the 13 route modules are registered: health, email, auth, analytics, banner, pages, support, checkout, download, newsletter, audit, security, reconciliation.

## 9. Authorization Model

### Admin Tier Privilege Ladder

| Tier | Level | Capabilities |
|------|-------|-------------|
| `viewer` | 1 | Read-only admin access (no endpoint currently requires this minimum) |
| `editor` | 2 | Support ticket updates, newsletter/banner/pages management, subscriber removal |
| `admin` | 3 | Security dashboard, security report, IP block/unblock, audit logs, reconciliation, Prometheus metrics |
| `super_admin` | 4 | Email campaign dispatch |

### Route Protection Layers

1. **IP Ban Check** (`auth-guard` `onRequest` hook): Every request is checked against the in-memory banned IP set. Banned IPs receive `403` immediately.
2. **Bot Scoring** (`bot-detector` `onRequest` hook): Every request is scored; scores >= 0.85 trigger an automatic ban.
3. **Session Check** (`auth-guard` `onRequest` hook): Non-public routes without a valid session receive `401`.
4. **Tier Check** (route-level via `meetsMinTier`): Admin endpoints verify the session user's `adminTier` meets the minimum required level.
5. **Per-Route Rate Limits**: Implemented in individual routes using Valkey counters with TTL-based sliding windows.

## 10. Key Design Decisions

**Static product catalog**: Products are defined in-memory in `products.ts` (12 items). There is no database table for products. Any catalog change requires a code deployment.

**Flat-file persistence for content**: Banner, pages, newsletter, admin list, banned IPs, and sanctions blocklist are stored as JSON files in `data/`. Hot-reload via `fs.watchFile` (1-5 second intervals) enables live updates without restarts for security-critical files.

**Tamper-evident audit chain**: The audit log uses SHA-256 hash chaining with PostgreSQL advisory transaction locks for serialization, providing tamper detection without requiring a separate blockchain or external service. The tradeoff is that all audit writes contend on a single advisory lock.

**Progressive ban escalation**: Auth failures are tracked per-IP in Valkey with a 15-minute cooldown window. Six failures trigger cooldown; any attempt during cooldown triggers a permanent IP ban persisted to disk.

**Bidirectional security cooperation**: The `auth-guard` and `bot-detector` plugins cooperate: `bot-detector` calls `authGuard.banIp()` for high-confidence bots, while `auth-guard` records events to the same Valkey buffer that `bot-detector` flushes to PostgreSQL.

**Optional graceful degradation**: MaxMind GeoIP databases and the Stripe SDK key are optional. The system operates without them, logging warnings but not failing startup.

**Separated `buildApp` and `start`**: The `buildApp()` function is exported separately from the private `start()` function to support test harnesses that need a Fastify instance without binding a port.

**Migrations gated to development**: Database migrations auto-run only when `NODE_ENV === 'development'`. Production and staging require explicit migration execution as a separate deployment step.

**Token-gated downloads with instant revocation**: Download URLs use constant-time token comparison (`crypto.timingSafeEqual`) and check order status on every request, enabling instant revocation on chargeback or refund without invalidating any external cache.

## 11. Valkey Key Namespace Reference

| Prefix | TTL | Plugin/Route | Purpose |
|--------|-----|-------------|---------|
| `sess:*` | 24h | `session` | Server-side session data |
| `auth:fails:<ip>` | 900s | `auth-guard` | Failed login attempt counter per IP |
| `auth:cooldown:<ip>` | 1800s | `auth-guard` | Cooldown flag after max failures |
| `oauth:nonce:<nonce>` | 300s | `auth.ts` | OAuth CSRF nonce (GETDEL for one-time use) |
| `oauth:admin:rl:<ip>` | 900s | `auth.ts` | Admin OAuth rate limit counter |
| `sec:req:ip:<ip>` | 60s | `bot-detector` | Per-IP request counter |
| `sec:req:asn:<asn>` | 60s | `bot-detector` | Per-ASN request counter |
| `sec:seen_ips` | 60s | `bot-detector` | Set of unique IPs in last 60s |
| `sec:counter:req` | 60s | `bot-detector` | Global request counter |
| `sec:counter:429` | 60s | `bot-detector` | 429-response counter |
| `sec:honeypot:<ip>` | 86400s | `bot-detector` | Honeypot hit flag |
| `sec:checkout_fast:<ip>` | varies | `checkout.ts` | Fast-checkout anomaly flag |
| `sec:bot:score:<ip>` | 300s | `bot-detector` | Cached bot score |
| `sec:rdns:<ip>` | 300s | `bot-detector` | rDNS spoof check cache |
| `sec:iat:<ip>` | 60s | `bot-detector` | Inter-arrival time sliding window |
| `sec:events:buffer` | none | `auth-guard`, `bot-detector` | Pending security events for async DB flush |
| `sec:attacks:active` | 300s | `bot-detector` | Current attack severity level |
| `sec:attack:start` | 86400s | `bot-detector` | Attack start timestamp |
