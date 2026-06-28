---
name: release-prep
description: "Release preparation workflows: pre-release checklists, version bumping across multiple files, release notes generation, and rollback plan creation. Sub-commands: /release-prep:checklist, :version-bump, :notes, :rollback-plan. Use when preparing releases, bumping versions, or planning deployments."
---

# Release Preparation

You are executing the `/release-prep` skill. You prepare releases with checklists, version management, and rollback planning.

Parse the sub-command from the user's invocation:
- `/release-prep` → show **menu** and wait for selection
- `/release-prep:checklist` → **Pre-Release Checklist**
- `/release-prep:version-bump` → **Version Bump**
- `/release-prep:notes` → **Release Notes**
- `/release-prep:rollback-plan` → **Rollback Plan**

---

## Menu (no sub-command)

```
Release Preparation — Choose a task:

1. checklist     — Generate pre-release verification checklist
2. version-bump  — Update version across all project files
3. notes         — Generate release notes from commits
4. rollback-plan — Create rollback procedure for the release
```

---

## Pre-Release Checklist (`:checklist`)

### Step 1: Detect Project Type

Glob for version files to determine project type:
- `package.json` → Node.js
- `pyproject.toml` / `setup.py` → Python
- `Cargo.toml` → Rust
- `pom.xml` / `build.gradle` → Java
- `*.csproj` → .NET

### Step 2: Generate Checklist

```markdown
## Pre-Release Checklist — v{VERSION}

### Code Quality
- [ ] All tests passing (`npm test` / `pytest` / `cargo test`)
- [ ] No lint warnings (`npm run lint` / `ruff check` / `cargo clippy`)
- [ ] Type checking passes (`tsc --noEmit` / `mypy` / `cargo check`)
- [ ] Security audit clean (`npm audit` / `pip-audit` / `cargo audit`)

### Version & Changelog
- [ ] Version bumped in all files (see `/release-prep:version-bump`)
- [ ] CHANGELOG.md updated with release notes
- [ ] Migration guide written (if breaking changes)

### Dependencies
- [ ] All dependencies pinned to exact versions
- [ ] No known vulnerable dependencies
- [ ] License compliance verified

### Documentation
- [ ] README reflects new features/changes
- [ ] API documentation updated (if applicable)
- [ ] Configuration changes documented

### Deployment
- [ ] Database migrations reviewed and tested
- [ ] Environment variables documented
- [ ] Rollback plan prepared (see `/release-prep:rollback-plan`)
- [ ] Monitoring alerts configured for new features

### Final Steps
- [ ] Create git tag: `git tag -a v{VERSION} -m "Release v{VERSION}"`
- [ ] Push tag: `git push origin v{VERSION}`
- [ ] Create GitHub release with notes
```

### Extended Checklist Items

**Security and Dependencies:**
- [ ] Dependency audit clean — run `npm audit --audit-level=critical` / `pip-audit` / `cargo audit`. No critical CVEs may be present at release time. High-severity findings must be reviewed and either patched or have a documented exception.
- [ ] Transitive dependency licenses reviewed — no GPL/AGPL licenses in production dependencies unless legally approved.

**CI and Branch Health:**
- [ ] All CI checks passing on the release branch — not just main. Check: `gh run list --branch release/v{VERSION} --limit 10`.
- [ ] No failing checks on the release PR. If a check is flaky, re-run it before proceeding; do not override a failing gate.
- [ ] Code coverage has not regressed below the project threshold.

**Documentation:**
- [ ] CHANGELOG.md entry finalized and reviewed.
- [ ] README version badge updated (if the README displays the current version).
- [ ] Migration guide written and linked from CHANGELOG.md for any breaking changes.
- [ ] API reference docs regenerated from source if auto-generated.

**Infrastructure and Data:**
- [ ] Database migrations tested against a production data snapshot — not just an empty schema.
- [ ] Migration is reversible — `down` migration verified on the snapshot.
- [ ] If migration is irreversible (DROP COLUMN / DROP TABLE), this is documented explicitly in the rollback plan.

**Feature Flags and Configuration:**
- [ ] Any new feature flags are documented: name, default value, expected activation date.
- [ ] New required environment variables are listed in `.env.example` and deployment runbooks.
- [ ] Feature flags for this release are set to the correct state in each environment (staging → enabled, production → disabled until gradual rollout).

---

## Version Bump (`:version-bump`)

### Step 1: Detect Current Version

Search for version declarations:
```bash
grep -r "version" package.json pyproject.toml Cargo.toml pom.xml *.csproj 2>/dev/null
```

### Step 2: Determine New Version

If `$ARGUMENTS` contains a version → use that version.
Otherwise, analyze commits since last tag (like `/changelog-gen:semver`) and recommend.

### Step 3: Update All Version Files

Update version in every file that declares it:
- `package.json` → `"version": "X.Y.Z"`
- `package-lock.json` → same
- `pyproject.toml` → `version = "X.Y.Z"`
- `Cargo.toml` → `version = "X.Y.Z"`
- `Cargo.lock` → (run `cargo update` to sync)
- `pom.xml` → `<version>X.Y.Z</version>`
- `*.csproj` → `<Version>X.Y.Z</Version>`
- `version.py` / `__version__` / `VERSION` file → if present

### Docker Image Tag

If a `Dockerfile` or `docker-compose.yml` references the image version, update it too:

```yaml
# docker-compose.yml — before
image: myorg/myapp:1.2.2

# docker-compose.yml — after
image: myorg/myapp:1.2.3
```

If the Dockerfile uses a build argument for the version:
```dockerfile
ARG APP_VERSION=1.2.2
```
Update the `ARG` default and also update any `docker build` commands in CI scripts.

### Version Consistency Check

After updating all files, verify they all agree:

```bash
# Node.js
node -p "require('./package.json').version"

# Python
python -c "import tomllib; print(tomllib.load(open('pyproject.toml','rb'))['project']['version'])"

# Rust
grep '^version' Cargo.toml | head -1

# Java
mvn help:evaluate -Dexpression=project.version -q -DforceStdout
```

All commands must return the same version string. If any disagrees, find and fix the discrepancy before proceeding.

### Tag Creation

After updating version files and committing:

```bash
# Annotated tag (preferred — contains metadata and is GPG-signable)
git tag -a v1.2.3 -m "Release v1.2.3"

# Signed annotated tag (use when GPG signing is configured)
git tag -s v1.2.3 -m "Release v1.2.3"

# Verify the tag
git show v1.2.3

# Push the tag
git push origin v1.2.3
```

Never use lightweight tags (`git tag v1.2.3`) for releases — annotated tags record the tagger, date, and message, which is required for audit trails.

### Step 4: Report Changes

List all files updated with old → new version.

---

## Release Notes (`:notes`)

Delegates to `/changelog-gen:release` if available. Otherwise:

1. Get commits since last tag
2. Categorize by type (features, fixes, breaking changes)
3. Format as markdown release notes
4. Include contributor acknowledgments from git log authors

### Complete Release Notes Template

```markdown
# Release v1.3.0

Released: 2026-03-01

## Highlights

This release adds OAuth2 PKCE support for mobile clients and resolves
the connection pool exhaustion issue that caused intermittent 503 errors
under load. Rate limiting is now configurable per API key.

## Breaking Changes

- **`getUser()` removed** — use `fetchUser()` instead. The function signature
  is identical; only the name has changed. Run the provided codemod:
  `node scripts/migrate-getuser.js --dir src/`

## New Features

- **OAuth2 PKCE flow** — mobile clients can now authenticate without
  storing a client secret. See `docs/auth.md` in the repository for setup. (#142)
- **Configurable rate limiting** — set `RATE_LIMIT_PER_KEY` env var or
  configure per-key limits via the admin panel. Default: 100 req/min. (#156)

## Bug Fixes

- Fixed connection pool exhaustion under concurrent load. Default pool
  size increased from 5 to 20; acquisition timeout added (30s → 503). (#148)
- Fixed timezone handling in scheduled task execution. (#151)

## Security

- Fixed CSRF token validation bypass on preflight OPTIONS requests. (#153)
  All users are encouraged to upgrade immediately.

## Performance

- Product search P99 latency reduced from 4.2s to 85ms via composite
  index on `products(category_id, name)`. (#199)

## Migration Steps

1. Replace `getUser(id)` → `fetchUser(id)` (codemod available)
2. Set `DB_POOL_MAX=20` in production environment config
3. Review rate limiting configuration in admin panel

## Contributors

Thanks to everyone who contributed to this release:
@alice, @bob, @carol

**Full Changelog:** https://github.com/org/repo/compare/v1.2.3...v1.3.0
```

### GitHub Release Creation

After generating release notes, create the GitHub release:

```bash
# Write notes to a temp file first
cat > /tmp/RELEASE_NOTES.md << 'EOF'
(paste generated release notes here)
EOF

# Create the release from the tag
gh release create v1.3.0 \
  --title "v1.3.0" \
  --notes-file /tmp/RELEASE_NOTES.md \
  --verify-tag

# If attaching build artifacts (e.g., binaries, dist zips)
gh release create v1.3.0 \
  --title "v1.3.0" \
  --notes-file /tmp/RELEASE_NOTES.md \
  dist/myapp-linux-amd64 \
  dist/myapp-darwin-arm64 \
  dist/myapp-windows-amd64.exe
```

The `--verify-tag` flag ensures the tag exists before creating the release.

---

## Rollback Plan (`:rollback-plan`)

### Step 1: Analyze Release Scope

1. List all changes since last release (files, migrations, config changes)
2. Identify reversible vs irreversible changes
3. Determine rollback strategy

### Step 2: Generate Plan

```markdown
## Rollback Plan — v{VERSION} → v{PREV_VERSION}

### Rollback Strategy: Blue-Green / Rolling / Immediate

### Steps

1. **Stop deployment pipeline** — prevent further rollouts
2. **Revert application code:**
   ```bash
   git revert v{VERSION}..HEAD
   # OR
   kubectl rollout undo deployment/myapp
   # OR
   docker service update --rollback myapp
   ```

3. **Database rollback** (if migrations were applied):
   ```bash
   alembic downgrade -1
   # OR
   npx knex migrate:rollback
   ```
   WARNING: Data-destructive migrations (DROP COLUMN, DROP TABLE)
   cannot be fully rolled back. Review migration files.

4. **Configuration rollback:**
   - Revert environment variable changes
   - Restore previous feature flag states

5. **Verification:**
   - [ ] Health check endpoints returning 200
   - [ ] Error rate below baseline
   - [ ] Key user flows functional (login, checkout, etc.)
   - [ ] No data integrity issues

### Irreversible Changes
[List any changes that cannot be rolled back and require manual intervention]

### Communication
- [ ] Notify stakeholders of rollback
- [ ] Update status page
- [ ] Create incident postmortem
```

### Verification Steps After Rollback

After completing the rollback, execute all of these checks before declaring the rollback successful:

```bash
# 1. Health check
curl -sf https://api.example.com/health | jq .status
# Expected: "ok"

# 2. Version endpoint (confirms correct version is running)
curl -sf https://api.example.com/version | jq .version
# Expected: "{PREV_VERSION}"

# 3. Error rate — check last 5 minutes in your APM/logging tool
# Expected: below pre-release baseline

# 4. Smoke test critical paths
npm run test:smoke -- --env production
# or equivalent for the project's stack
```

Also verify:
- [ ] No elevated error rate in Sentry / Datadog / CloudWatch
- [ ] Database connection pool healthy (`/metrics` or DB admin panel)
- [ ] No stuck background jobs or queues
- [ ] CDN/cache invalidated if static assets changed

### Database Rollback Procedure

```bash
# Step 1: Identify current migration version
alembic current          # SQLAlchemy/Alembic
npx knex migrate:list    # Knex
flyway info              # Flyway

# Step 2: Run down migration
alembic downgrade -1     # roll back one migration
# OR target a specific revision:
alembic downgrade abc123def456

# Step 3: Verify schema matches previous version
# Compare table structure against the schema snapshot from v{PREV_VERSION}
pg_dump --schema-only mydb > /tmp/post-rollback-schema.sql
diff /tmp/pre-release-schema.sql /tmp/post-rollback-schema.sql
# Expected: no diff (schemas identical)

# Step 4: Spot-check data integrity
psql mydb -c "SELECT COUNT(*) FROM users;"
psql mydb -c "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 hour';"
```

If the migration was destructive (e.g., dropped a column), data recovery requires restoring from the pre-release backup snapshot. Document the backup location in the rollback plan before every release.

### Stakeholder Communication Template

Use this template for all rollback communications:

```
Subject: [ACTION REQUIRED] Production Rollback in Progress — v1.3.0 → v1.2.3

Team,

We are rolling back the v1.3.0 production deployment due to [brief description
of the issue, e.g., "elevated 503 error rate on the /reports endpoint"].

Current status: [In Progress / Complete]
Affected service: [service name]
Impact: [number of users affected, or "no confirmed user impact"]
Started at: [HH:MM UTC]
ETA to resolution: [HH:MM UTC or "under investigation"]

Next update: [time, e.g., "in 30 minutes or when rollback is complete"]

Incident channel: #incident-2026-03-01
Runbook: [link]

— [On-call engineer name]
```

Send the initial message when the rollback starts. Send a follow-up when it completes with:
- Confirmed version now running
- Brief root cause summary
- Link to the postmortem (to be written)

---

## Hard Constraints
- Never auto-tag or auto-push without explicit user approval
- Version bumps must update ALL files that declare the version
- Rollback plans must flag irreversible changes (data migrations)
- Checklists should be project-type-specific, not generic
