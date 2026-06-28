# C4 Component -- Admin Dashboard

## 1. Overview

| Field | Value |
|---|---|
| **Name** | Admin Dashboard |
| **Type** | Web Application (Single-Page Application) |
| **Technology** | Vite 6, React 19, TypeScript, Tailwind CSS, React Router, Recharts |
| **Location** | `admin/` |
| **Deployment** | Docker container, port 3002, served via Caddy reverse proxy at `http://localhost/admin/` |
| **Base Path** | `/admin/` (configured in Vite) |

---

## 2. Purpose

Single-page application for store administrators. Provides product management, order management, analytics, security monitoring, support ticket management, email dispatch, newsletter management, and system configuration. All authenticated pages are protected by a Google OAuth session managed by the API server. A development-mode bypass login is available for local testing.

---

## 3. Software Features

### 3.1 Dashboard Overview

Landing page with summary stat cards (products, revenue, orders, customers), a time-period selector (7d/30d/90d/12m), a revenue chart, a recent orders table, an activity feed, and quick action links. Compares current period metrics against the prior equal-length period to show percentage changes.

### 3.2 Product Management

- **Product List** -- Paginated, filterable, sortable product table with category tabs, text search, column sort (price, date), bulk row selection, and CSV export.
- **Product Detail** -- Edit form for an existing product (by slug). Sections: Product Info, Media gallery with primary image selection, Pricing, Organization, URL/SEO with live Google search preview. Sticky save/discard/delete action bar.
- **Product Create** -- New product form with auto-generated slug from name (lockable), validation on name/price/slug, and default status `draft`.

### 3.3 Collection Management

- **Collection List** -- Card grid of collections with image, name, product count, and Featured badge. Text search and pagination (9 per page).
- **Collection Detail** -- Edit form for a collection (by slug). Fields: name, slug, description, image URL, product membership table. Sticky save/discard/delete bar.

### 3.4 Order Management

- **Order List** -- Full-featured order table with status tabs (All/Pending/Processing/Completed/Refunded), sortable columns, column visibility toggle, bulk selection, and CSV export. Includes an order metrics summary bar.
- **Order Detail** -- Single order view (by ID). Line items table with price/cost/profit per item, financial summary (subtotal, discount, tax, total, COGS, processing fee, net profit), customer card, order timeline, metadata, and internal notes (persisted to `localStorage`).

### 3.5 Customer Management

- **Customer List** -- Paginated, searchable customer table with bulk selection and CSV export.
- **Customer Detail** -- Customer profile (by ID) with two tabs: Overview (order history, notes) and Support Tickets (fetched live from API). Sidebar with avatar, status badge, stats, and editable tags. Notes and tags persisted to `localStorage`.
- **Segments** -- Read-only segment overview showing 7 predefined customer segments (All, Refund Requested, Refunded, Happy, Inactive, High Spenders, New) with counts and distribution bars.

### 3.6 Discount Management

- **Discount List** -- Discount code table with status tabs (All/Active/Expired/Scheduled), text search, sortable columns, and bulk selection.
- **Discount Detail** -- Create or edit a discount code. Fields: code (with random generation), type (percentage/fixed), value, min order, max uses, date range, active toggle. Live summary preview panel.

### 3.7 Analytics

- **Analytics Overview** -- Period selector across 10 predefined time ranges. Four metric cards, revenue area chart (Recharts), margin combo chart (bars + lines), period summary table, and period-vs-period comparison grid.
- **User Insights** -- Behavior analytics fetched live from `GET /api/analytics/behavior`. Four metric cards plus six sub-visualizations: page views chart, scroll depth chart, engagement by page, top clicked elements, element visibility ranking, and top pages table. Includes a geographic distribution world map with country-level bubbles.

### 3.8 Email Campaigns

Compose tab with audience segment picker (7 segments from customer segmentation), recipients preview, subject/body editor with HTML preview modal, and confirmation step. History tab logs sent campaigns in-session. Sends via `POST /api/email/send`.

### 3.9 Banner Configuration

Promotional banner management with live preview. Fields: active toggle, text, image URL, link URL, link label. Fetches current config from API on mount, saves via `PUT /api/banner`.

### 3.10 Page Visibility

Toggle under-construction status for 5 storefront pages (privacy-policy, terms-of-service, refund-policy, changelog, roadmap). Each toggle immediately calls `PUT /api/pages/:slug`.

### 3.11 Support Tickets

- **Ticket List** -- Fetched live from API. Status filter tabs (all/open/in_progress/resolved/closed). Client-side search over subject, customer name, and email.
- **Ticket Detail** -- Message thread with sender role badges, reply form (disabled when closed), and status/priority dropdowns that PATCH immediately to the API.

### 3.12 Newsletter Management

Subscriber list with enabled/disabled toggle for the storefront signup section. Individual subscriber delete. CSV export. All operations go through `GET/PUT/DELETE` newsletter API endpoints.

### 3.13 Reports

- **Reports Hub** -- Landing page with teaser metrics (last-30-day revenue and tax collected) linking to Finance and Tax reports.
- **Finance Reports** -- Full P&L report with period selector. Three tables: Finance Summary (gross-to-net profit waterfall), Sales by Product (units/revenue/COGS/margin), Payments by Method. Each with CSV export.
- **Tax Reports** -- Year selector (2025/2026). Quarterly summary (Q1-Q4 gross income/tax/net) and monthly breakdown tables. Three CSV exports: quarterly, monthly, and full per-order tax filing.

### 3.14 Audit Log

Paginated admin activity log (page size 50). Resource-type filter. Optional GitHub commits panel when `VITE_GITHUB_REPO` is configured. Relative timestamps with absolute on hover.

### 3.15 Security Dashboard

Real-time security monitoring. Auto-polls `GET /api/security/dashboard` every 30 seconds. Panels: attack status banner, stats row, event timeline chart (Recharts BarChart), top threat actors table with block/unblock actions, blocked traffic breakdown (by reason/country/UA class), rate limit by endpoint, bot detection feed, auth attack panel, banned IP management, checkout impact, infrastructure health. CSV security report download.

### 3.16 Settings

Store settings form (UI only, no API persistence). Sections: Store Information (name, URL, email), Payments (provider, currency), Notifications (4 checkboxes). Save triggers a toast.

### 3.17 Authentication

Login page with Google OAuth link (`GET /api/auth/google`). Development mode adds a "Dev Login" button (`POST /api/auth/dev-login`). Reads `?error` query parameter for error display. Redirects to `/admin` if already authenticated.

---

## 4. Code Elements

This component is documented at the C4 Code level in two files:

| Code-Level Document | Scope |
|---|---|
| [c4-code-admin-src-core.md](c4-code-admin-src-core.md) | Entry point (`main.tsx`), router, contexts (Auth, Theme), library modules (`api.ts`, `hooks.ts`, `utils.ts`, `analytics.ts`, `csv.ts`, `reports.ts`, `segments.ts`, `search.ts`, `mock-data.ts`, `geo-data.ts`, `icons.tsx`), and all 26 page components |
| [c4-code-admin-src-components.md](c4-code-admin-src-components.md) | Reusable UI components organized into 8 subdirectories: `ui/` (design system primitives), `layout/` (application shell), `auth/` (route guard), `analytics/` (revenue/margin/behavior charts), `orders/` (metrics bar), `products/` (SEO preview), `dashboard/` (activity feed), `shared/` (breadcrumbs, command palette) |

---

## 5. Interfaces

### 5.1 Admin Routes (26 total)

All routes share the `/admin` prefix. Routes under the root `/admin` path (except `/admin/login`) are wrapped by `RequireAuth` (redirects unauthenticated users) and `AdminLayout` (persistent sidebar + topbar shell).

| # | Path | Page Component | Notes |
|---|---|---|---|
| 1 | `/admin/login` | `Login` | Public, no auth guard |
| 2 | `/admin` (index) | `Dashboard` | Default landing page |
| 3 | `/admin/analytics` | `Analytics` | Wraps `AnalyticsOverview` |
| 4 | `/admin/products` | `ProductList` | |
| 5 | `/admin/products/new` | `ProductCreate` | |
| 6 | `/admin/products/:slug` | `ProductDetail` | |
| 7 | `/admin/collections` | `CollectionList` | |
| 8 | `/admin/collections/:slug` | `CollectionDetail` | |
| 9 | `/admin/orders` | `OrderList` | |
| 10 | `/admin/orders/:id` | `OrderDetail` | |
| 11 | `/admin/customers` | `CustomerList` | |
| 12 | `/admin/customers/segments` | `Segments` | |
| 13 | `/admin/customers/:id` | `CustomerDetail` | |
| 14 | `/admin/discounts` | `DiscountList` | |
| 15 | `/admin/discounts/new` | `DiscountDetail` | `isNew=true` (create mode) |
| 16 | `/admin/discounts/:id` | `DiscountDetail` | Edit mode |
| 17 | `/admin/email` | `Email` | |
| 18 | `/admin/banner` | `Banner` | |
| 19 | `/admin/pages` | `Pages` | |
| 20 | `/admin/insights` | `UserInsights` | Wraps `UserBehavior` |
| 21 | `/admin/reports` | `ReportsHub` | |
| 22 | `/admin/reports/finance` | `FinanceReports` | |
| 23 | `/admin/reports/tax` | `TaxReports` | |
| 24 | `/admin/support` | `SupportTickets` | |
| 25 | `/admin/support/:id` | `SupportTicketDetail` | |
| 26 | `/admin/newsletter` | `Newsletter` | |
| 27 | `/admin/audit-log` | `AuditLog` | |
| 28 | `/admin/security` | `Security` | |
| 29 | `/admin/settings` | `SettingsPage` | |

> Note: The route tree contains 29 path entries including parameterized variants of products, collections, orders, customers, discounts, and support tickets. The 26-route count from the router definition groups `/admin/discounts/new` and `/admin/discounts/:id` as variants of the same route pattern.

### 5.2 API Calls Made

All API calls use `credentials: 'include'` for session cookie authentication. Base URL is `import.meta.env.VITE_API_URL || '/api'`.

#### Authentication

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `GET` | `/api/auth/me` | `AuthContext` (on mount) | Fetch current session user |
| `POST` | `/api/auth/logout` | `AuthContext` (`logout()`) | End session, redirect to login |
| `GET` | `/api/auth/google` | `Login` (link href) | Initiate Google OAuth flow |
| `POST` | `/api/auth/dev-login` | `Login` (dev mode only) | Bypass login for development |

#### Analytics

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `GET` | `/api/analytics/behavior?start=&end=` | `UserBehavior` | Fetch behavior analytics for a date range |

#### Banner

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `GET` | `/api/banner` | `Banner` | Fetch current banner configuration |
| `PUT` | `/api/banner` | `Banner` | Save banner configuration |

#### Pages

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `GET` | `/api/pages` | `Pages` | Fetch page visibility settings |
| `PUT` | `/api/pages/:slug` | `Pages` | Toggle page under-construction flag |

#### Email

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `POST` | `/api/email/send` | `Email` | Send bulk campaign email |

#### Support

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `GET` | `/api/support/tickets` | `SupportTickets` | List all tickets (optional status filter) |
| `GET` | `/api/support/tickets?customer_email=` | `CustomerDetail` | Tickets for a specific customer |
| `GET` | `/api/support/tickets/:id` | `SupportTicketDetail` | Fetch single ticket with messages |
| `POST` | `/api/support/tickets/:id/messages` | `SupportTicketDetail` | Post admin reply |
| `PATCH` | `/api/support/tickets/:id` | `SupportTicketDetail` | Update ticket status/priority |

#### Newsletter

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `GET` | `/api/newsletter/subscribers` | `Newsletter` | Fetch subscriber list and enabled flag |
| `PUT` | `/api/newsletter/settings` | `Newsletter` | Toggle signup visibility |
| `DELETE` | `/api/newsletter/subscribers/:email` | `Newsletter` | Remove a subscriber |

#### Audit Log

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `GET` | `/api/audit/logs?page=&resourceType=` | `AuditLog` | Paginated admin activity log |

#### Security

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `GET` | `/api/security/dashboard` | `Security` | Live security metrics (polled every 30s) |
| `GET` | `/api/security/report?start=&end=` | `Security` | Downloadable security report |
| `POST` | `/api/security/block` | `Security` | Block an IP address |
| `DELETE` | `/api/security/block/:ip` | `Security` | Unblock an IP address |

#### External

| Method | Endpoint | Used By | Description |
|---|---|---|---|
| `GET` | `api.github.com/repos/:repo/commits` | `AuditLog` | Recent GitHub commits (requires `VITE_GITHUB_REPO`) |

---

## 6. Dependencies

### 6.1 Runtime Dependencies

| Dependency | Type | Description |
|---|---|---|
| **API Server** | Internal service | All admin operations: authentication, banner/page config, support tickets, newsletter, audit log, security dashboard, email dispatch, analytics |
| **Google OAuth** | External service | Authentication flow initiated via API (`GET /api/auth/google`) |
| **GitHub API** | External service (optional) | Commit history in Audit Log page when `VITE_GITHUB_REPO` is configured |

### 6.2 NPM Package Dependencies

| Package | Purpose |
|---|---|
| `react` / `react-dom` | UI framework (React 19) |
| `react-router-dom` | Client-side routing (`createBrowserRouter`, `Link`, `NavLink`, `Navigate`, `Outlet`, `useParams`, `useNavigate`, `useLocation`) |
| `recharts` | Charting library for analytics and security visualizations (`AreaChart`, `ComposedChart`, `BarChart`, `Bar`, `Line`, `Area`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `ResponsiveContainer`) |
| `tailwindcss` | Utility-first CSS framework with custom design tokens (`bg-surface`, `text-accent`, `bg-sidebar`, `border-border`, etc.) |

### 6.3 Infrastructure Dependencies

| Dependency | Purpose |
|---|---|
| **Caddy** | Reverse proxy serving the SPA at `/admin/` and proxying `/api/*` requests |
| **Docker** | Container runtime for the admin build |
| **Vite** | Build tooling with base path `/admin/` |

### 6.4 Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `'/api'` | API server base URL |
| `VITE_GITHUB_REPO` | `undefined` | GitHub repository for commit history (e.g., `owner/repo`) |
| `import.meta.env.DEV` | Vite built-in | Gates the dev login button on the Login page |

---

## 7. Component Diagram

```
C4Component
  title Admin Dashboard -- Component Diagram

  Container_Boundary(admin, "Admin Dashboard SPA") {

    Component(router, "Router", "React Router", "createBrowserRouter with 29 route entries; wraps authenticated routes in RequireAuth + AdminLayout")

    Component_Boundary(layout, "Layout Components") {
      Component(adminLayout, "AdminLayout", "React Component", "Root shell: sidebar, topbar, main content outlet, scroll-to-top, command palette")
      Component(sidebar, "Sidebar", "React Component", "Fixed navigation with collapsible groups, user footer, logout, order badge count")
      Component(topbar, "TopBar", "React Component", "Header bar with hamburger, search trigger (Cmd+K), theme toggle, notifications, user avatar")
      Component(notifDropdown, "NotificationDropdown", "React Component", "Bell icon with pending order dropdown")
      Component(cmdPalette, "CommandPalette", "React Component", "Full-screen omnisearch overlay across products, orders, customers, pages")
    }

    Component(requireAuth, "RequireAuth", "React Component", "Route guard: redirects to /admin/login when unauthenticated")

    Component_Boundary(contexts, "Contexts") {
      Component(authCtx, "AuthContext", "React Context", "Session state (user, loading, logout); fetches GET /api/auth/me on mount")
      Component(themeCtx, "ThemeContext", "React Context", "Light/dark/system theme; persists to localStorage key pixelcart-admin-theme")
      Component(toastCtx, "ToastProvider", "React Context", "Notification toast queue with auto-dismiss (3s)")
    }

    Component_Boundary(pages, "Page Components (26 pages)") {
      Component(pgLogin, "Login", "React Component", "Google OAuth + dev login")
      Component(pgDashboard, "Dashboard", "React Component", "Overview stats, revenue chart, recent orders, activity feed")
      Component(pgAnalytics, "Analytics", "React Component", "Revenue/margin charts, period comparison, metric cards")
      Component(pgProducts, "Product Pages", "React Component", "ProductList, ProductDetail, ProductCreate")
      Component(pgCollections, "Collection Pages", "React Component", "CollectionList, CollectionDetail")
      Component(pgOrders, "Order Pages", "React Component", "OrderList, OrderDetail")
      Component(pgCustomers, "Customer Pages", "React Component", "CustomerList, CustomerDetail, Segments")
      Component(pgDiscounts, "Discount Pages", "React Component", "DiscountList, DiscountDetail")
      Component(pgInsights, "UserInsights", "React Component", "Behavior analytics with geo distribution")
      Component(pgEmail, "Email", "React Component", "Campaign composer with segment targeting")
      Component(pgBanner, "Banner", "React Component", "Promotional banner configuration")
      Component(pgPages, "Pages", "React Component", "Page visibility toggles")
      Component(pgSupport, "Support Pages", "React Component", "SupportTickets, SupportTicketDetail")
      Component(pgNewsletter, "Newsletter", "React Component", "Subscriber management")
      Component(pgReports, "Report Pages", "React Component", "ReportsHub, FinanceReports, TaxReports")
      Component(pgAuditLog, "AuditLog", "React Component", "Activity log with optional GitHub commits")
      Component(pgSecurity, "Security", "React Component", "Real-time security dashboard, IP blocking, threat actors")
      Component(pgSettings, "Settings", "React Component", "Store configuration form (UI only)")
    }

    Component_Boundary(analytics, "Analytics Components") {
      Component(analyticsOverview, "AnalyticsOverview", "React Component", "Period selector, metric cards, revenue/margin charts, comparison grid")
      Component(userBehavior, "UserBehavior", "React Component", "Behavior sub-charts: page views, scroll depth, engagement, clicks, visibility, geo map")
      Component(revenueChart, "RevenueChart", "Recharts AreaChart", "Revenue time series with rolling average line")
      Component(marginChart, "MarginChart", "Recharts ComposedChart", "Gross/net profit bars + margin % lines, dual Y-axes")
      Component(geoDistribution, "GeoDistribution", "SVG + React", "World map with proportional country bubbles, 4 metric tabs")
      Component(behaviorCharts, "Behavior Sub-Charts", "Recharts", "PageViewsChart, ScrollDepthChart, EngagementByPage, ElementVisibilityRanking, TopClickedElements, TopPagesTable")
    }

    Component_Boundary(uiLib, "UI Design System (17 primitives)") {
      Component(uiPrimitives, "UI Primitives", "React Components", "Button, Card, Input, Select, Textarea, Badge, Modal, Table, StatCard, Toast, Skeleton, EmptyState, PeriodSelector, BulkActionsBar, ColumnToggle, StickyActionBar, ScrollToTop, ThemeToggle")
    }

    Component_Boundary(lib, "Library Modules") {
      Component(apiLib, "api.ts", "TypeScript Module", "Typed fetch wrappers for all 21 API endpoints; credentials: include")
      Component(mockData, "mock-data.ts", "TypeScript Module", "Static dataset: 12 products, 5 collections, ~365 days of orders, 12 customers, 7 discounts")
      Component(hooksLib, "hooks.ts", "TypeScript Module", "useOrders, useProducts, useCustomers -- filter/aggregate over mock data")
      Component(analyticsLib, "analytics.ts", "TypeScript Module", "Time-bucketed revenue/cost/profit computations, period comparison")
      Component(reportsLib, "reports.ts", "TypeScript Module", "P&L, tax computation, product sales, payment method breakdown")
      Component(segmentsLib, "segments.ts", "TypeScript Module", "7 customer segments: all, refund-requested, refunded, happy, inactive, high-spenders, new")
      Component(csvLib, "csv.ts", "TypeScript Module", "Browser-side CSV generation and download via anchor click")
      Component(searchLib, "search.ts", "TypeScript Module", "Omnisearch across products, orders, customers, static pages")
      Component(utilsLib, "utils.ts", "TypeScript Module", "formatPrice, formatDate, formatNumber, cn, toSlug")
      Component(geoDataLib, "geo-data.ts", "TypeScript Module", "20 countries with visitor/registration/payment data and city-level regions")
      Component(iconsLib, "icons.tsx", "TypeScript Module", "34 inline SVG icon components (Lucide-style)")
    }
  }

  System_Ext(apiServer, "API Server", "Fastify 5 -- handles auth, data persistence, email, security, analytics")
  System_Ext(googleOAuth, "Google OAuth", "Identity provider for admin authentication")
  System_Ext(githubApi, "GitHub API", "Optional commit history for audit log")

  Rel(router, requireAuth, "Guards authenticated routes")
  Rel(requireAuth, adminLayout, "Wraps with layout shell")
  Rel(adminLayout, sidebar, "Renders")
  Rel(adminLayout, topbar, "Renders")
  Rel(adminLayout, cmdPalette, "Renders (Cmd+K)")
  Rel(adminLayout, pages, "Renders via Outlet")

  Rel(pages, apiLib, "Calls API functions")
  Rel(pages, mockData, "Reads static data")
  Rel(pages, hooksLib, "Filters/aggregates data")
  Rel(pages, analyticsLib, "Computes chart data")
  Rel(pages, reportsLib, "Generates P&L / tax reports")
  Rel(pages, segmentsLib, "Customer segmentation")
  Rel(pages, csvLib, "CSV export")
  Rel(pages, uiPrimitives, "Uses UI components")
  Rel(pages, contexts, "Reads auth/theme/toast state")

  Rel(analyticsOverview, revenueChart, "Renders")
  Rel(analyticsOverview, marginChart, "Renders")
  Rel(userBehavior, behaviorCharts, "Renders")
  Rel(userBehavior, geoDistribution, "Renders")

  Rel(apiLib, apiServer, "HTTP (fetch with credentials: include)", "JSON over HTTPS")
  Rel(pgLogin, googleOAuth, "Redirects to OAuth flow via API", "HTTPS")
  Rel(apiLib, githubApi, "Fetches commit history", "HTTPS (optional)")
```

---

## 8. Data Flow Patterns

### 8.1 Authentication Flow

```
User --> Login page --> GET /api/auth/google --> Google OAuth --> callback --> API sets session cookie
                    --> POST /api/auth/dev-login (dev only) --> API sets session cookie
AuthContext (mount) --> GET /api/auth/me --> { user } or 401
RequireAuth --> reads AuthContext --> allow or redirect to /admin/login
Logout --> POST /api/auth/logout --> redirect to /admin/login
```

### 8.2 Data Sourcing Pattern

The admin uses two distinct data sourcing strategies:

**Mock data (client-side only):** Products, collections, orders, customers, and discounts are sourced from `lib/mock-data.ts`. "Save" operations on these entities are UI-only (trigger a toast but do not persist). This includes the Dashboard, Analytics, Product, Collection, Order, Customer, Discount, Segments, and Reports pages.

**Live API data:** The following pages fetch and persist data through the API server: Banner, Pages, Support Tickets, Newsletter, Audit Log, Security, Email, User Insights (behavior analytics), and Customer Detail (support tickets tab).

### 8.3 Local Storage Usage

| Key Pattern | Used By | Data |
|---|---|---|
| `pixelcart-admin-theme` | `ThemeContext` | Theme preference (`light` / `dark` / `system`) |
| `pixelcart:notes:order:{id}` | `OrderDetail` | Internal order notes |
| `pixelcart:notes:customer:{id}` | `CustomerDetail` | Internal customer notes |
| `pixelcart:tags:customer:{id}` | `CustomerDetail` | Customer tags |
| `pixelcart:sidebar:collapsed` | `Sidebar` | Collapsed nav group state |

---

## 9. Architecture Notes

**Provider layering:** The React tree is wrapped in a strict provider order: `ThemeProvider` (outermost, ensures theme resolves before any render) > `AuthProvider` (fetches session on mount) > `ToastProvider` (notification queue) > `RouterProvider` (route tree).

**Route guard:** `RequireAuth` reads `useAuth()` from `AuthContext`. While `loading` is true, it renders a spinner. When `user` is null, it redirects to `/admin/login`. This component wraps all routes except the login page itself.

**Keyboard shortcuts:** `AdminLayout` registers a global `keydown` listener for `Cmd/Ctrl+K` to toggle the `CommandPalette` omnisearch overlay. The listener skips activation when focus is on input, textarea, select, or contenteditable elements.

**Security polling:** The Security page polls `GET /api/security/dashboard` every 30 seconds via `setInterval`, providing near-real-time threat monitoring without WebSocket infrastructure.

**Theme system:** `ThemeContext` supports three modes (`light`, `dark`, `system`). The `system` mode listens to the `prefers-color-scheme` media query. Theme changes toggle the `.dark` class on `document.documentElement` with a 300ms CSS transition gated by a `theme-transitioning` class.

**CSV export:** Multiple list pages (Products, Orders, Customers, Newsletter, Finance/Tax Reports) support CSV export via `lib/csv.ts`, which builds CSV strings in-browser and triggers downloads via a programmatic anchor click.
