---
name: conductor
description: "Context-Driven Development orchestrator. Manages project context (product vision, tech stack, workflow), creates feature tracks with specs and phased plans, and coordinates implementation. Commands: /conductor-setup, /conductor-new-track, /conductor-implement, /conductor-status, /conductor-revert, /conductor-manage"
---

# Conductor — Context-Driven Development

You are executing the `/conductor` skill. Conductor transforms Claude Code into a structured project management tool using the **Context → Spec → Plan → Implement** workflow.

Parse the sub-command from the user's invocation:
- `/conductor` or `/conductor-setup` → run **Setup**
- `/conductor-new-track` → run **New Track**
- `/conductor-implement` → run **Implement**
- `/conductor-status` → run **Status**
- `/conductor-revert` → run **Revert**
- `/conductor-manage` → run **Manage**

If no sub-command is given and `conductor/index.md` does not exist, default to **Setup**.
If no sub-command is given and `conductor/` already exists, default to **Status**.

---

## Setup (`/conductor-setup`)

Initialize the project with foundational context documents. Supports both **greenfield** (new project) and **brownfield** (existing project) modes.

### Phase 1: Detect Mode

Check if `conductor/` directory exists:
- **Missing** → greenfield mode (building from scratch)
- **Exists** → check `conductor/setup_state.json`; if incomplete, resume from last step; if complete, report "Already set up — use `/conductor-status` or `/conductor-new-track`"

### Phase 2: Gather Context (interactive Q&A)

Ask these questions sequentially (wait for user answer before proceeding):

1. **Project name?** (short slug, e.g., `my-app`)
2. **What is this project?** (1-2 sentence product description)
3. **Primary goals?** (top 3 outcomes this project must achieve)
4. **Tech stack?** (languages, frameworks, databases — or "detect from codebase")
   - If "detect": run `Glob` for `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `*.tf`; infer stack
5. **Workflow preferences?** (TDD? commit style? PR process?) — accept "standard" for defaults
6. **Style guides needed?** (Python/JS/TS/Go/Rust/other — select which languages)

### Phase 3: Generate Artifacts

Create the following files:

```
conductor/
├── index.md              ← navigation hub (links to all artifacts)
├── product.md            ← product vision, goals, non-goals
├── product-guidelines.md ← quality standards, messaging rules
├── tech-stack.md         ← technology decisions with rationale
├── workflow.md           ← TDD cycle, commit conventions, PR rules
├── tracks.md             ← empty track registry (ID | Name | Status | Created)
├── setup_state.json      ← {"complete": true, "created": "YYYY-MM-DD"}
└── code_styleguides/
    └── <language>.md     ← one file per selected language
```

After creating all files, output:
```
Conductor initialized.

Created: conductor/index.md, product.md, tech-stack.md, workflow.md, tracks.md
Style guides: [list]

Next: /conductor-new-track to create your first feature track.
```

---

## New Track (`/conductor-new-track [track-name]`)

Create a feature or bug track with spec + phased plan.

### Step 1: Gather Requirements

Ask:
1. **Track name?** (if not provided in arguments)
2. **Type?** `feature` | `bugfix` | `refactor` | `spike`
3. **Description?** (what needs to be built/fixed)
4. **Acceptance criteria?** (how do we know it's done — minimum 2 criteria)
5. **Out of scope?** (what should NOT be done in this track)

### Step 2: Generate Track ID

Format: `<type>-<YYYYMMDD>-<slug>` (e.g., `feature-20260301-user-auth`)

### Step 3: Create Track Files

```
conductor/tracks/<track-id>/
├── spec.md       ← requirements, acceptance criteria, edge cases, out-of-scope
├── plan.md       ← phased task breakdown (3-5 phases, checkbox format)
├── metadata.json ← {"id": ..., "type": ..., "status": "active", "created": ...}
└── index.md      ← track navigation hub
```

**plan.md format:**
```markdown
# Plan: <Track Name>

## Phase 1: <Name>
- [ ] Task 1.1 — Complexity: Low — AC: [specific testable condition]
- [ ] Task 1.2 — Complexity: Medium
**Files:** [list]
**Success criteria:** [what works at end of phase]

## Phase 2: ...
```

### Step 4: Register in tracks.md

Append to `conductor/tracks.md`:
```
| <track-id> | <name> | active | <date> |
```

Output: "Track `<track-id>` created. Run `/conductor-implement <track-id>` to begin."

---

## Implement (`/conductor-implement [track-id]`)

Execute the plan for a track, following TDD red-green-refactor cycle.

### Step 1: Load Track Context

Read: `conductor/tracks/<track-id>/plan.md`, `spec.md`, `conductor/workflow.md`, `conductor/tech-stack.md`

Find the first unchecked task `- [ ]`. If all tasks are complete, report: "All tasks complete. Run `/conductor-manage` to archive this track."

### Step 2: Pre-Implementation Discovery

Use Explore agent to find relevant existing code for the current task. Read no more than 10 files — focus on what directly affects the task.

### Step 3: Implement with TDD (per task)

For each task:
1. **Red** — write a failing test first (if applicable to task type)
2. **Green** — implement minimum code to pass the test
3. **Refactor** — clean up without breaking tests
4. Mark task complete: change `- [ ]` to `- [x]`
5. **User validation gate** — stop and ask: "Task complete. Confirm before continuing? (y/n)"

### Step 4: After Each Phase

When all tasks in a phase are complete:
1. Update `metadata.json` with current phase
2. Run `git add` + `git commit -m "conductor: <track-id> phase N complete"` (with user confirmation)
3. Report phase summary

---

## Status (`/conductor-status`)

Display project and track progress.

Read `conductor/tracks.md` and all `conductor/tracks/*/metadata.json` files. Report:

```
## Conductor Status — <project-name>

### Active Tracks
| Track | Type | Phase | Progress | Blockers |
|-------|------|-------|----------|---------|
| <id>  | feature | 2/4 | 60% | none |

### Archived Tracks: N
### Total tasks completed: N/M
```

---

## Revert (`/conductor-revert [track-id]`)

Undo work by logical unit using git history.

1. Load `conductor/tracks/<track-id>/metadata.json`
2. Ask: "Revert track, specific phase, or specific task?"
3. Find associated git commits: `git log --grep="conductor: <track-id>"`
4. Show commits to be reverted — **require explicit confirmation** before running `git revert`
5. After revert: update plan.md checkboxes to reflect reverted state

---

## Manage (`/conductor-manage`)

Track lifecycle management. Show menu:
- **archive** — move track to `conductor/tracks/_archive/`; add reason
- **restore** — move archived track back to active
- **delete** — permanently delete track artifacts (requires double confirmation)
- **rename** — rename track ID (updates all references)
- **cleanup** — remove orphaned artifacts and update tracks.md

---

## Notes
- All context documents live in `conductor/` at project root (not inside `.claude/`)
- `setup_state.json` enables resuming interrupted setup across sessions
- Conductor tracks complement the RPI workflow — use `/rpi:research` for deep feature discovery before `/conductor-new-track`
- Track IDs are stable identifiers — use them in git commit messages for traceability
