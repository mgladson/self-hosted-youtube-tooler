"""Turn counter hook — fires a /compact reminder at turn threshold.

UserPromptSubmit: increments .claude/state/turn-counter
If count >= TURN_THRESHOLD: prints JSON with stopReason reminder
SessionStart: call with --reset to delete the counter file
"""
import sys
import json
import argparse
from pathlib import Path

TURN_THRESHOLD = 25
COUNTER_FILE = Path(".claude/state/turn-counter")


def reset():
    COUNTER_FILE.unlink(missing_ok=True)


def increment():
    COUNTER_FILE.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    if COUNTER_FILE.exists():
        try:
            count = int(COUNTER_FILE.read_text().strip())
        except ValueError:
            count = 0
    count += 1
    COUNTER_FILE.write_text(str(count))
    return count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    if args.reset:
        reset()
        sys.exit(0)

    count = increment()

    if count >= TURN_THRESHOLD:
        msg = (
            f"[Turn {count}/{TURN_THRESHOLD}+] Context is getting long. "
            f"IMPORTANT: Before responding to the user's request, suggest running /compact "
            f"to compress the conversation and free context space. "
            f"Say: 'We're at turn {count} — consider running /compact to keep the context fresh.'"
        )
        print(json.dumps({"stopReason": msg}))
    # Always exit 0 — never block the user's message
    sys.exit(0)


if __name__ == "__main__":
    main()
