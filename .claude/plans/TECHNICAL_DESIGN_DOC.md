# Digital Storefront — Technical Design Document

**Project:** Self-hosted Shopify-equivalent digital storefront
**Version:** 1.0
**Date:** February 28, 2026
**Status:** Pre-build — Spec Finalized

---

## 1. Executive Summary

A self-hosted, Docker-based digital product storefront architecturally equivalent to Shopify's merchant experience. Supports guest and authenticated checkout, Stripe + PayPal payments, secure tokenized digital file delivery, a full admin panel with real-time analytics, and industry-standard security practices. Digital products only — no physical shipping, tracking, or inventory management.

**Target deployment:** Hetzner VPS (Docker Compose)
**Development workflow:** Local Docker iteration → production deploy

### Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Checkout completion rate | ≥ 60% of carts that enter checkout | Analytics dashboard (Phase 6) |
| Storefront LCP (Largest Contentful Paint) | < 2.5s on 4G mobile | Lighthouse / Web Vitals |
| Time to first product (admin) | < 10 minutes from first login | Manual QA during Phase 2 |
| API p95 response time | < 200ms (non-file endpoints) | Load testing (Phase 6) |
| Uptime | ≥ 99.5% (monthly) | Health check monitoring |

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Storefront Frontend** | Next.js 14+ (React, TypeScript) | SSR/SSG customer-facing site |
| **Admin Frontend** | React SPA (Vite, TypeScript) | Separate admin panel |
| **API Server** | Node.js + Fastify (TypeScript) | REST API + WebSocket (analytics) |
| **Database** | PostgreSQL 16 | Primary data store |
| **Cache / Sessions** | Valkey 8 (Redis-compatible, BSD licensed) | Session store, rate limiting, real-time pub/sub |
| **File Storage** | MinIO | S3-compatible digital product file storage |
| **Email (Dev)** | Mailpit | Local email capture + web UI |
| **Email (Prod)** | Transactional email service (Postmark, Mailgun, or Amazon SES) | Managed SMTP with deliverability, SPF/DKIM/DMARC handled by provider |
| **Reverse Proxy** | Caddy | Auto-TLS, HTTPS enforcement, static file serving |
| **DB Access** | node-postgres (pg) | Parameterized queries, prepared statements, connection pooling via `pg.Pool` |
| **Migrations** | node-pg-migrate | Raw SQL migrations, run on API startup (dev) / manually (prod). Every migration must include a down migration. Irreversible migrations must be flagged with a `-- IRREVERSIBLE` comment and paired with a documented manual rollback plan in the migration file header. |
| **Testing** | Vitest + Supertest + Playwright | Unit/integration tests, API tests, E2E tests |
| **Orchestration** | Docker Compose | Local dev + production deployment |

**Language:** TypeScript across the entire stack (API, storefront, admin).

### Database Connection Pooling

The API uses `pg.Pool` (not individual `pg.Client` connections) for all database access:

| Setting | Value | Env Override |
|---------|-------|-------------|
| `max` (max connections) | 20 | `DATABASE_POOL_MAX` |
| `idleTimeoutMillis` | 30000 (30s) | `DATABASE_POOL_IDLE_TIMEOUT` |
| `connectionTimeoutMillis` | 5000 (5s) | `DATABASE_POOL_CONNECT_TIMEOUT` |

PostgreSQL's default `max_connections = 100`. With pool max of 20, this allows headroom for migrations, ad-hoc queries, and future horizontal scaling. Adjust via env vars without code changes.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Caddy                            │
│              (Reverse Proxy / TLS / HSTS)               │
├────────────┬──────────────────┬──────────────────────────┤
│            │                  │                          │
│   Next.js  │   React Admin    │   Fastify API            │
│ Storefront │   SPA (Vite)     │   (:3001)                │
│  (:3000)   │   (:3002)        │   ├── REST endpoints     │
│            │                  │   ├── WebSocket (analytics│
│            │                  │   ├── Stripe webhooks     │
│            │                  │   └── PayPal webhooks     │
└────────────┴──────────────────┴──────────┬───────────────┘
                                           │
                    ┌──────────────────────┼──────────────────┐
                    │                      │                  │
              ┌─────┴─────┐         ┌──────┴─────┐    ┌──────┴──────┐
              │ PostgreSQL │         │  Valkey    │    │   MinIO     │
              │  (:5432)   │         │  (:6379)   │    │  (:9000)    │
              │            │         │            │    │             │
              │ - Users    │         │ - Sessions │    │ - Product   │
              │ - Products │         │ - Rate     │    │   files     │
              │ - Orders   │         │   limits   │    │ - Thumbnails│
              │ - Payments │         │ - Pub/Sub  │    │             │
              │ - Audit log│         │   (WS)     │    │             │
              └────────────┘         └────────────┘    └─────────────┘
                                           │
                                    ┌──────┴──────┐
                                    │  Mailpit    │
                                    │  (dev only) │
                                    │  (:8025 UI) │
                                    └─────────────┘
```

### Docker Services (docker-compose.yml)

**Image serving:** Caddy proxies `/images/*` requests directly to MinIO's `product-images` bucket (public-read). Product images use stable relative paths (`/images/products/{uuid}.jpg`), not presigned URLs. Digital product files remain private and use the tokenized download system (Section 7).

**SSR data fetching:** Next.js storefront uses internal Docker URL (`http://api:3001`) for server-side rendering calls via `API_INTERNAL_URL` env var. Client-side browser calls use the public `API_URL` through Caddy.

1. `caddy` — reverse proxy, TLS termination, image proxy
2. `api` — Fastify API server
3. `storefront` — Next.js SSR server
4. `admin` — Vite React SPA (dev: Vite dev server on :3002; prod: static build served by Caddy)
5. `postgres` — PostgreSQL 16
6. `valkey` — Valkey 8
7. `minio` — MinIO object storage
8. `mailpit` — Email capture (dev profile only)

**Production resource limits and restart policies (`docker-compose.prod.yml`):**

All services must include `restart: unless-stopped` in production. Memory limits prevent a single runaway service from OOM-killing the host:

| Service | `mem_limit` | `memswap_limit` | Notes |
|---------|-------------|-----------------|-------|
| `caddy` | 128m | 128m | Reverse proxy, minimal memory |
| `api` | 512m | 512m | Node.js API; increase if large file streaming causes pressure |
| `storefront` | 512m | 512m | Next.js SSR |
| `postgres` | 1g | 1g | Adjust `shared_buffers` to ~25% of this limit |
| `valkey` | 256m | 256m | Configure `maxmemory 200mb` with `allkeys-lru` eviction |
| `minio` | 1g | 1g | Handles large file uploads/downloads |

`memswap_limit` is set equal to `mem_limit` to disable swap (prevents silent performance degradation). These values assume a Hetzner VPS with 4-8GB RAM. Scale up limits proportionally if running on a larger instance.

**Dev vs Prod compose split:**
- `docker-compose.yml` — development. Admin runs as Vite dev server with HMR on `:3002`. Caddy proxies `/admin/*` to the Vite service. Includes `mailpit`.
- `docker-compose.prod.yml` — production. Admin is built at image build time (`vite build`). Caddy serves admin static files from a shared volume (`/srv/admin/`). No Vite service runs. No email service container — production email sent via external transactional email provider (Postmark, Mailgun, or Amazon SES) configured through SMTP env vars.
- The Caddyfile uses environment variable substitution (`{$ADMIN_BACKEND:admin:3002}`) to switch between proxy (dev) and file server (prod) for the admin route.

### Graceful Shutdown

The API server implements graceful shutdown to avoid dropping in-flight requests during deploys:

1. `SIGTERM` received → Fastify's `onClose` hook fires
2. Stop accepting new connections
3. Wait for in-flight requests to complete (up to `stop_grace_period`)
4. Close Valkey pub/sub subscriptions and client connections
5. Drain `pg.Pool` (calls `pool.end()`)
6. Exit process

Docker compose setting: `stop_grace_period: 30s` on the `api` service. This is especially important for long-running file download streams and webhook processing. Stripe and PayPal both retry failed webhook deliveries, so a dropped webhook during restart is recoverable.

### Scaling Considerations (v1 → future)

v1 is a single API instance. The following design decisions are coupled to single-instance and must be revisited when scaling horizontally:

| Component | v1 (single instance) | Multi-instance change required |
|-----------|---------------------|-------------------------------|
| Cart expiry cleanup | In-process `setInterval` | Replace with PostgreSQL `pg_cron` or a dedicated cron container to avoid duplicate runs |
| WebSocket (analytics) | Valkey pub/sub → single API process fans out to connected admins | Add sticky sessions (Caddy `lb_policy cookie`) or use a shared WebSocket adapter (e.g., `@fastify/websocket` with Valkey pub/sub relay) |
| Advisory locks | `pg_advisory_xact_lock` on shared PostgreSQL | Works across instances — no change needed (all instances share the same PostgreSQL) |
| Session store | Valkey — stateless API reads session by cookie | Works across instances — no change needed |
| File downloads | Streamed through API process | Works across instances — no sticky sessions needed (each request is independent) |

No code changes are required for v1. This section exists solely to document what to revisit when adding a second API instance behind a load balancer.

### Caching Strategy

To meet the LCP < 2.5s target and reduce database load from read-heavy storefront pages:

| Layer | Mechanism | Scope | TTL | Invalidation |
|-------|-----------|-------|-----|-------------|
| **API response cache** | Valkey | Product listings, product detail, collection pages, static pages, **layout endpoint** | 60s | On admin mutation: publish invalidation event via Valkey pub/sub; cache keys include entity type + ID. Layout cache (`cache:v1:layout:default`) invalidated on changes to `store_settings`, `pages`, or `collections`. |
| **Next.js ISR** | Incremental Static Regeneration | Product pages, collection pages, homepage | `revalidate: 60` | On-demand revalidation via `res.revalidate()` called from admin mutation handler. **Required** for product status transitions (active→archived, active→draft), collection publish/unpublish, and product deletion. Falls back to TTL for non-critical updates (price changes, description edits). The admin API mutation handler calls a Next.js revalidation API route after committing the database change. |
| **Static assets** | Caddy `Cache-Control` header | JS/CSS bundles, fonts, images | `public, max-age=31536000, immutable` (hashed filenames) | Hash changes on deploy |
| **Session/auth pages** | No cache | Cart, checkout, account pages | N/A | Always SSR with fresh data |

**API cache key format:** `cache:v1:{entity}:{identifier}:{query_hash}` (e.g., `cache:v1:products:list:abc123`)
**Cache-aside pattern:** Check Valkey first → on miss, query PostgreSQL → store result in Valkey with TTL.

### Next.js Rendering Strategy

| Page | Rendering | Rationale |
|------|-----------|-----------|
| Homepage | ISR (`revalidate: 60`) | Featured products/collections change infrequently |
| Product listing (PLP) | ISR (`revalidate: 60`) | Catalog changes only on admin updates |
| Product detail (PDP) | ISR (`revalidate: 60`) | Product data rarely changes; reviews fetched client-side |
| Collection pages | ISR (`revalidate: 60`) | Collection membership changes only on admin updates |
| Static pages (About, FAQ, etc.) | SSG (build time) | Content changes very rarely |
| Search | SSR | Dynamic query results, must be fresh |
| Cart | SSR | Session-specific, real-time pricing |
| Checkout | SSR | Session-specific, payment state |
| Account pages | SSR | Authenticated, user-specific data |
| Download page | SSR | Token validation must be real-time |

### Cart Expiry Cleanup

Stale carts (past `expires_at`) are cleaned up by a scheduled task:

- **Mechanism:** The API registers a `setInterval` job that runs once daily (on startup + every 24h)
- **Query:** `DELETE FROM carts WHERE expires_at < now() AND id NOT IN (SELECT cart_id FROM orders WHERE status = 'pending' AND cart_id IS NOT NULL)`; cascades to `cart_items` via `ON DELETE CASCADE`. The subquery exclusion preserves carts that have pending orders (active checkout in progress), preventing the idempotency guard in `POST /checkout/stripe` from breaking.
- **Alternative (production):** If the API runs multiple instances in the future, use PostgreSQL `pg_cron` extension instead to avoid duplicate runs. For single-instance v1, the in-process timer is sufficient.
- **Logging:** Each cleanup run logs the number of deleted carts to the application log

---

### Storefront Shared Layout (DRY)

All public-facing storefront pages share a single layout shell rendered by `layout.tsx` (Next.js App Router root layout). This ensures header, footer, and branding are defined once and applied everywhere — changes propagate instantly to all pages.

**Architecture:**

```
layout.tsx (root layout — fetches GET /api/v1/store/layout once per request)
├── <Header />
│   ├── Store logo + name (from store_settings.general)
│   ├── Navigation links (from store_settings.navigation.header — resolved by API)
│   ├── Search bar
│   ├── Cart icon with item count badge
│   └── Account / Login link
├── <main>{children}</main>    ← page-specific content injected here
└── <Footer />
    ├── Footer column groups (from store_settings.navigation.footer — resolved by API)
    │   ├── "Shop" column → product/collection links
    │   ├── "Legal" column → Privacy, Terms, Refund (resolved from pages table)
    │   └── "Support" column → FAQ, Contact (resolved from pages table)
    ├── Store contact email (from store_settings.general.contactEmail)
    ├── Social links (from store_settings.general, if configured)
    └── © {year} {storeName}
```

**How it works:**

1. `layout.tsx` calls `GET /api/v1/store/layout` server-side (via `API_INTERNAL_URL`). This single endpoint returns:
   - **Branding:** storeName, logo URL, favicon, primaryColor, accentColor
   - **Header nav:** resolved array of `{ label, href }` — the API reads `store_settings.navigation.header`, resolves each item's slug to a URL (`type='page'` → looks up `pages` table, `type='collection'` → looks up `collections` table), and omits items whose referenced page/collection is unpublished or deleted.
   - **Footer nav:** resolved array of `{ title, items: [{ label, href }] }` — same resolution logic.
   - **Cart item count:** for the current session (used by the header cart badge).

2. The response is cached in Valkey (60s TTL, cache key `cache:v1:layout:default`). Invalidated on admin mutation to `store_settings`, `pages`, or `collections` (via existing Valkey pub/sub invalidation).

3. `<Header>` and `<Footer>` are React components in `components/layout/` that receive the resolved data as props — they contain **zero hardcoded links**. All navigation is data-driven from the admin-configured menus.

4. Because `layout.tsx` is the Next.js root layout, every route (`/products`, `/collections/...`, `/cart`, `/checkout`, `/account/...`, `/about`, etc.) automatically inherits the same header and footer. Adding a new page to the `pages` table and linking it in the admin navigation menu makes it appear in the footer/header across the entire site — no code changes.

**DRY guarantees:**
- **Header/footer changed once → updates everywhere.** Admin edits `store_settings.navigation` → all pages show the new nav on next render (within 60s cache TTL or on-demand invalidation).
- **Page rename/slug change → nav auto-updates.** Navigation items reference pages by slug via `type='page'`. The API resolves the current slug at render time, so renaming a page in the admin updates all navigation links automatically.
- **Dead link prevention.** Unpublished or deleted pages/collections are omitted from resolved navigation. No 404 links in the header or footer.
- **Branding changed once → updates everywhere.** Logo, store name, colors flow from `store_settings.general` + `store_settings.appearance` through the same layout endpoint.

**Admin panel layout (separate):** The admin SPA has its own `<AdminLayout>` component in `admin/src/components/layout/` with sidebar navigation. This is independent of the storefront layout and is not admin-configurable (it's a fixed developer-defined structure matching the admin API routes).

---

## 4. Database Schema

### 4.1 Core Tables

#### `admins`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           VARCHAR(255) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL          -- bcrypt, cost ≥ 12
role            VARCHAR(50) NOT NULL DEFAULT 'staff'  -- 'owner', 'admin', 'staff', 'readonly'
totp_secret     VARCHAR(255)                   -- encrypted TOTP secret for 2FA
totp_enabled    BOOLEAN DEFAULT false
totp_recovery_codes TEXT                       -- encrypted JSON array of 10 single-use recovery codes (bcrypt hashed individually); generated during 2FA setup, each code usable once in place of a TOTP token
permissions     JSONB DEFAULT '{}'             -- granular per-module permissions
last_login_at   TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `customers`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           VARCHAR(255) UNIQUE NOT NULL
password_hash   VARCHAR(255)                   -- NULL for guest-only customers
first_name      VARCHAR(100)
last_name       VARCHAR(100)
billing_address JSONB                          -- { line1, line2, city, state, zip, country }
is_guest        BOOLEAN DEFAULT true           -- true until they set a password
is_blocked      BOOLEAN DEFAULT false
-- BLOCKED CUSTOMER ENFORCEMENT:
-- When is_blocked=true:
-- (a) Login is rejected with generic error ("Unable to log in. Please contact support.")
-- (b) Checkout creation (POST /checkout/stripe, POST /checkout/paypal) is rejected if customer_id matches a blocked customer
-- (c) All active Valkey sessions for the customer are invalidated immediately on block (admin handler iterates sessions by userId)
-- (d) Existing download links remain valid (product was paid for — revoking access requires a refund)
-- (e) Guest checkout with the blocked customer's email is still allowed (guest flow doesn't look up is_blocked for registered accounts per Section 4.1 guest behavior)
-- GUEST CHECKOUT BEHAVIOR:
-- 1. Look up existing customer by email.
-- 2. If found AND is_guest=true: reuse the existing guest record (same person buying again).
-- 3. If found AND is_guest=false (registered account): do NOT associate the order with
--    the registered customer. Instead, create the order with customer_id=NULL and store
--    only the email on the order. Do NOT reveal account existence to the guest — the
--    checkout flow must be identical regardless of whether the email has a registered
--    account. Instead, send a private email to the registered address: "Someone checked
--    out with your email as a guest. Log in to link this order to your account."
--    This prevents:
--    (a) unauthorized order injection into registered accounts,
--    (b) single_use_per_customer discount bypass via guest checkout,
--    (c) data pollution in the registered customer's order history,
--    (d) email enumeration (attacker probing which emails have accounts).
-- 4. If not found: create a new customer record with is_guest=true.
-- 5. On post-purchase account creation or login, merge the guest order into the account.
-- GUEST ORDER MERGE MECHANISM:
-- (a) Automatic merge (guest session → account creation): When a guest creates an account
--     during post-purchase signup, query: UPDATE orders SET customer_id = $new_customer_id
--     WHERE customer_id IS NULL AND email = $customer_email;
--     This links all previous guest orders by the same email to the new account.
-- (b) Registered-email guest order claim: When a guest checks out with a registered user's
--     email, the order has customer_id=NULL. The notification email sent to the registered
--     user includes a signed claim link:
--       /account/orders/:id/claim?token=<HMAC_token>&t=<issuedAt_unix>
--     HMAC construction: HMAC-SHA256(CLAIM_SECRET, "order-claim:" + orderId + ":" + customerEmail + ":" + issuedAt).
--     CLAIM_SECRET is a dedicated env var (not shared with SESSION_SECRET or CSRF_SECRET).
--     On click (must be logged in), the API:
--       (i)   recomputes HMAC with the logged-in user's email — email must match
--       (ii)  verifies the HMAC signature matches
--       (iii) rejects if issuedAt is older than 7 days
--       (iv)  sets customer_id on the order
--     This prevents unauthorized order linking and ensures claim links expire.
-- (c) Automatic merge on login: On each login, also run the query from (a) to pick up any
--     guest orders made with the account's email since last login.
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `products`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
title           VARCHAR(500) NOT NULL
slug            VARCHAR(500) UNIQUE NOT NULL
description     TEXT                           -- rich text / markdown
short_description VARCHAR(1000)
price           DECIMAL(10,2) NOT NULL         -- base price in USD
compare_at_price DECIMAL(10,2)                 -- "was $X" strike-through price
status          VARCHAR(20) DEFAULT 'draft'    -- 'draft', 'active', 'archived'
product_type    VARCHAR(100)                   -- e.g., 'ebook', 'software', 'template'
tags            TEXT[]                          -- PostgreSQL array for filtering
seo_title       VARCHAR(255)
seo_description VARCHAR(500)
featured        BOOLEAN DEFAULT false
sort_order      INTEGER DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `product_variants`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id      UUID REFERENCES products(id) ON DELETE CASCADE
title           VARCHAR(255) NOT NULL          -- e.g., "Personal License", "Commercial License"
sku             VARCHAR(100) UNIQUE
price           DECIMAL(10,2) NOT NULL
compare_at_price DECIMAL(10,2)
sort_order      INTEGER DEFAULT 0
is_default      BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `product_images`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id      UUID REFERENCES products(id) ON DELETE CASCADE
url             VARCHAR(1000) NOT NULL         -- relative path (e.g., /images/products/{uuid}.jpg); served via Caddy proxy to MinIO product-images bucket
alt_text        VARCHAR(500)
sort_order      INTEGER DEFAULT 0
is_primary      BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `product_files`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id      UUID REFERENCES products(id) ON DELETE CASCADE
variant_id      UUID REFERENCES product_variants(id) ON DELETE RESTRICT  -- must reassign files before deleting variant; NULL means file applies to ALL variants of the product (common for single-variant products)
filename        VARCHAR(500) NOT NULL          -- original filename shown to customer
-- VARIANT_ID NULL SEMANTICS:
-- When variant_id IS NULL, the file is delivered for ANY variant purchase of this product.
-- Download link generation query (Section 7.2 step 4) must use:
--   SELECT * FROM product_files WHERE product_id = $product_id AND (variant_id = $variant_id OR variant_id IS NULL)
-- This allows simple products (single variant) to have files without explicit variant assignment,
-- while multi-variant products can assign files per variant (e.g., "Personal License" vs "Commercial License" get different files).
storage_key     VARCHAR(1000) NOT NULL         -- MinIO object key (never exposed)
file_size       BIGINT NOT NULL                -- bytes
mime_type       VARCHAR(255)
max_downloads   INTEGER DEFAULT 5
download_expiry_hours INTEGER DEFAULT 168      -- 7 days = 168 hours
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `carts`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL  -- NULL for guest carts
session_id_hash VARCHAR(64) NOT NULL             -- SHA-256 hash of Valkey session ID (never store raw session tokens in DB)
email           VARCHAR(255)                     -- captured at checkout start
discount_code   VARCHAR(100)
discount_id     UUID REFERENCES discounts(id) ON DELETE SET NULL
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
expires_at      TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days'  -- auto-cleanup stale carts
-- CART TRANSFER ON LOGIN: When a guest logs in, the auth handler must:
-- 1. Check if the authenticated customer already has an existing cart (SELECT WHERE customer_id = $auth_user_id).
-- 2. If YES (customer has existing cart):
--    (a) Merge items from the guest cart into the existing cart:
--        INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
--        SELECT $existing_cart_id, product_id, variant_id, quantity FROM cart_items WHERE cart_id = $guest_cart_id
--        ON CONFLICT (cart_id, product_id, variant_id) DO UPDATE SET quantity = GREATEST(cart_items.quantity, EXCLUDED.quantity);
--    (b) Copy discount_code/discount_id from guest cart to existing cart if existing cart has none.
--    (c) Delete the guest cart (CASCADE deletes its cart_items).
--    (d) Update session_id_hash on the existing cart to SHA-256(new_session_id).
-- 3. If NO (no existing cart): update the guest cart record: set customer_id to the
--    authenticated user's ID and update session_id_hash to SHA-256(new_session_id).
-- This prevents both cart loss on session rotation and cart duplication on login.
```

#### `cart_items`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
cart_id          UUID REFERENCES carts(id) ON DELETE CASCADE
product_id      UUID REFERENCES products(id) ON DELETE CASCADE
variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE
quantity        INTEGER DEFAULT 1 CHECK (quantity >= 1)
added_at        TIMESTAMPTZ DEFAULT now()
UNIQUE (cart_id, product_id, variant_id)          -- prevent duplicate line items
```

#### `collections`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
title           VARCHAR(500) NOT NULL
slug            VARCHAR(500) UNIQUE NOT NULL
description     TEXT
image_url       VARCHAR(1000)
type            VARCHAR(20) DEFAULT 'manual'   -- 'manual' only in v1; 'rule' deferred to post-v1
rules           JSONB                          -- reserved for future rule-based collections (post-v1)
seo_title       VARCHAR(255)
seo_description VARCHAR(500)
sort_order      INTEGER DEFAULT 0
published       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `collection_products`
```sql
collection_id   UUID REFERENCES collections(id) ON DELETE CASCADE
product_id      UUID REFERENCES products(id) ON DELETE CASCADE
sort_order      INTEGER DEFAULT 0
PRIMARY KEY (collection_id, product_id)
```

### 4.1.1 Tax Handling (v1)

Tax calculation is **deferred to post-v1**. For v1, `orders.tax_amount` is always `0.00` and the checkout flow does not display a tax line item. Rationale: US sales tax on digital goods varies by state and requires either a third-party tax service (TaxJar, Avalara) or a manually maintained rate table. Adding tax calculation before the core checkout flow is validated adds significant complexity without user value for initial testing.

**Post-v1 integration path:** Add a `tax` key to `store_settings` with `{ provider: 'manual' | 'taxjar' | 'avalara', rates: [...], apiKey: '...' }`. The checkout flow will call a `tax.service.ts` to compute tax after cart totals are finalized. The `tax_amount` field on `orders` is already present and will be populated when this feature is implemented.

### 4.2 Orders & Payments

#### `orders`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_number    INTEGER GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE  -- human-readable #1001, #1002...
customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL  -- SET NULL for GDPR deletion; order preserved for accounting, email stored separately
cart_id         UUID REFERENCES carts(id) ON DELETE SET NULL  -- links order to originating cart (idempotency guard + status polling)
email           VARCHAR(255) NOT NULL          -- stored separately for guest orders
status          VARCHAR(30) DEFAULT 'pending'  -- 'pending', 'paid', 'paid_held', 'refunded', 'partially_refunded', 'failed'
-- 'paid_held': payment succeeded but customer was blocked at time of webhook processing.
-- Download links NOT generated. Admin must review and either refund or release (transition to 'paid' + generate download links).
subtotal        DECIMAL(10,2) NOT NULL
discount_amount DECIMAL(10,2) DEFAULT 0
tax_amount      DECIMAL(10,2) DEFAULT 0
total           DECIMAL(10,2) NOT NULL
currency        VARCHAR(3) DEFAULT 'USD'
payment_method  VARCHAR(20)                    -- 'stripe', 'paypal'
stripe_payment_intent_id VARCHAR(255)
paypal_order_id VARCHAR(255)
billing_address JSONB
discount_code   VARCHAR(100)
discount_id     UUID REFERENCES discounts(id) ON DELETE SET NULL  -- preserves order if discount deleted
internal_notes  TEXT                           -- admin-only notes
ip_address      INET
user_agent      TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `order_items`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id        UUID REFERENCES orders(id) ON DELETE CASCADE
product_id      UUID REFERENCES products(id) ON DELETE SET NULL  -- SET NULL: product row may be hard-deleted in future; order_items preserve snapshot data (product_title, price)
variant_id      UUID REFERENCES product_variants(id) ON DELETE SET NULL  -- SET NULL: variant may be deleted after file reassignment; order_items preserve snapshot data (variant_title, price)
product_title   VARCHAR(500) NOT NULL          -- snapshot at time of purchase
variant_title   VARCHAR(255)
price           DECIMAL(10,2) NOT NULL         -- price at time of purchase
quantity        INTEGER DEFAULT 1
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `download_links`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id        UUID REFERENCES orders(id) ON DELETE CASCADE
order_item_id   UUID REFERENCES order_items(id) ON DELETE CASCADE
product_file_id UUID REFERENCES product_files(id) ON DELETE SET NULL  -- SET NULL if product file is replaced/deleted; download page shows "This file has been updated — contact support or check your order page for a new download link"
token           VARCHAR(255) UNIQUE NOT NULL   -- secure random token for URL
download_count  INTEGER DEFAULT 0
max_downloads   INTEGER NOT NULL DEFAULT 5
expires_at      TIMESTAMPTZ NOT NULL
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `download_log`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
download_link_id UUID REFERENCES download_links(id)
ip_address      INET
user_agent      TEXT
downloaded_at   TIMESTAMPTZ DEFAULT now()
```

#### `refunds`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id        UUID REFERENCES orders(id) ON DELETE CASCADE
admin_id        UUID REFERENCES admins(id) ON DELETE SET NULL  -- SET NULL preserves refund record on admin removal
amount          DECIMAL(10,2) NOT NULL
reason          TEXT
stripe_refund_id VARCHAR(255)
paypal_refund_id VARCHAR(255)
status          VARCHAR(20) DEFAULT 'pending'  -- 'pending', 'completed', 'failed'
-- REFUND → DOWNLOAD LINK DEACTIVATION:
-- On full refund: UPDATE download_links SET is_active = false WHERE order_id = $1;
-- On partial refund: UPDATE download_links SET is_active = false WHERE order_item_id = ANY($refunded_item_ids);
-- This prevents customers from retaining access to digital products after refund.
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `refund_items`
```sql
refund_id       UUID REFERENCES refunds(id) ON DELETE CASCADE
order_item_id   UUID REFERENCES order_items(id) ON DELETE CASCADE
amount          DECIMAL(10,2) NOT NULL         -- refund amount for this line item
PRIMARY KEY (refund_id, order_item_id)
-- Used to track which order_items were refunded in a partial refund.
-- The $refunded_item_ids for download link deactivation (Section 7.4) is derived from:
--   SELECT order_item_id FROM refund_items WHERE refund_id = $1
-- For full refunds, all order_items are inserted into refund_items.
```

### 4.3 Discounts & Gift Cards

#### `discounts`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
code            VARCHAR(100) UNIQUE            -- NULL for automatic discounts
title           VARCHAR(255) NOT NULL
type            VARCHAR(20) NOT NULL           -- 'percentage', 'fixed_amount' (v1); 'free_product' deferred to post-v1 (requires rules for which product becomes free, $0-order handling, and stacking logic)
value           DECIMAL(10,2) NOT NULL         -- percentage value (e.g., 10.00 = 10%) or fixed dollar amount
is_automatic    BOOLEAN DEFAULT false
-- AUTOMATIC DISCOUNT EVALUATION (is_automatic=true, code IS NULL):
-- Automatic discounts are evaluated on every cart total calculation (cart view, checkout start).
-- The API queries all active automatic discounts, checks eligibility (date range, minimum_purchase,
-- product applicability via discount_products), and applies the single best one (highest value).
-- Automatic discounts do NOT stack with code-based discounts — a code-based discount replaces
-- any automatic discount. Display to customer: "Automatic discount applied: {title} (-${amount})"
-- on the cart page. If the customer enters a code that provides less value, warn them.
minimum_purchase DECIMAL(10,2)                 -- minimum cart value to apply
max_uses        INTEGER                        -- NULL = unlimited
current_uses    INTEGER DEFAULT 0
-- ATOMIC INCREMENT: To prevent concurrent overuse, apply discounts with:
-- UPDATE discounts SET current_uses = current_uses + 1
--   WHERE id = $1 AND (max_uses IS NULL OR current_uses < max_uses)
--   RETURNING id;
-- If no row returned, the discount is exhausted. Single atomic statement, no explicit lock needed.
-- TRANSACTIONAL REQUIREMENT: When single_use_per_customer is true, BOTH the
-- discount_customer_uses INSERT and the current_uses UPDATE MUST execute within the
-- same database transaction:
--   BEGIN;
--   INSERT INTO discount_customer_uses (...) ON CONFLICT (discount_id, email_hash) DO NOTHING;
--   -- If 0 rows affected → discount already used by this email → ROLLBACK;
--   UPDATE discounts SET current_uses = current_uses + 1
--     WHERE id = $1 AND (max_uses IS NULL OR current_uses < max_uses) RETURNING id;
--   -- If 0 rows returned → discount exhausted → ROLLBACK;
--   COMMIT;
single_use_per_customer BOOLEAN DEFAULT false
starts_at       TIMESTAMPTZ DEFAULT now()
ends_at         TIMESTAMPTZ
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `discount_products`
```sql
discount_id     UUID REFERENCES discounts(id) ON DELETE CASCADE
product_id      UUID REFERENCES products(id) ON DELETE CASCADE
PRIMARY KEY (discount_id, product_id)
-- If no rows exist for a discount, the discount applies to all products.
-- FK constraints ensure stale product references are automatically cleaned up.
```

#### `discount_customer_uses`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
discount_id     UUID REFERENCES discounts(id) ON DELETE CASCADE
customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL  -- NULL for guest checkouts; SET NULL (not CASCADE) preserves the email_hash row on GDPR deletion so single-use discounts cannot be reused
email_hash      VARCHAR(64) NOT NULL           -- SHA-256 of lowercase email; always populated (guests + registered)
order_id        UUID REFERENCES orders(id) ON DELETE SET NULL
used_at         TIMESTAMPTZ DEFAULT now()
UNIQUE (discount_id, email_hash)               -- single enforcement key for both guests and registered users
-- Enforcement: INSERT with ON CONFLICT (discount_id, email_hash) DO NOTHING, then check affected rows.
-- If 0 rows inserted, the discount was already used by this email. Single atomic statement.
-- customer_id is optional metadata for admin lookups / order history display.
```

#### `gift_cards` (Post-v1)
```sql
-- DEFERRED TO POST-V1: Gift card schema, admin endpoints, and checkout integration are all
-- deferred to post-v1. The schema is defined here for reference only — do NOT create this
-- table in v1 migrations. Implementation requires: storefront redemption endpoint (POST /cart/gift-card),
-- gift_card_id + gift_card_amount_applied columns on orders, balance handling in checkout flows,
-- and refund-to-gift-card logic.
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
code            VARCHAR(100) UNIQUE NOT NULL   -- format: XXXX-XXXX-XXXX-XXXX (16 alphanumeric chars in 4 groups, generated via crypto.randomBytes(8).toString('hex'), case-insensitive lookup via LOWER())
initial_balance DECIMAL(10,2) NOT NULL
current_balance DECIMAL(10,2) NOT NULL
currency        VARCHAR(3) DEFAULT 'USD'
issued_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL
redeemed_by_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL
is_active       BOOLEAN DEFAULT true
expires_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### 4.4 Reviews

#### `reviews`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id      UUID REFERENCES products(id) ON DELETE CASCADE
customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL  -- SET NULL for GDPR deletion; review preserved, anonymized
order_id        UUID REFERENCES orders(id) ON DELETE SET NULL  -- must have purchased to review; SET NULL if order removed
rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5)
title           VARCHAR(255)
body            TEXT
status          VARCHAR(20) DEFAULT 'pending'  -- 'pending', 'approved', 'rejected'
admin_response  TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### 4.5 Security & Audit

#### `audit_log`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
admin_id        UUID REFERENCES admins(id) ON DELETE SET NULL  -- SET NULL preserves audit trail on admin removal; all other fields (action, entity, details) retained
action          VARCHAR(100) NOT NULL          -- e.g., 'product.created', 'order.refunded'
entity_type     VARCHAR(50)                    -- 'product', 'order', 'customer', 'discount'
entity_id       UUID
details         JSONB                          -- before/after snapshot
ip_address      INET
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `sessions`
```sql
-- Managed in Valkey, schema for reference:
-- key:   session:{sessionId}
-- value: { userId, userType, ip, userAgent, createdAt, expiresAt }
-- TTL:   24 hours (customer), 8 hours (admin)
```

#### `rate_limit_events`
```sql
-- Managed in Valkey, schema for reference:
-- key:   ratelimit:{endpoint}:{ip}
-- value: count
-- TTL:   sliding window (e.g., 60 seconds)
```

#### `password_reset_tokens`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_type       VARCHAR(10) NOT NULL DEFAULT 'customer'  -- 'customer' or 'admin'
customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE  -- populated when user_type='customer'
admin_id        UUID REFERENCES admins(id) ON DELETE CASCADE     -- populated when user_type='admin'
token_hash      VARCHAR(64) NOT NULL           -- SHA-256 hash of the raw token (raw token sent in email, never stored)
expires_at      TIMESTAMPTZ NOT NULL           -- 1 hour from generation
created_at      TIMESTAMPTZ DEFAULT now()
CHECK ((user_type = 'customer' AND customer_id IS NOT NULL AND admin_id IS NULL) OR
       (user_type = 'admin' AND admin_id IS NOT NULL AND customer_id IS NULL))
-- Single-use: DELETE this row after successful password reset.
-- Invalidation: DELETE WHERE customer_id/admin_id = $1 on successful login, new reset request, or password change.
-- Rate limit: 3 requests / hour per email (enforced at API layer, see Section 6.2).
-- Admin password reset: triggered by owner via POST /api/v1/admin/admins/:id/reset-password.
--   Owner can also reset their own password via the create-admin CLI script (server access required).
```

### 4.6 Static Pages & SEO

#### `pages`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
title           VARCHAR(500) NOT NULL
slug            VARCHAR(500) UNIQUE NOT NULL
-- RESERVED SLUG VALIDATION: The admin API (POST /pages, PUT /pages/:id) must reject
-- slugs that match reserved storefront route prefixes. Blocked slugs:
--   'products', 'collections', 'cart', 'checkout', 'account', 'auth',
--   'search', 'download', 'api', 'admin', 'sitemap.xml', 'robots.txt'
-- Validation is case-insensitive. Return 400: "This slug is reserved and cannot be used."
-- This prevents a static page from shadowing a built-in Next.js route via the
-- catch-all [slug]/page.tsx route at the app root.
content         TEXT                           -- rich text / markdown
seo_title       VARCHAR(255)
seo_description VARCHAR(500)
published       BOOLEAN DEFAULT true
sort_order      INTEGER DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `store_settings`
```sql
key             VARCHAR(100) PRIMARY KEY
value           JSONB NOT NULL
updated_at      TIMESTAMPTZ DEFAULT now()
-- Keys include:
-- 'general'     → { storeName, storeUrl, logo, favicon, contactEmail }
-- 'checkout'    → { guestCheckoutEnabled, termsRequired }
-- 'email'       → { fromName, fromEmail, templates: {...} }
--   NOTE: SMTP connection details (host, port, username, password) are infrastructure config
--   and live ONLY in env vars (Section 13). store_settings 'email' controls sender display
--   (fromName, fromEmail) and template customization — business config editable by admins.
--   fromName/fromEmail in store_settings OVERRIDE the SMTP_FROM_NAME/SMTP_FROM_EMAIL env vars
--   (env vars serve as defaults until admin configures them in the UI).
-- 'payments'    → { stripeEnabled, paypalEnabled }
-- 'seo'         → { defaultTitle, defaultDescription, robotsTxt }
-- 'appearance'  → { primaryColor, accentColor, heroImage, trustBadges }
-- 'navigation'  → { header: { items: [...] }, footer: { columns: [...] } }
-- VALIDATION: Each settings key has a corresponding JSON Schema definition in the API
-- (e.g., schemas/settings-general.schema.ts, schemas/settings-navigation.schema.ts).
-- The PUT /settings/:key endpoint validates the submitted JSONB against the schema before
-- saving. Reject with 400 + specific validation errors on mismatch. This prevents malformed
-- settings from breaking the storefront layout endpoint for all visitors.
--   Navigation menu structure — admin-configurable, rendered by the storefront shared layout.
--   Item schema: { label: string, type: 'page' | 'collection' | 'route' | 'external',
--                   slug?: string, url?: string }
--     type='page'       → links to /pages/:slug; slug field references pages.slug
--     type='collection' → links to /collections/:slug; slug field references collections.slug
--     type='route'      → links to a fixed storefront route (url field: '/products', '/cart', etc.)
--     type='external'   → arbitrary URL (url field: 'https://...')
--   For 'page' and 'collection' types, the storefront resolves the URL from the slug at render
--   time. If the referenced page/collection is unpublished or deleted, the link is omitted from
--   rendering (no dead links). This means renaming a page slug auto-updates navigation — DRY.
--   Footer columns: { title: string, items: [...] } — supports multiple grouped link columns
--     (e.g., "Shop", "Support", "Legal").
--   Default seed (created by seed script):
--     header: [
--       { label: "Shop", type: "route", url: "/products" },
--       { label: "Collections", type: "route", url: "/collections" }
--     ]
--     footer: [
--       { title: "Shop", items: [
--           { label: "All Products", type: "route", url: "/products" },
--           { label: "Collections", type: "route", url: "/collections" }
--       ]},
--       { title: "Legal", items: [
--           { label: "Privacy Policy", type: "page", slug: "privacy" },
--           { label: "Terms of Service", type: "page", slug: "terms" },
--           { label: "Refund Policy", type: "page", slug: "refund" }
--       ]},
--       { title: "Support", items: [
--           { label: "FAQ", type: "page", slug: "faq" },
--           { label: "Contact", type: "page", slug: "contact" }
--       ]}
--     ]
```

### 4.7 Indexes

Beyond primary keys and unique constraints, the following indexes are required for query performance:

```sql
-- Orders (webhook lookup, customer history, filtering)
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_orders_paypal_order_id ON orders(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Order items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Products (storefront listing, admin filtering)
CREATE INDEX idx_products_status_sort ON products(status, sort_order);

-- Carts (session lookup)
CREATE INDEX idx_carts_session_id_hash ON carts(session_id_hash);
CREATE INDEX idx_carts_expires_at ON carts(expires_at);

-- Download links (order lookup, token already UNIQUE)
CREATE INDEX idx_download_links_order_id ON download_links(order_id);

-- Audit log (admin viewer, entity lookup)
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Reviews (product page display)
CREATE INDEX idx_reviews_product_status ON reviews(product_id, status);

-- Discount customer uses (checkout enforcement)
CREATE INDEX idx_discount_customer_uses_email ON discount_customer_uses(discount_id, email_hash) WHERE email_hash IS NOT NULL;

-- Password reset tokens (lookup by customer)
CREATE INDEX idx_password_reset_tokens_customer ON password_reset_tokens(customer_id);
```

---

## 5. API Design

### 5.1 Storefront API (Public)

All routes prefixed: `/api/v1/store`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/layout` | Shared layout data: resolved navigation menus (header + footer), store branding (name, logo, favicon, primaryColor), and announcement bar. Cached in Valkey (60s TTL). Fetched once by `layout.tsx` and passed to Header/Footer components — NOT fetched per page. |
| GET | `/products` | List products (paginated, filterable) |
| GET | `/products/:slug` | Product detail |
| GET | `/collections` | List collections |
| GET | `/collections/:slug` | Collection with products |
| GET | `/search?q=` | Search products (autocomplete) |
| GET | `/pages/:slug` | Static page content |
| POST | `/cart` | Create/get cart (session-based) |
| PUT | `/cart/items` | Add/update cart items |
| DELETE | `/cart/items/:id` | Remove cart item |
| POST | `/cart/discount` | Apply discount code |
| POST | `/checkout/stripe` | Create Stripe PaymentIntent |
| POST | `/checkout/paypal` | Create PayPal order |
| GET | `/checkout/confirm/:orderId` | Return order confirmation page (read-only — session-validated, works for guests). Uses GET because the endpoint is read-only; orderId in path, session validation via cookie. |
| GET | `/checkout/status/:orderId` | Poll order status (session-validated, works for guests) |
| GET | `/download/:token` | Download file via tokenized link |
| POST | `/auth/register` | Customer registration |
| POST | `/auth/login` | Customer login |
| POST | `/auth/logout` | Customer logout |
| POST | `/auth/forgot-password` | Password reset request |
| POST | `/auth/reset-password` | Password reset confirm |
| GET | `/account/orders` | Customer order history |
| GET | `/account/orders/:id` | Order detail + download links |
| PUT | `/account/profile` | Update profile |
| POST | `/account/export-data` | GDPR data export |
| DELETE | `/account/delete` | GDPR account deletion |
| POST | `/account/orders/:id/claim` | Claim guest order via signed HMAC link (authenticated, see Section 4.1 guest order claim) |
| POST | `/account/orders/:id/refund-request` | Submit refund request (authenticated — sends structured email to store admin with order number, selected items, reason; does NOT auto-process refund). Rate limited: 1 request per order per 24 hours. |
| POST | `/reviews` | Submit review (authenticated) |
| GET | `/products/:slug/reviews` | Product reviews |

### 5.2 Admin API (Authenticated)

All routes prefixed: `/api/v1/admin`
All require valid **fully authenticated** admin session (not `requires2FA: true`) + CSRF token. See Section 6.1 for 2FA session gating.
All mutations write to `audit_log`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Admin login |
| POST | `/auth/2fa/verify` | TOTP verification |
| POST | `/auth/2fa/setup` | Initialize 2FA enrollment |
| POST | `/auth/logout` | Admin logout |
| | | |
| GET | `/products` | List all products |
| POST | `/products` | Create product |
| PUT | `/products/:id` | Update product |
| DELETE | `/products/:id` | Archive product |
| POST | `/products/:id/images` | Upload product image |
| POST | `/products/:id/files` | Upload digital file (max 500MB) |
| | | |
| GET | `/variants/:productId` | List variants |
| POST | `/variants` | Create variant |
| PUT | `/variants/:id` | Update variant |
| PUT | `/variants/:id/files/:fileId/reassign` | Reassign file to different variant |
| DELETE | `/variants/:id` | Delete variant (returns 409 if files attached; list files to reassign) |
| | | |
| GET | `/collections` | List collections |
| POST | `/collections` | Create collection |
| PUT | `/collections/:id` | Update collection |
| DELETE | `/collections/:id` | Delete collection |
| | | |
| GET | `/orders` | List orders (paginated, filterable) |
| GET | `/orders/:id` | Order detail with download activity |
| PUT | `/orders/:id/notes` | Add internal note |
| POST | `/orders/:id/refund` | Issue refund (full or partial); deactivates download links for refunded items |
| | | |
| GET | `/customers` | Customer list |
| GET | `/customers/:id` | Customer detail + order history |
| PUT | `/customers/:id/block` | Block/unblock customer |
| POST | `/customers/:id/reset-password` | Force password reset |
| | | |
| GET | `/discounts` | List discounts |
| POST | `/discounts` | Create discount |
| PUT | `/discounts/:id` | Update discount |
| DELETE | `/discounts/:id` | Deactivate discount |
| | | |
| GET | `/gift-cards` | **(Post-v1)** List gift cards — do not implement in v1 (see Section 4.3) |
| POST | `/gift-cards` | **(Post-v1)** Generate gift card — do not implement in v1 (see Section 4.3) |
| PUT | `/gift-cards/:id` | **(Post-v1)** Update gift card — do not implement in v1 (see Section 4.3) |
| | | |
| GET | `/reviews` | List all reviews (filterable by status) |
| PUT | `/reviews/:id` | Approve/reject/respond to review |
| | | |
| GET | `/analytics/overview` | Revenue, orders, customers summary |
| GET | `/analytics/revenue` | Revenue by period |
| GET | `/analytics/products` | Top products by revenue/orders |
| GET | `/analytics/traffic` | Traffic sources, conversion funnel |
| WS | `/analytics/live` | WebSocket: real-time order + revenue feed |
| | | |
| GET | `/audit-log` | Paginated audit log |
| GET | `/settings` | Store settings (staff+) |
| PUT | `/settings/:key` | Update settings section (owner/admin only; `email` and `payments` keys require owner) |
| GET | `/finance/payouts` | Payout summaries |
| GET | `/finance/export` | Export CSV reports |
| | | |
| GET | `/pages` | List static pages |
| POST | `/pages` | Create page |
| PUT | `/pages/:id` | Update page |
| DELETE | `/pages/:id` | Delete page |
| | | |
| GET | `/admins` | List admin users (owner only) |
| POST | `/admins` | Create admin user (owner only) |
| PUT | `/admins/:id` | Update admin role/permissions (owner only, cannot modify own role) |
| POST | `/admins/:id/reset-password` | Force admin password reset — sends reset link to admin's email (owner only) |
| DELETE | `/admins/:id` | Remove admin user (owner only, cannot delete self) |

### 5.3 Webhooks (Inbound)

| Endpoint | Source | Purpose |
|----------|--------|---------|
| `/webhooks/stripe` | Stripe | Payment confirmation, disputes, refund status |
| `/webhooks/paypal` | PayPal | Payment capture, refund notifications |

Both endpoints verify webhook signatures before processing.

---

## 6. Security Implementation

### 6.1 Authentication & Sessions

- **Customer passwords:** bcrypt with cost factor 12
- **Admin passwords:** bcrypt with cost factor 12 + mandatory TOTP 2FA
- **Sessions:** Valkey-stored, referenced by HttpOnly + Secure + SameSite=Strict cookie
- **Session TTL:** 24h customer, 8h admin (configurable)
- **Session rotation:** New session ID issued on privilege escalation (login, 2FA verify). New session is created in Valkey first, then the old session key is DELeted. This order prevents a crash between operations from leaving the user with no valid session. Both operations should use Valkey MULTI/EXEC for atomicity where possible. The old session's brief overlap (milliseconds) is acceptable — it is immediately invalidated and cannot be reused due to the new cookie being set in the response.
- **TOTP recovery codes:** During 2FA setup (`POST /auth/2fa/setup`), the API generates 10 single-use recovery codes (8 hex characters, `crypto.randomBytes(4).toString('hex')`). Codes are displayed to the admin once and stored as individually bcrypt-hashed values in `totp_recovery_codes` (encrypted at rest). During TOTP verification, if the submitted code matches a recovery code (bcrypt compare), the code is consumed (removed from the array) and the verification succeeds. **Concurrency guard:** Recovery code consumption must use `SELECT ... FOR UPDATE` on the admin row before reading `totp_recovery_codes`, preventing two concurrent requests from both consuming the same code. The admin should be warned when fewer than 3 codes remain. Additionally, the owner role can disable 2FA for other admins via `PUT /admins/:id` (sets `totp_enabled = false`, clears `totp_secret` and `totp_recovery_codes`).
- **Admin 2FA session gating:** Admin login is a two-step process. After successful password auth (`POST /auth/login`), the session is created with a `{ requires2FA: true }` flag. All admin API middleware (Section 5.2) MUST reject sessions with `requires2FA: true` — only the following endpoints accept this session state:
  - `POST /auth/2fa/verify` — always allowed (submit TOTP code or recovery code)
  - `POST /auth/2fa/setup` — allowed ONLY when the admin's `totp_enabled` is `false` (first-time enrollment). If `totp_enabled` is already `true`, reject with 403 (prevents an attacker with stolen credentials from re-registering a new TOTP device to take over the account).
  - `POST /auth/logout` — always allowed (abandon the login attempt)
  After successful TOTP verification, the session is rotated and the new session has `requires2FA: false` (fully authenticated). This ensures an attacker with stolen credentials but no TOTP device cannot access any admin data or endpoints.

### 6.1.1 Role & Permission Matrix

| Capability | `readonly` | `staff` | `admin` | `owner` |
|------------|:----------:|:-------:|:-------:|:-------:|
| View products, orders, customers, analytics | Yes | Yes | Yes | Yes |
| Create/edit products, variants, collections | No | Yes | Yes | Yes |
| Manage orders (notes, refunds) | No | Yes | Yes | Yes |
| Manage discounts & gift cards | No | Yes | Yes | Yes |
| Manage reviews (approve/reject) | No | Yes | Yes | Yes |
| Create/edit static pages | No | Yes | Yes | Yes |
| Block/unblock customers | No | No | Yes | Yes |
| Force customer password reset | No | No | Yes | Yes |
| Edit store settings (general, appearance, SEO) | No | No | Yes | Yes |
| Edit store settings (email, payments) | No | No | No | Yes |
| Manage admin users (CRUD) | No | No | No | Yes |
| View audit log | No | Yes | Yes | Yes |
| Export finance data | No | No | Yes | Yes |

The `permissions JSONB` field on `admins` can override these defaults per-module. Format:
```json
{ "products": "write", "orders": "read", "settings": "none" }
```
Values: `"read"` (view only), `"write"` (create/edit/delete), `"none"` (no access). If a key is absent, the role default applies. Role-level restrictions on sensitive operations (admin CRUD, payment/email settings) cannot be overridden by JSONB — those are hardcoded to `owner` only.

### 6.2 API Security

- **CSRF:** Double-submit cookie pattern on all state-changing endpoints **except webhook ingress routes** (`/webhooks/*`), which authenticate via provider signature verification instead (Section 5.3). CSRF token is `HMAC(CSRF_SECRET, sessionId)` — binding to the session prevents token injection via subdomain cookie attacks. Token regenerated on session rotation.
- **Rate limiting (Valkey-backed):**
  - Login: 5 attempts / 15 min per IP AND 10 attempts / hour per email (dual layer defends against distributed credential stuffing)
  - Login: after 20 cumulative failed attempts on a single email (any IP), trigger a 30-minute lockout. On lockout, send an email to the account holder: "Multiple failed login attempts detected on your account. Your account has been temporarily locked for 30 minutes. If this wasn't you, reset your password immediately." Lockout is enforced in Valkey: `SET lockout:{email_hash} EX 1800`. Login handler checks for lockout key before password verification. CAPTCHA integration deferred to post-v1.
  - Admin login: TOTP 2FA is the primary defense; per-IP limit still applies
  - TOTP verification (`POST /auth/2fa/verify`): 5 attempts / 15 min per session. After 10 cumulative failed attempts on the same session, invalidate the session entirely (delete from Valkey) and force full re-authentication from the password step. This prevents brute-forcing the 6-digit TOTP code.
  - Checkout: 10 attempts / 15 min per IP
  - API general: 100 requests / min per IP
  - Password reset: 3 requests / hour per email
- **Input validation:** Fastify JSON Schema validation on all endpoints (request + response)
- **SQL injection:** Parameterized queries only (via node-postgres with prepared statements)
- **XSS:** Output encoding via React (auto-escaped), CSP headers restrict inline scripts
- **File upload:** 500MB max, files stored in MinIO (never in webroot). Validation:
  - **Product images:** Validate magic bytes (file signature) against allowed types (JPEG, PNG, WebP, GIF) using a library like `file-type`. Reject if magic bytes don't match declared MIME type.
  - **Digital product files:** Allow any file type (customers may sell any digital format). Always serve with `Content-Disposition: attachment` (Section 7.3) and `X-Content-Type-Options: nosniff` to prevent browser interpretation.
  - Both: reject files with double extensions (e.g., `file.jpg.exe`), null bytes in filenames, and path traversal sequences in filenames (`../`)
- **Trusted proxy:** Fastify is configured with `trustProxy: true` (single trusted hop — Caddy). Caddy automatically sets `X-Forwarded-For` and `X-Real-IP` headers. All IP-dependent features (rate limiting, audit logging, order `ip_address`, download log `ip_address`) use `request.ip`, which Fastify resolves from the trusted proxy headers. In production, Docker network isolation ensures only Caddy can reach the API port — the API is not exposed on the host network directly.
- **CORS (Fastify):**
  - Allowed origins: `[STORE_URL, ADMIN_URL]` (from env vars, exact match — no wildcards)
  - Allowed methods: `GET, POST, PUT, DELETE, OPTIONS`
  - Allowed headers: `Content-Type, X-CSRF-Token`
  - Credentials: `true`
  - Max-age: `86400`
- **Email enumeration protection:**
  - `POST /auth/forgot-password`: Always returns `{ success: true, message: "If an account with that email exists, a reset link has been sent." }` regardless of whether the email exists. No timing difference (use constant-time response).
  - `POST /auth/register`: If email already exists with an active account, return a generic `{ success: true, message: "Check your email to continue." }` and send an email: "Someone tried to register with your email. If this was you, log in instead." Never reveal via API response or timing whether an email is already registered.
- **Password reset tokens:**
  - Generated via `crypto.randomBytes(32)`, stored as SHA-256 hash in DB (raw token sent in email, never stored)
  - Expiration: 1 hour from generation
  - Single-use: token row deleted after successful reset
  - Invalidated on: successful login, new reset request, or password change
  - Rate limit: 3 requests / hour per email (see above)

### 6.3 Headers (via Caddy)

**Storefront routes (served by Next.js):** CSP is set by Next.js middleware (not Caddy) to support per-request nonce generation for script-src:

```
# Set in Next.js middleware via headers — Caddy passes through the Next.js response headers for storefront routes
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{PER_REQUEST_NONCE}' js.stripe.com www.paypal.com www.sandbox.paypal.com; frame-src js.stripe.com www.paypal.com www.sandbox.paypal.com; connect-src 'self' api.stripe.com *.paypal.com *.sandbox.paypal.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
# Next.js App Router generates a nonce per request and injects it into both the CSP header and
# all inline <script> tags (hydration data, etc.) via next.config.ts `headers` or middleware.
# This avoids 'unsafe-inline' for scripts while allowing Next.js SSR hydration to work.
# style-src uses 'unsafe-inline' for v1 — post-launch hardening (Phase 6) should evaluate nonce-based styles.
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Admin routes and API routes (served by Caddy directly):** CSP is set by Caddy since these don't need per-request nonces (admin SPA loads only external scripts via `<script src>`):

```
# Set in Caddyfile for /admin/* and /api/* routes
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 6.4 Data Protection

- **PCI compliance:** Stripe.js + PayPal SDK handle all card data client-side. Server never receives raw card numbers. Only tokenized payment method IDs stored.
- **Secrets management:** All API keys in `.env` (dev) / Docker secrets (prod). Never committed to source.
- **GDPR endpoints:** Customer data export (JSON) and full account deletion with cascade.
  - **Account deletion PII anonymization:** In addition to `customer_id ON DELETE SET NULL` on orders, the deletion handler must explicitly anonymize remaining PII before deleting the customer row:
    1. `UPDATE orders SET ip_address = NULL, user_agent = NULL, email = 'deleted-' || id || '@redacted.invalid', billing_address = NULL WHERE customer_id = $1`
    2. `UPDATE download_log SET ip_address = NULL, user_agent = NULL WHERE download_link_id IN (SELECT dl.id FROM download_links dl JOIN orders o ON dl.order_id = o.id WHERE o.customer_id = $1)`
    3. Then delete the customer row (cascades `customer_id` to NULL on orders, reviews, etc.)
  - **Data export:** The `POST /account/export-data` endpoint must include IP addresses and user agents from orders and download logs in the export JSON (GDPR right of access) before any anonymization occurs.
- **Database encryption:** Sensitive fields (TOTP secrets) encrypted at application level with AES-256-GCM before storage.
  - **IV/nonce:** Generate a random 12-byte IV per encryption via `crypto.randomBytes(12)`. Never reuse an IV with the same key (AES-GCM with reused nonce is catastrophically broken).
  - **Storage format:** `base64(IV || ciphertext || authTag)` — the 12-byte IV is prepended, the 16-byte auth tag is appended. On decrypt, split by known lengths.
  - **Key rotation:** When `ENCRYPTION_KEY` must be rotated, add `ENCRYPTION_KEY_OLD` to env vars. A migration script reads all encrypted fields, decrypts with the old key, re-encrypts with the new key, and writes back. Remove `ENCRYPTION_KEY_OLD` after migration completes.

### 6.5 Backup & Recovery (Production)

- **Database:** Daily `pg_dump` piped through `age` (or `gpg --encrypt`) before upload to Hetzner Object Storage (S3-compatible), retained for 30 days. WAL archiving enabled for point-in-time recovery. Backup encryption key stored separately from backup bucket credentials (never in the same storage location).
- **MinIO files:** MinIO bucket versioning enabled. Daily sync to Hetzner Object Storage as off-server backup. Hetzner Object Storage bucket configured with server-side encryption enabled.
- **Secrets:** `.env` / Docker secrets backed up separately (encrypted, off-server). Never stored in the same backup bucket as data. Backup encryption keys stored in a separate location (e.g., password manager or hardware token).
- **Recovery testing:** Restore procedure documented and tested quarterly. Target RTO: 1 hour, RPO: 24 hours (daily backup) or minutes (WAL replay).
- **Automation:** Backup script runs via cron on the host (not inside containers). Failures alert via email.

---

## 7. Digital Product Delivery

### 7.1 Upload Flow (Admin)
1. Admin uploads file via admin panel (multipart, max 500MB)
2. API streams file to MinIO bucket `product-files` with UUID-based key
3. Original filename preserved in `product_files.filename`
4. MinIO key stored in `product_files.storage_key` (never exposed to frontend)

### 7.2 Purchase → Delivery Flow
1. Payment confirmed (Stripe webhook / PayPal webhook)
2. Order status updated to `paid`
3. **Digital product quantity rule:** Cart items are capped at `quantity: 1` per variant. Since all products are digital (files, not physical goods), buying "2 copies" of the same variant has no meaningful distinction. The `PUT /cart/items` endpoint enforces this: adding a variant that already exists in the cart is a no-op (not an increment). Different variants of the same product (e.g., "Personal License" + "Commercial License") are separate line items and each allowed at quantity 1. The `quantity` column on `cart_items` and `order_items` is retained for schema consistency but is always 1 in v1.
4. For each `order_item`, system generates one `download_link` per associated `product_file`:
   - Secure random token: `crypto.randomBytes(32).toString('hex')` — 64-character hex string, 256 bits of entropy, URL-safe
   - `max_downloads: 5` (or per-file override from `product_files.max_downloads`)
   - `expires_at: now() + 7 days` (or per-file override from `product_files.download_expiry_hours`)
5. Transactional email sent with download URLs: `https://store.com/download/{token}`
6. Download URL also displayed on order confirmation page

### 7.3 Download Flow
1. Customer visits `/download/{token}`
2. API validates: token exists, `is_active`, `download_count < max_downloads`, `expires_at > now()`
3. If valid: acquire a Valkey lock (`SET download:{linkId}:active EX 1800 NX` — 30-minute TTL) to prevent concurrent downloads of the same link. If lock already held, return "Download already in progress — please wait for it to complete."
4. Stream file content directly through the API server from MinIO (using MinIO client `getObject`), set `Content-Disposition: attachment` header with original filename. **Do NOT redirect to presigned URLs** — this would expose a shareable link that bypasses download count enforcement.
5. **On stream success:** Increment `download_count` atomically (`UPDATE download_links SET download_count = download_count + 1 WHERE id = $1 AND download_count < max_downloads RETURNING id`). If no row returned (concurrent race — another download completed in the gap), accept it as a consumed attempt. Log to `download_log`. Release the Valkey lock.
6. **On stream failure** (MinIO error, client disconnect, network timeout): Release the Valkey lock. Do NOT increment `download_count` — the customer does not lose a download attempt for failed transfers. Log the failure for diagnostics.
7. **On process crash:** The Valkey lock expires after 30 minutes (TTL). No download count was incremented, so no data integrity issue. The customer can retry after the lock expires.
8. If invalid: show appropriate error (expired, limit reached, etc.)
9. For files > 100MB: use Node.js stream piping (`pipeline`) to avoid buffering the entire file in memory. Set appropriate `Content-Length` header from `product_files.file_size`.

### 7.4 Download Link Revocation on Refund
1. **Full refund:** All `download_links` for the order are set to `is_active = false`
2. **Partial refund:** Only `download_links` for refunded `order_items` are deactivated
3. Active download pages show "This download is no longer available — this order has been refunded"
4. Revocation is performed atomically within the same transaction as the refund status update

### 7.5 Re-download (Account Portal)
1. Authenticated customer views order history
2. Each order shows download links with remaining count and expiry
3. Customer can request new download link generation (resets count + expiry) — admin-configurable

### 7.6 Payment Idempotency Strategy

Payment processing must handle duplicate webhook deliveries, race conditions between client confirmation and webhook, and network retries without creating duplicate orders or charges.

**Source of truth:** The payment provider webhook is the authoritative confirmation of payment. The client-side `/checkout/confirm` endpoint does NOT create orders or mark them as paid — it only returns the order confirmation page.

**Flow (Stripe):**
1. Client calls `POST /checkout/stripe`:
   - **Idempotency guard:** Check for an existing `pending` order linked to this cart (lookup by `session_id_hash` + cart ID).
     - If found **with** a valid `stripe_payment_intent_id`: return the existing `{ clientSecret, orderId }`. This prevents double-click and retry from creating duplicate orders.
     - If found **without** a `stripe_payment_intent_id` (previous Stripe API call failed): if the order was created less than 30 minutes ago, reuse it and retry the Stripe PaymentIntent creation for this existing order. If older than 30 minutes, delete the stale pending order and proceed as if no order exists.
   - If no existing pending order: validate cart (items exist, prices current, discount still valid)
   - Create `order` record in `pending` status by snapshotting cart items into `order_items` (freeze prices at time of purchase)
   - **Discount reservation:** Do NOT increment `discounts.current_uses` at this step. Discount validation (eligibility, date range, product applicability) is checked, but the `current_uses` increment and `discount_customer_uses` INSERT happen only at payment confirmation (Step 4, webhook handler). This ensures abandoned/failed checkouts don't consume discount uses.
   - Create Stripe PaymentIntent with `order.id` in metadata
   - Store `stripe_payment_intent_id` on the order record
   - Return `{ clientSecret, orderId }` to the client
   - Cart is NOT deleted yet (preserved for retry if payment fails)
2. Client confirms payment via Stripe.js using the `clientSecret`
3. Client navigates to `GET /checkout/confirm/:orderId`:
   - Look up order by ID, verify it belongs to the current session/customer
   - Return order confirmation page data (order details, current status)
   - This endpoint does NOT modify order status — it is read-only
   - **Confirmation page behavior:** The page polls `GET /api/v1/store/checkout/status/:orderId` every 3 seconds until status transitions from `pending` to `paid`. This endpoint validates that the orderId belongs to the current session (via `session_id_hash`) — no authentication required, so it works for guest checkout. While pending, show a "Verifying your payment..." indicator with a spinner. Download links appear once status is `paid`. After 60 seconds of polling with no transition, show: "Your payment is being verified — you'll receive an email with download links shortly."
4. Stripe webhook `payment_intent.succeeded` arrives:
   - Verify webhook signature
   - Look up order by `stripe_payment_intent_id`
   - Acquire PostgreSQL advisory lock on order ID
   - **Blocked customer check:** If the order has a `customer_id`, look up `customers.is_blocked`. If `is_blocked = true`: accept the payment (cannot prevent it at Stripe level), set order status to `paid_held`, do NOT generate download links, do NOT delete the cart, and notify admin via email/audit log ("Order #{order_number} paid but customer is blocked — review and refund or release"). Return 200 to Stripe. The admin can then refund via the admin panel, or manually release the order by transitioning status to `paid` and triggering download link generation.
   - If order status is `pending` and customer is not blocked → within the advisory lock and DB transaction: apply discount atomically (INSERT discount_customer_uses + UPDATE current_uses per Section 4.3; if discount exhausted since order creation, proceed anyway at the already-charged price and log admin warning), transition to `paid`, generate download links, delete the cart. **Commit the transaction and release the advisory lock FIRST.**
   - **After transaction commit:** send confirmation email outside the critical path. If email fails (SMTP timeout, provider error), log the error for admin attention but do NOT fail the webhook. The order is already paid and download links exist — the customer can access them via the confirmation page. A background retry or admin-triggered resend can recover the email.
   - If order status is already `paid` or `paid_held` → no-op (idempotent), return 200 to Stripe
   - If no order found → log error, alert admin (should not happen in normal flow)
5. If payment fails (Stripe webhook `payment_intent.payment_failed`):
   - Update order status to `failed`
   - Cart is preserved — customer can retry from cart page

**Flow (PayPal):** Same pattern using `paypal_order_id` as the idempotency key. `POST /checkout/paypal` creates the order and PayPal order, returns PayPal approval URL. After PayPal redirect, `GET /checkout/confirm/:orderId` shows the confirmation page. PayPal webhook confirms payment.

**Race condition guard:** The webhook handler uses a PostgreSQL transaction-level advisory lock on the order ID before transitioning status, preventing concurrent webhook deliveries from creating duplicate download links. Since order IDs are UUIDs and `pg_advisory_xact_lock()` takes `bigint`, convert via: `pg_advisory_xact_lock(('x' || substr(order_id::text, 1, 16))::bit(64)::bigint)`. This uses 64 of the UUID's 128 bits — collision probability is ~1 in 2^32 per the birthday paradox, negligible at store scale. Transaction-level locks auto-release on commit/rollback.

---

## 8. Email Templates

All templates admin-editable via store settings (logo, colors, copy).

| Template | Trigger | Contents |
|----------|---------|----------|
| Order Confirmation | Payment success | Order summary, download links, support contact |
| Payment Failed | Payment decline | Retry prompt, support contact |
| Refund Confirmation | Admin issues refund | Refund amount, original order ref |
| Welcome | Account creation | Login link, getting started |
| Password Reset | Reset request | Time-limited reset link |
| Download Expiring | 24h before expiry | Re-download prompt, remaining downloads |
| Review Request | 7 days post-purchase | Product review prompt (optional) |

---

## 9. Real-Time Analytics (WebSocket)

### Architecture
- Fastify WebSocket endpoint: `/api/v1/admin/analytics/live`
- Admin authenticates via session cookie (validated on WS upgrade). WS upgrade handler also validates `Origin` header against `ADMIN_URL` and rejects mismatched origins before session validation (defense-in-depth alongside SameSite=Strict).
- Valkey Pub/Sub channels:
  - `analytics:orders` — new order events
  - `analytics:revenue` — revenue updates
  - `analytics:visitors` — active visitor count (if implemented)

### Reconnection Strategy
- Valkey Pub/Sub is fire-and-forget — events during a disconnect are lost.
- On WebSocket reconnect, the admin dashboard client re-fetches the on-load REST endpoints (`/analytics/overview`, `/analytics/revenue`, `/analytics/products`) to sync state before resuming the live feed.
- This ensures counters and charts are accurate even after network blips, tab sleep, or browser refresh.

### Events pushed to admin dashboard
```typescript
interface AnalyticsEvent {
  type: 'new_order' | 'revenue_update' | 'refund' | 'visitor_count';
  data: {
    orderId?: string;
    amount?: number;
    productTitle?: string;
    timestamp: string;
    // running totals
    todayRevenue?: number;
    todayOrders?: number;
  };
}
```

### Dashboard Widgets (Real-Time)
- Today's revenue (live counter)
- Today's orders (live counter)
- Recent orders feed (last 10, auto-updating)
- Revenue chart (auto-appending data points)
- Top products today (re-sorted on each order)

### Dashboard Widgets (On-Load)
- Revenue by period (7d, 30d, 90d, 12m)
- Conversion funnel (visits → cart → checkout → paid)
- Traffic sources breakdown
- Top products (all time / selected period)
- Customer growth chart

---

## 10. SEO Features

- **Meta tags:** Editable `seo_title` and `seo_description` per product, collection, and page
- **JSON-LD:** Product structured data on every PDP (name, price, availability, reviews, image)
- **Sitemap:** Auto-generated `/sitemap.xml` including all active products, collections, and pages
- **robots.txt:** Admin-editable via store settings
- **Canonical URLs:** Automatically set on all pages
- **Open Graph / Twitter cards:** Auto-generated from product data
- **Core Web Vitals:** Next.js image optimization, lazy loading, CSS/JS minification, SSR/SSG

---

## 11. Build Phases

### Phase 1 — Foundation & Scaffold
- [ ] Docker Compose with all services (Postgres, Valkey, MinIO, Caddy, API, Storefront, Admin, Mailpit)
- [ ] Database migrations (all tables) via node-pg-migrate
- [ ] Fastify API scaffold with plugin architecture
- [ ] Auth system: bcrypt, sessions (Valkey), CSRF tokens
- [ ] Admin login + TOTP 2FA setup/verify
- [ ] Admin user CRUD (owner can manage admins)
- [ ] Initial admin bootstrapping (create-admin CLI script)
- [ ] Audit log middleware
- [ ] Rate limiting middleware
- [ ] Security headers via Caddy
- [ ] Health check endpoint: `GET /health` → `{ status: "ok"|"degraded"|"down", db: bool, valkey: bool, minio: bool, uptime: number }`. Docker `healthcheck` uses this. Returns 200 if db+valkey up, 503 otherwise. MinIO failure returns "degraded" (not fatal — uploads/downloads fail but checkout still works)
- [ ] Test infrastructure: Vitest config, Supertest for API integration tests, test scripts in package.json

**Exit criteria:**
1. `docker compose up` starts all services with no errors; health checks pass
2. Admin can register via CLI, log in with password + TOTP, and see an empty dashboard
3. Rate limiter blocks the 6th login attempt within 15 minutes (verified via test)
4. All security headers present in Caddy responses (HSTS, CSP, X-Frame-Options, etc.)
5. Audit log records admin login events
6. Every migration file has both an up and down migration; `npm run migrate:down` reverses the initial migration cleanly (verified by running up → down → up with no errors)

### Phase 2 — Admin Panel Core
- [ ] Admin SPA scaffold (Vite + React + TypeScript)
- [ ] Admin layout: sidebar nav, breadcrumbs, notifications
- [ ] Product CRUD (create, edit, archive) with rich text editor
- [ ] Product variant management
- [ ] Product image upload (MinIO)
- [ ] Product digital file upload (MinIO, max 500MB)
- [ ] Collections CRUD (manual only — rule-based deferred to post-v1)
- [ ] Discount/coupon engine (percentage, fixed; free_product type deferred to post-v1)
- ~~Gift card generation and management~~ **(Deferred to post-v1 — requires checkout integration, schema, and balance handling. See Section 4.3. Do NOT implement in v1.)**
- [ ] Static page editor
- [ ] Store settings management
- [ ] Navigation menu editor: drag-and-drop header + footer menu builder; link type picker (page, collection, route, external URL); live preview of resolved links; validates that referenced pages/collections exist
- [ ] Admin roles & permissions enforcement

**Exit criteria:**
1. Admin can create a product with variants, images, and a digital file; all persist after refresh
2. File upload works up to 500MB; files are stored in MinIO, never in webroot
3. Admin can create a manual collection, add products, and reorder them
4. Discount codes apply correctly via API test (percentage + fixed amount verified against cart totals)
5. Staff role user cannot access owner-only endpoints (admin user management)
6. Admin can configure header + footer navigation menus; adding a page link by slug resolves correctly in the API response; removing a link is reflected in the layout endpoint

### Phase 3 — Storefront
- [ ] Next.js project scaffold with TypeScript
- [ ] Shared layout shell: `layout.tsx` fetches `GET /layout` → renders `<Header>` + `<Footer>` with resolved navigation data; all pages inherit this layout automatically (see Section 3 "Storefront Shared Layout")
- [ ] Homepage: hero banner, featured collections, featured products, trust badges
- [ ] Product listing page: grid view, filters (tag, category, price), sort options
- [ ] Product detail page: gallery, variants, description, reviews, buy now / add to cart
- [ ] Collections pages
- [ ] Search with autocomplete
- [ ] Cart (database-persistent via carts/cart_items tables): add, update quantity, remove, discount code
- [ ] Static pages (About, FAQ, Contact, Privacy, Terms, Refund) — Contact page displays store contact email from `store_settings.general.contactEmail`; no form submission in v1
- [ ] Customer account: register, login, order history, re-download, profile edit, password reset
- [ ] Mobile responsive (all pages) with mobile-first design considerations:
  - Touch targets minimum 48x48px (WCAG 2.5.8)
  - Mobile navigation: hamburger menu with slide-out drawer (header) or bottom tab bar
  - Mobile checkout: single-column layout, large form inputs, autofill-friendly field names
  - Sticky "Add to Cart" / "Buy Now" button on mobile PDP (always visible above fold)
  - Swipeable product image gallery on mobile
  - Cart accessible via persistent icon in header with item count badge
- [ ] SEO: meta tags, JSON-LD, sitemap, robots.txt, canonical URLs, OG tags

**Exit criteria:**
1. Customer can browse products, filter by tag/price, search with autocomplete, and view product details
2. Cart persists across browser sessions (database-backed); adding a variant already in the cart is a no-op; different variants of the same product are separate line items
3. Customer can register, log in, view order history, and reset password via email
4. All pages render correctly on mobile (iPhone SE @ 375px and Pixel 7 @ 412px viewports) and desktop (1440px)
5. Mobile checkout flow is completable without horizontal scrolling or unreachable buttons (manual QA pass)
6. Lighthouse SEO score ≥ 90; JSON-LD structured data validates on Google's testing tool
7. Changing a header/footer link in admin navigation settings is reflected on all storefront pages within 60 seconds (cache TTL); renaming a page slug auto-updates navigation links; unpublishing a page removes its link from nav

### Phase 4 — Checkout & Payments
- [ ] Stripe integration: PaymentIntent creation, Stripe.js client, webhook handler
- [ ] PayPal integration: order creation, SDK client, webhook handler
- [ ] Checkout flow: cart review → contact/billing → payment → confirmation
- [ ] Guest checkout (email-based with upsert, optional account creation post-purchase)
- [ ] Order creation and status management
- [ ] Download link generation (tokenized, 5 downloads, 7-day expiry)
- [ ] Transactional email: order confirmation with download links
- [ ] Order confirmation page with download links
- [ ] Webhook signature verification (Stripe + PayPal)
- [ ] Idempotent payment processing (see Section 7.5)

**Exit criteria:**
1. End-to-end purchase works with Stripe test mode: cart → checkout → payment → order confirmation → download
2. End-to-end purchase works with PayPal sandbox: same flow as above
3. Same guest email can checkout twice without errors (upsert verified)
4. Duplicate webhook delivery does not create duplicate orders (idempotency verified)
5. Download link works within limits (5 downloads, 7 days); 6th download is blocked with clear error

### Phase 5 — Post-Purchase & Account Features
- [ ] Customer re-download from account portal
- [ ] Admin refund flow (full + partial) via Stripe/PayPal APIs
- [ ] Transactional emails: payment failed, refund confirmed, password reset, welcome
- [ ] Download expiry warning email (24h before)
- [ ] Review submission (must have purchased) (Stretch)
- [ ] Admin review moderation (approve/reject/respond) (Stretch)
- [ ] GDPR: data export + account deletion endpoints
- [ ] Customer refund request flow: "Request Refund" button on order detail page (`/account/orders/:id`) → form with item selection + reason → `POST /api/v1/store/account/orders/:id/refund-request` → sends structured email to store admin (order number, items, reason, customer email). Rate limited: 1 per order per 24h. Admin still processes refund manually via admin panel.
- [ ] Customer block/unblock (admin)

**Exit criteria:**
1. Customer can re-download from account portal; new download link resets count + expiry
2. Admin can issue full and partial refunds; refund reflected in Stripe/PayPal dashboard
3. All transactional emails render correctly in Mailpit (order confirmation, refund, password reset, welcome)
4. Customer can submit a review only for purchased products; admin can approve/reject/respond
5. GDPR data export produces valid JSON; account deletion cascades correctly (orders preserved, PII removed)

### Phase 6 — Analytics, Polish & Optimization
- [ ] Real-time analytics WebSocket endpoint
- [ ] Admin dashboard: live revenue, orders, recent activity
- [ ] Admin dashboard: revenue charts, top products, conversion funnel (Stretch), traffic sources (Stretch)
- [ ] Finance: payout summaries, refund history, CSV export
- [ ] Admin audit log viewer
- [ ] Core Web Vitals optimization pass
- [ ] Load testing and rate limit tuning
- [ ] Email template customization UI (Stretch)
- [ ] Final security audit (CSP tuning, dependency audit)

**Exit criteria:**
1. WebSocket live feed shows new orders in real-time on admin dashboard
2. Revenue charts display accurate data for 7d, 30d, 90d periods
3. CSV export produces valid data matching dashboard totals
4. Lighthouse Performance score ≥ 85 on storefront pages
5. Rate limiting holds under simulated load (100 req/min per IP enforced)

---

## 12. Explicitly Excluded

| Feature | Reason |
|---------|--------|
| Physical shipping, tracking, labels | Digital products only |
| POS / in-person payments | Digital-only store |
| Multi-language / multi-currency | US English / USD only |
| Inventory / stock tracking | Not applicable for digital |
| Supplier / purchase orders | Not applicable |
| SMS notifications | Out of initial scope |
| Apple Pay / Google Pay | Stub-ready, activated later |
| Social login (Google, GitHub, etc.) | Out of initial scope |
| Subscription / recurring billing | Out of initial scope |

---

## 13. Environment Configuration

### Required `.env` variables

```env
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/store
VALKEY_URL=redis://valkey:6379

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=<generated>              # MUST NOT use default 'minioadmin' — API checks on startup in ALL environments: production → refuse to start; development → log warning to stderr every 60s
MINIO_SECRET_KEY=<generated>
MINIO_BUCKET_PRODUCTS=product-files
MINIO_BUCKET_IMAGES=product-images

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_MODE=sandbox  # or 'live'

# Email
SMTP_HOST=mailpit      # dev: mailpit, prod: smtp.postmarkapp.com (or provider equivalent)
SMTP_PORT=1025         # dev: 1025, prod: 587
SMTP_USERNAME=                          # prod: transactional email provider API token / username
SMTP_PASSWORD=                          # prod: transactional email provider API token / password
SMTP_FROM_NAME=Store
SMTP_FROM_EMAIL=noreply@yourstore.com

# Security
SESSION_SECRET=<64-char random string>
CSRF_SECRET=<64-char random string>
ENCRYPTION_KEY=<64 hex chars = 32 bytes for AES-256-GCM>
CLAIM_SECRET=<64-char random string>   # dedicated HMAC key for guest order claim tokens (Section 4.1)

# Database Pool (optional — defaults in Section 2)
DATABASE_POOL_MAX=20
DATABASE_POOL_IDLE_TIMEOUT=30000
DATABASE_POOL_CONNECT_TIMEOUT=5000

# App
NODE_ENV=development
STORE_URL=http://localhost:3000
ADMIN_URL=http://localhost:3002
API_URL=http://localhost:3001
API_INTERNAL_URL=http://api:3001    # used by Next.js SSR for internal Docker calls
```

---

## 14. File & Directory Structure

```
digital-storefront/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
│
├── api/                          # Fastify API server
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── app.ts                # Fastify app setup
│   │   ├── config/
│   │   │   └── env.ts            # Validated env config
│   │   ├── plugins/
│   │   │   ├── auth.ts           # Session + CSRF plugin
│   │   │   ├── rate-limit.ts     # Rate limiting plugin
│   │   │   ├── audit.ts          # Audit log plugin
│   │   │   └── websocket.ts      # WebSocket plugin
│   │   ├── routes/
│   │   │   ├── store/            # Public storefront routes
│   │   │   │   ├── products.ts
│   │   │   │   ├── collections.ts
│   │   │   │   ├── cart.ts
│   │   │   │   ├── checkout.ts
│   │   │   │   ├── download.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── account.ts
│   │   │   │   ├── reviews.ts
│   │   │   │   ├── search.ts
│   │   │   │   └── pages.ts
│   │   │   ├── admin/            # Admin routes
│   │   │   │   ├── auth.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── variants.ts
│   │   │   │   ├── collections.ts
│   │   │   │   ├── orders.ts
│   │   │   │   ├── customers.ts
│   │   │   │   ├── discounts.ts
│   │   │   │   ├── gift-cards.ts
│   │   │   │   ├── reviews.ts
│   │   │   │   ├── analytics.ts
│   │   │   │   ├── finance.ts
│   │   │   │   ├── settings.ts
│   │   │   │   ├── pages.ts
│   │   │   │   ├── admins.ts
│   │   │   │   └── audit-log.ts
│   │   │   └── webhooks/
│   │   │       ├── stripe.ts
│   │   │       └── paypal.ts
│   │   ├── services/             # Business logic
│   │   │   ├── product.service.ts
│   │   │   ├── order.service.ts
│   │   │   ├── payment.service.ts
│   │   │   ├── download.service.ts
│   │   │   ├── discount.service.ts
│   │   │   ├── email.service.ts
│   │   │   ├── analytics.service.ts
│   │   │   └── file.service.ts
│   │   ├── lib/
│   │   │   ├── db.ts             # PostgreSQL client
│   │   │   ├── valkey.ts          # Valkey client
│   │   │   ├── minio.ts          # MinIO client
│   │   │   ├── stripe.ts         # Stripe SDK init
│   │   │   ├── paypal.ts         # PayPal SDK init
│   │   │   ├── email.ts          # SMTP transport
│   │   │   └── crypto.ts         # Encryption helpers
│   │   ├── schemas/              # JSON Schema definitions
│   │   │   ├── product.schema.ts
│   │   │   ├── order.schema.ts
│   │   │   └── ...
│   │   ├── types/
│   │   │   └── index.ts          # Shared TypeScript types
│   │   └── __tests__/            # Vitest + Supertest tests
│   │       ├── routes/           # API route integration tests
│   │       └── services/         # Service unit tests
│   └── migrations/
│       ├── 001_initial.sql
│       └── ...
│
├── storefront/                   # Next.js customer-facing site
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── public/
│   │   └── ...
│   ├── src/
│   │   ├── app/                  # App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx          # Homepage
│   │   │   ├── products/
│   │   │   │   ├── page.tsx      # PLP
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx  # PDP
│   │   │   ├── collections/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx
│   │   │   ├── cart/
│   │   │   │   └── page.tsx
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx
│   │   │   ├── download/
│   │   │   │   └── [token]/
│   │   │   │       └── page.tsx
│   │   │   ├── account/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── orders/
│   │   │   │   ├── profile/
│   │   │   │   └── ...
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   ├── forgot-password/
│   │   │   │   └── reset-password/
│   │   │   ├── search/
│   │   │   │   └── page.tsx
│   │   │   ├── [slug]/           # Static pages (About, FAQ, etc.)
│   │   │   │   └── page.tsx
│   │   │   ├── sitemap.xml/
│   │   │       └── route.ts      # Dynamic sitemap generation
│   │   │   └── robots.txt/
│   │   │       └── route.ts      # Dynamic robots.txt from store_settings.seo.robotsTxt
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx       # Navigation from layout API, logo, search, cart badge, account link
│   │   │   │   ├── Footer.tsx       # Footer columns from layout API, contact email, copyright
│   │   │   │   ├── MobileNav.tsx    # Hamburger menu / slide-out drawer for mobile header nav
│   │   │   │   └── AnnouncementBar.tsx  # Optional top banner (from store_settings)
│   │   │   ├── product/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   └── ui/
│   │   ├── lib/
│   │   │   ├── api.ts            # API client
│   │   │   └── utils.ts
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── __tests__/            # Component + page tests
│   ├── e2e/                      # Playwright E2E tests
│   │   └── checkout.spec.ts
│
├── admin/                        # React SPA (Vite)
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── ProductEdit.tsx
│   │   │   ├── Collections.tsx
│   │   │   ├── Orders.tsx
│   │   │   ├── OrderDetail.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Discounts.tsx
│   │   │   ├── GiftCards.tsx
│   │   │   ├── Reviews.tsx
│   │   │   ├── Pages.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── Finance.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── AdminUsers.tsx
│   │   │   └── AuditLog.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── forms/
│   │   │   ├── tables/
│   │   │   ├── charts/
│   │   │   └── ui/
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useWebSocket.ts
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── utils.ts
│   │   ├── styles/
│   │   └── __tests__/            # Admin component + page tests
│
├── caddy/
│   └── Caddyfile
│
├── postgres/
│   └── init.sql                  # Initial DB creation
│
└── scripts/
    ├── seed.ts                   # Development seed data
    └── create-admin.ts           # CLI: create first admin user
```

---

## 15. Deployment Procedure

### Prerequisites
- Hetzner VPS with Docker and Docker Compose installed
- Domain DNS pointed to server IP
- `.env.prod` file with all production secrets configured (see Section 13)
- Docker images built and pushed to a registry (or built on-server)

### Deploy Steps

1. **SSH to server** and pull the latest code (or images):
   ```bash
   cd /opt/digital-storefront
   git pull origin main
   ```

2. **Run database migrations** manually via a one-off container (NEVER run migrations on API startup in production):
   ```bash
   docker compose -f docker-compose.prod.yml run --rm api npm run migrate:up
   ```
   - If migration fails: inspect the error, fix the migration SQL, and retry. Do NOT start the new API version until migrations succeed.
   - If a migration is irreversible and fails partway: restore from backup (Section 6.5), fix, redeploy.

3. **Pull/build updated images and restart services:**
   ```bash
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```
   Expected downtime: ~10-30 seconds (single-instance, not zero-downtime). Schedule deploys during low-traffic periods.

4. **Verify health check:**
   ```bash
   curl -f http://localhost:3001/health
   ```
   Expect `{ "status": "ok", "db": true, "valkey": true, "minio": true }`. If status is "down" or request fails, proceed to rollback.

5. **Verify end-to-end:** Check storefront loads, admin login works, a test product page renders.

### Rollback Procedure

1. **Code rollback:**
   ```bash
   git checkout <previous-commit>
   docker compose -f docker-compose.prod.yml up -d --build
   ```

2. **Migration rollback** (if migration was applied):
   ```bash
   docker compose -f docker-compose.prod.yml run --rm api npm run migrate:down
   ```
   This requires down migrations to exist (see Section 2).

3. **Data rollback** (last resort — if migration was destructive and irreversible):
   Restore PostgreSQL from the most recent backup (Section 6.5). Target RTO: 1 hour.

### Production Migration Policy

- Migrations run **manually before deploy**, not on API startup. The API startup script in production skips auto-migration.
- Every migration must have a corresponding down migration (see Section 2).
- Destructive migrations (column drops, type changes, table drops) require: (a) a pre-deploy backup, (b) explicit sign-off, (c) a documented manual rollback plan if the down migration is insufficient.
- Test migrations against a copy of production data before applying to production.

---

*This document is the single source of truth for the Digital Storefront build. All implementation decisions should reference this spec. Updates to scope require a version bump and changelog entry.*
