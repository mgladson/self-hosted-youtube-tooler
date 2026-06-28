---
name: pr-review
description: "Multi-lens PR code review: full review, quick pass, security-focused, performance-focused, and nit-picking modes. Reads PR diff via gh CLI or git diff, spawns parallel reviewers per lens, deduplicates findings. Sub-commands: /pr-review:full, :quick, :security, :performance, :nit. Use when reviewing pull requests, code changes, or preparing code for merge."
---

# PR Review

You are executing the `/pr-review` skill. You perform structured, multi-lens code review on pull requests or branch diffs.

Parse the sub-command from the user's invocation:
- `/pr-review` → show **menu** and wait for selection
- `/pr-review:full` → **Full Review** (all 5 lenses)
- `/pr-review:quick` → **Quick Review** (correctness + security only)
- `/pr-review:security` → **Security Lens** only
- `/pr-review:performance` → **Performance Lens** only
- `/pr-review:nit` → **Style & Nit-picks** only

---

## Menu (no sub-command)

```
PR Review — Choose a mode:

1. full        — All 5 lenses: correctness, security, performance, maintainability, style
2. quick       — Fast pass: correctness + security only (~2 min)
3. security    — Security-focused: injection, auth, data exposure, crypto
4. performance — Performance-focused: N+1, allocations, complexity, caching
5. nit         — Style only: naming, formatting, comments, consistency
```

---

## Step 0: Acquire the Diff

Detect the diff source:
1. If `$ARGUMENTS` contains a PR number → `gh pr diff <number>`
2. If `$ARGUMENTS` contains a branch name → `git diff main...<branch>`
3. If no arguments → `git diff main...HEAD` (current branch vs main)

Also run:
- `git diff --stat` to understand scope (files changed, lines added/removed)
- `git log --oneline main..HEAD` to understand commit history

If the diff is very large (>2000 lines), warn the user and offer to focus on specific files.

---

## Step 1: Full Review (`:full`)

Spawn up to 5 parallel Task reviewers, one per lens. Each reviewer receives the full diff and focuses on ONE dimension:

### Lens 1: Correctness
- Logic errors, off-by-one, null/undefined handling
- Missing edge cases, boundary conditions
- Race conditions, concurrency bugs
- Broken contracts (API changes without updating callers)

### Lens 2: Security
- Injection vulnerabilities (SQL, XSS, command, template)
- Authentication/authorization gaps
- Data exposure (PII in logs, secrets in code, overly permissive CORS)
- Cryptographic misuse (weak algorithms, hardcoded keys)
- Input validation gaps at system boundaries

### Lens 3: Performance
- N+1 queries (ORM eager/lazy loading)
- Unnecessary allocations in hot loops
- Missing pagination on unbounded queries
- Blocking I/O in async context
- Missing caching for repeated expensive operations

### Lens 4: Maintainability
- Complexity hotspots (deeply nested conditionals, long functions)
- Missing abstractions or premature abstractions
- Coupling between modules that should be independent
- Missing or inadequate error handling
- Dead code or unused imports

### Lens 5: Style & Consistency
- Naming inconsistencies (within this PR and with existing codebase)
- Missing or outdated documentation for public APIs
- Code formatting deviations from project style
- Magic numbers or strings that should be constants

### Handling Large PRs (>500 Lines Changed)

A PR with >500 lines is too large to review as a unit. Apply this strategy:

1. **Segment by concern**: run `git diff --stat` to see which files changed. Group files into logical clusters:
   - Data layer changes (models, migrations, repositories)
   - Business logic changes (services, domain objects)
   - API/interface changes (controllers, serializers, routes)
   - Test changes (review separately — tests are documentation)
   - Configuration changes (review separately — high blast radius)

2. **Prioritize critical paths first**: start with files that touch authentication, authorization, data persistence, or payment flows. These are where bugs cause the most damage.

3. **Spawn reviewers per cluster**: instead of one reviewer per lens, spawn one reviewer per file cluster. Each cluster reviewer applies all relevant lenses to their assigned files.

4. **Flag the PR size**: include a note in the output: "This PR is large (+X lines). Consider splitting into smaller PRs by concern for easier future review."

### Parallel Task Spawning Template

When spawning parallel reviewers, pass this context to each Task:

```
You are reviewing a pull request. Focus ONLY on [LENS NAME].
Diff excerpt:
---
[paste relevant diff section]
---
For each finding, output:
  SEVERITY: [CRITICAL|HIGH|MEDIUM|LOW]
  FILE: filename:line
  CATEGORY: [Security|Correctness|Performance|Maintainability|Style]
  ISSUE: one sentence describing the problem
  FIX: one sentence describing the recommended fix
Output nothing if you find no issues in your lens.
```

Collect all outputs, deduplicate by file:line, then sort by severity.

### Verdict Rating Scale

After reviewing all findings, assign one of three verdicts:

- **APPROVE** — no CRITICAL or HIGH findings; MEDIUM findings are minor or have workarounds; LOW findings are noted but do not block. The code is safe to merge.
- **REQUEST CHANGES** — one or more CRITICAL or HIGH findings that must be addressed before merge. List the specific items that must change.
- **COMMENT** — no blocking issues found, but meaningful observations worth discussing. The author may merge at their discretion. Use this for architectural suggestions, alternative approaches, or optional improvements.

Never use REQUEST CHANGES for LOW findings alone. Never APPROVE a PR with an unaddressed CRITICAL finding.

---

## Quick Review (`:quick`)

Run **Lens 1 (Correctness)** and **Lens 2 (Security)** only. Skip performance, maintainability, and style lenses.

Use this mode for:
- Small PRs (< 200 lines) where a fast pass is sufficient
- Urgent hotfix PRs that need rapid review
- Follow-up PRs where a full review was already done on the original

Output the same format as `:full` but note: "Quick review — correctness and security lenses only. Run `/pr-review:full` for comprehensive coverage."

---

## Security Review (`:security`)

Run **Lens 2 (Security)** only with expanded depth:

In addition to the standard security lens checklist, also check:
- **Dependency changes**: any new packages added? Check for known CVEs
- **Configuration changes**: environment variables, feature flags, permission changes
- **Data flow**: trace user input from entry point to storage/output — flag any unvalidated path
- **Secrets**: scan for hardcoded tokens, API keys, connection strings, private keys
- **Auth boundaries**: verify every new endpoint has appropriate authentication and authorization

Output severity-ranked findings. Prefix verdict with "Security-focused review" to set expectations.

---

## Performance Review (`:performance`)

Run **Lens 3 (Performance)** only with expanded depth:

In addition to the standard performance lens checklist, also check:
- **Bundle impact**: new imports that significantly increase bundle size
- **Database queries**: any new queries without LIMIT, missing indexes on filtered columns
- **Memory**: large object allocations, unbounded caches, closures capturing large scopes
- **Concurrency**: thread pool sizing, connection pool exhaustion, lock contention
- **Network**: redundant API calls, missing request batching, payload size

Output performance findings with estimated impact (e.g., "adds O(N) query per request" or "increases bundle by ~50KB").

---

## Style & Nit-picks (`:nit`)

Run **Lens 5 (Style & Consistency)** only. This is the lowest-severity review mode.

Focus on:
- Naming: variables, functions, files — consistent with existing codebase conventions
- Formatting: indentation, line length, bracket style — match project linter config
- Comments: outdated comments, commented-out code, missing JSDoc/docstrings on public APIs
- Organization: import ordering, file structure, function ordering within a module
- Constants: magic numbers/strings that should be named constants

Prefix every finding with `[NIT]`. Output format uses only LOW severity. Never block a PR on nits alone — use verdict COMMENT, not REQUEST CHANGES.

---

## Step 2: Deduplicate & Rank

After all lenses complete:
1. Merge findings, removing duplicates across lenses
2. Assign severity: **CRITICAL** / **HIGH** / **MEDIUM** / **LOW**
3. Sort by severity (CRITICAL first)
4. Group by file for readability

---

## Step 3: Output Format

```markdown
## PR Review Summary

**Scope:** N files changed, +X/-Y lines
**Verdict:** APPROVE / REQUEST CHANGES / COMMENT

### Findings (N total: Xc Xh Xm Xl)

#### CRITICAL
- **#1** — `file.ts:42` — [Security] SQL injection via unsanitized user input
  **Fix:** Use parameterized queries instead of string interpolation

#### HIGH
- **#2** — `service.py:108` — [Correctness] Missing null check on optional field
  **Fix:** Add guard clause before accessing `.name`

#### MEDIUM
...

#### LOW
...

### What Looks Good
- [List 2-3 positive observations about the code]
```

### Realistic Output Example

The following is a complete example showing how a real review looks with findings at multiple severities:

```markdown
## PR Review Summary

**Scope:** 7 files changed, +183/-42 lines
**PR:** #214 — Add user password reset flow
**Verdict:** REQUEST CHANGES

### Findings (8 total: 1c 2h 3m 2l)

#### CRITICAL
- **#1** — `auth/reset.py:67` — [Security] Password reset token stored in plaintext
  The `reset_token` field is stored as-is in the `password_resets` table.
  A database breach exposes all active reset tokens, allowing account takeover.
  **Fix:** Store `hashlib.sha256(token).hexdigest()` in the database. Send the
  raw token in the email. On verification, hash the submitted token and compare.

#### HIGH
- **#2** — `auth/reset.py:89` — [Correctness] No expiry check on reset token
  `verify_reset_token()` checks that the token exists but does not validate
  `expires_at`. Expired tokens remain valid indefinitely.
  **Fix:** Add `and PasswordReset.expires_at > datetime.utcnow()` to the query.

- **#3** — `auth/reset.py:112` — [Security] Reset token not invalidated after use
  After a successful password change, the token record is left in the database.
  The same token can be reused to reset the password again.
  **Fix:** Delete or mark the token as used immediately after `update_password()`.

#### MEDIUM
- **#4** — `auth/reset.py:44` — [Correctness] User enumeration via timing difference
  Existing users trigger a DB write + email send; unknown emails return immediately.
  An attacker can enumerate registered emails by measuring response time.
  **Fix:** Always perform the same operations (write a dummy record or add a sleep)
  before returning, making response time uniform.

- **#5** — `email/templates/reset.html:18` — [Security] Reset link uses HTTP, not HTTPS
  `href="http://{{ domain }}/reset?token={{ token }}"` — tokens sent over HTTP
  are visible to network intermediaries.
  **Fix:** Use `https://` and enforce HTTPS at the application level.

- **#6** — `auth/reset.py:31` — [Maintainability] Magic number 3600 (token TTL)
  `expires_at = datetime.utcnow() + timedelta(seconds=3600)` — the number 3600
  appears without explanation.
  **Fix:** Extract to `PASSWORD_RESET_TTL_SECONDS = 3600` in `settings.py`.

#### LOW
- **#7** — `auth/reset.py:55` — [Style] Function name `do_reset` doesn't follow convention
  Other functions in this module are named `initiate_<action>` or `complete_<action>`.
  **Fix:** Rename to `initiate_password_reset` for consistency.

- **#8** — `tests/test_reset.py:12` — [Style] Test file missing module-level docstring
  All other test files in `tests/` have a module docstring describing the tested component.
  **Fix:** Add `"""Tests for the password reset flow (auth/reset.py)."""`.

### What Looks Good
- The reset flow correctly hashes the new password with bcrypt before storing it (reset.py:128)
- Email template is clean and accessible — plain text fallback included
- Test coverage is comprehensive for the happy path (10 test cases)

### Items Required Before Merge
- #1 Token hashing (CRITICAL — security)
- #2 Expiry check (HIGH — correctness)
- #3 Token invalidation after use (HIGH — security)
```

---

## Common Review Patterns

Different types of PRs require different review emphasis. Adjust your focus based on the PR's declared intent.

### When a PR is a Refactor

A refactor PR claims to change structure without changing behavior. Your job is to verify that claim.

- **Focus on behavior preservation**: for every function or method that was changed, verify the external contract (inputs, outputs, side effects) is identical.
- **Check all call sites**: if a function was renamed, moved, or had its signature changed, search the codebase for every caller. Missing call site updates are silent runtime errors.
- **Do not flag style improvements as issues**: the point of a refactor is to improve the code. Do not penalize the author for renaming a variable or extracting a helper.
- **Verify test coverage**: a refactor without tests is a behavior change waiting to happen. If the refactored code has no characterization tests, flag this as MEDIUM.
- **Run `:quick` at minimum**: even for refactors, correctness and security lenses catch cases where refactoring accidentally altered logic.

### When a PR Adds a Feature

A feature PR introduces new user-visible behavior. Your focus shifts to completeness.

- **Focus on completeness**: does the feature cover all the cases the ticket/spec describes? List any described scenarios that have no corresponding code path.
- **Check error paths**: every external input, network call, and database operation can fail. Are errors handled and surfaced appropriately?
- **Verify tests exist**: a feature without tests is undocumented behavior. Flag missing tests as HIGH if the feature touches core logic, MEDIUM otherwise.
- **Check for missing authorization**: new features often introduce new endpoints or data access patterns. Verify that authentication and permission checks are present.
- **Look for incomplete integration**: does the feature connect to the rest of the system? Check that new APIs are called by the UI, new events are consumed, new models are included in migrations.

### When a PR Fixes a Bug

A bug fix PR must address the root cause, not just suppress the symptom.

- **Verify the fix covers the root cause**: read the bug description, then read the fix. Ask: "If the root cause were still present, would this fix still fail?" If the fix is a workaround (e.g., adding a null check without fixing why null appears), flag it as MEDIUM.
- **Check for a regression test**: every bug fix should include a test that would have caught the bug originally. If no test was added, flag this as HIGH — the bug will recur.
- **Look for related instances**: if the bug was caused by a pattern (e.g., missing input validation), search for the same pattern elsewhere in the codebase.
- **Verify the fix doesn't introduce new issues**: targeted bug fixes sometimes break adjacent behavior. Pay extra attention to Lens 1 (Correctness) for the changed functions.

### Security-Sensitive PRs

Some PRs touch areas where a mistake has severe consequences: authentication, authorization, payment processing, cryptography, file uploads, or user data.

- **Always run `:security` even during `:quick`**: for PRs that touch any of these areas, the security lens is mandatory regardless of PR size.
- **Trace every new data flow end-to-end**: from the point user input enters the system to the point it is stored or displayed. Flag any step where input is used without validation or encoding.
- **Check for defense in depth**: a single missing check is often acceptable if there is a second layer. A PR that removes a secondary check (e.g., server-side validation, because client-side validation was added) is HIGH severity.
- **Escalate CRITICALs before completing the review**: if you find a CRITICAL security issue, surface it immediately rather than waiting to compile the full review. The author should be aware as soon as possible.

---

## Hard Constraints
- Never fabricate findings — every issue must reference a specific file:line from the diff
- Do not review files that aren't in the diff
- Focus on exploitability for security findings, not theoretical risks
- Style nits should match the project's existing conventions, not personal preference
- If the diff is a refactor with no behavior change, say so explicitly and focus on structural quality
