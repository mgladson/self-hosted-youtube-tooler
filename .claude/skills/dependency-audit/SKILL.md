---
name: dependency-audit
description: "Dependency auditing: CVE vulnerability scanning (npm audit/pip-audit/govulncheck), license compliance and copyleft detection, outdated package analysis, and upgrade planning with breaking change analysis. Sub-commands: /dependency-audit:vulnerabilities, :licenses, :freshness, :upgrade-plan. Use when auditing dependencies, checking for vulnerabilities, or planning upgrades."
---

# Dependency Audit

You are executing the `/dependency-audit` skill. You apply dependency management best practices for vulnerability scanning, license compliance, freshness, and upgrade planning.

Parse the sub-command from the user's invocation:
- `/dependency-audit` → show **menu** and wait for selection
- `/dependency-audit:vulnerabilities` → **Vulnerability Scanning**
- `/dependency-audit:licenses` → **License Compliance**
- `/dependency-audit:freshness` → **Freshness Analysis**
- `/dependency-audit:upgrade-plan` → **Upgrade Planning**

---

## Menu (no sub-command)

```
Dependency Audit — Choose a topic:

1. vulnerabilities — CVE scanning per ecosystem (npm, pip, Go, .NET, Cargo)
2. licenses        — License compliance, copyleft detection, SBOM generation
3. freshness       — Outdated packages, major version lag, EOL detection
4. upgrade-plan    — Breaking change analysis, staged upgrade strategy
```

---

## Vulnerability Scanning (`:vulnerabilities`)

### Per-Ecosystem Commands
```bash
# Node.js
npm audit --audit-level=high
npm audit fix  # Auto-fix compatible updates

# Python
pip-audit
pip-audit --fix  # Auto-update to patched versions

# Go
govulncheck ./...

# .NET
dotnet list package --vulnerable --include-transitive

# Rust
cargo audit

# Ruby
bundle audit check --update

# Java (Maven)
mvn org.owasp:dependency-check-maven:check
```

### CI Integration
```yaml
# GitHub Actions: fail on high/critical vulnerabilities
- name: Security audit
  run: |
    npm audit --audit-level=high
    # Exit code 1 = vulnerabilities found → fails the build
```

### Severity Classification
```
CRITICAL: Remote code execution, auth bypass — Fix immediately
HIGH:     Data exposure, privilege escalation — Fix within 24h
MEDIUM:   DoS, information disclosure — Fix within 1 week
LOW:      Minor issues — Fix in next maintenance cycle
```

### Severity Triage Guide
```
CRITICAL (CVSS 9.0-10.0):
  - Examples: RCE (remote code execution), authentication bypass, SQL injection
  - Action: patch immediately, before the next deploy
  - If no patch exists: disable the vulnerable feature or block the attack vector
  - Escalate to security team and document in incident log

HIGH (CVSS 7.0-8.9):
  - Examples: privilege escalation, significant data exposure, SSRF
  - Action: patch within 24 hours
  - If in a weekend/holiday: assess exploitability and consider emergency patch
  - Document in the next security review

MEDIUM (CVSS 4.0-6.9):
  - Examples: DoS vulnerabilities, information disclosure, CSRF
  - Action: patch within the current sprint (typically 1-2 weeks)
  - Add to the next sprint's security backlog

LOW (CVSS 0.1-3.9):
  - Examples: minor information leakage, low-impact issues
  - Action: track in backlog, patch in next maintenance cycle
  - Review quarterly at minimum
```

### False Positive Identification
```
Not every vulnerability report is actionable. Check before patching:

1. Is the vulnerable code path reachable?
   - A CVE in a JSON parser matters only if you parse untrusted JSON
   - A CVE in a server component matters only if you use that component
   - Check: does your code call the specific vulnerable function?

2. Is the vulnerable version actually installed?
   - npm audit reports transitive dependencies — check if the vulnerable
     version is in node_modules, not just theoretically possible
   - Run: npm ls <package-name> to see what version is actually resolved

3. Is the attack vector applicable to your environment?
   - A "network-exploitable" vulnerability in a CLI tool run locally = low risk
   - A "local" vulnerability in a server-side library = low risk if no local access

4. Document false positives:
   # .nsprc or audit ignore file
   # Explain WHY this finding does not apply
   { "exceptions": [{ "advisoryId": 1234, "reason": "Vulnerable code path not reachable: we never parse user-supplied XML" }] }
```

### CI Enforcement Examples
```yaml
# Node.js — GitHub Actions
- name: npm audit
  run: npm audit --audit-level=high
  # Fails CI on HIGH or CRITICAL; MEDIUM/LOW are reported but don't block

# Python — GitHub Actions
- name: pip-audit
  run: pip-audit --fail-on-vuln-found

# Go — GitHub Actions
- name: govulncheck
  run: |
    go install golang.org/x/vuln/cmd/govulncheck@latest
    govulncheck ./...

# Rust — GitHub Actions
- name: cargo audit
  run: |
    cargo install cargo-audit
    cargo audit --deny warnings

# .NET — GitHub Actions
- name: dotnet vulnerability scan
  run: dotnet list package --vulnerable --include-transitive 2>&1 | grep -q 'has no vulnerable packages' || exit 1
```

---

## License Compliance (`:licenses`)

### License Categories
```
Permissive (safe for commercial use):
  MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense

Copyleft (requires source disclosure):
  GPL-2.0, GPL-3.0, AGPL-3.0, LGPL-2.1, LGPL-3.0, MPL-2.0

  AGPL-3.0: network use triggers copyleft (SaaS must share source)
  GPL in dependencies may make your entire project GPL

Unknown / Custom:
  Review manually before using
```

### Scanning Tools
```bash
# Node.js
npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"

# Python
pip-licenses --with-system --format=csv --output-file=licenses.csv

# Go
go-licenses check ./... --disallowed_types=restricted

# SBOM Generation (CycloneDX)
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

### License Compatibility Matrix
```
Permissive licenses (MIT / Apache-2.0 / BSD-2 / BSD-3 / ISC):
  - Safe for commercial use without any source disclosure requirement
  - Can be included in proprietary software
  - Apache-2.0 includes a patent grant (preferred over MIT for that reason)
  - Difference between BSD-2 and BSD-3: BSD-3 has a non-endorsement clause

LGPL (GNU Lesser General Public License):
  - Conditional: you must allow users to re-link against a modified version of the library
  - Safe for use as a dynamically linked library in proprietary software
  - Risky if you statically link or modify the library itself
  - Action: use only as a runtime dependency, do not fork or statically link

GPL-2.0 / GPL-3.0 (GNU General Public License):
  - Copyleft: any software that links or incorporates GPL code must itself be GPL
  - Not safe for use in closed-source commercial software
  - Action: require legal review; consider finding an alternative library

AGPL-3.0 (Affero GPL):
  - Strongest copyleft: extends GPL to network use
  - If your SaaS product uses AGPL code, you must publish your full source
  - Action: never include in commercial SaaS without explicit legal sign-off

MPL-2.0 (Mozilla Public License):
  - File-level copyleft: only modifications to MPL files must be shared
  - Can be combined with proprietary code in separate files
  - Generally safe but verify the boundary is maintained
```

### Tools: Per Ecosystem
```bash
# Node.js: license-checker
npx license-checker --production --json --out licenses.json
npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"
npx license-checker --production --csv --out licenses.csv

# Python: pip-licenses
pip install pip-licenses
pip-licenses --format=table               # Human-readable table
pip-licenses --format=csv                 # CSV for compliance records
pip-licenses --fail-on="GPL;AGPL"         # Fail if GPL/AGPL found

# Rust: cargo-about
cargo install cargo-about
cargo about generate about.hbs            # Generate license report

# Java: license-maven-plugin
# Add to pom.xml and run: mvn license:aggregate-third-party-report
```

### SPDX Identifier Format
```
SPDX (Software Package Data Exchange) identifiers are the standard way
to express license types in machine-readable format.

Common SPDX identifiers:
  MIT           → MIT License
  Apache-2.0    → Apache License 2.0
  BSD-2-Clause  → BSD 2-Clause "Simplified" License
  BSD-3-Clause  → BSD 3-Clause "New" or "Revised" License
  GPL-2.0-only  → GNU General Public License v2.0 only
  GPL-3.0-only  → GNU General Public License v3.0 only
  AGPL-3.0-only → GNU Affero General Public License v3.0 only
  LGPL-2.1-only → GNU Lesser General Public License v2.1 only
  MPL-2.0       → Mozilla Public License 2.0
  ISC           → ISC License
  Unlicense     → The Unlicense (public domain)

In package.json, always use SPDX identifiers:
  "license": "MIT"
  "license": "Apache-2.0"
  "license": "(MIT OR Apache-2.0)"   // dual-license

Reference: https://spdx.org/licenses/
```

---

## Freshness Analysis (`:freshness`)

### Commands
```bash
# Node.js
npm outdated           # Shows current, wanted, latest
npx npm-check -u       # Interactive update

# Python
pip list --outdated

# Go
go list -u -m all      # Show available updates

# Rust
cargo outdated

# .NET
dotnet list package --outdated
```

### Risk Assessment
```
| Lag          | Risk    | Action                         |
|-------------|---------|--------------------------------|
| Patch behind | Low     | Update in next maintenance     |
| Minor behind | Medium  | Update within sprint           |
| 1 major behind| High   | Plan upgrade, check breaking   |
| 2+ major behind| Critical | Urgent: likely unpatched CVEs |
| EOL runtime  | Critical | Migrate immediately            |
```

### Major Version Lag Risk Assessment
```
1 major version behind (e.g., using v3, current is v4):
  - Risk level: MEDIUM
  - Likely missing security patches backported to current major only
  - Breaking changes to plan around, but upgrade path is documented
  - Action: add to next quarter's roadmap, complete within 3 months

2+ major versions behind (e.g., using v2, current is v5):
  - Risk level: HIGH
  - Almost certainly missing CVE patches that were never backported
  - Upgrade may require significant refactoring across multiple major versions
  - Cannot upgrade directly — must step through each major version sequentially
  - Action: escalate to tech lead, allocate dedicated sprint capacity

Completely abandoned / unmaintained (no releases in 2+ years):
  - Risk level: HIGH regardless of version
  - No future security patches will ever be issued
  - Action: find an actively maintained fork or replacement
```

### LTS vs. Rolling Release Tracking
```
LTS (Long-Term Support) releases:
  - Receive security patches for a defined window (typically 2-5 years)
  - Preferred for production systems — predictable support timeline
  - Examples: Node.js LTS (even versions), Ubuntu LTS, Python's 3.x security window

Rolling release:
  - Latest features but no backported security patches to older versions
  - You must stay current to stay secure
  - Higher upgrade frequency required

Tracking strategy:
  - For each runtime/framework, track its official EOL calendar
  - Node.js: https://nodejs.org/en/about/previous-releases
  - Python: https://devguide.python.org/versions/
  - Set a calendar reminder 6 months before EOL to plan migration
  - Never run a runtime past its security support window in production
```

### Security Support Window Check
```bash
# Check Node.js version EOL status
node --version                            # e.g., v18.20.0
# Cross-reference with: https://nodejs.org/en/about/previous-releases
# Node 18 LTS: security support until April 2025

# Check Python version
python --version                          # e.g., Python 3.9.18
# Python 3.9 security: until October 2025

# Check if a package is still actively maintained (npm)
npm view <package-name> time.modified     # Last publish date
npm view <package-name> time.created      # When first published

# Check if a package is deprecated
npm view <package-name> deprecated        # Shows deprecation message if any
```

---

## Upgrade Planning (`:upgrade-plan`)

### Process
```
1. Identify: List all outdated packages with version delta
2. Prioritize: CVEs first, then major versions, then minors
3. Research: Read changelogs for breaking changes
4. Stage: Group compatible updates, test each group
5. Execute: One PR per major upgrade, batch minors/patches
```

### Breaking Change Checklist
```markdown
## Upgrade: package-name v2 → v3

### Breaking Changes
- [ ] API change: `oldMethod()` → `newMethod()`
- [ ] Config format changed: update config files
- [ ] Dropped Node 16 support: verify CI matrix
- [ ] Peer dependency bumped: update co-dependencies

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual smoke test
- [ ] No new deprecation warnings

### Rollback Plan
- Revert commit SHA: (fill in after merge)
- Pin previous version in package.json if needed
```

### Upgrade Path for Major Version Jumps
```
When upgrading across multiple major versions (e.g., v2 → v5):

NEVER skip major versions:
  - Go v2 → v3 → v4 → v5, not v2 → v5 directly
  - Each major version introduces its own breaking changes
  - Skipping means debugging breaking changes from multiple versions simultaneously

Step-by-step process:
  1. Read the migration guide for the NEXT major version only
  2. Apply the upgrade in an isolated branch
  3. Run the full test suite — address every failure before continuing
  4. Merge and deploy; confirm stability in production
  5. Repeat for the next major version

Documenting each step:
  - Create one PR per major version bump
  - Title each PR: "chore: upgrade <package> from vN to vN+1"
  - Include migration guide reference and list of changes made
  - Tag the merge commit for easy rollback reference
```

### Automated PR Creation
```yaml
# Dependabot configuration (.github/dependabot.yml)
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    groups:
      # Group minor/patch updates together (less noise)
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
    ignore:
      # Manually handle major version bumps
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]

  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
```

```bash
# npm-check-updates: check and apply updates interactively
npx npm-check-updates          # Show all possible updates
npx npm-check-updates -u       # Apply all updates to package.json
npx npm-check-updates --target minor  # Only minor/patch updates
npx npm-check-updates --target patch  # Only patch updates

# Upgrade a specific package to latest
npx npm-check-updates -u lodash
```

### Breaking Change Test Strategy
```
When upgrading a major version, run tests in this order:

1. Static type checking first (TypeScript / mypy / Go vet):
   - Type errors from API changes surface immediately
   - Fix type errors before running runtime tests

2. Unit tests:
   - Fastest feedback loop for logic regressions
   - If unit tests fail: investigate before running integration tests

3. Integration tests:
   - Test against real external services (database, cache, APIs)
   - New version may change connection behavior, query syntax, etc.

4. End-to-end / smoke tests:
   - Run the full application stack in a staging environment
   - Exercise the primary user flows manually or via E2E test suite

5. Load / performance tests:
   - New major versions can change performance characteristics
   - Run a representative load test and compare p95/p99 latency

6. Deprecation warning audit:
   - Run tests with deprecation warnings enabled (Node: NODE_OPTIONS=--trace-deprecation)
   - New major versions often warn about APIs that will be removed in the NEXT major
   - Fix all deprecation warnings before merging
```

---

## Hard Constraints
- CVE scanning must run in CI and fail on HIGH/CRITICAL vulnerabilities
- AGPL-3.0 and GPL dependencies require legal review before use
- Dependencies more than 1 major version behind must have an upgrade plan
- Lock files (package-lock.json, poetry.lock, go.sum) must be committed
- Never use `*` or `latest` as version specifiers in production
- SBOM must be generated for production deployments
- Never ship code with CRITICAL or HIGH severity CVEs without a documented exception that includes: the CVE identifier, reason a patch is not available, specific mitigation steps applied, and a deadline for resolution — undocumented exceptions are not acceptable
- Always run the vulnerability audit in CI with severity-based failure configured (`npm audit --audit-level=high`, `pip-audit --fail-on-vuln-found`, `cargo audit --deny warnings`, or equivalent) so that HIGH/CRITICAL findings block the build automatically
