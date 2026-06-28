# C4 Code — storefront/src/app

## Overview

- **Name**: Storefront Next.js App Pages
- **Location**: `storefront/src/app/`
- **Primary Language**: TypeScript / React (Next.js 15 App Router)
- **Purpose**: All customer-facing pages using Next.js App Router conventions
- **Site Identity**: "PixelForge — Premium Digital Products" (brand name used throughout)

---

## Page Map

### `/` — Home Page

| Field | Value |
|---|---|
| File | `storefront/src/app/page.tsx` |
| Component | `HomePage` (async default export) |
| Rendering | Server Component |
| Key data fetching | `getServerBanner()` — fetches `${API_INTERNAL_URL}/banner` with `revalidate: 60`; `getFeaturedProducts()` and `getFeaturedCollections()` from `@/lib/mock-data` (synchronous) |
| Metadata | `openGraph.title`, `openGraph.description`, `alternates.canonical` set statically |

**Description**: The marketing home page. Renders a hero section with CTA buttons, a featured collections grid, a featured products grid, a newsletter signup section, and four trust-badge items (Instant Download, Secure Payments, Commercial License, Free Updates). Also injects `Organization` and `WebSite` JSON-LD structured data. The promotional banner is fetched server-side with a 60-second ISR revalidation window and passed to the `PromoBanner` client component as initial data.

---

### `/products` — All Products Listing

| Field | Value |
|---|---|
| File | `storefront/src/app/products/page.tsx` |
| Component | `ProductsPage` (sync default export) |
| Rendering | Server Component (shell); client island for filtering/sorting |
| Key data fetching | None at page level; delegated to `ProductListingGrid` |
| Metadata | `title: 'All Products'`, `description` set statically |

**Description**: The products catalog page. Renders a static heading shell and wraps `ProductFilters` (category/sort controls) and `ProductListingGrid` (the filtered result grid) inside a `<Suspense>` boundary. Both sub-components are Client Components that read URL search params.

---

### `/products` — Product Listing Grid (sub-component)

| Field | Value |
|---|---|
| File | `storefront/src/app/products/product-listing-grid.tsx` |
| Component | `ProductListingGrid` (named export) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `getProducts()` from `@/lib/mock-data` (synchronous, client-side) |

**Description**: Reads `category` and `sort` from URL search params via `useSearchParams()`. Filters the full product list by category, then sorts by price ascending/descending, popularity (review count), or newest (createdAt). Renders a count label and delegates display to `<ProductGrid>`.

---

### `/products/[slug]` — Product Detail Page

| Field | Value |
|---|---|
| File | `storefront/src/app/products/[slug]/page.tsx` |
| Component | `ProductDetailPage` (async default export) |
| Props | `{ params: Promise<{ slug: string }> }` |
| Rendering | Server Component |
| Key data fetching | `getProductBySlug(slug)` and `getRelatedProducts(product.id, 4)` from `@/lib/mock-data` (synchronous); `getProducts()` for static param generation |
| Static generation | `generateStaticParams()` — pre-renders all product slugs |
| Metadata | `generateMetadata()` — uses `product.seoTitle`, `product.seoDescription`, OG image from `product.images[0]`, canonical URL |

**Description**: Full product detail view. Renders breadcrumb nav, a two-column layout (image gallery + product info), file type/size metadata panel, an Add to Cart button (client island), product tags, a long description section, and a related products grid. Injects `Product` and `BreadcrumbList` JSON-LD structured data.

---

### `/products/[slug]` — Add to Cart Button (sub-component)

| Field | Value |
|---|---|
| File | `storefront/src/app/products/[slug]/add-to-cart-button.tsx` |
| Component | `AddToCartButton` (named export) |
| Props | `{ productId: string }` |
| Rendering | Client Component (`'use client'`) |

**Description**: Reads cart state via `useCart()` context. If the product is already in the cart, renders a "View in Cart" secondary button linking to `/cart`. Otherwise renders an "Add to Cart" primary button that calls `addItem(productId)`.

---

### `/collections` — Collections Index

| Field | Value |
|---|---|
| File | `storefront/src/app/collections/page.tsx` |
| Component | `CollectionsPage` (sync default export) |
| Rendering | Server Component |
| Key data fetching | `getCollections()` from `@/lib/mock-data` (synchronous) |
| Metadata | `title: 'Collections'`, `description` set statically |

**Description**: Lists all product collections as a responsive grid of `CollectionCard` components. No dynamic data fetching; sourced entirely from mock data.

---

### `/collections/[slug]` — Collection Detail Page

| Field | Value |
|---|---|
| File | `storefront/src/app/collections/[slug]/page.tsx` |
| Component | `CollectionDetailPage` (async default export) |
| Props | `{ params: Promise<{ slug: string }> }` |
| Rendering | Server Component |
| Key data fetching | `getCollectionBySlug(slug)` and `getCollectionProducts(collection.id)` from `@/lib/mock-data` (synchronous) |
| Static generation | `generateStaticParams()` — pre-renders all collection slugs |
| Metadata | `generateMetadata()` — uses `collection.seoTitle`, `collection.seoDescription`, OG image, canonical URL |

**Description**: Collection detail view with a full-width hero image (Next.js `<Image>` with fill/priority, gradient overlay), collection name and description, and a product count + product grid below. Injects `CollectionPage` JSON-LD structured data.

---

### `/cart` — Shopping Cart

| Field | Value |
|---|---|
| File | `storefront/src/app/cart/page.tsx` |
| Component | `CartPage` (default export) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | Cart state read from `useCart()` context (no network calls) |

**Description**: Displays the current cart. Empty-cart state shows a centered icon + "Browse Products" CTA. Populated cart renders a list of `CartItemRow` components plus an order summary panel with item count, total price, a Checkout button linking to `/checkout`, a Continue Shopping link, and a Clear Cart control.

---

### `/checkout` — Checkout Page

| Field | Value |
|---|---|
| File | `storefront/src/app/checkout/page.tsx` |
| Component | `CheckoutPage` (default export) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `GET /api/checkout/config` — fetches `taxEnabled` flag on mount; `POST /api/checkout/create-payment-intent` — creates Stripe payment intent with cart items, email, and optional billing address |
| External dependencies | `@stripe/react-stripe-js` (`Elements`, `stripePromise`) |

**Description**: Two-phase checkout flow. Phase 1: email input form (plus optional billing address fields — country, state, ZIP — when tax is enabled). On submit, POSTs to `/api/checkout/create-payment-intent` to receive a Stripe `clientSecret`, `orderId`, `orderToken`, subtotal, tax, and grand total. Phase 2: mounts the Stripe `<Elements>` provider with the `clientSecret` and renders `<CheckoutForm>` for card entry. Tax calculation is delegated to the API. Geographic data (countries, US states, Canadian provinces) comes from `@/lib/geo-data`.

---

### `/checkout/success` — Order Confirmation Page

| Field | Value |
|---|---|
| File | `storefront/src/app/checkout/success/page.tsx` |
| Component | `CheckoutSuccessPage` / `CheckoutSuccessContent` (default export + inner function) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `GET /api/checkout/order/{orderId}?token={orderToken}` — polled up to 15 times at 2-second intervals until order status is no longer `'pending'` |

**Description**: Post-payment confirmation page. Reads `order_id` and `order_token` from URL search params. Clears the cart on first mount. Polls the order API until the payment webhook has been processed (max 30 seconds). Shows loading skeleton, a "still processing" fallback, or (on success) a thank-you panel with order number, confirmation email address, itemized order details (with optional tax breakdown), and time-limited download links (expire in 7 days). Error states are displayed if no order ID is provided or the API fails.

---

### `/search` — Search Page

| Field | Value |
|---|---|
| File | `storefront/src/app/search/page.tsx` |
| Component | `SearchPage` (sync default export) |
| Rendering | Server Component (shell); client island for results |
| Key data fetching | Delegated to `SearchClient` |
| Metadata | `title: 'Search Products'`, `robots: { index: false, follow: true }` |

**Description**: Static shell that renders a heading and delegates all interactive behavior to `<SearchClient>`. Not indexed by search engines.

---

### `/search` — Search Client (sub-component)

| Field | Value |
|---|---|
| File | `storefront/src/app/search/search-client.tsx` |
| Component | `SearchClient` (named export) / `SearchResults` (inner function) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `searchProducts(query)` or `getProducts()` from `@/lib/mock-data` (synchronous, client-side) |

**Description**: Renders a `<SearchInput>` component and a `<SearchResults>` panel inside a `<Suspense>` boundary. `SearchResults` reads the `q` search param; if present, calls `searchProducts(query)` for filtered results, otherwise shows all products. Displays result count and delegates display to `<ProductGrid>`.

---

### `/login` — Login Page

| Field | Value |
|---|---|
| File | `storefront/src/app/login/page.tsx` |
| Component | `LoginPage` (default export) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | Auth state from `useCustomer()` context; `POST /api/auth/dev-login` for development test login |
| Robots | Blocked via `login/layout.tsx` (`robots: { index: false, follow: false }`) |

**Description**: Customer authentication entry point. Reads auth state from `CustomerAuthProvider` context. If already authenticated, redirects to `/account`. Otherwise renders a card with: a "Continue with Google" OAuth button (links to `/api/auth/customer/google`), a "Sign up with Google" button (same OAuth endpoint), and a "Dev Login" button that POSTs to `/api/auth/dev-login` with a test customer email. Displays URL `?error` param as a human-readable message (supports: `oauth_denied`, `oauth_failed`, `no_email`, `rate_limited`). Shows privacy policy and terms of service links.

---

### `/account` — Account Overview

| Field | Value |
|---|---|
| File | `storefront/src/app/account/page.tsx` |
| Component | `AccountPage` (default export) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `getCustomerOrders()` and `getCustomerPurchasedProducts()` from `@/lib/mock-data` (synchronous); user from `useCustomer()` context |

**Description**: Account dashboard overview. Displays three stat cards (Total Orders count, Downloads count, Support Tickets placeholder "—"), each linking to their respective sub-sections. Below shows the 3 most recent orders in a table with order number, date, item count, total price, and color-coded status badge (green=completed, yellow=processing, red=other).

---

### `/account/orders` — Order History

| Field | Value |
|---|---|
| File | `storefront/src/app/account/orders/page.tsx` |
| Component | `OrdersPage` (default export) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `getCustomerOrders()` from `@/lib/mock-data` (synchronous) |

**Description**: Full order history list. Empty state shows a prompt to browse products. Populated state renders all orders as clickable rows linking to `/account/orders/[id]`, each showing order number, status badge, date, product names, total price, and payment method.

---

### `/account/orders/[id]` — Order Detail

| Field | Value |
|---|---|
| File | `storefront/src/app/account/orders/[id]/page.tsx` |
| Component | `OrderDetailPage` (default export) |
| Props | `{ params: Promise<{ id: string }> }` (resolved via React `use()`) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `getCustomerOrderById(id)` and `getProducts()` from `@/lib/mock-data` (synchronous) |

**Description**: Single order detail view. Shows back link, order number, date, status badge, a line-items table (product thumbnail, name, file type/size, price, Download button when order is completed), a payment summary panel (subtotal, tax hardcoded to $0.00, total, payment method), and a "Download Invoice" button that triggers `window.print()`.

---

### `/account/downloads` — Downloads Library

| Field | Value |
|---|---|
| File | `storefront/src/app/account/downloads/page.tsx` |
| Component | `DownloadsPage` (default export) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `getCustomerPurchasedProducts()` from `@/lib/mock-data` (synchronous) |

**Description**: Grid of all purchased products available for download. Empty state shows a "Browse products" link. Each product card shows a cover image, product name (links to product detail page), file type, file size, and a Download button (button is present but download action is not wired to an API call in the current implementation).

---

### `/account/support` — Support Ticket List

| Field | Value |
|---|---|
| File | `storefront/src/app/account/support/page.tsx` |
| Component | `SupportPage` (default export) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `GET /api/support/tickets` (with `credentials: 'include'`) — fetched on mount |

**Description**: Lists the authenticated customer's support tickets. Shows a loading skeleton (3 animated placeholder rows), an empty state with a "Create your first ticket" CTA, or a list of tickets showing subject, ticket ID, creation date, and a color-coded status badge (blue=open, yellow=in_progress, green=resolved, grey=closed). Each row links to `/account/support/[id]`. A "New Ticket" button in the header links to `/account/support/new`.

---

### `/account/support/[id]` — Ticket Detail / Thread View

| Field | Value |
|---|---|
| File | `storefront/src/app/account/support/[id]/page.tsx` |
| Component | `TicketDetailPage` (default export) |
| Props | `{ params: Promise<{ id: string }> }` (resolved via React `use()`) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `GET /api/support/tickets/{id}` (with `credentials: 'include'`) on mount; `POST /api/support/tickets/{id}/messages` for reply submission |

**Description**: Conversational ticket detail view. Loads ticket metadata and full message thread on mount. Renders a loading skeleton and a "not found" fallback. Message thread shows each message as a styled chat bubble, differentiated by sender role: customer messages aligned left with surface background, admin/support messages aligned right with accent tint. Displays sender name, a role badge ("Support" or "You"), and timestamp. Below the thread, a reply textarea form (max 5000 chars) submits new messages via POST and optimistically appends the reply to local state. Reply form is hidden and replaced with a closed-ticket notice when `ticket.status === 'closed'`.

---

### `/account/support/new` — New Support Ticket

| Field | Value |
|---|---|
| File | `storefront/src/app/account/support/new/page.tsx` |
| Component | `NewTicketPage` (default export) |
| Rendering | Client Component (`'use client'`) |
| Key data fetching | `POST /api/support/tickets` (with `credentials: 'include'`) on form submit |

**Description**: Form for creating a new support ticket. Fields: Subject (text input, max 500 chars, required), Priority (select: low/medium/high, defaults to medium), Message (textarea, max 5000 chars, required). On successful submission, receives a ticket `id` from the API and redirects to `/account/support/[id]` via `useRouter().push()`. Displays an error banner on failure. Submit button is disabled while submitting or when required fields are empty.

---

### `/[slug]` — Static Content Pages (Legal / Marketing)

| Field | Value |
|---|---|
| File | `storefront/src/app/[slug]/page.tsx` |
| Component | `StaticContentPage` (async default export) |
| Props | `{ params: Promise<{ slug: string }> }` |
| Rendering | Server Component (`dynamic = 'force-dynamic'`) |
| Key data fetching | `GET ${API_INTERNAL_URL}/api/pages` — checks `underConstruction` flag per-slug; reads `.txt` files from `content/legal/` directory on disk using Node.js `fs.readFileSync` |
| Static generation | `generateStaticParams()` — uses `getStaticPages()` from mock-data |

**Description**: Catch-all route for static content pages (privacy policy, terms of service, etc.). On each request: (1) checks if the slug matches a known static page via `getStaticPage(slug)`, 404s otherwise; (2) calls the internal API to check if the page is marked "under construction" (renders `<UnderConstruction>` component if so, with `robots: { index: false }`); (3) attempts to load a plain-text file from `content/legal/{slug}.txt` and converts it to HTML using a custom text-to-HTML parser (`legalTextToHtml`); (4) falls back to `page.content` from mock data, or shows `<UnderConstruction>` if no content exists. The text-to-HTML parser handles: `SECTION N` headings → `<h2>`, `§X.Y` subsections → `<p><strong>`, `Effective Date:`/`Last Updated:` → labeled paragraphs, `Email:`/`Website:` → bold-labeled paragraphs, link patterns (`text (/path)`) → `<a href>`, and plain text → `<p>`. Content is rendered via `dangerouslySetInnerHTML` with HTML-escaped source content.

---

## Layout Files

### Root Layout — `storefront/src/app/layout.tsx`

- **Component**: `RootLayout`
- **Rendering**: Server Component
- **Font**: `Plus_Jakarta_Sans` loaded from `next/font/google` with CSS variable `--font-jakarta`
- **Theme**: Inline `<script>` in `<head>` reads `localStorage['pixelforge-theme']` and sets `document.documentElement.classList.add('dark')` before hydration to prevent FOUC
- **Viewport**: `themeColor` configured for light (`#fffbf5`) and dark (`#1c1917`) media queries
- **Global metadata**: site title template (`%s | PixelForge`), description, OpenGraph (`siteName`, `og:image`), Twitter card, robots (`index: true, follow: true`), favicons (`/favicon.svg`, `/apple-touch-icon.png`)
- **Provider tree** (outermost to innermost):
  1. `<ThemeProvider>` — dark/light mode context
  2. `<CartProvider>` — shopping cart context (localStorage-backed)
  3. `<CustomerAuthProvider>` — customer auth session context
- **Layout structure**: `<Header />` + `<main>` (content) + `<Footer />` + `<ScrollToTop />` + `<Tracker />` + `<CookieBanner />`

### Account Layout — `storefront/src/app/account/layout.tsx`

- Wraps all `/account/*` routes in `<AccountShell>` (Client Component)
- Sets `robots: { index: false, follow: false }` to block search engine indexing of all account pages

### Account Shell — `storefront/src/app/account/AccountShell.tsx`

- **Component**: `AccountShell` (named export, `'use client'`)
- **Auth guard**: Uses `useCustomer()` hook; redirects to `/login` if not authenticated after loading completes
- **Layout**: Responsive sidebar (desktop) / horizontal tab bar (mobile) with four nav items: Overview, Orders, Downloads, Support, plus Sign Out button
- Navigation uses `usePathname()` for active state detection with exact/prefix matching

### Cart Layout — `storefront/src/app/cart/layout.tsx`

- Pass-through layout (renders `children` directly)
- Sets `robots: { index: false, follow: false }`

### Checkout Layout — `storefront/src/app/checkout/layout.tsx`

- Pass-through layout (renders `children` directly)
- Sets `robots: { index: false, follow: false }`

### Login Layout — `storefront/src/app/login/layout.tsx`

- Pass-through layout (renders `children` directly)
- Sets `robots: { index: false, follow: false }`

---

## Special Files

### `storefront/src/app/not-found.tsx`

- **Component**: `NotFound` (default export, Server Component)
- Renders a centered "404" gradient heading with a "Back to Home" button
- Activated automatically by Next.js when `notFound()` is called from any route or when no matching route is found

### `storefront/src/app/robots.ts`

- **Export**: `robots()` function returning `MetadataRoute.Robots`
- **Rules**: Allows all crawlers to index `/` but disallows: `/cart`, `/checkout`, `/account`, `/login`, `/api`, `/search`
- **Sitemap**: Points to `${SITE_URL}/sitemap.xml`

### `storefront/src/app/sitemap.ts`

- **Export**: `sitemap()` function returning `MetadataRoute.Sitemap`
- **Data sources**: `getProducts()`, `getCollections()`, `getStaticPages()` all from `@/lib/mock-data`
- **Entries generated**:
  - `/` (priority 1.0, daily)
  - `/products` (priority 0.9, daily)
  - `/collections` (priority 0.7, weekly)
  - `/products/{slug}` for each product (priority 0.8, weekly, `lastModified` from `product.createdAt`)
  - `/collections/{slug}` for each collection (priority 0.7, weekly)
  - `/{slug}` for each static page (priority 0.5, monthly)

### `storefront/src/app/globals.css`

- Tailwind base/components/utilities directives
- CSS custom properties on `:root` (light theme) and `.dark` for the full color palette:
  - Primary, accent (`#D97706` amber), background, surface, border, muted, destructive, noir (dark panel) variants
- Custom utilities: `.text-gradient` (amber diagonal gradient as text fill), `.bg-grain` (SVG noise texture pseudo-element), `.bg-dots` (radial dot pattern)
- `.theme-transitioning` class enables smooth color transitions during theme switches (0.3s background, 0.2s color, 0.3s border)
- `@keyframes slideDown` animation for the promo banner

---

## Dependencies

### Internal (`@/` alias = `storefront/src/`)

| Import path | Used by |
|---|---|
| `@/components/layout/Header` | `layout.tsx` |
| `@/components/layout/Footer` | `layout.tsx` |
| `@/components/analytics/Tracker` | `layout.tsx` |
| `@/components/ui/ScrollToTop` | `layout.tsx` |
| `@/components/ui/CookieBanner` | `layout.tsx` |
| `@/components/ui/Container` | Most pages |
| `@/components/ui/Button` | Most pages |
| `@/components/ui/Badge` | `products/[slug]/page.tsx` |
| `@/components/ui/Icons` | Multiple pages |
| `@/components/ui/SearchInput` | `search/search-client.tsx` |
| `@/components/ui/UnderConstruction` | `[slug]/page.tsx` |
| `@/components/product/ProductGrid` | `page.tsx`, `products/page.tsx`, `collections/[slug]/page.tsx`, `search/search-client.tsx` |
| `@/components/product/CollectionCard` | `page.tsx`, `collections/page.tsx` |
| `@/components/product/ProductFilters` | `products/page.tsx` |
| `@/components/product/ProductGallery` | `products/[slug]/page.tsx` |
| `@/components/checkout/CheckoutForm` | `checkout/page.tsx` |
| `@/components/promo/PromoBanner` | `page.tsx` |
| `@/components/newsletter/NewsletterSignup` | `page.tsx` |
| `@/components/seo/JsonLd` | `page.tsx`, `products/[slug]/page.tsx`, `collections/[slug]/page.tsx` |
| `@/lib/cart-context` | `layout.tsx`, `cart/page.tsx`, `checkout/page.tsx`, `checkout/success/page.tsx`, `products/[slug]/add-to-cart-button.tsx` |
| `@/lib/auth-context` | `layout.tsx`, `login/page.tsx`, `account/AccountShell.tsx`, `account/page.tsx`, `account/support/[id]/page.tsx` |
| `@/lib/theme-context` | `layout.tsx` |
| `@/lib/mock-data` | `page.tsx`, `products/page.tsx`, `products/[slug]/page.tsx`, `products/product-listing-grid.tsx`, `collections/page.tsx`, `collections/[slug]/page.tsx`, `account/page.tsx`, `account/orders/page.tsx`, `account/orders/[id]/page.tsx`, `account/downloads/page.tsx`, `search/search-client.tsx`, `sitemap.ts`, `[slug]/page.tsx` |
| `@/lib/utils` | Multiple pages (`formatPrice`, `cn`) |
| `@/lib/stripe` | `checkout/page.tsx` |
| `@/lib/api` | `checkout/page.tsx`, `checkout/success/page.tsx` |
| `@/lib/geo-data` | `checkout/page.tsx` |

### External

| Package | Used by | Purpose |
|---|---|---|
| `next` | All files | App Router, Image, Link, navigation hooks, Metadata types |
| `next/font/google` | `layout.tsx` | Plus Jakarta Sans font loading |
| `react` | Client Components | Hooks: `useState`, `useEffect`, `useCallback`, `useRef`, `use` |
| `@stripe/react-stripe-js` | `checkout/page.tsx` | `Elements` provider, `stripePromise` |
| `node:fs` | `[slug]/page.tsx` | `readFileSync`, `existsSync` for reading legal `.txt` files |
| `node:path` | `[slug]/page.tsx` | `join` for constructing file paths |

---

## Route Summary

```
/                              Server Component   Home (marketing + featured products)
/products                      Server + Client    All products with filter/sort
/products/[slug]               Server Component   Product detail (SSG)
/collections                   Server Component   Collections index
/collections/[slug]            Server Component   Collection detail (SSG)
/cart                          Client Component   Shopping cart
/checkout                      Client Component   Stripe checkout (2-phase)
/checkout/success              Client Component   Order confirmation with download links
/search                        Server + Client    Product search
/login                         Client Component   Google OAuth + dev login
/account                       Client Component   Account dashboard overview  [auth-gated]
/account/orders                Client Component   Order history list           [auth-gated]
/account/orders/[id]           Client Component   Order detail + download      [auth-gated]
/account/downloads             Client Component   Purchased product downloads  [auth-gated]
/account/support               Client Component   Support ticket list          [auth-gated]
/account/support/[id]          Client Component   Ticket thread + reply        [auth-gated]
/account/support/new           Client Component   New support ticket form      [auth-gated]
/[slug]                        Server Component   Static/legal pages (SSG)
```

### Auth Gating Pattern

All `/account/*` routes are guarded by `AccountShell` (Client Component in `account/layout.tsx`). On mount, `AccountShell` checks `useCustomer().isAuthenticated`; if false after loading, it calls `router.replace('/login')` and renders null. The layout also sets `robots: noindex` to prevent crawling of private pages.

### Robots Exclusion Summary

Pages excluded from search engine indexing:
- `/cart`, `/checkout`, `/checkout/success` — transactional pages
- `/account/*` — private customer data
- `/login` — authentication page
- `/search` — `index: false, follow: true` (links followed but page not indexed)

Statically constructed pages that respect `underConstruction` API flag also set `robots: { index: false, follow: false }` dynamically.
