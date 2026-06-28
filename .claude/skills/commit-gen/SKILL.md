---
name: commit-gen
description: "Smart commit message generation from staged changes. Conventional Commits format, semantic messages, and changelog entry drafting. Sub-commands: /commit-gen:conventional, :semantic, :changelog-entry. Use when committing code changes or preparing commit messages."
---

# Commit Message Generator

You are executing the `/commit-gen` skill. You generate high-quality commit messages from staged changes.

Parse the sub-command from the user's invocation:
- `/commit-gen` → show **menu** and wait for selection
- `/commit-gen:conventional` → **Conventional Commits** format
- `/commit-gen:semantic` → **Semantic Commit Message**
- `/commit-gen:changelog-entry` → **Changelog Entry** draft

---

## Menu (no sub-command)

```
Commit Message Generator — Choose a format:

1. conventional    — Conventional Commits: type(scope): description
2. semantic        — Semantic: descriptive message with body and footer
3. changelog-entry — Draft a changelog line for this change
```

---

## Step 0: Read Staged Changes

Run these commands to understand the changes:
```
git diff --staged
git diff --staged --stat
git status
```

If nothing is staged, inform the user and suggest `git add` commands for relevant files.

---

## Conventional Commits (`:conventional`)

### Step 1: Classify Change Type

Analyze the diff to determine the type:

| Type | When | Emoji |
|------|------|-------|
| `feat` | New functionality visible to users | ✨ |
| `fix` | Bug fix | 🐛 |
| `docs` | Documentation only | 📝 |
| `style` | Formatting, whitespace, semicolons — no logic change | 🎨 |
| `refactor` | Code restructuring without behavior change | ♻️ |
| `perf` | Performance improvement | ⚡️ |
| `test` | Adding or updating tests | ✅ |
| `build` | Build system or external dependency changes | 🏗️ |
| `ci` | CI/CD configuration changes | 👷 |
| `chore` | Tooling, repo maintenance, non-code changes | 🔧 |

### Step 2: Detect Scope

Infer scope from file paths:
- `src/auth/*` → `auth`
- `api/users/*` → `users`
- `src/api/payments/*` → `payments`
- `src/components/ui/*` → `ui`
- `tests/*` → typically no scope needed
- Multiple directories → use the most specific common parent
- If changes span many unrelated modules → omit scope

When changes touch multiple related scopes, combine them:
```
feat(auth,api): add OAuth2 PKCE flow
```
Use comma-separated scopes only when both are equally affected. Limit to two scopes maximum.

### Step 3: Generate Message

Format: `type(scope): imperative description`

Rules:
- Subject line: imperative mood, lowercase, no period, max 72 chars
- Body (if needed): explain WHY not WHAT, wrap at 72 chars
- Footer: `BREAKING CHANGE:` if applicable, `Closes #123` for issues

**Breaking Change Format:**

```
feat(api)!: rename getUser to fetchUser

Aligns naming with the new resource-oriented API convention
introduced across all resource types in this release.

BREAKING CHANGE: `getUser(id)` has been removed. Replace all
calls with `fetchUser(id)`. The function signature is identical;
only the name has changed.

Closes #201
```

The `!` after the scope signals a breaking change in the subject line. The `BREAKING CHANGE:` footer is still required for tooling.

**Full Example With Body and Co-Author Trailer:**

```
feat(auth): add OAuth2 PKCE flow for mobile clients

Mobile clients cannot securely store client secrets, making the
standard authorization code flow unsuitable. PKCE (Proof Key for
Code Exchange) mitigates this by using a one-time verifier that
is never transmitted in plaintext.

- Add PKCE middleware to auth pipeline
- Generate code_verifier / code_challenge at login initiation
- Validate code_verifier during token exchange
- Extend integration test suite for PKCE scenarios

Closes #142
Co-authored-by: Jane Smith <jane@example.com>
```

### Step 4: Present to User

Present 2-3 options ranked by fit:

```
Option 1 (recommended):
  feat(auth): add OAuth2 PKCE flow for mobile clients

Option 2:
  feat(auth): implement PKCE authorization code exchange

Option 3:
  feat: add OAuth2 PKCE support
```

---

## Semantic Commit Message (`:semantic`)

Generate a descriptive multi-line commit message:

```
Add OAuth2 PKCE flow for mobile authentication

Implement the Proof Key for Code Exchange (PKCE) extension for
OAuth2 authorization code flow. Mobile clients cannot securely
store client secrets, so PKCE provides an alternative using
code verifiers and challenges.

Changes:
- Add PKCE middleware to auth pipeline
- Generate code_verifier and code_challenge in login flow
- Validate code_verifier during token exchange
- Add integration tests for PKCE flow

Closes #142
```

### Additional Semantic Examples

**Feature Addition:**
```
Add configurable rate limiting to the public API

Rate limiting was previously hardcoded at 100 req/min per token.
Operators running self-hosted instances need to tune this limit
based on their infrastructure capacity.

Rate limits are now configurable per API key via the admin panel.
Default remains 100 req/min to preserve backward compatibility.

Closes #187
```

**Bug Fix:**
```
Fix connection pool exhaustion under concurrent load

The DB connection pool was sized at 5 but the /reports endpoint
spawns up to 10 parallel queries. Under moderate concurrency,
requests blocked indefinitely waiting for a free connection.

Increase default pool size to 20 and add a 30-second acquisition
timeout that returns a 503 instead of hanging the request.

Fixes #148
```

**Performance Improvement:**
```
Speed up product search by adding composite index

Profiling showed the product search query performing a full table
scan on 2M rows because the (category_id, name) filter had no
index. P99 latency was 4.2s.

Add composite index on (category_id, name). P99 latency drops to
85ms in load testing. No schema migration is needed for rollback
since adding an index is non-destructive.

Closes #199
```

**Breaking Change:**
```
Replace synchronous file API with promise-based interface

The synchronous `readFileSync` / `writeFileSync` wrappers blocked
the event loop during file I/O, causing latency spikes under load.

All file utility functions now return Promises. Callers must be
updated to use `await` or `.then()`. A codemod is provided in
scripts/migrate-file-api.js to automate most conversions.

BREAKING CHANGE: readFile(), writeFile(), and appendFile() are
now async. Synchronous variants have been removed entirely.

Closes #203
```

### Rules for Determining Semantic Scope From File Paths

Inspect the staged file paths to choose the right scope keyword for the subject line:

| Path Pattern | Scope Keyword |
|---|---|
| `src/auth/**` | `authentication` |
| `src/api/**` or `api/**` | `API` |
| `src/db/**` or `models/**` | `database` |
| `src/ui/**` or `components/**` | `UI` |
| `tests/**` or `__tests__/**` | `tests` |
| `scripts/**` or `.github/**` | `tooling` |
| `docs/**` or `*.md` | `documentation` |
| `Dockerfile` or `docker-compose*` | `Docker` |
| Root config files only | (omit scope) |

---

## Changelog Entry (`:changelog-entry`)

Generate a user-facing changelog line in Keep-a-Changelog format:

```markdown
### Added
- OAuth2 PKCE flow for secure mobile authentication ([#142](link))
```

Categories: Added, Changed, Deprecated, Removed, Fixed, Security

### Full Keep-a-Changelog Entry Example

```markdown
## [1.3.0] - 2026-03-01

### Added
- OAuth2 PKCE flow for secure mobile authentication ([#142](https://github.com/org/repo/pull/142))
- Configurable rate limiting per API key via admin panel ([#187](https://github.com/org/repo/pull/187))
- Composite index on `products(category_id, name)` for faster search ([#199](https://github.com/org/repo/pull/199))

### Changed
- Upgraded database driver to v5.0 for connection multiplexing

### Fixed
- Connection pool exhaustion under concurrent load ([#148](https://github.com/org/repo/issues/148))
- Timezone handling in scheduled task execution ([#151](https://github.com/org/repo/issues/151))

### Security
- Fix CSRF token validation bypass on preflight requests ([#153](https://github.com/org/repo/pull/153))
```

### Migration Note Format for Breaking Changes

When a breaking change is included, append a migration note block beneath the entry:

```markdown
### Removed
- Synchronous file API (`readFileSync`, `writeFileSync`, `appendFileSync`)

**Migration:** Run the provided codemod to update call sites automatically:
```bash
node scripts/migrate-file-api.js --dir src/
```
See `MIGRATION.md` in the repository root for full details.
```

### Links Format for GitHub and GitLab References

Always link issue and PR numbers inline. Use the shortest unambiguous format:

```markdown
# GitHub
([#142](https://github.com/org/repo/pull/142))
([#148](https://github.com/org/repo/issues/148))

# GitLab
([!34](https://gitlab.com/org/repo/-/merge_requests/34))
([#97](https://gitlab.com/org/repo/-/issues/97))
```

If the repository URL is not known, use the short form `(#142)` and note that
the user should replace it with a full URL.

---

## Hard Constraints
- NEVER fabricate changes that aren't in the diff
- NEVER describe changes to files that weren't modified
- If the diff is empty or trivial, say so — don't inflate
- Always use imperative mood in subject line ("add" not "added" or "adds")
- Breaking changes MUST be flagged in the footer

---

## Common Pitfalls

### Describe WHY, Not HOW

Wrong:
```
refactor(auth): move token validation logic from middleware.js to auth.js
```

Right:
```
refactor(auth): centralize token validation to simplify middleware

Token validation was duplicated across three middleware files, causing
inconsistent error messages and making it hard to enforce new policy.
Consolidating into auth.js gives one place to update.
```

The diff already shows WHAT changed. The commit message exists to explain the
reasoning a future reader cannot infer from the code alone.

### One Commit = One Logical Change

If `git diff --staged --stat` shows changes across more than three unrelated
subsystems, tell the user:

```
The staged changes span multiple unrelated concerns:
- src/auth/token.js  → authentication change
- src/billing/invoice.js → billing change
- docs/README.md → documentation update

Consider splitting into separate commits with `git add -p` so each commit
is independently revertable and bisectable.
```

### Never Mix Formatting With Logic Changes

If the diff contains both whitespace/formatting changes and logic changes in
the same file, flag it:

```
Warning: This diff mixes formatting changes with logic changes in
src/api/users.js. This makes code review harder and breaks `git blame`.

Consider staging only the logic changes first:
  git add -p src/api/users.js
```

A `style:` commit should contain zero logic changes. A `feat:` or `fix:`
commit should contain zero formatting-only changes.
