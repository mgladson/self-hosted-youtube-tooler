---
name: seo-audit
description: "SEO and AEO auditing: meta tags, Open Graph, JSON-LD structured data, Core Web Vitals (LCP/INP/CLS), sitemap/robots.txt, Answer Engine Optimization for AI citability, and Shopify storefront content optimization. Sub-commands: /seo-audit:meta, :structured-data, :core-web-vitals, :sitemap, :aeo, :shopify-content. Use when optimizing SEO, AEO, adding structured data, or improving page performance."
---

# SEO Audit

You are executing the `/seo-audit` skill. You apply SEO and AEO best practices for meta tags, structured data, Core Web Vitals, sitemaps, AI citability, and Shopify storefront content.

Parse the sub-command from the user's invocation:
- `/seo-audit` → show **menu** and wait for selection
- `/seo-audit:meta` → **Meta Tags**
- `/seo-audit:structured-data` → **Structured Data**
- `/seo-audit:core-web-vitals` → **Core Web Vitals**
- `/seo-audit:sitemap` → **Sitemap & Robots**
- `/seo-audit:aeo` → **Answer Engine Optimization**
- `/seo-audit:shopify-content` → **Shopify Content Optimization**

---

## Menu (no sub-command)

```
SEO Audit — Choose a topic:

1. meta             — Title, description, Open Graph, Twitter Cards
2. structured-data  — JSON-LD schema.org markup generation
3. core-web-vitals  — LCP, INP, CLS optimization strategies
4. sitemap          — sitemap.xml, robots.txt generation and validation
5. aeo              — Answer Engine Optimization (AI citability)
6. shopify-content  — Shopify storefront content & internal linking
```

---

## Meta Tags (`:meta`)

### Complete Head Template
```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- Primary Meta -->
  <title>Page Title — Site Name</title>
  <meta name="description" content="Concise description under 155 characters." />
  <link rel="canonical" href="https://example.com/page" />

  <!-- Open Graph (Facebook, LinkedIn) -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://example.com/page" />
  <meta property="og:title" content="Page Title" />
  <meta property="og:description" content="Description for social sharing." />
  <meta property="og:image" content="https://example.com/og-image.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Page Title" />
  <meta name="twitter:description" content="Description for Twitter." />
  <meta name="twitter:image" content="https://example.com/twitter-image.jpg" />

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</head>
```

### Checklist
```
✅ Unique <title> per page (50-60 chars)
✅ Unique meta description per page (120-155 chars)
✅ Canonical URL on every page
✅ OG image at 1200x630px
✅ H1 tag on every page (one per page)
✅ Heading hierarchy (H1 → H2 → H3, no skipping)
✅ Alt text on all meaningful images
✅ lang attribute on <html>
✅ HTTPS enforced — no mixed content (http:// refs in https pages)
✅ Analytics integration present (Google Analytics, Plausible, etc.)
✅ Google Search Console verification meta tag or DNS record
```

### Canonical URL Requirements
```html
<!-- Self-referencing canonical on every page (including the homepage) -->
<link rel="canonical" href="https://example.com/blog/my-post" />

<!-- Canonical must be absolute, not relative -->
<!-- WRONG: <link rel="canonical" href="/blog/my-post" /> -->
<!-- CORRECT: <link rel="canonical" href="https://example.com/blog/my-post" /> -->

<!-- Paginated pages: canonical points to self (not page 1) -->
<!-- Page 2 of a listing: -->
<link rel="canonical" href="https://example.com/blog?page=2" />
```

Rules:
- Every page must have exactly one canonical tag
- Canonical must use HTTPS and the same domain as the page
- Canonical in sitemap.xml must match the canonical in the page head
- Use canonical to consolidate duplicate content (www vs non-www, trailing slash)

### hreflang for Multilingual Sites
```html
<!-- On every language variant of a page, list all variants -->
<link rel="alternate" hreflang="en" href="https://example.com/about" />
<link rel="alternate" hreflang="fr" href="https://example.com/fr/about" />
<link rel="alternate" hreflang="de" href="https://example.com/de/about" />
<!-- x-default for language selector or default language -->
<link rel="alternate" hreflang="x-default" href="https://example.com/about" />
```

Rules:
- hreflang is reciprocal — every page must reference all its variants including itself
- Use BCP 47 language codes: `en`, `en-US`, `fr-CA`, not `english`
- Validate with Google Search Console → International Targeting report

### Robots Meta Tag
```html
<!-- Default: allow indexing and following links (implicit, no tag needed) -->
<meta name="robots" content="index, follow" />

<!-- Block indexing but allow crawling (e.g. staging, thank-you pages) -->
<meta name="robots" content="noindex, follow" />

<!-- Block link following (low-value or sponsored links) -->
<meta name="robots" content="index, nofollow" />

<!-- Prevent cached version in Google -->
<meta name="robots" content="noarchive" />

<!-- Block entirely (login pages, admin, duplicate content) -->
<meta name="robots" content="noindex, nofollow" />
```

When to use each:
- `noindex`: staging environments, duplicate pages, thin content, paginated pages beyond page 2
- `nofollow`: untrusted user-generated content, paid/sponsored links
- `noarchive`: pages with time-sensitive content (pricing, legal) where cached version would be misleading

### Open Graph Image Requirements
```
Dimensions: 1200 × 630 pixels (1.91:1 aspect ratio)
File size: < 1 MB (Facebook), < 5 MB (Twitter/X)
Format: JPG or PNG preferred; WebP has limited support in OG scrapers
og:image:alt: Required for accessibility — describe the image content

Example:
<meta property="og:image" content="https://example.com/og/homepage.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Dashboard showing monthly revenue trends" />
```

---

## Structured Data (`:structured-data`)

### JSON-LD Templates
```html
<!-- Organization -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Example Inc",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "sameAs": [
    "https://twitter.com/example",
    "https://linkedin.com/company/example"
  ]
}
</script>

<!-- Article / Blog Post -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Build a REST API",
  "author": { "@type": "Person", "name": "Jane Smith" },
  "datePublished": "2024-01-15",
  "dateModified": "2024-01-20",
  "image": "https://example.com/article-image.jpg",
  "publisher": {
    "@type": "Organization",
    "name": "Example Inc",
    "logo": { "@type": "ImageObject", "url": "https://example.com/logo.png" }
  }
}
</script>

<!-- Product -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Widget Pro",
  "description": "Professional widget for enterprise use",
  "image": "https://example.com/widget.jpg",
  "offers": {
    "@type": "Offer",
    "price": "49.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "120"
  }
}
</script>

<!-- FAQ -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is your return policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We offer 30-day returns on all products."
      }
    }
  ]
}
</script>
```

### BreadcrumbList Schema
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://example.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": "https://example.com/blog"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "How to Build a REST API",
      "item": "https://example.com/blog/how-to-build-rest-api"
    }
  ]
}
</script>
```

### Event Schema
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Annual Developer Conference",
  "startDate": "2024-09-15T09:00:00-07:00",
  "endDate": "2024-09-17T18:00:00-07:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Moscone Center",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "747 Howard St",
      "addressLocality": "San Francisco",
      "addressRegion": "CA",
      "postalCode": "94103",
      "addressCountry": "US"
    }
  },
  "organizer": {
    "@type": "Organization",
    "name": "Example Inc",
    "url": "https://example.com"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/conference/tickets",
    "price": "299",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "validFrom": "2024-06-01"
  }
}
</script>
```

### Review / AggregateRating Schema
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Widget Pro",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "bestRating": "5",
    "worstRating": "1",
    "reviewCount": "312"
  },
  "review": [
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Alex Johnson" },
      "datePublished": "2024-01-10",
      "reviewBody": "Excellent product, works exactly as described.",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      }
    }
  ]
}
</script>
```

### Validation Tools
```
Google's Rich Results Test:
  https://search.google.com/test/rich-results
  — Tests which rich results your page is eligible for

Schema.org Validator:
  https://validator.schema.org
  — Validates JSON-LD against schema.org specification

@google/structured-data-testing-tool (CLI):
  npm install -g @google/structured-data-testing-tool
  sdtt --url https://example.com/blog/my-post
  sdtt --file ./page.html
```

---

## Core Web Vitals (`:core-web-vitals`)

### Metrics
```
LCP (Largest Contentful Paint) — Loading performance
  Good: < 2.5s | Needs Improvement: 2.5-4s | Poor: > 4s

INP (Interaction to Next Paint) — Responsiveness
  Good: < 200ms | Needs Improvement: 200-500ms | Poor: > 500ms

CLS (Cumulative Layout Shift) — Visual stability
  Good: < 0.1 | Needs Improvement: 0.1-0.25 | Poor: > 0.25
```

### LCP Optimization

**Identify the LCP element:**
```
1. Open Chrome DevTools → Performance tab
2. Click Record, reload the page, click Stop
3. In the Timings row, hover over "LCP" marker
4. DevTools highlights the LCP element in the viewport
5. Common LCP elements: hero image, H1 heading, above-fold text block
```

**Preload the LCP image:**
```html
<!-- Add to <head> before any scripts -->
<link rel="preload" as="image" href="/hero-image.webp" fetchpriority="high" />

<!-- Use modern formats with fallback -->
<picture>
  <source srcset="/hero.avif" type="image/avif" />
  <source srcset="/hero.webp" type="image/webp" />
  <img src="/hero.jpg" alt="Hero image" width="1200" height="600"
       fetchpriority="high" decoding="async" />
</picture>
```

Additional LCP improvements:
- Serve images from a CDN geographically close to users
- Eliminate render-blocking resources above the fold
- Use server-side rendering or static generation for the LCP element
- Avoid lazy-loading the LCP image (`loading="lazy"` hurts LCP)

### INP Optimization

**Event processing time budget: 50ms total** (input delay + processing + presentation delay)

```javascript
// Measure INP with PerformanceObserver
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.interactionId) {
      console.log(`INP candidate: ${entry.duration}ms`, entry.name);
    }
  }
});
observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
```

INP improvement strategies:
- Break long tasks (> 50ms) with `scheduler.yield()` or `setTimeout(..., 0)`
- Move heavy computation off the main thread to Web Workers
- Debounce rapid user input (search, resize handlers)
- Avoid layout thrashing in event handlers (read all, then write all DOM)

### CLS Prevention

**Common causes of layout shift:**
```
- Images without explicit width/height attributes
- Ads, embeds, iframes without reserved space
- Dynamically injected content above existing content
- Web fonts causing FOIT (Flash of Invisible Text) or FOUT (Flash of Unstyled Text)
- Animations that change layout properties (top, left, width, height)
```

```css
/* Always set explicit dimensions on images/videos */
img, video { aspect-ratio: 16 / 9; width: 100%; height: auto; }

/* Reserve space for dynamic content */
.ad-slot { min-height: 250px; }
.skeleton { min-height: 200px; background: #f0f0f0; }

/* aspect-ratio fix for responsive images */
.hero-image {
  aspect-ratio: 1200 / 630;
  width: 100%;
  height: auto;
}

/* Prevent font-swap layout shift */
@font-face {
  font-family: 'MyFont';
  font-display: optional; /* prevents FOUT entirely */
}
```

---

## Sitemap & Robots (`:sitemap`)

### sitemap.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/products</loc>
    <lastmod>2024-01-14</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

### robots.txt
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /private/

Sitemap: https://example.com/sitemap.xml
```

### Sitemap Validation Checklist
```
□ All URLs return 200 (no 404s, 301s, or 5xx)
□ No noindex pages included in the sitemap
□ Canonical URL in the page <head> matches the URL in the sitemap exactly
□ All URLs use HTTPS, not HTTP
□ lastmod reflects actual content modification date (not crawl date)
□ File is UTF-8 encoded and well-formed XML
□ Total file size < 50 MB uncompressed
□ Total URL count < 50,000 per sitemap file
□ Sitemap is referenced in robots.txt
□ Sitemap is submitted to Google Search Console and Bing Webmaster Tools
□ Custom 404 page exists and returns HTTP 404 status (not 200)
□ Redirects use 301 (permanent) not 302 (temporary) for moved pages
□ No redirect chains (A→B→C should be A→C)
```

### Priority and changefreq Guidelines
```
priority (0.0 – 1.0): hint to crawler about relative importance
  1.0 — Homepage
  0.9 — Top-level category pages
  0.8 — Important product/service pages
  0.5 — Blog posts, standard pages (default if omitted)
  0.3 — Archive pages, old content

changefreq: hint about how often content changes (NOT a crawl directive)
  always   — Changes with every request (avoid — not meaningful)
  hourly   — News feeds, live scores
  daily    — Blog home, news pages
  weekly   — Product catalog, documentation
  monthly  — About, contact, legal pages
  yearly   — Rarely changed pages
  never    — Archived content

Note: Google treats both priority and changefreq as hints, not directives.
Actual crawl frequency is determined by Google's own signals.
```

### Dynamic Sitemap Generation

**Next.js (App Router):**
```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await fetchAllPosts(); // your data fetching

  return [
    { url: 'https://example.com', lastModified: new Date() },
    { url: 'https://example.com/blog', lastModified: new Date() },
    ...posts.map((post) => ({
      url: `https://example.com/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
    })),
  ];
}
```

**Gatsby:**
```javascript
// gatsby-config.js
plugins: [
  {
    resolve: 'gatsby-plugin-sitemap',
    options: {
      query: `{ allSitePage { nodes { path } } }`,
      resolveSiteUrl: () => 'https://example.com',
      resolvePages: ({ allSitePage: { nodes } }) => nodes,
      serialize: ({ path }) => ({ url: path }),
    },
  },
],
```

### Sitemap Index for Large Sites (>50,000 URLs)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-products.xml</loc>
    <lastmod>2024-01-15</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-blog.xml</loc>
    <lastmod>2024-01-14</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-categories.xml</loc>
    <lastmod>2024-01-10</lastmod>
  </sitemap>
</sitemapindex>
```

Rules:
- Each child sitemap must have < 50,000 URLs and < 50 MB uncompressed
- Register the sitemap index URL (not child URLs) in Google Search Console
- Compress child sitemaps with gzip (.xml.gz) for large sites

---

## Answer Engine Optimization (`:aeo`)

AEO makes your content easily cited by AI tools (Perplexity, ChatGPT, Google AI Overviews, Bing Copilot).

### Audit Process
Scan the codebase using Glob/Grep/Read tools. For each page template, evaluate the checks below. Report findings as a prioritized table.

### Content Structure for AI Extraction
```
Every content page should have:
1. A direct, quotable answer sentence in the first 60 words (TL;DR position)
   - 40-60 words, factual, standalone — AI tools extract this as a citation
   - Example: "A digital product storefront is a self-hosted e-commerce platform
     that lets creators sell downloads, courses, and subscriptions without
     marketplace fees."

2. Short paragraphs (2-3 sentences max) with clear topic sentences
   - AI chunking works best on well-separated, single-topic paragraphs

3. Definition-style sentences on category/collection pages
   - Pattern: "[Category] is..." or "[Product type] refers to..."
   - These get extracted as featured snippets and AI definitions
```

### FAQ Content & Schema
```
Every product and collection page should have 3-5 FAQ pairs:
- Questions phrased as real buyer queries (how users actually search)
- Answers: direct, 40-60 words, no fluff, no "Great question!"
- Must be marked up with FAQPage JSON-LD schema

Grep for:
- Existing FAQ sections without schema markup
- FAQPage schema that exists but has empty or thin answers
- Pages with no FAQ section at all (gap)
```

### HowTo & QAPage Schema
```html
<!-- HowTo — for any step-by-step content -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to set up your digital storefront",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Create your account",
      "text": "Sign up at example.com and choose your store name."
    },
    {
      "@type": "HowToStep",
      "name": "Upload your first product",
      "text": "Go to Products > Add New and upload your digital file."
    }
  ]
}
</script>
```

### Entity & Brand Markup
```
Check for Organization schema with ALL of these fields:
- name, url, logo, description, sameAs (social profiles)
- This is how AI tools identify WHAT your site/product IS

If missing, the site is invisible to AI knowledge graphs.
```

### Content Freshness Signals
```
Check for last-updated timestamps in markup:
- Article/blog pages: dateModified in Article schema JSON-LD
- Product pages: dateModified or last-updated visible on page
- Grep for: dateModified, lastmod, updated_at, modifiedDate in templates

AI tools and Google prefer fresh content:
- Pages with visible "Last updated: [date]" get higher citation rates
- Article schema must have both datePublished AND dateModified
- If dateModified is missing, add it — this is a quick win
```

### AEO Content Rewrites
When auditing existing content, flag pages that need rewrites:
- **Fluffy intros** → rewrite to lead with the answer
- **Long paragraphs** → break into 2-3 sentence chunks
- **No quotable sentence** → add a standalone definitive claim
- **Marketing-speak** → replace with factual, specific language

### Snippet Optimization
```
Meta descriptions: write as direct answers to the page's target query
  BAD:  "Welcome to our store! We have the best products for you."
  GOOD: "Self-hosted digital storefront for selling downloads, courses,
         and subscriptions. No marketplace fees. Full ownership of
         customer data."

Check: does the meta description answer the query someone would
type to find this page?
```

### AEO Checklist
```
For each content page, verify:
[ ] First 60 words contain a direct, quotable answer
[ ] FAQPage schema with 3-5 real Q&A pairs
[ ] Organization schema with full entity details
[ ] Short paragraphs (2-3 sentences)
[ ] At least one definition-style sentence on category pages
[ ] Meta description written as a direct answer
[ ] HowTo schema on any step-by-step content
[ ] No fluffy intros — answer first, context second
[ ] Content freshness: dateModified in schema + visible last-updated date
```

### AEO Output Format
```
Report findings as:

### Executive Summary
- Total findings: Critical / High / Medium / Low
- Top 3 highest-impact AEO fixes

### Findings Table
| # | Priority | Category | File:Line | Issue | Fix Summary |

### Detailed Fixes
For Critical and High: explanation + exact code/content change needed

### Quick Wins (under 30 minutes)
Simple tag additions, schema blocks, or one-line content edits

### AEO Content Rewrites
For existing pages: specific rewrite suggestions to improve AI extractability
```

---

## Shopify Content Optimization (`:shopify-content`)

Shopify storefront-specific content strategy and internal linking audit.

### Audit Process
Scan all page templates, product pages, collection pages, and layout files using Glob/Grep/Read. Evaluate against the checks below. Report as a prioritized findings table.

### H1 Strategy
```
Grep for all H1 tags across the codebase.

Homepage H1:
- Must be an exact-match search query, NOT a brand tagline
  BAD:  "Adventure Awaits" / "Welcome to Our Store"
  GOOD: "Digital Product Storefront for Creators"

Product page H1:
- Must match how buyers search
  BAD:  "The Explorer Pro" (brand name only)
  GOOD: "Men's Waterproof Hiking Boots — Explorer Pro"

Collection page H1:
- Must be the category keyword
  BAD:  "Our Collection"
  GOOD: "Digital Download Templates"

Every H1 must be unique across the entire site.
Grep for duplicate H1 text across templates.
```

### Product Description Structure
```
Audit product page templates for this structure:

1. Problem statement (1-2 sentences) — what pain does this solve?
2. Key features (bullet points) — what does it do?
3. Specs/details (structured data) — dimensions, format, compatibility
4. NO fluffy intro paragraphs ("We're so excited to introduce...")

Each product page needs a single "definitive claim" sentence:
- Standalone, quotable, states what makes this THE best for a specific use case
- Example: "The only self-hosted storefront that includes built-in
  email marketing and zero transaction fees."
```

### Comparison & Structured Data
```
Check for:
- Comparison tables (vs. competitors or vs. other products)
  - Must be clean HTML <table>, NOT images
  - AI tools can extract tabular data for comparison answers

- Product schema completeness — verify ALL fields:
  name, description, image, brand, price, priceCurrency,
  availability, aggregateRating, review

- BreadcrumbList schema on ALL product and collection pages
  - Verify the breadcrumb trail matches the actual site hierarchy
```

### URL Structure & Content Quality
```
Check route definitions and page content:

URL structure:
- URLs must be clean, lowercase, hyphenated: /collections/hiking-boots (not /collections?id=123)
- No unnecessary nesting: /products/boots (not /shop/all/products/footwear/boots)
- Keyword-relevant slugs: /blog/best-hiking-boots-2024 (not /blog/post-47)
- Grep for route definitions and dynamic slug generation

Thin content detection:
- Flag any content page with < 300 words of body text (excluding nav/footer)
- Flag product pages with description under 50 words
- Flag collection pages with no descriptive text (just product grid)
- Keyword stuffing: flag pages where the same keyword appears > 3% of body text

Broken internal links:
- Grep all href values across templates
- Cross-reference against defined routes/pages
- Flag any hardcoded links to pages that don't exist
- Flag any links using http:// instead of https://
```

### Internal Linking Audit
```
Grep for link patterns across templates:

Product pages must link to:
- Parent collection page
- 2-3 related products
- Any relevant blog/guide content

Collection pages must link to:
- Top 3-5 products in the collection
- Parent category (if nested)
- Related collections

Homepage must link to:
- All top-level collections
- Featured/popular products

Check for:
- Orphan pages (no internal links pointing to them)
  Grep all href values across templates, compare against known routes
- Anchor text quality: flag any "click here", "read more", "learn more"
  These should be descriptive: "view hiking boots collection"
- Site hierarchy: homepage → collection → product must be navigable
  in both directions (up and down)
```

### Heading Hierarchy Validation
```
For each page template, verify:
- Exactly one H1 per page
- H2s follow H1 (no H3 before H2)
- No skipped levels (H1 → H3 without H2)
- Heading text is keyword-relevant, not generic ("Details", "Info")

Grep for: <h1>, <h2>, <h3>, <h4> across all templates
Flag any page with 0 or 2+ H1 tags.
```

### Content Gap Analysis
```
Based on the product catalog and site structure, suggest:
- 3-5 blog post topics targeting long-tail keywords
- 2-3 FAQ pages for common buyer questions
- Any missing collection pages that would capture search traffic

Format:
| Suggested Content | Type | Target Keyword | Why |
```

### Shopify Content Checklist
```
For each page type, verify:
[ ] H1 is keyword-optimized and unique site-wide
[ ] Product descriptions follow Problem → Features → Specs structure
[ ] Definitive claim sentence present on each product page
[ ] Product schema has ALL required fields
[ ] BreadcrumbList schema present
[ ] Internal links to parent collection and related products
[ ] No orphan pages
[ ] No broken internal links
[ ] No "click here" anchor text
[ ] Heading hierarchy is correct (one H1, logical H2/H3)
[ ] Comparison tables in HTML (not images)
[ ] FAQ section with FAQPage schema
[ ] URL slugs are clean, lowercase, keyword-relevant
[ ] No thin content pages (< 300 words on content pages, < 50 words product descriptions)
[ ] No keyword stuffing (same keyword > 3% of body text)
```

### Shopify Content Output Format
```
Report findings as:

### Executive Summary
- Total findings: Critical / High / Medium / Low
- Top 3 highest-impact content fixes

### Findings Table
| # | Priority | Category | File:Line | Issue | Fix Summary |

### Detailed Fixes
For Critical and High: explanation + exact code/content change

### Quick Wins (under 30 minutes)
Tag additions, schema blocks, one-line edits

### Content Recommendations
| Suggested Content | Type | Target Keyword | Why |
```

---

## Hard Constraints
- Every page must have unique title and meta description
- Canonical URLs must be absolute (https://), not relative
- JSON-LD structured data must validate at schema.org validator
- Images must have explicit width/height to prevent CLS
- LCP element must load within 2.5 seconds
- robots.txt must not block CSS/JS files needed for rendering
- Never include noindex pages in the sitemap — sitemap signals indexability
- The canonical URL in the page `<head>` must match the URL in sitemap.xml exactly
- Page titles must be 50-60 characters and unique per page — duplicate titles cause ranking cannibalization
- Every content page must have a quotable answer sentence in the first 60 words — AI tools extract the opening for citations
- FAQPage schema must have real Q&A content (not placeholder text) — Google penalizes empty structured data
- Product pages must have Product schema with price, availability, and brand at minimum
- H1 tags must be unique across the entire site — duplicate H1s cause ranking cannibalization
- Every product/collection page needs BreadcrumbList schema matching actual site hierarchy
- Internal links must use descriptive anchor text — never "click here" or "read more"
