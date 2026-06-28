# C4 Code — migrations

## Overview

Database migrations are managed with `node-pg-migrate`. Migration files are JavaScript CommonJS modules that export `up` and `down` functions. Files are numbered sequentially and executed in order against PostgreSQL 16.

Runner configuration: defined in `api/package.json` (the `migrate` script calls `node-pg-migrate` pointing at this `migrations/` directory).

---

## Migration Files

### 0001 — `0001_enable-pgcrypto.js`

**Purpose**: Enable the PostgreSQL `pgcrypto` extension.

**Operations (up)**:
- `CREATE EXTENSION IF NOT EXISTS pgcrypto`

**Operations (down)**:
- `DROP EXTENSION IF EXISTS pgcrypto`

**Notes**: Required by migration 0004, which uses `gen_random_uuid()` (provided by pgcrypto) as the default for the `orders.id` UUID primary key. Also used in migration 0008 for `order_token`.

---

### 0002 — `0002_analytics-events.js`

**Purpose**: Create the `analytics_events` table for storefront behavioural analytics.

**Operations (up)**:

Creates table `analytics_events`:

| Column | Type | Constraints |
|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY |
| `session_id` | `UUID` | NOT NULL |
| `event_type` | `VARCHAR(30)` | NOT NULL |
| `page_path` | `VARCHAR(500)` | NOT NULL |
| `page_type` | `VARCHAR(30)` | nullable |
| `event_data` | `JSONB` | NOT NULL, DEFAULT `'{}'::jsonb` |
| `event_timestamp` | `TIMESTAMPTZ` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` |

Indexes created:
- Composite index on `(event_type, event_timestamp)`
- Index on `session_id`
- Index on `page_type`

**Operations (down)**:
- `DROP TABLE analytics_events`

---

### 0003 — `0003_support-tickets.js`

**Purpose**: Create the customer support ticketing system tables.

**Operations (up)**:

Creates table `support_tickets`:

| Column | Type | Constraints |
|---|---|---|
| `id` | `SERIAL` | PRIMARY KEY |
| `customer_email` | `VARCHAR(255)` | NOT NULL |
| `customer_name` | `VARCHAR(255)` | NOT NULL |
| `subject` | `VARCHAR(500)` | NOT NULL |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT `'open'` |
| `priority` | `VARCHAR(10)` | NOT NULL, DEFAULT `'medium'` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` |

Indexes: `customer_email`, `status`

Creates table `ticket_messages`:

| Column | Type | Constraints |
|---|---|---|
| `id` | `SERIAL` | PRIMARY KEY |
| `ticket_id` | `INTEGER` | NOT NULL, FK → `support_tickets(id)` ON DELETE CASCADE |
| `sender_role` | `VARCHAR(10)` | NOT NULL |
| `sender_name` | `VARCHAR(255)` | NOT NULL |
| `sender_email` | `VARCHAR(255)` | NOT NULL |
| `body` | `TEXT` | NOT NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` |

Indexes: `ticket_id`

**Operations (down)**:
- `DROP TABLE ticket_messages`
- `DROP TABLE support_tickets`

---

### 0004 — `0004_orders.js`

**Purpose**: Create the core e-commerce order tables.

**Operations (up)**:

Creates table `orders`:

| Column | Type | Constraints |
|---|---|---|
| `id` | `UUID` | PRIMARY KEY, DEFAULT `gen_random_uuid()` |
| `order_number` | `VARCHAR(20)` | NOT NULL, UNIQUE |
| `email` | `VARCHAR(255)` | NOT NULL |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT `'pending'` |
| `payment_status` | `VARCHAR(20)` | NOT NULL, DEFAULT `'pending'` |
| `stripe_payment_intent_id` | `VARCHAR(255)` | nullable |
| `total` | `INTEGER` | NOT NULL (amount in cents) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` |

Indexes on `orders`: `email`, `status`, `stripe_payment_intent_id`, `created_at`

Creates table `order_items`:

| Column | Type | Constraints |
|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY |
| `order_id` | `UUID` | NOT NULL, FK → `orders(id)` ON DELETE CASCADE |
| `product_id` | `VARCHAR(50)` | NOT NULL |
| `product_name` | `VARCHAR(255)` | NOT NULL |
| `price` | `INTEGER` | NOT NULL (amount in cents) |
| `quantity` | `INTEGER` | NOT NULL, DEFAULT `1` |

Indexes on `order_items`: `order_id`

**Operations (down)**:
- `DROP TABLE order_items`
- `DROP TABLE orders`

---

### 0005 — `0005_orders-tax-columns.js`

**Purpose**: Add tax and billing address columns to `orders` for Stripe Tax integration.

**Operations (up)** — adds columns to `orders`:

| Column | Type | Constraints |
|---|---|---|
| `tax_amount` | `INTEGER` | NOT NULL, DEFAULT `0` (cents) |
| `tax_calculation_id` | `VARCHAR(255)` | nullable (Stripe Tax calculation ID) |
| `billing_country` | `VARCHAR(2)` | nullable (ISO 3166-1 alpha-2) |
| `billing_state` | `VARCHAR(10)` | nullable |
| `billing_postal_code` | `VARCHAR(20)` | nullable |

**Operations (down)**:
- Drops `tax_amount`, `tax_calculation_id`, `billing_country`, `billing_state`, `billing_postal_code` from `orders`

---

### 0006 — `0006_audit-log.js`

**Purpose**: Create the immutable administrative audit log table for regulatory compliance (SOX, PCI-DSS Req 10.3).

**Operations (up)**:

Creates table `audit_logs`:

| Column | Type | Constraints |
|---|---|---|
| `id` | `BIGSERIAL` | PRIMARY KEY |
| `user_email` | `VARCHAR(255)` | NOT NULL |
| `user_name` | `VARCHAR(255)` | NOT NULL |
| `action` | `VARCHAR(50)` | NOT NULL |
| `resource_type` | `VARCHAR(50)` | NOT NULL |
| `resource_id` | `VARCHAR(255)` | nullable |
| `summary` | `VARCHAR(500)` | NOT NULL |
| `ip_address` | `VARCHAR(45)` | nullable (supports IPv6) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()` |

Indexes:
- `created_at`
- Composite `(user_email, created_at)`
- Composite `(resource_type, resource_id)`

**Operations (down)**:
- **Intentional no-op.** The down migration explicitly refuses to drop the table. Comment: "audit logs must be retained for regulatory compliance (SOX: 7 years, PCI-DSS Req 10.7: 12 months minimum). Dropping this table is a compliance violation."

---

### 0007 — `0007_security-events.js`

**Purpose**: Create the `security_events` partitioned table for high-volume security event logging (bot detections, blocked IPs, suspicious requests).

**Operations (up)**:

Creates partitioned table `security_events` (RANGE partitioned by `created_at`):

| Column | Type | Constraints |
|---|---|---|
| `id` | `BIGSERIAL` | part of PRIMARY KEY |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT `NOW()`, part of PRIMARY KEY |
| `ip` | `TEXT` | NOT NULL |
| `asn` | `TEXT` | nullable |
| `country` | `TEXT` | nullable |
| `event_type` | `TEXT` | NOT NULL |
| `endpoint` | `TEXT` | nullable |
| `user_agent` | `TEXT` | nullable |
| `bot_score` | `NUMERIC(4,3)` | nullable (0.000–1.000) |
| `action` | `TEXT` | nullable |
| `metadata` | `JSONB` | nullable |

Primary key is `(id, created_at)` — required by PostgreSQL for partitioned tables.

Monthly partitions created at migration time:
- `security_events_2026_03` — March 2026
- `security_events_2026_04` — April 2026
- `security_events_2026_05` — May 2026

Indexes (on parent table, inherited by partitions):
- `security_events_created_at_idx` on `created_at`
- `security_events_ip_idx` on `ip`
- `security_events_event_type_idx` on `event_type`

**Operations (down)**:
- `DROP TABLE IF EXISTS security_events CASCADE` (drops parent and all partitions)

**Notes**: New monthly partitions must be created manually (or via a scheduled job) as time progresses.

---

### 0008 — `0008_order-access-token-evidence.js`

**Purpose**: Add IDOR protection (unforgeable order access token) and chargeback evidence columns to `orders`.

**Operations (up)** — adds columns to `orders`:

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `order_token` | `UUID` | NOT NULL, DEFAULT `gen_random_uuid()`, UNIQUE index | Prevents Insecure Direct Object Reference on unauthenticated order endpoint. Token is delivered in confirmation email link and PI creation response. |
| `user_agent` | `VARCHAR(500)` | nullable | Captured at transaction time for chargeback evidence (PCI Req 12) |
| `three_ds_status` | `VARCHAR(50)` | nullable | 3DS authentication result — shifts fraud liability to card issuer on disputed charges |

**Operations (down)**:
- Drops unique index on `order_token`
- Drops columns `order_token`, `user_agent`, `three_ds_status` from `orders`

---

### 0009 — `0009_audit-log-enhancements.js`

**Purpose**: Add state-snapshot columns and a deletion-prevention trigger to `audit_logs` for SOX change tracking and tamper detection.

**Operations (up)** — adds columns to `audit_logs`:

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `previous_state` | `JSONB` | nullable | Before-state of the mutated resource |
| `new_state` | `JSONB` | nullable | After-state of the mutated resource |
| `hash` | `VARCHAR(64)` | nullable | SHA-256 hash chain: `hash(previous_hash \| userEmail \| action \| resourceType \| summary)`. Detects retroactive tampering. |

Also creates:
- PL/pgSQL function `prevent_audit_log_delete()` — raises an exception if any DELETE is attempted on `audit_logs`
- Trigger `audit_logs_no_delete` — `BEFORE DELETE` on `audit_logs`, calls the function above

**Operations (down)**:
- **Intentional no-op.** Comment: "audit log immutability protections cannot be safely reversed in a production environment. Rolling back this migration is a compliance violation."

---

## Schema Evolution Summary

After all 9 migrations have run, the following tables exist in the database:

### Tables

| Table | Description |
|---|---|
| `analytics_events` | Storefront page-view and interaction events |
| `support_tickets` | Customer support ticket headers |
| `ticket_messages` | Individual messages within a support ticket thread |
| `orders` | E-commerce orders (UUID PK, Stripe-backed) |
| `order_items` | Line items belonging to an order |
| `audit_logs` | Immutable admin action audit trail (append-only enforced by DB trigger) |
| `security_events` | Partitioned high-volume security/bot event log |

### Partitions

| Partition | Parent | Range |
|---|---|---|
| `security_events_2026_03` | `security_events` | 2026-03-01 – 2026-04-01 |
| `security_events_2026_04` | `security_events` | 2026-04-01 – 2026-05-01 |
| `security_events_2026_05` | `security_events` | 2026-05-01 – 2026-06-01 |

### Extensions

| Extension | Provided by |
|---|---|
| `pgcrypto` | Migration 0001 |

### Full `orders` Column Set (after all migrations)

| Column | Type | Added in |
|---|---|---|
| `id` | UUID (PK) | 0004 |
| `order_number` | VARCHAR(20) UNIQUE | 0004 |
| `email` | VARCHAR(255) | 0004 |
| `status` | VARCHAR(20) | 0004 |
| `payment_status` | VARCHAR(20) | 0004 |
| `stripe_payment_intent_id` | VARCHAR(255) | 0004 |
| `total` | INTEGER | 0004 |
| `created_at` | TIMESTAMPTZ | 0004 |
| `updated_at` | TIMESTAMPTZ | 0004 |
| `tax_amount` | INTEGER | 0005 |
| `tax_calculation_id` | VARCHAR(255) | 0005 |
| `billing_country` | VARCHAR(2) | 0005 |
| `billing_state` | VARCHAR(10) | 0005 |
| `billing_postal_code` | VARCHAR(20) | 0005 |
| `order_token` | UUID UNIQUE | 0008 |
| `user_agent` | VARCHAR(500) | 0008 |
| `three_ds_status` | VARCHAR(50) | 0008 |

### Full `audit_logs` Column Set (after all migrations)

| Column | Type | Added in |
|---|---|---|
| `id` | BIGSERIAL (PK) | 0006 |
| `user_email` | VARCHAR(255) | 0006 |
| `user_name` | VARCHAR(255) | 0006 |
| `action` | VARCHAR(50) | 0006 |
| `resource_type` | VARCHAR(50) | 0006 |
| `resource_id` | VARCHAR(255) | 0006 |
| `summary` | VARCHAR(500) | 0006 |
| `ip_address` | VARCHAR(45) | 0006 |
| `created_at` | TIMESTAMPTZ | 0006 |
| `previous_state` | JSONB | 0009 |
| `new_state` | JSONB | 0009 |
| `hash` | VARCHAR(64) | 0009 |

### Compliance Notes

- `audit_logs` is **append-only** — deletion is blocked at the database level by a trigger installed in migration 0009. The down migrations for 0006 and 0009 are both intentional no-ops.
- Hash-chaining on `audit_logs.hash` provides tamper evidence.
- `security_events` is time-partitioned for performance; new monthly partitions must be provisioned before each month begins.
