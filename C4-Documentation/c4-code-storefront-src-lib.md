# C4 Code — storefront/src/lib

## Overview

- **Name**: Storefront Library / Contexts / Utilities
- **Location**: `storefront/src/lib/`
- **Primary Language**: TypeScript / React
- **Purpose**: React contexts (cart, auth, theme), API client utilities, mock product/collection data, geographic reference data, Stripe initialisation, and cookie-consent utilities for the storefront application.

---

## Code Elements

### `api.ts` — HTTP Client Utilities

**Location**: `storefront/src/lib/api.ts`

**Purpose**: Thin wrapper around the browser `fetch` API. Reads the base URL from `NEXT_PUBLIC_API_URL` (falls back to `http://localhost/api`) and provides two typed helper functions used across the storefront to call the Fastify backend.

**Dependencies**: `NEXT_PUBLIC_API_URL` environment variable, browser `fetch`.

#### Exports

```ts
export async function apiPost<T>(path: string, body: unknown): Promise<T>
```
- Sends a `POST` request to `${API_URL}${path}` with a JSON body.
- Throws an `Error` (message taken from `error` field in the response JSON, or `"Request failed"`) when the response is not `2xx`.
- Returns the parsed JSON body cast to `T`.
- **File location**: `storefront/src/lib/api.ts:3`

```ts
export async function apiGet<T>(path: string): Promise<T>
```
- Sends a `GET` request to `${API_URL}${path}`.
- Same error-handling and return convention as `apiPost`.
- **File location**: `storefront/src/lib/api.ts:16`

---

### `auth-context.tsx` — Customer Authentication Context

**Location**: `storefront/src/lib/auth-context.tsx`

**Purpose**: React context that tracks the currently authenticated storefront customer. On mount it calls `GET /api/auth/me` (cookie-based session) and stores the resulting user. Provides a `logout` action that calls `POST /api/auth/logout` and then hard-redirects to `/`.

**Directive**: `'use client'`

**Dependencies**: React (`createContext`, `useCallback`, `useContext`, `useEffect`, `useState`), browser `fetch`, browser `window.location`.

#### Types

```ts
type User = {
  email: string;
  name: string;
  picture: string;
  role: 'admin' | 'customer';
};
```
- **File location**: `storefront/src/lib/auth-context.tsx:5`

```ts
type CustomerAuthContextValue = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
};
```
- **File location**: `storefront/src/lib/auth-context.tsx:12`

#### Exports

```ts
export function CustomerAuthProvider({ children }: { children: React.ReactNode }): JSX.Element
```
- Fetches `GET /api/auth/me` once on mount (credentials: `'include'`).
- Only sets `user` if `data.user.role === 'customer'` (guards against admin tokens leaking into the storefront context).
- Sets `loading: false` in the `finally` block regardless of outcome.
- **File location**: `storefront/src/lib/auth-context.tsx:30`

```ts
export function useCustomer(): CustomerAuthContextValue
```
- Returns the context value directly via `useContext`. Does NOT throw if used outside a provider — the context has a safe default value (`user: null`, `loading: true`, `isAuthenticated: false`).
- **File location**: `storefront/src/lib/auth-context.tsx:26`

#### Internal API Calls
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/auth/me` | Retrieve current session user |
| `POST` | `/api/auth/logout` | Destroy session cookie |

---

### `cart-context.tsx` — Shopping Cart Context

**Location**: `storefront/src/lib/cart-context.tsx`

**Purpose**: React context that manages the customer's in-browser shopping cart. Items are persisted to `localStorage` under the key `pixelcart-cart`. Each cart item stores only the `productId` and `quantity`; product details are looked up synchronously from `mock-data.ts`. The cart treats digital products as unique line items (adding an already-present product is a no-op rather than incrementing quantity).

**Directive**: `'use client'`

**Dependencies**: React (`createContext`, `useContext`, `useState`, `useEffect`, `useCallback`), `localStorage`, `storefront/src/lib/mock-data.ts`.

#### Types

```ts
type CartItem = {
  productId: string;
  quantity: number;
};
```
- **File location**: `storefront/src/lib/cart-context.tsx:6`

```ts
type CartContextType = {
  items: CartItem[];
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  itemCount: number;
  total: number;
  getCartProducts: () => (Product & { quantity: number })[];
};
```
- **File location**: `storefront/src/lib/cart-context.tsx:11`

#### Exports

```ts
export function CartProvider({ children }: { children: React.ReactNode }): JSX.Element
```
- Hydrates cart from `localStorage` after first mount (SSR-safe: skips if `typeof window === 'undefined'`).
- Uses a `mounted` boolean guard to prevent writing to `localStorage` before hydration completes.
- Computes `total` by summing `product.price * item.quantity` for all known products; unknown product IDs contribute 0.
- **File location**: `storefront/src/lib/cart-context.tsx:40`

```ts
export function useCart(): CartContextType
```
- Throws `Error('useCart must be used within a CartProvider')` if called outside a provider.
- **File location**: `storefront/src/lib/cart-context.tsx:98`

#### Internal Functions (not exported)

```ts
function loadCart(): CartItem[]
```
- Reads and JSON-parses `localStorage['pixelcart-cart']`; returns `[]` on any failure.
- **File location**: `storefront/src/lib/cart-context.tsx:25`

```ts
function saveCart(items: CartItem[]): void
```
- Serialises cart items to `localStorage['pixelcart-cart']`.
- **File location**: `storefront/src/lib/cart-context.tsx:35`

---

### `consent.ts` — Cookie Consent Utilities

**Location**: `storefront/src/lib/consent.ts`

**Purpose**: Read and write the user's cookie/tracking consent decision to `localStorage` under the key `pixelforge-consent`. After saving, broadcasts a `CustomEvent` named `pixelforge:consent-change` on `window` so other components can react without polling.

**Dependencies**: `localStorage`, `window.dispatchEvent`, browser `CustomEvent`.

#### Types

```ts
export type ConsentDecision = {
  necessary: true;       // always true — hardcoded
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;     // ISO 8601 timestamp
};
```
- **File location**: `storefront/src/lib/consent.ts:1`

#### Exports

```ts
export function getConsent(): ConsentDecision | null
```
- SSR-safe: returns `null` when `typeof window === 'undefined'`.
- Returns `null` if no consent has been saved yet or if the stored JSON is malformed.
- **File location**: `storefront/src/lib/consent.ts:10`

```ts
export function saveConsent(analytics: boolean, marketing: boolean): ConsentDecision
```
- Constructs a `ConsentDecision` with `necessary: true` and the current ISO timestamp.
- Writes the decision to `localStorage['pixelforge-consent']`.
- Dispatches `CustomEvent('pixelforge:consent-change', { detail: decision })` on `window`.
- Returns the saved decision.
- **File location**: `storefront/src/lib/consent.ts:21`

---

### `geo-data.ts` — Geographic Reference Data

**Location**: `storefront/src/lib/geo-data.ts`

**Purpose**: Static, readonly lookup arrays of country codes, US state codes, and Canadian province codes used to populate address-form select elements on the checkout page.

**Dependencies**: None (pure data module).

#### Exports

```ts
export const COUNTRIES: readonly { code: string; name: string }[]
```
- 33 entries covering major markets: US, CA, GB, most of Western Europe, AU, NZ, JP, KR, SG, IN, BR, MX, IL, ZA, AE.
- Typed as `const` tuple via `as const`.
- **File location**: `storefront/src/lib/geo-data.ts:1`

```ts
export const US_STATES: readonly { code: string; name: string }[]
```
- 51 entries (50 states + District of Columbia), two-letter USPS codes.
- **File location**: `storefront/src/lib/geo-data.ts:37`

```ts
export const CA_PROVINCES: readonly { code: string; name: string }[]
```
- 13 entries (10 provinces + 3 territories), two-letter Canada Post codes.
- **File location**: `storefront/src/lib/geo-data.ts:91`

---

### `mock-data.ts` — Product / Collection / Order Fixture Data

**Location**: `storefront/src/lib/mock-data.ts`

**Purpose**: In-memory fixture data that acts as the product catalogue while the storefront is not backed by a live database query. Contains 12 digital products, 5 collections, 8 static pages, and 5 sample customer orders. Exposes accessor functions that mirror typical data-fetching patterns so they can be swapped for real API calls later.

**Dependencies**: None (pure data module).

#### Types

```ts
export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  price: number;              // in cents
  compareAtPrice?: number;    // in cents; optional
  images: string[];
  category: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  featured: boolean;
  createdAt: string;          // YYYY-MM-DD
  fileType: string;
  fileSize: string;
  seoTitle?: string;
  seoDescription?: string;
};
```
- **File location**: `storefront/src/lib/mock-data.ts:1`

```ts
export type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  productIds: string[];
  featured: boolean;
  seoTitle?: string;
  seoDescription?: string;
};
```
- **File location**: `storefront/src/lib/mock-data.ts:22`

```ts
export type StaticPage = {
  slug: string;
  title: string;
  content: string;            // raw HTML string
  seoDescription?: string;
};
```
- **File location**: `storefront/src/lib/mock-data.ts:34`

```ts
export type CustomerOrder = {
  id: string;
  orderNumber: string;
  items: { productId: string; productName: string; price: number }[];
  total: number;
  status: 'completed' | 'processing' | 'refunded';
  paymentMethod: string;
  createdAt: string;          // ISO 8601
};
```
- **File location**: `storefront/src/lib/mock-data.ts:481`

#### Product Accessor Exports

```ts
export function getProducts(): Product[]
```
- Returns all 12 products.
- **File location**: `storefront/src/lib/mock-data.ts:414`

```ts
export function getProductBySlug(slug: string): Product | undefined
```
- **File location**: `storefront/src/lib/mock-data.ts:418`

```ts
export function getFeaturedProducts(): Product[]
```
- Returns products where `featured === true` (currently 5 products: ids 1, 2, 6, 7, 9).
- **File location**: `storefront/src/lib/mock-data.ts:422`

```ts
export function getProductsByCategory(category: string): Product[]
```
- Filters by exact `category` string match.
- **File location**: `storefront/src/lib/mock-data.ts:426`

```ts
export function getRelatedProducts(productId: string, limit?: number): Product[]
```
- Returns up to `limit` (default 4) products in the same category, excluding `productId`.
- **File location**: `storefront/src/lib/mock-data.ts:430`

```ts
export function searchProducts(query: string): Product[]
```
- Case-insensitive substring search across `name`, `description`, `category`, and `tags`.
- **File location**: `storefront/src/lib/mock-data.ts:438`

```ts
export function getCategories(): string[]
```
- Returns a deduplicated array of all category strings (currently: `UI Kits`, `Icons`, `Fonts`, `Templates`, `Illustrations`, `Marketing`).
- **File location**: `storefront/src/lib/mock-data.ts:449`

#### Collection Accessor Exports

```ts
export function getCollections(): Collection[]
```
- **File location**: `storefront/src/lib/mock-data.ts:453`

```ts
export function getCollectionBySlug(slug: string): Collection | undefined
```
- **File location**: `storefront/src/lib/mock-data.ts:457`

```ts
export function getFeaturedCollections(): Collection[]
```
- All 5 collections have `featured: true`.
- **File location**: `storefront/src/lib/mock-data.ts:461`

```ts
export function getCollectionProducts(collectionId: string): Product[]
```
- Resolves the `productIds` array of a collection to full `Product` objects.
- **File location**: `storefront/src/lib/mock-data.ts:465`

#### Static Page Accessor Exports

```ts
export function getStaticPage(slug: string): StaticPage | undefined
```
- **File location**: `storefront/src/lib/mock-data.ts:471`

```ts
export function getStaticPages(): StaticPage[]
```
- Returns all 8 static pages (`about`, `faq`, `contact`, `privacy-policy`, `terms-of-service`, `refund-policy`, `changelog`, `roadmap`). Note: the last 5 have empty `content` strings.
- **File location**: `storefront/src/lib/mock-data.ts:475`

#### Order Accessor Exports

```ts
export function getCustomerOrders(): CustomerOrder[]
```
- Returns all 5 sample orders.
- **File location**: `storefront/src/lib/mock-data.ts:551`

```ts
export function getCustomerOrderById(id: string): CustomerOrder | undefined
```
- **File location**: `storefront/src/lib/mock-data.ts:555`

```ts
export function getCustomerPurchasedProducts(): Product[]
```
- Returns `Product` objects for all items in orders with `status === 'completed'`. Uses a `Set` for O(1) deduplication.
- **File location**: `storefront/src/lib/mock-data.ts:559`

---

### `stripe.ts` — Stripe Client Initialisation

**Location**: `storefront/src/lib/stripe.ts`

**Purpose**: Singleton Stripe.js promise. Calling `loadStripe` once at module load time ensures only a single Stripe script tag is injected into the page, regardless of how many components import `stripePromise`.

**Dependencies**: `@stripe/stripe-js` npm package, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` environment variable.

#### Exports

```ts
export const stripePromise: Promise<Stripe | null>
```
- Initialised by `loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)`.
- The `!` non-null assertion means the build will succeed but the runtime will fail silently if the env var is missing.
- Intended to be passed to the `@stripe/react-stripe-js` `<Elements>` provider.
- **File location**: `storefront/src/lib/stripe.ts:3`

---

### `theme-context.tsx` — Theme Context

**Location**: `storefront/src/lib/theme-context.tsx`

**Purpose**: React context for light/dark/system theme management. Persists the user's explicit preference to `localStorage` under the key `pixelforge-theme`. When the preference is `'system'`, it reads and listens to the OS `prefers-color-scheme` media query. Applies the resolved theme by toggling the `dark` CSS class on `document.documentElement` (Tailwind CSS dark mode convention), with a smooth transition managed via a `theme-transitioning` class.

**Directive**: `'use client'`

**Dependencies**: React (`createContext`, `useContext`, `useEffect`, `useState`, `useCallback`), `localStorage`, `window.matchMedia`, `document.documentElement`, `requestAnimationFrame`.

#### Types

```ts
type Theme = 'light' | 'dark' | 'system';
```
- **File location**: `storefront/src/lib/theme-context.tsx:5`

```ts
type ThemeContextType = {
  theme: Theme;                        // the stored/set preference
  resolvedTheme: 'light' | 'dark';     // the effective applied theme
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};
```
- **File location**: `storefront/src/lib/theme-context.tsx:7`

#### Exports

```ts
export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element
```
- On first mount: reads `localStorage['pixelforge-theme']`, resolves it, and calls `applyTheme`.
- Second `useEffect`: registers a `change` listener on the `prefers-color-scheme` MQL; only fires when `theme === 'system'`.
- `setTheme` persists to `localStorage` and immediately applies the resolved theme.
- `toggleTheme` switches between `'light'` and `'dark'` based on the current `resolvedTheme` (never sets `'system'` via toggle).
- **File location**: `storefront/src/lib/theme-context.tsx:32`

```ts
export function useTheme(): ThemeContextType
```
- Throws `Error('useTheme must be used within ThemeProvider')` if called outside a provider.
- **File location**: `storefront/src/lib/theme-context.tsx:78`

#### Internal Functions (not exported)

```ts
function getSystemTheme(): 'light' | 'dark'
```
- SSR-safe: returns `'light'` when `typeof window === 'undefined'`.
- **File location**: `storefront/src/lib/theme-context.tsx:18`

```ts
function applyTheme(resolved: 'light' | 'dark'): void
```
- Adds `theme-transitioning` to `<html>`, toggles the `dark` class, then removes `theme-transitioning` after 300 ms via `requestAnimationFrame` + `setTimeout`.
- **File location**: `storefront/src/lib/theme-context.tsx:23`

---

### `utils.ts` — General Utilities

**Location**: `storefront/src/lib/utils.ts`

**Purpose**: Shared pure utility functions used across storefront components.

**Dependencies**: `Intl.NumberFormat` (built-in).

#### Exports

```ts
export function formatPrice(cents: number): string
```
- Converts a price in cents to a formatted USD string (e.g., `4900` → `"$49.00"`) using `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`.
- **File location**: `storefront/src/lib/utils.ts:1`

```ts
export function cn(...classes: (string | false | undefined | null)[]): string
```
- Lightweight CSS class name helper. Filters falsy values and joins remaining strings with a space. Equivalent to a minimal version of the popular `clsx` library.
- **File location**: `storefront/src/lib/utils.ts:8`

---

## State Architecture

The storefront uses React Context as its sole global state mechanism. There are three context providers, each scoped to a specific concern:

```
<ThemeProvider>          (storefront/src/lib/theme-context.tsx)
  └── <CustomerAuthProvider>  (storefront/src/lib/auth-context.tsx)
        └── <CartProvider>    (storefront/src/lib/cart-context.tsx)
              └── {page tree}
```

### ThemeProvider

- **State**: `theme: Theme` (stored preference), `resolvedTheme: 'light' | 'dark'` (computed).
- **Persistence**: `localStorage['pixelforge-theme']`.
- **Side effects**: Toggles `dark` class on `<html>`. Listens to OS `prefers-color-scheme` changes.
- **Pattern**: Preference stored independently from resolved value — allows `'system'` to be a stable preference that automatically tracks the OS.

### CustomerAuthProvider

- **State**: `user: User | null`, `loading: boolean`.
- **Persistence**: None in the browser. Auth state lives in a server-side session cookie; the context just caches the result of `/api/auth/me`.
- **Side effects**: One `fetch` on mount; `window.location.href` redirect on logout.
- **Pattern**: Optimistic `loading: true` initial state prevents rendering authenticated UI before the network check resolves.

### CartProvider

- **State**: `items: CartItem[]`, `mounted: boolean`.
- **Persistence**: `localStorage['pixelcart-cart']` (serialised array of `{ productId, quantity }`).
- **Side effects**: Reads `localStorage` once on mount; writes on every `items` change (guarded by `mounted`).
- **Derived state**: `itemCount`, `total`, and `getCartProducts()` are computed synchronously from `items` + the mock product catalogue. No memoisation of `total`/`itemCount` — they are recalculated on every render.
- **Pattern**: The `mounted` guard is a standard SSR hydration safety pattern to prevent server/client HTML mismatches in Next.js.

### Consent (not a Context)

The `consent.ts` module is intentionally not a React context. It is a plain module-level utility, communicating changes through a `CustomEvent` on `window` rather than React re-renders. This is appropriate for a concern (cookie consent) that does not need to drive React rendering directly.

---

## Dependencies

### Internal Dependencies

| Module | Calls / Imports |
|--------|----------------|
| `cart-context.tsx` | `storefront/src/lib/mock-data.ts` — `getProducts()`, `Product` type |
| `auth-context.tsx` | No internal imports |
| `theme-context.tsx` | No internal imports |
| `stripe.ts` | No internal imports |
| `api.ts` | No internal imports |
| `geo-data.ts` | No internal imports |
| `consent.ts` | No internal imports |
| `utils.ts` | No internal imports |

### External / Runtime Dependencies

| Module | External Dependency | Usage |
|--------|-------------------|-------|
| `api.ts` | `NEXT_PUBLIC_API_URL` env var, `fetch` | Base URL for all API requests |
| `auth-context.tsx` | `fetch`, `window.location` | Session check and logout redirect |
| `cart-context.tsx` | `localStorage` | Cart persistence |
| `consent.ts` | `localStorage`, `window.dispatchEvent` | Consent persistence and broadcasting |
| `stripe.ts` | `@stripe/stripe-js`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` env var | Stripe.js singleton |
| `theme-context.tsx` | `localStorage`, `window.matchMedia`, `document.documentElement`, `requestAnimationFrame` | Theme persistence, OS detection, DOM mutation |
| `utils.ts` | `Intl.NumberFormat` | Currency formatting |
| `geo-data.ts` | None | Pure static data |
| `mock-data.ts` | None | Pure static data |

### API Routes Called (confirmed by source)

| Route | Method | Caller | Purpose |
|-------|--------|--------|---------|
| `/api/auth/me` | `GET` | `auth-context.tsx` | Verify active session and load user |
| `/api/auth/logout` | `POST` | `auth-context.tsx` | Destroy session cookie |

All other API calls originating from the storefront (checkout, newsletter, support, etc.) are made directly from page/component code using the `apiPost` / `apiGet` helpers from `api.ts`, not from within this `lib/` directory.
