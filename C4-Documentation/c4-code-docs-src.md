# C4 Code — docs/src

## Overview

- **Name**: Documentation Site (StackDocs)
- **Location**: `docs/src/`
- **Primary Language**: TypeScript / React (TSX)
- **Runtime**: Next.js 15 App Router
- **Purpose**: Developer and operator documentation site for the Stack commerce platform. Served at `/docs` (configured via `basePath: "/docs"` in `next.config.ts`). Dev server runs on port 3003.

---

## Content Structure

All content pages are plain TSX files authored as JSX prose. There is no MDX processing — all documentation copy lives inline as JSX markup within each page component.

### Route Map

| Route | File | Page Title | Description |
|---|---|---|---|
| `/docs/` | `src/app/page.tsx` | Introduction | Landing page: what Stack is, architecture overview (Storefront, Admin, API), key features, links to all sections |
| `/docs/getting-started` | `src/app/getting-started/page.tsx` | Getting Started | Prerequisites, installation (clone → env → `npm run dev`), first product walkthrough, project structure tree, development workflow |
| `/docs/platform-overview` | `src/app/platform-overview/page.tsx` | Platform Overview | Storefront (catalog, search, checkout), Admin Panel (products, orders, analytics), Infrastructure (PostgreSQL, MinIO, Valkey), comparison table vs Shopify / Gumroad / WooCommerce |
| `/docs/api-reference` | `src/app/api-reference/page.tsx` | API Reference | Base URL, authentication (session cookies + API keys), endpoint tables for Products / Orders / Customers / Checkout / Analytics, error format reference, rate limiting tiers, pagination |
| `/docs/security` | `src/app/security/page.tsx` | Security & Payments | Stripe integration, checkout session flow, webhook verification, encryption (TLS, AES-256-GCM sessions), session management table, file delivery pre-signed URLs, RBAC role table, IP restrictions, compliance (PCI DSS, GDPR), production security checklist |
| `/docs/integrations` | `src/app/integrations/page.tsx` | Integrations | Stripe config, alternative payment providers (LemonSqueezy, Paddle, PayPal), transactional email (SMTP/provider API), email templates, S3-compatible storage providers, analytics tracking (GA4, Plausible, PostHog, FB Pixel), outbound webhooks (events + HMAC-SHA256 verification), third-party services (Slack, Zapier, Discord, Notion), custom integration guide |
| `*` (not matched) | `src/app/not-found.tsx` | Page Not Found | 404 fallback page with link back to docs root |

### Section Hierarchy (Sidebar Navigation)

The sidebar defines the full navigation tree in `Sidebar.tsx`. Sections with full pages are listed first, followed by placeholder anchor-only groups:

```
Introduction            /
Getting Started         /getting-started
Platform Overview       /platform-overview
API Reference           /api-reference
Security & Payments     /security
Integrations            /integrations

Guides (collapsed group — anchor links, no pages yet)
  Store Setup
  Theme Customization
  Product Management

Storefront (collapsed group — anchor links, no pages yet)
  Templates
  Components
  Liquid Reference

Admin (collapsed group — anchor links, no pages yet)
  Dashboard
  Orders
  Analytics

Deployment (collapsed group — anchor links, no pages yet)
  Docker Setup
  Environment Config
  Production Checklist

Changelog (collapsed group — anchor links, no pages yet)
  v0.3.0 - Payments
  v0.2.0 - Admin Panel
  v0.1.0 - Initial Release
```

---

## Code Elements

### Components

#### `src/components/Navbar.tsx`

- **Directive**: `"use client"`
- **Purpose**: Fixed top navigation bar (60 px height). Renders the StackDocs logo/wordmark, top-level nav links, a decorative read-only search input (`placeholder="Search coming soon..."`), and a GitHub icon link.
- **State**: None (pure render driven by `usePathname`).
- **Active link detection**: Compares `usePathname()` against each `navLinks` entry to apply active styles.
- **Nav links defined** (static constant `navLinks`):
  - Guides → `/getting-started`
  - Platform → `/platform-overview`
  - API Reference → `/api-reference`
  - Security → `/security`
  - Integrations → `/integrations`
- **Key DOM**: `<nav>` fixed at `z-50`, `left-14 lg:left-6` to accommodate mobile hamburger.

#### `src/components/Sidebar.tsx`

- **Directive**: `"use client"`
- **Purpose**: Left-rail navigation sidebar (260 px wide on desktop, slide-in drawer on mobile).
- **Exports**: `Sidebar` (default), internal `SidebarContent`, `SidebarCategory`, `ChevronIcon`
- **Types**: `SidebarItem { label, href?, emoji?, children? }`
- **Static data**: `sidebarItems` — flat + nested navigation tree (6 top-level pages + 5 collapsed groups).
- **Behaviour**:
  - Desktop: fixed `aside` at `top-[60px]`, hidden below `lg` breakpoint.
  - Mobile: hamburger button (fixed, `z-[60]`) opens a full-height drawer overlay (`z-[80]`) with a black/40 scrim.
  - Drawer auto-closes on route change via `useEffect` watching `pathname`.
  - `SidebarCategory`: collapsible group component. Auto-expands if any child's `href` matches current `pathname`. Toggle via click; chevron rotates 90° when open.
  - Active leaf link: highlighted with `border-l-[3px] border-doc-active-border bg-doc-active-bg` (top-level) or `border-l-2 border-doc-active-border bg-doc-active-bg/50` (nested).

#### `src/components/TableOfContents.tsx`

- **Directive**: `"use client"`
- **Purpose**: Right-rail in-page table of contents, fixed at `top-[60px]`, visible only on `xl` screens (220 px wide). Scrolls the list and highlights the section currently in the viewport.
- **Exports**: `TableOfContents` (default), `TocItem` (named interface)
- **Interface**:
  ```typescript
  export interface TocItem {
    id: string;
    label: string;
    level: number; // 2 = h2, 3 = h3
  }
  ```
- **State**: `activeId: string` — ID of the heading currently in the viewport.
- **Scroll tracking**: `IntersectionObserver` with `rootMargin: "-80px 0px -70% 0px"`. Observes all heading elements listed in `items` by `document.getElementById(item.id)`. Updates `activeId` on intersection.
- **Rendering**: `level === 3` items receive `pl-5` (indented); `level === 2` items receive `pl-3`. Active item gets a left border highlight (`border-l-2 border-doc-toc-active -ml-[1px]`).
- **Returns null** when `items` is empty.

#### `src/components/DocLayout.tsx`

- **Directive**: `"use client"`
- **Purpose**: Shared wrapper component used by every documentation page. Composes `TableOfContents`, a breadcrumb trail, an `<article>` prose container, an "Edit this page" affordance (currently a `#` stub), and Previous/Next page navigation.
- **Props interface**:
  ```typescript
  interface DocLayoutProps {
    title: string;
    description: string;
    breadcrumb: string;
    toc: TocItem[];
    prev?: { label: string; href: string };
    next?: { label: string; href: string };
    children: React.ReactNode;
  }
  ```
- **Layout**: Outer `div` uses `lg:pl-[260px] xl:pr-[220px] pt-[60px]` to clear the sidebar and ToC columns. Inner `<main>` constrains content to `max-w-[820px]`.
- **Breadcrumb**: Home icon SVG (links to `/`) + `/` separator + current `breadcrumb` label.
- **Prev/Next**: Renders two bordered card links in a flex row. Empty `<div>` fills the missing side when `prev` or `next` is absent.

### App Shell

#### `src/app/layout.tsx`

- **Type**: Next.js Root Layout (server component — no `"use client"` directive)
- **Metadata**:
  ```typescript
  export const metadata: Metadata = {
    title: { default: "StackDocs", template: "%s | StackDocs" },
    description: "Documentation for the Stack commerce platform",
  };
  ```
- **Structure**: Renders `<html lang="en">` → `<body class="antialiased">` → `<Navbar />` → `<Sidebar />` → `{children}`.
- **Imports**: `globals.css`, `Navbar`, `Sidebar`.
- **Note**: Both `Navbar` and `Sidebar` are client components imported into a server layout; this is valid in Next.js App Router.

#### `src/app/not-found.tsx`

- **Type**: Next.js 404 handler (server component)
- **Purpose**: Renders a centred "Page Not Found" message with a link back to `/`.
- **Layout offset**: Applies `lg:pl-[260px] pt-[60px]` manually (mirrors DocLayout's padding) to align within the shell.

### Styles

#### `src/app/globals.css`

Imported once in `layout.tsx`. Contains:

1. **Tailwind directives**: `@tailwind base`, `@tailwind components`, `@tailwind utilities`.
2. **Global html/body**: `scroll-behavior: smooth`, `scroll-padding-top: 4.5rem` (accounts for fixed navbar), system font stack, dark text `#1c1e21` on white background.
3. **`.sidebar-scroll`**: Custom webkit scrollbar styling (6 px, transparent track, rounded gray thumb).
4. **`.heading-anchor`**: Anchor `#` links on headings — opacity 0 by default, transitions to 1 on parent heading hover.
5. **`.doc-prose`**: Full bespoke typography system for article content:
   - `h1` (2rem/bold), `h2` (1.5rem/bold + bottom border), `h3` (1.25rem/semibold)
   - `p` line-height 1.75, `li` line-height 1.7
   - `code` — light gray background `#f6f7f8`, monospace
   - `pre` — dark theme (`#282c34` background, `#abb2bf` text — One Dark palette), rounded, overflow-x scroll
   - `blockquote` — blue left border (`#4f6ef7`), light blue background (`#eef6ff`)
   - `table` — full-width, collapsed borders, `th` gray background

#### `tailwind.config.js`

Extends Tailwind with a custom `doc.*` colour palette:

| Token | Hex | Usage |
|---|---|---|
| `doc-bg` | `#ffffff` | Page background |
| `doc-sidebar` | `#f8f9fa` | Sidebar background |
| `doc-sidebar-border` | `#e3e6e8` | Sidebar right border |
| `doc-text` | `#1c1e21` | Primary text |
| `doc-text-muted` | `#606770` | Secondary/muted text |
| `doc-link` | `#2e64e6` | Link colour |
| `doc-link-hover` | `#1d4ed8` | Link hover |
| `doc-active-bg` | `#eef2ff` | Active nav item background |
| `doc-active-border` | `#4f6ef7` | Active nav item border / logo accent |
| `doc-heading` | `#1c1e21` | Heading text |
| `doc-border` | `#e5e7eb` | General border |
| `doc-code-bg` | `#f6f7f8` | Inline code background |
| `doc-navbar` | `#ffffff` | Navbar background |
| `doc-navbar-border` | `#ebedf0` | Navbar bottom border |
| `doc-toc-text` | `#525860` | ToC link text |
| `doc-toc-active` | `#4f6ef7` | ToC active link |
| `doc-callout-bg` | `#eef6ff` | Callout/blockquote background |
| `doc-callout-border` | `#4f6ef7` | Callout left border |

---

## Component Relationship Diagram

```
app/layout.tsx (Server — Root Shell)
├── Navbar.tsx          (Client — fixed top bar)
├── Sidebar.tsx         (Client — left-rail + mobile drawer)
│   └── SidebarContent  (internal)
│       └── SidebarCategory (internal, collapsible groups)
└── {children}          (page slot)
    └── DocLayout.tsx   (Client — shared page wrapper)
        ├── TableOfContents.tsx  (Client — right-rail ToC)
        └── <article class="doc-prose">
            └── page content (from each page.tsx)
```

### Data Flow: ToC Items

Each page component defines a local `toc` constant (array of `TocItem`) and passes it to `DocLayout`. `DocLayout` passes `toc` directly to `TableOfContents`, which observes heading DOM elements by their `id` attributes. Heading `id` values must match the `TocItem.id` values for scroll-tracking to function — this contract is maintained manually in each page file.

### Data Flow: Prev/Next Navigation

Each page passes optional `prev` and `next` props to `DocLayout`. The expected navigation chain (CONFIRMED from page files):

```
Introduction (/)
  -> next: Getting Started (/getting-started)

Getting Started (/getting-started)
  prev: Introduction (/)
  next: Platform Overview (/platform-overview)

Platform Overview (/platform-overview)
  prev: Getting Started (/getting-started)
  next: API Reference (/api-reference)

API Reference (/api-reference)
  prev: Platform Overview (/platform-overview)
  next: Security & Payments (/security)

Security & Payments (/security)
  prev: API Reference (/api-reference)
  next: Integrations (/integrations)

Integrations (/integrations)
  prev: Security & Payments (/security)
  next: (none — final page)
```

---

## Dependencies

### Runtime Dependencies (`docs/package.json`)

| Package | Version | Role |
|---|---|---|
| `next` | `^15.2.0` | App framework (App Router, server/client components, metadata API) |
| `react` | `^19.0.0` | UI library |
| `react-dom` | `^19.0.0` | DOM renderer |
| `tailwindcss` | `^3.4.19` | Utility-first CSS |
| `postcss` | `^8.5.6` | CSS processing pipeline (required by Tailwind) |
| `autoprefixer` | `^10.4.27` | Vendor prefix insertion via PostCSS |

### Dev Dependencies

| Package | Version | Role |
|---|---|---|
| `typescript` | `^5.7.0` | Type checking |
| `@types/node` | `^22.0.0` | Node.js type definitions |
| `@types/react` | `^19.0.0` | React type definitions |
| `@types/react-dom` | `^19.0.0` | React-DOM type definitions |

### Notable Absences

- **No MDX** — documentation is authored as inline JSX, not `.mdx` files. There is no `@next/mdx`, `remark`, or `rehype` dependency.
- **No syntax highlighting library** — code blocks use plain `<pre><code>` with the One Dark colour scheme applied via `globals.css`. No `shiki`, `prism`, or `highlight.js`.
- **No search library** — the search input in `Navbar` is `readOnly` with `placeholder="Search coming soon..."`. No Algolia, Fuse.js, or similar.
- **No icon library** — all icons are inline SVG paths.

### Build Configuration

- **`next.config.ts`**: Sets `basePath: "/docs"` — the entire site is rooted at `/docs` in production (served alongside the main storefront and admin panel via Caddy).
- **`postcss.config.mjs`**: Standard Tailwind + autoprefixer setup.
- **`tsconfig.json`**: Standard Next.js TypeScript config. The `@/` path alias resolves to `src/` (conventional Next.js setup).

---

## Confidence Assessment

| Finding | Confidence |
|---|---|
| All 12 source files under `docs/src/` enumerated and read | CONFIRMED |
| No MDX files exist in this directory | CONFIRMED |
| Navigation chain (prev/next) between pages | CONFIRMED |
| `basePath: "/docs"` applied globally | CONFIRMED |
| No syntax highlighting or search libraries installed | CONFIRMED |
| Sidebar placeholder groups have no corresponding page files | CONFIRMED |
| ToC tracking uses IntersectionObserver (not scroll events) | CONFIRMED |
