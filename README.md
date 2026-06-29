# Shopify Stack Clone

A self-hosted digital product storefront boilerplate. Sell templates, UI kits, fonts, icons, and other digital downloads with a modern stack you fully own and control.

Out of the box you get a customer-facing storefront, an admin dashboard, Stripe checkout with tax support, Google OAuth, file delivery via S3-compatible storage, transactional email, bot detection, and a security dashboard.

---

## Table of Contents

- [Production Launch Checklist](#production-launch-checklist)
- [Local Development](#local-development)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Production Launch Checklist

Work through every item below before making the site public. Items are ordered by dependency -- complete earlier sections first.

### A. Credentials & Secrets

Generate and set all secrets before configuring anything else. Never reuse values across environments.

- [ ] Generate `SESSION_SECRET` (minimum 64 characters):
  ```sh
  openssl rand -hex 64
  ```
- [ ] Set a strong `POSTGRES_PASSWORD` in `.env`
- [ ] Change `MINIO_ROOT_USER` from the default `minioadmin`
- [ ] Set a strong `MINIO_ROOT_PASSWORD` in `.env`
- [ ] Create a Google Cloud project at [console.cloud.google.com](https://console.cloud.google.com) and configure an OAuth 2.0 consent screen
- [ ] Obtain `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and add them to `.env`
- [ ] In the Google OAuth settings, add your production callback URL: `https://yourdomain.com/api/auth/google/callback`
- [ ] Create a Stripe account and retrieve your API keys from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
- [ ] Set `STRIPE_SECRET_KEY` (starts with `sk_live_`)
- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (starts with `pk_live_`)
- [ ] In Stripe Dashboard > Developers > Webhooks, create an endpoint pointing to `https://yourdomain.com/api/checkout/webhook` and subscribe to `checkout.session.completed` events
- [ ] Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)
- [ ] If using Stripe Tax, add tax registrations in the Stripe Dashboard first, then set `STRIPE_TAX_ENABLED=true`

### B. Domain & Networking

- [ ] Set `BASE_URL` in `.env` to your production URL (e.g. `https://store.example.com`)
- [ ] Set `NEXT_PUBLIC_API_URL` to `https://yourdomain.com/api`
- [ ] Set `NEXT_PUBLIC_SITE_URL` to `https://yourdomain.com`
- [ ] Set `VITE_API_URL` to `https://yourdomain.com/api`
- [ ] Set `GOOGLE_CALLBACK_URL` to `https://yourdomain.com/api/auth/google/callback`
- [ ] Update `SMTP_FROM` email domain to match your sending domain (e.g. `Store Name <noreply@yourdomain.com>`)
- [ ] Configure Caddy for production TLS by setting the `CADDY_HOSTNAME` environment variable to your domain. The `docker/Caddyfile` reads this variable -- when set, Caddy auto-provisions a Let's Encrypt certificate:
  ```sh
  # Add to .env or docker-compose environment:
  CADDY_HOSTNAME=store.example.com
  ```
- [ ] Point your DNS A record to the server's public IP address
- [ ] After first boot, verify Caddy obtained a TLS certificate (`docker compose logs caddy`)

### C. Branding & Assets

Replace all placeholder branding before launch.

**Storefront assets** -- place in `storefront/public/`:

- [ ] **Favicon** -- `storefront/public/favicon.svg` -- SVG with a 32x32 viewBox
- [ ] **Apple touch icon** -- `storefront/public/apple-touch-icon.png` -- exactly 180x180px PNG
- [ ] **OG / social image** -- `storefront/public/og-image.png` -- exactly 1200x630px PNG; shown when links are shared on social platforms
- [ ] **Logo** -- SVG recommended as primary format; also provide a PNG fallback at 200x60px (horizontal layout). Place in `storefront/public/` and reference from the Header component at `storefront/src/components/layout/Header.tsx`

**Admin assets:**

- [ ] **Admin favicon** -- add a `<link rel="icon" href="/favicon.svg">` tag inside `<head>` in `admin/index.html` (no favicon is configured by default)
- [ ] **Admin logo** -- to display a logo in the admin sidebar, place the file in `admin/src/` or `admin/public/` and reference it from the sidebar component

### D. Identity & Copy

- [ ] Replace the site name "PixelForge" in `storefront/src/app/layout.tsx`:
  - `metadata.title.default` and `metadata.title.template`
  - `metadata.openGraph.siteName`
  - `metadata.openGraph.images[0].alt`
- [ ] Replace the default fallback URL `https://pixelcart.store` in `storefront/src/app/layout.tsx` (the `SITE_URL` constant)
- [ ] Update `metadata.description` in `storefront/src/app/layout.tsx`
- [ ] Replace "PixelCart" in `admin/index.html` `<title>` tag
- [ ] Update the `SMTP_FROM` display name in `.env`
- [ ] Search for and replace all remaining occurrences of "PixelForge", "PixelCart", and "pixelcart":
  ```sh
  grep -rn "PixelForge\|PixelCart\|pixelcart" \
    --include="*.tsx" --include="*.ts" --include="*.json" --include="*.html" .
  ```
- [ ] Update footer links, social media URLs, and contact email in `storefront/src/components/layout/Footer.tsx`
- [ ] Add Privacy Policy and Terms of Service content to `data/pages.json`
- [ ] Review cookie consent copy in `storefront/src/components/ui/CookieBanner.tsx`

### E. Email

The default configuration uses Mailpit, a development-only mail catcher. Replace it for production.

- [ ] Choose a transactional email provider (Postmark, Amazon SES, Resend, SendGrid, etc.)
- [ ] Update `.env`:
  ```
  SMTP_HOST=smtp.your-provider.com
  SMTP_PORT=587
  SMTP_SECURE=true
  SMTP_FROM=Your Store <noreply@yourdomain.com>
  ```
- [ ] Remove or comment out the `mailpit` service in `docker-compose.yml`
- [ ] Remove the `mailpit` entry from the `api` service's `depends_on` block in `docker-compose.yml`
- [ ] Send a test email through the admin panel to verify delivery

### F. Admin Setup

- [ ] Edit `data/admins.json` and replace the placeholder entries with your real admin email(s):
  ```json
  [
    { "email": "you@example.com", "tier": "super_admin" }
  ]
  ```
  Supported tiers: `super_admin`, `admin`
- [ ] Log in at `/admin/` using Google OAuth with an email listed in `admins.json`
- [ ] Verify the admin dashboard loads and all sections are accessible (products, orders, analytics, security)
- [ ] There is no public admin registration -- access is controlled entirely by `data/admins.json`

### G. Storage (MinIO / S3)

MinIO provides S3-compatible object storage for product files and images. Two buckets are auto-created on first boot by `docker/minio-init.sh`: `product-files` and `product-images`.

- [ ] Change `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` from defaults (see section A)
- [ ] If serving over HTTPS, set `MINIO_USE_SSL=true` in `.env`
- [ ] **Production alternative:** replace MinIO with a managed S3-compatible service (AWS S3, Cloudflare R2, Backblaze B2). Update `MINIO_ENDPOINT`, `MINIO_PORT`, bucket names, and credentials in `.env` accordingly
- [ ] Upload a test product image and file through the admin panel to verify storage works

### H. Database

- [ ] Ensure PostgreSQL is running: `docker compose up -d postgres`
- [ ] Run all migrations:
  ```sh
  docker compose exec api npx node-pg-migrate up --migrations-dir /app/migrations
  ```
- [ ] Set up automated backups using the included script:
  ```sh
  # Manual run:
  ./docker/backup.sh

  # Automated daily backup at 3 AM via crontab:
  crontab -e
  # 0 3 * * * cd /path/to/project && ./docker/backup.sh
  ```
  Backups are stored in `./backups/` as compressed `.sql.gz` files with 30-day retention.
- [ ] Test a restore procedure before going live:
  ```sh
  gunzip -c backups/shopify_stack_YYYYMMDD_HHMMSS.sql.gz | \
    docker compose exec -T postgres psql -U postgres -d shopify_stack
  ```

### I. SEO & Analytics

- [ ] Review `storefront/src/app/robots.ts` -- verify allowed and disallowed paths match your site
- [ ] Review `storefront/src/app/sitemap.ts` -- ensure it generates URLs for all public pages and products
- [ ] Verify OG tags render correctly using [opengraph.xyz](https://opengraph.xyz) or [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [ ] To add analytics (Google Analytics, Plausible, Fathom, etc.), extend the Tracker component at `storefront/src/components/analytics/Tracker.tsx`

### J. Security Hardening

- [ ] Confirm all default passwords have been changed (Postgres, MinIO, session secret)
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Review honeypot paths in `docker/Caddyfile` (the `@honeypot` matcher) and `api/src/routes/security.ts`
- [ ] Review the IP blocklist at `data/banned-ips.json` (see `data/banned-ips.json.example` for format)
- [ ] Review the sanctions blocklist at `data/sanctions-blocklist.json`
- [ ] Verify security response headers are present by inspecting any response from Caddy. The following headers are set automatically: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`
- [ ] Rotate `SESSION_SECRET` immediately after any suspected compromise -- all active sessions will be invalidated

### K. Optional: GeoIP (MaxMind)

Enables country-level geolocation in the security dashboard.

- [ ] Create a free account at [maxmind.com](https://www.maxmind.com/en/geolite2/signup)
- [ ] Go to My Account > Manage License Keys and generate a key
- [ ] Download `GeoLite2-Country.mmdb` and place it at the project root
- [ ] Optionally set `MAXMIND_LICENSE_KEY` in `.env` for reference (not consumed directly by the app -- used only for manual download)

---

## Local Development

### Prerequisites

- Node.js 18+ (20+ recommended)
- Docker and Docker Compose
- A Stripe account (for checkout testing)
- A Google Cloud project with OAuth credentials (for authentication testing)

### Quick Start

```sh
# 1. Clone the repository
git clone <repo-url> && cd youtube-tooler

# 2. Copy the environment template and fill in required values
cp .env.example .env

# 3. At minimum, set these values in .env:
#    POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, SESSION_SECRET,
#    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# 4. Start all services
docker compose up

# 5. Run database migrations (in a separate terminal)
docker compose exec api npx node-pg-migrate up --migrations-dir /app/migrations
```

### Development URLs

| Service         | Via Caddy                              | Direct                                 |
| --------------- | -------------------------------------- | -------------------------------------- |
| Storefront      | http://localhost                        | http://localhost:3000                  |
| Admin           | http://localhost/admin/                 | http://localhost:3002/admin/           |
| API             | http://localhost/api/*                  | http://localhost:3001                  |
| Docs            | http://localhost/docs                   | http://localhost:3003                  |
| MinIO Console   | --                                     | http://localhost:9001                  |
| Mailpit (email) | --                                     | http://localhost:8025                  |

Product images are served at `http://localhost/images/<filename>` via Caddy, which proxies to the MinIO `product-images` bucket.

### Stripe Webhooks (local)

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then forward events to your local API:

```sh
stripe listen --forward-to localhost:3001/api/checkout/webhook
```

Copy the signing secret it prints (starts with `whsec_`) into `.env` as `STRIPE_WEBHOOK_SECRET`.

### Useful Commands

```sh
# Start all services (foreground, with logs)
docker compose up

# Start all services and rebuild containers
docker compose up --build

# Start only infrastructure (database, cache, storage, email)
docker compose up -d postgres valkey minio minio-init mailpit

# Run database migrations
docker compose exec api npx node-pg-migrate up --migrations-dir /app/migrations

# Create a new migration
npx node-pg-migrate create my-migration-name --migrations-dir migrations

# View API logs
docker compose logs -f api

# Back up the database
./docker/backup.sh
```

---

## Project Structure

```
.
├── api/                        Fastify 5 API server (TypeScript)
│   ├── Dockerfile
│   └── src/
│       ├── index.ts            Server entry point
│       ├── config.ts           Environment configuration
│       ├── products.ts         Product catalog
│       ├── lib/                Database, cache, and storage clients
│       ├── plugins/            Fastify plugins (auth, session, stripe, mailer,
│       │                         bot-detector, metrics, sanctions, auth-guard)
│       └── routes/             Route handlers
│           ├── auth.ts         Google OAuth login/callback/logout
│           ├── checkout.ts     Stripe checkout + webhook
│           ├── health.ts       Health check endpoint
│           ├── analytics.ts    Event tracking
│           ├── security.ts     Security dashboard + honeypots
│           ├── audit.ts        Audit log
│           ├── support.ts      Support tickets
│           ├── download.ts     Secure file downloads
│           ├── email.ts        Transactional email
│           ├── newsletter.ts   Newsletter subscriptions
│           ├── banner.ts       Site banner management
│           ├── pages.ts        Static page content
│           └── reconciliation.ts  Order reconciliation
│
├── storefront/                 Next.js 15 customer storefront (App Router)
│   ├── Dockerfile
│   ├── public/                 Static assets (favicon.svg, og-image, etc.)
│   └── src/
│       ├── app/                Pages: home, products, collections, cart,
│       │                         checkout, account, login, search, [slug]
│       ├── components/         UI components (Header, Footer, CookieBanner,
│       │                         ScrollToTop, Tracker, etc.)
│       └── lib/                Contexts (cart, auth, theme) and utilities
│
├── admin/                      Vite + React 19 admin dashboard (base: /admin/)
│   ├── Dockerfile
│   └── src/
│       ├── pages/              Admin pages (products, orders, security, etc.)
│       ├── components/         Admin UI components
│       ├── contexts/           React contexts
│       ├── lib/                Admin utilities
│       └── router.tsx          Client-side routing
│
├── shared/                     Shared TypeScript types and utilities
│   └── src/
│
├── docs/                       Documentation site (Next.js)
│   ├── Dockerfile
│   └── src/
│
├── docker/
│   ├── Caddyfile               Reverse proxy: TLS, routing, security headers, honeypots
│   ├── minio-init.sh           Creates product-files and product-images buckets
│   └── backup.sh               PostgreSQL backup with 30-day retention
│
├── migrations/                 PostgreSQL migrations (node-pg-migrate)
│   ├── 0001_enable-pgcrypto.js
│   ├── 0002_analytics-events.js
│   ├── 0003_support-tickets.js
│   ├── 0004_orders.js
│   ├── 0005_orders-tax-columns.js
│   ├── 0006_audit-log.js
│   ├── 0007_security-events.js
│   ├── 0008_order-access-token-evidence.js
│   └── 0009_audit-log-enhancements.js
│
├── data/                       JSON config files (mounted into API container)
│   ├── admins.json             Admin user allowlist (email + tier)
│   ├── banned-ips.json         IP blocklist
│   ├── banner.json             Site banner configuration
│   ├── pages.json              Static page content (privacy, terms, etc.)
│   ├── newsletter.json         Newsletter subscriber list
│   └── sanctions-blocklist.json
│
├── docker-compose.yml          Full development stack
├── package.json                Root workspace config (npm workspaces)
└── .env.example                Environment variable template
```

---

## Tech Stack

| Layer          | Technology           | Version | Purpose                                   |
| -------------- | -------------------- | ------- | ----------------------------------------- |
| API            | Fastify              | 5.x     | REST API server                           |
| Storefront     | Next.js (App Router) | 15.x    | Server-rendered customer storefront       |
| Admin          | Vite + React         | 6.x/19  | Single-page admin dashboard               |
| Database       | PostgreSQL           | 16      | Primary data store                        |
| Cache          | Valkey               | 8       | Sessions, rate limiting, caching          |
| Object Storage | MinIO                | latest  | S3-compatible file and image storage      |
| Reverse Proxy  | Caddy                | 2       | TLS termination, routing, security headers|
| Auth           | Google OAuth 2.0     | --      | Admin and customer authentication         |
| Payments       | Stripe               | 20.x   | Checkout, webhooks, optional tax          |
| Email          | Nodemailer           | 8.x     | Transactional email delivery              |
| Metrics        | prom-client          | 15.x    | Prometheus-compatible metrics endpoint    |
| GeoIP          | maxmind              | 4.x     | Optional country-level geolocation        |
| Migrations     | node-pg-migrate      | 7.x     | Database schema migrations                |
| Language       | TypeScript           | 5.x     | All application code                      |
| Styling        | Tailwind CSS         | 3.x     | Storefront and admin UI                   |
| Dev Email      | Mailpit              | latest  | Local email capture (development only)    |

---

## Contributing

1. Create a feature branch from `main`.
2. Follow existing patterns in the codebase -- match the style of the file you are editing.
3. Do not introduce new dependencies without discussion.
4. Do not modify configuration files or reorganize directories without discussion.
5. Run the test suite before submitting a pull request.
6. Keep pull requests focused on a single change.

---

## License

MIT
