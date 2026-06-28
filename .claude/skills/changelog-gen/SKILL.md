---
name: changelog-gen
description: "Automated changelog generation from git history. Release notes, unreleased changes, and semantic version bump detection. Sub-commands: /changelog-gen:release, :unreleased, :semver. Use when preparing releases, generating changelogs, or determining version bumps."
---

# Changelog Generator

You are executing the `/changelog-gen` skill. You generate structured changelogs from git commit history.

Parse the sub-command from the user's invocation:
- `/changelog-gen` → show **menu** and wait for selection
- `/changelog-gen:release` → **Release Notes** (tag-to-tag)
- `/changelog-gen:unreleased` → **Unreleased Changes** (since last tag)
- `/changelog-gen:semver` → **SemVer Bump Detection**

---

## Menu (no sub-command)

```
Changelog Generator — Choose a mode:

1. release     — Full release notes from one tag to another
2. unreleased  — Changes since the last tag (for next release)
3. semver      — Analyze commits to determine next version bump
```

---

## Step 0: Detect Version Context

```bash
# Find latest tag
git describe --tags --abbrev=0 2>/dev/null || echo "no tags"

# List recent tags
git tag --sort=-v:refname | head -5

# Count commits since last tag
git rev-list $(git describe --tags --abbrev=0)..HEAD --count
```

---

## Release Notes (`:release`)

### Step 1: Get Commit Range

If `$ARGUMENTS` contains a version → use that tag as boundary:
```bash
git log v1.2.0..v1.3.0 --format="%H %s" --no-merges
```

If no argument → use last two tags:
```bash
git log $(git tag --sort=-v:refname | sed -n '2p')..$(git tag --sort=-v:refname | head -1) --format="%H %s" --no-merges
```

For richer output that includes the short hash for linking:
```bash
git log v1.0.0..v1.1.0 --format="%s (%h)" --no-merges
```

This produces lines like:
```
feat(auth): add OAuth2 PKCE flow (a3f1c2b)
fix(db): fix connection pool exhaustion (9e2d441)
```

### Step 2: Categorize Commits

Parse each commit subject line and categorize:

| Prefix | Category |
|--------|----------|
| `feat:` / `feat(` | Added |
| `fix:` / `fix(` | Fixed |
| `docs:` | Documentation |
| `perf:` | Performance |
| `refactor:` | Changed |
| `BREAKING CHANGE` | Breaking Changes |
| `deprecate` | Deprecated |
| `revert` | Removed |
| `security` / `vuln` | Security |
| Other | Other |

Skip `merge commit` lines, `chore:`, `ci:`, `style:`, `test:` commits — these are internal and not user-facing unless they have visible effects.

### Step 3: Generate Output

```markdown
## [1.3.0] - 2026-03-01

### Breaking Changes
- Removed deprecated `getUser()` endpoint — use `fetchUser()` instead

### Added
- OAuth2 PKCE flow for mobile authentication (#142)
- Rate limiting middleware with configurable thresholds (#156)

### Fixed
- Connection pool exhaustion under high concurrency (#148)
- Timezone handling in scheduled task execution (#151)

### Changed
- Upgrade database driver to v5.0 for connection multiplexing

### Security
- Fix CSRF token validation bypass on preflight requests (#153)
```

### Monorepo Handling

In a monorepo, filter commits by the paths that changed to generate per-package changelogs:

```bash
# Only commits that touched packages/auth/
git log v1.0.0..v1.1.0 --format="%s (%h)" --no-merges -- packages/auth/

# Only commits that touched packages/api/
git log v1.0.0..v1.1.0 --format="%s (%h)" --no-merges -- packages/api/
```

Generate a separate changelog section per package. If a commit touches multiple packages, include it in each relevant package's section with a note.

### Complete Keep-a-Changelog CHANGELOG.md Format

The canonical CHANGELOG.md structure follows [keepachangelog.com](https://keepachangelog.com):

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- (placeholder for next release)

## [1.3.0] - 2026-03-01

### Added
- OAuth2 PKCE flow for secure mobile authentication ([#142](https://github.com/org/repo/pull/142))
- Rate limiting middleware with configurable thresholds ([#156](https://github.com/org/repo/pull/156))

### Changed
- Upgrade database driver to v5.0 for connection multiplexing

### Deprecated
- `getUser()` — will be removed in v2.0.0, use `fetchUser()` instead

### Removed
- (nothing removed this release)

### Fixed
- Connection pool exhaustion under high concurrency ([#148](https://github.com/org/repo/issues/148))
- Timezone handling in scheduled task execution ([#151](https://github.com/org/repo/issues/151))

### Security
- Fix CSRF token validation bypass on preflight requests ([#153](https://github.com/org/repo/pull/153))

## [1.2.3] - 2026-01-15

### Fixed
- Crash on empty response body in retry middleware ([#139](https://github.com/org/repo/issues/139))

[Unreleased]: https://github.com/org/repo/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/org/repo/compare/v1.2.3...v1.3.0
[1.2.3]: https://github.com/org/repo/compare/v1.2.2...v1.2.3
```

Always append comparison links at the bottom of the file for each version.

---

## Unreleased Changes (`:unreleased`)

Same process as `:release` but the range is `<last-tag>..HEAD`.

Output header: `## [Unreleased]`

Include a summary line: "N commits since vX.Y.Z (YYYY-MM-DD)"

### `[Unreleased]` Section Format

```markdown
## [Unreleased]
<!-- 7 commits since v1.3.0 (2026-03-01) -->

### Added
- Dark mode support for dashboard components ([#171](https://github.com/org/repo/pull/171))

### Fixed
- Memory leak in WebSocket connection handler ([#168](https://github.com/org/repo/issues/168))
```

The HTML comment with the commit count is optional but useful for reviewers to know how much is pending.

### Handling Commits That Don't Follow Conventional Format

When commits don't use the `type(scope): description` format, apply best-effort categorization:

| Raw subject line | Categorized as |
|---|---|
| `Add user profile page` | Added |
| `Fix crash when...` / `Bug: ...` | Fixed |
| `Update / Change / Modify...` | Changed |
| `Remove / Delete / Drop...` | Removed |
| `Security patch for...` | Security |
| `Bump lodash from 4.17.20 to 4.17.21` | (skip — dependency bot) |
| `WIP`, `tmp`, `cleanup` | (skip — not user-facing) |
| Everything else | Other |

Group uncategorized commits under `### Other` at the bottom. Flag to the user that these commits don't follow Conventional Commits and suggest adopting the standard.

---

## SemVer Bump Detection (`:semver`)

### Step 1: Analyze Commits Since Last Tag

```bash
git log $(git describe --tags --abbrev=0)..HEAD --format="%s" --no-merges
```

Detect the latest tag using:
```bash
git describe --tags --abbrev=0
```

If no tags exist yet, the next release is `1.0.0` by default (or `0.1.0` for pre-stable projects).

### Step 2: Determine Bump Type

| Condition | Bump | Example Result |
|-----------|------|----------------|
| Any commit contains `BREAKING CHANGE` or `!:` | **MAJOR** | `1.2.3` → `2.0.0` |
| Any `feat:` commit (no breaking changes) | **MINOR** | `1.2.3` → `1.3.0` |
| Only `fix:`, `perf:`, `docs:`, `chore:`, `refactor:` | **PATCH** | `1.2.3` → `1.2.4` |
| Only `ci:`, `test:`, `style:` | **NONE** | `1.2.3` → `1.2.3` |
| No commits since last tag | **NONE** | `1.2.3` → `1.2.3` |

### Pre-Release Version Handling

If the user is preparing a pre-release, append a pre-release identifier:

```
Release candidates:  1.3.0-rc.1, 1.3.0-rc.2
Beta releases:       1.3.0-beta.1, 1.3.0-beta.2
Alpha releases:      1.3.0-alpha.1
```

Pre-release versions sort before the release: `1.3.0-rc.1 < 1.3.0`.

To increment a pre-release:
```bash
# Current: 1.3.0-rc.1 → next: 1.3.0-rc.2
# Current: 1.3.0-rc.2 → promote to: 1.3.0
```

### Step 3: Output Recommendation

```
Current version: 1.2.3
Recommended bump: MINOR → 1.3.0

Reason: 3 feat commits, 5 fix commits, 0 breaking changes
Commits analyzed: 12 (since v1.2.3)

Commits driving the MINOR bump:
  feat(auth): add OAuth2 PKCE flow (a3f1c2b)
  feat(api): add rate limiting middleware (c9d2e11)
  feat(search): add composite index for product search (f4a1b33)
```

---

## Hard Constraints
- Only include commits that exist in git history — never fabricate
- Group by category, not by date or author
- Breaking changes always go first and must be prominently flagged
- If using Conventional Commits, parse the prefix accurately
- If commits don't follow Conventional Commits, do best-effort categorization from the subject line
- Include PR/issue numbers when present in commit messages
- Never include merge commits in the changelog (`--no-merges` is mandatory)
- Never include `ci:`, `chore:`, `style:`, or `test:` commits unless they have a direct user-visible effect
- Always link to the PR or issue number if it appears in the commit message
- Comparison links (`[1.3.0]: https://...`) must be appended at the bottom of CHANGELOG.md
