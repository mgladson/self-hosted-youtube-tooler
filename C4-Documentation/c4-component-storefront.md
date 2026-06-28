# C4 Component -- Customer Storefront

## 1. Overview

| Field | Value |
|-------|-------|
| **Name** | Customer Storefront |
| **Type** | Web Application |
| **Technology** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| **Location** | `storefront/` |
| **Deployment** | Docker container, port 3000 (standalone output), served via Caddy reverse proxy at `http://localhost` |
| **Brand** | PixelForge -- Premium Digital Products |

---

## 2. Purpose

The Customer Storefront is the public-facing web application for PixelForge, a digital product store. It provides the complete customer journey from browsing and discovery through purchase and post-sale account management.

Core responsibilities:

- **Product discovery**: Browsable catalog of digital products (UI kits, icons, fonts, templates, illustrations, marketing assets) organized into collections, with category filtering, sorting, and full-text search.
- **Shopping cart**: Client-side cart persisted in `localStorage`, treating digital products as unique line items (no quantity stacking).
- **Checkout and payment**: Two-phase Stripe checkout flow with optional tax calculation. Phase 1 collects customer email and optional billing address; Phase 2 renders Stripe's `PaymentElement` for card entry.
- **Customer authentication**: Google OAuth login via the backend API, with session-cookie-based auth state. A development-mode test login is also available.
- **Account management**: Authenticated dashboard for viewing order history, downloading purchased files, and managing support tickets (create, view thread, reply).
- **Static content**: Server-rendered legal and marketing pages (privacy policy, terms of service, refund policy, about, FAQ, contact, changelog, roadmap) with content loaded from on-disk `.txt` files or mock data.
- **SEO**: Per-page metadata, OpenGraph tags, JSON-LD structured data (Product, Organization, WebSite, BreadcrumbList, CollectionPage), `robots.txt`, and `sitemap.xml`.
- **Analytics**: Consent-gated behavioural tracking (page views, scroll depth, clicks, element visibility) batched and flushed to the API server.
- **Consent management**: GDPR-style cookie banner with granular analytics/marketing toggles, persisted to `localStorage`.
- **Theming**: Light, dark, and system-following themes with smooth transitions, persisted to `localStorage`.
- **Promotional content**: Server-fetched announcement banner with ISR revalidation and session-scoped dismissal.
- **Newsletter**: Feature-flagged email signup section on the home page.

---

## 3. Software Features

### Product Browsing
- Product catalog page with category pill filters and sort controls (price asc/desc, popularity, newest)
- Product detail pages with image gallery, metadata panel, tags, long description, and related products grid
- Collection index and collection detail pages with hero images and product grids
- Full-text product search across name, description, category, and tags

### Shopping Cart
- `localStorage`-persisted cart under key `pixelcart-cart`
- Digital products treated as unique line items (adding a duplicate is a no-op)
- Cart page with item list, order summary, and clear-cart control
- Cart item count shown in the header icon

### Stripe Checkout
- Two-phase flow: email/address collection followed by Stripe `PaymentElement`
- Optional tax calculation when `taxEnabled` is true (geographic billing address collected)
- Geographic data for 33 countries, 51 US states/territories, 13 Canadian provinces/territories
- Post-payment order confirmation page with polling for webhook completion (max 30s)
- Time-limited download links on successful orders (7-day expiry)

### Customer Authentication
- Google OAuth via API redirect (`/api/auth/customer/google`)
- Session-cookie-based auth state verified on mount via `GET /api/auth/me`
- Development test login via `POST /api/auth/dev-login`
- Error display for OAuth failures (denied, failed, no_email, rate_limited)

### Account Management
- Dashboard overview with stats cards (orders, downloads, support tickets)
- Full order history with status badges (completed/processing/refunded)
- Order detail view with line items, payment summary, and invoice printing
- Downloads library showing all purchased products
- Support ticket system: list, create (subject/priority/message), threaded conversation view with reply

### Static Pages
- Dynamic catch-all route `[slug]` serving legal and marketing content
- Content loaded from `content/legal/{slug}.txt` files with custom text-to-HTML parser
- Under-construction detection via API flag with noindex robots directive
- Pages: about, faq, contact, privacy-policy, terms-of-service, refund-policy, changelog, roadmap

### SEO
- Per-page metadata with title template (`%s | PixelForge`), descriptions, and canonical URLs
- OpenGraph and Twitter card tags with OG images
- JSON-LD structured data: Product, Organization, WebSite (with SearchAction), BreadcrumbList, CollectionPage
- `robots.txt` excluding transactional, private, and search pages
- `sitemap.xml` with priority and change-frequency per route type

### Cookie Consent Management
- Two-mode UI: bottom-of-screen sticky banner and centered preferences modal
- Three consent categories: Necessary (always on), Analytics (toggleable), Marketing (toggleable)
- Persisted to `localStorage` under key `pixelforge-consent`
- Changes broadcast via `CustomEvent('pixelforge:consent-change')` for runtime reactivity

### Analytics Tracking
- Consent-gated (respects `pixelforge-consent` and `navigator.doNotTrack`)
- Event types: `page_view`, `page_exit`, `scroll_depth` (25/50/75/100%), `click`, `element_visibility`
- Events batched in memory and flushed every 10 seconds via `navigator.sendBeacon` (fallback: `fetch` with `keepalive`)
- Session IDs generated with `crypto.randomUUID()` and stored in `sessionStorage`

### Theme (Light / Dark / System)
- Three modes: explicit light, explicit dark, system-following (tracks OS `prefers-color-scheme`)
- Persisted to `localStorage` under key `pixelforge-theme`
- Applied via Tailwind CSS `dark` class on `<html>` with smooth 300ms transition
- Inline `<script>` in `<head>` prevents flash of unstyled content on page load

### Newsletter Signup
- Feature-flagged: only renders when `GET /api/newsletter/settings` returns `enabled: true`
- Email subscription via `POST /api/newsletter/subscribe`
- Success/error state with API-provided messages

### Promo Banner
- Server-side pre-fetched with 60-second ISR revalidation
- Client-side fallback fetch when `initialData` is not provided
- Session-scoped dismissal keyed by `updatedAt` timestamp (new content re-shows the banner)
- Optional image, text, and CTA link

---

## 4. Code Elements

This component is documented at the C4 Code level in three files:

| Code-Level Document | Description |
|---------------------|-------------|
| [c4-code-storefront-src-app.md](c4-code-storefront-src-app.md) | All Next.js App Router pages, layouts, and special files (`robots.ts`, `sitemap.ts`, `not-found.tsx`, `globals.css`). Defines the route structure, rendering modes (Server/Client Components), data fetching patterns, and SEO metadata for every customer-facing page. |
| [c4-code-storefront-src-components.md](c4-code-storefront-src-components.md) | Reusable UI components organized into groups: `layout/` (Header, Footer, MobileNav), `product/` (ProductCard, ProductGrid, ProductFilters, ProductGallery, CollectionCard), `cart/` (CartItemRow), `checkout/` (CheckoutForm), `analytics/` (Tracker), `newsletter/` (NewsletterSignup), `promo/` (PromoBanner), `seo/` (JsonLd), and `ui/` (Container, Badge, Button, Icons, SearchInput, ScrollToTop, SocialLinks, ThemeToggle, CookieBanner, CookiePreferencesButton, UnderConstruction). |
| [c4-code-storefront-src-lib.md](c4-code-storefront-src-lib.md) | Library layer: React contexts (`CartProvider`, `CustomerAuthProvider`, `ThemeProvider`), API client utilities (`apiGet`, `apiPost`), Stripe initialization, cookie consent utilities, geographic reference data, mock product/collection/order fixture data, and shared utility functions (`formatPrice`, `cn`). |

---

## 5. Interfaces

### Pages (Routes)

```
Route                          Rendering           Purpose
------------------------------ ------------------- -----------------------------------------------
/                              Server Component    Home (hero, featured collections/products,
                                                   newsletter, trust badges, promo banner)
/products                      Server + Client     Product catalog with category filters and sorting
/products/[slug]               Server Component    Product detail (image gallery, metadata,
                                                   add-to-cart, related products) [SSG]
/collections                   Server Component    Collections index grid
/collections/[slug]            Server Component    Collection detail with hero and product grid [SSG]
/cart                          Client Component    Shopping cart with item list and order summary
/checkout                      Client Component    Two-phase Stripe checkout (email/address + payment)
/checkout/success              Client Component    Order confirmation with polling and download links
/search                        Server + Client     Product search with results grid
/login                         Client Component    Google OAuth + dev login
/account                       Client Component    Account dashboard overview          [auth-gated]
/account/orders                Client Component    Order history list                  [auth-gated]
/account/orders/[id]           Client Component    Order detail with downloads          [auth-gated]
/account/downloads             Client Component    Purchased product download library   [auth-gated]
/account/support               Client Component    Support ticket list                  [auth-gated]
/account/support/[id]          Client Component    Ticket thread with reply             [auth-gated]
/account/support/new           Client Component    New support ticket form              [auth-gated]
/[slug]                        Server Component    Static/legal content pages           [SSG]
/robots.txt                    (generated)         Crawler access rules
/sitemap.xml                   (generated)         XML sitemap for search engines
```

All `/account/*` routes are auth-gated by `AccountShell`, which checks `useCustomer().isAuthenticated` on mount and redirects unauthenticated users to `/login`.

### API Calls Made

All calls are made to the Fastify API server. The base URL is resolved from `NEXT_PUBLIC_API_URL` (default: `http://localhost/api` for client-side, `API_INTERNAL_URL` for server-side).

| Method | Path | Caller | Purpose |
|--------|------|--------|---------|
| `GET` | `/api/auth/me` | `auth-context.tsx` | Verify active session and load user profile |
| `POST` | `/api/auth/logout` | `auth-context.tsx` | Destroy session cookie |
| `GET` | `/api/auth/customer/google` | `login/page.tsx` (link) | Initiate Google OAuth flow (browser redirect) |
| `POST` | `/api/auth/dev-login` | `login/page.tsx` | Development-mode test login |
| `GET` | `/api/banner` | `page.tsx` (server), `PromoBanner` (client fallback) | Fetch promotional banner data |
| `GET` | `/api/pages` | `[slug]/page.tsx` | Check under-construction flag for static pages |
| `GET` | `/api/checkout/config` | `checkout/page.tsx` | Fetch checkout configuration (tax enabled flag) |
| `POST` | `/api/checkout/create-payment-intent` | `checkout/page.tsx` | Create Stripe payment intent with cart items |
| `GET` | `/api/checkout/order/{orderId}?token={orderToken}` | `checkout/success/page.tsx` | Poll order status after payment |
| `POST` | `/api/analytics/events` | `Tracker` (sendBeacon/fetch) | Batch-flush behavioural tracking events |
| `GET` | `/api/newsletter/settings` | `NewsletterSignup` | Check if newsletter feature is enabled |
| `POST` | `/api/newsletter/subscribe` | `NewsletterSignup` | Subscribe email to newsletter |
| `GET` | `/api/support/tickets` | `account/support/page.tsx` | List customer's support tickets |
| `GET` | `/api/support/tickets/{id}` | `account/support/[id]/page.tsx` | Fetch ticket details and message thread |
| `POST` | `/api/support/tickets` | `account/support/new/page.tsx` | Create new support ticket |
| `POST` | `/api/support/tickets/{id}/messages` | `account/support/[id]/page.tsx` | Reply to a support ticket |

### External Service Calls

| Service | Integration Point | Purpose |
|---------|-------------------|---------|
| Stripe.js | `@stripe/react-stripe-js` `Elements` + `PaymentElement` | Payment UI rendering and `stripe.confirmPayment()` |

---

## 6. Dependencies

### Runtime Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| **API Server** (Fastify) | Network | Authentication, checkout/payments, analytics ingestion, banner, pages, newsletter, support tickets, downloads |
| **Stripe.js** | External script | Payment UI (`PaymentElement`) and payment confirmation |
| **Browser `localStorage`** | Client storage | Cart persistence (`pixelcart-cart`), theme preference (`pixelforge-theme`), cookie consent (`pixelforge-consent`) |
| **Browser `sessionStorage`** | Client storage | Analytics session ID (`_a_sid`), banner dismissal state (`banner-dismissed`) |
| **Google OAuth** | External service | Customer authentication (via API server redirect) |

### Build/Framework Dependencies

| Dependency | Purpose |
|------------|---------|
| Next.js 15 (App Router) | Server/client rendering, routing, image optimization, font loading, metadata API, static generation |
| React 19 | Component model, hooks, context |
| Tailwind CSS | Utility-first styling with custom CSS properties for theming |
| `@stripe/stripe-js` | Stripe.js loader singleton |
| `@stripe/react-stripe-js` | React bindings for Stripe Elements |
| `next/font/google` | Plus Jakarta Sans font loading |

### Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `api.ts`, components | API server base URL for client-side requests |
| `API_INTERNAL_URL` | `page.tsx` (server) | API server URL for server-side requests (Docker internal network) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `stripe.ts` | Stripe publishable key for `loadStripe()` |
| `NEXT_PUBLIC_SITE_URL` | `sitemap.ts`, `robots.ts` | Canonical site URL for SEO |

---

## 7. Component Diagram

```
C4Component
  title Customer Storefront -- Component Diagram

  Container_Boundary(storefront, "Customer Storefront (Next.js 15)") {

    Component_Ext(caddy, "Caddy Reverse Proxy", "HTTP", "Routes / to port 3000")

    Boundary(pages, "App Router Pages") {
      Component(home, "Home Page", "Server Component", "Hero, featured products/collections, newsletter, trust badges")
      Component(catalog, "Product Pages", "Server + Client", "Catalog listing, filters, sort, detail with gallery")
      Component(collections, "Collection Pages", "Server Component", "Collection index and detail with hero images")
      Component(search, "Search Page", "Server + Client", "Full-text product search with results grid")
      Component(cart, "Cart Page", "Client Component", "Cart item list, summary, checkout link")
      Component(checkout, "Checkout Pages", "Client Component", "Two-phase Stripe checkout + order confirmation")
      Component(login, "Login Page", "Client Component", "Google OAuth + dev login")
      Component(account, "Account Pages", "Client Component", "Dashboard, orders, downloads, support [auth-gated]")
      Component(static, "Static Pages", "Server Component", "Legal/marketing content from .txt files")
      Component(seo_files, "SEO Files", "Generated", "robots.txt, sitemap.xml")
    }

    Boundary(components, "UI Components") {
      Component(layout, "Layout Components", "Client + Server", "Header, Footer, MobileNav")
      Component(product_ui, "Product Components", "Client + Server", "ProductCard, ProductGrid, ProductFilters, ProductGallery, CollectionCard")
      Component(cart_ui, "Cart Components", "Client", "CartItemRow")
      Component(checkout_ui, "Checkout Components", "Client", "CheckoutForm (Stripe PaymentElement)")
      Component(analytics, "Analytics Tracker", "Client", "Consent-gated event batching via sendBeacon")
      Component(newsletter, "Newsletter Signup", "Client", "Feature-flagged email capture")
      Component(promo, "Promo Banner", "Client", "Dismissable announcement bar")
      Component(seo, "SEO / JsonLd", "Server", "Structured data injection")
      Component(ui_prims, "UI Primitives", "Client + Server", "Button, Badge, Icons, Container, SearchInput, ScrollToTop, ThemeToggle, CookieBanner")
    }

    Boundary(lib, "Library / Contexts") {
      Component(auth_ctx, "CustomerAuthProvider", "React Context", "Session state via GET /api/auth/me")
      Component(cart_ctx, "CartProvider", "React Context", "localStorage-backed cart state")
      Component(theme_ctx, "ThemeProvider", "React Context", "Light/dark/system theme with localStorage")
      Component(consent, "Consent Utilities", "Module", "localStorage consent + CustomEvent broadcast")
      Component(api_client, "API Client", "Module", "apiGet/apiPost wrappers around fetch")
      Component(stripe_init, "Stripe Init", "Module", "loadStripe singleton promise")
      Component(mock_data, "Mock Data", "Module", "Product/collection/order fixtures (12 products, 5 collections)")
      Component(geo, "Geo Data", "Module", "Countries, US states, CA provinces for checkout")
      Component(utils, "Utilities", "Module", "formatPrice, cn class helper")
    }
  }

  System_Ext(api_server, "API Server", "Fastify 5 / TypeScript")
  System_Ext(stripe, "Stripe", "Payment processing")

  Rel(caddy, home, "Proxies requests")

  Rel(home, promo, "Renders")
  Rel(home, newsletter, "Renders")
  Rel(home, product_ui, "Renders ProductGrid, CollectionCard")
  Rel(home, seo, "Injects Organization + WebSite JSON-LD")

  Rel(catalog, product_ui, "Renders ProductGrid, ProductFilters, ProductGallery")
  Rel(catalog, seo, "Injects Product + BreadcrumbList JSON-LD")
  Rel(catalog, cart_ctx, "AddToCartButton uses useCart()")

  Rel(collections, product_ui, "Renders CollectionCard, ProductGrid")
  Rel(collections, seo, "Injects CollectionPage JSON-LD")

  Rel(search, product_ui, "Renders ProductGrid")
  Rel(search, mock_data, "Calls searchProducts()")

  Rel(cart, cart_ui, "Renders CartItemRow")
  Rel(cart, cart_ctx, "Reads cart state via useCart()")

  Rel(checkout, checkout_ui, "Renders CheckoutForm")
  Rel(checkout, stripe_init, "Uses stripePromise for Elements provider")
  Rel(checkout, api_client, "POST create-payment-intent, GET checkout config")
  Rel(checkout, geo, "Populates address dropdowns")

  Rel(login, auth_ctx, "Reads/checks auth state")

  Rel(account, auth_ctx, "Auth-gated via AccountShell")
  Rel(account, api_client, "Fetches orders, tickets, downloads")

  Rel(static, api_client, "GET /api/pages for under-construction check")

  Rel(layout, auth_ctx, "Header/MobileNav show user state")
  Rel(layout, cart_ctx, "Header shows cart item count")
  Rel(layout, theme_ctx, "ThemeToggle calls toggleTheme()")
  Rel(layout, ui_prims, "Uses Container, Icons, SocialLinks, etc.")

  Rel(analytics, consent, "Checks consent before tracking")
  Rel(analytics, api_client, "POST /api/analytics/events via sendBeacon")

  Rel(newsletter, api_client, "GET settings, POST subscribe")
  Rel(promo, api_client, "GET /api/banner")

  Rel(auth_ctx, api_server, "GET /api/auth/me, POST /api/auth/logout")
  Rel(api_client, api_server, "All API calls")
  Rel(checkout_ui, stripe, "stripe.confirmPayment()")
  Rel(stripe_init, stripe, "loadStripe(publishableKey)")
  Rel(login, api_server, "OAuth redirect to /api/auth/customer/google")

  Rel(cart_ctx, mock_data, "Resolves productId to Product for totals")
  Rel(catalog, mock_data, "Product/collection data")
  Rel(collections, mock_data, "Collection data")
  Rel(seo_files, mock_data, "Product/collection/page slugs for sitemap")
```

### Simplified Data Flow

```
Browser
  |
  v
Caddy (port 80) --proxy--> Next.js (port 3000)
                               |
                   +-----------+-----------+
                   |                       |
            Server Components        Client Components
            (SSR / SSG / ISR)        (hydrated in browser)
                   |                       |
                   |              +--------+--------+
                   |              |        |        |
                   |         CartProvider  AuthProvider  ThemeProvider
                   |         (localStorage) (session cookie) (localStorage)
                   |              |        |
                   |              +--------+
                   |                  |
                   +------ fetch -----+----> API Server (port 3001)
                                      |
                                      +----> Stripe.js (external)
```

### Provider Nesting Order

The root layout nests three React context providers from outermost to innermost:

```
<ThemeProvider>
  <CartProvider>
    <CustomerAuthProvider>
      <Header />
      <main>{page content}</main>
      <Footer />
      <ScrollToTop />
      <Tracker />
      <CookieBanner />
    </CustomerAuthProvider>
  </CartProvider>
</ThemeProvider>
```

### Auth Gating

All `/account/*` routes are wrapped in `AccountShell`, which:
1. Reads `useCustomer()` to check `isAuthenticated`
2. Redirects to `/login` if the user is not authenticated after loading completes
3. Renders a sidebar (desktop) / tab bar (mobile) with navigation: Overview, Orders, Downloads, Support, Sign Out

### Robots Exclusion

Pages excluded from search engine indexing:
- `/cart`, `/checkout`, `/checkout/success` -- transactional pages
- `/account/*` -- private customer data
- `/login` -- authentication page
- `/search` -- `index: false, follow: true` (links followed, page not indexed)
- Static pages with `underConstruction` flag set dynamically get `noindex`

---

## 8. State Management Summary

| State Domain | Mechanism | Storage | Key |
|-------------|-----------|---------|-----|
| Theme preference | `ThemeProvider` React Context | `localStorage` | `pixelforge-theme` |
| Shopping cart | `CartProvider` React Context | `localStorage` | `pixelcart-cart` |
| Auth session | `CustomerAuthProvider` React Context | Server-side session cookie (checked via API) | -- |
| Cookie consent | `consent.ts` module functions | `localStorage` | `pixelforge-consent` |
| Analytics session | `Tracker` component | `sessionStorage` | `_a_sid` |
| Banner dismissal | `PromoBanner` component | `sessionStorage` | `banner-dismissed` |

No external state management library (Redux, Zustand, etc.) is used. All global state flows through React Context or module-level utilities communicating via `CustomEvent`.
