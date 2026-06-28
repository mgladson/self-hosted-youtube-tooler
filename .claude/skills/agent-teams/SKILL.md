---
name: agent-teams
description: "Multi-agent team orchestration for parallel code review, hypothesis-driven debugging, and coordinated feature development. Preset teams for common workflows. Commands: /agent-teams:review, /agent-teams:debug, /agent-teams:feature, /agent-teams:research, /agent-teams:security"
---

# Agent Teams — Multi-Agent Orchestration

You are executing the `/agent-teams` skill. This skill orchestrates multiple specialized Claude agents working in parallel to dramatically accelerate complex tasks.

Parse the sub-command from the user's invocation:
- `/agent-teams` → show **menu** of available team patterns
- `/agent-teams:review [path]` → **Multi-Reviewer Code Review**
- `/agent-teams:debug [issue]` → **Hypothesis-Driven Debugging**
- `/agent-teams:feature [description]` → **Parallel Feature Development**
- `/agent-teams:research [questions]` → **Parallel Research**
- `/agent-teams:security [path]` → **Parallel Security Audit**

---

## Team Patterns Menu

If no sub-command: present this menu and ask which pattern to use:

```
Agent Teams — Choose a pattern:

1. review    — Multi-reviewer parallel code review (3-5 reviewers, each a different lens)
2. debug     — Competing hypothesis investigation (3 investigators, evidence-based root cause)
3. feature   — Parallel feature development (decompose → file ownership → parallel build)
4. research  — Parallel research across codebase or web (3 Explore agents)
5. security  — Comprehensive security audit (4 parallel reviewers: OWASP, auth, deps, config)
```

---

## Multi-Reviewer Code Review (`/agent-teams:review [path]`)

Spawn parallel review agents, each evaluating code from a single dimension. Eliminates blind spots from single-reviewer fatigue.

### Step 1: Determine Scope

If `path` provided: review that directory/file.
If no path: use `git diff --name-only origin/HEAD...` to find changed files.

### Step 2: Choose Review Dimensions

Ask: "Which review dimensions? (select all that apply)"
- **security** — OWASP Top 10, auth flows, input validation, secrets
- **performance** — algorithmic complexity, N+1 queries, caching opportunities
- **architecture** — SOLID principles, coupling, layering violations, naming
- **testing** — coverage gaps, test quality, missing edge cases
- **accessibility** — ARIA, keyboard navigation, color contrast (for UI code)

Default if no selection: security + architecture + testing.

### Step 3: Spawn Reviewers (parallel Task calls)

Launch one Task per dimension simultaneously:

```
Task: "You are a [dimension] reviewer for shopify-deliverable-website-stack-clone.
Review the code at [path/diff]. Focus ONLY on [dimension] concerns.
For each finding: severity (Critical/High/Medium/Low), file:line, description, remediation.
Output a JSON array of findings."
```

### Step 4: Consolidate Findings

After all tasks complete:
1. Merge findings from all reviewers
2. Deduplicate (same file:line reported by multiple reviewers → keep highest severity)
3. Sort by severity (Critical first)
4. Output consolidated report:

```
## Code Review — [N] Reviewers — [date]

**Dimensions covered:** security, architecture, testing
**Files reviewed:** N
**Findings:** C Critical, H High, M Medium, L Low

### CRITICAL — [Title]
**Reviewer:** security | **File:** path/to/file.ext:42
[description + remediation]

...
```

---

## Hypothesis-Driven Debugging (`/agent-teams:debug [issue]`)

Spawn competing hypothesis investigators. The hypothesis with the most evidence wins.

### Step 1: Gather Issue Context

If issue description not provided, ask: "Describe the bug: what happens vs. what's expected? Include any error messages, stack traces, or reproduction steps."

Run: `git log --oneline -20` to see recent changes.

### Step 2: Generate Hypotheses

Analyze the issue and generate 3 competing hypotheses. For each:
- Root cause category (logic error / race condition / data corruption / config / dependency)
- Prediction: what evidence would confirm this hypothesis?
- Evidence to collect: specific files, log patterns, or code paths to examine

### Step 3: Spawn Investigators (parallel Task calls)

One Task per hypothesis:

```
Task: "You are investigating this bug: [issue].
Your hypothesis: [hypothesis N].
Evidence to collect: [specific files and patterns].
Use Grep, Glob, and Read to gather evidence.
Output: CONFIRMED/FALSIFIED/INCONCLUSIVE with evidence citations (file:line)."
```

### Step 4: Arbitrate Results

After all tasks return:
1. Present evidence from each investigator
2. Score hypotheses: CONFIRMED > INCONCLUSIVE > FALSIFIED
3. If one hypothesis is CONFIRMED and others FALSIFIED: declare root cause
4. If multiple CONFIRMED or all INCONCLUSIVE: ask user for additional context
5. Output fix recommendation with code changes

---

## Parallel Feature Development (`/agent-teams:feature [description]`)

Decompose a feature into non-overlapping work streams, assign file ownership, implement in parallel.

### Step 1: Feature Discovery

Use Explore agent to scan the codebase and understand:
- Existing patterns to follow
- Files that will likely be modified
- Integration points and interfaces

### Step 2: Decompose into Work Streams

Create 2-4 work streams where:
- Each stream owns a distinct set of files (NO overlaps)
- Streams can proceed independently (minimal cross-stream dependencies)
- Each stream has a clear interface contract with others

**File ownership rules** — enforce strictly:
- Each file belongs to exactly ONE work stream
- Shared interfaces: define the contract before spawning implementers
- Integration point: the orchestrator (you) handles merging

### Step 3: Show Plan — User Validation Gate

Present the decomposition:
```
Work Stream 1: Backend API
  Files: src/api/users.py, src/models/user.py, tests/test_api_users.py
  Interface: POST /users returns {id, email, created_at}

Work Stream 2: Frontend Component
  Files: src/components/UserForm.tsx, src/hooks/useUsers.ts
  Interface: expects UserForm.onSubmit(email: string) => Promise<User>

Proceed? (y/n)
```

Wait for explicit user confirmation before spawning implementers.

### Step 4: Spawn Implementers (parallel Task calls)

```
Task: "You are implementing work stream N for [feature].
File ownership: [list of files you own — do NOT modify any other files].
Interface contract: [what you produce/consume at boundaries].
Follow existing patterns in: [2-3 reference files].
After implementing, run tests and report: DONE / BLOCKED (with reason)."
```

### Step 5: Integration

After all streams complete:
1. Review all changes for integration correctness
2. Run full test suite
3. Fix any integration issues (orchestrator handles conflicts)
4. Report: "Feature complete: N work streams merged, tests passing."

---

## Parallel Research (`/agent-teams:research [questions]`)

Spawn multiple Explore agents to investigate different questions or codebase areas simultaneously.

### Step 1: Decompose Questions

If questions provided as arguments: parse into 2-4 distinct research questions.
If no questions: ask "What do you need to understand? List 2-4 questions and I'll investigate in parallel."

### Step 2: Spawn Researchers (parallel Task calls)

```
Task: "Research question: [question N].
Search the codebase (Grep, Glob, Read) and/or web (WebSearch, WebFetch).
Produce a structured report: findings, evidence (file:line or URL), and confidence."
```

### Step 3: Synthesize

Combine researcher reports into a unified answer. Note agreements and contradictions between researchers.

---

## Parallel Security Audit (`/agent-teams:security [path]`)

Four specialized security reviewers covering different attack surfaces simultaneously.

### Reviewers

| Reviewer | Focus |
|---|---|
| OWASP | Injection, XSS, IDOR, broken auth, cryptographic failures |
| Auth & Access | OAuth flows, JWT handling, RBAC, privilege escalation |
| Dependencies | Known CVEs in package.json/requirements.txt, outdated packages |
| Config & Secrets | Hardcoded secrets, insecure defaults, environment variable handling |

### Process

Spawn all 4 reviewers in parallel as Task calls. Each produces a severity-ranked JSON findings array. Consolidate and deduplicate (same finding from multiple reviewers → keep highest severity + merge rationale).

Output matches the `/security-review` format for consistency.

---

## Team Size Guidelines

| Task complexity | Recommended team size |
|---|---|
| Simple code review | 2-3 reviewers |
| Bug with clear error | 2 hypothesis investigators |
| Large feature (> 500 LOC) | 3-4 implementers |
| Full security audit | 4 specialized reviewers |

**Keep teams small**: 2-4 agents is optimal. Larger teams increase coordination overhead and context consumption.

## Best Practices

1. **Use `/agent-assembler` for dynamic team composition** — analyzes your project's tech stack and recommends the optimal agent team automatically
2. **Define file ownership before spawning** — overlapping files cause merge conflicts and agent confusion
2. **Always use `--plan-first` for features** — show the decomposition and get user approval before spawning
3. **Set clear interfaces** — each work stream needs to know what it produces and what it consumes
4. **Monitor progress** — ask spawned agents to emit status updates at completion of each sub-task
5. **Consolidate results yourself** — the orchestrator (you) merges findings; don't ask agents to merge
