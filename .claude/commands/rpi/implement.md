---
description: Execute phased implementation with validation gates
argument-hint: "<feature-slug> [--phase N] [--validate-only]"
---

## User Input

```text
$ARGUMENTS
```

Parse the feature slug and optional flags:
- `--phase N` — execute only phase N
- `--validate-only` — validate current phase without implementing
- `--skip-validation` — skip user validation gate (use with caution)

**Prerequisites**: `rpi/{feature-slug}/plan/PLAN.md` exists.

---

## Purpose

This is **Step 4 of the RPI Workflow** (Describe → Research → Plan → **Implement**).

The implement phase executes the plan with rigorous validation gates at each phase boundary.

**When NOT to use this command:**
- Bug fixes (just fix it directly)
- Changes < 30 minutes of work
- Exploratory prototyping

---

## Phase 0: Load Context

1. Read `rpi/{feature-slug}/plan/PLAN.md` — stop if missing
2. Load project constitution if present (extract technical constraints)
3. Load any component-specific guidelines from README files
4. Map each implementation task to the appropriate files
5. Create `rpi/{feature-slug}/implement/IMPLEMENT.md` to track progress

---

## Implementation Loop

For each phase in PLAN.md, execute these steps:

### Step 1: Code Discovery

Invoke the Explore subagent (`subagent_type="Explore"`) to analyze files affected by this phase:
- How do these files currently work?
- What patterns and naming conventions are used?
- What other files import or use these modules?
- What tests currently cover this code?
- What risks exist if we change this?

### Step 2: Implementation

Invoke the `rpi-senior-engineer` agent with:
- Discovery context from Step 1
- Constitutional constraints
- Phase deliverables from PLAN.md
- Required: write tests, follow existing patterns, handle errors, add logging

### Step 3: Self-Validation

The senior-engineer agent validates:
- All deliverables implemented
- Tests written and passing
- Linting passes
- Build succeeds
- No regressions

### Step 4: Code Review

Invoke the `rpi-code-reviewer` agent to review:
- Spec fidelity (does implementation match eng.md?)
- Test coverage (all paths covered?)
- Security (no new injection points, no credential exposure)
- Regression risk (no breaking changes to existing contracts)

Verdict: APPROVED / APPROVED WITH SUGGESTIONS / NEEDS REVISION

If NEEDS REVISION: fix issues, re-run Steps 2-4.

### Step 5: User Validation Gate ⛔ REQUIRED

**STOP and present to user:**

```
## Phase N Validation Request: {phase-name}

### Deliverables Completed
- [x] Task 1 — [implementation summary]
- [x] Task 2 — [implementation summary]

### Files Changed
| File | Change | Lines |
|------|--------|-------|
| [file] | [add/modify] | [±N] |

### Tests: PASS | FAIL
### Build: SUCCESS | FAILED
### Code Review: APPROVED / APPROVED WITH SUGGESTIONS

### Success Criteria (from PLAN.md)
- [ ] [Criterion 1]
- [ ] [Criterion 2]

Please validate: PASS / CONDITIONAL PASS / FAIL
```

- **PASS**: Update PLAN.md phase status, proceed to next phase
- **CONDITIONAL PASS**: Document issues, proceed with caveats
- **FAIL**: Fix issues, re-run Steps 2-5

### Step 6: Documentation Update

Update `PLAN.md` phase status (`[ ]` → `[x]`) and append to `IMPLEMENT.md`.

---

## Error Handling

- **Implementation fails**: Retry once with alternative approach; if still failing, STOP and ask user
- **Tests fail**: Fix or document; do NOT proceed with failing tests
- **Build fails**: Fix before proceeding
- **Agent fails**: Retry once; if still failing, proceed and document gap

---

## Completion Report

```markdown
## Implementation Complete: {feature-name}

### Phases: N of N complete
### Files Modified: [list]
### Tests Added: [list]

### Phase Summary
| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | ✅ PASS | [summary] |
| Phase 2 | ✅ PASS | [summary] |

### Next Steps
1. Create PR with changes
2. Deploy to staging
3. Validate in staging
4. Deploy to production
```

**After completing**: Recommend `/compact` to free context for the next task.
