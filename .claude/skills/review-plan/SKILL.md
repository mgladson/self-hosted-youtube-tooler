---
name: review-plan
description: "Adversarial plan review from 5 engineering lenses (Product → Architect → Staff Engineer → Security Engineer → DevOps Engineer). Security lens auto-activates for plans with auth, payments, APIs, file uploads, or user data. DevOps lens auto-activates for plans touching deployment, infra, CI/CD, or migrations. Tags issues Critical/High/Medium/Low. Loops until 0C/0H/0M/<3L with mandatory adversarial verification pass before approval. Invoke with /review-plan or /review-plan path/to/plan.md"
---

# Review Plan

You are executing the `/review-plan` skill. You will review a technical plan from five engineering
perspectives in sequence, identify all issues, and loop until the plan meets the exit condition.

**Exit condition:** 0 Critical, 0 High, 0 Medium, fewer than 3 Low issues.

**Approval caveat:** Approval means the plan passes this structured review. It is not a guarantee of
correctness — it is an informed engineering opinion. Final judgment always rests with the human.

---

## Step 1: Locate the Plan and Capture Original Request

### 1a. Capture the original request

Before reading anything, ask:
> "What was the original task or request this plan is meant to address? Paste it here, or describe
> it in 1-3 sentences."

Wait for the user's answer. Store it as `ORIGINAL_REQUEST`. This is required — do not skip.

If the user provides it inline with the `/review-plan` invocation (e.g., `/review-plan plan.md "add dark mode toggle"`), extract it from there and do not ask again.

### 1b. Locate the plan file

If a path was provided as an argument, read that file.
If the file cannot be read or is empty, tell the user and stop: "Plan file not found or empty. Please provide a valid path."

Otherwise, look in this order:
1. Any `.md` file in `.claude/plans/` (most recently modified first)
2. A file named `PLAN.md` in the current directory
3. Ask the user: "What file should I review?"

### 1c. Read referenced files (bounded)

If the plan explicitly links to other files (code, docs, specs), read up to **5 of them**. If more
than 5 are referenced, ask the user: "The plan references N files. Which are most relevant to
review? I'll read up to 5."

### 1d. State context

Output:
```
Plan: <file path>
Original request: <ORIGINAL_REQUEST>
Summary: <one-line description of what the plan proposes>
Pass: 1
```

---

## Step 2: Product Engineer Review

**Persona:** You are a senior product engineer who has shipped 10+ products. You care about whether
the right thing is being built, whether scope is controlled, and whether the user experience is sound.

**Steelman first:** Before listing issues, briefly note 1-3 things the plan gets right. Only flag
something as an issue if you can articulate both the problem AND why a reasonable engineer who wrote
this plan might have missed it. This prevents over-flagging valid design decisions.

**Compare against `ORIGINAL_REQUEST`** at every point. Scope creep and missing requirements are only
meaningful relative to the original ask.

**What to look for:**
- **Scope creep** — does the plan do more than `ORIGINAL_REQUEST` asked for?
- **Wrong problem** — is this solving the symptom rather than the root cause?
- **Missing user value** — does the output actually help the end user, or just the developer?
- **UX gaps** — confusing outputs, silent failures, error messages users can't act on
- **Over-engineering** — building configurability or abstraction for a single use case
- **Missing requirements** — what does `ORIGINAL_REQUEST` clearly need that isn't addressed?
- **Success criteria** — is there a way to verify the plan succeeded?

**Severity can be any level.** The following example shows one issue — the severity is illustrative,
not a rule. A Product finding can be Critical, High, Medium, or Low depending on impact.

```
[PRODUCT] #1 [HIGH] <issue title>
  Location: <quote or section reference from the plan>
  Problem: <what is wrong>
  Impact: <consequence if not fixed>
  Fix: <specific recommendation>
```

Number issues sequentially starting at 1. Continue numbering into subsequent lenses (do not restart
at #1 for each lens — use a single global counter across all five lenses).

---

## Step 3: Architect Review

**Persona:** You are a senior architect who has designed systems serving millions of requests. You
care about structure, coupling, data flow, and whether the system will survive growth and failure.

**Steelman first:** Note 1-3 things the plan's structure gets right before listing issues.

Review the plan with full awareness of the Product issues already found.

**What to look for:**
- **Tight coupling** — components that should be independent are entangled
- **Single responsibility violations** — one component doing too many things
- **Missing abstraction boundaries** — where should an interface or contract exist?
- **Scalability** — will this work at 10x the current load/data/users?
- **Data flow** — is data moving correctly? Any transformation steps missing?
- **Dependency risks** — new external dependencies, version conflicts, transitive risks
- **Failure modes** — what happens when a dependency is down, slow, or returns garbage?
- **Reversibility** — can this be rolled back without data loss or service disruption?
- **Security boundaries** — are trust boundaries clearly defined and enforced?
- **Observability** — can you tell when this is broken in production?

**Severity can be any level.** Continue the global issue counter from Step 2.

```
[ARCHITECT] #N [MEDIUM] <issue title>
  Location: <quote or section reference from the plan>
  Problem: <what is wrong>
  Impact: <consequence if not fixed>
  Fix: <specific recommendation>
```

---

## Step 4: Staff Engineer Review

**Persona:** You are a senior staff engineer who has reviewed hundreds of PRs and caught the bugs
that make it to production. You care about correctness, edge cases, and implementation completeness.

**Steelman first:** Note 1-3 things the plan's implementation approach gets right before listing issues.

Review the plan with full awareness of Product and Architect issues already found.

**What to look for:**
- **Concrete bugs** — null/undefined access, off-by-one errors, race conditions, integer overflow
- **Edge cases** — empty inputs, max values, missing files, concurrent access, duplicate calls
- **Error handling gaps** — what happens when this step fails? Is the error propagated correctly?
- **Missing steps** — things the plan glosses over with "just do X" that are actually complex
- **Implementation contradictions** — does step A assume something that step B invalidates?
- **Test coverage gaps** — what scenarios are not covered by the verification plan?
- **Rollback/migration** — if this modifies existing data/config, how do you undo it?
- **Backward compatibility** — does this break existing consumers of this interface?
- **Resource leaks** — file handles, connections, memory not cleaned up on failure paths
- **Hardcoded assumptions** — paths, ports, sizes, timeouts that will break in other environments

**Severity can be any level.** Continue the global issue counter from Step 3.
Only flag issues you can cite by pointing to a specific location in the plan.

```
[STAFF] #N [CRITICAL] <issue title>
  Location: <quote or section reference from the plan>
  Problem: <what is wrong>
  Impact: <consequence if not fixed>
  Fix: <specific recommendation>
```

---

## Step 4.5: Security Engineer Review

**Persona:** You are a senior application security engineer who has broken production systems and designed defenses against those same attacks. You care about attack surface, trust boundaries, and whether the plan's security design will hold under adversarial conditions.

**Skip condition:** Skip this step only if the plan contains NONE of the following: user authentication, authorization/permissions, payments or financial operations, API endpoints exposed to the internet, file uploads or downloads, user-supplied input processed server-side, secrets or credentials, sessions or tokens, database access, or third-party integrations. State "Skipped — no security-sensitive components." and proceed to Step 5.

**Steelman first:** Note 1-3 things the plan's security design gets right before listing issues.

Review with full awareness of all prior issues found. You are reviewing the **plan's security design** — not code. Flag gaps where the plan under-specifies, incorrectly specifies, or omits security-critical decisions that will lead to vulnerabilities during implementation.

**What to look for:**

**Authentication & Authorization:**
- Auth flows that are vague — "user logs in" without specifying mechanism, token lifetime, or revocation
- Missing authorization checks on any endpoint or operation that accesses user-specific data
- Privilege escalation paths — can a lower-privilege user reach higher-privilege operations?
- Session management — no mention of token storage, expiry, or invalidation on logout
- JWT design flaws — no expiry, weak secret strategy, alg:none risk

**Secrets & Credential Management:**
- Hardcoded credentials or API keys mentioned anywhere in the plan
- No mention of how secrets are injected at runtime (env vars, vault, secrets manager)
- Third-party integration credentials with no rotation or scoping strategy

**Input Validation & Injection:**
- User-supplied data flowing into database queries without parameterization mentioned
- File upload handling with no mention of type validation, size limits, or storage isolation
- URL/path parameters used in file system operations without traversal protection
- Template rendering with user content and no mention of escaping

**Data Protection:**
- PII or sensitive data stored without encryption-at-rest mentioned
- Sensitive data transmitted without TLS explicitly required
- Logging that would capture tokens, passwords, or PII
- API responses that return more data than the caller needs (over-exposure)

**Cryptographic Design:**
- Passwords stored without a proper KDF (bcrypt, argon2, scrypt) — "hash passwords" is not enough
- Weak or unspecified randomness for tokens, nonces, or IDs
- MD5 or SHA1 for any security purpose

**Business Logic Security:**
- Financial operations with no idempotency or double-spend protection
- Discount or coupon logic with no concurrent-use protection
- Order/inventory operations with race condition potential and no atomic update strategy
- Workflow steps that can be bypassed by direct API calls

**Severity can be any level.** Continue the global issue counter from Step 4.
Only flag issues you can cite by pointing to a specific location in the plan.
Only flag gaps where the plan's omission or design decision will **directly cause** a vulnerability — not theoretical concerns.

```
[SECURITY] #N [CRITICAL] <issue title>
  Location: <quote or section reference from the plan>
  Problem: <what is wrong or missing in the security design>
  Impact: <what attack this enables>
  Fix: <specific design decision the plan must make>
```

---

## Step 5: DevOps / Infra Engineer Review

**Persona:** You are a senior DevOps engineer who has shipped production systems at scale. You care about deployability, environment parity, CI/CD correctness, and whether the plan will survive the journey from code to production without manual intervention or surprises.

**Skip condition:** Skip this step only if the plan is a purely in-code change with no deployment surface — no new services, no new environment variables, no container changes, no CI/CD pipeline updates, no infrastructure provisioning, and no schema migrations. State "Skipped — no deployment or infra surface." and proceed to Step 6.

**Steelman first:** Note 1-3 things the plan's deployment/infra approach gets right before listing issues.

Review with full awareness of all prior issues found.

**What to look for:**
- **Missing env/config** — new environment variables, secrets, or feature flags required but not explicitly planned for all environments (dev, staging, prod)
- **CI/CD impact** — pipeline changes required (build steps, test stages, deploy targets) that aren't called out in the plan
- **Container/image changes** — new system dependencies, base image changes, or build args implied but not stated
- **Migration ordering** — database or data migrations that must run before or after the deploy, with no rollback strategy defined
- **Environment parity gaps** — behavior that differs between local, staging, and production (ports, paths, external services, mocking)
- **Rollback plan** — destructive changes (schema drops, config removal, breaking API changes) with no documented revert procedure
- **Infra provisioning** — new resources (queues, buckets, caches, DNS entries, load balancer rules) required but not planned
- **Health checks / observability** — new services or endpoints introduced with no monitoring, alerting, or health check strategy

**Severity can be any level.** Continue the global issue counter from Step 4.5.
Only flag issues you can cite by pointing to a specific location in the plan.

```
[DEVOPS] #N [HIGH] <issue title>
  Location: <quote or section reference from the plan>
  Problem: <what is wrong or missing>
  Impact: <consequence if not fixed>
  Fix: <specific recommendation>
```

---

## Step 6: Consolidate and Score

### Deduplication rule
Two issues are the same if they point to **the same location in the plan** AND prescribe **the same
fix**. Different severity, different root cause, or different fix = separate issues even if
co-located. When deduplicating, keep the higher severity and note both source lenses.

### Output the consolidated table

```
## Review Results — Pass N

| # | Sev | Lens | Issue | Fix Summary |
|---|-----|------|-------|-------------|
| 1 | CRITICAL | Staff | <title> | <one-line fix> |
| 2 | HIGH | Architect | <title> | <one-line fix> |
| 3 | MEDIUM | Product | <title> | <one-line fix> |
| 4 | LOW | DevOps | <title> | <one-line fix> |

Score: Nc Critical | Nh High | Nm Medium | Nl Low
Exit condition: 0C / 0H / 0M / <3L
Status: [BLOCKED — N issues must be resolved] / [APPROVED — plan is ready]
```

Use the global issue numbers from the individual lens sections. Sort by severity (Critical → High →
Medium → Low). Within same severity, sort by lens order (Product → Architect → Staff → Security → DevOps).

---

## Step 7: Resolution

### If APPROVED (0 Critical, 0 High, 0 Medium, fewer than 3 Low)

**Do NOT stop yet.** Run one final adversarial verification pass before declaring done.

**Final Adversarial Verification — mandatory after every candidate approval:**

Re-read the current plan file fresh. Adopt the mindset: "The previous passes were biased toward confirming fixes. I am starting from zero. Assume nothing has been resolved." Run all five lenses (Steps 2–5) again with maximum skepticism — actively look for issues that prior passes may have glossed over, new gaps introduced by the fixes themselves, and anything that reads as hand-waving or vague.

If this verification pass finds any Critical, High, or Medium issues: the plan is still BLOCKED. Increment the pass counter and continue in the BLOCKED flow.

Only if this verification pass finds 0 Critical, 0 High, 0 Medium, and fewer than 3 Low issues, output:

```
## ✓ Plan Approved — Pass N (verified)

All blocking issues resolved and independently verified. Remaining low-severity items are advisory only.

Low items (advisory, not blocking):
- #N: [issue title] — [recommendation]

The plan is ready for implementation.
```

Stop. Do not loop further.

---

### If BLOCKED

This is a two-phase process: ANALYSIS is now complete. REMEDIATION begins here.

List the blocking issues (Critical/High/Medium only). For each, propose the exact change to make
to the plan to resolve it — specific enough that it could be applied as a text edit.

Ask the user:
> "I've identified N blocking issues. Should I:
> (A) Apply all fixes automatically and re-review
> (B) Walk through each fix one at a time — I'll show the proposed change, you approve with 'yes'
>     or provide your own wording, then I apply and move to the next
> (C) Stop here and give you a checklist to revise manually"

**Option A:** Apply all fixes to the plan file in sequence, then output:
```
Applied N fixes. Starting Pass [N+1] review from Step 2.
```
Then re-run all five lenses (Steps 2–5) against the updated plan. Re-reading all five lenses is
required — a fix in one area can introduce new issues in another.

**Option B:** For each blocking issue in order:
1. Show: `Fix for #N [SEVERITY] <title>: [exact proposed change as a quoted edit or replacement text]`
2. Wait for user response: 'yes' to apply as-is, or provide alternative wording
3. Apply the approved change to the plan file
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
> fresh conversation and pass the updated plan file — the plan itself is the source of truth."

**Pass 5 hard stop:** If pass 5 is reached and the plan is still BLOCKED, stop and tell the user:
> "After 5 passes, the plan still has blocking issues. This typically indicates a fundamental design
> problem that requires rethinking the approach rather than iterative patching. Consider revising
> the plan's core assumptions before continuing."

---

## Severity Definitions

| Level | Definition | Examples |
|-------|------------|---------|
| **CRITICAL** | Plan will fail, produce data loss, or create a security breach | Wrong algorithm, missing auth, destructive operation with no safeguard |
| **HIGH** | Plan will produce incorrect results or significant user-facing breakage | Missing error handling for common failure, architectural coupling that blocks future work |
| **MEDIUM** | Plan works but will cause pain — bugs in edge cases, poor maintainability, confusing UX | Off-by-one in non-critical path, missing test for known edge case, ambiguous variable naming in complex logic |
| **LOW** | Advisory — better practice, minor improvement, style | Naming suggestion, optional optimization, documentation gap |

**Any lens can produce any severity level.** Severity is determined by impact, not by which
engineering perspective found the issue.
