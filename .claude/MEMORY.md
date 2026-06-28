# shopify-deliverable-website-stack-clone — Project Memory Index

<!--
  Memory architecture: 3 layers (Summary → Pattern Index → Recent Log)
  Injection limit: first 200 lines are auto-injected into agent context
  Curation: compact when approaching 150 lines; promote recurring patterns
  Rule: after 3 occurrences of the same drift pattern, promote to LEARNED RULE in CLAUDE.md
-->

## Summary Statistics
- Total patterns logged: 0
- Most common root cause: (none yet)
- Most reliable fix pattern: (none yet)
- Last updated: (not yet)

## Pattern Index
<!-- Grouped by category — never delete entries, only add. Link to topic files for details. -->

### Code Quality
<!-- e.g., "Off-by-one in loop bounds → Add boundary test case (see debugging.md#off-by-one)" -->

### Architecture
<!-- e.g., "Circular dependency between auth and user modules → Extract shared types" -->

### Testing
<!-- e.g., "Flaky test in CI due to timing → Add retry with exponential backoff" -->

### Debugging
<!-- e.g., "Null pointer in serialization → Check optional fields before access" -->

### Workflow
<!-- e.g., "PR builds fail when lock file not committed → Always commit lock files" -->

## Drift Patterns Encountered
<!-- Log every drift detection here. After 3 occurrences of the same pattern, promote to a LEARNED RULE in CLAUDE.md -->

### Scope Creep
<!-- e.g., "[date] Trigger: user said "refactor X" → Claude modified unrelated Y files -->
<!--        Hook: scope-creep-detector blocked Write to path (see .claude/plans/task-scope.md for allowed patterns) -->
<!--        Prevention: Added path to CLAUDE.md anti-patterns -->

### Hallucination
<!-- e.g., "[date] Pattern: Claude imported from nonexistent module -->
<!--        Hook: hallucination-canary caught nonexistent import -->
<!--        Prevention: Added to failure-patterns.md -->

### Boundary Erosion
<!-- e.g., "[date] Turn N: Claude agreed to skip safety check after user insisted -->
<!--        Hook: session-boundary-monitor triggered re-grounding -->
<!--        Prevention: CLAUDE.md rule added -->

## Known Failure Patterns — DO NOT Re-attempt
<!-- Document fixes that don't work here to prevent re-discovery of dead ends in future sessions. -->
<!-- Format: [DATE] Pattern description → Why it failed -->

## Recent Log
<!-- Newest first. Move entries older than 30 days into topic files. Compact oldest when exceeding 150 lines. -->
<!-- Entry format:
  [DATE] Brief description of what happened.
    Root cause: What caused it.
    Fix: What was done.
    Regression: pass/fail.
    Scalable: yes/no.
-->
