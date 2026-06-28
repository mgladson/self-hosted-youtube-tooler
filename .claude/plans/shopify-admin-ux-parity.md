# Shopify Admin UX Parity — Implementation Plan

**Date:** 2026-03-03
**Status:** Draft
**Goal:** Close the gap between the current PixelCart admin and Shopify's admin UX, while retaining existing features unique to our platform (Email Campaigns, Banner Management, Analytics, User Insights, Finance/Tax Reports).

---

## Scope

This plan covers **admin frontend changes only** (the `admin/` workspace). Where new API endpoints are required (e.g., discounts CRUD, customer notes), those are noted but the API implementation is a separate concern. All data currently served from `mock-data.ts` remains mock — the goal is UX parity, not backend integration.

**Out of scope:** Marketing section, Content/CMS section, Sales Channels, Shopify Partners/Apps, physical shipping/inventory. These are either N/A for a digital-product storefront or low-priority based on the gap analysis.

---

## Phase 0 — Shared Data Hooks (prerequisite)

Before any UI work, centralize data access so that multiple components (Dashboard stats, Sidebar badge, OrderList, ActivityFeed, etc.) share a single source of truth instead of independently calling mock-data functions.

**New file:** `admin/src/lib/hooks.ts`

Provide custom hooks that wrap mock-data getters:
```
useOrders(filters?)   → { orders, total, pending, processing, completed, refunded }
useProducts(filters?) → { products, total, drafts, active, archived }
useCustomers(filters?) → { customers, total }
```

Each hook calls the underlying `getOrders()` / `getProducts()` / `getCustomers()` from `mock-data.ts`, applies optional filters (status, search, date range), and returns both the filtered list and derived counts. This achieves:
- **Single call site** — components import hooks, never call `mock-data.ts` directly
- **Consistent counts** — Dashboard, Sidebar badge, and list pages all derive from the same data
- **Easy API swap** — when the backend is wired, change the hook internals from mock-data calls to `fetch()` calls without touching any consuming component

All subsequent phases use these hooks instead of importing from `mock-data.ts` directly.

**Files touched:** one new file (`admin/src/lib/hooks.ts`).

---

## Phase 1 — Foundational Table UX (cross-cutting)

Upgrade the shared `Table` component and add reusable primitives that every list page will use. This unblocks all subsequent phases.

### 1.1 Enhanced Table Component (`components/ui/Table.tsx`)

**Changes to existing file:**
- Add a **`rowKey: (item: T) => string`** prop (required) to replace the current `key={i}` index-based row keying. All consuming list pages must provide a key extractor (e.g., `(order) => order.id`). This ensures React correctly reconciles rows when sort order changes, preventing unnecessary DOM re-renders and preserving selection/animation state.
- Add **checkbox column** as an opt-in prop (`selectable?: boolean`). Header checkbox toggles select-all for current page. Each row gets a checkbox. Selected row IDs exposed via `onSelectionChange(ids: string[])` callback.
- Add **sortable columns** opt-in per column (`sortable?: boolean` on `Column<T>`). Clicking a sortable header toggles asc → desc → none. Visual indicator: chevron up/down icon. Sort state managed internally with `onSortChange(key: string, dir: 'asc' | 'desc' | null)` callback for server-side sorting, or built-in client-side sort when data is local.
- Add **pagination** as a footer sub-component. Props: `page`, `pageSize`, `total`, `onPageChange`. Display: "Showing 1-25 of 142" with prev/next buttons. Default `pageSize = 25`. Replace the current "Showing X of Y" text footer.

**Sort/pagination/filter interaction rules (applies to all list pages):**
- Changing the active tab or filter **resets pagination to page 1** and **clears sort state** (returns to default order).
- Changing sort within a tab **resets pagination to page 1** (user sees sorted results from the start).
- Changing page preserves the current sort and filter state.
- Clearing the search input resets pagination to page 1 but preserves tab/sort.
- Bulk selection is **cleared** on any tab change, page change, or sort change.

### 1.2 Bulk Actions Bar

**New component:** `components/ui/BulkActionsBar.tsx`

When ≥1 row is selected, a sticky bar appears above the table with: "{N} selected" label + action buttons (e.g., "Delete", "Archive", "Export selected"). Actions are passed as props from the parent page. Bar disappears when selection is cleared.

### 1.3 Column Visibility Toggle

**New component:** `components/ui/ColumnToggle.tsx`

A dropdown button ("Columns") that lists all available columns with checkboxes. Toggling a checkbox shows/hides that column. State stored in component — no persistence needed for v1.

**Files touched:** `admin/src/components/ui/Table.tsx` (edit), two new component files.

---

## Phase 2 — Global Search (Cmd+K)

### 2.1 Search Modal

**New component:** `components/shared/CommandPalette.tsx`

- Triggered by clicking the search input in TopBar OR pressing `Cmd+K` / `Ctrl+K`
- Modal overlay with a single search input at top
- Searches across: Products (by name), Orders (by order number or customer name), Customers (by name or email), Pages (static nav: Dashboard, Analytics, Settings, etc.)
- Results grouped by category with icons, max 5 results per category
- Keyboard navigation: arrow keys to move, Enter to navigate, Esc to close
- **Data source abstraction:** Define a `SearchProvider` interface in `lib/search.ts`:
  ```
  type SearchResult = { type: 'product' | 'order' | 'customer' | 'page'; id: string; label: string; sublabel?: string; href: string };
  type SearchProvider = { search(query: string): Promise<SearchResult[]> };
  ```
  Implement `MockSearchProvider` that wraps the existing `mock-data.ts` getter functions. The `CommandPalette` consumes only the `SearchProvider` interface — never calls mock-data directly. When the API is wired up, swap in an `ApiSearchProvider` that calls `GET /api/admin/search?q=` without changing the component.

### 2.2 TopBar Updates

**Edit:** `admin/src/components/layout/TopBar.tsx`

- Replace the static `<input>` with a clickable div that opens the CommandPalette
- Show "Search... ⌘K" placeholder text
- Add store name next to user avatar in top-right

### 2.3 Keyboard Shortcut Registration

**Edit:** `admin/src/components/layout/AdminLayout.tsx`

- Register `Cmd+K` / `Ctrl+K` listener inside a `useEffect` with proper cleanup (return `removeEventListener` in the cleanup function)
- Call `e.preventDefault()` only when the CommandPalette opens (prevents browser address-bar hijack in Chrome/Safari)
- **Suppress when focused on input/textarea/select:** Check `document.activeElement` — if `el.isContentEditable` or `['INPUT','TEXTAREA','SELECT'].includes(el.tagName)`, do not open the palette (unless the active element is the CommandPalette's own search input)
- Test in Chrome, Safari, and Firefox for shortcut conflicts

**Files touched:** `TopBar.tsx` (edit), `AdminLayout.tsx` (edit), one new component file, one new `lib/search.ts` file.

---

## Phase 3 — Dashboard Upgrade

### 3.1 Personalized Greeting + Period Selector

**Edit:** `admin/src/pages/Dashboard.tsx`

- Replace "Dashboard" heading with "Good morning, {user.name}" (time-of-day aware: morning/afternoon/evening)
- Add a `PeriodSelector` (already exists as `components/ui/PeriodSelector.tsx`) below the greeting
- Filter all dashboard stats by selected period

### 3.2 Enhanced KPI Cards

**Edit:** `admin/src/pages/Dashboard.tsx`

Replace the current 4 StatCards with period-aware metrics:
- **Total Sales** (revenue in period, with % change vs previous period)
- **Total Orders** (count in period, with % change)
- **Conversion Rate** (orders / unique sessions, if analytics data available — otherwise show avg order value)
- **Sessions** (from analytics data if available — otherwise show customer count with % change)

Each card should show a mini sparkline (reuse or simplify the chart components from `analytics/`).

### 3.3 Sales Chart

**New section in Dashboard:**

Add a revenue-over-time line chart (reuse `RevenueChart` component from analytics) below the KPI cards. Show current period solid line + previous period dotted line for comparison.

### 3.4 Activity Feed

**New component:** `components/dashboard/ActivityFeed.tsx`

Replaces the "Quick Actions" card in the right sidebar. Shows actionable items:
- "X orders pending" → links to `/admin/orders` filtered to pending
- "X orders processing" → links to `/admin/orders` filtered to processing
- "X products in draft" → links to `/admin/products` (draft filter)

Each item: icon + text + count + chevron. Clicking navigates to the relevant filtered list. Data sourced from `useOrders()` and `useProducts()` hooks (Phase 0).

Keep the "View Storefront" and "Add Product" quick action buttons below the activity feed.

**Files touched:** `Dashboard.tsx` (edit), one new component file.

---

## Phase 4 — Orders Enhancements

### 4.1 Order Summary Metrics Bar

**New component:** `components/orders/OrderMetricsBar.tsx`

Horizontal bar at top of OrderList showing 4-5 metrics in pill-shaped cards:
- Total Orders (count)
- Pending (count)
- Completed (count)
- Total Revenue (sum)
- Avg Order Value

Each metric card: label, big number, optional sparkline. Styled like Shopify's green metrics bar at the top of the orders page.

### 4.2 Order List Table Upgrades

**Edit:** `admin/src/pages/OrderList.tsx`

- Enable `selectable` on the Table for bulk selection
- Add `sortable` to Date, Total, and Status columns
- Enable pagination (page size 25)
- Add a "Fulfillment" column with badge (for digital products: "Delivered" if completed, "Pending" if not — maps from order status)
- Add filter dropdown button next to tabs for multi-criteria filtering (Payment Status, Date Range)

### 4.3 Order Detail Enhancements

**Edit:** `admin/src/pages/OrderDetail.tsx`

- Add **Notes** section: a textarea at the bottom of the right sidebar for internal notes. Notes persisted to `localStorage` under key `pixelcart:notes:order:{id}` — loaded on mount via `useState(() => localStorage.getItem(...))`, saved on blur via `localStorage.setItem(...)`. This survives page refreshes without an API. When the API is wired, replace localStorage reads/writes with API calls.
- Add **Timeline** section: a simple vertical timeline showing order events (Created → Payment received → Completed/Refunded). For v1, derive from order status + createdAt date. Show as a card below the Customer card.
- Add product thumbnail images next to line item names (use product images from mock data).

**Files touched:** `OrderList.tsx` (edit), `OrderDetail.tsx` (edit), one new component.

---

## Phase 5 — Customer Enhancements

### 5.1 Customer Detail Page

**New page:** `admin/src/pages/CustomerDetail.tsx`
**New route:** `{ path: 'customers/:id', element: <CustomerDetail /> }`

Layout (2-column like Shopify):
- **Left (2/3):** Order history table (all orders from this customer, reuse Order table columns), Notes section (textarea, persisted to `localStorage` under key `pixelcart:notes:customer:{id}` — loaded on mount, saved on blur)
- **Right (1/3):** Customer profile card (avatar initials, name, email, joined date, total spent, total orders), Tags section (pill input, persisted to `localStorage` under key `pixelcart:tags:customer:{id}`)

### 5.2 Customer List → Row Click

**Edit:** `admin/src/pages/CustomerList.tsx`

- Add `onRowClick` handler to navigate to `/admin/customers/{id}`
- Enable `selectable` on Table
- Enable pagination

### 5.3 Segments Page

**New page:** `admin/src/pages/Segments.tsx`
**New route:** `{ path: 'customers/segments', element: <Segments /> }`

Display the existing segments from `lib/segments.ts` as a table:
- Columns: Segment Name, Size (count), Description
- Each row shows a bar visualization of segment size as % of total customers (like Shopify's green bar)
- Clicking a segment navigates to the customer list filtered by that segment (add query param support to CustomerList)

### 5.4 Sidebar (deferred to Phase 8)

Sidebar changes for the Segments sub-item are deferred to Phase 8, which restructures all nav groups in a single pass to avoid merge conflicts.

**Files touched:** `CustomerList.tsx` (edit), `router.tsx` (edit), two new page files.

---

## Phase 6 — Discounts Section (UI Prototype)

> **Status note:** This phase builds the admin UI only. Discounts will not affect checkout pricing until a follow-up phase wires the API (`POST /api/discounts`, `GET /api/discounts/:code/validate`) and integrates discount validation into the checkout flow. The UI should display a subtle "Preview — discounts are not yet active in checkout" banner at the top of the Discounts pages until the API integration is complete.

### 6.1 Discount Data Model (mock)

**Edit:** `admin/src/lib/mock-data.ts`

Add new types and mock data:
```
type Discount = {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number; // percentage (0-100) or cents
  minOrderAmount?: number;
  maxUses?: number;
  currentUses: number;
  startsAt: string;
  endsAt?: string;
  active: boolean;
  createdAt: string;
};
```

Seed 5-8 mock discounts.

### 6.2 Discount List Page

**New page:** `admin/src/pages/DiscountList.tsx`
**New route:** `{ path: 'discounts', element: <DiscountList /> }`

Table with columns: Code, Type (badge: "Percentage" / "Fixed"), Value, Usage (X / max or unlimited), Status (Active/Expired/Scheduled), Dates.
- Search by code
- Tabs: All, Active, Expired, Scheduled
- "Create discount" CTA button
- Enable selectable, sortable, pagination

### 6.3 Discount Create/Edit Page

**New page:** `admin/src/pages/DiscountDetail.tsx`
**New routes:** `{ path: 'discounts/new', element: <DiscountDetail /> }`, `{ path: 'discounts/:id', element: <DiscountDetail /> }`

Form fields:
- Discount code (text input with "Generate random" button)
- Type (radio: Percentage / Fixed amount)
- Value (number input, dynamic label "%" or "$")
- Minimum order amount (optional number)
- Usage limits: Max total uses (optional), one per customer checkbox
- Active dates: Start date, End date (optional)
- Status toggle (active/inactive)

Two-column layout: form on left, summary card on right showing a preview of how the discount will appear to customers.

### 6.4 Sidebar (deferred to Phase 8)

Sidebar changes for the Discounts nav item are deferred to Phase 8, which restructures all nav groups in a single pass.

**Files touched:** `mock-data.ts` (edit), `router.tsx` (edit), two new page files.

---

## Phase 7 — Product Detail Enhancements

### 7.1 SEO Preview Card

**New component:** `components/products/SEOPreview.tsx`

Card on the product detail page showing a Google-style search result preview:
- Page title (editable, defaults to product name)
- URL slug (editable, derived from product slug)
- Meta description (editable, defaults to product description truncated to 160 chars)

Rendered as a realistic Google snippet with blue title, green URL, gray description.

### 7.2 Sticky Bottom Action Bar

**New component:** `components/ui/StickyActionBar.tsx`

Fixed bar at bottom of viewport on edit pages (Product Detail, Discount Detail, Collection Detail, Settings):
- Left: "Unsaved changes" indicator (only visible when form is dirty)
- Right: "Discard" (ghost button) + "Save" (primary button)
- Also includes: "Archive" and "Delete" buttons (destructive, left-aligned) for product/discount detail

Replaces the current top-right Save/Cancel buttons.

### 7.3 Image Gallery Improvements

**Edit:** `admin/src/pages/ProductDetail.tsx`

- Add image upload placeholder (dropzone area with "Click or drag to upload" — non-functional for v1, just the UI)
- Show images in a reorderable grid (drag-and-drop visual, can use CSS-only reorder indicators for v1 without actual DnD library)
- "Set as primary" button on non-primary images

### 7.4 Collections Pages Polish

**Edit:** `admin/src/pages/CollectionList.tsx`
- Add search filtering to the card grid (filter by collection name)
- Add pagination if collection count exceeds 12

**Edit:** `admin/src/pages/CollectionDetail.tsx`
- Integrate `StickyActionBar` (from Phase 7.2) to replace any inline save buttons
- Ensure visual consistency with the updated Product Detail layout

**Files touched:** `ProductDetail.tsx` (edit), `CollectionList.tsx` (edit), `CollectionDetail.tsx` (edit), two new component files.

---

## Phase 8 — Sidebar & Navigation Polish

### 8.1 Collapsible Nav Groups

**Edit:** `admin/src/components/layout/Sidebar.tsx`

Restructure navigation into groups with collapsible sub-items. This is the single point where all nav additions from earlier phases are incorporated (Segments from Phase 5, Discounts from Phase 6):
- **Home** (Dashboard) — no sub-items
- **Orders** — sub-items: All Orders (the current OrderList)
- **Products** — sub-items: All Products, Collections
- **Customers** — sub-items: All Customers, Segments (new route from Phase 5)
- **Discounts** — no sub-items (new nav item, tag/ticket icon, positioned after Customers per Shopify order — from Phase 6)
- **Analytics** — no sub-items (revenue, sales, conversion metrics)
- **User Insights** — no sub-items (page views, sessions, bounce rate, behavior flow)

Separator, then:
- **Email** — no sub-items
- **Banner** — no sub-items

Separator, then:
- **Reports** section label: Finance Reports, Tax Reports

Bottom:
- **Settings**

Collapsible groups use a chevron icon that rotates. Active sub-item auto-expands its parent. Store collapsed state in localStorage under namespaced key `pixelcart:sidebar:collapsed` (avoids conflicts with other apps on the same origin).

### 8.2 Nav Badge Counts

**Edit:** `admin/src/components/layout/Sidebar.tsx`

Add a count badge next to "Orders" showing the number of pending/processing orders. Badge styled as a small rounded pill (like Shopify's green badge).

Data source: `useOrders()` hook (Phase 0) — derive pending + processing count from the returned `pending` and `processing` fields.

**Files touched:** `Sidebar.tsx` (edit only).

---

## Phase 9 — UX Polish Pass

### 9.1 Status Badge Style Update

**Edit:** `admin/src/components/ui/Badge.tsx`

Add a `dot` variant or prop that renders as: colored dot (●) + text, instead of the current filled-background pill. Use for order payment/fulfillment statuses to match Shopify's pattern. Keep the current pill style available for other contexts.

### 9.2 Notification Dropdown

**Edit:** `admin/src/components/layout/TopBar.tsx`
**New component:** `components/layout/NotificationDropdown.tsx`

Clicking the bell icon opens a dropdown panel showing recent events:
- Recent orders (last 5)
- Low stock alerts (if applicable)
- System notifications

For v1, populate from mock data. Show "No new notifications" empty state.

### 9.3 Loading Skeletons

**New component:** `components/ui/Skeleton.tsx`

Provide `Skeleton` primitives (rect, circle, text line) that pulse-animate. Replace spinner loading states in Banner and any other async-loaded pages. Add skeleton loading states to Dashboard in preparation for future async API integration.

### 9.4 Empty States

**New component:** `components/ui/EmptyState.tsx`

Reusable empty state with: illustration (simple SVG), heading, description, CTA button. Use in: OrderList (no orders), ProductList (no products), CustomerList (no customers), DiscountList (no discounts).

**Files touched:** `Badge.tsx` (edit), `TopBar.tsx` (edit), three new component files.

---

## Phase 10 — Existing Features UX Alignment

These features are unique to our admin. Retain functionality, improve visual consistency.

### 10.1 Reports Hub Page

**New page:** `admin/src/pages/reports/ReportsHub.tsx`
**New route:** `{ path: 'reports', element: <ReportsHub /> }`

Card-based overview (matching Shopify's Reports page from image 07.05.33):
- **Finance** card: 30-day revenue number + sparkline + links to "Finance Reports"
- **Tax** card: 30-day tax collected + sparkline + links to "Tax Reports"
- **Sales** card: Orders count + sparkline

Each card: title, description, key metric, mini sparkline, "View report" link. Clicking drills into the existing report page.

Update sidebar to show "Reports" as a collapsible group with sub-items: Overview (hub), Finance, Tax.

### 10.2 Email Campaigns — Campaign History

**Edit:** `admin/src/pages/Email.tsx`

Add a "History" tab alongside the compose view showing past campaigns (persisted in the `sentLog` — for v1, session-only is fine). Table columns: Date, Segment, Recipients, Subject. This provides a Shopify-like campaign management feel.

### 10.3 Split Analytics into Analytics + User Insights

Currently `Analytics.tsx` is a single page with two tabs (Overview, User Behavior). Split into two distinct top-level pages:

**Edit:** `admin/src/pages/Analytics.tsx`
- Remove the tab system and the User Behavior tab
- Keep only the revenue/sales content (the existing `AnalyticsOverview` component)
- Add a summary card at the top: 30-day revenue total + sparkline
- This page now focuses exclusively on revenue, sales, and conversion metrics

**New page:** `admin/src/pages/UserInsights.tsx`
**New route:** `{ path: 'insights', element: <UserInsights /> }`
- Uses the existing `UserBehavior` component as its content
- Add a summary card at the top: 30-day page views + sparkline
- Header: "User Insights" with subtitle "Page views, sessions, and visitor behavior"
- This page owns all behavior/traffic data: page views, sessions, bounce rate, behavior flow

Both pages get the same visual treatment as other top-level sections (period selector, summary cards).

**Files touched:** `Email.tsx` (edit), `Analytics.tsx` (edit), `Sidebar.tsx` (edit), `router.tsx` (edit), one new page file (`UserInsights.tsx`), one new page file (`ReportsHub.tsx`).

---

## Implementation Order & Dependencies

```
Phase 0 (Hooks) ──→ Phase 1 (Table UX) ──→ Phase 2 (Search) ──→ Phase 3 (Dashboard)
                          │                                            │
                          ├──→ Phase 4 (Orders) ─────────────────────→ │
                          ├──→ Phase 5 (Customers) ──────────────────→ │
                          └──→ Phase 6 (Discounts) ──────────────────→ │
                                                                        ↓
                                                                Phase 7 (Products)
                                                                        │
                                                                Phase 8 (Sidebar)
                                                                        │
                                                                Phase 9 (Polish)
                                                                        │
                                                                Phase 10 (Existing Features)
```

Phase 0 (data hooks) is the true prerequisite — all components consume hooks instead of calling mock-data directly. Phase 1 (Table UX) is the critical path for all list pages. Phases 2-6 can be parallelized after Phase 1. Phases 7-10 are sequential polish.

---

## Files Summary

### New files (18):
- `admin/src/lib/hooks.ts` (useOrders, useProducts, useCustomers)
- `admin/src/lib/search.ts` (SearchProvider interface + MockSearchProvider)
- `admin/src/components/ui/BulkActionsBar.tsx`
- `admin/src/components/ui/ColumnToggle.tsx`
- `admin/src/components/ui/StickyActionBar.tsx`
- `admin/src/components/ui/Skeleton.tsx`
- `admin/src/components/ui/EmptyState.tsx`
- `admin/src/components/shared/CommandPalette.tsx`
- `admin/src/components/dashboard/ActivityFeed.tsx`
- `admin/src/components/orders/OrderMetricsBar.tsx`
- `admin/src/components/products/SEOPreview.tsx`
- `admin/src/components/layout/NotificationDropdown.tsx`
- `admin/src/pages/CustomerDetail.tsx`
- `admin/src/pages/Segments.tsx`
- `admin/src/pages/DiscountList.tsx`
- `admin/src/pages/DiscountDetail.tsx`
- `admin/src/pages/UserInsights.tsx`
- `admin/src/pages/reports/ReportsHub.tsx`

### Edited files (17):
- `admin/src/components/ui/Table.tsx`
- `admin/src/components/ui/Badge.tsx`
- `admin/src/components/layout/TopBar.tsx`
- `admin/src/components/layout/AdminLayout.tsx`
- `admin/src/components/layout/Sidebar.tsx`
- `admin/src/pages/Dashboard.tsx`
- `admin/src/pages/OrderList.tsx`
- `admin/src/pages/OrderDetail.tsx`
- `admin/src/pages/ProductList.tsx`
- `admin/src/pages/ProductDetail.tsx`
- `admin/src/pages/CustomerList.tsx`
- `admin/src/pages/CollectionList.tsx`
- `admin/src/pages/CollectionDetail.tsx`
- `admin/src/pages/Email.tsx`
- `admin/src/pages/Analytics.tsx`
- `admin/src/lib/mock-data.ts`
- `admin/src/router.tsx`

### No new dependencies required
All features built with existing stack: React 19, React Router, Tailwind CSS, and existing custom components. No new npm packages.

---

## Success Criteria

1. Every list page (Orders, Products, Customers, Discounts) has: checkbox selection, sortable columns, pagination (25/page), bulk actions bar
2. Cmd+K opens a search modal that finds products, orders, customers, and navigates on selection
3. Dashboard shows personalized greeting, period-selectable KPI cards, sales chart, and activity feed
4. Discounts section allows create/edit/list discount codes with type, value, limits, and scheduling
5. Customer detail page shows profile, order history, and notes
6. Product detail has SEO preview card, sticky save bar, and image upload placeholder
7. Sidebar has collapsible groups with sub-items and order count badge
8. All existing features (Email, Banner, Analytics, Finance/Tax Reports) retain full functionality with improved visual consistency
