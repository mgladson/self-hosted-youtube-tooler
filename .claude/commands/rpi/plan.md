---
description: Create comprehensive planning documentation for a feature
argument-hint: "<feature-slug>"
---

## User Input

```text
$ARGUMENTS
```

Parse the user input to extract the feature slug.

**Prerequisites**:
- `rpi/{feature-slug}/research/RESEARCH.md` exists with GO recommendation
- Planning output: `rpi/{feature-slug}/plan/` (4 files)

---

## Purpose

This is **Step 3 of the RPI Workflow** (Describe → Research → **Plan** → Implement).

The planning phase transforms research insights into concrete, implementable documentation.

---

## Planning Phases

### Phase 0: Load Context

1. Verify `rpi/{feature-slug}/research/RESEARCH.md` exists — stop if missing
2. Check GO recommendation — warn (but allow) if NO-GO or CONDITIONAL
3. Load project constitution if present
4. Extract: product analysis, technical discovery, feasibility assessment, risks

### Phase 1: Understand Feature Scope

Using the research report:
- Extract feature name, type, target component(s), complexity
- Identify affected files and integration points
- Search codebase for similar existing features (`Grep`, `Glob`)
- Catalog reusable patterns

### Phase 2: Analyze Technical Requirements

- Review component architecture (existing patterns, naming conventions)
- Map all internal and external dependencies
- Identify API changes (new endpoints, modified contracts)
- Assess database/storage changes needed
- Evaluate technical risks and breaking change potential

### Phase 3: Design Architecture

Invoke the `rpi-senior-engineer` agent to design:
- High-level component/module structure
- Data flow diagrams (ASCII)
- API request/response contracts
- Database schema changes + migration strategy
- Testing strategy (unit / integration / E2E split)
- Feature flag / kill switch plan

### Phase 4: Break Down Implementation

Create 3-5 logical implementation phases where:
- Each phase delivers working, testable functionality
- Phases build progressively on each other
- Tasks have clear complexity estimates (Low / Medium / High)
- Dependencies between tasks are identified
- Parallelization opportunities are noted

### Phase 5: Generate Documentation

Invoke the `rpi-product-manager` agent for `pm.md`.
Invoke the `rpi-senior-engineer` agent for `eng.md`.
Generate all 4 planning documents:

**`rpi/{feature-slug}/plan/pm.md`** — Product Requirements
- Feature description, user stories, acceptance criteria
- Constitutional alignment (if applicable)
- Business value, success metrics, out-of-scope items

**`rpi/{feature-slug}/plan/ux.md`** — User Experience
- User flows and interactions
- UI mockups (text description)
- Accessibility considerations
- Error states and edge cases

**`rpi/{feature-slug}/plan/eng.md`** — Technical Specification
- Architecture design with component diagram (ASCII)
- API specifications (endpoint, request, response, errors)
- Database schema changes
- Technology choices with rationale
- Technical risks and mitigations

**`rpi/{feature-slug}/plan/PLAN.md`** — Implementation Roadmap
```markdown
# Implementation Plan: {feature-name}

## Phase 1: {Phase Name}
**Deliverables:**
- [ ] Task 1 — Complexity: Low — AC: [specific testable condition]
- [ ] Task 2 — Complexity: Medium

**Success Criteria:** [what works at end of this phase]
**Files:** [list of files to modify]

## Phase 2: {Phase Name}
[same structure...]

## Dependencies
[Phase 2 requires Phase 1: X]

## Validation Gates
[User must validate each phase before proceeding]
```

---

### Phase 6: Adversarial Plan Review

Once all 4 documents exist, invoke the `/review-plan` skill on `PLAN.md`:

```
/review-plan rpi/{feature-slug}/plan/PLAN.md
```

`/review-plan` applies four adversarial lenses — Product, Architect, Staff Engineer, Prompt Engineer — and tags every issue Critical / High / Medium / Low.

**Loop rule**: Do not proceed to implementation until the review reports **0 Critical, 0 High, 0 Medium, fewer than 3 Low** findings. For each issue found:
- Revise the relevant plan document(s)
- Re-run `/review-plan` until the gate passes

This step cannot be skipped. A plan that fails review will produce a flawed implementation.

---

## Validation

Before completing, verify all 4 files exist and:
- [ ] `pm.md` covers all acceptance criteria
- [ ] `ux.md` addresses user experience flows
- [ ] `eng.md` provides complete technical specification
- [ ] `PLAN.md` has clear phased breakdown (3-5 phases)
- [ ] No placeholder text in any file
- [ ] All tasks have complexity estimates and acceptance criteria
- [ ] `/review-plan` passed (0C / 0H / 0M / <3L)

---

## Completion

Report:
- Files created: `pm.md`, `ux.md`, `eng.md`, `PLAN.md`
- Total phases: N
- Total tasks: M
- Risk level: Low / Medium / High
- Review-plan result: PASSED (0C / 0H / 0M / NL)
- Next step: `/rpi:implement {feature-slug}`

**After completing**: Recommend `/compact` to free context for implementation.
