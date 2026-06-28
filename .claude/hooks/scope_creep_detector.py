"""Scope creep detector — blocks edits outside the approved plan scope.

Reads .claude/plans/task-scope.md (generated automatically after plan approval) and
blocks any Edit/Write to files not matching the declared allowed patterns.

If .claude/plans/task-scope.md does not exist, all edits are allowed (no enforcement).
"""
import datetime
import sys
import json
import os
import re
import fnmatch
from pathlib import Path


def log_event(message: str):
    """Append a drift event to the session log for /signoff to read."""
    log = Path(".claude/state/session-events.log")
    log.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now().isoformat(timespec="seconds")
    with log.open("a", encoding="utf-8") as f:
        f.write(f"[{ts}] scope-creep-detector: {message}\n")


def normalize_path(file_path: str) -> str:
    """Normalize absolute paths to relative, using forward slashes."""
    p = Path(file_path)
    if p.is_absolute():
        try:
            p = p.relative_to(Path.cwd())
        except ValueError:
            pass
    return str(p).replace(os.sep, "/")


def parse_allowed_files(content: str) -> list:
    """Extract glob patterns from the '## Allowed Files' section."""
    patterns = []
    in_section = False
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("## Allowed Files"):
            in_section = True
            continue
        if in_section and stripped.startswith("## "):
            break
        if in_section:
            # Match "- `pattern`" or "- pattern"
            m = re.match(r"\s*[-*]\s+`?([^`]+)`?\s*$", line)
            if m:
                patterns.append(m.group(1).strip())
    return patterns


def main():
    data = json.load(sys.stdin)
    tool_input = data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    if not file_path:
        sys.exit(0)

    # Normalize to relative path with forward slashes
    norm = normalize_path(file_path)

    # Always allow writes to the scope file itself (prevents self-deadlock)
    if norm == ".claude/plans/task-scope.md":
        sys.exit(0)

    scope_file = Path(".claude/plans/task-scope.md")
    if not scope_file.exists():
        sys.exit(0)

    content = scope_file.read_text(encoding="utf-8")
    patterns = parse_allowed_files(content)

    if not patterns:
        sys.exit(0)

    if any(fnmatch.fnmatch(norm, p) for p in patterns):
        sys.exit(0)

    reason = (f"SCOPE BLOCK: {norm} is outside the approved plan scope. "
              f"Allowed: {', '.join(patterns)}. "
              f"ACTION REQUIRED: If the user expanded scope, update the "
              f"'## Allowed Files' section in .claude/plans/task-scope.md "
              f"to include this path, then retry. Do NOT delete task-scope.md.")
    log_event(f"Blocked write to {norm}")
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(2)


if __name__ == "__main__":
    main()
