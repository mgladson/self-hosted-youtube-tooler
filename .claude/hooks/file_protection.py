"""File protection hook — blocks writes to protected paths."""
import datetime
import sys
import json
import fnmatch
from pathlib import Path

# Configure these patterns per-project
PROTECTED_PATTERNS = [
    "*.lock",
    "*vendor/*",
    "*node_modules/*",
    "*dist/*",
]


def log_event(message: str):
    """Append a drift event to the session log for /signoff to read."""
    log = Path(".claude/state/session-events.log")
    log.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now().isoformat(timespec="seconds")
    with log.open("a", encoding="utf-8") as f:
        f.write(f"[{ts}] file-protection: {message}\n")


def main():
    data = json.load(sys.stdin)
    tool_input = data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    for pattern in PROTECTED_PATTERNS:
        if fnmatch.fnmatch(file_path, pattern):
            log_event(f"Blocked write to {file_path} (pattern: {pattern})")
            print(json.dumps({
                "decision": "block",
                "reason": f"Protected path: {file_path} matches pattern '{pattern}'"
            }))
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
