---
name: fintech-compliance
description: "Fintech compliance patterns: PCI-DSS cardholder data handling and tokenization, SOX audit trail and segregation of duties, KYC/AML screening patterns, and payment processing (idempotency, reconciliation, double-entry ledger). Sub-commands: /fintech-compliance:pci-dss, :sox, :kyc-aml, :payment. Use when building financial systems, handling payment data, or ensuring regulatory compliance."
---

# Fintech Compliance

You are executing the `/fintech-compliance` skill. You apply financial regulatory compliance best practices for PCI-DSS, SOX, KYC/AML, and payment processing.

Parse the sub-command from the user's invocation:
- `/fintech-compliance` → show **menu** and wait for selection
- `/fintech-compliance:pci-dss` → **PCI-DSS Compliance**
- `/fintech-compliance:sox` → **SOX Audit Trail**
- `/fintech-compliance:kyc-aml` → **KYC/AML**
- `/fintech-compliance:payment` → **Payment Processing**

---

## Menu (no sub-command)

```
Fintech Compliance — Choose a topic:

1. pci-dss  — Cardholder data handling, tokenization, scope reduction
2. sox      — Audit trail, segregation of duties, change management
3. kyc-aml  — Know Your Customer, anti-money laundering screening
4. payment  — Idempotent charges, reconciliation, double-entry ledger
```

---

## PCI-DSS Compliance (`:pci-dss`)

### Scope Reduction
```
Goal: Minimize systems that touch cardholder data (CHD)

Strategy: Tokenization via payment processor
  1. Client sends card data DIRECTLY to Stripe/Adyen (never your server)
  2. Processor returns a token (tok_xxx)
  3. Your server uses the token for charges
  4. You NEVER see, store, or transmit raw card numbers

Result: Your systems are OUT of PCI scope
```

### Implementation
```typescript
// ✅ Correct: Stripe Elements (client-side tokenization)
// Client-side: card data goes directly to Stripe
const stripe = Stripe('pk_live_xxx');
const elements = stripe.elements();
const card = elements.create('card');
card.mount('#card-element');

const { token } = await stripe.createToken(card);
// Send token.id to YOUR server — never raw card data

// Server-side: use token, never see card number
const charge = await stripe.charges.create({
  amount: 2000,
  currency: 'usd',
  source: token.id,  // Tokenized — safe
  idempotency_key: orderId,  // Prevent duplicate charges
});
```

### Data Handling Rules
```
NEVER store:       CVV/CVC, full track data, PIN
MAY store:         Last 4 digits, expiry, cardholder name (encrypted)
MUST encrypt:      All stored cardholder data (AES-256)
MUST log:          All access to cardholder data
MUST NOT log:      Card numbers, CVV, full PAN in any log

Column-level encryption:
  card_last_four VARCHAR(4)          -- plaintext OK
  cardholder_name BYTEA              -- encrypted at rest
  token VARCHAR(255)                 -- processor token (not PAN)
```

### Cardholder Data Environment (CDE) Scope Reduction Strategies
```
Scope reduction hierarchy (most to least preferred):

1. Outsource entirely (best):
   - Use hosted payment pages (Stripe Checkout, Adyen Drop-in)
   - Zero PCI scope for your systems — processor handles all CHD

2. Client-side tokenization (good):
   - Stripe Elements / Adyen Web Components run in an iframe
   - Card data never touches your JavaScript or servers
   - Reduces scope to SAQ A (simplest self-assessment)

3. Point-to-point encryption (P2PE):
   - Hardware terminals encrypt card at swipe/dip
   - Encrypted data transits your network but is unreadable
   - Reduces scope significantly (SAQ P2PE)

4. Network segmentation (if CHD must be on-prem):
   - Isolate CDE on dedicated VLAN with strict firewall rules
   - No internet access from CDE; all traffic via controlled gateway
   - Separate domain accounts — CDE admins cannot access other systems
   - Quarterly internal vulnerability scans + annual external pentest
```

### Network Segmentation Requirements
```
CDE Network rules:
  - Inbound: only from payment terminal IPs and processor IPs (allowlist)
  - Outbound: only to payment processor endpoints (allowlist)
  - No direct internet access from CDE servers
  - All inter-zone traffic logged and monitored

Firewall configuration pattern:
  DENY  ALL → CDE  (default deny inbound)
  ALLOW processor_ip_range → CDE:443  (processor callbacks)
  ALLOW app_server → CDE:5432  (application DB access — minimize)
  DENY  CDE → ANY  (default deny outbound)
  ALLOW CDE → processor_ip_range:443  (outbound to processor only)

Infrastructure-as-code (Terraform) for audit trails of rule changes:
  Every firewall rule change → pull request → approval → apply → logged
```

### Log Retention Requirements
```python
# PCI-DSS Requirement 10: retain audit logs minimum 12 months
# At least 3 months must be immediately available for analysis

LOG_RETENTION_POLICY = {
    "hot_storage_days": 90,      # Immediately queryable (ElasticSearch, CloudWatch)
    "warm_storage_days": 275,    # Accessible within hours (S3 Intelligent-Tiering)
    "total_retention_days": 365, # Full year minimum
    "format": "CEF or LEEF",    # Common Event Format for SIEM ingestion
}

# What must be logged (PCI Req 10.2):
REQUIRED_LOG_EVENTS = [
    "all_authentication_attempts",       # Success and failure
    "all_privileged_access",             # Root, admin, DBA actions
    "access_to_audit_logs",              # Who read the logs
    "invalid_logical_access_attempts",   # Failed logins, permission denials
    "use_of_identification_mechanisms",  # MFA events
    "initialization_stopping_audit_logs",# Someone stopped logging — alert immediately
    "creation_deletion_of_system_objects",
]
```

### Penetration Testing Requirements
```
PCI-DSS Requirement 11.3:
  - Annual penetration test (internal + external) — minimum
  - After ANY significant infrastructure or application change
  - Scope: entire CDE boundary, all system components

Pentest types required:
  1. Network penetration test (external): test perimeter from internet
  2. Network penetration test (internal): test from inside CDE VLAN
  3. Application penetration test: OWASP Top 10 against payment flows
  4. Segmentation test: verify CDE is truly isolated from other networks

Findings remediation:
  - Critical/High: remediate within 30 days, retest
  - Medium: remediate within 90 days
  - All findings must be tracked in risk register
```

---

## SOX Audit Trail (`:sox`)

### Audit Trail Requirements
```python
# Every financial transaction must have a complete audit trail
class AuditLog:
    id: UUID
    entity_type: str          # "transaction", "account", "user"
    entity_id: str
    action: str               # "create", "approve", "modify", "void"
    actor_id: str             # Who performed the action
    actor_role: str           # Their role at time of action
    previous_state: dict      # State before change (JSON)
    new_state: dict           # State after change (JSON)
    ip_address: str
    timestamp: datetime       # Server-generated, not client
    reason: str               # Required for modifications

# Audit logs are APPEND-ONLY — never update or delete
# Retention: minimum 7 years
```

### Segregation of Duties
```python
# The same person cannot both create and approve a transaction
class TransactionWorkflow:
    ROLE_PERMISSIONS = {
        "analyst": ["create", "view"],
        "manager": ["approve", "reject", "view"],
        "admin":   ["void", "view"],  # Cannot create or approve
    }

    def approve(self, transaction_id: str, approver_id: str):
        transaction = self.repo.get(transaction_id)

        # Rule 1: Cannot approve your own transaction
        if transaction.created_by == approver_id:
            raise SegregationError("Cannot approve own transaction")

        # Rule 2: Must have approval role
        if "approve" not in self.get_permissions(approver_id):
            raise AuthorizationError("Insufficient permissions")

        # Rule 3: Dual approval for amounts > threshold
        if transaction.amount > 10000 and len(transaction.approvals) < 2:
            transaction.add_approval(approver_id)
            if len(transaction.approvals) < 2:
                return  # Still needs second approval
```

### Change Management Control
```python
# SOX requires that production deployments follow a documented, approved process
# No "cowboy deploys" — every change must have a ticket and approval trail

class ChangeRequest:
    ticket_id: str            # JIRA/ServiceNow ticket reference
    description: str          # What is changing and why
    risk_level: str           # "low", "medium", "high"
    requester_id: str         # Engineer requesting the change
    approver_id: str          # Manager who approved (must differ from requester)
    approved_at: datetime
    scheduled_window: str     # When the deployment is authorized to occur
    rollback_plan: str        # How to revert if something goes wrong
    post_deploy_checks: list  # Validation steps after deployment

# CI/CD gate: deployment pipeline checks for approved change ticket
def validate_deployment(change_ticket_id: str) -> bool:
    ticket = change_management.get(change_ticket_id)
    assert ticket.status == "APPROVED", "Cannot deploy without approved change ticket"
    assert ticket.approver_id != ticket.requester_id, "Segregation of duties violation"
    assert datetime.utcnow() in ticket.scheduled_window, "Outside authorized change window"
    return True
```

### Change Management Controls (4-Eyes and Separation of Duties)
```
4-Eyes Principle for production deployments:
  Requester (engineer) → raises change ticket with rollback plan
  Approver (manager/lead, different person) → reviews and approves
  Deployer (ops/automated pipeline) → executes in authorized window
  Reviewer (post-deploy) → signs off on validation checks

  No individual may hold more than one of these roles for the same change.

User Access Review schedule (SOX Requirement):
  Privileged access (admin, DBA, finance approver): quarterly certification
  Standard access: semi-annual certification
  Terminated employees: remove access on last day of employment — same day, no exceptions

Separation of duties matrix:
  Role          | Create | Approve | Deploy | Audit
  Developer     |   YES  |   NO    |  NO    |  read-only
  Manager       |   NO   |   YES   |  NO    |  read-only
  Release Eng   |   NO   |   NO    |  YES   |  read-only
  Internal Audit|   NO   |   NO    |  NO    |  full read
```

### Audit Log Immutability Requirements
```python
# Write-once storage: audit logs must not be modifiable after creation
# Techniques: S3 Object Lock (WORM), Azure Immutable Blob Storage, hash chaining

import hashlib
import json

class ImmutableAuditLog:
    """Hash-chained audit log — tampering breaks the chain."""

    def __init__(self, storage):
        self.storage = storage   # Write-once blob storage (S3 Object Lock)
        self.last_hash = "genesis"

    def append(self, event: dict) -> str:
        record = {
            "event": event,
            "previous_hash": self.last_hash,
            "timestamp": datetime.utcnow().isoformat(),
        }
        content = json.dumps(record, sort_keys=True).encode()
        record_hash = hashlib.sha256(content).hexdigest()
        record["hash"] = record_hash

        # Write to WORM storage — cannot be overwritten or deleted
        self.storage.put(key=record_hash, value=json.dumps(record), immutable=True)
        self.last_hash = record_hash
        return record_hash

    def verify_chain(self, records: list[dict]) -> bool:
        """Detect any tampering by re-computing the hash chain."""
        prev_hash = "genesis"
        for record in records:
            expected = hashlib.sha256(
                json.dumps({"event": record["event"], "previous_hash": prev_hash,
                            "timestamp": record["timestamp"]}, sort_keys=True).encode()
            ).hexdigest()
            if expected != record["hash"]:
                return False  # Chain broken — tampering detected
            prev_hash = record["hash"]
        return True
```

---

## KYC/AML (`:kyc-aml`)

### KYC Verification Flow
```
1. Collect: Name, DOB, address, government ID
2. Verify: Match against ID verification service (Jumio, Onfido)
3. Screen: Check sanctions lists (OFAC, UN, EU)
4. Risk score: Low / Medium / High / Prohibited
5. Ongoing: Re-screen periodically (Enhanced Due Diligence for high-risk)
```

### AML Transaction Monitoring
```python
class AMLMonitor:
    """Monitor transactions for suspicious activity."""

    RULES = [
        # Structuring: multiple transactions just below reporting threshold
        {"name": "structuring", "threshold": 10000, "window": "24h", "count": 3},
        # Rapid movement: funds in and out quickly
        {"name": "rapid_movement", "in_out_window": "1h"},
        # Unusual pattern: deviation from normal behavior
        {"name": "unusual_volume", "std_dev_multiplier": 3},
    ]

    async def check_transaction(self, tx: Transaction) -> RiskAssessment:
        alerts = []
        for rule in self.RULES:
            if await self.evaluate_rule(rule, tx):
                alerts.append(Alert(rule=rule["name"], transaction=tx))

        if alerts:
            await self.file_sar(tx, alerts)  # Suspicious Activity Report
            return RiskAssessment(level="high", alerts=alerts)

        return RiskAssessment(level="low", alerts=[])
```

### Risk-Based Approach Tiers
```python
# FATF risk-based approach: not all customers need the same scrutiny level
KYC_TIERS = {
    "low_risk": {
        "examples": ["domestic retail customers", "low-value transactions"],
        "requirements": [
            "Name, address, DOB verification",
            "Government ID (one document)",
            "Sanctions screening at onboarding",
        ],
        "monitoring": "automated rule-based",
        "re_verification_years": 5,
    },
    "medium_risk": {
        "examples": ["business accounts", "PEP adjacent", "higher transaction volumes"],
        "requirements": [
            "All low-risk requirements",
            "Proof of address (utility bill < 3 months)",
            "Source of funds declaration",
            "Beneficial ownership > 25%",
        ],
        "monitoring": "automated + periodic human review",
        "re_verification_years": 2,
    },
    "high_risk": {  # Enhanced Due Diligence (EDD)
        "examples": ["PEPs", "high-risk jurisdictions", "cash-intensive businesses"],
        "requirements": [
            "All medium-risk requirements",
            "Enhanced source of wealth documentation",
            "Senior management approval for onboarding",
            "Ongoing transaction monitoring with lower alert thresholds",
            "Annual relationship review by compliance officer",
        ],
        "monitoring": "real-time alerts + dedicated analyst",
        "re_verification_years": 1,
    },
    "prohibited": {
        "examples": ["OFAC SDN list matches", "shell company without UBO", "sanctioned jurisdictions"],
        "action": "Reject onboarding — do not tip off customer",
    }
}
```

### Transaction Monitoring Thresholds
```python
# US regulatory thresholds (FinCEN requirements)
REPORTING_THRESHOLDS = {
    "CTR": {  # Currency Transaction Report — mandatory filing
        "threshold_usd": 10_000,
        "filing_deadline_days": 15,
        "description": "Any cash transaction (or series of related transactions) >= $10,000",
        "note": "Structuring to avoid CTR is itself a federal crime (31 USC 5324)",
    },
    "SAR": {  # Suspicious Activity Report — mandatory filing if suspicious
        "threshold_usd": 5_000,   # $5,000 for banks; $2,000 for MSBs
        "filing_deadline_days": 30,  # 30 days from detection (60 if no known suspect)
        "description": "Transaction where suspicion exists regardless of amount",
        "important": "NEVER tip off the customer that a SAR was filed — federal law",
    },
}

# Sanctions screening frequency requirements
SCREENING_SCHEDULE = {
    "transaction_screening": "real-time",          # Every transaction, before execution
    "new_customer_onboarding": "at_onboarding",    # Before account activation
    "existing_customers": "daily_batch",            # Against updated OFAC/UN/EU lists
    "list_update_check": "daily",                   # Download fresh sanctions lists daily
    "high_risk_customers": "real-time_continuous",  # Every list update triggers re-screen
}
```

---

## Payment Processing (`:payment`)

### Idempotent Charges
```python
async def charge_customer(order_id: str, amount: Decimal, currency: str):
    # Use order_id as idempotency key — same order never charges twice
    idempotency_key = f"charge_{order_id}"

    existing = await db.charges.find_by_idempotency_key(idempotency_key)
    if existing:
        return existing  # Already charged, return same result

    charge = await stripe.charges.create(
        amount=int(amount * 100),  # Stripe uses cents
        currency=currency,
        source=customer.token,
        idempotency_key=idempotency_key,
    )

    await db.charges.insert(
        order_id=order_id,
        charge_id=charge.id,
        amount=amount,
        idempotency_key=idempotency_key,
        status=charge.status,
    )
    return charge
```

### Webhook Idempotency
```python
import hashlib
from datetime import timedelta

class WebhookProcessor:
    """Process payment webhooks exactly once, even if delivered multiple times."""

    TTL = timedelta(days=7)  # Keep processed IDs for 7 days (beyond retry window)

    async def handle(self, event_id: str, payload: dict) -> dict:
        # Check if we already processed this event
        existing = await self.redis.get(f"webhook:{event_id}")
        if existing:
            return json.loads(existing)  # Return cached result — idempotent

        # Verify webhook signature before processing
        self._verify_signature(payload)

        # Process the event
        result = await self._process(payload)

        # Store result with TTL — prevents reprocessing within retry window
        await self.redis.setex(
            f"webhook:{event_id}",
            int(self.TTL.total_seconds()),
            json.dumps(result)
        )
        return result

    def _verify_signature(self, payload: dict):
        # Stripe: compare stripe-signature header against computed HMAC
        # Never process webhooks without signature verification
        sig = hmac.new(self.webhook_secret.encode(), payload["raw_body"], hashlib.sha256)
        if not hmac.compare_digest(sig.hexdigest(), payload["stripe_signature"]):
            raise WebhookSignatureError("Invalid signature")
```

### Partial Payment and Retry Logic
```python
from decimal import Decimal
from enum import Enum

class PaymentStatus(Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    COMPLETE = "complete"
    FAILED = "failed"

async def process_with_retry(order_id: str, total: Decimal, currency: str):
    """Handle partial payments and transient failures with exponential backoff."""
    order = await db.orders.get(order_id)
    amount_paid = order.amount_paid  # Already collected in prior attempts
    amount_remaining = total - amount_paid

    for attempt in range(3):
        try:
            charge = await charge_customer(
                order_id=f"{order_id}_part_{attempt}",
                amount=amount_remaining,
                currency=currency,
            )
            if charge.status == "succeeded":
                await db.orders.update(order_id, amount_paid=total, status=PaymentStatus.COMPLETE)
                return charge
            elif charge.status == "partial":
                # Processor only collected part (rare but possible with some methods)
                amount_paid += Decimal(charge.amount_captured) / 100
                amount_remaining = total - amount_paid
                await db.orders.update(order_id, amount_paid=amount_paid, status=PaymentStatus.PARTIAL)
        except TransientPaymentError:
            backoff = 2 ** attempt  # 1s, 2s, 4s
            await asyncio.sleep(backoff)
        except PermanentPaymentError as e:
            await db.orders.update(order_id, status=PaymentStatus.FAILED, failure_reason=str(e))
            raise
```

### PCI-Compliant Audit Trail for Payments
```sql
-- Every payment action must be logged with PCI-required fields
-- MUST NOT contain: full PAN, CVV, PIN, track data
CREATE TABLE payment_audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type    VARCHAR(50)  NOT NULL,  -- 'charge', 'refund', 'dispute', 'void'
    order_id      UUID         NOT NULL,
    charge_id     VARCHAR(100),           -- Processor reference (e.g., ch_xxx)
    amount        NUMERIC(12,2) NOT NULL, -- Exact decimal — never FLOAT
    currency      CHAR(3)      NOT NULL,  -- ISO 4217
    timestamp     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    card_last4    CHAR(4),               -- Last 4 digits only — PCI compliant
    card_brand    VARCHAR(20),           -- "visa", "mastercard"
    result        VARCHAR(20)  NOT NULL, -- 'success', 'declined', 'error'
    decline_code  VARCHAR(50),           -- Processor decline reason (no CHD)
    actor_id      UUID         NOT NULL, -- User or system that triggered action
    ip_address    INET,
    -- NEVER add: full_pan, cvv, pin, track_data columns
    CONSTRAINT no_sensitive_data CHECK (TRUE)  -- Enforced by code review + linting
);
```

### Reconciliation Patterns

### Refund Reconciliation Pattern
```python
async def reconcile_refunds(date: date):
    """Ensure refunds in our ledger match processor records."""
    our_refunds = await db.refunds.get_by_date(date)
    processor_refunds = await stripe.refunds.list(
        created={"gte": int(date.timestamp()), "lt": int((date + timedelta(days=1)).timestamp())}
    )

    our_by_id = {r.processor_refund_id: r for r in our_refunds}
    proc_by_id = {r.id: r for r in processor_refunds}

    discrepancies = []
    for rid, proc_r in proc_by_id.items():
        if rid not in our_by_id:
            discrepancies.append({"type": "missing_in_our_ledger", "refund_id": rid, "amount": proc_r.amount})
        elif our_by_id[rid].amount != Decimal(proc_r.amount) / 100:
            discrepancies.append({"type": "amount_mismatch", "refund_id": rid,
                                   "ours": our_by_id[rid].amount, "theirs": Decimal(proc_r.amount) / 100})

    if discrepancies:
        # All discrepancies must be investigated — dead-letter queue with pager alert
        await alert_finance_team(discrepancies)
        await dlq.publish("refund_reconciliation_failures", discrepancies)
```

### Idempotency Key Lifetimes
```python
# Idempotency keys must be retained long enough to cover all retry windows
IDEMPOTENCY_KEY_TTL = {
    "payment_charge":  timedelta(hours=24),   # Stripe retries up to 24h
    "refund":          timedelta(days=7),      # Refund retries up to 7 days
    "payout":          timedelta(days=3),      # ACH/wire settlement window
    "webhook_event":   timedelta(days=7),      # Match webhook retry window

    # Key format: include operation type + business ID to prevent cross-operation collisions
    # "charge_{order_id}"   — NOT just order_id (avoid collision with refund_{order_id})
}

# Key storage: Redis with TTL, or DB table with scheduled cleanup
# Must survive application restarts — do not use in-memory store
```

### Chargeback Handling Workflow
```
Chargeback lifecycle (typical card network process):
  1. Customer disputes charge with their bank
  2. Bank issues provisional credit to customer; debits merchant
  3. Merchant receives chargeback notice (usually within 5-7 business days)
  4. Merchant has response window (typically 20-45 days, varies by card network)
  5. Merchant submits evidence: order confirmation, delivery proof, ToS acceptance
  6. Card network arbitrates; merchant wins or loses
  7. If merchant wins: chargeback reversed, funds returned
  8. If merchant loses: chargeback stands; chargeback fee retained (~$15-25)

Evidence to collect at transaction time (before dispute):
  - IP address and geolocation at time of purchase
  - Device fingerprint and user agent
  - 3DS2 authentication result (shifts liability to issuer)
  - Delivery confirmation with signature (for physical goods)
  - Terms of service acceptance with timestamp
  - Customer communication records (emails, chat logs)

Automated response workflow:
  dispute_received → enqueue evidence collection job → compile PDF evidence package
  → submit to processor API within 5 days (earlier = better)
  → track outcome → update chargeback ratio metric
  → alert if chargeback rate > 0.9% (Visa threshold before monitoring program)
```

### Daily Settlement Reconciliation
```python
async def reconcile_daily(date: date):
    """Compare our ledger against payment processor records."""
    our_charges = await db.charges.get_by_date(date)
    stripe_charges = await stripe.charges.list(created={"gte": date, "lt": date + timedelta(days=1)})

    our_set = {c.charge_id: c.amount for c in our_charges}
    stripe_set = {c.id: Decimal(c.amount) / 100 for c in stripe_charges}

    missing_from_us = stripe_set.keys() - our_set.keys()
    missing_from_stripe = our_set.keys() - stripe_set.keys()
    amount_mismatches = {
        k for k in our_set.keys() & stripe_set.keys()
        if our_set[k] != stripe_set[k]
    }

    if missing_from_us or missing_from_stripe or amount_mismatches:
        await alert_finance_team(ReconciliationReport(
            date=date,
            missing_from_us=missing_from_us,
            missing_from_stripe=missing_from_stripe,
            amount_mismatches=amount_mismatches
        ))
```

### Double-Entry Ledger
```sql
-- Every financial movement creates TWO entries that sum to zero
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    account_id UUID NOT NULL,
    entry_type VARCHAR(6) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Example: Customer payment of $100
-- Debit:  Cash/Receivable account    +$100
-- Credit: Revenue account            +$100
-- Sum of all debits = Sum of all credits (always)

-- Invariant check (should always return 0):
SELECT SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE -amount END)
FROM ledger_entries WHERE currency = 'USD';
```

---

## Hard Constraints
- Never store raw card numbers, CVV, or full track data
- All financial transactions must have complete audit trails
- Audit logs are append-only — never update or delete
- Same person cannot both create and approve financial transactions
- Payment charges must be idempotent (use idempotency keys)
- All monetary calculations must use NUMERIC/DECIMAL, never floating point
- KYC verification must be completed before enabling financial features
- Suspicious activity must be reported (SAR) — never tip off the customer
- Never log full card numbers, CVVs, or PINs — even in debug mode or internal tooling; mask to last 4 digits at the point of entry
- All financial calculations must use decimal/fixed-point arithmetic (Python `Decimal`, Java `BigDecimal`, SQL `NUMERIC`) — floating-point is prohibited for monetary values
- Regulatory reporting failures (CTR, SAR) are not recoverable errors — implement dead-letter queues with immediate pager alerts; never silently drop a compliance report
- All stored PANs (where storage is legally permitted) must be encrypted at rest with AES-256; encryption keys must be stored separately from the encrypted data and rotated annually
- Chargeback evidence must be collected at transaction time — retroactive collection after a dispute is too late for physical delivery proof, 3DS results, and IP records
