---
name: issue-fixer
description: "GitHub issue management: triage issues with severity/effort classification, auto-fix bugs from issue descriptions, and create reproduction test cases. Sub-commands: /issue-fixer:triage, :fix, :reproduce. Use when working with GitHub issues, triaging bugs, or attempting automated fixes."
---

# Issue Fixer

You are executing the `/issue-fixer` skill. You manage GitHub issues — triaging, fixing, and reproducing reported bugs.

Parse the sub-command from the user's invocation:
- `/issue-fixer` → show **menu** and wait for selection
- `/issue-fixer:triage` → **Triage** (classify, label, estimate)
- `/issue-fixer:fix` → **Auto-Fix** (attempt fix from issue description)
- `/issue-fixer:reproduce` → **Reproduce** (create reproduction test)

---

## Menu (no sub-command)

```
Issue Fixer — Choose a mode:

1. triage    — Classify severity, estimate effort, suggest labels
2. fix       — Attempt automated fix from issue description
3. reproduce — Create a minimal reproduction test case
```

---

## Triage (`:triage`)

### Step 1: Load Issue

If `$ARGUMENTS` contains a number → `gh issue view <number> --json title,body,labels,comments`

If no argument → `gh issue list --state open --limit 10` and present for selection.

### Step 2: Classify

Analyze issue title, body, and comments to determine:

**Severity Matrix (Impact × Likelihood):**

|  | Low Likelihood | Medium Likelihood | High Likelihood |
|---|---|---|---|
| **High Impact** | P1 — High | P0 — Critical | P0 — Critical |
| **Medium Impact** | P2 — Medium | P2 — Medium | P1 — High |
| **Low Impact** | P3 — Low | P3 — Low | P2 — Medium |

Severity definitions:

| Severity | Criteria |
|----------|----------|
| P0 — Critical | Data loss, security vulnerability, complete service outage |
| P1 — High | Major feature broken, significant user impact, no workaround |
| P2 — Medium | Feature degraded, workaround exists, moderate user impact |
| P3 — Low | Minor inconvenience, cosmetic, edge case |

**GitHub Label Suggestions per Severity:**

| Severity | Suggested Labels |
|---|---|
| P0 — Critical | `priority: critical`, `bug`, `incident` |
| P1 — High | `priority: high`, `bug` |
| P2 — Medium | `priority: medium`, `bug` or `enhancement` |
| P3 — Low | `priority: low`, `good first issue` |

Add domain labels based on the affected area: `backend`, `frontend`, `database`, `auth`, `api`, `ci/cd`, `docs`.

**Effort Estimation:**

| Effort | Hours | Criteria |
|--------|-------|----------|
| XS | < 1 h | Typo, config change, one-liner fix, clear root cause |
| S | 1–4 h | Single file fix, clear root cause, minimal testing needed |
| M | 4–16 h | Multi-file change, needs investigation, moderate test coverage |
| L | 16–40 h | Significant refactoring, new subsystem, cross-file changes |
| XL | > 40 h | Architectural change, cross-team coordination, multiple milestones |

**Dependency Check:**

Before completing triage, check whether this issue blocks others:
```bash
# Search for references to this issue number in open issues
gh issue list --state open --search "#<number>"
```

Note any issues that cannot progress until this one is resolved. Mark with label `blocker` if applicable.

### Step 3: Output

```markdown
## Issue Triage: #123 — Title

**Severity:** P2 — Medium
**Effort:** S — Small (1-4 hours)
**Category:** Bug — Runtime Error
**Labels:** `bug`, `backend`, `database`

**Root Cause Hypothesis:**
Connection pool exhaustion under concurrent requests. The pool size
is set to 5 but the endpoint spawns up to 10 concurrent DB queries.

**Suggested Fix Direction:**
Increase pool size or add connection queuing with timeout.

**Blocked By:** Nothing
**Blocks:** #127 (dependent on stable DB connections)
**Related Issues:** #118 (similar timeout reports)
```

---

## Auto-Fix (`:fix`)

### Step 1: Understand the Bug

1. Read the issue description and all comments
2. Extract: expected behavior, actual behavior, reproduction steps
3. Search codebase for related code using Grep and Glob

### Step 2: Root Cause Analysis

1. Trace the code path described in the issue
2. Identify the likely root cause
3. Present hypothesis to user before proceeding

### Step 3: Implement Fix

1. Write the fix following existing code patterns
2. Add a regression test that would have caught this bug
3. Verify the fix addresses the issue description

### Step 4: Fix Workflow (Step-by-Step)

```
1. Read issue → extract expected vs actual behavior
2. Find or write a failing test that reproduces the bug
3. Trace the code path: entry point → handler → root cause
4. Implement the minimal fix (avoid over-engineering)
5. Run the reproduction test — it must now pass
6. Run the full test suite — no regressions allowed
7. Propose the PR
```

### Step 5: Fix Proposal Format

Present the fix to the user in this structure:

```markdown
## Fix Proposal: #148 — Connection pool exhaustion under concurrent load

### Root Cause
The `/reports` endpoint spawns up to 10 parallel DB queries but the
connection pool was configured with `max: 5`. Under moderate traffic,
requests blocked indefinitely on pool acquisition.

### Changes
- `src/db/pool.js` — increase default `max` from 5 to 20
- `src/api/reports.js` — add 30s acquisition timeout, return 503 on timeout
- `src/config/defaults.js` — expose `DB_POOL_MAX` as configurable env var

### Tests Added
- `tests/db/pool.test.js` — test concurrent acquisition beyond old limit
- `tests/api/reports.test.js` — test 503 response when pool is saturated

### Verification Steps
1. Run `npm test` — all tests pass including new regression tests
2. Run load test: `k6 run tests/load/reports.js` — no timeouts at 50 VUs
3. Check pool metrics in `/metrics` endpoint under load

### Suggested Commit
fix(db): increase connection pool size and add acquisition timeout (closes #148)
```

---

## Reproduce (`:reproduce`)

### Step 1: Extract Reproduction Steps

From the issue body, extract:
- Input data or conditions that trigger the bug
- Expected vs actual behavior
- Environment details if relevant

### Step 2: Create Test Case

Write a minimal test that:
- Sets up the conditions described in the issue
- Triggers the reported behavior
- Asserts the EXPECTED behavior (test should FAIL against current code)
- Uses the project's existing test framework and patterns

### Step 3: Reproduction Test Examples

**pytest (Python):**
```python
# tests/test_issue_148.py
"""Reproduction test for #148 — connection pool exhaustion."""
import asyncio
import pytest
from src.db.pool import get_connection


@pytest.mark.asyncio
async def test_concurrent_connections_do_not_deadlock():
    """10 concurrent acquisitions should not deadlock with pool size 5."""
    async def acquire_and_release():
        async with get_connection() as conn:
            await asyncio.sleep(0.1)  # simulate query time

    # Should complete without TimeoutError
    await asyncio.gather(*[acquire_and_release() for _ in range(10)])
```

**Jest (JavaScript/TypeScript):**
```typescript
// tests/db/pool.test.ts
// Reproduction test for #148 — connection pool exhaustion
import { getConnection } from '../../src/db/pool';

describe('connection pool — issue #148', () => {
  it('handles 10 concurrent acquisitions without deadlock', async () => {
    const acquireAndRelease = async () => {
      const conn = await getConnection();
      await new Promise(r => setTimeout(r, 100)); // simulate query
      conn.release();
    };

    // Must resolve within 5 seconds — not hang indefinitely
    await expect(
      Promise.all(Array.from({ length: 10 }, acquireAndRelease))
    ).resolves.toBeDefined();
  }, 5000);
});
```

**Go test:**
```go
// db/pool_test.go — reproduction test for issue #148
package db_test

import (
    "sync"
    "testing"
    "time"

    "github.com/org/repo/db"
)

// TestConcurrentPoolAcquisition_Issue148 verifies that 10 concurrent
// acquisitions do not deadlock when pool size was previously 5.
func TestConcurrentPoolAcquisition_Issue148(t *testing.T) {
    pool := db.NewPool(db.Config{Max: 5}) // old config — should fail
    var wg sync.WaitGroup
    errs := make(chan error, 10)

    for i := 0; i < 10; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            conn, err := pool.Acquire()
            if err != nil {
                errs <- err
                return
            }
            time.Sleep(100 * time.Millisecond)
            conn.Release()
        }()
    }

    wg.Wait()
    close(errs)
    for err := range errs {
        t.Errorf("unexpected error: %v", err)
    }
}
```

### Step 4: Bisect Approach

If the regression is unclear, use `git bisect` to find the introducing commit:

```bash
git bisect start
git bisect bad                   # current HEAD is broken
git bisect good v1.2.3           # last known good release

# Git checks out midpoint commits automatically.
# For each commit, run the reproduction test:
npm test tests/db/pool.test.ts
# → if test passes: git bisect good
# → if test fails:  git bisect bad

git bisect reset                 # return to HEAD when done
```

`git bisect` performs a binary search and typically finds the culprit in `log2(N)` steps.

### Step 5: Output

```
Created reproduction test: tests/test_issue_123.py

Test result: FAIL (confirms the bug exists)
Error: AssertionError: Expected 200 but got 500

This test will pass once the fix is implemented.
```

---

## Hard Constraints
- Always read the full issue before attempting any action
- Never close or modify issues without explicit user approval
- For `:fix`, always present the hypothesis before writing code
- Reproduction tests must FAIL against current code (proving the bug exists)
- Include the issue number in commit messages and test names
- Never close an issue without a regression test that would have caught the bug — closing without a test leaves the door open for the same bug to return silently
- Always link the fix PR to the issue using `Fixes #N` or `Closes #N` in the PR description or commit message — this ensures the issue auto-closes on merge and creates a permanent audit trail
