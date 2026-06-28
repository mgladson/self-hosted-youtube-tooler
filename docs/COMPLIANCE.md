# Compliance Posture

This document describes how this codebase satisfies the regulatory regimes
that apply to a self-hosted digital-goods storefront that processes payment
through Stripe. It is the single source of truth for compliance reviewers and
must be updated whenever a control changes.

Last reviewed: 2026-04-26

---

## 1. PCI-DSS scope

### 1.1 Scope minimization

We do **not** transmit, process, or store cardholder data (CHD) on our own
infrastructure. The frontend integrates Stripe Elements, which posts CHD
directly to `api.stripe.com` and returns a `PaymentMethod` token. Our backend
sees only Stripe identifiers (`pi_*`, `pm_*`, `ch_*`) and order metadata.

This places us under PCI-DSS **SAQ A** scope (the lightest tier).

### 1.2 Controls in this codebase

| Requirement | Control |
|---|---|
| Req 3 — Protect stored CHD | We store none. Verified by greps in CI for `^4\d{12}` patterns. |
| Req 4 — Encrypt CHD in transit | All requests terminated by Caddy with TLS 1.2+. Stripe Elements use HTTPS-only iframes. |
| Req 6 — Secure systems | Dependency audits in CI; image rebuilds pull patched bases. |
| Req 8 — Identify users | Admin auth via session plugin; per-user `adminTier`. |
| Req 10 — Track and monitor | `audit_logs` table is append-only (DB trigger), hash-chained, partitioned by `resource_type`. See §2.2. |
| Req 12 — Maintain a policy | This document. |

### 1.3 Retention policy

- **Order records (PII):** 18 months from order creation (the longest
  chargeback / dispute representment window across major card networks).
  After 18 months, `email`, `user_agent`, `billing_*` columns are anonymized
  via `api/src/scripts/pii-anonymize.ts`. Order totals, product IDs, and
  Stripe payment intent IDs are retained indefinitely for tax/SOX.
- **Support tickets:** body redacted at 12 months; ticket and message rows
  retained for SOX auditability.
- **Analytics events:** deleted at 13 months. No PII is stored — only a
  client-generated anonymous UUID.
- **Audit log:** retained indefinitely; append-only.
- **GDPR erasure:** customer-initiated deletion overrides the 18-month
  schedule; see §3.

---

## 2. SOX controls

### 2.1 Segregation of Duties (4-eyes principle)

**Control PAY-2.1 — Refund self-approval block.** An admin who appears as the
`order_created` actor on an order's audit chain may not also approve that
order's refund. The block returns HTTP 403 with the message:

> "SOX SoD: refunds require approval by a different admin (4-eyes principle)"

**Override:** A user with `adminTier === 'super_admin'` may bypass the block.
Every override is recorded in the `refund` audit row including the actor's
identity. Implementation: `api/src/routes/checkout.ts` `/api/admin/orders/:id/refund`.

**Control PAY-2.2 — Refund audit completeness.** Every refund (admin-initiated
*and* Stripe-webhook-initiated `charge.refunded` / `charge.dispute.*`)
produces a `refund` audit row with `previousState` and `newState`.

### 2.2 Append-only audit log + hash chain

The `audit_logs` table is protected by:

1. A `BEFORE UPDATE` trigger that throws unless the only changing columns are
   the GDPR redaction set (see §3). DELETEs are blocked outright.
2. A per-`resource_type` SHA-256 hash chain. Each row's `hash` is
   `sha256(prev_hash | clock_timestamp() | user_email | action | resource_type | summary)`.
3. A Postgres advisory lock partitioned by `resource_type` (djb2 hash of the
   type) so concurrent writers cannot reorder the chain.

**Control SOX-3 — Critical-path audit writes are awaited.** Audit writes for
sanctions blocks, order creation, payment success, payment failed, refund,
dispute, account deletion, and admin login are awaited (failure aborts the
operation or returns 5xx). Lower-criticality audit writes (email campaign,
support ticket actions, ad creation) remain fire-and-forget but log errors
at error level so they surface in alert pipelines.

### 2.3 Redaction-aware verifier (SOX-2 — known limitation)

GDPR Article 17 erasure mutates `user_email` / `user_name` / `summary` /
`new_state` / `previous_state` on existing audit_logs rows (see migration
0023). The `gdpr_redacted_at` column marks every redacted row.

A naive verifier that recomputes the SHA-256 input from current row contents
will mismatch on any redacted row. Until a witness service is implemented
(below), hash-chain verifiers must skip rows where `gdpr_redacted_at IS NOT
NULL` and rely on the trigger-enforced column-set restriction.

**Planned witness procedure (TODO):**

1. At INSERT time, an external witness service signs the row's `hash` with a
   KMS-managed key. The signature is stored off-DB (e.g. in a transparency
   log) so it cannot be tampered with even if the DB is compromised.
2. The verifier walks the chain. For non-redacted rows it recomputes the
   hash and compares to the row. For redacted rows it verifies the witness
   signature on the recorded `hash`, which proves the row was genuine
   *before* redaction even though the source fields have changed.
3. Each redaction itself produces an `account_deleted` audit row, so the
   redaction event is recorded in the same chain.

Tracker: see `api/src/lib/audit.ts` docblock.

---

## 3. KYC / AML coverage

### 3.1 Sanctions screening (current)

`api/src/plugins/sanctions.ts` loads a manually-maintained `data/sanctions-blocklist.json`
of email addresses and email domains. `isBlocked(email)` is called at
checkout creation time before any order row is inserted; a hit produces an
awaited `sanctions_block` audit row and a generic 400 response (no
"sanctioned"-style language to comply with SAR tip-off prohibitions).

**Control AML-3 — Velocity flag actionable.** Five or more orders from the
same email within a 60-minute window enqueue a row into
`compliance_review_queue` (trigger_type=`velocity_flag`) and emit a
`velocity_flag` security event. Compliance staff must triage queue rows
within 24 hours.

### 3.2 OFAC / UN / EU ingestion (planned — AML-1)

> **DEFERRED — not currently scheduled, see TRACKER (AML-1).** The stub
> below describes design intent only; until ingestion is live, sanctions
> coverage relies entirely on the manually-maintained blocklist in §3.1.

The manual blocklist is insufficient at scale. The planned automated
ingestion is documented as a stub at `api/src/plugins/ofac-ingestion.ts`.

- **Sources:** OFAC SDN + Consolidated, UN Consolidated, EU Consolidated.
- **Daily** full ingest into `sanctions_list_entries` (TBD migration).
- **Hourly** in-memory diff so newly-listed designations propagate within an
  hour to the live `isBlocked` check.
- **Matching:** email + email-domain initially; fuzzy name matching
  (Jaro-Winkler ≥ 0.92) once billing names are collected at checkout.

Until ingestion is live, compliance must manually update
`data/sanctions-blocklist.json` whenever OFAC publishes a new SDN delta.

### 3.3 Re-screening historical orders (planned — AML-2)

> **DEFERRED — not currently scheduled, see TRACKER (AML-2).** The
> rescreen job is a stub only and is not registered with any scheduler;
> historical orders are not currently rechecked after placement.

`api/src/scripts/sanctions-rescreen.ts` (stub). Daily nightly job that
re-screens the last 30 days of orders against the current blocklist and
enqueues hits into `compliance_review_queue` (trigger_type=
`sanctions_rescreen_hit`). This catches the case where an OFAC designation
arrives **after** the order was placed.

Hits within the chargeback window may require a SAR (Suspicious Activity
Report) filed within the regulatory deadline.

### 3.4 Compliance review queue

Migration `0024_compliance-review-queue.js` creates the table:

```
compliance_review_queue(id, trigger_type, email, details JSONB, status,
                        created_at, resolved_at, resolved_by)
```

`trigger_type` values currently emitted by the application:

- `velocity_flag` — high order velocity (AML-3).
- `sanctions_rescreen_hit` — historical order matched current blocklist (planned, AML-2).
- `reconciliation_drift` — Stripe vs. orders mismatch (planned, PAY-2).

---

## 4. Payment processing model

### 4.1 Stripe is the system-of-record (PAY-1)

This codebase does **not** maintain a double-entry general ledger. Stripe is
treated as the authoritative system-of-record for all money movement: the
`orders.total`, `orders.tax_amount`, `orders.discount_amount` fields are a
*projection* of the canonical Stripe `PaymentIntent` / `Charge` /
`Refund` / `Dispute` chain.

**SOX justification:** The "system-of-record exception" is acceptable
provided it is paired with daily reconciliation (PAY-2) so that any
divergence between Stripe and our projection is detected and resolved within
one business day. The reconciliation job, the drift table, and the alerting
threshold are the compensating controls that make this model auditable.

If/when revenue, complexity, or auditor expectations require a true
double-entry ledger, see the deferred work item `LEDGER-1`. Until then, the
audit trail is: `audit_logs` (append-only, hash-chained) + Stripe Dashboard
+ daily reconciliation report.

### 4.2 Daily reconciliation (PAY-2)

> **DEFERRED — not currently scheduled, see TRACKER (PAY-2).** The
> reconciliation script is implemented as a stub and the cron sidecar in
> `docker-compose.yml` is commented out; drift is not currently detected
> automatically. Until this lands, the system-of-record exception in §4.1
> is unsupported by a working compensating control.

Stub: `api/src/scripts/daily-reconciliation.ts`. Runs once per day at 03:00
UTC; pulls yesterday's Stripe charges and compares to the orders table
window. Drift produces a row in `compliance_review_queue`
(trigger_type=`reconciliation_drift`) and pages on-call if drift exceeds
threshold.

A commented-out cron sidecar example is present in `docker-compose.yml`.

### 4.3 Idempotent payment-intent creation

PaymentIntent creation uses `idempotencyKey: pi_${orderId}` so a retry never
creates a second intent. Refund creation uses
`idempotencyKey: refund_${id}_${amount ?? 'full'}` for the same reason.

### 4.4 Idempotent discount-counter rollback (PAY-4)

The `discount_usage_log` table (migration 0025) gives webhook decrement
paths an idempotency record. Each rollback path (`payment_failed`,
`canceled`, `refunded`, `dispute`) inserts `(discount_code, order_id,
action)` with `ON CONFLICT DO NOTHING`. Only when the insert actually
created a row does the corresponding `UPDATE discounts SET current_uses =
current_uses - 1` execute. Duplicate webhook deliveries and overlapping
rollback events (`payment_failed` followed later by `charge.refunded`) can
no longer double-decrement the discount counter.

The discount rollback and the corresponding `orders` status flip run inside
a single `BEGIN/COMMIT` transaction (`rollbackDiscountAndUpdateOrder` in
`api/src/routes/checkout.ts`) so a process crash between the two statements
cannot leak a discount slot or strand an order in an inconsistent state.

### 4.6 Startup gating on compliance tables

`buildApp()` registers an `onReady` hook that runs `SELECT to_regclass(...)`
against `compliance_review_queue` and `discount_usage_log` and refuses to
start if either table is missing. This converts a silent fail-open
(velocity flags or rollback inserts swallowed on a partially-migrated
database) into a hard startup failure visible to the deployer.

### 4.5 Dispute / chargeback handling (PAY-3)

The webhook handler covers:

- `payment_intent.succeeded` → status = paid, send confirmation.
- `payment_intent.payment_failed` / `payment_intent.canceled` → status =
  failed, rollback discount slot, audit.
- `charge.refunded` → status = refunded, rollback discount slot, audit.
- `charge.dispute.created` → status = disputed, rollback discount slot,
  audit, alert log.
- `charge.dispute.funds_withdrawn` → status = chargeback_lost, rollback
  discount slot, audit, alert log.

Auto-submission of dispute evidence is **out of scope** and will be a
manual operations workflow until `DISPUTE-1` is prioritized.

---

## 5. Retention policy summary

> **DEFERRED — PII anonymization is not currently scheduled, see
> TRACKER.** `api/src/scripts/pii-anonymize.ts` is implemented but is not
> wired to any scheduler; the 18-month / 12-month / 13-month retention
> windows below are policy-only until the script runs nightly. Customer-
> initiated GDPR erasure (§3) is the only retention mechanism currently
> active.

| Data | Window | Mechanism |
|---|---|---|
| Cardholder data | Never stored | Stripe Elements (SAQ-A) |
| Order PII | 18 months → anonymized | `pii-anonymize.ts` |
| Stripe IDs / order totals | Indefinite | Required for SOX & tax |
| Audit log | Indefinite | Append-only, hash-chained |
| Support ticket bodies | 12 months → redacted | `pii-anonymize.ts` |
| Analytics events | 13 months → deleted | `pii-anonymize.ts` |
| Newsletter subscribers | Until unsubscribe | `removeSubscriber()` |
| Customer GDPR erasure | On request | `/api/customer/delete-account` |

---

## 6. Outstanding items (deferred — tracked elsewhere)

- **LEDGER-1** — Build a real double-entry general ledger if revenue or
  audit pressure require it. Currently Stripe + reconciliation suffices.
- **WITNESS-1** — Implement the redaction-aware audit-chain witness service
  (see §2.3).
- **DISPUTE-1** — Auto-submit dispute evidence (3DS result, IP, UA, order
  metadata, download history) via Stripe Issuing API.
- **SAR-1** — Operational SAR filing workflow once OFAC ingestion is live.
- **PCI-2 / PCI-3 / SOX-4 / SOX-5 / AML-4 / AML-5 / PAY-5** — covered by
  this document; no code action required.
