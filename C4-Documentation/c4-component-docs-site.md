# C4 Component -- Documentation Site

## 1. Overview

| Field | Value |
|---|---|
| **Name** | Documentation Site (StackDocs) |
| **Type** | Web Application |
| **Technology** | Next.js 15 (App Router), TypeScript, React 19, Tailwind CSS 3 |
| **Location** | `docs/` |
| **Deployment** | Docker container (Node 20 Alpine), port 3003, served via Caddy reverse proxy at `http://localhost/docs` |
| **Base Path** | `/docs` (configured via `basePath: "/docs"` in `next.config.ts`) |

---

## 2. Purpose

StackDocs is the developer and operator documentation site for the Shopify Stack Clone platform. It provides a self-contained reference covering:

- Getting started and local development setup
- Platform architecture overview and feature comparison
- Full API endpoint reference with authentication, pagination, and error formats
- Security model, Stripe payment integration, and compliance guidance
- Third-party integration patterns (payment providers, email, storage, analytics, webhooks)

The site is authored entirely in inline JSX (no MDX) and deployed as a standalone Next.js application alongside the storefront, admin panel, and API within the same Docker Compose stack.

---

## 3. Software Features

### 3.1 Documentation Pages (Active)

| Page | Route | Description |
|---|---|---|
| Introduction | `/docs/` | Landing page -- architecture overview, key features, links to all sections |
| Getting Started | `/docs/getting-started` | Prerequisites, installation walkthrough, project structure, dev workflow |
| Platform Overview | `/docs/platform-overview` | Storefront, Admin Panel, infrastructure breakdown; comparison table vs Shopify / Gumroad / WooCommerce |
| API Reference | `/docs/api-reference` | Base URL, auth (session cookies + API keys), endpoint tables (Products, Orders, Customers, Checkout, Analytics), error format, rate limits, pagination |
| Security & Payments | `/docs/security` | Stripe integration, checkout session flow, webhook verification, encryption, session management, RBAC, IP restrictions, compliance checklists (PCI DSS, GDPR) |
| Integrations | `/docs/integrations` | Stripe config, alternative payment providers, transactional email, S3-compatible storage, analytics tracking, outbound webhooks (HMAC-SHA256), third-party services, custom integration guide |
| 404 Not Found | `*` (catch-all) | Fallback page with link back to docs root |

### 3.2 Planned Sections (Sidebar Placeholders, No Pages Yet)

| Group | Planned Topics |
|---|---|
| Guides | Store Setup, Theme Customization, Product Management |
| Storefront | Templates, Components, Liquid Reference |
| Admin | Dashboard, Orders, Analytics |
| Deployment | Docker Setup, Environment Config, Production Checklist |
| Changelog | v0.3.0 (Payments), v0.2.0 (Admin Panel), v0.1.0 (Initial Release) |

### 3.3 Navigation Features

- **Sequential prev/next links** at the bottom of every page, forming a linear reading chain from Introduction through Integrations
- **In-page table of contents** (right rail, desktop only) with scroll-tracking via `IntersectionObserver`
- **Collapsible sidebar categories** that auto-expand when a child route matches the current URL
- **Responsive mobile drawer** with hamburger toggle and scrim overlay

---

## 4. Code Elements

Full code-level documentation is maintained in a separate file:

> **[c4-code-docs-src.md](c4-code-docs-src.md)** -- Exhaustive file-by-file reference covering every component, style token, dependency, data flow, and configuration detail for `docs/src/`.

### 4.1 File Inventory Summary

```
docs/
  Dockerfile                    # Node 20 Alpine, npm workspace install, dev server
  package.json                  # next, react, react-dom, tailwindcss, postcss, autoprefixer
  next.config.ts                # basePath: "/docs"
  postcss.config.mjs            # Tailwind + autoprefixer pipeline
  tailwind.config.js            # Custom doc.* colour palette (18 tokens)
  tsconfig.json                 # Standard Next.js TS config, @/ -> src/
  src/
    app/
      layout.tsx                # Root layout (server component) -- Navbar, Sidebar, {children}
      globals.css               # Tailwind directives, .doc-prose typography, .sidebar-scroll
      page.tsx                  # Introduction page
      not-found.tsx             # 404 handler
      getting-started/page.tsx  # Getting Started page
      platform-overview/page.tsx # Platform Overview page
      api-reference/page.tsx    # API Reference page
      security/page.tsx         # Security & Payments page
      integrations/page.tsx     # Integrations page
    components/
      Navbar.tsx                # Fixed top bar -- logo, nav links, search stub, GitHub link
      Sidebar.tsx               # Left-rail nav -- desktop fixed, mobile drawer
      DocLayout.tsx             # Shared page wrapper -- breadcrumb, article, ToC, prev/next
      TableOfContents.tsx       # Right-rail ToC -- IntersectionObserver scroll tracking
```

---

## 5. Interfaces

### 5.1 User-Facing Interface

The Documentation Site is a **read-only static content site** with no API calls, no data fetching, and no user authentication. All content is compiled into the Next.js application at build time as server-rendered JSX pages.

| Interface | Description |
|---|---|
| Browser navigation | All page transitions handled by Next.js App Router client-side routing via `<Link>` components |
| In-page scroll tracking | `IntersectionObserver` watches heading elements to highlight the active ToC entry |
| Mobile drawer | Hamburger button toggles a slide-in sidebar overlay; auto-closes on route change |
| Search input | Decorative only (`readOnly`, `placeholder="Search coming soon..."`) -- no search backend |
| External link | Single outbound link: GitHub icon in navbar (points to `https://github.com`) |

### 5.2 Internal Component Interfaces

| Component | Props / Inputs | Outputs |
|---|---|---|
| `Navbar` | None (reads `usePathname()` for active-link detection) | Fixed top bar with nav links |
| `Sidebar` | None (reads `usePathname()` for active-item + drawer auto-close) | Left-rail navigation + mobile drawer |
| `DocLayout` | `title`, `description`, `breadcrumb`, `toc: TocItem[]`, `prev?`, `next?`, `children` | Page wrapper: breadcrumb, article container, ToC, prev/next nav |
| `TableOfContents` | `items: TocItem[]` | Right-rail heading list with scroll-tracking highlight |

### 5.3 Reverse Proxy Integration

Caddy routes all requests matching `/docs*` to the docs container:

```
handle /docs* {
    reverse_proxy docs:3003
}
```

The Next.js `basePath: "/docs"` configuration ensures all generated routes, assets, and `<Link>` hrefs are prefixed with `/docs`, allowing the site to coexist at a subpath alongside the storefront (`/`), API (`/api/*`), and admin panel (`/admin/*`).

---

## 6. Dependencies

### 6.1 Runtime Dependencies

| Package | Version | Role |
|---|---|---|
| `next` | ^15.2.0 | App framework (App Router, server/client components, metadata API) |
| `react` | ^19.0.0 | UI library |
| `react-dom` | ^19.0.0 | DOM renderer |
| `tailwindcss` | ^3.4.19 | Utility-first CSS framework |
| `postcss` | ^8.5.6 | CSS processing pipeline (required by Tailwind) |
| `autoprefixer` | ^10.4.27 | Vendor prefix insertion via PostCSS |

### 6.2 Dev Dependencies

| Package | Version | Role |
|---|---|---|
| `typescript` | ^5.7.0 | Type checking |
| `@types/node` | ^22.0.0 | Node.js type definitions |
| `@types/react` | ^19.0.0 | React type definitions |
| `@types/react-dom` | ^19.0.0 | React-DOM type definitions |

### 6.3 Infrastructure Dependencies

| Dependency | Relationship |
|---|---|
| Caddy reverse proxy | Routes `/docs*` traffic to `docs:3003` |
| Docker Compose network (`app-network`) | Enables service-to-service DNS resolution |
| `shared` workspace | Referenced in Dockerfile for npm workspace install (shared types/utils) |

### 6.4 Notable Absences

The Documentation Site intentionally excludes several common documentation-site dependencies:

- **No MDX** -- all content is inline JSX, no `@next/mdx`, `remark`, or `rehype`
- **No syntax highlighting library** -- code blocks use `<pre><code>` with a One Dark colour scheme applied via CSS
- **No search library** -- search input is a read-only placeholder (no Algolia, Fuse.js, or similar)
- **No icon library** -- all icons are inline SVG paths
- **No external data sources** -- zero API calls, no database, no CMS

---

## 7. Component Diagram

```
C4Component
  title Documentation Site -- Component Diagram

  Container_Boundary(docs, "Documentation Site (Next.js, port 3003)") {

    Component(layout, "Root Layout", "Server Component", "HTML shell: <html>, <body>, imports globals.css, renders Navbar + Sidebar + page slot")

    Component(navbar, "Navbar", "Client Component", "Fixed top bar (60px): StackDocs logo, 5 nav links, search placeholder, GitHub link")

    Component(sidebar, "Sidebar", "Client Component", "Left rail (260px desktop / drawer on mobile): 6 page links + 5 collapsible placeholder groups with auto-expand and route-change auto-close")

    Component(doclayout, "DocLayout", "Client Component", "Shared page wrapper: breadcrumb trail, <article class='doc-prose'> container, prev/next card links, passes toc items to TableOfContents")

    Component(toc, "TableOfContents", "Client Component", "Right rail (220px, xl only): renders TocItem[] as an indented heading list, IntersectionObserver highlights the active section")

    Component(pages, "Page Components", "Server Components (6)", "Introduction, Getting Started, Platform Overview, API Reference, Security & Payments, Integrations -- each defines local toc[] and prev/next props, renders inline JSX prose")

    Component(notfound, "Not Found", "Server Component", "404 fallback with link to docs root")

    Component(styles, "Global Styles", "CSS (globals.css + tailwind.config.js)", "Tailwind directives, .doc-prose typography system (headings, code, tables, blockquotes), .sidebar-scroll, 18 custom doc.* colour tokens")
  }

  Rel(layout, navbar, "Renders")
  Rel(layout, sidebar, "Renders")
  Rel(layout, pages, "Renders via {children} slot")
  Rel(layout, notfound, "Renders on 404")
  Rel(pages, doclayout, "Wraps content with")
  Rel(doclayout, toc, "Passes toc items to")
  Rel(navbar, pages, "Links to page routes")
  Rel(sidebar, pages, "Links to page routes")
  Rel(doclayout, pages, "Renders prev/next links between")
  Rel(layout, styles, "Imports")
```

### Rendered Layout Diagram

```
+------------------------------------------------------------------+
|                         Caddy (/docs*)                           |
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  Root Layout (layout.tsx) -- Server Component               |  |
|  |                                                             |  |
|  |  +-------------------------------------------------------+ |  |
|  |  |  Navbar (fixed, z-50, 60px height)                     | |  |
|  |  |  [Logo] [Guides] [Platform] [API] [Security] [Integ]  | |  |
|  |  |                          [Search stub] [GitHub icon]   | |  |
|  |  +-------------------------------------------------------+ |  |
|  |                                                             |  |
|  |  +----------+ +-----------------------------+ +---------+  |  |
|  |  |          | |                             | |         |  |  |
|  |  | Sidebar  | |  DocLayout                  | | Table   |  |  |
|  |  | (260px)  | |  +- Breadcrumb              | | Of      |  |  |
|  |  |          | |  +- <article>               | | Contents|  |  |
|  |  | Intro    | |  |  Page content (JSX)      | | (220px) |  |  |
|  |  | Getting  | |  |  ...                      | |         |  |  |
|  |  | Platform | |  +- Edit link stub           | | h2 item |  |  |
|  |  | API Ref  | |  +- Prev/Next cards          | | h3 item |  |  |
|  |  | Security | |                             | |  h3     |  |  |
|  |  | Integr.  | |                             | | h2 item |  |  |
|  |  |          | |                             | |         |  |  |
|  |  | [Groups] | |                             | |         |  |  |
|  |  | Guides > | |                             | |         |  |  |
|  |  | Store  > | |                             | |         |  |  |
|  |  | Admin  > | |                             | |         |  |  |
|  |  | Deploy > | |                             | |         |  |  |
|  |  | Change > | |                             | |         |  |  |
|  |  +----------+ +-----------------------------+ +---------+  |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### Data Flow: ToC Scroll Tracking

```
Page Component              DocLayout                 TableOfContents
     |                          |                          |
     |-- toc: TocItem[] ------->|-- items: TocItem[] ----->|
     |                          |                          |
     |                          |               IntersectionObserver
     |                          |               watches heading DOM
     |                          |               elements by id
     |                          |                          |
     |                          |               Updates activeId state
     |                          |               on intersection
```

### Data Flow: Page Navigation Chain

```
Introduction --> Getting Started --> Platform Overview --> API Reference --> Security & Payments --> Integrations
     /          /getting-started    /platform-overview    /api-reference       /security            /integrations

Each page passes prev/next props to DocLayout, which renders card links at the bottom.
```

---

## 8. Deployment

### 8.1 Docker Configuration

| Setting | Value |
|---|---|
| Base image | `node:20-alpine` |
| Working directory | `/app/docs` |
| Exposed port | `3003` |
| Start command | `npm run dev` (dev mode via Docker Compose) |
| Build command | `next build` (production) |
| Workspace install | `npm install --workspace=docs --workspace=shared` |

### 8.2 Docker Compose Service

```yaml
docs:
  build:
    context: .
    dockerfile: docs/Dockerfile
  restart: unless-stopped
  ports:
    - "${DOCS_PORT:-3003}:3003"
  volumes:
    - ./docs/src:/app/docs/src          # Hot reload source
    - ./docs/public:/app/docs/public    # Static assets
    - ./docs/next.config.ts:/app/docs/next.config.ts
    - ./docs/postcss.config.mjs:/app/docs/postcss.config.mjs
    - ./docs/tailwind.config.js:/app/docs/tailwind.config.js
  environment:
    NODE_ENV: ${NODE_ENV}
```

### 8.3 Caddy Routing

The Caddy reverse proxy routes `/docs*` to the docs service on the internal Docker network:

```
handle /docs* {
    reverse_proxy docs:3003
}
```

The Next.js `basePath: "/docs"` ensures all internal routes and asset paths are prefixed correctly for subpath hosting.

---

## 9. Design Decisions

| Decision | Rationale |
|---|---|
| Inline JSX instead of MDX | Avoids MDX toolchain complexity (`@next/mdx`, remark/rehype plugins); all content is version-controlled as standard React components |
| Custom CSS typography (`.doc-prose`) instead of `@tailwindcss/typography` | Full control over documentation styling; no dependency on the typography plugin's opinionated defaults |
| No syntax highlighting library | Code blocks use a static One Dark colour scheme via CSS; avoids the bundle-size cost of Shiki/Prism for a documentation site with modest code samples |
| Search input as placeholder | Defers search implementation; the read-only input with `/` keyboard hint establishes the UI affordance for a future Algolia or Fuse.js integration |
| All icons as inline SVGs | Zero icon-library dependency; the site uses only 4 unique icons (book, search, GitHub, chevron) |
| Client components for layout shell | Navbar, Sidebar, DocLayout, and TableOfContents all use `"use client"` for `usePathname()` and `IntersectionObserver`; page content itself is server-rendered |
| Manual ToC contract | Each page defines its own `toc: TocItem[]` array with `id` values that must match heading element `id` attributes; this avoids runtime heading extraction but requires manual synchronization |

---

## 10. Relationship to Other Containers

```
+-----------------+         +---------------------+
|  Caddy          | /docs*  | Documentation Site  |
|  (Reverse Proxy)|-------->| (Next.js, :3003)    |
+-----------------+         +---------------------+
       |
       | /           +-----------------+
       +------------>| Storefront      |
       |             | (Next.js, :3000)|
       |             +-----------------+
       | /api/*      +-----------------+
       +------------>| API             |
       |             | (Fastify, :3001)|
       |             +-----------------+
       | /admin/*    +-----------------+
       +------------>| Admin Panel     |
                     | (Vite, :3002)   |
                     +-----------------+
```

The Documentation Site is fully isolated from the other application containers. It shares no runtime state, makes no API calls, and has no database dependency. Its only infrastructure coupling is through Caddy's routing table and the shared Docker Compose network.
