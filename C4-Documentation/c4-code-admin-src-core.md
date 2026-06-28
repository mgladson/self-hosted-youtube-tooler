# C4 Code — admin/src (Core: Entry, Router, Contexts, Lib, Pages)

## Overview

- **Name**: Admin Dashboard Core
- **Location**: `admin/src/`, `admin/src/contexts/`, `admin/src/lib/`, `admin/src/pages/`
- **Primary Language**: TypeScript / React 19
- **Purpose**: Admin SPA entry point, client-side routing, global state contexts, API utilities, and page components
- **Build Tool**: Vite (base path `/admin/`)
- **Styling**: Tailwind CSS (dark-mode via `.dark` class toggling)

---

## Code Elements

### admin/src/main.tsx

Application bootstrap. Mounts the React tree into `#root` with provider layering.

```
ThemeProvider
  └── AuthProvider
        └── ToastProvider
              └── RouterProvider (router)
```

| Export | Signature | Description |
|---|---|---|
| _(default side-effect)_ | `createRoot(...).render(...)` | Bootstraps the SPA |

**Location**: `admin/src/main.tsx`

---

### admin/src/router.tsx

Defines the entire client-side route tree using `createBrowserRouter`.

| Export | Signature | Description |
|---|---|---|
| `router` | `BrowserRouter` instance | Exported router object passed to `RouterProvider` in `main.tsx` |

**Location**: `admin/src/router.tsx`

---

### admin/src/vite-env.d.ts

Vite environment type reference shim.

| Export | Description |
|---|---|
| `/// <reference types="vite/client" />` | Adds `import.meta.env` typings |

**Location**: `admin/src/vite-env.d.ts`

---

### admin/src/globals.css

Global Tailwind CSS entry point. No TypeScript exports.

**Location**: `admin/src/globals.css`

---

## Route Map

All routes share the `/admin` prefix. The root `/admin` path renders `Dashboard` as the index route. All routes under `/admin` are wrapped by `RequireAuth` (redirects unauthenticated users) and `AdminLayout` (persistent sidebar + topbar shell).

```
/admin/login                         → Login          (public, no auth guard)
/admin                               → RequireAuth > AdminLayout
  /admin            (index)          → Dashboard
  /admin/analytics                   → Analytics
  /admin/products                    → ProductList
  /admin/products/new                → ProductCreate
  /admin/products/:slug              → ProductDetail
  /admin/collections                 → CollectionList
  /admin/collections/:slug           → CollectionDetail
  /admin/orders                      → OrderList
  /admin/orders/:id                  → OrderDetail
  /admin/customers                   → CustomerList
  /admin/customers/segments          → Segments
  /admin/customers/:id               → CustomerDetail
  /admin/discounts                   → DiscountList
  /admin/discounts/new               → DiscountDetail  (create mode: isNew=true)
  /admin/discounts/:id               → DiscountDetail  (edit mode)
  /admin/email                       → Email
  /admin/banner                      → Banner
  /admin/pages                       → Pages
  /admin/insights                    → UserInsights
  /admin/reports                     → ReportsHub
  /admin/reports/finance             → FinanceReports
  /admin/reports/tax                 → TaxReports
  /admin/support                     → SupportTickets
  /admin/support/:id                 → SupportTicketDetail
  /admin/newsletter                  → Newsletter
  /admin/audit-log                   → AuditLog
  /admin/security                    → Security
  /admin/settings                    → SettingsPage
```

---

## Context Map

### AuthContext — `admin/src/contexts/AuthContext.tsx`

Provides session state and logout. Fetches `GET /api/auth/me` on mount.

**State shape:**

```typescript
type User = {
  email: string;
  name: string;
  picture: string;
};

type AuthContextValue = {
  user: User | null;     // null while loading or unauthenticated
  loading: boolean;      // true until /auth/me resolves
  logout: () => Promise<void>;  // POST /api/auth/logout, then redirect to /admin/login
};
```

**Default value:** `{ user: null, loading: true, logout: async () => {} }`

**Storage key:** none (session cookie managed by API)

**API endpoints called:**
- `GET {API_BASE}/auth/me` — on mount
- `POST {API_BASE}/auth/logout` — on `logout()`

| Export | Signature | Description |
|---|---|---|
| `useAuth` | `() => AuthContextValue` | Hook to consume auth state |
| `AuthProvider` | `({ children: React.ReactNode }) => JSX` | Context provider component |

**Location**: `admin/src/contexts/AuthContext.tsx`

---

### ThemeContext — `admin/src/contexts/ThemeContext.tsx`

Manages light/dark/system theme preference. Persists to `localStorage`. Applies `.dark` class to `<html>` via `applyTheme()`. Listens to `prefers-color-scheme` media query for `system` mode.

**State shape:**

```typescript
type Theme = 'light' | 'dark' | 'system';

type ThemeContextType = {
  theme: Theme;                   // stored preference (may be 'system')
  resolvedTheme: 'light' | 'dark'; // actual computed theme
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;        // toggles between resolved light/dark
};
```

**Default value:** `{ theme: 'system', resolvedTheme: 'light', setTheme: () => {}, toggleTheme: () => {} }`

**Storage key:** `pixelcart-admin-theme` (localStorage)

**CSS side-effect:** adds `theme-transitioning` class during 300 ms transition, toggles `.dark` on `document.documentElement`

| Export | Signature | Description |
|---|---|---|
| `useTheme` | `() => ThemeContextType` | Hook to consume theme state |
| `ThemeProvider` | `({ children: React.ReactNode }) => JSX` | Context provider component |

**Location**: `admin/src/contexts/ThemeContext.tsx`

---

## lib/ — Utility Modules

### admin/src/lib/api.ts

Typed fetch wrappers for all API endpoints used by the admin. All calls use `credentials: 'include'` (session cookie). Base URL: `import.meta.env.VITE_API_URL || '/api'`.

**Type exports:**

| Type | Shape |
|---|---|
| `BehaviorData` | Page view summary, topPages, scrollDepth, topClicks, elementVisibility |
| `BannerData` | `{ active, text, imageUrl, linkUrl, linkLabel, updatedAt }` |
| `PagesData` | `{ pages: Record<string, { underConstruction: boolean }>, updatedAt }` |
| `SupportTicket` | `{ id, customerEmail, customerName, subject, status, priority, createdAt, updatedAt }` |
| `TicketMessage` | `{ id, senderRole, senderName, senderEmail, body, createdAt }` |
| `TicketDetail` | `{ ticket: SupportTicket, messages: TicketMessage[] }` |
| `NewsletterSubscriber` | `{ email, subscribedAt }` |
| `NewsletterData` | `{ subscribers, enabled, total }` |
| `GitCommit` | `{ sha, shortSha, message, authorName, authorEmail, date, url }` |
| `AuditLogEntry` | `{ id, userEmail, userName, action, resourceType, resourceId, summary, ipAddress, createdAt }` |
| `AuditLogsResponse` | `{ logs, total, page, totalPages }` |
| `BannedIpEntry` | `{ ip, reason, bannedAt }` |
| `SecurityEvent` | Full event row with bot_score, event_type, action, metadata |
| `ThreatActor` | IP-level aggregated threat stats |
| `RateLimitEntry` | `{ endpoint, hits }` |
| `BlockedBreakdownEntry` | `{ event_type?, country?, ua_class?, count }` |
| `RecentBanEntry` | `{ user_email, action, ip_address, summary, created_at }` |
| `EventTimelineEntry` | `{ bucket, total, blocked, flagged }` |
| `SecurityDashboard` | Full dashboard payload (stats, bannedIps, topThreatActors, eventTimeline, infraStats, checkoutStats, etc.) |
| `SecurityReport` | Period summary, topThreatActors, actionableTasks |

**Function exports:**

| Function | Signature | API Endpoint | Description |
|---|---|---|---|
| `fetchBehaviorAnalytics` | `(start: string, end: string) => Promise<BehaviorData>` | `GET /analytics/behavior` | User behavior analytics |
| `fetchBanner` | `() => Promise<BannerData>` | `GET /banner` | Fetch current banner config |
| `updateBanner` | `(data: Omit<BannerData,'updatedAt'>) => Promise<BannerData>` | `PUT /banner` | Save banner config |
| `fetchPages` | `() => Promise<PagesData>` | `GET /pages` | Fetch page visibility settings |
| `updatePage` | `(slug: string, underConstruction: boolean) => Promise<{slug, underConstruction, updatedAt}>` | `PUT /pages/:slug` | Toggle page under-construction flag |
| `sendCampaignEmail` | `(recipients, subject, body) => Promise<{sent, failed, errors?}>` | `POST /email/send` | Send bulk campaign email |
| `fetchSupportTickets` | `(status?: string) => Promise<{tickets: SupportTicket[]}>` | `GET /support/tickets` | List all tickets, optional status filter |
| `fetchCustomerTickets` | `(email: string) => Promise<{tickets: SupportTicket[]}>` | `GET /support/tickets?customer_email=` | Tickets for a specific customer |
| `fetchSupportTicket` | `(id: number) => Promise<TicketDetail>` | `GET /support/tickets/:id` | Single ticket with messages |
| `replySupportTicket` | `(id: number, body: string) => Promise<{ok: boolean}>` | `POST /support/tickets/:id/messages` | Post admin reply |
| `updateTicketStatus` | `(id: number, updates: {status?, priority?}) => Promise<{id, status, priority}>` | `PATCH /support/tickets/:id` | Update ticket status/priority |
| `fetchNewsletterSubscribers` | `() => Promise<NewsletterData>` | `GET /newsletter/subscribers` | Fetch subscriber list and enabled flag |
| `updateNewsletterSettings` | `(enabled: boolean) => Promise<{enabled: boolean}>` | `PUT /newsletter/settings` | Toggle signup visibility |
| `deleteNewsletterSubscriber` | `(email: string) => Promise<{ok: boolean}>` | `DELETE /newsletter/subscribers/:email` | Remove subscriber |
| `fetchGithubCommits` | `() => Promise<GitCommit[]>` | `GET api.github.com/repos/:repo/commits` | Recent commits (uses `VITE_GITHUB_REPO`, returns `[]` if unset) |
| `fetchAuditLogs` | `(page?: number, resourceType?: string) => Promise<AuditLogsResponse>` | `GET /audit/logs` | Paginated admin audit log |
| `fetchSecurityDashboard` | `() => Promise<SecurityDashboard>` | `GET /security/dashboard` | Live security metrics |
| `fetchSecurityReport` | `(start?: string, end?: string) => Promise<SecurityReport>` | `GET /security/report` | Downloadable security report |
| `blockIp` | `(ip: string, reason?: string) => Promise<{ok: boolean}>` | `POST /security/block` | Block an IP address |
| `unblockIp` | `(ip: string) => Promise<{ok: boolean}>` | `DELETE /security/block/:ip` | Unblock an IP address |

**Location**: `admin/src/lib/api.ts`

---

### admin/src/lib/hooks.ts

React `useMemo` hooks that filter and aggregate mock data. All data is sourced from `lib/mock-data`.

**Type exports:**

| Type | Fields |
|---|---|
| `OrderFilters` | `{ status?, paymentStatus?, search?, dateFrom?, dateTo? }` |
| `ProductFilters` | `{ status?, category?, search? }` |
| `CustomerFilters` | `{ search? }` |

**Hook exports:**

| Hook | Signature | Returns | Description |
|---|---|---|---|
| `useOrders` | `(filters?: OrderFilters) => { orders, total, pending, processing, completed, refunded }` | Filtered order list + status counts | Filters mock orders; status counts always reflect full dataset |
| `useProducts` | `(filters?: ProductFilters) => { products, total, active, drafts, archived }` | Filtered product list + status counts | Filters mock products; counts always reflect full dataset |
| `useCustomers` | `(filters?: CustomerFilters) => { customers, total }` | Filtered customer list | Searches by email substring |

**Location**: `admin/src/lib/hooks.ts`

---

### admin/src/lib/utils.ts

Pure formatting and styling utilities.

| Export | Signature | Description |
|---|---|---|
| `formatPrice` | `(cents: number) => string` | Formats cents as `$X.XX` using `Intl.NumberFormat` (en-US, USD) |
| `cn` | `(...classes: (string\|false\|undefined\|null)[]) => string` | Classname concatenation utility (falsy values filtered) |
| `formatDate` | `(dateStr: string) => string` | Formats ISO date as `"Jan 1, 2026"` |
| `formatNumber` | `(n: number) => string` | Formats integer with thousands separator |
| `toSlug` | `(str: string) => string` | Lowercases, replaces non-alphanumeric runs with `-`, trims leading/trailing `-` |

**Location**: `admin/src/lib/utils.ts`

---

### admin/src/lib/analytics.ts

Time-bucketed revenue chart computations operating on mock `Order[]` data. Used by `Dashboard` and `FinanceReports`.

**Constants:**
- `PAYMENT_PROCESSING_RATE = 0.029`
- `PAYMENT_FIXED_FEE_CENTS = 30`
- `MONTHLY_PLATFORM_COST_CENTS = 20000`
- `MARKETING_RATE = 0.08`
- `NOW = new Date('2026-03-03T12:00:00Z')` (fixed reference point for all period calculations)

**Type exports:**

| Type | Fields |
|---|---|
| `TimePeriod` | `{ key, label, getDateRange: () => [Date, Date] }` |
| `PeriodMetrics` | `{ totalRevenue, totalCost, grossProfit, grossMarginPercent, netProfit, netMarginPercent, orderCount, avgOrderValue, avgDailyRevenue, operatingExpenses }` |
| `ChartDataPoint` | `{ label, revenue, cost, grossProfit, average }` (dollars, not cents) |
| `MarginDataPoint` | `{ label, grossProfit, netProfit, grossMarginPct, netMarginPct }` |
| `PeriodComparison` | `{ current, previous, revenueChange, orderCountChange, avgOrderChange, marginChange }` |

**Function/constant exports:**

| Export | Signature | Description |
|---|---|---|
| `TIME_PERIODS` | `TimePeriod[]` | 10 predefined periods: last-24h, last-7, last-14, current-month, last-30, last-60, last-90, last-180, ytd, last-365 |
| `filterOrdersByPeriod` | `(orders, start, end) => Order[]` | Filters to `paymentStatus === 'paid'` within date range |
| `getPeriodMetrics` | `(orders, start, end) => PeriodMetrics` | Computes revenue, cost, profit, operating expenses for a period |
| `getChartData` | `(orders, start, end) => { data: ChartDataPoint[], granularity }` | Bucketed revenue/cost/profit chart data; auto-selects day/week/month granularity |
| `getMarginChartData` | `(orders, start, end) => MarginDataPoint[]` | Bucketed gross/net margin chart data |
| `getPeriodComparison` | `(orders, start, end) => PeriodComparison` | Compares current period vs prior equal-length period |
| `formatCompactPrice` | `(cents: number) => string` | Formats as `$1.2M`, `$1.2k`, or full price |
| `formatDollars` | `(dollars: number) => string` | Same compact format for pre-divided dollar values |

**Location**: `admin/src/lib/analytics.ts`

---

### admin/src/lib/csv.ts

Browser-side CSV generation and download utilities.

**Type exports:**

| Type | Fields |
|---|---|
| `CSVColumn<T>` | `{ key, header, value: (row: T) => string\|number }` |

**Function exports:**

| Export | Signature | Description |
|---|---|---|
| `downloadCSV` | `<T>(filename, columns: CSVColumn<T>[], rows: T[]) => void` | Builds CSV string, triggers download via `<a>.click()`. Properly escapes commas/quotes/newlines. |
| `centsToDollars` | `(cents: number) => string` | Returns `(cents / 100).toFixed(2)` |
| `formatISODate` | `(dateStr: string) => string` | Returns `YYYY-MM-DD` slice of ISO string |

**Location**: `admin/src/lib/csv.ts`

---

### admin/src/lib/reports.ts

P&L and tax computation functions. Operates on mock `Order[]`. Used by `FinanceReports` and `TaxReports`.

**Constants (internal):**
- `PAYMENT_PROCESSING_RATE = 0.029`, `PAYMENT_FIXED_FEE_CENTS = 30`, `MONTHLY_PLATFORM_COST_CENTS = 20000`, `MARKETING_RATE = 0.08`

**Type exports:**

| Type | Fields |
|---|---|
| `FinanceSummary` | `{ grossSales, discounts, refunds, netSales, taxCollected, paymentFees, cogs, grossProfit, grossMarginPct, operatingExpenses, netProfit, netMarginPct, orderCount }` |
| `ProductSalesRow` | `{ productName, unitsSold, grossRevenue, cogs, grossProfit, marginPct }` |
| `PaymentMethodRow` | `{ method, count, gross, fees, net }` |
| `TaxPeriodRow` | `{ label, grossSales, taxableAmount, taxCollected, netSales }` |
| `QuarterRow` | `{ quarter, grossIncome, taxCollected, netIncome }` |
| `TaxFilingRow` | `{ date, orderNumber, description, grossAmount, taxAmount, netAmount }` |

**Function exports:**

| Export | Signature | Description |
|---|---|---|
| `getFinanceSummary` | `(orders, start, end) => FinanceSummary` | Full P&L summary for a period |
| `getSalesByProduct` | `(orders, start, end) => ProductSalesRow[]` | Revenue and margin per product, sorted by gross revenue desc |
| `getPaymentsSummary` | `(orders, start, end) => PaymentMethodRow[]` | Payment method breakdown (returns Stripe only) |
| `getTaxReport` | `(orders, start, end) => { periods: TaxPeriodRow[], totals: TaxPeriodRow }` | Monthly tax breakdown with totals row |
| `getQuarterlyTaxSummary` | `(orders, year) => QuarterRow[]` | Q1–Q4 gross income, tax collected, net income |
| `getTaxFilingCSVRows` | `(orders, start, end) => TaxFilingRow[]` | Per-order rows for tax filing export |

**Location**: `admin/src/lib/reports.ts`

---

### admin/src/lib/segments.ts

Customer segmentation logic. Operates on mock `Customer[]` and `Order[]`.

**Type exports:**

| Type | Fields |
|---|---|
| `Segment` | `{ id, name, description, filter: (customers, orders) => Customer[] }` |

**Segment definitions (internal array of 7):**

| id | Name | Logic |
|---|---|---|
| `all` | All Customers | Returns all |
| `refund-requested` | Refund Requested | Orders with `status=refunded` but `paymentStatus!=refunded` |
| `refunded` | Refunded Customers | Any order with `status=refunded` |
| `happy` | Happy Customers | Has completed+paid orders, no refunds |
| `inactive` | Inactive Customers | `lastOrderAt` older than 60 days |
| `high-spenders` | High Spenders | Top 25% by `totalSpent` |
| `new` | New Customers | `createdAt` within last 30 days |

**Function exports:**

| Export | Signature | Description |
|---|---|---|
| `getSegments` | `() => Segment[]` | Returns all segment definitions |
| `getSegmentCustomers` | `(segmentId: string) => Customer[]` | Applies the named segment's filter to the full customer+order dataset |

**Location**: `admin/src/lib/segments.ts`

---

### admin/src/lib/search.ts

Omnisearch across products, orders, customers, and static pages. Currently backed by mock data only.

**Type exports:**

| Type | Fields |
|---|---|
| `SearchResult` | `{ type: 'product'\|'order'\|'customer'\|'page', id, label, sublabel?, href }` |
| `SearchProvider` | `{ search(query: string): Promise<SearchResult[]> }` |

**Class exports:**

| Export | Description |
|---|---|
| `MockSearchProvider` | Implements `SearchProvider`. Searches products by name/category (up to 5), orders by orderNumber/customerName (up to 5), customers by email (up to 5), and 8 static page links. Returns `[]` for empty queries. |

**Constant exports:**

| Export | Type | Description |
|---|---|---|
| `searchProvider` | `SearchProvider` | Singleton instance of `MockSearchProvider` |

**Location**: `admin/src/lib/search.ts`

---

### admin/src/lib/mock-data.ts

Static in-memory dataset (products, collections, orders, customers, discounts). Generates ~1 year of synthetic historical orders deterministically via a seeded PRNG (`mulberry32`).

**Type exports:**

| Type | Key Fields |
|---|---|
| `Product` | `id, slug, name, description, longDescription, price, cost, compareAtPrice?, images[], category, tags[], rating, reviewCount, featured, createdAt, fileType, fileSize, status ('active'\|'draft'\|'archived'), seoTitle?, seoDescription?` |
| `Collection` | `id, slug, name, description, image, productIds[], featured, seoTitle?, seoDescription?` |
| `Order` | `id, orderNumber, customerName, customerEmail, items[], total, status, paymentStatus, createdAt, discountCode?, discountAmount?, taxAmount?` |
| `Customer` | `id, email, totalOrders, totalSpent, createdAt, lastOrderAt, status ('active'\|'inactive'\|'churned')` |
| `Discount` | `id, code, type ('percentage'\|'fixed_amount'), value, minOrderAmount?, maxUses?, currentUses, startsAt, endsAt?, active, createdAt` |

**Static data:**
- 12 products (UI Kits, Icons, Fonts, Templates, Illustrations, Marketing)
- 5 collections
- 15 hand-authored orders (recent, March 2026)
- 12 hand-authored customers
- 7 discount codes
- ~1 year of generated historical orders (March 2025 – February 2026) with seasonal multipliers and growth curve; lazily initialized and cached in `_allOrders`

**Function exports:**

| Export | Signature | Description |
|---|---|---|
| `getProducts` | `() => Product[]` | Returns static product array (12 items) |
| `getProductBySlug` | `(slug: string) => Product \| undefined` | Lookup by URL slug |
| `getProductById` | `(id: string) => Product \| undefined` | Lookup by ID |
| `getCategories` | `() => string[]` | Deduplicated category list from products |
| `getCollections` | `() => Collection[]` | Returns static collection array (5 items) |
| `getCollectionBySlug` | `(slug: string) => Collection \| undefined` | Lookup by URL slug |
| `getCollectionProducts` | `(collectionId: string) => Product[]` | Products belonging to a collection |
| `getOrders` | `() => Order[]` | Returns all orders (historical + recent), sorted newest-first |
| `getOrderById` | `(id: string) => Order \| undefined` | Lookup by order ID |
| `getCustomers` | `() => Customer[]` | Returns static customer array (12 items) |
| `getCustomerById` | `(id: string) => Customer \| undefined` | Lookup by customer ID |
| `getDiscounts` | `() => Discount[]` | Returns static discount array (7 items) |
| `getDiscountById` | `(id: string) => Discount \| undefined` | Lookup by discount ID |
| `getDashboardStats` | `() => { totalProducts, totalRevenue, totalOrders, totalCustomers }` | High-level aggregate stats for dashboard |

**Location**: `admin/src/lib/mock-data.ts`

---

### admin/src/lib/geo-data.ts

Static geographic data used by the UserInsights / world map feature.

**Type exports:**

| Type | Fields |
|---|---|
| `GeoRegion` | `{ name, visitors, registered, paid, paying }` |
| `GeoCountry` | `{ code, name, flag, lat, lng, visitors, registered, paid, paying, regions: GeoRegion[] }` |
| `GeoMetric` | `'visitors' \| 'registered' \| 'paid' \| 'paying'` |

**Constant exports:**

| Export | Type | Description |
|---|---|---|
| `METRIC_LABELS` | `Record<GeoMetric, string>` | Display labels for each metric |
| `METRIC_COLORS` | `Record<GeoMetric, string>` | Hex color per metric (indigo/emerald/amber/purple) |
| `geoData` | `GeoCountry[]` | 20 countries with visitor, registration, and payment counts; each with city-level region breakdowns |

**Function exports:**

| Export | Signature | Description |
|---|---|---|
| `getTotalByMetric` | `(metric: GeoMetric) => number` | Sums a metric across all countries |

**Location**: `admin/src/lib/geo-data.ts`

---

### admin/src/lib/icons.tsx

Inline SVG icon components (Lucide-style, stroke-based). All accept `{ size?: number, className?: string }`.

**Exports (34 icon components):**

`Home`, `Package`, `FolderOpen`, `ShoppingBag`, `Users`, `Settings`, `Search`, `Bell`, `Plus`, `Pencil`, `Trash`, `X`, `Menu`, `ChevronRight`, `ChevronDown`, `ExternalLink`, `TrendingUp`, `DollarSign`, `BarChart3`, `LogOut`, `ArrowUpDown`, `TrendingDown`, `Percent`, `Calendar`, `Check`, `Download`, `FileText`, `Receipt`, `Mail`, `Send`, `Eye`, `Clock`, `MousePointer`, `ArrowLeft`, `Megaphone`, `Rss`, `Headphones`, `History`, `Shield`

**Location**: `admin/src/lib/icons.tsx`

---

## Page Components

### admin/src/pages/Login.tsx

| Export | Signature | Description |
|---|---|---|
| `Login` | `() => JSX` | Login page. Renders a Google OAuth link (`GET /api/auth/google`). In `import.meta.env.DEV` mode, also shows a "Dev Login" button (`POST /api/auth/dev-login` with `email: 'test@pixelcart.com'`). Reads `?error` search param to display error messages. Redirects to `/admin` if already authenticated. |

**Internal state:** `devLoading: boolean`
**API endpoints used:** `GET /api/auth/me` (via AuthContext), `POST /api/auth/dev-login`
**Location**: `admin/src/pages/Login.tsx`

---

### admin/src/pages/Dashboard.tsx

| Export | Signature | Description |
|---|---|---|
| `Dashboard` | `() => JSX` | Overview page with stat cards, period selector, `RevenueChart`, recent orders table, `ActivityFeed`, and quick actions. |

**Internal state:** `period: '7d' | '30d' | '90d' | '12m'`
**Computed:** revenue, order count, AOV, unique customers — each with % change vs prior period
**Deps:** `useAuth`, `useOrders`, `useProducts`, `getOrders`, `getChartData`
**Location**: `admin/src/pages/Dashboard.tsx`

---

### admin/src/pages/Analytics.tsx

| Export | Signature | Description |
|---|---|---|
| `Analytics` | `() => JSX` | Thin wrapper that renders `<AnalyticsOverview />` from `components/analytics/`. |

**Location**: `admin/src/pages/Analytics.tsx`

---

### admin/src/pages/ProductList.tsx

| Export | Signature | Description |
|---|---|---|
| `ProductList` | `() => JSX` | Paginated, filterable, sortable product table. Supports category tab filters, text search, column sort (price, date), row selection, bulk actions bar, and CSV export. Page size: 25. |

**Internal state:** `search, category, page, sortKey, sortDir, selectedIds`
**Deps:** `useProducts`, `getCategories`, `downloadCSV`
**Location**: `admin/src/pages/ProductList.tsx`

---

### admin/src/pages/ProductDetail.tsx

| Export | Signature | Description |
|---|---|---|
| `ProductDetail` | `() => JSX` | Edit form for an existing product. Uses `:slug` param. Sections: Product Info, Media (image gallery with primary selection), Pricing, Organization, URL/SEO. Sticky save/discard/delete action bar. Displays toast on save. |

**Internal state:** `form` (all editable fields), `dirty: boolean`, `primaryImage: number`
**Route param:** `:slug`
**Deps:** `getProductBySlug`, `getCategories`, `StickyActionBar`, `SEOPreview`, `useToast`
**Location**: `admin/src/pages/ProductDetail.tsx`

---

### admin/src/pages/ProductCreate.tsx

| Export | Signature | Description |
|---|---|---|
| `ProductCreate` | `() => JSX` | Create-new-product form. Auto-generates slug from name (can be overridden and locked). Validates name, price, slug before creation. Default status: `draft`. |

**Internal state:** `form` (all fields), `slugLocked: boolean`
**Deps:** `getCategories`, `toSlug`, `useToast`
**Location**: `admin/src/pages/ProductCreate.tsx`

---

### admin/src/pages/CollectionList.tsx

| Export | Signature | Description |
|---|---|---|
| `CollectionList` | `() => JSX` | Card grid of collections with image, name, product count, and Featured badge. Text search filter. Paginated (9 per page). |

**Internal state:** `search, page`
**Deps:** `getCollections`, `getCollectionProducts`
**Location**: `admin/src/pages/CollectionList.tsx`

---

### admin/src/pages/CollectionDetail.tsx

| Export | Signature | Description |
|---|---|---|
| `CollectionDetail` | `() => JSX` | Edit form for a collection. Uses `:slug` param. Fields: name, slug, description, image URL. Shows a table of products in the collection. Sticky save/discard/delete bar. |

**Route param:** `:slug`
**Deps:** `getCollectionBySlug`, `getCollectionProducts`, `StickyActionBar`, `useToast`
**Location**: `admin/src/pages/CollectionDetail.tsx`

---

### admin/src/pages/OrderList.tsx

| Export | Signature | Description |
|---|---|---|
| `OrderList` | `() => JSX` | Full-featured order table. Status tabs (All/Pending/Processing/Completed/Refunded). Sortable columns (total, status, date). Column visibility toggle. Bulk selection. CSV export. `OrderMetricsBar` summary. Page size: 25. |

**Internal state:** `activeTab, page, sortKey, sortDir, selectedIds, visibleKeys`
**Deps:** `useOrders`, `OrderMetricsBar`, `ColumnToggle`, `downloadCSV`
**Location**: `admin/src/pages/OrderList.tsx`

---

### admin/src/pages/OrderDetail.tsx

| Export | Signature | Description |
|---|---|---|
| `OrderDetail` | `() => JSX` | Order detail view. Uses `:id` param. Shows line items table with price/cost/profit per item. Financial summary (subtotal, discount, tax, total, COGS, processing fee, net profit). Customer card, timeline, order metadata, and internal notes textarea (persisted to `localStorage` key `pixelcart:notes:order:{id}`). |

**Route param:** `:id`
**Internal state:** `notes: string`
**Deps:** `getOrderById`, `getProductById`, `useToast`
**Sub-component:** `TimelineEvent` (local, not exported)
**Location**: `admin/src/pages/OrderDetail.tsx`

---

### admin/src/pages/CustomerList.tsx

| Export | Signature | Description |
|---|---|---|
| `CustomerList` | `() => JSX` | Paginated, searchable customer table. Columns: email, orders, total spent, joined, last order. Bulk selection. CSV export. Page size: 25. |

**Internal state:** `search, page, selectedIds`
**Deps:** `useCustomers`, `downloadCSV`
**Location**: `admin/src/pages/CustomerList.tsx`

---

### admin/src/pages/CustomerDetail.tsx

| Export | Signature | Description |
|---|---|---|
| `CustomerDetail` | `() => JSX` | Customer profile. Uses `:id` param. Two tabs: Overview (order history table, notes textarea) and Support Tickets (fetches live from API). Sidebar: avatar, status badge, stats, editable tags. Notes and tags persisted to `localStorage` keys `pixelcart:notes:customer:{id}` and `pixelcart:tags:customer:{id}`. |

**Route param:** `:id`
**Internal state:** `tab, notes, tagInput, tags, tickets, ticketsLoading`
**API used:** `fetchCustomerTickets` (live, from `lib/api`)
**Deps:** `getCustomerById`, `getOrders`, `fetchCustomerTickets`
**Location**: `admin/src/pages/CustomerDetail.tsx`

---

### admin/src/pages/Segments.tsx

| Export | Signature | Description |
|---|---|---|
| `Segments` | `() => JSX` | Read-only segment overview table. Shows segment name, description, customer count, and a percentage distribution bar. Links each segment to `/admin/customers?segment={id}`. |

**Deps:** `getSegments`, `getSegmentCustomers`, `getCustomers`
**Location**: `admin/src/pages/Segments.tsx`

---

### admin/src/pages/DiscountList.tsx

| Export | Signature | Description |
|---|---|---|
| `DiscountList` | `() => JSX` | Discount code table. Status tabs (All/Active/Expired/Scheduled). Text search. Sortable columns (value, start date). Bulk selection. Page size: 25. Shows "Preview" banner noting discounts are not yet active in checkout. |

**Internal state:** `activeTab, search, page, sortKey, sortDir, selectedIds`
**Internal helper:** `discountStatus(d: Discount) => 'Active' | 'Expired' | 'Scheduled' | 'Inactive'`
**Deps:** `getDiscounts`
**Location**: `admin/src/pages/DiscountList.tsx`

---

### admin/src/pages/DiscountDetail.tsx

| Export | Signature | Description |
|---|---|---|
| `DiscountDetail` | `() => JSX` | Create or edit a discount code. Uses `:id` param; `id === 'new'` triggers create mode. Fields: code (with "Generate" random code button), type (percentage/fixed), value, min order, max uses, start/end dates, active toggle. Live summary preview panel. |

**Route param:** `:id` (or `'new'`)
**Internal helper:** `randomCode() => string` (8-char alphanumeric)
**Deps:** `getDiscountById`, `useToast`
**Location**: `admin/src/pages/DiscountDetail.tsx`

---

### admin/src/pages/Settings.tsx

| Export | Signature | Description |
|---|---|---|
| `SettingsPage` | `() => JSX` | Store settings form (UI only, no persistence to API). Sections: Store Information (name, URL, email), Payments (provider, currency), Notifications (4 checkboxes). Save triggers a toast. |

**Internal state:** `store, payment, notifications`
**Deps:** `useToast`
**Location**: `admin/src/pages/Settings.tsx`

---

### admin/src/pages/Email.tsx

| Export | Signature | Description |
|---|---|---|
| `Email` | `() => JSX` | Email campaign composer. Two tabs: Compose and History. Compose: audience segment picker (from `lib/segments`), recipients preview, subject + HTML body textarea with preview modal, confirmation step before send. History: in-session log of sent campaigns. |

**Internal state:** `activeTab, selectedSegment, subject, body, sending, showConfirm, showPreview, showAllRecipients, sentLog`
**API used:** `sendCampaignEmail` (live, from `lib/api`)
**Deps:** `getSegments`, `getSegmentCustomers`, `sendCampaignEmail`, `useToast`
**Local type:** `SentEntry { segment, count, subject, timestamp }`
**Location**: `admin/src/pages/Email.tsx`

---

### admin/src/pages/Banner.tsx

| Export | Signature | Description |
|---|---|---|
| `Banner` | `() => JSX` | Promotional banner configuration. Fetches current config on mount (`GET /api/banner`). Fields: active toggle, text, image URL, link URL, link label. Live preview. Saves via `PUT /api/banner`. |

**Internal state:** `loading, saving, active, text, imageUrl, linkUrl, linkLabel`
**API used:** `fetchBanner`, `updateBanner` (live, from `lib/api`)
**Location**: `admin/src/pages/Banner.tsx`

---

### admin/src/pages/Pages.tsx

| Export | Signature | Description |
|---|---|---|
| `Pages` | `() => JSX` | Toggle under-construction status for 5 known storefront pages (privacy-policy, terms-of-service, refund-policy, changelog, roadmap). Fetches state on mount. Each toggle calls `PUT /api/pages/:slug` immediately on change. |

**Internal state:** `loading, pages: PageEntry[]`
**API used:** `fetchPages`, `updatePage` (live, from `lib/api`)
**Local type:** `PageEntry { slug, title, underConstruction, saving }`
**Location**: `admin/src/pages/Pages.tsx`

---

### admin/src/pages/UserInsights.tsx

| Export | Signature | Description |
|---|---|---|
| `UserInsights` | `() => JSX` | Thin wrapper that renders `<UserBehavior />` from `components/analytics/`. Displays page views, sessions, scroll depth, and user behavior analytics fetched from `GET /api/analytics/behavior`. |

**Location**: `admin/src/pages/UserInsights.tsx`

---

### admin/src/pages/SupportTickets.tsx

| Export | Signature | Description |
|---|---|---|
| `SupportTickets` | `() => JSX` | Support ticket list. Fetches live from `GET /api/support/tickets`. Status filter tabs (all/open/in_progress/resolved/closed). Client-side search over subject, customer name, and email. Navigates to `SupportTicketDetail` on row click. |

**Internal state:** `tickets, loading, statusFilter, search`
**API used:** `fetch('/api/support/tickets')` (direct, not via `lib/api`)
**Location**: `admin/src/pages/SupportTickets.tsx`

---

### admin/src/pages/SupportTicketDetail.tsx

| Export | Signature | Description |
|---|---|---|
| `SupportTicketDetail` | `() => JSX` | Single ticket view. Uses `:id` param. Fetches ticket + messages on mount. Message thread display with sender role badges. Reply form (disabled when ticket closed). Status and priority dropdowns that PATCH immediately to API. |

**Route param:** `:id`
**Internal state:** `ticket, messages, loading, reply, sending`
**API used:** `fetch('/api/support/tickets/:id')`, `fetch('/api/support/tickets/:id/messages', POST)`, `fetch('/api/support/tickets/:id', PATCH)` (direct, not via `lib/api`)
**Deps:** `useAuth` (for sender name in optimistic reply)
**Location**: `admin/src/pages/SupportTicketDetail.tsx`

---

### admin/src/pages/Newsletter.tsx

| Export | Signature | Description |
|---|---|---|
| `Newsletter` | `() => JSX` | Newsletter management. Fetches subscribers and enabled flag on mount. Toggle to show/hide signup section on storefront. Subscriber table with individual delete. CSV export. |

**Internal state:** `loading, enabled, togglingEnabled, subscribers, deletingEmail`
**API used:** `fetchNewsletterSubscribers`, `updateNewsletterSettings`, `deleteNewsletterSubscriber` (from `lib/api`)
**Location**: `admin/src/pages/Newsletter.tsx`

---

### admin/src/pages/AuditLog.tsx

| Export | Signature | Description |
|---|---|---|
| `AuditLog` | `() => JSX` | Paginated admin activity log. Resource-type filter. Optional GitHub commits panel (shown when `VITE_GITHUB_REPO` env is set). Relative timestamps with absolute on hover. Page size: 50. |

**Internal state:** `loading, logs, total, page, resourceType, commits, commitsLoading`
**API used:** `fetchAuditLogs`, `fetchGithubCommits` (from `lib/api`)
**Internal helpers:** `relativeTime(iso) => string`, `formatAbsolute(iso) => string`
**Location**: `admin/src/pages/AuditLog.tsx`

---

### admin/src/pages/Security.tsx

| Export | Signature | Description |
|---|---|---|
| `Security` | `() => JSX` | Real-time security dashboard. Auto-polls `GET /api/security/dashboard` every 30 seconds. Panels: attack status banner, stats row, event timeline chart (Recharts BarChart), top threat actors table with block/block-subnet/unblock actions, blocked traffic breakdown (by reason/country/UA class), rate limit by endpoint, bot detection feed, auth attack panel, banned IPs management, checkout impact, infrastructure health. CSV report download. |

**Internal state:** `loading, data, blockingIp, downloadingReport, lastRefresh`
**API used:** `fetchSecurityDashboard`, `fetchSecurityReport`, `blockIp`, `unblockIp` (from `lib/api`)
**Sub-components:** `StatCard` (local, not exported), multiple internal helpers `relativeTime`, `attackStatusColor`, `attackStatusLabel`, `scoreColor`, `shortBucket`
**External dep:** `recharts` (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `Legend`)
**Poll interval:** `POLL_INTERVAL = 30_000 ms`
**Location**: `admin/src/pages/Security.tsx`

---

### admin/src/pages/reports/ReportsHub.tsx

| Export | Signature | Description |
|---|---|---|
| `ReportsHub` | `() => JSX` | Reports landing page. Two report cards linking to FinanceReports and TaxReports. Shows revenue and tax collected for the last 30 days as teaser metrics. |

**Sub-component:** `ReportCard` (local, not exported)
**Deps:** `getOrders`, `formatPrice`
**Location**: `admin/src/pages/reports/ReportsHub.tsx`

---

### admin/src/pages/reports/FinanceReports.tsx

| Export | Signature | Description |
|---|---|---|
| `FinanceReports` | `() => JSX` | Full P&L report page. Period selector (uses `TIME_PERIODS` from `lib/analytics`). Three tables: Finance Summary (gross → net profit waterfall), Sales by Product (units/revenue/COGS/margin), Payments by Method. Each table has a CSV export button. |

**Internal state:** `activePeriod`
**Deps:** `getOrders`, `getFinanceSummary`, `getSalesByProduct`, `getPaymentsSummary`, `downloadCSV`
**Sub-component:** `SummaryRow` (local, not exported)
**Location**: `admin/src/pages/reports/FinanceReports.tsx`

---

### admin/src/pages/reports/TaxReports.tsx

| Export | Signature | Description |
|---|---|---|
| `TaxReports` | `() => JSX` | Tax reporting page. Year selector (2025/2026) and display-only tax rate input. Two tables: Quarterly Summary (Q1–Q4 gross income / tax / net) and Monthly Breakdown. Three CSV exports: quarterly, monthly, and full tax-filing export (one row per order). |

**Internal state:** `selectedYear, taxRate`
**Deps:** `getOrders`, `getTaxReport`, `getQuarterlyTaxSummary`, `getTaxFilingCSVRows`, `downloadCSV`
**Location**: `admin/src/pages/reports/TaxReports.tsx`

---

## Dependencies

### Internal (within admin/src)

```
main.tsx
  ├── contexts/AuthContext    (AuthProvider)
  ├── contexts/ThemeContext   (ThemeProvider)
  ├── components/ui/Toast     (ToastProvider)
  └── router.tsx              (router)

Pages → lib/mock-data         (getOrders, getProducts, getCustomers, etc.)
Pages → lib/hooks             (useOrders, useProducts, useCustomers)
Pages → lib/api               (fetchBanner, fetchSupportTickets, etc.)
Pages → lib/analytics         (TIME_PERIODS, getChartData, etc.)
Pages → lib/reports           (getFinanceSummary, getTaxReport, etc.)
Pages → lib/segments          (getSegments, getSegmentCustomers)
Pages → lib/csv               (downloadCSV, centsToDollars)
Pages → lib/utils             (formatPrice, formatDate, cn, toSlug)
Pages → lib/icons             (Home, Package, etc.)
Pages → contexts/AuthContext  (useAuth)
Pages → contexts/ThemeContext (useTheme, in layout components)
```

### External (npm packages)

| Package | Used in | Purpose |
|---|---|---|
| `react` / `react-dom` | All | UI framework |
| `react-router-dom` | `router.tsx`, all pages | Client-side routing (`createBrowserRouter`, `useParams`, `useNavigate`, `Link`) |
| `recharts` | `Security.tsx` | Bar chart for event timeline visualization |

### Environment Variables

| Variable | Default | Used in |
|---|---|---|
| `VITE_API_URL` | `'/api'` | `lib/api.ts`, `contexts/AuthContext.tsx`, `pages/Login.tsx` |
| `VITE_GITHUB_REPO` | `undefined` | `lib/api.ts` (`fetchGithubCommits`), `pages/AuditLog.tsx` |
| `import.meta.env.DEV` | Vite built-in | `pages/Login.tsx` (dev login button gate) |

---

## Architecture Notes

**Data sourcing pattern:** Most pages consume `lib/mock-data` directly via `lib/hooks` (for reactive filtering) or raw getter functions (for one-off lookups). Pages that need live data (`Banner`, `Pages`, `SupportTickets`, `SupportTicketDetail`, `Newsletter`, `AuditLog`, `Security`, `CustomerDetail`) call `lib/api` fetch functions in `useEffect`.

**Persistence:** There is no write-back to mock data. All "save" operations in product/collection/discount/settings pages are UI-only and trigger a toast. Only Banner, Pages, Newsletter, and Support endpoints actually persist data through the API.

**LocalStorage usage:** `OrderDetail` and `CustomerDetail` persist internal notes and tags to `localStorage` with the key pattern `pixelcart:{type}:{id}`.

**Auth guard flow:** `main.tsx` wraps everything in `AuthProvider` which fetches `/api/auth/me` on mount. `RequireAuth` component (in `components/auth/`) reads `useAuth()` and redirects to `/admin/login` while `loading=true` or when `user=null`.

**Theme system:** `ThemeContext` is the outermost provider (outside `AuthProvider`), ensuring the theme is resolved before any content renders. The `.dark` class is toggled on `document.documentElement`.
