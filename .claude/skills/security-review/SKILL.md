---
name: security-review
description: "Security review with two modes: (1) /security-review — reviews current branch git diff; (2) /security-review <path> — scans any file or directory directly, no git dependency. Two-pass analysis with cookie flags, HTTP headers, and Shopify-specific checks. Outputs severity-ranked findings (CRITICAL/HIGH/MEDIUM/LOW) with file:line references and exact fixes."
---

# Security Review

You are executing the `/security-review` skill. Perform a focused, high-confidence security review.

**Goal**: Surface REAL exploitable vulnerabilities only. Minimize false positives. Every finding must include file:line, severity, and a concrete remediation.

**User argument:** `$ARGUMENTS`

---

## Step 0: Determine Mode

Check whether the user provided a path argument (`$ARGUMENTS`).

### Mode A — Path Scan (argument provided)

`/security-review <path>` — scans files directly. **No git dependency.**

1. Resolve the path:
   - If it's a file: read it directly
   - If it's a directory: use Glob to find source files (`**/*.py`, `**/*.ts`, `**/*.js`, `**/*.go`, `**/*.java`, `**/*.rb`, `**/*.php`, `**/*.cs`) AND config files (`**/*.json`, `**/*.yaml`, `**/*.yml`, `**/*.toml`, `**/*.env*`, `**/Caddyfile`, `**/nginx.conf`, `**/Dockerfile*`, `**/.env.example`) — exclude `node_modules/`, `vendor/`, `.venv/`, `dist/`, `build/`
2. Read each file and concatenate as SCAN_CONTENT (file path + full contents)
3. If 0 files found, report: "No source files found at path." and stop.
4. Set SCAN_MODE = "path" and SCAN_TARGET = the resolved path

### Mode B — Diff Scan (no argument)

`/security-review` — reviews changes on the current branch vs origin.

1. Gather current state using Bash:
   ```
   git status
   git diff --name-only origin/HEAD...
   git log --no-decorate origin/HEAD...
   git diff origin/HEAD...
   ```
2. Store the full diff as SCAN_CONTENT. If the diff is empty, report: "No changes detected on this branch." and stop.
3. Set SCAN_MODE = "diff" and SCAN_TARGET = current branch name

---

## Step 1: Security Categories

Analyze SCAN_CONTENT across ALL of these categories regardless of mode:

**1. Input Validation Vulnerabilities**
- SQL injection via unsanitized user input (string concatenation into queries)
- Command injection in system calls or subprocesses
- XXE injection in XML parsing
- Template injection in templating engines (SSTI)
- NoSQL injection in database queries
- Path traversal in file operations (`../` sequences, unsanitized file paths)

**2. Authentication & Authorization**
- Authentication bypass logic, hardcoded credentials
- Privilege escalation paths, missing authorization checks
- Session management flaws, IDOR
- JWT vulnerabilities (alg:none, weak secrets, missing expiration)

**3. Crypto & Secrets Management**
- Hardcoded API keys, passwords, or tokens
- Weak cryptographic algorithms (MD5/SHA1 for security, ECB mode, DES)
- Improper key storage, hard-coded encryption keys
- Cryptographic randomness issues
- Certificate validation bypasses

**4. Injection & Code Execution**
- Remote code execution via deserialization (pickle, yaml.load, XML entity expansion)
- Eval/exec injection with user input
- Dynamic imports from user-controlled paths
- XSS vulnerabilities (reflected, stored, DOM-based)

**5. Data Exposure**
- Sensitive data logging or storage
- PII handling violations, PII in URLs/query params
- API endpoint data leakage
- Debug information exposure in production paths

**6. Business Logic**
- Race conditions in financial/inventory operations
- Missing idempotency on critical state changes
- Bypassing workflow steps (direct URL access to restricted states)
- CSRF (state-changing endpoints missing CSRF protection)
- Open redirect (user-controlled redirect URLs)

**7. Cookie Security Flags (dedicated pass — never skip)**
- Cookies set without HttpOnly flag (XSS session theft)
- Cookies set without Secure flag (transmission over HTTP)
- Cookies missing SameSite=Strict or SameSite=Lax (CSRF)
- Session/auth cookies with excessively long or no expiry
- Cookies storing sensitive data (tokens, user IDs) that should be server-side only
- Scan: session middleware, auth handlers, JWT cookie writers, cart/session handlers

**8. HTTP Security Headers (dedicated pass — never skip)**
- Server/framework version exposed in response headers (X-Powered-By, Server header)
- Missing or misconfigured: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security (HSTS)
- Middleware or config that explicitly removes or suppresses security headers

**9. Shopify-Specific Checks (dedicated pass — never skip)**
- Shopify API credentials (API key, secret, access token) not stored in env vars or hardcoded in source
- Storefront access token exposed in client-side JS beyond read-only scope
- Webhook payloads not verified with HMAC signature (X-Shopify-Hmac-SHA256)
- Customer PII (email, address) logged or cached insecurely
- Third-party app embeds with excessive permissions
- Checkout flow integrity: price tampering via client-side params, missing server-side validation on cart/order (quantity, price, discount codes)

---

## Step 2: Hard Exclusion Rules

Do NOT report the following — these are out of scope:

**Both modes:**
1. DoS or resource exhaustion attacks
2. Rate limiting or memory/CPU exhaustion concerns
3. Outdated third-party libraries (handled by Dependabot/Snyk)
4. Memory safety issues in memory-safe languages (Rust, Go, etc.)
5. Unit test files
6. Log spoofing (only report if logging PII/secrets)
7. SSRF where only the path is controlled (not host/protocol)
8. User-controlled content in AI system prompts
9. Regex injection or regex DoS
10. Insecure documentation (markdown files)
11. Lack of audit logs
12. Lack of hardening measures (only flag concrete vulnerabilities) — **EXCEPTION**: missing cookie security flags and missing HTTP security headers ARE concrete vulnerabilities and must be reported
13. Theoretical race conditions without a concrete exploitation path
14. Style concerns, code quality issues, or performance problems

**Diff mode only (Mode B):**
- Issues that existed before this branch (not introduced by these changes)

**Path mode only (Mode A):**
- Pre-existing issues ARE in scope — report all exploitable vulnerabilities found
- Secrets stored on disk ARE in scope (no secret scanner baseline)

---

## Step 3: Analysis Methodology

### Phase 1 — Repository Context Research
- Identify existing security frameworks and libraries in use
- Look for established secure coding patterns in the codebase
- Examine existing sanitization and validation patterns
- Understand the project's security model
- Identify the reverse proxy / server config (Caddy, nginx, etc.) for header analysis

### Phase 2 — Vulnerability Assessment (categories 1-6)
- Trace data flow from user inputs to sensitive operations
- Look for privilege boundaries being crossed unsafely
- Identify injection points and unsafe deserialization

### Phase 3 — Cookie & Header Audit (categories 7-8, mandatory)
- Use Grep to find ALL cookie-setting code: search for `setCookie`, `cookie`, `Set-Cookie`, `session`, `httpOnly`, `secure`, `sameSite` across the codebase
- Use Grep to find ALL header configuration: search for `X-Powered-By`, `helmet`, `Content-Security-Policy`, `X-Frame-Options`, `HSTS`, `nosniff` in server code and reverse proxy configs
- For each cookie found: verify HttpOnly, Secure, SameSite, and expiry are set correctly
- For each required security header: verify it is present and correctly configured

### Phase 4 — Shopify / E-commerce Checks (category 9, mandatory)
- Use Grep to find webhook handlers: search for `webhook`, `hmac`, `X-Shopify-Hmac`, `createHmac`, `verify` in route handlers
- For each webhook endpoint: verify HMAC signature validation exists BEFORE processing the payload
- Use Grep to find API credential usage: search for `SHOPIFY`, `API_KEY`, `API_SECRET`, `ACCESS_TOKEN`, `STOREFRONT` in all files
- Verify credentials come from env vars, not hardcoded strings
- Check that storefront tokens in client-side code are read-only scoped
- Use Grep to find checkout/cart/order handlers: search for `price`, `total`, `quantity`, `discount`, `checkout` in route handlers
- Verify all price/quantity/discount values are validated server-side (not trusted from client)

---

## Step 4: Two-Pass Analysis

### Pass 1 — Identification (parallel subtasks)

Run Phases 1-4 in parallel using Task subtasks:
1. **Subtask A**: Phase 1 + Phase 2 (general vulnerability assessment)
2. **Subtask B**: Phase 3 (cookie & header audit)
3. **Subtask C**: Phase 4 (Shopify/e-commerce checks)

Each subtask lists ALL potential findings with: category, file, line number, code snippet, and initial confidence (0.0–1.0).

### Pass 2 — False Positive Filtering (parallel subtasks)

For each finding from Pass 1, launch a parallel Task subtask:
> "Evaluate this potential security finding: [finding]. Analyze the full context: what framework is used? Are there upstream validation layers? Is this reachable from an untrusted input source? Give a final confidence (0.0–1.0) and explain your reasoning. If confidence < 0.8, mark EXCLUDE with reason."

Keep only findings where final confidence >= 0.8.

---

## Step 5: Severity Assignment

| Severity | Criteria |
|---|---|
| **CRITICAL** | Direct RCE, full auth bypass, mass data exfiltration, unverified webhook processing payment/order data |
| **HIGH** | Significant data exposure, privilege escalation, IDOR, missing HttpOnly on auth cookies, hardcoded API secrets, checkout price tampering |
| **MEDIUM** | Requires chaining or specific conditions, missing security headers (CSP, HSTS), cookies without SameSite, storefront token over-scoping |
| **LOW** | Defense-in-depth improvements, missing non-critical headers (Referrer-Policy, Permissions-Policy), cookie expiry too long |

---

## Step 6: Completeness Checklist

Before finalizing the report, confirm ALL of the following were checked. If a check was not applicable (e.g., no cookies found), state "N/A — no cookie-setting code found" in the report footer.

- [ ] Cookie-setting code grepped and each cookie evaluated
- [ ] Security headers checked in server config AND reverse proxy
- [ ] Webhook handlers checked for HMAC verification
- [ ] API credentials checked for hardcoding vs env vars
- [ ] Checkout/cart handlers checked for server-side price validation
- [ ] Client-side bundles checked for leaked secrets/tokens

---

## Step 7: Output Report

**Mode A header:**
```
## Security Review — Path Scan: [SCAN_TARGET]

**Files scanned:** N
**Findings:** C Critical, H High, M Medium, L Low
```

**Mode B header:**
```
## Security Review — Branch: [SCAN_TARGET]

**Files reviewed:** N (changed on this branch)
**Commits:** N
**Findings:** C Critical, H High, M Medium, L Low
```

**Finding format:**

### Finding N: [Short Title] — `file.ext:line`

* Severity: CRITICAL / HIGH / MEDIUM / LOW
* Category: [Injection/Auth/Crypto/DataExposure/CodeExecution/XSS/BusinessLogic/CookieSecurity/SecurityHeaders/ShopifyIntegrity]
* Confidence: 0.XX
* Description: [what the vulnerability is]
* Exploit Scenario: [concrete attack path]
* Recommendation: [specific fix with code if applicable]

---

**Summary table (always include after all findings):**

### Findings Table
| # | Severity | Category | File:Line | Issue | Fix (one line) |
|---|----------|----------|-----------|-------|----------------|

### Exact Fixes
For every CRITICAL and HIGH finding, provide:
1. **Current code** — the vulnerable version (exact snippet)
2. **Fixed code** — the corrected version, ready to paste
3. **Why** — one sentence on why this specific issue is exploitable

---

## Exit Condition

- 0 findings → "No exploitable vulnerabilities found."
- >= 1 CRITICAL → Recommend blocking merge / deployment until resolved
- HIGH only → Recommend fixing before release
- MEDIUM/LOW only → Recommend fixing in follow-up ticket

Your final reply must contain only the markdown security report.
