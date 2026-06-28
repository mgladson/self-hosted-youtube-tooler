---
name: agent-teams-coordination
description: "Structured multi-agent team coordination with defined roles: Team Lead (orchestrator), Implementers (parallel workers), Reviewers, and Debuggers. Commands: /agent-teams-coordination:spawn, :delegate, :status, :shutdown, :review-cycle. Complements /agent-teams with role-based team structure and communication protocols."
---

# Agent Teams Coordination

You are executing the `/agent-teams-coordination` skill. You orchestrate structured multi-agent teams with clearly defined roles: a **Team Lead** that coordinates, **Implementers** that execute in parallel, **Reviewers** that validate, and **Debuggers** that diagnose.

> **Relationship to `/agent-teams`:** The `/agent-teams` skill provides preset team patterns (review, debug, feature, research, security). This skill provides the **underlying coordination protocols** — how to compose teams from roles, delegate work, track state, and coordinate handoffs. Use together for maximum effectiveness.

Parse the sub-command from the user's invocation:
- `/agent-teams-coordination` → show **menu** and describe team role model
- `/agent-teams-coordination:spawn` → **Spawn a Coordinated Team**
- `/agent-teams-coordination:delegate` → **Delegate Work to Agents**
- `/agent-teams-coordination:status` → **Get Team Status**
- `/agent-teams-coordination:review-cycle` → **Implement → Review → Revise Cycle**
- `/agent-teams-coordination:shutdown` → **Gracefully Shut Down Team**

---

## Menu (no sub-command)

Present the team role model:

```
Agent Teams Coordination — Role Model:

TEAM LEAD (you — the orchestrator)
├── IMPLEMENTERS (parallel Task agents — execute work)
│   ├── Implementer-1: owns file group A
│   ├── Implementer-2: owns file group B
│   └── Implementer-N: owns file group N
├── REVIEWERS (sequential Task agents — validate work)
│   ├── Reviewer-1: correctness + tests
│   └── Reviewer-2: security + architecture
└── DEBUGGERS (spawned on demand)
    └── Debugger: hypothesis-driven root cause analysis

Commands:
1. spawn         — Spawn a team for a specific task
2. delegate      — Assign work to implementers with file ownership
3. status        — Get status from all active agents
4. review-cycle  — Run implement → review → revise until approved
5. shutdown      — Collect results and shut down team
```

---

## Spawn a Coordinated Team (`:spawn`)

### Step 1: Decompose the Task

Ask the user: "Describe the task. I'll decompose it into parallel work packages."

Then:
1. Identify independent work units (files, features, modules) that can proceed in parallel
2. Determine which roles are needed (implementers only, or also reviewers?)
3. Assign file ownership to prevent conflicts

**Work decomposition template:**

```
Task: [description]

Work packages (parallel):
- Package A: [files/modules] → Implementer-1
- Package B: [files/modules] → Implementer-2
- Package C: [files/modules] → Implementer-3

Sequential phase:
- Review: Reviewer-1 validates all packages
- Integration: Team Lead assembles and tests
```

### Step 2: Define Agent Roles

**Team Lead (orchestrator — you):**
- Owns the plan and final integration
- Spawns and monitors all other agents via Task tool
- Resolves conflicts between implementers
- Makes architectural decisions
- Reports progress to user

**Implementer (Task agent):**
- Owns a specific set of files exclusively
- Never modifies files owned by another implementer
- Reports completion with: files changed, tests status, blockers
- Asks Team Lead for decisions, doesn't make them

**Reviewer (Task agent):**
- Reviews output from one or more implementers
- Checks: correctness, tests, security, style
- Produces: list of issues with severity (Critical/High/Medium/Low)
- Does NOT modify files — only reports

**Debugger (Task agent — spawned on demand):**
- Given a specific bug or failing test
- Generates 3+ hypotheses before touching code
- Reports root cause + fix recommendation to Team Lead

---

## Delegate Work to Agents (`:delegate`)

### Delegation Protocol

When spawning implementers via Task tool, always provide:

```
Task for Implementer-[N]:

OWNERSHIP: You own these files exclusively — do not modify other files:
- [path/to/file1.py]
- [path/to/file2.py]

OBJECTIVE: [specific, measurable outcome]

CONTEXT:
- Related files (read-only): [paths]
- Interfaces to implement: [function signatures / API contracts]
- Tests that must pass: [test file paths or test commands]

CONSTRAINTS:
- Do not add new dependencies without asking Team Lead
- Match existing code style in the file
- Write tests for any new logic

REPORT BACK:
When done, reply with:
1. FILES MODIFIED: [list]
2. TESTS: [pass/fail + command used]
3. BLOCKERS: [anything blocking completion]
4. TIME ESTIMATE: [if blocked, how long to unblock]
```

### Parallel Delegation Pattern

Spawn all implementers simultaneously (one Task call per agent):

```python
# Conceptual — actual Task tool calls run in parallel
Task("Implementer-1", prompt=DELEGATE_TEMPLATE.format(files=["src/auth.py"]))
Task("Implementer-2", prompt=DELEGATE_TEMPLATE.format(files=["src/payments.py"]))
Task("Implementer-3", prompt=DELEGATE_TEMPLATE.format(files=["tests/test_auth.py"]))
```

Wait for all to complete before proceeding to review phase.

---

## Get Team Status (`:status`)

### Status Check Protocol

When you need a status update from active agents, send each agent a brief status request:

```
STATUS CHECK — Please reply with:
1. CURRENT STATE: [working on / blocked on / completed]
2. FILES MODIFIED SO FAR: [list]
3. TESTS: [passing / failing / not yet run]
4. BLOCKERS: [describe or "none"]
5. ETA: [if not complete, estimated completion]
```

### Status Aggregation

After collecting status from all agents, produce a summary for the user:

```
Team Status — [timestamp]

✓ Implementer-1: COMPLETE — auth.py (12 tests passing)
⚠ Implementer-2: BLOCKED — payments.py — needs Stripe API key for test environment
⟳ Implementer-3: IN PROGRESS — test_auth.py (ETA: ~5 min)

Actions needed:
- Provide Stripe test API key to unblock Implementer-2
```

---

## Implement → Review → Revise Cycle (`:review-cycle`)

### Full Cycle Protocol

This implements a red-green-refactor style quality loop for agent teams.

**Phase 1: Implement (parallel)**

Spawn all implementers simultaneously. Wait for completion signals.

**Phase 2: Review (parallel reviewers)**

After all implementers report complete, spawn reviewers:

```
Task for Reviewer-[N]:

REVIEW SCOPE: [files to review]

Review for:
1. CORRECTNESS — Does it match the spec? Edge cases handled?
2. TESTS — Are tests meaningful? Coverage gaps?
3. SECURITY — Auth, input validation, secrets exposure?
4. CODE QUALITY — Naming, complexity, duplication?

OUTPUT FORMAT for each issue:
[CRITICAL/HIGH/MEDIUM/LOW] [Category] — [file:line] — [description]

Remediation: [specific fix]
```

**Phase 3: Triage**

Team Lead receives review output. Apply escalation rules:
- **CRITICAL/HIGH**: Must fix before proceeding → spawn targeted fixers
- **MEDIUM**: Fix if < 30min effort → assign to original implementer
- **LOW**: Log for follow-up → proceed without blocking

**Phase 4: Revise**

For each CRITICAL/HIGH issue:
```
Task for Implementer-[N] (revision):

ISSUES TO FIX:
[paste issues from reviewer]

CONSTRAINT: Only modify the flagged lines. Do not refactor surrounding code.
```

**Phase 5: Re-review**

Spawn reviewer again for changed files only. Repeat until 0 CRITICAL, 0 HIGH.

---

## Gracefully Shut Down Team (`:shutdown`)

### Shutdown Protocol

When work is complete, collect final artifacts from all agents:

```
SHUTDOWN REQUEST — Please provide your final report:

1. DELIVERABLES: List of files you modified with brief description of changes
2. TESTS: Final test results (pass/fail count + command)
3. KNOWN ISSUES: Anything not completed or not working
4. HANDOFF NOTES: What the Team Lead needs to know for integration
```

### Integration Step

After collecting all agent reports:
1. Run the full test suite to verify integration
2. Review any file ownership conflicts (files touched by multiple agents)
3. Produce a consolidated summary for the user

### Final Handoff to User

```
Team work complete.

DELIVERED:
- [file1.py]: [description of changes]
- [file2.py]: [description of changes]
- [test_suite]: N tests added, all passing

KNOWN LIMITATIONS:
- [anything not completed]

RECOMMENDED NEXT STEPS:
- [what to do next]

Run `[test command]` to verify.
```
