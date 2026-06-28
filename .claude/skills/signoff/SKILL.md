---
name: signoff
description: "End-of-session knowledge capture — persists learnings to CLAUDE.md, MEMORY.md, and shared tooling. Triggered by: signoff, wrap up, end of session, or /signoff."
---

# End-of-Session Knowledge Capture for shopify-deliverable-website-stack-clone

## Step 1: Inventory Work Done
- List all files modified, created, or analyzed in this session
- Classify each script or artifact as: DIAGNOSTIC | REGRESSION | ONE-OFF | GENERATOR
- Note any scripts that should survive beyond this session
- **Read `.claude/state/session-events.log`** if it exists — this contains every hook-triggered drift event from the session (scope blocks, protection blocks, test failures). Use these as the authoritative source for drift patterns instead of relying on memory.

## Step 2: Query Persistent Memory
- Read MEMORY.md for completeness — are there patterns from this session not yet logged?
- Read CLAUDE.md LEARNED RULES — are there new rules to add?
- Check drift pattern counts — any pattern with 3+ occurrences needs promotion to LEARNED RULE
- Cross-reference `.claude/state/session-events.log` entries against MEMORY.md drift patterns — count occurrences accurately

## Step 3: Update Memory Surfaces
Update ALL applicable surfaces:

### CLAUDE.md (Behavioral Rules)
- Append any new LEARNED RULES from this session
- Review existing rules — are any now obsolete due to hooks or tests?
- Promote drift patterns with 3+ occurrences from MEMORY.md

### MEMORY.md (Domain Patterns)
- Add new pattern discoveries to the Pattern Index
- Add new entries to the Recent Log
- Update Summary Statistics (increment counts)
- Run curation protocol if approaching 200-line limit:
  - Move entries older than 30 days to topic files
  - Compact the Recent Log (keep summary, archive details)

### Methodology Docs (Process Knowledge)
- Update any project-specific methodology or wiki documents
- Document any new debugging approaches that worked

## Step 4: Consolidate Tooling
- Identify reusable patterns from one-off scripts
- Port them into shared tooling if warranted
- Delete one-off scripts that have been consolidated

## Step 5: Clean Up
- Remove temp files, debug logs, and intermediate outputs
- Delete `.claude/state/session-events.log` (already consumed in Step 1)
- Delete `.claude/state/turn-counter` (ephemeral session state)
- Verify working directory is clean (`git status`)

## Step 6: Produce Summary
Output a structured signoff summary:

```
## Session Signoff Summary

**Work completed:**
- [one-line per item]

**Rules added to CLAUDE.md:** [count]
- [brief list]

**Patterns added to MEMORY.md:** [count]
- [brief list]

**Drift patterns promoted:** [count]
- [brief list, if any]

**Scripts consolidated/cleaned:** [count]

**Open items for next session:**
- [list, if any]
```
