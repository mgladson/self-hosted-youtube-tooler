# C4 Code — storefront/src/components

## Overview

- **Name**: Storefront UI Components
- **Location**: `storefront/src/components/`
- **Primary Language**: TypeScript / React (Next.js 15 App Router)
- **Purpose**: Reusable UI components for the customer-facing storefront. Covers page layout, product browsing, the checkout flow, analytics instrumentation, consent management, SEO metadata injection, promotional content, and assorted UI primitives.

---

## Component Groups

### layout/

---

#### `Header`

**File**: `storefront/src/components/layout/Header.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**: None (self-contained).

**Description**: Sticky top navigation bar rendered on every page. Contains the PixelForge logo (links to `/`), a desktop nav with links to `/products` and `/collections`, and a right-side action cluster. The action cluster includes: `SocialLinks` (desktop only), a search icon link to `/search`, `ThemeToggle`, a cart icon link to `/cart`, and a user avatar/login button. The user button conditionally renders based on auth state: if authenticated it shows the first character of the user's name or email in an accent-coloured circle linking to `/account`; if unauthenticated it shows a `User` icon linking to `/login`. A `MobileNav` drawer is always rendered (hidden on md+ screens).

**Auth context consumed**: `useCustomer()` — reads `user` and `loading`.

**Key interactions**:
- Logo click — navigates to `/`
- Products / Collections nav links — client-side navigation
- Cart icon — navigates to `/cart`
- User avatar — navigates to `/account`
- Login icon — navigates to `/login`
- No API calls; auth state is provided by `AuthContext`.

---

#### `Footer`

**File**: `storefront/src/components/layout/Footer.tsx:1`
**Type**: Server Component (no `'use client'` directive).

**Props**: None.

**Description**: Full-width footer rendered below page content. Displays the PixelForge brand mark and tagline, then three link columns — **Shop** (`/products`, `/collections`, `/search`), **Support** (`/faq`, `/contact`, `/docs`), and **Legal** (`/about`, `/terms-of-service`, `/privacy-policy`, `/refund-policy`). A `CookiePreferencesButton` is injected at the end of the Legal column. A bottom bar shows copyright year (dynamically evaluated at render time via `new Date().getFullYear()`) and `SocialLinks`.

**No API calls or context consumed.**

---

#### `MobileNav`

**File**: `storefront/src/components/layout/MobileNav.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**: None.

**State**:
- `open: boolean` — controls drawer visibility.

**Description**: A hamburger menu button visible only on screens narrower than `md`. When clicked, renders a full-screen overlay with a slide-in drawer from the left. The drawer lists nav links (Products, Collections, Search, Cart). Below a divider, if the user is authenticated it shows links to `/account` and a sign-out button (calls `logout()` from `AuthContext`); otherwise a Sign In link to `/login`. Clicking any link or the backdrop closes the drawer.

**Auth context consumed**: `useCustomer()` — reads `user`, `isAuthenticated`, and `logout`.

**Key interactions**:
- Hamburger button toggles `open` state.
- Backdrop click closes drawer.
- Sign Out button calls `logout()` (triggers API call inside AuthContext) and closes drawer.

---

### cart/

---

#### `CartItemRow`

**File**: `storefront/src/components/cart/CartItem.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**:
```ts
{ product: Product & { quantity: number } }
```
Where `Product` is imported from `@/lib/mock-data`.

**Description**: Renders a single line item in the cart. Displays a fixed-size product thumbnail (`next/image`, 96 px wide), the product name, file type label, formatted price (via `formatPrice`), and a trash-icon remove button. Calls `removeItem(product.id)` from `CartContext` on remove click.

**Context consumed**: `useCart()` — reads `removeItem`.

**Key interactions**:
- Trash button — calls `removeItem(product.id)`.

---

### checkout/

---

#### `CheckoutForm`

**File**: `storefront/src/components/checkout/CheckoutForm.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**:
```ts
{
  orderId: string;
  orderToken: string;
  email: string;
}
```

**State**:
- `error: string` — Stripe error message.
- `processing: boolean` — disables submit button during in-flight payment.

**Description**: Wraps Stripe's hosted `PaymentElement` in a `<form>`. On submission calls `stripe.confirmPayment()` with a return URL of `{origin}/checkout/success?order_id={orderId}&order_token={orderToken}` and sets `receipt_email` to the provided `email` prop. On error, renders a destructive-coloured error paragraph. Renders a "Pay Now" / "Processing payment..." button that is disabled while `!stripe`, `!elements`, or `processing` is true. Must be a descendant of a Stripe `Elements` provider (set up by the parent checkout page).

**External APIs**: `stripe.confirmPayment()` — Stripe.js SDK call; redirects browser on success.

**Key interactions**:
- Form submit — triggers Stripe payment confirmation.

---

### product/

---

#### `ProductCard`

**File**: `storefront/src/components/product/ProductCard.tsx:1`
**Type**: Server Component (no `'use client'` directive).

**Props**:
```ts
{ product: Product }
```
Where `Product` is imported from `@/lib/mock-data`.

**Description**: A fully linked card (`<Link href="/products/{product.slug}">`) that serves as the primary browsing unit. Renders a 3:2-ratio `next/image` with hover scale transition, a `Badge` showing `product.fileType` (top-right), and a "Sale" `Badge` (top-left) when `product.compareAtPrice` is present. Below the image: category label in accent colour, product name (truncated to 2 lines, turns accent on hover), price with optional crossed-out compare-at price, and a star rating row using `formatPrice` and the `Star` icon.

**No API calls or context consumed.**

---

#### `ProductGrid`

**File**: `storefront/src/components/product/ProductGrid.tsx:1`
**Type**: Server Component.

**Props**:
```ts
{ products: Product[] }
```

**Description**: Renders a responsive CSS grid of `ProductCard` components. Columns: 1 (mobile) → 2 (sm) → 3 (lg) → 4 (xl). When `products` is empty, shows a centred "No products found." message instead.

**No API calls or context consumed.**

---

#### `ProductFilters`

**File**: `storefront/src/components/product/ProductFilters.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**: None (reads from URL search params directly).

**Description**: Provides category pill buttons and a sort dropdown for the `/products` listing page. Reads `category` and `sort` URL params via `useSearchParams()`. Category list is derived at render time from `getCategories()` (`@/lib/mock-data`) prepended with "All". Clicking a category pill or changing the sort dropdown calls `updateParams()`, which rewrites the URL via `router.push()`. Default values (`all` / `newest`) are removed from the URL to keep it clean.

**Key interactions**:
- Category pill click — updates `?category=` param and pushes new URL.
- Sort `<select>` change — updates `?sort=` param and pushes new URL.

---

#### `ProductGallery`

**File**: `storefront/src/components/product/ProductGallery.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**:
```ts
{ images: string[]; alt: string }
```

**State**:
- `selected: number` — index of the currently displayed main image (default `0`).

**Description**: Image gallery for the product detail page. Renders the selected image at 4:3 aspect ratio with `priority` loading. If more than one image is provided, renders a horizontal row of 80 px thumbnail buttons. The active thumbnail is highlighted with a 2px accent ring; inactive thumbnails are 50% opacity with a hover to 80%. Clicking a thumbnail sets `selected` to that index.

**Key interactions**:
- Thumbnail button click — updates `selected` state, swaps main image.

---

#### `CollectionCard`

**File**: `storefront/src/components/product/CollectionCard.tsx:1`
**Type**: Server Component.

**Props**:
```ts
{ collection: Collection }
```
Where `Collection` is imported from `@/lib/mock-data`.

**Description**: Full-bleed 16:9 image card with a gradient overlay, linking to `/collections/{collection.slug}`. Overlays the collection name and product count (pluralised) at the bottom. Image zooms subtly on hover via `group-hover:scale-105`.

**No API calls or context consumed.**

---

### analytics/

---

#### `Tracker`

**File**: `storefront/src/components/analytics/Tracker.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**: None. Renders `null` (invisible instrumentation component).

**Internal types**:
```ts
type TrackerEvent = {
  type: string;
  sessionId: string;
  path: string;
  timestamp: number;
  data: Record<string, unknown>;
};
```

**Description**: Self-contained behavioural analytics instrumentation. Fires only when the user has granted analytics consent (reads `pixelforge-consent` from `localStorage`; also respects `navigator.doNotTrack === '1'`). Listens for the custom `pixelforge:consent-change` window event to update consent state at runtime.

Tracked event types:
- `page_view` — fired on every route change via `usePathname()`. Captures `referrer`, `viewport_width`, `viewport_height`.
- `page_exit` — fired before route change and on `beforeunload`. Captures `time_on_page_ms` and `max_scroll_depth_pct`.
- `scroll_depth` — fired at 25 %, 50 %, 75 %, and 100 % scroll thresholds within `<main>`. Captures `depth_pct` and `time_to_depth_ms`.
- `click` — delegated click listener on `<main>` matching `a`, `button`, `[role="button"]`, `[data-track]`. Captures `tag`, `text` (first 100 chars), `href`, `data_track`.
- `element_visibility` — `IntersectionObserver` on direct children of `<main>` that are `<section>` elements or carry `[data-track]`. Records `visible_duration_ms` using a per-element timer.

Events are batched in a `useRef` array and flushed every 10 seconds via `setInterval`, and on page unload. Flushing uses `navigator.sendBeacon` with a JSON `Blob` to `POST /api/analytics/events`, falling back to `fetch(..., { keepalive: true })`.

Session IDs are persisted in `sessionStorage` under `_a_sid` and generated with `crypto.randomUUID()`.

**API calls**:
- `POST /api/analytics/events` — batch of `TrackerEvent[]` wrapped in `{ events: [...] }`. Uses `sendBeacon` or `fetch` with `keepalive`.

---

### newsletter/

---

#### `NewsletterSignup`

**File**: `storefront/src/components/newsletter/NewsletterSignup.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**: None.

**State**:
- `enabled: boolean` — whether the newsletter feature is active (fetched from API on mount).
- `email: string` — controlled input value.
- `status: 'idle' | 'loading' | 'success' | 'error'`
- `message: string` — success or error message from API.

**Description**: Feature-flagged newsletter capture section. On mount, fetches `GET /api/newsletter/settings`; renders `null` unless `data.enabled === true`. When enabled, renders a full-width dark section with headline copy, a controlled email input, and a subscribe button. On success, replaces the form with a confirmation badge showing the API's `data.message`. On error, shows a red error message below the form. Resetting the error state occurs when the user edits the email field.

**API calls**:
- `GET /api/newsletter/settings` — checks if newsletter is enabled.
- `POST /api/newsletter/subscribe` — body `{ email: string }`. Returns `{ message }` on success or `{ error }` on failure.

---

### promo/

---

#### `PromoBanner`

**File**: `storefront/src/components/promo/PromoBanner.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**:
```ts
{ initialData?: BannerData }
```

**Exported type**:
```ts
type BannerData = {
  active: boolean;
  text: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  updatedAt: string;
}
```

**State**:
- `banner: BannerData | null`
- `dismissed: boolean`
- `imgError: boolean` — suppresses the optional image if it fails to load.

**Description**: Renders a top-of-page accent-coloured announcement bar. Accepts optional `initialData` for server-side pre-population; if not provided, fetches `GET /api/banner` on mount. Banner is shown only when `active === true` and `text` is non-empty. Dismissal is persisted to `sessionStorage` under `banner-dismissed` keyed by the banner's `updatedAt` timestamp — a new `updatedAt` from the server will show the banner again. Optional image (16×16 display), text, optional linked CTA, and a dismiss (×) button are rendered inside a `Container`.

**API calls**:
- `GET /api/banner` — fetches `BannerData` (only when `initialData` is not provided).

**Key interactions**:
- Dismiss button — sets `dismissed` state and writes `sessionStorage`.
- Optional CTA link — standard `<a>` element navigating to `banner.linkUrl`.

---

### seo/

---

#### `JsonLd` (component + factory functions)

**File**: `storefront/src/components/seo/JsonLd.tsx:1`
**Type**: Server Component.

**Props** (component):
```ts
{ data: Record<string, unknown> }
```

**Description**: Renders a `<script type="application/ld+json">` tag using `dangerouslySetInnerHTML` with the serialised `data` object. Used to inject structured data into the `<head>` or body of a page.

**Exported factory functions** (pure, no props):

| Function | Schema.org Type | Description |
|---|---|---|
| `productJsonLd(product, siteUrl)` | `Product` | Generates Product schema including `offers`, `aggregateRating` (omitted when `reviewCount === 0`), brand, and category. Price is converted from cents to dollars. |
| `organizationJsonLd(siteUrl)` | `Organization` | Organization schema with name, URL, logo, and description. `sameAs` is an empty array (to be populated via config). |
| `webSiteJsonLd(siteUrl)` | `WebSite` | WebSite schema with a `SearchAction` pointing to `/search?q={search_term_string}`. |
| `breadcrumbJsonLd(items)` | `BreadcrumbList` | Accepts `{ name, url }[]` and maps to `ListItem` array. |
| `collectionJsonLd(collection, siteUrl)` | `CollectionPage` | Collection schema with SEO title/description fallbacks and image. |

**No API calls or context consumed.**

---

### ui/

---

#### `Container`

**File**: `storefront/src/components/ui/Container.tsx:1`
**Type**: Server Component.

**Props**:
```ts
{ children: React.ReactNode; className?: string }
```

**Description**: Layout wrapper that constrains content to a `max-w-7xl` centred column with responsive horizontal padding (`px-4 sm:px-6 lg:px-8`). Used throughout layout components (`Header`, `Footer`, `PromoBanner`). Accepts an optional `className` merged via `cn()`.

---

#### `Badge`

**File**: `storefront/src/components/ui/Badge.tsx:1`
**Type**: Server Component.

**Props**:
```ts
{
  variant?: 'default' | 'accent' | 'sale';
  children: React.ReactNode;
  className?: string;
}
```

**Description**: Small rounded-full pill label. Three visual variants:
- `default` — surface background, muted text, standard border.
- `accent` — accent-tinted background, accent text, accent border.
- `sale` — destructive-tinted background, destructive text, destructive border.

Used by `ProductCard` to display file type and sale status.

---

#### `Button`

**File**: `storefront/src/components/ui/Button.tsx:1`
**Type**: Server Component (no hooks; passes through `ButtonHTMLAttributes`).

**Props**:
```ts
{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  children: React.ReactNode;
  className?: string;
  // ...plus all HTMLButtonElement attributes except className
}
```

**Description**: Unified button/link primitive. When `href` is provided renders a `next/link`; otherwise a `<button>`. Five visual variants (`primary`, `secondary`, `outline`, `ghost`, `dark`) and three sizes (`sm`, `md`, `lg`) are composed via `cn()`. Includes accessible focus ring and disabled state styling.

---

#### `Icons`

**File**: `storefront/src/components/ui/Icons.tsx:1`
**Type**: Server Component (pure SVG renderers).

**Shared props interface**:
```ts
type IconProps = { size?: number; className?: string }
```

**Exported icons**:

| Name | Description |
|---|---|
| `ShoppingCart` | Cart bag outline |
| `Search` | Magnifying glass |
| `Menu` | Hamburger (3 lines) |
| `X` | Close / dismiss (×) |
| `Star` | Filled star for ratings |
| `Download` | Arrow-down-to-tray |
| `Lock` | Padlock |
| `CheckCircle` | Checkmark inside circle |
| `RefreshCw` | Circular refresh arrows |
| `ChevronRight` | Right-pointing chevron |
| `ArrowLeft` | Left arrow with stem |
| `Trash` | Trash bin |
| `User` | Person silhouette |
| `LogOut` | Door with arrow |
| `Package` | 3D box |
| `MessageCircle` | Speech bubble |
| `FileText` | Document with lines |
| `Headphones` | Support headphones |
| `BrandX` | X (Twitter) logo (filled) |
| `BrandDiscord` | Discord logo (filled) |
| `BrandLinkedIn` | LinkedIn logo (filled) |
| `BrandGitHub` | GitHub Octocat logo (filled) |

All icons are inline SVGs using `stroke="currentColor"` (or `fill="currentColor"` for brand logos), making them colour-inheritable via Tailwind text utilities.

---

#### `SearchInput`

**File**: `storefront/src/components/ui/SearchInput.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**:
```ts
{
  defaultValue?: string;   // default: ''
  placeholder?: string;    // default: 'Search products...'
  className?: string;
}
```

**State**:
- `query: string` — controlled input value initialised from `defaultValue`.

**Description**: Rounded search field with a magnifying-glass icon inset on the left. On form submit (Enter or button), navigates to `/search?q={encoded query}` via `router.push()`. Does not navigate if the query is blank.

**Key interactions**:
- Form submit — pushes `/search?q=...` route.

---

#### `ScrollToTop`

**File**: `storefront/src/components/ui/ScrollToTop.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**: None.

**State**:
- `visible: boolean` — true when `window.scrollY > 300`.

**Description**: Fixed-position circular button pinned to the bottom-right corner of the viewport (`bottom-5 right-5`, `z-[9999]`). Appears (opacity 70 %, translate-y 0) once the user has scrolled more than 300 px; hidden (opacity 0, translate-y 4, pointer-events-none) otherwise. Clicking scrolls to `{ top: 0, behavior: 'smooth' }`. Uses a passive scroll listener for performance.

---

#### `SocialLinks`

**File**: `storefront/src/components/ui/SocialLinks.tsx:1`
**Type**: Server Component.

**Props**:
```ts
{ className?: string; iconSize?: number }
```

**Description**: Renders a horizontal row of social icon links. URL config is read from `@/lib/socials.json` at import time. Supported platforms: `x`, `discord`, `linkedin`, `github`. Entries with empty URL strings are filtered out; if no entries remain, renders `null`. Each link opens in a new tab (`target="_blank" rel="noopener noreferrer"`) with an accessible `aria-label`.

---

#### `ThemeToggle`

**File**: `storefront/src/components/ui/ThemeToggle.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**: None.

**Description**: Icon button that toggles between light and dark mode by calling `toggleTheme()` from `ThemeContext`. Renders a moon SVG in dark mode and a sun-with-rays SVG in light mode. The SVG rotates 360° in dark mode via an inline `style` transform.

**Context consumed**: `useTheme()` — reads `resolvedTheme` and `toggleTheme`.

---

#### `CookieBanner`

**File**: `storefront/src/components/ui/CookieBanner.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**: None.

**State**:
- `view: 'hidden' | 'banner' | 'preferences'`
- `analytics: boolean` — current toggle state in preferences panel.
- `marketing: boolean` — current toggle state in preferences panel.

**Description**: Two-mode consent UI. On mount, checks `getConsent()` from `@/lib/consent`; if no consent has been recorded, sets `view = 'banner'`. Also listens for the `pixelforge:open-cookie-banner` custom window event (fired by `CookiePreferencesButton`) to open the preferences modal at any time.

**Banner view** (bottom-of-screen sticky bar): Explains cookie use with a link to `/privacy-policy`. Three buttons: "Reject Optional" (calls `saveConsent(false, false)`), "Manage" (opens preferences panel), "Accept All" (calls `saveConsent(true, true)`).

**Preferences view** (centred modal overlay): Shows three consent categories:
- Necessary — always-on badge, non-toggleable.
- Analytics — toggle (controls `analytics` state).
- Marketing — toggle (controls `marketing` state).

Save Preferences writes current toggle values via `saveConsent(analytics, marketing)`. Dispatches `pixelforge:consent-change` window event via `saveConsent` (implemented in `@/lib/consent`). Closing the modal when consent exists returns to `'hidden'`; when no consent exists returns to `'banner'`.

**Internal sub-components** (file-private):
- `Toggle` — accessible `role="switch"` pill toggle button.
- `CookieIcon` — inline SVG cookie icon.

**No API calls.** Consent is persisted locally via `@/lib/consent` (localStorage key `pixelforge-consent`).

---

#### `CookiePreferencesButton`

**File**: `storefront/src/components/ui/CookiePreferencesButton.tsx:1`
**Type**: Client Component (`'use client'`)

**Props**: None.

**Description**: A plain text button placed in the Footer's Legal column. On click, dispatches the custom `pixelforge:open-cookie-banner` window event, which `CookieBanner` listens for in order to open its preferences panel. Decouples Footer (Server Component) from CookieBanner (Client Component) without prop drilling.

---

#### `UnderConstruction`

**File**: `storefront/src/components/ui/UnderConstruction.tsx:1`
**Type**: Server Component.

**Props**:
```ts
{ title: string }
```

**Description**: Full-page placeholder section for incomplete pages. Renders a centred layout with an animated pulsing wrench SVG icon, a "Coming Soon" label, the provided `title` as an `<h1>`, explanatory copy, and two CTA links: "Back to Home" (`/`) and "Contact Us" (`/contact`).

---

## Dependency Map

```
layout/Header
  ├── ui/Container
  ├── ui/Icons  (Search, ShoppingCart, User)
  ├── layout/MobileNav
  ├── ui/ThemeToggle
  ├── ui/SocialLinks
  └── lib/auth-context  (useCustomer)

layout/Footer
  ├── ui/Container
  ├── ui/SocialLinks
  └── ui/CookiePreferencesButton

layout/MobileNav
  ├── ui/Icons  (Menu, X, User, LogOut)
  └── lib/auth-context  (useCustomer)

cart/CartItemRow
  ├── ui/Icons  (Trash)
  ├── lib/utils  (formatPrice)
  ├── lib/cart-context  (useCart)
  └── lib/mock-data  (Product type)

checkout/CheckoutForm
  └── @stripe/react-stripe-js  (useStripe, useElements, PaymentElement)

product/ProductCard
  ├── ui/Badge
  ├── ui/Icons  (Star)
  ├── lib/utils  (formatPrice)
  └── lib/mock-data  (Product type)

product/ProductGrid
  ├── product/ProductCard
  └── lib/mock-data  (Product type)

product/ProductFilters
  ├── lib/utils  (cn)
  └── lib/mock-data  (getCategories)

product/ProductGallery
  └── lib/utils  (cn)

product/CollectionCard
  └── lib/mock-data  (Collection type)

analytics/Tracker
  └── (no component imports; uses native browser APIs and fetch/sendBeacon)
      API: POST /api/analytics/events

newsletter/NewsletterSignup
      API: GET  /api/newsletter/settings
      API: POST /api/newsletter/subscribe

promo/PromoBanner
  ├── ui/Icons  (X)
  ├── ui/Container
  └── API: GET /api/banner  (only when initialData is absent)

seo/JsonLd
  └── lib/mock-data  (Product type — factory functions only)

ui/Container
  └── lib/utils  (cn)

ui/Badge
  └── lib/utils  (cn)

ui/Button
  └── lib/utils  (cn)

ui/Icons
  └── (no dependencies)

ui/SearchInput
  └── ui/Icons  (Search)

ui/ScrollToTop
  └── (no dependencies)

ui/SocialLinks
  ├── ui/Icons  (BrandX, BrandDiscord, BrandLinkedIn, BrandGitHub)
  └── lib/socials.json

ui/ThemeToggle
  └── lib/theme-context  (useTheme)

ui/CookieBanner
  ├── ui/Icons  (X)
  └── lib/consent  (getConsent, saveConsent)

ui/CookiePreferencesButton
  └── (no imports — fires a custom window event)

ui/UnderConstruction
  └── (no component imports)
```

---

## API Calls Summary

| Component | Method | Endpoint | Purpose |
|---|---|---|---|
| `Tracker` | `POST` (sendBeacon / fetch) | `/api/analytics/events` | Batch-flush behavioural events |
| `NewsletterSignup` | `GET` | `/api/newsletter/settings` | Feature-flag check on mount |
| `NewsletterSignup` | `POST` | `/api/newsletter/subscribe` | Subscribe email address |
| `PromoBanner` | `GET` | `/api/banner` | Fetch promo banner data (fallback) |

All API base URLs are resolved from `process.env.NEXT_PUBLIC_API_URL || '/api'`.

---

## Rendering Mode Summary

| Component | Mode |
|---|---|
| `Header` | Client |
| `Footer` | Server |
| `MobileNav` | Client |
| `CartItemRow` | Client |
| `CheckoutForm` | Client |
| `ProductCard` | Server |
| `ProductGrid` | Server |
| `ProductFilters` | Client |
| `ProductGallery` | Client |
| `CollectionCard` | Server |
| `Tracker` | Client |
| `NewsletterSignup` | Client |
| `PromoBanner` | Client |
| `JsonLd` | Server |
| `Container` | Server |
| `Badge` | Server |
| `Button` | Server |
| `Icons` | Server |
| `SearchInput` | Client |
| `ScrollToTop` | Client |
| `SocialLinks` | Server |
| `ThemeToggle` | Client |
| `CookieBanner` | Client |
| `CookiePreferencesButton` | Client |
| `UnderConstruction` | Server |
