---
name: perf-audit
description: "Deep web performance audit — LCP/INP/CLS code-level analysis, bundle size estimation, third-party script inventory, Shopify API patterns, font/image optimization, and Unlighthouse CI setup. Use when optimizing storefront performance or diagnosing Core Web Vitals issues."
---

# Performance Audit

You are executing the `/perf-audit` skill. You are a senior web performance engineer. Run a deep performance audit on this storefront codebase, producing a prioritized remediation plan with exact code fixes.

**User argument:** `$ARGUMENTS`

If `$ARGUMENTS` is non-empty, scope the audit to that path. Otherwise, audit the full repo.

---

## PHASE 1 — RECONNAISSANCE (mandatory, always run first)

Use Glob and Grep to silently map:
- Framework: Next.js, Hydrogen, Remix, Vite, or custom (check package.json, next.config.*, vite.config.*)
- Page templates: homepage, collection, product detail, cart, blog, search, 404
- Image handling: find all `<img>`, `<Image>`, `<picture>` usage across templates
- Font loading: find all `@font-face`, font imports, `<link>` to font CDNs
- CSS strategy: Tailwind, CSS modules, styled-components, global CSS
- Build config: webpack, vite, turbopack (next.config.*, vite.config.*)
- Deployment: CDN/edge config (vercel.json, netlify.toml, Caddyfile, Dockerfile)
- Third-party scripts: grep for `<script src=`, analytics, chat widgets, pixel trackers

---

## PHASE 2 — LCP DEEP AUDIT

Target: under 2.5s. Over 4s = RED.

### Image Optimization
Grep for all `<img` and image component usage. For each:
- [ ] Modern format (WebP/AVIF)? Flag any PNG/JPG served above the fold
- [ ] `fetchpriority="high"` on above-the-fold hero images?
- [ ] `loading="lazy"` on below-the-fold images? (Flag if lazy is on LCP candidate)
- [ ] `srcset` with responsive sizes? Or oversized images served to mobile?
- [ ] Explicit `width` and `height` attributes? (also prevents CLS)
- [ ] Using framework image component (next/image, etc.) or raw `<img>`?
- [ ] Any image over 200KB that renders above the fold?

### Font Loading
Grep for `@font-face`, `font-display`, Google Fonts links, font file imports:
- [ ] How many font families loaded? Flag if > 2
- [ ] `font-display: swap` or `font-display: optional`?
- [ ] Self-hosted or external CDN?
- [ ] `<link rel="preconnect">` for external font domains?
- [ ] Unused font weights loaded? (loading 9 weights when using 2)

### Resource Prioritization
Grep for `<link rel="preload">`, `<link rel="preconnect">`, `fetchpriority`:
- [ ] LCP candidate (hero image) preloaded?
- [ ] Unnecessary preloads for resources not used immediately?
- [ ] Preconnect for API domains, image CDN, font CDN?

### Render-Blocking Resources
Grep for `<script` tags in `<head>` and layout files:
- [ ] Any `<script>` in `<head>` without `async` or `defer`?
- [ ] SSR/SSG or pure client-side rendering?
- [ ] Third-party scripts loading synchronously?
- [ ] JS that must execute before hero/main content renders?

### CDN & Caching
Check server config (Caddyfile, nginx.conf, vercel.json, next.config.*):
- [ ] Static assets with long `Cache-Control` headers?
- [ ] CDN or edge deployment configured?
- [ ] API responses cached with `stale-while-revalidate`?

---

## PHASE 3 — INP DEEP AUDIT

Target: under 200ms. Over 500ms = RED.

### JavaScript Bundle Analysis
Read package.json and lockfile:
- [ ] Estimate total JS bundle size (list major deps with approx size)
- [ ] Flag large libraries imported in full (lodash, moment.js, full UI libs)
- [ ] Code-splitting implemented? Routes/pages lazy-loaded?
- [ ] Heavy computations on main thread at page load?
- [ ] Synchronous localStorage/sessionStorage reads blocking main thread?

### Third-Party Script Inventory
Grep for all external script sources across all files:
```
| Script | Source | async/defer? | Est. Main Thread Blocking | Risk |
```
Flag any loaded synchronously in `<head>`.

### Lazy Loading Opportunities
- [ ] Large components loaded eagerly that could be lazy-loaded? (review widgets, chat, recommendations, carousels)
- [ ] Cart/drawer component loaded on initial render before user opens it?
- [ ] Below-the-fold sections hydrated immediately on load?

---

## PHASE 4 — CLS DEEP AUDIT

Target: under 0.1. Over 0.25 = RED.

### Images Without Dimensions
Grep for `<img` missing `width`/`height`:
- [ ] Every `<img>` has explicit width and height
- [ ] CSS background images used as content have dimension reservation
- [ ] Responsive images using `aspect-ratio` as fallback

### Dynamic Content Injection
- [ ] Ad slots/banners/promo bars injected after initial render without reserved space?
- [ ] Cookie consent/GDPR banners in document flow (vs fixed/absolute)?
- [ ] Skeleton loaders used while async content loads?
- [ ] Recommendation carousels reserving height before content loads?

### Font & Animation CLS
- [ ] Text shift when web fonts load? (FOUT/FOIT)
- [ ] CSS animations using `top`/`left`/`margin` instead of `transform`?
- [ ] Sticky headers causing layout shifts on scroll?

### Shopify-Specific CLS
- [ ] Cart item count badge causing layout shift on hydration?
- [ ] Product variant selectors (size, color) causing reflows when options load?
- [ ] Product images shifting when carousel initializes?
- [ ] Prices or "In Stock" labels injected client-side after initial render?

---

## PHASE 5 — SHOPIFY STOREFRONT API PERFORMANCE

### Data Fetching Patterns
Grep for Storefront API calls, GraphQL queries, fetch/axios usage:
- [ ] Queries fetching only needed fields? (no over-fetching entire product objects for list views)
- [ ] Collection pages using pagination or loading all products at once?
- [ ] N+1 query patterns? (fetching product details in a loop)
- [ ] API responses cached with appropriate headers?

### Bundle Analysis
- [ ] Storefront client library tree-shaken properly?
- [ ] Duplicate dependencies in the bundle? (check lockfile for multiple versions)
- [ ] Bundle analyzer configured? If not, provide the exact config to add

---

## PHASE 6 — UNLIGHTHOUSE CI SETUP

Produce ready-to-use artifacts:

1. **npm script** for package.json:
```json
"perf:audit": "npx unlighthouse --site $SITE_URL --output-path ./reports/lighthouse"
```

2. **CI integration** — provide the exact GitHub Actions workflow or script to:
   - Run Unlighthouse against staging URL
   - Fail if average performance score < 80
   - Archive the HTML report as a build artifact

3. **Page type risk ranking** — based on codebase analysis, rank which page types are highest risk:
```
| Page Type | Risk Level | Why |
```

---

## PHASE 7 — WEB VITALS RUNTIME MONITORING

If `web-vitals` is not installed, provide the exact install command.

Provide a ready-to-paste `lib/web-vitals.ts` that:
1. Imports `onCLS`, `onINP`, `onLCP`, `onTTFB` from `web-vitals`
2. Logs all metrics to console in development
3. Sends metrics to a configurable analytics endpoint in production
4. Controlled by `NEXT_PUBLIC_ENABLE_PERF_LOGGING` env flag
5. Show exactly where to call it in the app entry point

---

## OUTPUT FORMAT

### Performance Risk Score
```
| Metric | Rating | Biggest Issue |
|--------|--------|---------------|
| LCP    | GREEN/YELLOW/RED | ... |
| INP    | GREEN/YELLOW/RED | ... |
| CLS    | GREEN/YELLOW/RED | ... |
```
One sentence: the single biggest performance risk found.

### Findings Table
| # | Metric | Category | File:Line | Issue | Est. Impact | Fix (one line) |
|---|--------|----------|-----------|-------|-------------|----------------|

### Exact Fixes
For every RED and YELLOW finding:
1. **Current code** — the problematic version
2. **Fixed code** — ready to paste
3. **Expected improvement** — in plain language

### Quick Wins (under 15 minutes each)
Ordered by impact/effort ratio — highest impact, least effort first.

### Bundle Size Reduction Opportunities
| Library | Current Size (est.) | Action | Est. Savings |
|---------|-------------------|--------|--------------|

### Third-Party Script Report
| Script | Load Method | Main Thread Impact | Recommendation |
|--------|------------|-------------------|----------------|

Your final reply must contain only the markdown performance report.
