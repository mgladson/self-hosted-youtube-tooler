---
name: tdd
description: "Test-driven development workflows: interactive red-green-refactor cycle, test coverage gap analysis, characterization tests for legacy code, and mutation testing analysis. Sub-commands: /tdd:cycle, :coverage, :characterize, :mutate. Use when practicing TDD, improving test coverage, or testing legacy code."
---

# TDD — Test-Driven Development

You are executing the `/tdd` skill. You enforce test-driven development discipline and help improve test quality.

Parse the sub-command from the user's invocation:
- `/tdd` → show **menu** and wait for selection
- `/tdd:cycle` → **Red-Green-Refactor Cycle**
- `/tdd:coverage` → **Coverage Gap Analysis**
- `/tdd:characterize` → **Characterization Tests** for legacy code
- `/tdd:mutate` → **Mutation Testing Analysis**

---

## Menu (no sub-command)

```
TDD — Choose a mode:

1. cycle        — Interactive red-green-refactor with strict ordering
2. coverage     — Analyze test gaps and generate missing tests
3. characterize — Write characterization tests for untested legacy code
4. mutate       — Identify weak assertions via mutation analysis
```

---

## Red-Green-Refactor Cycle (`:cycle`)

### Strict Ordering — Never Skip a Step

**RED: Write a failing test FIRST**

1. Ask the user what behavior they want to implement
2. Write the smallest possible test that captures ONE requirement
3. Name it: `test_<behavior>_when_<condition>_then_<outcome>`
4. Run the test — it MUST FAIL
5. If it passes, the test is wrong (testing existing behavior, not new)

**GREEN: Make it pass with minimal code**

1. Write the MINIMUM code to make the test pass
2. No production code without a failing test first
3. Resist over-engineering — just make it green
4. Run all tests — they must ALL pass

**REFACTOR: Clean up with confidence**

1. Identify duplication, poor names, complex conditionals
2. Refactor in small steps, running tests after each change
3. All tests must remain green after every refactor step
4. Extract functions, rename variables, simplify logic

### Repeat

Present: "What's the next behavior to implement?" and restart the cycle.

### Hard Rules
- NEVER write production code before writing a failing test
- NEVER skip the refactor step — it's where quality happens
- NEVER refactor while a test is failing (go back to GREEN first)
- One assertion per test (or one logical concept)

### Red Phase Rules — Failing for the Right Reason

A test in the RED phase must fail for the correct reason. There are three ways a test can fail, and only one is acceptable:

1. **Compile/import error** — the function doesn't exist yet. This is acceptable temporarily, but fix it before treating the test as "red". Create the function stub that returns a dummy value.
2. **Wrong assertion** — the assertion itself is incorrect (e.g., comparing to the wrong expected value). This means the test is broken, not the production code. Fix the test.
3. **Correct failure** — the function exists, the assertion is correct, but the behavior isn't implemented yet. This is the only acceptable RED state.

Before moving to GREEN, confirm: "The test fails because the behavior is missing, not because the test is wrong."

### Minimum Viable Implementation Rule

When writing GREEN code, apply this discipline:

- Write only enough code to make the failing test pass
- If the simplest implementation is `return 42`, write `return 42` — the next test will force generalization
- Do not add parameters, conditionals, or logic that no test requires
- "Fake it till you make it" is valid: hardcode a return value, then let subsequent tests force real logic

This is not laziness — it is disciplined listening to what the tests demand.

### Refactor Phase Checklist

After achieving GREEN, ask each question before marking the cycle complete:

- [ ] **Extract constants**: are there magic numbers or strings in the new code?
- [ ] **Reduce duplication**: does this code repeat logic already present elsewhere?
- [ ] **Clarify naming**: do variable and function names express intent, not implementation?
- [ ] **Check for SOLID violations**:
  - Single Responsibility: does this function do more than one thing?
  - Open/Closed: will adding a new variant require modifying this function?
  - Dependency Inversion: does this code depend on concrete implementations it could receive as parameters?
- [ ] **Simplify conditionals**: can nested `if` statements be flattened or extracted?
- [ ] **Run tests**: all tests still green after each individual change?

### Refactor Example: Before and After

**Before refactor (GREEN but not clean):**

```python
def get_user_label(user):
    if user["status"] == "active" and user["subscription"] == "premium":
        return "PREMIUM_ACTIVE_USER"
    elif user["status"] == "active" and user["subscription"] == "free":
        return "FREE_ACTIVE_USER"
    elif user["status"] == "inactive":
        return "INACTIVE_USER"
    else:
        return "UNKNOWN_USER"
```

Issues: repeated `user["status"] == "active"` check, magic strings, no constants.

**After refactor (GREEN and clean):**

```python
STATUS_ACTIVE = "active"
STATUS_INACTIVE = "inactive"
SUBSCRIPTION_PREMIUM = "premium"

LABEL_PREMIUM_ACTIVE = "PREMIUM_ACTIVE_USER"
LABEL_FREE_ACTIVE = "FREE_ACTIVE_USER"
LABEL_INACTIVE = "INACTIVE_USER"
LABEL_UNKNOWN = "UNKNOWN_USER"

def get_user_label(user):
    if user["status"] == STATUS_INACTIVE:
        return LABEL_INACTIVE
    if user["status"] != STATUS_ACTIVE:
        return LABEL_UNKNOWN
    return _label_for_active_user(user["subscription"])

def _label_for_active_user(subscription):
    if subscription == SUBSCRIPTION_PREMIUM:
        return LABEL_PREMIUM_ACTIVE
    return LABEL_FREE_ACTIVE
```

All tests pass identically before and after.

---

## Coverage Gap Analysis (`:coverage`)

### Step 1: Discover Test Structure

1. Glob for test files matching project conventions (`test_*.py`, `*.test.ts`, `*_test.go`)
2. Read test files to understand current coverage
3. Glob for source files to identify what's tested vs untested

### Step 2: Identify Gaps

For each source module, check:
- Does a corresponding test file exist?
- Are public functions/methods tested?
- Are error paths tested?
- Are edge cases covered (empty input, null, boundary values)?

### Step 3: Generate Missing Tests

For each gap, generate a test that:
- Follows the project's existing test patterns and framework
- Covers the happy path AND at least one error path
- Uses descriptive names: `test_<function>_<scenario>`

### Step 4: Output

```markdown
## Coverage Gap Analysis

### Fully Tested (N modules)
- auth/login.py — 8 tests covering all public methods

### Partially Tested (N modules)
- orders/service.py — 3/7 public methods tested
  Missing: cancel_order, refund_order, bulk_create, export_csv

### Untested (N modules)
- notifications/email.py — 0 tests
- reports/generator.py — 0 tests

### Generated Tests
Created N new test files with M test cases.
```

### Coverage Commands by Language

Run these to get line-level coverage reports before analyzing gaps:

- **Python:** `pytest --cov=src --cov-report=term-missing`
  Shows each file's coverage % and the specific line numbers not covered.
- **JavaScript/TypeScript (Vitest):** `npx vitest --coverage`
  Generates an HTML report in `coverage/` and a terminal summary.
- **JavaScript/TypeScript (Jest):** `npx jest --coverage`
- **Go:** `go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out`
  The `-html` flag opens a browser view with covered/uncovered lines highlighted.
- **Rust:** `cargo tarpaulin --out Html`
  Requires `cargo install cargo-tarpaulin`. Generates `tarpaulin-report.html`.

### Coverage Target Guidelines

- **Application/feature code:** 80% line coverage minimum. Below 80% indicates untested branches or paths that will become bugs.
- **Library/utility code:** 95%+ line coverage. Libraries are called by others who cannot inspect the internals — every public function must be tested.
- **Generated code, migrations, configuration:** exclude from coverage targets. Coverage of auto-generated code is noise.

### Identifying Meaningful Gaps vs. Trivial Coverage

Not all uncovered lines represent equal risk. Prioritize gaps in this order:

1. **Error handling paths** — uncovered `except`, `catch`, `else` on error conditions. These are the paths that fire in production under stress.
2. **Boundary conditions** — uncovered branches for empty input, zero, negative numbers, max values.
3. **Business logic branches** — uncovered `if/elif/else` inside core domain functions.
4. **Boilerplate lines** — uncovered `import` statements, `__init__` methods, logging calls. These are low priority and can often be excluded from the coverage report.

When coverage reports show a gap, read the uncovered lines and ask: "If this line were wrong, would a user notice?" If yes, write a test. If no, consider excluding it.

---

## Characterization Tests (`:characterize`)

### Purpose

Characterization tests document EXISTING behavior of legacy code — they don't assert what the code SHOULD do, they assert what it DOES do. This creates a safety net for refactoring.

### Step 1: Identify Target

Read the specified code (file or function). Understand:
- All inputs and outputs
- Side effects (database writes, HTTP calls, file I/O)
- Error conditions

### Step 2: Write Tests

For each public function/method:
1. Call it with representative inputs
2. Assert the ACTUAL output (even if it seems wrong)
3. Document any surprising behavior with comments
4. Cover the main paths: happy, error, edge cases

### Step 3: Verify

Run the tests — they MUST all pass (they document current behavior).

If a test fails, the code is non-deterministic or has external dependencies that need mocking.

### Output Format

```python
class TestLegacyPricingEngine:
    """Characterization tests for PricingEngine.

    These tests document EXISTING behavior, not DESIRED behavior.
    If a test breaks during refactoring, the refactoring changed behavior.
    """

    def test_calculate_price_standard_item(self):
        # CURRENT BEHAVIOR: standard items get 0% discount
        result = engine.calculate(item="widget", qty=1)
        assert result == 9.99  # captures current behavior

    def test_calculate_price_negative_qty_returns_zero(self):
        # NOTE: arguably a bug, but this is the current behavior
        result = engine.calculate(item="widget", qty=-1)
        assert result == 0.0
```

### Complete Example: Characterizing a CSV Parser

Suppose you have a legacy `parse_csv` function with unknown edge case behavior:

```python
# Legacy function under test — do not modify
def parse_csv(text):
    rows = []
    for line in text.strip().split("\n"):
        rows.append(line.split(","))
    return rows
```

Run it manually with various inputs, observe outputs, then lock them in:

```python
class TestParseCsvCharacterization:
    """Characterization tests for the legacy parse_csv function.

    IMPORTANT: These tests lock in current behavior for safe refactoring.
    Some behaviors below may be bugs — do not fix them here.
    """

    def test_parse_csv_simple_row(self):
        result = parse_csv("a,b,c")
        assert result == [["a", "b", "c"]]

    def test_parse_csv_multiple_rows(self):
        result = parse_csv("a,b\nc,d")
        assert result == [["a", "b"], ["c", "d"]]

    def test_parse_csv_empty_string_returns_empty_list(self):
        # NOTE: strip() on "" gives "", split("\n") gives [""], split(",") gives [[""]]
        result = parse_csv("")
        assert result == [[""]]  # surprising but current behavior

    def test_parse_csv_trailing_newline_ignored(self):
        # strip() removes the trailing newline before split
        result = parse_csv("a,b\n")
        assert result == [["a", "b"]]

    def test_parse_csv_quoted_fields_not_handled(self):
        # NOTE: quotes are NOT stripped — this is a known limitation
        result = parse_csv('"hello","world"')
        assert result == [['"hello"', '"world"']]

    def test_parse_csv_empty_fields_preserved(self):
        result = parse_csv("a,,c")
        assert result == [["a", "", "c"]]
```

### Golden Master Pattern

For functions with complex or large output (renderers, serializers, report generators):

1. Run the function once and capture the output
2. Save the output to a file: `tests/golden/report_output.txt`
3. Assert equality on every future run:

```python
def test_report_generator_golden_master():
    actual = generate_report(sample_data)
    golden_path = Path("tests/golden/report_output.txt")
    # To regenerate: delete the file and run once
    if not golden_path.exists():
        golden_path.write_text(actual)
    assert actual == golden_path.read_text()
```

### When NOT to Characterize

Skip characterization tests when:
- You already understand the behavior well enough to write specification tests (what it SHOULD do)
- The function has no external callers and will be deleted
- The code is already covered by existing unit tests with meaningful assertions
- The output is non-deterministic (timestamps, random IDs) — golden master won't work

Characterization tests are a means to an end: safe refactoring. Once the code is clean and spec-tested, the characterization tests can be retired.

---

## Mutation Testing Analysis (`:mutate`)

### Concept

Mutation testing modifies your production code (mutants) and checks if your tests catch the changes. If a test suite passes with a mutant alive, the tests are weak.

### Step 1: Identify Mutation Targets

Read the source code and identify:
- Conditional operators (`==`, `!=`, `<`, `>`, `<=`, `>=`)
- Boolean operators (`and`/`or`, `&&`/`||`)
- Return values (true/false, 0/1, null/non-null)
- Boundary values (+1/-1 in ranges)
- Function calls (remove or replace)

### Step 2: Conceptual Mutation Analysis

For each function, describe which mutations would survive:

```markdown
## Mutation Analysis: calculate_discount()

| Line | Original | Mutant | Survived? | Assessment |
|------|----------|--------|-----------|------------|
| 12 | `qty > 10` | `qty >= 10` | YES | Missing boundary test for qty=10 |
| 15 | `return price * 0.9` | `return price * 0.8` | NO | Caught by test_bulk_discount |
| 18 | `if active:` | `if not active:` | NO | Caught by test_inactive_user |
| 22 | `return 0` | `return 1` | YES | No test covers the zero-quantity path |

**Mutation Score:** 75% (3/4 mutants killed)
**Weak Spots:** Lines 12, 22 — need additional boundary and zero-input tests
```

### Step 3: Generate Killing Tests

For each surviving mutant, write a test that would kill it.

### Common Mutation Types

Understanding mutation categories helps you read reports and write stronger tests:

- **Boundary mutations**: `>` becomes `>=`, `<` becomes `<=`, `+1` becomes `-1`. These catch off-by-one errors. Kill them with tests that exercise the exact boundary value.
- **Boolean negation**: `if active:` becomes `if not active:`. Kill by testing both true and false states of every boolean condition.
- **Constant replacement**: `return 0` becomes `return 1`, `return None` becomes `return ""`. Kill by asserting the exact return value, not just that the function returns something.
- **Operator replacement**: `+` becomes `-`, `*` becomes `/`. Kill with tests where the difference in behavior is observable (avoid tests where both operators give the same result).
- **Statement deletion**: the entire line is removed. Kill by asserting the side effect the line causes (e.g., a field was set, a function was called).

### How to Read Mutation Reports

Mutation tools report a **mutation score**: the percentage of mutants killed by your tests.

```
Mutation score: 82% (164/200 mutants killed)
```

Interpret the score as follows:
- **90%+** — strong test suite; tests verify specific behavior, not just that code runs
- **70–89%** — acceptable for most application code; look for patterns in surviving mutants
- **Below 70%** — tests are checking presence, not correctness; add value assertions
- **100%** — excellent for library code; may be impractical for application code with complex side effects

Surviving mutants cluster around weak assertions. If 10 mutants survive in the same function, that function has no tests asserting its output value.

### Weak vs. Strong Assertions

Mutation testing reveals the difference between assertions that merely confirm execution and assertions that verify correctness.

**Weak assertion (many mutants survive):**
```python
def test_fetch_user():
    result = fetch_user(user_id=1)
    assert result is not None  # passes even if wrong data is returned
```

**Strong assertion (mutants are killed):**
```python
def test_fetch_user():
    result = fetch_user(user_id=1)
    assert result == {"id": 1, "name": "Alice", "role": "admin"}
```

The weak version will not catch a mutant that changes `user_id` filtering logic. The strong version will.

### Tools by Language

| Language | Tool | Install | Run |
|----------|------|---------|-----|
| Python | mutmut | `pip install mutmut` | `mutmut run && mutmut results` |
| JavaScript/TypeScript | Stryker | `npm install --save-dev @stryker-mutator/core` | `npx stryker run` |
| Java | PIT (pitest) | Maven/Gradle plugin | `mvn org.pitest:pitest-maven:mutationCoverage` |
| Rust | cargo-mutants | `cargo install cargo-mutants` | `cargo mutants` |

---

## Hard Constraints
- In `:cycle` mode, NEVER write production code before a failing test
- In `:characterize` mode, tests must pass against CURRENT code (they document reality)
- In `:mutate` mode, clearly distinguish conceptual analysis from actual mutation runs
- Always use the project's existing test framework — detect from existing test files
- Never delete or modify existing passing tests
