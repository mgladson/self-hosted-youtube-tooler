---
name: bundle-analyzer
description: "Frontend bundle analysis: bundle size visualization and analysis, tree-shaking audit, code splitting strategies (route-based/dynamic imports), and dependency weight analysis with lighter alternatives. Sub-commands: /bundle-analyzer:analyze, :tree-shake, :split, :deps. Use when optimizing frontend bundle size or analyzing JavaScript dependencies."
---

# Bundle Analyzer

You are executing the `/bundle-analyzer` skill. You apply frontend optimization best practices for bundle analysis, tree-shaking, code splitting, and dependency management.

Parse the sub-command from the user's invocation:
- `/bundle-analyzer` → show **menu** and wait for selection
- `/bundle-analyzer:analyze` → **Bundle Analysis**
- `/bundle-analyzer:tree-shake` → **Tree-Shaking Audit**
- `/bundle-analyzer:split` → **Code Splitting**
- `/bundle-analyzer:deps` → **Dependency Analysis**

---

## Menu (no sub-command)

```
Bundle Analyzer — Choose a topic:

1. analyze    — Bundle visualization, size breakdown, source map analysis
2. tree-shake — Dead code elimination, side-effect analysis, barrel file audit
3. split      — Route-based splitting, dynamic imports, lazy loading
4. deps       — Dependency weight, lighter alternatives, duplicate detection
```

---

## Bundle Analysis (`:analyze`)

### Tools
```bash
# webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/stats.json

# source-map-explorer (works with any bundler)
npx source-map-explorer dist/main.*.js

# Vite: rollup-plugin-visualizer
# Add to vite.config.ts: import { visualizer } from 'rollup-plugin-visualizer'

# Next.js
ANALYZE=true next build  # with @next/bundle-analyzer
```

### Size Budget
```json
// package.json or bundlesize config
{
  "bundlesize": [
    { "path": "dist/main.*.js", "maxSize": "150 kB" },
    { "path": "dist/vendor.*.js", "maxSize": "200 kB" },
    { "path": "dist/**/*.css", "maxSize": "30 kB" }
  ]
}
```

### webpack-bundle-analyzer Setup
```bash
# Step 1: generate stats file from webpack
npx webpack --profile --json > stats.json

# Step 2: open interactive visualizer
npx webpack-bundle-analyzer stats.json

# Or add to webpack.config.js:
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',        // generates report.html, does not start server
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,           // set true to auto-open on build
    })
  ]
};
```

### Size Budget Enforcement in CI
```json
// .size-limit.json (size-limit tool)
[
  {
    "path": "dist/main.*.js",
    "limit": "150 KB",
    "gzip": true
  },
  {
    "path": "dist/vendor.*.js",
    "limit": "200 KB",
    "gzip": true
  }
]
```

```yaml
# GitHub Actions CI step
- name: Check bundle size
  run: |
    npm run build
    npx size-limit
  # size-limit exits with code 1 if any limit is exceeded → fails the build
```

```json
// Alternative: bundlesize in package.json
{
  "bundlesize": [
    { "path": "./dist/main.*.js", "maxSize": "150 kB" },
    { "path": "./dist/vendor.*.js", "maxSize": "200 kB" }
  ],
  "scripts": {
    "size": "bundlesize"
  }
}
```

### Before/After Comparison Format
```
When reporting bundle findings, always include this format:

## Bundle Analysis Results

### Before
| Chunk       | Raw Size | Gzipped |
|-------------|----------|---------|
| main.js     | 312 kB   | 98 kB   |
| vendor.js   | 540 kB   | 162 kB  |
| Total       | 852 kB   | 260 kB  |

### After (optimization applied)
| Chunk       | Raw Size | Gzipped | Delta     |
|-------------|----------|---------|-----------|
| main.js     | 198 kB   | 61 kB   | -37 kB    |
| vendor.js   | 310 kB   | 94 kB   | -68 kB    |
| Total       | 508 kB   | 155 kB  | -105 kB   |

### Changes Made
- Replaced moment.js with date-fns (saved 68 kB gzipped)
- Lazy-loaded chart.js on /analytics route (saved 37 kB initial load)
```

---

## Tree-Shaking Audit (`:tree-shake`)

### Barrel File Anti-Pattern
```typescript
// Bad: barrel file imports everything
// utils/index.ts
export { formatDate } from './date';
export { formatCurrency } from './currency';
export { parseCSV } from './csv';  // Heavy dep, rarely used

// Importing just formatDate pulls in ALL exports (including csv parser)
import { formatDate } from './utils';

// Good: direct imports
import { formatDate } from './utils/date';
```

### Side-Effect Analysis
```json
// package.json — mark package as side-effect-free for tree-shaking
{
  "sideEffects": false
}

// Or specify files with side effects
{
  "sideEffects": ["*.css", "*.scss", "./src/polyfills.ts"]
}
```

### Common Tree-Shaking Blockers
```
1. CommonJS modules (require()) — cannot be tree-shaken
   Fix: Use ESM (import/export) or find ESM version of package

2. Barrel files (index.ts re-exports) — import everything
   Fix: Use direct file imports

3. Side-effectful imports — bundler can't remove
   Fix: Mark sideEffects: false in package.json

4. Dynamic property access — obj[key] prevents dead code elimination
   Fix: Use static imports and destructuring
```

### How to Check if a Module is Side-Effect-Free
```
1. Check the package's package.json for "sideEffects": false
   - If present and false: safe to tree-shake
   - If absent or set to an array: some files have side effects

2. Check if the package uses CJS (require/module.exports):
   - CJS cannot be tree-shaken by any bundler
   - Look for "main" field in package.json (CJS entry) vs "module" (ESM entry)
   - Prefer packages with "module" or "exports" fields pointing to .mjs files

3. Look for a "module" or "exports" field in package.json:
   { "main": "dist/index.cjs.js", "module": "dist/index.esm.js" }
   → Bundlers use the ESM version for tree-shaking

4. Test empirically: import one function and check if bundle size matches
   the size of just that function vs. the entire library
```

### Common Tree-Shaking Problem Packages
```
lodash (CJS only):
  - Problem: require('lodash') imports entire 72 kB library
  - Fix: use lodash-es (ESM version), or use native alternatives
  - Example: import { debounce } from 'lodash-es'  → only debounce bundled

moment.js:
  - Problem: 290 kB with all locales, cannot be tree-shaken
  - Fix: replace with date-fns (15 kB, fully tree-shakeable)
  - Or: replace with dayjs (2 kB core, plugins loaded on demand)

material-ui (old versions):
  - Problem: import { Button } from '@material-ui/core' imports everything
  - Fix: import Button from '@material-ui/core/Button' (direct path import)
  - New: @mui/material v5+ supports tree-shaking with proper bundler config
```

### ESM vs. CJS: Why CJS Cannot Be Tree-Shaken
```
CommonJS (CJS) — dynamic, evaluated at runtime:
  const utils = require('./utils');        // entire module loaded
  const fn = utils[someVariable];          // bundler can't know what's used
  module.exports = { ... };               // exports determined at runtime

ESM — static, analyzed at build time:
  import { formatDate } from './utils';   // bundler knows exactly what's needed
  export function formatDate() { ... }    // exports are statically declared

Why this matters:
  - Bundlers (webpack, Rollup, esbuild) perform static analysis
  - Static analysis requires knowing import/export shapes at build time
  - CJS is dynamic → bundler must include the entire module to be safe
  - ESM is static → bundler can eliminate unused exports with confidence
```

---

## Code Splitting (`:split`)

### Route-Based Splitting (React)
```tsx
import { lazy, Suspense } from 'react';

// Each route loads its own chunk
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Suspense>
  );
}
```

### Dynamic Import for Heavy Libraries
```typescript
// Bad: imports chart library for every page
import { Chart } from 'chart.js';

// Good: load chart library only when needed
async function renderChart(data: ChartData) {
  const { Chart } = await import('chart.js');
  new Chart(canvas, { type: 'line', data });
}
```

### React.lazy + Suspense Complete Example
```tsx
import React, { lazy, Suspense } from 'react';

// Lazy-load the heavy PDF viewer component
const PdfViewer = lazy(() => import('./components/PdfViewer'));

// Loading fallback shown while chunk downloads
function PdfLoadingFallback() {
  return (
    <div className="pdf-loading">
      <div className="spinner" aria-label="Loading PDF viewer..." />
      <p>Loading viewer...</p>
    </div>
  );
}

// Error boundary for failed chunk loads (network error, etc.)
class ChunkErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <p>Failed to load viewer. <button onClick={() => window.location.reload()}>Retry</button></p>;
    }
    return this.props.children;
  }
}

export function DocumentPage({ url }: { url: string }) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PdfLoadingFallback />}>
        <PdfViewer url={url} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}
```

### Next.js Automatic Code Splitting
```
Next.js splits bundles automatically:

1. Per-page splitting:
   - Each file in /pages or /app gets its own JS chunk
   - Only the chunk for the current page is loaded on navigation
   - Shared code extracted into common chunks automatically

2. Dynamic imports with next/dynamic:
   import dynamic from 'next/dynamic';
   const HeavyChart = dynamic(() => import('../components/HeavyChart'), {
     loading: () => <p>Loading chart...</p>,
     ssr: false,   // disable server-side rendering for client-only libs
   });

3. Server Components (App Router):
   - Server Components never ship to the client bundle
   - Only Client Components ("use client") are included in JS bundles
   - Move data fetching to Server Components to reduce client bundle size
```

### Preloading Critical Chunks
```html
<!-- HTML: preload a chunk that will definitely be needed soon -->
<link rel="preload" href="/static/js/settings.chunk.js" as="script">

<!-- HTML: prefetch a chunk that might be needed in the future -->
<link rel="prefetch" href="/static/js/analytics.chunk.js">
```

```typescript
// webpack magic comments: prefetch and preload via dynamic import
// prefetch: browser downloads during idle time (low priority)
const Analytics = lazy(() => import(/* webpackPrefetch: true */ './pages/Analytics'));

// preload: browser downloads in parallel with current chunk (high priority)
const Modal = lazy(() => import(/* webpackPreload: true */ './components/Modal'));

// Named chunk for easier identification in bundle report
const Settings = lazy(() => import(/* webpackChunkName: "settings" */ './pages/Settings'));
```

---

## Dependency Analysis (`:deps`)

### Common Heavy Dependencies + Lighter Alternatives
```
| Heavy Package     | Size    | Alternative        | Size   | Savings |
|-------------------|---------|--------------------|--------|---------|
| moment            | 290 kB  | date-fns           | 15 kB* | 95%     |
| lodash            | 72 kB   | lodash-es (tree)   | ~5 kB* | 93%     |
| axios             | 29 kB   | fetch (built-in)   | 0 kB   | 100%    |
| uuid              | 12 kB   | crypto.randomUUID  | 0 kB   | 100%    |
| classnames        | 1 kB    | clsx               | 0.3 kB | 70%     |

* After tree-shaking with only used functions
```

### Duplicate Detection
```bash
# Find duplicate packages in bundle
npx depcheck  # Find unused dependencies
npx npm-check # Interactive update and cleanup

# Check for duplicate versions
npm ls lodash  # Shows all versions installed
npm dedupe     # Resolve duplicate versions
```

### Bundlephobia Integration
```
Before adding any new dependency, check its cost at bundlephobia.com:

  https://bundlephobia.com/package/<package-name>
  https://bundlephobia.com/package/lodash@4.17.21

Bundlephobia reports:
  - Minified size
  - Minified + gzipped size (what users actually download)
  - Download time on slow 3G
  - Whether the package is tree-shakeable
  - Side-by-side comparison with alternatives

Workflow:
  1. Before running: npm install <package>
  2. First check: bundlephobia.com/package/<package>
  3. If gzipped size > 10 kB: consider alternatives or justify the cost
  4. If not tree-shakeable: factor in the full size, not just what you use
```

### Common Replacement Table
```
| Current Dep    | Replacement        | Why Switch                              |
|----------------|--------------------|-----------------------------------------|
| moment         | date-fns           | Tree-shakeable, 95% smaller             |
| moment         | dayjs              | 2 kB API-compatible drop-in             |
| lodash         | native JS / radash | Array/object methods now built-in       |
| lodash         | lodash-es          | ESM version, tree-shakeable             |
| axios          | native fetch       | Built into all modern browsers/Node 18+ |
| request        | native fetch / got | request is deprecated                   |
| jquery         | vanilla JS         | DOM APIs are now comprehensive          |
| underscore     | native JS          | Superseded by ES6+ array methods        |
| bluebird       | native Promise     | Native Promises match feature set       |
| glob (old)     | fast-glob          | Faster, actively maintained             |
| uuid           | crypto.randomUUID  | Zero cost, built into browser/Node      |
```

---

## Hard Constraints
- Set bundle size budgets and enforce in CI (fail build if exceeded)
- Use ESM imports — CommonJS prevents tree-shaking
- Avoid barrel files (index.ts re-exports) for large modules
- Lazy-load routes and heavy libraries (chart, editor, PDF)
- Never import the full library when you use one function (lodash, date-fns)
- Audit new dependencies for size impact before adding (bundlephobia.com)
- Set bundle size budgets in CI using size-limit or bundlesize, and configure the CI pipeline to fail when any budget is exceeded — size regressions caught in CI are far cheaper to fix than after release
- Never add a dependency larger than 10 kB gzipped without explicitly documenting the size/value tradeoff in the PR: state the gzipped size, what functionality it provides, and why a smaller alternative was not chosen
