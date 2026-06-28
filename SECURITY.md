# Security Policy

This document covers vulnerability disclosure for contributors and security researchers, as well as production hardening guidance for operators deploying this stack.

---

## Supported Versions

This project is a boilerplate/template. There are no versioned releases with long-term support. Security fixes are applied to the **latest `main` branch** only.

| Branch | Supported |
| ------ | --------- |
| `main` | Yes       |
| Forks  | No — operators are responsible for merging upstream security fixes into their deployments. |

Operators should watch this repository for security-related commits and pull changes regularly.

---

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

### Preferred: GitHub Security Advisory

Use the **"Report a vulnerability"** button on the repository's **Security** tab to submit a private advisory. This is the fastest path to triage.

### Alternative: Email

Send a detailed report to `security@[your-domain-here]`. Operators forking this project should replace this placeholder with their own security contact address.

### What to Include

- Affected component (API, storefront, admin, auth, payments, infrastructure)
- Steps to reproduce or proof of concept
- Impact assessment (what an attacker could achieve)
- Any suggested fix, if you have one

### Response Timeline

| Stage         | SLA              |
| ------------- | ---------------- |
| Acknowledgment | Within 48 hours |
| Triage         | Within 7 days   |
| Fix (critical) | Within 14 days  |
| Fix (high)     | Within 30 days  |

### Scope

**In scope:**
- API server (`api/`) — all routes, plugins, and middleware
- Storefront (`storefront/`) — server-side rendering, client-side logic
- Admin panel (`admin/`) — authentication, authorization, all admin functions
- Authentication and session management
- Payment processing (Stripe integration, webhook handling)
- Data storage (PostgreSQL, Valkey, MinIO)
- Infrastructure configuration (Docker Compose, Caddy, network topology)
- Bot detection, rate limiting, IP banning logic
- Sanctions screening logic

**Out of scope:**
- Vulnerabilities in third-party services themselves (Stripe, Google OAuth, MaxMind)
- Denial-of-service attacks (volumetric DDoS)
- Social engineering attacks against operators or users
- Attacks requiring physical access to the host machine
- Issues in operator-modified code that diverges from this boilerplate

### Safe Harbor

We consider security research conducted in good faith to be authorized if it follows responsible disclosure practices. We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and service disruption
- Report vulnerabilities through the channels described above
- Allow reasonable time for remediation before any public disclosure
- Do not exploit vulnerabilities beyond what is necessary to demonstrate the issue

### CVE Assignment

Confirmed critical and high-severity vulnerabilities will be assigned a CVE identifier through the GitHub Security Advisory process.

### Recognition

Security researchers who report valid vulnerabilities will be credited in release notes and in this repository's acknowledgments, unless they prefer to remain anonymous. Let us know your preference when reporting.

---

## Security Architecture Overview

This stack uses a defense-in-depth approach with multiple independent layers. Compromising one layer does not automatically compromise the others.

```
Internet
   |
   v
+--------------------------+
| Layer 1: Caddy           |  TLS termination (automatic Let's Encrypt)
|   Reverse proxy          |  First-line request routing
+--------------------------+
   |
   v
+--------------------------+
| Layer 2: Bot Detector    |  Heuristic user-agent scoring
|   + Rate Limiter         |  Valkey-backed request counters
+--------------------------+
   |
   v
+--------------------------+
| Layer 3: IP Banlist      |  File-backed (data/banned-ips.json)
|                          |  Hot-reloaded, in-memory cache
+--------------------------+
   |
   v
+--------------------------+
| Layer 4: Application     |  Google OAuth 2.0 authentication
|   Auth & Authorization   |  Server-side sessions (Valkey)
|                          |  Role-based access (admin tier system)
+--------------------------+
   |
   v
+--------------------------+
| Layer 5: Honeypots       |  Trap routes (/wp-login.php, /.env, etc.)
|                          |  Auto-ban scanners on contact
+--------------------------+
   |
   v
+--------------------------+
| Layer 6: Payment         |  Stripe webhook signature verification
|   Verification           |  (STRIPE_WEBHOOK_SECRET)
+--------------------------+
   |
   v
+--------------------------+
| Layer 7: Audit &         |  Security events table (PostgreSQL)
|   Monitoring             |  Audit log (admin actions)
|                          |  Security dashboard (admin-only)
+--------------------------+
```

---

## Operator Security Checklist

Actionable hardening steps for production deployments. Complete every item before exposing the stack to the internet.

### Secrets Management

- [ ] Generate `SESSION_SECRET` with `openssl rand -hex 64` (minimum 64 characters)
- [ ] Set a strong, unique `POSTGRES_PASSWORD` (do not use the default from `.env.example`)
- [ ] Set a strong, unique `MINIO_ROOT_PASSWORD` (do not leave it as `minioadmin`)
- [ ] Set `GOOGLE_CLIENT_SECRET` from Google Cloud Console (restrict to your OAuth app)
- [ ] Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from Stripe Dashboard
- [ ] Store all secrets in a secrets manager (HashiCorp Vault, AWS Secrets Manager, Doppler, or equivalent) -- never commit `.env` files to git
- [ ] Verify `.env` is listed in `.gitignore` and has never been committed (check `git log --all -- .env`)
- [ ] Rotate `SESSION_SECRET` immediately after any suspected compromise (this invalidates all active sessions)

### Network Hardening

- [ ] PostgreSQL port (5432) must NOT be exposed to the internet -- access only via Docker internal network
- [ ] Valkey port (6379) must NOT be exposed to the internet -- access only via Docker internal network
- [ ] MinIO console port (9001) must NOT be exposed to the internet -- access only via Docker internal network
- [ ] MinIO API port (9000) must NOT be exposed to the internet -- access only via Docker internal network
- [ ] Mailpit (8025) must NOT be running in production -- remove or disable it in your production compose file
- [ ] Caddy handles TLS automatically via Let's Encrypt -- verify HTTPS is working before go-live
- [ ] Set `MINIO_USE_SSL=true` in production
- [ ] Configure host firewall (`ufw`, `iptables`, or cloud security group) to allow only ports 80, 443, and SSH
- [ ] Consider placing Caddy behind a CDN/WAF (Cloudflare, AWS CloudFront) for additional edge protection

### Authentication & Authorization

- [ ] Restrict Google OAuth to your organization's email domain if this is not a public-facing storefront
- [ ] Add only trusted email addresses to `data/admins.json`
- [ ] Assign `superadmin` tier to no more than 1-2 people
- [ ] Review admin tier assignments periodically -- remove access for people who no longer need it
- [ ] Verify that unauthenticated users cannot access any `/admin` or `/api/admin` routes

### Stripe & Payments

- [ ] Verify `STRIPE_WEBHOOK_SECRET` is set (webhook signature verification is already implemented in the codebase)
- [ ] Use production API keys (`sk_live_*`, `pk_live_*`) in production -- never use test keys (`sk_test_*`)
- [ ] Register your production webhook endpoint URL in the Stripe Dashboard
- [ ] Set `STRIPE_TAX_ENABLED` only after configuring tax registrations in your Stripe account
- [ ] Restrict Stripe API key permissions to the minimum required scopes in Stripe Dashboard

### Data & Privacy

- [ ] IP addresses in the `security_events` table are retained for 90 days per GDPR Art. 6(1)(f) -- review this retention period for your jurisdiction and update the cleanup logic if needed
- [ ] Review and complete `data/pages.json` entries for Privacy Policy and Terms of Service before launch
- [ ] Enable automated PostgreSQL backups (`docker/backup.sh`) and test restore procedures
- [ ] Encrypt the PostgreSQL data volume at rest (use host-level disk encryption: LUKS, dm-crypt, or cloud provider volume encryption)
- [ ] Encrypt MinIO storage volume at rest using the same approach
- [ ] If operating in the EU, ensure your hosting provider has appropriate data processing agreements in place

### GeoIP (Optional)

- [ ] `GeoLite2-Country.mmdb` must not be committed to git (already in `.gitignore`)
- [ ] `MAXMIND_LICENSE_KEY` must never be committed to git
- [ ] If using GeoIP for access control, understand that IP geolocation is approximate and can be bypassed with VPNs

### Monitoring & Incident Response

- [ ] Review the security dashboard at Admin > Security after launch
- [ ] Set up alerting for `ATTACK` status in the security dashboard (integrate with your monitoring stack)
- [ ] Review `audit_logs` table regularly for unexpected admin actions (bans, unblocks, configuration changes)
- [ ] Establish an incident response plan before go-live -- know who to contact and what to do if the security dashboard shows active attacks
- [ ] Monitor Caddy access logs for unusual traffic patterns

---

## Known Security Assumptions & Limitations

This section documents what the project does and does not protect against. Operators should evaluate each item against their threat model.

**Bot detection is heuristic-based.** The bot detector scores user agents and request patterns. Determined attackers using real browser user agents and normal request patterns will evade detection. This layer is designed to catch automated scanners and script kiddies, not targeted attacks.

**IP banning is file-backed.** The banlist is stored in `data/banned-ips.json` and cached in memory. This works well for moderate volumes of blocked IPs. For high-volume attacks (thousands of unique IPs), use upstream firewall rules or a CDN/WAF instead of relying solely on application-level banning.

**No built-in two-factor authentication for admin.** Admin authentication relies entirely on Google OAuth 2.0. The security of admin access depends on the security of the linked Google accounts. Operators whose Google Workspace enforces 2FA/hardware keys inherit that protection. Operators using personal Gmail accounts should enable Google 2-Step Verification independently.

**Sessions are stored in Valkey.** Server-side sessions avoid the pitfalls of JWTs (no revocation problem, no client-side token theft via XSS), but a Valkey compromise means all active sessions are compromised. Ensure Valkey is not network-accessible outside the Docker network.

**Honeypots are reactive, not preventive.** Honeypot routes (`/wp-login.php`, `/.env`, `/admin.php`, etc.) log and auto-ban scanners, but they only trigger after the scanner has already made a request. They do not prevent the initial probe.

**Sanctions screening requires operator review.** The sanctions screening plugin is present but operators must verify its data sources, update frequency, and legal applicability for their jurisdiction and use case. This boilerplate does not provide legal compliance guarantees.

**GeoIP blocking is optional and not enabled by default.** If your threat model requires geographic access restrictions, you must configure this yourself.

**This is a boilerplate.** It ships with reasonable security defaults, but operators bear full responsibility for security configuration, ongoing maintenance, patching, monitoring, and incident response in their deployments.

---

## Dependency Security

This project uses npm workspaces with dependencies across four packages:

| Workspace    | Package file               |
| ------------ | -------------------------- |
| Root         | `package.json`             |
| API          | `api/package.json`         |
| Storefront   | `storefront/package.json`  |
| Admin        | `admin/package.json`       |

### Routine Maintenance

Run `npm audit` from the repository root regularly to check all workspaces:

```bash
npm audit
```

Fix automatically where possible:

```bash
npm audit fix
```

### Automated Dependency Updates

No dependency update bot is pre-configured. Operators should set up one of the following:

- **GitHub Dependabot** -- add `.github/dependabot.yml` to your fork
- **Renovate** -- add `renovate.json` to your fork

Configure the bot to open PRs for security updates at minimum, and ideally for all patch/minor updates.

### Supply Chain Considerations

- Review new dependencies before adding them (`npm explain <package>` to understand why a dependency exists)
- Pin dependency versions in production (`package-lock.json` is committed and should be used for installs via `npm ci`)
- Consider using `npm audit signatures` to verify package provenance where supported

---

## PCI-DSS Note

This project integrates with **Stripe.js and Stripe Checkout** for payment processing. Cardholder data (card numbers, CVVs, expiration dates) is **never transmitted to, processed by, or stored on** your servers. All sensitive payment data is handled directly by Stripe's PCI-DSS Level 1 certified infrastructure.

However, operators are still responsible for maintaining **PCI-DSS SAQ A** (Self-Assessment Questionnaire A) compliance for their checkout integration. SAQ A requirements include:

- Confirming that cardholder data is only entered on Stripe-hosted or Stripe.js-rendered forms
- Ensuring your server does not log, store, or transmit raw cardholder data
- Maintaining secure systems and networks (covered by this checklist)
- Restricting access to system components

Consult the [PCI Security Standards Council](https://www.pcisecuritystandards.org/) and your payment processor's documentation for current compliance requirements.

---

## Security-Related Files

Quick reference for security-relevant paths in this repository:

| Path | Purpose |
| ---- | ------- |
| `api/src/plugins/bot-detector.ts` | Bot detection and scoring |
| `api/src/plugins/sanctions.ts` | Sanctions screening |
| `api/src/plugins/auth-guard.ts` | Authentication guard middleware |
| `api/src/plugins/session.ts` | Session management |
| `api/src/plugins/stripe.ts` | Stripe integration and webhook verification |
| `api/src/routes/security.ts` | Security dashboard API (admin-only) |
| `api/src/routes/auth.ts` | Authentication routes (OAuth flow) |
| `api/src/routes/audit.ts` | Audit log routes |
| `data/banned-ips.json` | IP banlist (hot-reloaded) |
| `data/admins.json` | Admin email allowlist and tier assignments |
| `migrations/0006_audit-log.js` | Audit log table schema |
| `migrations/0007_security-events.js` | Security events table schema |
| `migrations/0008_order-access-token-evidence.js` | Order access token evidence |
| `docker/Caddyfile` | Reverse proxy and TLS configuration |
| `.env.example` | Template for environment variables (secrets placeholders) |

---

## Changelog

| Date | Change |
| ---- | ------ |
| 2026-03-04 | Initial security policy |
