#!/usr/bin/env python3
"""Reinject critical context after compaction.

Fires on SessionStart with matcher 'compact'. Outputs rules that must
survive context compression, ensuring Claude remembers key constraints
even after losing 90%+ of conversation history.
"""
import json
import sys

# Read stdin to confirm this is a compact event
data = json.loads(sys.stdin.read())

# Only fire on compact events
if data.get("source") != "compact":
    sys.exit(0)

# Output critical rules — these are injected into post-compaction context
# Customize these rules per-project (keep to 10 or fewer)
rules = """
CRITICAL POST-COMPACTION RULES (re-read CLAUDE.md for full context):

1. PROTECTED FILES: Never modify lock files, generated code, or vendor directories
2. TEST COMMAND: Always use '[test command]' before declaring work complete
3. LEARNED RULES: Check CLAUDE.md LEARNED RULES before starting work
4. MEMORY: Consult .claude/MEMORY.md for known patterns and failure modes

Re-read CLAUDE.md now to restore full project context.
"""

print(rules.strip())
