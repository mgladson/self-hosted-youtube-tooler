# Subscription Tiers — Free vs Paid Plan

**Status:** Approved via `/review-plan` Pass 3 (verified). Pass 1 found 3 High / 12 Medium / 5 Low; resolved down to 0/0/0 with 2 advisory Lows.
**Goal:** Divide the YouTube-tooling features into a **free tier with usage limits** and a **paid subscription** that unlocks more usage. Free is limited because the costly work (transcripts, downloads) runs on our server; paid covers that cost.

> Approval is a structured-review opinion, not a correctness guarantee. Final judgment rests with the human.

---

## 1. Feature delivery map (where the work — and the cost — actually is)

This is the foundation of the tier design. Verified against the current code.

| Feature (route) | What hits YouTube | Where it runs | Cost to us |
|---|---|---|---|
| **Thumbnails** (`/thumbnails`) | image loads | **Client** — `<img src="i.ytimg.com/...">` directly in the browser. Server only on the *Download* button (`/api/youtube/thumbnail` adds the attachment header) | ~zero |
| **Tags & SEO** (`/tags`) | `/api/youtube/extract` (yt-dlp) | Server fetches tags; keyword ideas computed **client-side** | one yt-dlp call, cached 30d |
| **Transcript** (`/transcript`) | `/api/youtube/transcript` (yt-dlp) | Server fetches captions; de-overlap + TXT/MD/SRT export **client-side** | one yt-dlp call, cached 30d |
| **Extractor / home** (`/`) | `/extract` + `/formats` (parallel) | Server; bundles all of the above | two yt-dlp calls, cached |
| **Download** (`/download`) | `/formats` then `/download` (yt-dlp **+ ffmpeg**) | **Server, heavy** — merges DASH streams, temp file, streams back | **high**: egress GB + CPU + disk + highest YouTube-ban risk |

**Cost reality (drives the paywall):**
1. **HD/4K video downloads are by far the most expensive** — big egress, ffmpeg merge, temp disk, every time, uncacheable. This is the natural paid wall.
2. **Lookups (transcript/tags/metadata/formats)** are cheap text, cached 30 days → a repeat view is ~free. Keep these generous; the limit mainly stops bulk scraping/resale of the cache.
3. **Thumbnail viewing + all client-side compute** (keyword ideas, exports, dedup) are free to us.

> Note: the original framing was "transcripts = the server cost." In reality transcripts are cheap cached text; **downloads** are the expensive server feature, and *everything* except thumbnail-viewing already runs server-side via yt-dlp.

---

## 2. Tier design

Identity = **email** via the existing Google customer OAuth. Plan source of truth = the `subscriptions` table (below), looked up per-request (cached ~60s) — **not** stored in the session, so upgrades/cancels reflect within ~60s rather than on next login.

| | **Anonymous** (IP-keyed) | **Free, logged-in** (email-keyed) | **Pro** (~$6–9/mo, email-keyed) |
|---|---|---|---|
| Thumbnails + client-side compute | Unlimited | Unlimited | Unlimited |
| Lookups (transcript/tags/metadata, pooled) | **10/day** | **25/day** | Unlimited (soft 500/day anti-abuse) |
| Audio / SD ≤720p download | ❌ login required | **2/day** | Generous (50/day) |
| 1080p / 4K download | ❌ | ❌ | ✅ |
| Proxy routing | shared IP | shared IP | dedicated `YT_DLP_PROXY`, never throttled |

**Rules:**
- **Downloads require login** (even free SD/audio). IP quotas are trivially reset via VPN/CGNAT; gating the *expensive* path behind an account is the real cost control (and creates the account that upgrading requires). [resolves review #13]
- The existing **per-minute burst limits stay** beneath the daily quota (`youtube:rl` 20/60s, `youtube:dl:rl` 10/600s); raise them for Pro. [#3]
- Quota is charged on the **cache-miss path only** (the request that actually hits YouTube), and **per videoId**, so one home-page Extract (parallel `/extract`+`/formats`) costs **1** lookup, and re-viewing a cached video costs **0**. [#8, #9]

Pricing ($6–9/mo) and free numbers are business knobs — adjust freely; they live in one config block + the entitlement helper.

---

## 3. Backend

### 3.1 Migration `0028_subscriptions` (node-pg-migrate, up + down)

Pattern: follows `migrations/0001`–`0027`. Auto-runs in dev (`runMigrations()` when `NODE_ENV=development`); prod must run `node-pg-migrate up` in the deploy step. [#20]

```
subscriptions
  email                   text         UNIQUE NOT NULL   -- lower-cased; matches session.user.email & customer_leads.email. NO FK (decoupled — a fast webhook can land before the lead row). [#11]
  stripe_customer_id      text         UNIQUE             -- captured at checkout.session.completed; the JOIN KEY for all later events. [#4]
  stripe_subscription_id  text
  plan                    text         NOT NULL DEFAULT 'free'   -- 'free' | 'pro'
  status                  text                            -- 'active' | 'past_due' | 'canceled' | 'incomplete'
  current_period_end      timestamptz
  last_event_at           timestamptz                     -- Stripe Event.created of the last applied event (ordering guard). [#14]
  created_at              timestamptz  NOT NULL DEFAULT now()
  updated_at              timestamptz  NOT NULL DEFAULT now()
```

- **No row for an email = free.** Down migration = `DROP TABLE subscriptions`.

### 3.2 Quota & entitlement (Valkey)

Reuses the `incr`/`expire` idiom already in `api/src/routes/youtube.ts`.

| Key | Purpose | TTL |
|---|---|---|
| `yt:quota:<identity>:<UTCdate>` | daily lookup counter | 48h (cleanup; UTC date is the real boundary) [#12] |
| `yt:dlquota:<email>:<UTCdate>` | daily download counter | 48h |
| `yt:counted:<identity>:<videoId>:<UTCdate>` | per-video seen-marker; quota increments **only when `SET NX` succeeds** | 48h [#9, #21] |
| `plan:<email>` | entitlement read-through cache; **deleted by every webhook write** | ~60s [#6] |

`<identity>` = lower-cased email if logged in, else client IP (`getClientIp`).

**Entitlement helper** (new, e.g. `api/src/lib/entitlement.ts`), called by the youtube routes:

```
getEntitlement(request):
  email = request.session?.user?.email?.toLowerCase()    // session is global; readable on public routes
  identity = email ?? clientIp(request)
  try:
    row = readThrough(`plan:<email>`, 60s, () =>
            SELECT plan,status,current_period_end FROM subscriptions WHERE email=$1)
    isPro = row.plan==='pro' && row.status ∈ {active,past_due} && now < row.current_period_end   // grace policy [#10]
  catch (db/table error):
    isPro = false        // FAIL OPEN to free — never 500 the public tools (mid-deploy / DB blip). [#19]
  return { identity, email, loggedIn: !!email, isPro }
```

**Enforce on lookups** (`/extract`, `/transcript`, `/formats`) — only on cache MISS, after the existing per-IP burst check:
```
limit = isPro ? 500 : loggedIn ? 25 : 10
if SET NX yt:counted:<identity>:<videoId>:<UTCday> EX 48h succeeded:   // first touch of this video today
  n = INCR yt:quota:<identity>:<UTCday>; if n==1: EXPIRE 48h
  if n > limit: 429 { code:'quota_exceeded', used:limit, limit, resetAt:<next UTC midnight>, upgrade:true }
```

**Enforce on `/download`** (never cached → always counts; route stays public but self-checks session):
```
if !loggedIn: 403 { code:'login_required', upgrade:true }                 // anon cannot download [#13]
allowed = isPro ? {audio,360,480,720,1080,1440,2160} : {audio,360,480,720}
if quality ∉ allowed: 402 { code:'upgrade_required', upgrade:true }       // server-side gate, not UI-only
dlLimit = isPro ? 50 : 2
n = INCR yt:dlquota:<email>:<UTCday>; if n==1: EXPIRE 48h
if n > dlLimit: 429 { code:'quota_exceeded', ... }
// existing youtube:dl:rl per-IP burst still applies
```

### 3.3 `billing.ts` routes (new; gated to logged-in customers)

Customer identity is **always derived server-side from `request.session.user.email`** — never from the request body/params (prevents email drift + billing-portal IDOR). [#5] Guard `if (!fastify.stripe) return 503` like `checkout.ts` does.

- `POST /api/billing/create-checkout-session`
  1. `email = session.email`; load the subscriptions row.
  2. If `status ∈ {active,past_due}` and not expired → **return a Billing Portal URL instead** (don't let an already-subscribed user buy twice). [#22]
  3. Else resolve `customerId`: reuse `row.stripe_customer_id`, else `stripe.customers.create({ email }, { idempotencyKey: 'cust:'+sha256(email) })` and upsert `subscriptions(email, stripe_customer_id) ON CONFLICT(email) DO UPDATE`. [#22]
  4. `stripe.checkout.sessions.create({ mode:'subscription', customer: customerId, line_items:[{ price: STRIPE_PRICE_PRO_MONTHLY, quantity:1 }], success_url: BASE_URL+'/account?upgraded=1', cancel_url: BASE_URL+'/account' })`. Pass `customer` (not the editable `customer_email`). Return `{ url }`.
- `POST /api/billing/create-portal-session`
  - `customerId = subscriptions.stripe_customer_id` for the session email (404 if none). `stripe.billingPortal.sessions.create({ customer: customerId, return_url: BASE_URL+'/account' })`. Return `{ url }`.
- **Extend `GET /api/auth/me`** (in `api/src/routes/auth.ts`) to also return `subscription: { plan, status, currentPeriodEnd }` + `usage: { lookups:{used,limit}, downloads:{used,limit} }`. Set `Cache-Control: no-store`; **never** return `stripe_customer_id`. [#16]

### 3.4 Webhook branches (extend the existing `/api/checkout/webhook`)

Bolt onto the existing handler in `api/src/routes/checkout.ts:550` — it already does raw-body parsing (scoped sub-plugin, `:542`), signature verification (`constructEvent`), and idempotent dedup (`webhook:processed:<eventId>`, 7-day TTL). `api/src/index.ts:90` already exempts this path from CSRF. **No new endpoint or raw-body plumbing.**

For every branch: **resolve the row by `stripe_customer_id`** (from `event.data.object.customer`), apply only if `event.created > row.last_event_at` (drop stale/out-of-order events), then after the DB write `valkey.del('plan:'+row.email)` and `writeAuditLog(...)` the transition. [#4, #6, #7, #14]

| Event | Action |
|---|---|
| `checkout.session.completed` (mode=`subscription`) | Capture `customer` + `subscription` + email; upsert `ON CONFLICT(email)` → `plan='pro'`, `status='active'`, `current_period_end`, `last_event_at`. If a *different* active `stripe_subscription_id` already exists for this customer, **cancel the duplicate in Stripe + audit-log it** (closes the two-tab double-subscribe). Emit `upgrade_completed`. [#22] |
| `customer.subscription.updated` | Sync `status`, `current_period_end`; `plan = status∈{active,past_due} ? 'pro' : 'free'`. |
| `customer.subscription.deleted` | `plan='free'`, `status='canceled'` (immediate). |
| `invoice.paid` | Keep `active`, bump `current_period_end`. |
| `invoice.payment_failed` | `status='past_due'` (kept Pro until `current_period_end` per grace policy). |

**Grace policy:** entitlement treats a user as Pro while `status ∈ {active, past_due}` **and** `now < current_period_end`; `customer.subscription.deleted` drops to free immediately. [#10]

---

## 4. Frontend (storefront — the genuinely net-new UI)

Backend customer login already exists (`/api/auth/customer/google` → callback → `role:'customer'` session → redirects to `/account`); only the pages are missing.

- **`/login`** — `storefront/src/app/login/page.tsx` + `LoginContent.tsx`: a "Sign in with Google" link to `${API_BASE}/auth/customer/google?returnTo=/account`.
  - ⚠️ `API_BASE = NEXT_PUBLIC_API_URL` already ends in `/api` → use `${API_BASE}/auth/...` (do **not** add another `/api`, or the guard 401s).
- **`/account`** — `page.tsx` + `AccountContent.tsx`: fetch `/api/auth/me`; show plan + today's usage bars; **Upgrade** (POST `create-checkout-session` → `window.location = url`); **Manage billing** (POST `create-portal-session` → redirect); **Logout** (POST `/api/auth/logout`).
- **`SiteHeader.tsx`** — add an account affordance ("Sign in" / avatar). Nav labels are hardcoded; match the existing style.
- **Upsell in the tools** — the `*Content.tsx` components currently surface `body.error` generically. On `429 {code:'quota_exceeded'}` / `403 {code:'login_required'}` / `402 {code:'upgrade_required'}`, render an upsell linking to `/login` or `/account`.

Hosted Checkout + Billing Portal mean **no Stripe.js/Elements on the frontend** — just redirects (keeps PCI scope to SAQ-A).

---

## 5. Instrumentation

- `quota_exceeded` → **Prometheus counter `youtube_quota_exceeded_total{tier, feature}`** in `api/src/plugins/metrics.ts` (implemented in Slice 1). Chosen over the `analytics_events` table because that table is consent-gated and keyed to client UUID sessions — the wrong home for a server-side operational counter. Scrape/graph it on `:9091/metrics` to see whether the free limits are too tight or too loose. [#1]
- `upgrade_completed` — emitted from `checkout.session.completed` in Slice 2 (audit log + optional metric) for conversion/revenue.

---

## 6. Config / DevOps

**New / required env (all environments):** [#17]
- `STRIPE_PRICE_PRO_MONTHLY=price_…` (new — the recurring Price).
- Dev test mode: populate `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…` (from `stripe listen`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`. (Currently empty in `.env` → Stripe is disabled, so the whole flow is dead until these are set.)

**Local dev webhook loop:**
```
stripe listen --forward-to localhost/api/checkout/webhook \
  --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed
```
**Production Stripe Dashboard:** subscribe the webhook endpoint to that same event set (in addition to the existing `payment_intent.*`). [#18]

**GDPR:** add `subscriptions` to the existing delete/export flow. On an erasure request, delete the local row (email + Stripe ids) but **retain Stripe's own records** (financial-record legal basis — don't blind-delete the Stripe customer). [#15]

**Windows note:** Docker Desktop doesn't propagate file events into containers — `docker compose restart <service>` after editing to see changes.

---

## 7. Sequencing (each slice ships independently)

1. **Quota foundation (backend only, no Stripe).** Migration `0028`; entitlement helper (fail-open); daily lookup + download counters with the per-video NX marker; download login-gate + server-side quality-gate; the two analytics events. Everyone resolves to `free` (no Stripe needed) → **immediately enforces the free limits.** Safest first commit.
2. **Stripe subscription flow.** `billing.ts` (idempotent customer + Portal-if-active); webhook branches (customer_id-keyed, recency-guarded, cache-bust, audit, dedupe-to-one-sub); `/api/auth/me` extension. Testable end-to-end with `stripe listen`.
3. **Frontend.** `/login`, `/account`, header affordance, in-tool upsell.

---

## 8. Code anchors (verified)

- `api/src/routes/youtube.ts` — rate-limit + cache pattern to mirror; the routes to gate.
- `api/src/routes/checkout.ts:550` — existing webhook (signature, dedup, raw-body sub-plugin at `:542`, `payment_intent.succeeded` branch at `:589`).
- `api/src/routes/auth.ts:93` — customer OAuth; `:225` — `/api/auth/me` to extend.
- `api/src/plugins/session.ts` — session shape (`role: 'admin'|'customer'`).
- `api/src/plugins/stripe.ts` — `fastify.stripe` (returns early / 503 when no key).
- `api/src/plugins/auth-guard.ts` — `PUBLIC_PREFIXES` (`/api/youtube` is public; `/api/billing` must be added as session-gated).
- `api/src/config.ts:107` — Stripe config block.
- `migrations/` — `0001`–`0027`; next is `0028`.

---

## 9. Review record

| Pass | Critical | High | Medium | Low |
|---|---|---|---|---|
| 1 | 0 | 3 | 12 | 5 |
| 2 | 0 | 0 | 1 | 1 |
| 3 (verified) | 0 | 0 | 0 | 2 (advisory) |

**Advisory (non-blocking):**
- Multi-account harvesting of free SD downloads (2/day per Google account) — accept for v1; add heuristics only if abused.
- Choose the subscription Price's tax behavior (Stripe automatic-tax toggle) when creating it; hosted Checkout collects it natively either way.
