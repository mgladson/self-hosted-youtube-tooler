---
description: Research and analyze feature viability — GO/NO-GO decision gate
argument-hint: "<feature-slug>"
---

## User Input

```text
$ARGUMENTS
```

Parse the user input to extract the feature slug.

**Input Format**: Feature slug (e.g., `user-auth`, `payment-flow`)
**Prerequisite**: Create `rpi/{feature-slug}/REQUEST.md` first with the feature description.
**Output**: `rpi/{feature-slug}/research/RESEARCH.md`

---

## Purpose

This is **Step 2 of the RPI Workflow** (Describe → **Research** → Plan → Implement).

The research phase is a critical GO/NO-GO gate. It assesses viability before any implementation effort is spent.

**Key Questions to Answer:**
- Does this feature deliver real user value?
- Is it technically feasible given the codebase?
- What are the risks and how do we mitigate them?
- Build, buy, partner, or decline?

---

## Research Phases

### Phase 0: Load Context

1. Read `rpi/{feature-slug}/REQUEST.md` — if missing, stop and tell user
2. Check for project constitution (`constitution.md`, `PRINCIPLES.md`, `.project/constitution.md`)
3. Synthesize feature description and constraints

### Phase 1: Parse Requirements

Invoke the `rpi-requirement-parser` agent with the feature description.

Extract:
- Feature name, type, target component, complexity estimate
- Functional and non-functional requirements
- Constraints, assumptions, clarifying questions

**If critical questions exist → STOP and ask user before proceeding.**

### Phase 2: Product Analysis

Invoke the `rpi-product-manager` agent with parsed requirements + constitution context.

Assess:
- User value (who benefits, how much?)
- Strategic alignment (does this fit the product vision?)
- Viability score: High / Medium / Low

### Phase 2.5: Technical Discovery (CRITICAL)

Invoke the Explore subagent via Task tool (`subagent_type="Explore"`) to deeply analyze:
- What code already exists for this functionality?
- What integration points would this feature touch?
- What can be reused vs. rebuilt?
- What technical constraints exist in the current code?

### Phase 3: Technical Feasibility

Invoke the `rpi-senior-engineer` agent with requirements + product context + discovery results.

Assess:
- Technical feasibility: High / Medium / Low
- Recommended implementation approach
- Complexity estimate
- Technical risks and mitigations

### Phase 4: Strategic Assessment

Invoke the `rpi-technical-advisor` agent with all previous outputs.

Provide:
- **GO / CONDITIONAL GO / DEFER / NO-GO** recommendation
- Strategic rationale (2-3 sentences)
- If GO: recommended approach and key risks to monitor
- If CONDITIONAL GO: specific conditions to meet first

### Phase 5: Generate Research Report

Save `rpi/{feature-slug}/research/RESEARCH.md` with:

```markdown
# Research Report: {feature-name}

## Recommendation: [GO / CONDITIONAL GO / DEFER / NO-GO]
**Confidence**: [High / Medium / Low]
**Rationale**: [Key reasons for recommendation]

## Feature Overview
- **Name**: {feature-name}
- **Type**: {type}
- **Target Component**: {component}
- **Complexity**: {Simple / Medium / Complex}

## Product Analysis
- **User Value**: [High/Medium/Low] — [why]
- **Strategic Alignment**: [assessment]
- **Viability Score**: [High/Medium/Low]

## Technical Discovery
- **Existing Code**: [what already exists]
- **Reusable Components**: [what can be leveraged]
- **Integration Points**: [what will be touched]
- **Technical Constraints**: [real constraints from code]

## Technical Assessment
- **Feasibility**: [High/Medium/Low]
- **Recommended Approach**: [approach]
- **Effort Estimate**: [Simple/Medium/Complex]
- **Key Risks**: [top 3 risks with mitigations]

## Next Steps
[If GO: proceed to /rpi:plan {feature-slug}]
[If CONDITIONAL GO: meet conditions X, Y then re-evaluate]
[If DEFER: revisit when {trigger}]
[If NO-GO: consider alternative {alternative}]
```

---

## Completion

Report:
- Decision: GO / CONDITIONAL GO / DEFER / NO-GO
- Confidence: High / Medium / Low
- Report location: `rpi/{feature-slug}/research/RESEARCH.md`
- Next step: `/rpi:plan {feature-slug}` (if GO)

**After completing**: Recommend `/compact` to free context for the planning phase.
