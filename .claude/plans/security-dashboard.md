# Security Dashboard & Downloadable Report

**Created:** 2026-03-04
**Goal:** GoDaddy-style security insights in the admin panel — real-time DDoS defense data and bot activity, plus a downloadable report DevOps/security can act on.

---

## Problem Statement

The current stack has no security visibility. Caddy (the entry point for all traffic) logs nothing. Auth failures and rate limit hits exist in Valkey but are invisible to any dashboard. There is no bot detection, no geolocation, no honeypot, and no unified security event store.

A successful DDoS attack right now would be invisible until the site goes down.

---

## Data Gap Analysis

| Source | Signal | Current State | Where It Should Go |
|--------|--------|--------------|-------------------|
| Caddy | req/s, IP, UA, status code, latency | **ABSENT** — no `log` directive | stdout (Docker captures) |
| `auth-guard.ts` | failed auth per IP, IP bans | EXISTS in Valkey + `banned-ips.json` | ALSO → Prometheus counter + `audit_logs` |
| `checkout.ts` | rate limit hits (429) | EXISTS but silent | ALSO → Prometheus `rate_limit_hits_total` |
| `analytics.ts` | rate limit hits (429) | EXISTS but silent | ALSO → Prometheus `rate_limit_hits_total` |
| Fastify `onRequest` | UA classification, bot score | **ABSENT** | → Valkey + separate Prometheus counter |
| Fastify `onRequest` | IP geolocation (country) | **ABSENT** | → in-process GeoLite2 .mmdb lookup |
| Fastify routes | Honeypot paths | **ABSENT** | → Fastify catch-all route (proxied by Caddy) |
| PostgreSQL | `security_events` table | **ABSENT** | new migration (partitioned, 90-day retention) |

---

## What to Collect & How to Score It

### Bot Score Formula

```
BotScore(ip, request) = Math.min(1.0, weighted_sum([
  ua_missing_or_library    × 0.30,
  no_accept_header         × 0.15,
  no_accept_language       × 0.10,
  datacenter_asn           × 0.20,
  request_iat_too_uniform  × 0.15,
  honeypot_hit             × 0.60,   // near-definitive
  rdns_spoof_detected      × 0.50,
  tor_exit_node            × 0.40,
  checkout_too_fast        × 0.30,   // < 5s from open to submit
]))

Score > 0.60  → flag (log to security_events with action: 'flagged', surface in dashboard)
Score > 0.85  → block (auto-ban IP, log with action: 'blocked')
Score < 0.20  → allow (no logging)
```

Note: The raw weighted sum can exceed 1.0 when multiple signals fire (e.g., honeypot + tor + missing UA = 1.30). `Math.min(1.0, sum)` caps the score so thresholds remain meaningful. The "flag" band (0.60–0.85) catches single-signal suspicious traffic; the "block" band (0.85–1.0) catches multi-signal definitive bots.

There is no CAPTCHA or JavaScript challenge system in this stack. "Flag" means log + surface for admin review — not an automated user-facing challenge.

### DDoS vs. Legitimate Traffic Spike

| Signal | Legitimate Spike | DDoS |
|--------|-----------------|------|
| Geographic distribution | Matches existing customer regions | New countries, datacenter IPs |
| User-Agent diversity | High (many browsers/versions) | Low or missing UA |
| Session conversion | Checkout rate holds | Checkout rate collapses |
| Page view : API call ratio | ~10:1 | ~1:1 or inverted |
| Inter-arrival time variance | High (human) | Near-zero (bot/flood) |

### Alert Thresholds (calibrate against 30-day baseline)

| Metric | Normal | Warning | DDoS Probable |
|--------|--------|---------|--------------|
| Req/sec (total) | < 50 | 50–200 | > 200 sustained 2+ min |
| Req/sec from single IP | < 1 | 1–10 | > 10 sustained |
| 429 rate (%) | < 1% | 1–5% | > 5% |
| Auth failures/min | < 0.1 | 1–5 | > 10 |
| API P99 latency | < 200ms | 200–500ms | > 1s sustained |
| Checkout attempt rate | < 2/min | 2–10/min | > 10/min (card testing) |

### Attack Detection Logic

The bot-detector plugin runs a periodic check every 30 seconds to evaluate attack status:

```
every 30s:
  rate_429   = GET sec:counter:429 (rate limit hits in last 60s)
  unique_ips = SCARD sec:seen_ips (unique IPs in last 60s)
  p99        = latest histogram_quantile from prom-client

  if rate_429 > 5% of total AND unique_ips > 5x baseline:
    SET sec:attacks:active "ATTACK" EX 300
    SETNX sec:attack:start <unix_timestamp>
  elif rate_429 > 1% OR unique_ips > 2x baseline:
    SET sec:attacks:active "ELEVATED" EX 300
  // if neither condition met, key expires in ≤ 5 min → auto-decays to NORMAL
```

The 5-minute EXPIRE on `sec:attacks:active` means the system self-heals: if metrics return to baseline, the key expires and the banner shows NORMAL. No manual intervention needed to "end" an attack.

### Valkey Keys (matching existing `auth:fails:<ip>` pattern)

```
sec:req:ip:<ip>       INCR + EXPIRE 60s    # req/min per IP
sec:req:asn:<asn>     INCR + EXPIRE 60s    # req/min per ASN
sec:bot:score:<ip>    SET + EXPIRE 300s    # last computed bot score
sec:honeypot:<ip>     SET + EXPIRE 86400s  # honeypot hit flag
sec:attacks:active    SET + EXPIRE 300s    # current severity (auto-decays to NORMAL)
sec:attack:start      SET + EXPIRE 86400s  # Unix timestamp of attack start (24h TTL)
sec:counter:429       INCR + EXPIRE 60s    # global 429 count in last 60s
sec:seen_ips          SADD + EXPIRE 60s    # unique IPs in last 60s (SET type)
sec:events:buffer     LPUSH + LTRIM 10000  # buffered security events (flushed to PG in batches)
```

---

## Dashboard Panels

**Panel 1 — Attack Status Banner** (always visible, top of page)
```
[NORMAL] / [ELEVATED THREAT] / [UNDER ATTACK]
Attack type: L7 HTTP Flood | Duration: 12m
Blocked (5m): 4,821 | Passed (5m): 312
```
Data source: `sec:attacks:active` Valkey key (auto-expires → NORMAL if no active attack).

**Panel 2 — Traffic Overview** (30-min time series)
- Req/sec stacked area: total / blocked / passed
- HTTP status code distribution over time
- P99 / P50 latency line chart

**Panel 3 — Top Attacking Sources**
Table: IP | ASN | Country | Req count (5m) | Bot score | [Block IP] [Block /24] [Unblock]

**Panel 4 — Blocked Traffic Breakdown**
- By reason: rate limited / banned IP / auth failure / honeypot
- By country (sorted bar) — requires GeoLite2 (Phase 2)
- By UA family

**Panel 5 — Rate Limit Activity**
- 429 responses/min by endpoint
- Top IPs hitting rate limits
- Cooldown / ban events timeline

**Panel 6 — Bot Detection Feed**
- Live stream: BotScore > 0.5
- Columns: timestamp | IP | country | ASN | UA excerpt | score | action

**Panel 7 — Auth Attack Panel**
- Failed logins/min timeline
- Top IPs by failure count
- Current cooldown + banned IP list (from Valkey `auth:cooldown:*` + `banned-ips.json`)

**Panel 8 — Checkout / Business Impact**
- Checkout attempt rate vs. success rate
- Card testing signal: attempts with < 5s completion time
- Estimated revenue protected (blocked checkout attempts x AOV)

**Panel 9 — Infrastructure Health**
- PostgreSQL connection pool usage
- Valkey memory utilization
- API event loop lag (already in prom-client default metrics)

---

## Downloadable Report Structure

PDF/CSV export for DevOps handoff, time-ranged (default: last 24h).

```
SECURITY REPORT
Period: [start] -> [end]   Generated: [timestamp]   Prepared for: [admin email]

1. EXECUTIVE SUMMARY
   Total requests | Blocked (%) | Attack events | Estimated protected revenue ($)

2. ATTACK TIMELINE
   CSV: timestamp | total_req | blocked_req | unique_ips | top_block_reason | p99_ms

3. TOP THREAT ACTORS (top 50 IPs)
   ip | country | asn | total_req | blocked_req | first_seen | last_seen | status | reason

4. RATE LIMIT & AUTH EVENTS
   timestamp | ip | country | endpoint | event_type | count

5. BOT TRAFFIC BREAKDOWN
   Good bots (rdns-verified) | Suspicious (unverified UA) | Malicious (honeypot/ban)

6. INFRASTRUCTURE ALERTS
   P99 > 1s events | Valkey memory high-water | PostgreSQL max connections

7. ACTIONABLE TASKS   <- see next section
```

**Data retention note:** Report queries are bounded to 90 days max. IPs older than 90 days are purged by the retention job (see Phase 3a). This limits GDPR exposure — IP addresses are personal data under Article 4, and retention is justified under Article 6(1)(f) "legitimate interest in security." The report header includes: "IP addresses in this report are retained for 90 days for security purposes per GDPR Art. 6(1)(f)."

### Actionable Tasks Format

```
[CRITICAL] TASK-001: Block attacking /24 subnet
  Evidence: 1,204 req from 198.51.100.0/24 in 5m, all bot traffic
  Action:   Add subnet to Caddy IP matcher
  Snippet:  @blocked remote_ip 198.51.100.0/24
            respond @blocked 403

[HIGH] TASK-002: Tighten checkout rate limit
  Evidence: 847 checkout attempts from 12 IPs in 5m (current limit: 10/min/IP)
  Action:   Lower CHECKOUT_RL_MAX from 10 to 3 in checkout.ts, or add subnet-level limit

[MEDIUM] TASK-003: Add Caddy rate limiting
  Evidence: App-layer rate limits firing but Caddy not absorbing pre-limit load
  Action:   Add caddy-ratelimit module to custom Caddy Docker image

[MEDIUM] TASK-004: Verify Googlebot legitimacy
  Evidence: 23 req claiming Googlebot from AS14061 (DigitalOcean) — rdns mismatch = spoofed
  Action:   Auto-block spoofed crawlers in bot classification hook
```

---

## Implementation Plan

### Phase 1 — Zero New Dependencies (modify existing files only)

**1a. Caddy access logs** — `docker/Caddyfile`
```caddy
log {
    output stdout
    format json
    level INFO
}
```
Uses `output stdout` instead of file — Docker captures stdout automatically (`docker logs caddy`). No volume mount needed. Logs persist per Docker's logging driver config.

**1b. Prometheus counters** — `api/src/plugins/metrics.ts`
- Add `auth_failures_total` Counter (labeled by `{reason}`)
- Add `rate_limit_hits_total` Counter (labeled by `{endpoint}`)
- Add `ip_bans_total` Counter
- **Do NOT modify the existing `http_requests_total` counter** — its label set (`method`, `route`, `status_code`) must stay unchanged to avoid breaking Prometheus scrape and any external dashboards

**1c. Wire counters** — `api/src/plugins/auth-guard.ts` + routes
- Increment `auth_failures_total` in `recordFailedAttempt()`
- Increment `ip_bans_total` in `writeBan()`
- Increment `rate_limit_hits_total` in checkout and analytics routes on 429

**1d. Write ban events to audit_logs** — `api/src/plugins/auth-guard.ts`
- On ban: `INSERT INTO audit_logs (user_email, action, resource_type, ip_address, summary)`
- `user_email` = `'system'` for automated bans (distinguish from admin-initiated)
- Schema already supports this; no migration needed

### Phase 2 — Bot Detection + GeoIP

**2a. GeoIP lookup** — `api/src/plugins/bot-detector.ts`
- Add `maxmind-db-reader` package (lightweight, reads .mmdb files in-process, no external service)
- Download GeoLite2-Country.mmdb (free, requires MaxMind account — add to `.gitignore`, download on build)
- Lookup country code per `request.ip` on each request; add to security event metadata
- This is the data source for "country" columns in Panels 3, 4, 6 and Report sections 3, 4

**2b. UA classification hook** — `api/src/plugins/bot-detector.ts`
- Classify UA into `{browser, good_bot, library, empty, unknown}`
- Track via a **new separate counter** `http_requests_by_ua_class_total` with labels `['ua_class', 'method']` — does NOT touch the existing `http_requests_total` counter
- Compute BotScore (capped at 1.0 via `Math.min()`), store in Valkey `sec:bot:score:<ip>`
- Auto-ban on honeypot hit (write to `banned-ips.json` + `audit_logs`)

**2c. Honeypot paths** — `docker/Caddyfile` + `api/src/routes/security.ts`
Caddy proxies honeypot paths to Fastify (does NOT terminate them):
```caddy
@honeypot {
    path /wp-login.php /.env /phpMyAdmin* /admin.php /xmlrpc.php /wp-admin* /setup.php
}
handle @honeypot {
    reverse_proxy api:3001
}
```
Fastify handles them in `api/src/routes/security.ts`:
```
GET /wp-login.php, /.env, etc. → log to security_events buffer, auto-ban IP, return 404
```
This keeps all detection logic in Fastify (one codebase, one language) while still catching scanner traffic at the Caddy entry point. The honeypot_hit signal (0.60 weight) in the BotScore formula now actually fires.

**2d. Per-IP request rate tracking** — `api/src/plugins/bot-detector.ts`
- `INCR sec:req:ip:<ip>` on every request; `EXPIRE 60`
- `SADD sec:seen_ips <ip>` on every request; `EXPIRE 60` (for unique IP count)
- Feed into BotScore formula

**2e. Attack detection loop** — `api/src/plugins/bot-detector.ts`
- `setInterval` every 30s: evaluate threshold table metrics
- SET `sec:attacks:active` with 300s EXPIRE (auto-decays to NORMAL)
- SETNX `sec:attack:start` on first ATTACK detection (24h TTL)
- Cleanup on `fastify.addHook('onClose', ...)` to clear the interval

**2f. Plugin registration** — `api/src/index.ts`
Register `bot-detector` plugin with explicit dependency declaration:
```ts
// After authGuardPlugin, before route registration
app.register(botDetectorPlugin);
```
In `bot-detector.ts`, declare dependencies:
```ts
export const botDetectorPlugin = fp(botDetector, {
  name: 'bot-detector',
  dependencies: ['valkey', 'postgres', 'metrics', 'auth-guard'],
});
```

### Phase 3 — Dashboard Data Layer

**3a. New migration** — `migrations/0007_security-events.js`
```sql
CREATE TABLE security_events (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip          TEXT NOT NULL,
    asn         TEXT,
    country     TEXT,
    event_type  TEXT NOT NULL,  -- 'rate_limit' | 'auth_fail' | 'ban' | 'honeypot' | 'bot_flag'
    endpoint    TEXT,
    user_agent  TEXT,
    bot_score   NUMERIC(4,3),
    action      TEXT,           -- 'blocked' | 'flagged' | 'allowed'
    metadata    JSONB
) PARTITION BY RANGE (created_at);

-- Create initial monthly partitions (current + next 2 months)
CREATE TABLE security_events_2026_03 PARTITION OF security_events
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE security_events_2026_04 PARTITION OF security_events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE security_events_2026_05 PARTITION OF security_events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX security_events_created_at_idx ON security_events (created_at DESC);
CREATE INDEX security_events_ip_idx ON security_events (ip);
CREATE INDEX security_events_event_type_idx ON security_events (event_type);
```

**Retention & partitioning strategy:**
- New monthly partitions are created by a Fastify `onReady` check (runs on startup; creates next month's partition if missing)
- Partitions older than 90 days are dropped by a daily cleanup job (`setInterval` in bot-detector plugin, runs once per 24h)
- `DROP TABLE security_events_YYYY_MM` is instant (no slow DELETE scan)
- 90-day retention satisfies GDPR data minimization (Article 5(1)(e)) — legal basis is legitimate interest in security (Article 6(1)(f))

**Event buffering strategy (protects PostgreSQL during attacks):**
- Security events are NOT written directly to PostgreSQL from the `onRequest` hook
- Events are buffered in Valkey: `LPUSH sec:events:buffer <JSON>`, capped at 10K entries via `LTRIM sec:events:buffer 0 9999`
- A flush job runs every 5 seconds: `LRANGE + LTRIM` the buffer, batch-INSERT into `security_events`
- If PostgreSQL is unreachable, events stay in the Valkey buffer (bounded at 10K) and retry on next flush cycle
- During a DDoS at 1000 req/s, this produces ~5000 buffered events per flush = 1 batch INSERT every 5s, not 1000 individual INSERTs/s

**3b. Dashboard API** — `api/src/routes/security.ts`
- `GET /api/security/dashboard` — admin-only, returns all panel data
  - Reads most real-time data from Valkey (attack status, bot scores, IP counters)
  - Reads aggregate/historical data from `security_events` table
  - Graceful degradation: if `security_events` table doesn't exist (migration not run), return Valkey-only data with a `"degraded": true` flag
- `GET /api/security/report?start=&end=` — admin-only, returns time-ranged report JSON
  - `end - start` capped at 90 days (retention window)
- `POST /api/security/block` — admin-only, adds IP/subnet to `banned-ips.json`
  - Rejects if target IP/subnet includes `request.ip` (self-lockout protection)
  - Writes to `audit_logs` with `user_email` = admin's session email
- `DELETE /api/security/block/:ip` — admin-only, removes IP from `banned-ips.json`
  - Writes to `audit_logs` with action `'unblock'`

**3c. Admin UI** — `admin/src/pages/Security.tsx`
- Route: `/admin/security`
- Panels 1–9 as described above
- "Download Report" button → calls `/api/security/report` → client-side PDF generation (use `jsPDF` or server-rendered)
- "Block IP" / "Block /24" action buttons in Panel 3 → calls `POST /api/security/block`
- "Unblock" button in Panel 3 / Panel 7 → calls `DELETE /api/security/block/:ip`
- Polls `/api/security/dashboard` every 30s (matches attack detection interval)

---

## Files to Create / Modify

### New Files
- `migrations/0007_security-events.js`
- `api/src/plugins/bot-detector.ts`
- `api/src/routes/security.ts`
- `admin/src/pages/Security.tsx`

### Modified Files
- `docker/Caddyfile` — add `log { output stdout }` directive + honeypot proxy routes
- `api/src/plugins/metrics.ts` — add `auth_failures_total`, `rate_limit_hits_total`, `ip_bans_total`, `http_requests_by_ua_class_total` (all new counters; existing counters untouched)
- `api/src/plugins/auth-guard.ts` — increment new counters; write to audit_logs on ban
- `api/src/routes/checkout.ts` — increment rate_limit_hits_total on 429
- `api/src/routes/analytics.ts` — increment rate_limit_hits_total on 429
- `api/src/index.ts` — register bot-detector plugin (after auth-guard, before routes); register security routes
- `admin/src/router.tsx` — add /security route

### New Dependencies
- `maxmind` — official MaxMind Node.js library for .mmdb file reading (GeoLite2-Country in-process lookup, no external service)

---

## Out of Scope (Future)

- Node Exporter / OS-level metrics (needs Docker Compose change; separate track)
- PostgreSQL Exporter (same)
- JA3/JA4 TLS fingerprinting (requires packet capture or Caddy module)
- Caddy rate limiting module (requires custom Docker image build)
- Email/Slack alerts on attack detection
- CAPTCHA / JavaScript challenge system (BotScore "flag" tier is manual-review only)
