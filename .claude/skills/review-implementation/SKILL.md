---
name: review-implementation
description: "Post-implementation audit comparing actual code changes against a plan. Five lenses: Coverage (what's missing?) → Fidelity (what's wrong?) → Quality (bugs?) → Integration (side effects?) → DevOps (deployment gaps?). Tags issues Critical/High/Medium/Low. Loops until 0C/0H/0M/<3L. Invoke with /review-implementation or /review-implementation path/to/plan.md"
---

# Review Implementation

You are executing the `/review-implementation` skill. You will compare an actual implementation
against its plan, verify nothing was missed, and verify everything was implemented correctly.

**Exit condition:** 0 Critical, 0 High, 0 Medium, fewer than 3 Low issues.

**Approval caveat:** Approval means the implementation passes this structured review. It is not
a guarantee of correctness — it is an informed engineering opinion. Final judgment always rests
with the human.

---

## Step 1: Locate Plan and Implementation

### 1a. Locate the plan file

If a path was provided as an argument, read that file.
If the file cannot be read or is empty, tell the user and stop: "Plan file not found or empty.
Please provide a valid path."

Otherwise, look in this order:
1. Any `.md` file in `.claude/plans/` (most recently modified first)
2. A file named `PLAN.md` in the current directory
3. Ask the user: "What plan file should I use?"

### 1b. Capture the implementation

Ask:
> "What implementation should I review? Options:
> (A) Run `git diff HEAD~1..HEAD` — use this if the implementation was just committed
> (B) Run `git diff HEAD` — use this if changes are staged or unstaged but not committed yet
> (C) Provide file paths — I'll read those files directly
> (D) Describe the changes — tell me what was implemented in your own words"

Wait for the user's answer.

- **Option A:** Run `git diff HEAD~1..HEAD` (or the commit range specified by the user)
- **Option B:** Run `git diff HEAD`
- **Option C:** Read up to **10 files**. If more are provided, ask: "You listed N files. Which
  are most relevant? I'll read up to 10."
- **Option D:** Use the user's description as the implementation record

If the diff or file content exceeds ~500 lines, note: "Implementation is large — I'll anchor my
review to the plan items and read deeper on any section I need to verify."

### 1c. State context

Output:
```
Plan: <file path>
Implementation: <how it was captured — git diff range / files read / user description>
Summary: <one-line description of what the plan proposed>
Pass: 1
```

---

## Step 2: Coverage Audit

**Persona:** You are a meticulous QA engineer who spec-tests every requirement against the actual
deliverables. You care about completeness — not quality or style, just: was it done?

**Method:** Extract every concrete deliverable from the plan — files to create, files to modify,
functions to add, behaviors to implement, configurations to change, tests to write. For each
deliverable, check whether it appears in the implementation.

**Steelman first:** Before listing issues, briefly note 1-3 deliverables the implementation
covers completely. Only flag something as missing if you can point to a specific plan item that
is absent or incomplete in the implementation.

**What to look for:**
- **Missing deliverable** — a file, function, or feature the plan names that doesn't appear
- **Partial implementation** — the item exists but is clearly incomplete (stub, TODO, empty body)
- **Wrong location** — implemented in a different file, module, or path than the plan specified
- **Wrong name** — function/class/variable named differently than the plan specified (if plan was specific)
- **Missing test** — plan specified tests that aren't in the implementation

**Severity can be any level.** The following example shows one issue — the severity is
illustrative, not a rule. A Coverage finding can be Critical, High, Medium, or Low depending
on impact.

```
[COVERAGE] #1 [HIGH] <issue title>
  Plan item: <exact quote or section reference from the plan>
  Status: Missing / Partial / Wrong location / Wrong name
  Expected: <what the plan said would be there>
  Found: <what was actually implemented, or "not found">
  Fix: <specific recommendation>
```

Number issues starting at 1. Use a **single global counter** across all five lenses — do not
restart at #1 for each lens.

---

## Step 3: Fidelity Review

**Persona:** You are a senior engineer who knows the difference between "did it" and "did it
right." You care about whether the implementation matches the plan's exact intent — not just
that something was done, but that it was done in the way the plan specified.

**Steelman first:** Note 1-3 aspects of the implementation that faithfully follow the plan's
intent before listing divergences.

Review with full awareness of Coverage issues already found.

**What to look for:**
- **Wrong algorithm or approach** — plan specified algorithm X, implementation uses algorithm Y
- **Wrong data type or schema** — plan specified a structure, implementation uses a different one
- **Wrong behavior** — implementation works but produces different output than the plan described
- **Skipped plan constraint** — plan said "do X but not Y," implementation does Y anyway
- **Over-implementation** — implementation goes beyond what the plan described (scope creep)
- **Under-implementation** — satisfies the letter of the plan but not the intent
- **Config/constant drift** — plan specified values (timeout, port, path, default) that differ
  in the implementation

**Severity can be any level.** The following example shows one issue — the severity is
illustrative, not a rule. A Fidelity finding can be Critical, High, Medium, or Low depending
on impact.

```
[FIDELITY] #N [MEDIUM] <issue title>
  Plan intent: <exact quote or paraphrase of what the plan said>
  Implementation: <quote or reference to what was actually done>
  Problem: <how they diverge>
  Impact: <consequence if not corrected>
  Fix: <specific recommendation>
```

Continue the global issue counter from Step 2.

---

## Step 4: Quality Review

**Persona:** You are a senior staff engineer who has reviewed hundreds of PRs and caught the
bugs that make it to production. You care about correctness, edge cases, and implementation
completeness — independent of what the plan said.

**Steelman first:** Note 1-3 things the implementation gets right from a quality perspective
before listing issues.

Review with full awareness of Coverage and Fidelity issues already found.

**What to look for:**
- **Concrete bugs** — null/undefined access, off-by-one errors, race conditions, wrong logic
- **Edge cases** — empty inputs, max values, missing files, concurrent access, duplicate calls
- **Error handling gaps** — exceptions not caught, errors not propagated, silent failures
- **Resource leaks** — file handles, connections, memory not cleaned up on failure paths
- **Hardcoded assumptions** — paths, ports, sizes, timeouts that will break in other environments
- **Missing validation** — inputs not checked at system boundaries (user input, external APIs)
- **Test gaps** — scenarios not covered, unhappy paths untested, assertions too weak

**Severity can be any level.** The following example shows one issue — the severity is
illustrative, not a rule. A Quality finding can be Critical, High, Medium, or Low depending
on impact.

```
[QUALITY] #N [CRITICAL] <issue title>
  Location: <file:line or function reference>
  Problem: <what is wrong>
  Impact: <consequence if not fixed>
  Fix: <specific recommendation>
```

Continue the global issue counter from Step 3.
Only flag issues you can cite by pointing to a specific location in the implementation.

---

## Step 5: Integration Review

**Persona:** You are a senior architect who thinks about systems, not just files. You care
about whether the implementation fits correctly into the whole — unintended side effects,
broken interfaces, and missing updates to dependent components.

**Skip condition:** Skip this step only if the implementation is a completely isolated addition
with no callers, no consumers, no shared state, and no dependency on existing components.
State "Skipped — isolated addition with no integration surface." and proceed to Step 6.

For all other implementations, this step applies.

**Steelman first:** Note 1-3 ways the implementation integrates cleanly with the rest of the
system before listing issues.

Review with full awareness of all prior issues found.

**What to look for:**
- **Broken interfaces** — existing callers of modified code that are now broken or silently wrong
- **Missing updates** — related files (docs, config, tests, types, imports) that should have
  changed but didn't
- **Dependency direction violations** — implementation creates an import cycle or wrong coupling
- **Inconsistent state** — data modified in one place but a dependent place wasn't updated
- **Unintended side effects** — changes to shared state, global config, or filesystem beyond
  plan scope
- **API/contract changes** — public interfaces changed without updating callers or docs
- **Migration gaps** — plan required a data migration or schema change that wasn't applied

**Severity can be any level.** Continue the global issue counter from Step 4.
Only flag issues you can cite by pointing to a specific location in the implementation.

```
[INTEGRATION] #N [HIGH] <issue title>
  Location: <file or component reference>
  Problem: <what is wrong>
  Impact: <consequence if not fixed>
  Fix: <specific recommendation>
```

---

## Step 5.5: DevOps / Infra Engineer Review

**Persona:** You are a senior DevOps engineer who validates that code changes land safely in production. You care about whether the implementation includes all necessary deployment-facing changes — not just the code, but everything needed to ship it.

**Skip condition:** Skip this step only if the implementation is a purely in-code change with no deployment surface — no new services, no new environment variables, no container changes, no CI/CD pipeline updates, no infrastructure provisioning, and no schema migrations. State "Skipped — no deployment or infra surface." and proceed to Step 6.

**Steelman first:** Note 1-3 deployment/infra concerns the implementation handles correctly before listing issues.

Review with full awareness of all prior issues found.

**What to look for:**
- **Missing env/config** — implementation introduces new environment variables, secrets, or feature flags without adding them to `.env.example`, deployment docs, or environment configs
- **CI/CD not updated** — pipeline config unchanged despite new build steps, test targets, or deploy stages being required
- **Container changes missing** — new package or system dependencies not reflected in Dockerfile or compose files
- **Migration not included** — schema or data migration implied by the change is absent from the implementation
- **Environment parity** — hardcoded values, localhost references, or assumptions that only hold locally
- **No rollback path** — destructive changes (schema drops, config removal) with no documented or scripted revert procedure
- **Infra not provisioned** — implementation references resources (queues, buckets, caches) that must be created but no provisioning code or docs exist

**Severity can be any level.** Continue the global issue counter from Step 5.
Only flag issues you can cite by pointing to a specific location in the implementation.

```
[DEVOPS] #N [HIGH] <issue title>
  Location: <file or component reference>
  Problem: <what is wrong or missing>
  Impact: <consequence if not fixed>
  Fix: <specific recommendation>
```

---

## Step 6: Consolidate and Score

### Deduplication rule

Two issues are the same if they point to **the same location in the implementation** AND
prescribe **the same fix**. Different severity, different root cause, or different fix =
separate issues even if co-located. When deduplicating, keep the higher severity and note
both source lenses.

### Output the consolidated table

```
## Review Results — Pass N

| # | Sev | Lens | Issue | Fix Summary |
|---|-----|------|-------|-------------|
| 1 | CRITICAL | Quality | <title> | <one-line fix> |
| 2 | HIGH | Coverage | <title> | <one-line fix> |
| 3 | MEDIUM | Fidelity | <title> | <one-line fix> |
| 4 | LOW | Integration | <title> | <one-line fix> |
| 5 | LOW | DevOps | <title> | <one-line fix> |

Score: Nc Critical | Nh High | Nm Medium | Nl Low
Exit condition: 0C / 0H / 0M / <3L
Status: [BLOCKED — N issues must be resolved] / [APPROVED — implementation is ready]
```

Use the global issue numbers from the individual lens sections. Sort by severity
(Critical → High → Medium → Low). Within same severity, sort by lens order
(Coverage → Fidelity → Quality → Integration → DevOps).

---

## Step 7: Resolution

### If APPROVED (0 Critical, 0 High, 0 Medium, fewer than 3 Low)

Output:
```
## ✓ Implementation Approved — Pass N

All blocking issues resolved. Remaining low-severity items are advisory only.

Low items (advisory, not blocking):
- #N: [issue title] — [recommendation]

The implementation matches the plan and is ready to proceed.
```

Stop. Do not loop further.

---

### If BLOCKED

This is a two-phase process: ANALYSIS is now complete. REMEDIATION begins here.

List the blocking issues (Critical/High/Medium only). For each, propose the exact change
to make to the implementation to resolve it — specific enough that it could be applied as a
code edit.

Ask the user:
> "I've identified N blocking issues. Should I:
> (A) Fix all issues automatically in the implementation files and re-review
> (B) Walk through each fix one at a time — I'll show the proposed change, you approve with 'yes'
>     or provide your own wording, then I apply and move to the next
> (C) Stop here and give you a checklist to address manually"

**Option A:** Apply all fixes to the implementation files in sequence, then output:
```
Applied N fixes. Starting Pass [N+1] review from Step 2.
```
Then re-run all five lenses (Steps 2–5.5) against the updated implementation. Re-reading all
five lenses is required — a fix in one area can introduce new issues in another.

**Option B:** For each blocking issue in order:
1. Show: `Fix for #N [SEVERITY] <title>: [exact proposed change as a quoted edit or replacement text]`
2. Wait for user response: 'yes' to apply as-is, or provide alternative wording
3. Apply the approved change to the implementation file
4. Confirm: `Applied fix #N. Moving to #N+1.`

After all fixes are applied: start Pass [N+1] from Step 2, re-running all five lenses.

**Option C:** Output the full blocking issue list as a markdown checklist:
```
## Blocking Issues Checklist — Pass N

- [ ] #1 [CRITICAL] <title>: <fix recommendation>
- [ ] #2 [HIGH] <title>: <fix recommendation>
...
```
Then stop.

---

### Pass limit and context management

**Pass 3+ warning:** If this is pass 3 or later, note:
> "We're on pass N. Conversation history is growing. If review quality seems degraded, start a
> fresh conversation — point to the updated implementation files and the plan. The files on disk
> are the source of truth."

**Pass 5 hard stop:** If pass 5 is reached and the review is still BLOCKED, stop and tell the
user:
> "After 5 passes, the implementation still has blocking issues. This typically indicates a
> fundamental mismatch between the plan and the implementation that requires stepping back to
> reconcile the plan or restart the implementation of the affected components."

---

## Severity Definitions

| Level | Definition | Examples |
|-------|------------|---------|
| **CRITICAL** | Implementation will fail, produce data loss, or create a security breach | Wrong algorithm, missing auth, destructive operation with no safeguard |
| **HIGH** | Implementation will produce incorrect results or significant user-facing breakage | Core feature missing, architectural coupling that breaks the design |
| **MEDIUM** | Implementation works but misses details — edge cases, partial coverage, wrong constants | Off-by-one in non-critical path, wrong default value, partial test coverage |
| **LOW** | Advisory — better practice, minor improvement, style | Naming suggestion, optional optimization, missing docstring |

**Any lens can produce any severity level.** Severity is determined by impact, not by which
engineering perspective found the issue.
