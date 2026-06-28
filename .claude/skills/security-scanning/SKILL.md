---
name: security-scanning
description: "Security scanning bundle: STRIDE threat analysis, attack tree construction, SAST configuration, security requirement extraction, and threat mitigation mapping. Sub-commands: /security-scanning:stride, :attack-tree, :sast, :requirements, :mitigations. Use for security design reviews and threat modeling sessions."
---

# Security Scanning

You are executing the `/security-scanning` skill. You perform structured security analysis using industry-standard methodologies: STRIDE threat modeling, attack tree construction, SAST tooling configuration, and security requirement extraction.

> **Note:** For reviewing existing code for vulnerabilities, use `/security-review` instead. This skill focuses on *security design* — threat modeling, secure architecture, and security requirement generation.

Parse the sub-command from the user's invocation:
- `/security-scanning` → show **menu** and wait for selection
- `/security-scanning:stride` → **STRIDE Threat Analysis**
- `/security-scanning:attack-tree` → **Attack Tree Construction**
- `/security-scanning:sast` → **SAST Configuration**
- `/security-scanning:requirements` → **Security Requirement Extraction**
- `/security-scanning:mitigations` → **Threat Mitigation Mapping**

---

## Menu (no sub-command)

```
Security Scanning — Choose a methodology:

1. stride        — STRIDE threat analysis per system component
2. attack-tree   — Attack tree for a specific adversary goal
3. sast          — Configure static analysis tools (Semgrep, Bandit, CodeQL)
4. requirements  — Extract security requirements from design/PRD
5. mitigations   — Map threats to mitigations and security controls
```

Ask: "Which methodology? Or describe your system/component and I'll run a full threat modeling session."

---

## STRIDE Threat Analysis (`:stride`)

### Step 1: Define Scope

Ask the user for:
- System or component to analyze
- Trust boundaries (what's inside vs outside the trust zone)
- Entry points (APIs, user inputs, file uploads, queues)
- Data assets requiring protection

### Step 2: Apply STRIDE to Each Component

For each component/data flow identified, evaluate all 6 threat categories:

| Category | Threat | Mitigated By |
|----------|--------|--------------|
| **S**poofing | Attacker impersonates a user/service | Authentication (JWT, mTLS, API keys) |
| **T**ampering | Data modified in transit or at rest | Integrity checks (HMAC, digital signatures) |
| **R**epudiation | Actions denied without audit trail | Audit logging, non-repudiation tokens |
| **I**nformation Disclosure | Data exposed to unauthorized parties | Encryption (TLS, AES-256), access control |
| **D**enial of Service | Service made unavailable | Rate limiting, circuit breakers, autoscaling |
| **E**levation of Privilege | Attacker gains higher permissions | Authorization checks, least privilege, RBAC |

### Step 3: Read the System

1. Read architecture documentation if available (ask user for path)
2. Glob for configuration files, API definitions (`**/*.yaml`, `**/*.json`, `openapi.yml`)
3. Look for authentication/authorization patterns in code

### Step 4: Output Threat Register

For each threat found, produce:

```
THREAT-001
Category: Spoofing (S)
Component: User Authentication API
Attack: Attacker submits forged JWT with manipulated claims (alg:none attack)
Likelihood: HIGH — JWT library misconfiguration is common
Impact: CRITICAL — Full account takeover
CVSS (estimate): 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)
Mitigation: Explicitly reject alg:none; pin to RS256; validate all standard claims (exp, iss, aud)
Security Requirement: AUTH-01 — JWT validation MUST reject tokens with alg:none or HS256
```

### Step 5: Prioritize

Sort by CVSS score. Flag anything ≥ 7.0 as requiring mitigation before launch.

---

## Attack Tree Construction (`:attack-tree`)

### Step 1: Define the Attacker's Goal

Ask: "What is the attacker trying to achieve?" Examples:
- Gain admin access
- Exfiltrate customer PII
- Execute arbitrary code on the server
- Bypass payment processing

### Step 2: Decompose Attack Paths

Build a tree from the root goal down to leaf nodes (specific techniques):

```
Goal: Exfiltrate Customer PII
├── [OR] Compromise database directly
│   ├── [OR] SQL injection via web API
│   │   ├── [LEAF] Unsanitized query parameters (CVE-level: HIGH)
│   │   └── [LEAF] Second-order injection via stored data
│   └── [OR] Credential theft
│       ├── [LEAF] Brute-force database password
│       └── [LEAF] Steal connection string from env/config
├── [OR] Compromise application layer
│   ├── [OR] IDOR — access other users' data via ID manipulation
│   ├── [OR] Insecure object storage presigned URL
│   └── [OR] Server-Side Request Forgery → internal metadata
└── [OR] Compromise infrastructure
    ├── [LEAF] AWS IAM misconfiguration (public role)
    └── [LEAF] Exposed debug endpoint with data dump
```

### Step 3: Score Each Leaf

For each leaf node:
- **Feasibility:** 1 (requires nation-state) → 5 (automated tool available)
- **Prerequisites:** What attacker capability is required?
- **Detection difficulty:** Would your current logging catch this?

### Step 4: Identify Critical Paths

Highlight paths where ALL conditions are: Feasibility ≥ 3, no detection, no mitigation. These are your highest-priority findings.

---

## SAST Configuration (`:sast`)

### Step 1: Detect Project Type

Read `pyproject.toml`, `package.json`, `go.mod`, `pom.xml` to determine language.

### Step 2: Configure Appropriate Tools

**Python — Bandit + Semgrep:**

```toml
# pyproject.toml
[tool.bandit]
exclude_dirs = ["tests", ".venv"]
skips = ["B101"]  # skip assert_used in tests

[tool.bandit.assert_used]
skips = ["*_test.py", "test_*.py"]
```

```yaml
# .semgrep.yml
rules:
  - id: hardcoded-secret
    patterns:
      - pattern: $KEY = "..."
    message: Possible hardcoded secret in variable $KEY
    severity: ERROR
    languages: [python]

  - id: sql-injection
    patterns:
      - pattern: cursor.execute("..." % $INPUT)
      - pattern: cursor.execute("..." + $INPUT)
    message: SQL injection risk — use parameterized queries
    severity: ERROR
    languages: [python]
```

**JavaScript/TypeScript — ESLint Security + Semgrep:**

```json
{
  "extends": ["plugin:security/recommended"],
  "plugins": ["security"],
  "rules": {
    "security/detect-object-injection": "error",
    "security/detect-non-literal-regexp": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-child-process": "warn"
  }
}
```

**GitHub Actions integration:**

```yaml
# .github/workflows/sast.yml
name: Security Scan
on: [push, pull_request]
jobs:
  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/secrets
            p/python
```

---

## Security Requirement Extraction (`:requirements`)

### Step 1: Read Source Material

Ask for or read: PRD, architecture doc, API spec, or describe the feature verbally.

### Step 2: Extract Requirements by Category

For each feature/component, extract requirements using this format:

```
REQ-AUTH-01 [MUST]
Component: User Authentication
Requirement: All API endpoints MUST require a valid authentication token.
Rationale: Prevents unauthorized access to user data.
Test Criteria: Unauthenticated requests to any /api/* endpoint return HTTP 401.

REQ-CRYPTO-01 [MUST]
Component: Data Storage
Requirement: PII fields (email, phone, SSN) MUST be encrypted at rest using AES-256-GCM.
Rationale: GDPR Article 32 — appropriate technical measures for personal data.
Test Criteria: Database dump contains no plaintext PII.

REQ-INPUT-01 [MUST]
Component: File Upload
Requirement: Uploaded files MUST be validated for type (allowlist), size (≤10MB), and scanned for malware before processing.
Rationale: Prevents malicious file execution and storage abuse.
Test Criteria: Uploading an .exe or a file >10MB returns HTTP 422.
```

### Step 3: Priority Classification

- **MUST** — Security blocker, cannot ship without
- **SHOULD** — Defense-in-depth, fix before GA
- **MAY** — Hardening, schedule for follow-up

---

## Threat Mitigation Mapping (`:mitigations`)

### Step 1: Load Threats

Read the threat register (from `:stride` or `:attack-tree` output), or ask the user to paste their findings.

### Step 2: Map Threats to Controls

For each threat, recommend specific, implementable controls:

**Injection Threats:**
- Parameterized queries / prepared statements (SQL)
- Input allowlisting, not denylisting
- HTML encoding for XSS (DOMPurify, template auto-escaping)
- Command allowlist for subprocess calls

**Authentication Threats:**
- MFA for all privileged accounts
- Account lockout after N failed attempts (with exponential backoff)
- Secure session tokens: 128+ bits, HttpOnly, Secure, SameSite=Strict
- Refresh token rotation

**Data Protection:**
- TLS 1.3 in transit (reject 1.0/1.1)
- AES-256-GCM at rest for sensitive fields
- Key management via AWS KMS, GCP KMS, or HashiCorp Vault
- Data classification (PII, PHI, PCI) with handling rules

**Authorization:**
- Attribute-based access control (ABAC) for fine-grained permissions
- Always authorize on server side — never trust client-side roles
- Log all authorization decisions for audit
- Regular access reviews

### Step 3: Output Mitigation Backlog

Produce a prioritized list of security user stories:
```
[SECURITY] Implement parameterized queries for all database interactions
Acceptance: No raw string concatenation in SQL. Code review checklist item. SAST rule enabled.
Priority: P0 (blocks launch)

[SECURITY] Add rate limiting to authentication endpoints
Acceptance: ≤5 failed login attempts per minute per IP. Returns HTTP 429 with Retry-After header.
Priority: P0 (blocks launch)
```
