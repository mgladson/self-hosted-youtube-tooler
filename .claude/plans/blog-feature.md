# Blog Feature — Implementation Plan

**Date:** 2026-03-04
**Status:** Draft
**Goal:** Add a full blog to the storefront (publicly readable, footer-linked, AI-optimized) with a complete CRUD admin interface for creating, editing, hiding, and deleting posts.

---

## Scope

This plan touches all three workspaces plus a new DB migration:

| Layer | Work |
|---|---|
| `migrations/` | New `blog_posts` table |
| `api/` | Public read routes + admin CRUD + RSS feed |
| `storefront/` | Blog listing, post detail, footer link, JSON-LD, sitemap, `llms.txt` |
| `admin/` | BlogList page, BlogEditor page, sidebar entry, router entries |

**Out of scope:** Rich text editor (use plain `<textarea>` for Markdown content, same pattern as the Pages admin), image upload via MinIO (use URL field), comments system.

---

## Phase 0 — Database Migration

**File:** `migrations/0010_blog-posts.js`

```js
exports.up = (pgm) => {
  pgm.createTable('blog_posts', {
    id:                 { type: 'serial', primaryKey: true },
    title:              { type: 'varchar(500)', notNull: true },
    slug:               { type: 'varchar(500)', notNull: true, unique: true },
    excerpt:            { type: 'text' },
    content:            { type: 'text', notNull: true },
    author_name:        { type: 'varchar(255)', notNull: true },
    status:             { type: 'varchar(20)', notNull: true, default: "'draft'" },
    tags:               { type: 'text[]', default: "'{}'" },
    featured_image_url: { type: 'varchar(1000)' },
    seo_description:    { type: 'varchar(500)' },
    published_at:       { type: 'timestamptz' },
    created_at:         { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at:         { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('blog_posts', 'slug');
  pgm.createIndex('blog_posts', 'status');
  pgm.createIndex('blog_posts', ['status', 'published_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('blog_posts');
};
```

**`status` values:** `'draft'` | `'published'` | `'hidden'`

- `draft` — not visible on storefront, visible to admins
- `published` — visible on storefront
- `hidden` — was published, now suppressed; still exists, not deleted

**`published_at`** is set on first publish (via `NOW()`). Subsequent edits do not reset it. Re-publishing a hidden post does not change `published_at`.

---

## Phase 1 — API Routes

**New file:** `api/src/routes/blog.ts`
**Register in:** `api/src/index.ts` alongside the other route imports

### Route table

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/blog` | Public | Paginated list of published posts |
| `GET` | `/api/blog/feed.xml` | Public | RSS 2.0 feed (full content) |
| `GET` | `/api/blog/:slug` | Public | Single published post |
| `GET` | `/api/admin/blog` | admin `editor+` | All posts (all statuses) |
| `GET` | `/api/admin/blog/:slug` | admin `editor+` | Single post by slug regardless of status |
| `POST` | `/api/admin/blog` | admin `editor+` | Create post |
| `PUT` | `/api/admin/blog/:slug` | admin `editor+` | Update post |
| `DELETE` | `/api/admin/blog/:slug` | admin `editor+` | Hard delete post |

> **Route registration order matters:** In `blog.ts`, register `GET /api/blog/feed.xml` before `GET /api/blog/:slug`. Fastify resolves static segments before parametric ones only when they appear first in registration order. If `:slug` is registered first, a request to `/api/blog/feed.xml` will match as slug="feed.xml" and return 404. Add a code comment marking this ordering as intentional.

### Public GET `/api/blog` query params

- `page` (default `1`) — page number
- `limit` (default `12`, max `50`)
- `tag` (optional) — filter by tag. SQL: `WHERE $1 = ANY(tags)` (not `WHERE tags = $1` which always returns 0 for array columns)

Response:
```json
{
  "posts": [ /* BlogPost[] without `content` field */ ],
  "total": 42,
  "page": 1,
  "pages": 4
}
```

### Public GET `/api/blog/:slug`

Returns full post including `content`. Returns `404` if `status !== 'published'`.

### RSS `/api/blog/feed.xml`

Returns `application/rss+xml`. Full-content RSS (uses `<content:encoded>`). Include the 20 most recent published posts. This is read directly by Perplexity, some AI indexing pipelines, and RSS readers.

All absolute URLs in the feed must be constructed from `SITE_URL` (see env var requirements below) — never hardcoded strings.

**Content encoding:** `<content:encoded>` expects HTML, not raw Markdown. Convert `post.content` from Markdown to HTML before inserting it. If `marked` is approved as a dependency (see Phase 2b decision), reuse it here. If using the no-dep `<pre>` approach, insert plain text content without HTML tags and document that the RSS feed will contain unformatted text — this is a known limitation of the no-dep path.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PixelForge Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>...</description>
    <atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <item>
      <title>Post title</title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <pubDate>RFC 822 date</pubDate>
      <description>excerpt</description>
      <content:encoded><![CDATA[ HTML-rendered content (converted from Markdown) ]]></content:encoded>
    </item>
    ...
  </channel>
</rss>
```

### Admin POST `/api/admin/blog` body

```typescript
{
  title: string;           // required
  slug?: string;           // auto-generated from title if omitted
  excerpt?: string;
  content: string;         // required, Markdown — max 200KB enforced in route handler
  author_name: string;     // required
  status: 'draft' | 'published' | 'hidden';
  tags?: string[];
  featured_image_url?: string;
  seo_description?: string;
}
```

**Validation:** Reject with `400` if `content.length > 200_000` characters. This prevents memory pressure from giant bodies, as Fastify's default 1MB bodyLimit applies to the raw request but the application must also guard against oversized text fields.

Slug auto-generation: `title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')`. Append `-2`, `-3`, etc. on conflict.

**Slug conflict handling:** If an admin manually provides a slug that already exists, the DB `unique` constraint will throw error code `23505`. Catch this pg error and return `409 { error: "Slug already in use — choose a different one" }` rather than letting it bubble to a 500.

`published_at` is set to `NOW()` automatically on first `status = 'published'`. On create with `status = 'draft'`, `published_at` stays `null`.

### Admin PUT `/api/admin/blog/:slug` body

Same shape as POST but all fields optional. If `status` transitions from non-`published` to `published` and `published_at IS NULL`, set `published_at = NOW()`.

**Always include `updated_at = NOW()` in the UPDATE statement.** The migration sets `updated_at` only at creation time; it will not auto-update on subsequent writes. Without an explicit `SET updated_at = NOW()`, the JSON-LD `dateModified` and sitemap `lastModified` fields will always show the creation date, causing freshness signals used by Google AI and Gemini to be wrong.

### Audit logging

All admin mutations (POST/PUT/DELETE) call `writeAuditLog` with the existing signature `{ userEmail, userName, action, resourceType, resourceId, summary, ip }`:
- `resourceType: 'blog_post'`
- `resourceId: slug`
- `action: 'create' | 'update' | 'delete'`
- `summary`: human-readable string, e.g.:
  - create: `"Created blog post: ${slug}"`
  - update: `"Updated blog post: ${slug} — status: ${prevStatus} → ${newStatus}"` (include status change if applicable)
  - delete: `"Deleted blog post: ${slug}"`

Do **not** add `previousState`/`newState` fields — they do not exist in the current `writeAuditLog` type signature (see `api/src/lib/audit.ts`). If richer diff logging is needed, add it as a separate follow-up task.

---

## Phase 2 — Storefront

### 2a. Blog listing page

**New file:** `storefront/src/app/blog/page.tsx`

- Server component, SSR (not static — content updates without rebuild)
- Fetches `GET /api/blog?page=X` from the API using `{ next: { revalidate: 60 } }` so newly published posts appear within ~60 seconds
- Displays cards: featured image, title, excerpt, author, date, tags
- Pagination controls (prev/next)
- `generateMetadata` returns:
  ```typescript
  {
    title: 'Blog — PixelForge',
    description: 'Articles on design, development, and digital products.',
    alternates: { types: { 'application/rss+xml': '/blog/feed.xml' } },
  }
  ```
  The `alternates.types` entry adds `<link rel="alternate" type="application/rss+xml">` to the `<head>`, which AI crawlers and feed readers follow.

### 2b. Blog post detail page

**New file:** `storefront/src/app/blog/[slug]/page.tsx`

- Server component, SSR
- Fetches `GET /api/blog/:slug`, 404 if not found; use `{ next: { revalidate: 60 } }` on the fetch so published edits surface within ~60 seconds
- **Content rendering — required security decision:** Content is stored as Markdown written by admins. It must NOT be rendered via `dangerouslySetInnerHTML` on raw stored text, as a compromised admin account could inject `<script>` tags visible to all storefront visitors (stored XSS). Choose one of:
  - **(Preferred)** Use `marked` (current API: `marked.parse(content)` — note: the old `mangle` and `headerIds` options were removed in `marked` v9 and must not be used). **`marked` does not sanitize HTML by itself** — a compromised admin could still inject raw HTML in the Markdown source. Pair it with `isomorphic-dompurify` (server-safe) or strip raw HTML tokens via a `walkTokens` hook that removes `html` and `html_block` token types before rendering. Requires user approval per CLAUDE.md before adding either dependency.
  - **(No new dep)** Render content as plain preformatted text inside a `<pre>` block. No XSS risk, no formatting. Acceptable for v1 until a Markdown renderer is approved.
  - Do NOT use `dangerouslySetInnerHTML` without an explicit sanitization step (sanitization is not optional even with `marked`).
- Fetch uses `{ next: { revalidate: 60 } }` so edits appear on the storefront within ~60 seconds without a full redeploy
- `generateMetadata` per post:
  ```typescript
  {
    title: `${post.title} — PixelForge`,
    description: post.seo_description || post.excerpt,
    openGraph: {
      type: 'article',
      publishedTime: post.published_at,
      tags: post.tags,
      images: post.featured_image_url ? [{ url: post.featured_image_url }] : [],
    },
  }
  ```
- **JSON-LD `BlogPosting` schema** injected in the page (extend the existing `JsonLd` component). All absolute URLs must use `process.env.NEXT_PUBLIC_SITE_URL`:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "Post title",
    "description": "excerpt or seo_description",
    "datePublished": "ISO date",
    "dateModified": "ISO date",
    "author": { "@type": "Person", "name": "author_name" },
    "publisher": {
      "@type": "Organization",
      "name": "PixelForge",
      "url": "${NEXT_PUBLIC_SITE_URL}"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${NEXT_PUBLIC_SITE_URL}/blog/${slug}"
    },
    "image": "featured_image_url (if set)"
  }
  ```
  This structured data is the single highest-impact signal for Gemini (52% of citations come from brand-owned sites with structured data) and Google AI Overviews.

### 2c. Footer link

**Edit:** `storefront/src/components/layout/Footer.tsx`

Add `{ label: 'Blog', href: '/blog' }` to the `Shop` column in `footerLinks`. It sits alongside "All Products", "Collections", "Search".

### 2d. Sitemap

**New file:** `storefront/src/app/sitemap.ts`

Next.js 15 dynamic sitemap via the App Router `sitemap.ts` convention. Fetches all published post slugs from the API and combines with static pages.

**Required:** All absolute URLs use `process.env.NEXT_PUBLIC_SITE_URL`. Wrap the API fetch in try/catch — if the API is unreachable, return only the static entries so `/sitemap.xml` always returns valid XML (avoids deindexing blog posts on transient API downtime).

```typescript
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api';

const staticEntries: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}`, changeFrequency: 'daily', priority: 1.0 },
  { url: `${SITE_URL}/blog`, changeFrequency: 'daily', priority: 0.9 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${API_URL}/blog?limit=200`, { next: { revalidate: 3600 } });
    if (!res.ok) return staticEntries;
    const { posts } = await res.json();
    const blogEntries = posts.map((p: { slug: string; updated_at: string }) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
    return [...staticEntries, ...blogEntries];
  } catch {
    return staticEntries;
  }
}
```

This generates `/sitemap.xml` automatically, which is submitted to Google Search Console and consumed by AI crawlers during indexing.

---

## Required Environment Variables

The following env vars must be added to `.env.example` (and documented for production deployment):

| Variable | Used by | Example |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Storefront: JSON-LD, sitemap.ts | `https://pixelforge.io` |
| `SITE_URL` | API: RSS feed absolute URLs | `https://pixelforge.io` |

Both point to the same production domain. `NEXT_PUBLIC_SITE_URL` is prefixed for Next.js client exposure; `SITE_URL` is for the API server. Neither has a sensible default — both must be explicitly set in production or the RSS feed and JSON-LD will contain wrong URLs.

---

## Phase 3 — AI Optimization Signals

### 3a. `llms.txt`

**New file:** `storefront/public/llms.txt`

Standard proposed by Jeremy Howard (Answer.AI). Tells AI assistants (Claude, ChatGPT, Gemini) what's on the site and surfaces high-value pages. Format: Markdown, kept concise.

```markdown
# PixelForge

> Premium digital products for designers and developers — templates, UI kits, icons, and fonts.

## Blog
- [Blog Index](/blog): Articles on design, development, and digital products.

## Products
- [All Products](/products): Browse the full catalog of digital downloads.

## Store
- [Collections](/collections): Curated product collections by theme.

## Legal
- [Privacy Policy](/privacy-policy)
- [Terms of Service](/terms-of-service)
```

Update this file whenever significant new blog posts are published (can be a manual step for now). Keep entries to the ~20 most important pages.

### 3b. `robots.ts`

**New file:** `storefront/src/app/robots.ts`

Use Next.js 15's dynamic `robots.ts` convention (same pattern as `sitemap.ts`) so the Sitemap URL is read from `NEXT_PUBLIC_SITE_URL` at runtime — never a hardcoded or placeholder string. If a static `storefront/public/robots.txt` already exists, delete it; Next.js will serve `robots.ts` instead.

```typescript
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/api/',
      },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

The `disallow: '/api/'` line prevents crawlers from wasting crawl budget on JSON endpoints reachable at the same domain via Caddy. This is a **permissive** robots configuration — the default is already allow-all, but explicit entries signal intent and are respected by major AI crawlers.

---

## Phase 4 — Admin Portal

### 4a. BlogList page

**New file:** `admin/src/pages/BlogList.tsx`

Mirrors the pattern of `Pages.tsx` but with a data table. Columns:
- Title (clickable → goes to BlogEditor)
- Status badge (`published` = green, `draft` = yellow, `hidden` = red/muted)
- Author
- Published date (or "—" if draft)
- Tags (first 2, then `+N more`)
- Actions: Edit button, Delete button (confirm dialog before hard delete)

Top bar: "New Post" button (→ `/admin/blog/new`), status filter tabs (All / Published / Draft / Hidden).

Fetches `GET /api/admin/blog` (all statuses). No pagination in v1 — filter client-side. Add server-side pagination as a follow-up if volume warrants it.

### 4b. BlogEditor page

**New file:** `admin/src/pages/BlogEditor.tsx`

Handles both create (`/admin/blog/new`) and edit (`/admin/blog/:slug`). On edit, fetches `GET /api/admin/blog/:slug`.

Form fields:

| Field | Input type | Notes |
|---|---|---|
| Title | `text` | Required. On create, auto-generates slug as user types |
| Slug | `text` | Editable. Shows preview URL below field |
| Status | `select` | `draft` / `published` / `hidden` |
| Author | `text` | Pre-fills with logged-in admin's name |
| Excerpt | `textarea` (3 rows) | Optional. Used in listing cards and meta description |
| Content | `textarea` (16 rows) | Markdown. Required. |
| Tags | `text` | Comma-separated input, stored as array |
| Featured Image URL | `text` | Optional |
| SEO Description | `text` (max 500) | Optional. Overrides excerpt in `<meta description>` |

Action bar (sticky bottom or top):
- **Save Draft** — sets `status: 'draft'`, calls POST or PUT
- **Publish** — sets `status: 'published'`, calls POST or PUT
- **Hide** — (edit only) sets `status: 'hidden'`, calls PUT
- **Delete** — (edit only) confirm dialog → calls DELETE → redirect to `/admin/blog`

On successful create, redirect to `/admin/blog/:newSlug` (edit mode).

**Post-publish reminder:** When a post transitions to `status: 'published'` (either on create or update), display a toast or banner: "Post published — update /llms.txt to include this post so AI assistants can discover it." This is a manual step but the reminder prevents the file from becoming permanently stale.

### 4c. Router entries

**Edit:** `admin/src/router.tsx`

Add inside the authenticated `/admin` children array, after the `pages` route:

```typescript
{ path: 'blog',       element: <BlogList /> },
{ path: 'blog/new',   element: <BlogEditor /> },
{ path: 'blog/:slug', element: <BlogEditor /> },
```

Import `BlogList` and `BlogEditor` at the top of the file alongside the other page imports.

### 4d. Sidebar

**Edit:** `admin/src/components/layout/Sidebar.tsx`

Add a `NavItem` for Blog directly after the Pages entry (line 228):

```tsx
<NavItem to="/admin/blog" label="Blog" icon={BookOpen} />
```

Add `BookOpen` to the destructured icon import at the top of the file:

```typescript
import {
  // ... existing icons ...
  BookOpen,
} from '@/lib/icons';
```

Check `admin/src/lib/icons.ts` to confirm `BookOpen` is re-exported from `lucide-react` before using it. If not, use `PenSquare` or `FileText` (already imported) as a fallback — but a distinct icon is preferred.

### 4e. Admin API functions

**Edit:** `admin/src/lib/api.ts`

Add functions following the existing pattern in that file:

```typescript
export async function fetchAdminBlogPosts(): Promise<{ posts: BlogPost[] }>
export async function fetchAdminBlogPost(slug: string): Promise<BlogPost>
export async function createBlogPost(data: CreateBlogPostInput): Promise<BlogPost>
export async function updateBlogPost(slug: string, data: UpdateBlogPostInput): Promise<BlogPost>
export async function deleteBlogPost(slug: string): Promise<void>
```

All use `credentials: 'include'` (same as other admin API calls).

---

## File change summary

| File | Change |
|---|---|
| `migrations/0010_blog-posts.js` | **New** |
| `api/src/routes/blog.ts` | **New** — all 8 routes |
| `api/src/index.ts` | **Edit** — register `blogRoutes` |
| `storefront/src/app/blog/page.tsx` | **New** |
| `storefront/src/app/blog/[slug]/page.tsx` | **New** |
| `storefront/src/app/sitemap.ts` | **New** |
| `storefront/public/llms.txt` | **New** |
| `storefront/src/app/robots.ts` | **New** (replaces static `public/robots.txt` if one exists — delete the static file) |
| `storefront/src/components/layout/Footer.tsx` | **Edit** — add Blog to footerLinks |
| `admin/src/router.tsx` | **Edit** — 3 new routes |
| `admin/src/pages/BlogList.tsx` | **New** |
| `admin/src/pages/BlogEditor.tsx` | **New** |
| `admin/src/components/layout/Sidebar.tsx` | **Edit** — add Blog NavItem + icon import |
| `admin/src/lib/api.ts` | **Edit** — 5 new API functions |
| `.env.example` | **Edit** — add `NEXT_PUBLIC_SITE_URL`, `SITE_URL` |

**Total: 15 files — 7 new, 8 edited.**

---

## Implementation order

Execute phases in order — each phase depends on the previous:

1. **Phase 0** (migration) — must run before API can use the table
2. **Phase 1** (API) — must exist before storefront can fetch data
3. **Phase 2** (storefront) — reads and links depend on Phase 1 working
4. **Phase 3** (AI signals) — static files, no dependencies; can be done any time after Phase 2
5. **Phase 4** (admin) — independent of storefront; depends on Phase 1 admin endpoints

---

## Pre-flight checks before declaring complete

1. Confirm `migrations/` directory — verify `0010` is not already taken before running
2. Run migration: `npm run migrate up` — verify table created
3. Run existing tests: `npm test` from root — no regressions
4. Verify `.env.example` includes `NEXT_PUBLIC_SITE_URL` and `SITE_URL`
5. Manually test: create a post in admin → publish it → view it on storefront → check JSON-LD in source → check `/sitemap.xml` includes it → check `dateModified` updates after an edit
6. Verify RSS at `/blog/feed.xml` — valid XML, includes `<content:encoded>`, uses correct absolute URLs (not `yoursite.com`)
7. Verify `llms.txt` accessible at `/llms.txt`
8. Verify footer Blog link renders and navigates correctly
9. Verify hide/delete flows in admin (hidden post returns 404 on storefront)
10. Check audit log entries created for create/update/delete actions
11. Test content rendering: save a post with Markdown formatting — verify it renders without allowing raw HTML script injection
12. Test slug conflict: manually enter a duplicate slug — verify 409 response with a readable error message
13. Test storefront listing: publish a new post, wait ≤60s, confirm it appears without a redeploy
