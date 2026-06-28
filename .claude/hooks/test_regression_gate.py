"""Test regression gate — blocks session completion if tests are failing."""
import datetime
import json
import subprocess
import sys
from pathlib import Path

TEST_CMD = "[test command]"


def log_event(message: str):
    """Append a drift event to the session log for /signoff to read."""
    log = Path(".claude/state/session-events.log")
    log.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now().isoformat(timespec="seconds")
    with log.open("a", encoding="utf-8") as f:
        f.write(f"[{ts}] test-regression-gate: {message}\n")


def main():
    data = json.load(sys.stdin)

    # Prevent infinite loops — if this is already a stop-hook re-entry, pass through
    if data.get("stop_hook_active"):
        sys.exit(0)

    # Run the test command
    try:
        result = subprocess.run(
            TEST_CMD.split(),
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError:
        # Test command not found — warn but don't block
        print("WARNING: Test command not found: " + TEST_CMD)
        sys.exit(0)
    except subprocess.TimeoutExpired:
        log_event("Tests timed out after 120s")
        print(json.dumps({
            "decision": "block",
            "reason": "Test command timed out after 120s. Fix or investigate before completing."
        }))
        sys.exit(2)

    if result.returncode != 0:
        # Show last 10 lines of output for context
        output_lines = (result.stdout + result.stderr).strip().splitlines()
        tail = "\n".join(output_lines[-10:])
        log_event(f"Tests failing (exit code {result.returncode})")
        print(json.dumps({
            "decision": "block",
            "reason": f"Tests are failing. Fix all test failures before completing.\n\n{tail}"
        }))
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
