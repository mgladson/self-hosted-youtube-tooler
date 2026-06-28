---
name: test-gen
description: "Automated test generation: unit tests, integration tests, e2e tests, snapshot tests, and property-based tests. Auto-detects test framework from project. Sub-commands: /test-gen:unit, :integration, :e2e, :snapshot, :property. Use when generating tests, improving coverage, or scaffolding test suites."
---

# Test Generator

You are executing the `/test-gen` skill. You generate tests following the project's existing patterns and test framework.

Parse the sub-command from the user's invocation:
- `/test-gen` → show **menu** and wait for selection
- `/test-gen:unit` → **Unit Tests**
- `/test-gen:integration` → **Integration Tests**
- `/test-gen:e2e` → **End-to-End Tests**
- `/test-gen:snapshot` → **Snapshot Tests**
- `/test-gen:property` → **Property-Based Tests**

---

## Menu (no sub-command)

```
Test Generator — Choose a type:

1. unit        — Unit tests for functions/methods (isolated, fast)
2. integration — Integration tests with real dependencies (DB, APIs)
3. e2e         — End-to-end tests for user flows (Playwright/Cypress)
4. snapshot    — Snapshot/golden file tests for output stability
5. property    — Property-based tests for invariants (Hypothesis/proptest)
```

---

## Step 0: Detect Test Framework

1. Glob for existing test files to determine framework:
   - `test_*.py` / `conftest.py` → **pytest**
   - `*.test.ts` / `*.spec.ts` → **Vitest or Jest** (check vitest.config or jest.config)
   - `*_test.go` → **go test**
   - `*.test.java` / `*.Test.java` → **JUnit 5**
   - `*Test.cs` / `*Tests.cs` → **xUnit**
   - `*Test.php` → **PHPUnit or Pest**
2. Read 1-2 existing test files to learn project conventions (naming, structure, imports)
3. Use the SAME patterns for generated tests

---

## Unit Tests (`:unit`)

### Step 1: Identify Target

If `$ARGUMENTS` specifies a file → test all public functions in that file.
If no argument → ask user which file/function to test.

### Step 2: Analyze Functions

For each public function/method:
- Identify input types and return type
- Identify branches/conditions (each branch needs a test)
- Identify error paths (invalid input, missing data)
- Identify edge cases (empty, null, boundary values)

### Step 3: Generate Tests

For each function, generate:
1. **Happy path** — normal input, expected output
2. **Edge cases** — empty input, boundary values, maximum values
3. **Error path** — invalid input, expected errors

Follow project conventions for:
- File naming and location
- Import style
- Assertion library
- Test organization (describe/it vs flat test functions)

### Test Naming Convention

Use the format: `test_<function>_<scenario>_<expected_result>`

Examples:
- `test_calculate_discount_bulk_order_returns_ten_percent`
- `test_parse_email_missing_at_sign_raises_value_error`
- `test_get_user_unknown_id_returns_none`

This naming convention makes test output self-documenting — when a test fails, the name alone describes what broke.

### Framework-Specific Examples

**pytest — parametrize for data-driven tests:**
```python
import pytest
from myapp.math import clamp

@pytest.mark.parametrize("value, low, high, expected", [
    (5,  0, 10,  5),   # within range — unchanged
    (-3, 0, 10,  0),   # below min — clamped to min
    (15, 0, 10, 10),   # above max — clamped to max
    (0,  0, 10,  0),   # exactly at min boundary
    (10, 0, 10, 10),   # exactly at max boundary
])
def test_clamp_returns_value_within_bounds(value, low, high, expected):
    assert clamp(value, low, high) == expected
```

**Jest — describe/it structure:**
```typescript
import { clamp } from '../math';

describe('clamp', () => {
  it('returns value unchanged when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns min when value is below range', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('returns max when value is above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it.each([
    [0, 0, 10, 0],
    [10, 0, 10, 10],
  ])('handles boundary value %i in [%i, %i]', (value, low, high, expected) => {
    expect(clamp(value, low, high)).toBe(expected);
  });
});
```

**Go — table-driven tests:**
```go
func TestClamp(t *testing.T) {
    tests := []struct {
        name     string
        value    int
        low, high int
        want     int
    }{
        {"within range", 5, 0, 10, 5},
        {"below min", -3, 0, 10, 0},
        {"above max", 15, 0, 10, 10},
        {"at min boundary", 0, 0, 10, 0},
        {"at max boundary", 10, 0, 10, 10},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Clamp(tt.value, tt.low, tt.high)
            if got != tt.want {
                t.Errorf("Clamp(%d, %d, %d) = %d; want %d",
                    tt.value, tt.low, tt.high, got, tt.want)
            }
        })
    }
}
```

**JUnit 5 — @ParameterizedTest:**
```java
@ParameterizedTest(name = "clamp({0}, {1}, {2}) == {3}")
@CsvSource({
    "5,  0, 10,  5",
    "-3, 0, 10,  0",
    "15, 0, 10, 10",
    "0,  0, 10,  0",
    "10, 0, 10, 10",
})
void clamp_returnsValueWithinBounds(int value, int low, int high, int expected) {
    assertEquals(expected, MathUtils.clamp(value, low, high));
}
```

### Mocking Strategy

Use real implementations by default. Reach for mocks only when:

- **The dependency is slow**: databases, HTTP services, file system I/O — mock to keep unit tests fast
- **The dependency has side effects**: sending emails, charging credit cards — mock to prevent production actions during tests
- **The dependency is non-deterministic**: `datetime.now()`, random number generators — mock to make tests reproducible
- **You want to test a specific error path**: simulate a network timeout or a DB constraint violation that is hard to reproduce with real infrastructure

Do NOT mock:
- Pure functions and value objects — use the real thing
- Internal collaborators in the same module — test them together
- Data structures (lists, dicts, DTOs) — construct them directly

---

## Integration Tests (`:integration`)

Generate tests that exercise real dependencies:
- **Database**: create/read/update/delete with test database
- **HTTP APIs**: real HTTP calls to test endpoints
- **File system**: temporary files and directories
- **External services**: use testcontainers or mock servers

Include setup/teardown:
- Database migrations and seed data
- Test isolation (transactions or cleanup)
- Environment configuration

### Database Integration — pytest + SQLAlchemy

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from myapp.models import Base, User
from myapp.repositories import UserRepository

@pytest.fixture(scope="session")
def engine():
    engine = create_engine("sqlite:///./test.db")
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture
def session(engine):
    """Each test gets a fresh transaction that is rolled back afterward."""
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()
    yield session
    session.close()
    transaction.rollback()
    connection.close()

def test_create_user_persists_to_database(session):
    repo = UserRepository(session)
    user = repo.create(name="Alice", email="alice@example.com")
    found = repo.find_by_id(user.id)
    assert found.name == "Alice"
    assert found.email == "alice@example.com"

def test_find_by_email_returns_none_for_unknown(session):
    repo = UserRepository(session)
    result = repo.find_by_email("nobody@example.com")
    assert result is None
```

**With Testcontainers (real PostgreSQL in Docker):**
```python
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:15") as pg:
        yield pg.get_connection_url()
```

### HTTP API Integration — httpx

```python
import pytest
import httpx
from myapp.main import app  # FastAPI or Starlette app

@pytest.fixture
def client():
    with httpx.Client(app=app, base_url="http://test") as client:
        yield client

def test_post_user_returns_201_with_created_resource(client):
    response = client.post("/users", json={"name": "Bob", "email": "bob@example.com"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Bob"
    assert "id" in body

def test_get_nonexistent_user_returns_404(client):
    response = client.get("/users/99999")
    assert response.status_code == 404
```

### Cleanup Strategies

Choose the right isolation strategy based on test speed and infrastructure:

| Strategy | When to use | How it works |
|----------|-------------|--------------|
| Transaction rollback | Unit/integration with ORM | Wrap each test in a transaction, rollback after |
| Table truncation | When rollback isn't possible | `TRUNCATE TABLE ... CASCADE` in teardown fixture |
| Docker container reset | Full isolation needed | Spin up a fresh container per test session |
| Temporary schema | PostgreSQL multi-tenant testing | Create a schema per test, drop after |

---

## E2E Tests (`:e2e`)

Generate browser-based tests using the project's framework:

**Playwright example:**
```typescript
test.describe('User Login Flow', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toHaveText('Welcome');
  });
});
```

**Cypress equivalent:**
```typescript
describe('User Login Flow', () => {
  it('successful login redirects to dashboard', () => {
    cy.visit('/login');
    cy.get('[data-testid="email"]').type('user@example.com');
    cy.get('[data-testid="password"]').type('password123');
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('include', '/dashboard');
    cy.get('h1').should('have.text', 'Welcome');
  });

  it('shows error message on invalid credentials', () => {
    cy.visit('/login');
    cy.get('[data-testid="email"]').type('user@example.com');
    cy.get('[data-testid="password"]').type('wrong-password');
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="error-message"]').should('be.visible');
    cy.url().should('include', '/login');  // did not navigate away
  });
});
```

### Page Object Model Pattern

Wrap page interactions in a class to avoid duplicating selectors across tests:

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
  }

  async getErrorMessage() {
    return this.page.locator('[data-testid="error-message"]').textContent();
  }
}

// tests/login.spec.ts
test('valid credentials redirect to dashboard', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');
  await expect(page).toHaveURL('/dashboard');
});
```

### Fixtures and Test Data Setup

```typescript
// playwright.config.ts — global setup
export default defineConfig({
  globalSetup: './global-setup.ts',
});

// global-setup.ts
export default async function globalSetup() {
  // Seed test database before the full suite
  await seedTestDatabase();
}

// Per-test fixture
test.beforeEach(async ({ page }) => {
  // Reset to a known state before each test
  await page.request.post('/api/test/reset');
});
```

---

## Snapshot Tests (`:snapshot`)

Generate snapshot/golden file tests:
- Capture output of a function/component and save as reference
- Future runs compare against the saved snapshot
- Useful for: serialization formats, rendered components, CLI output

### Jest Snapshot Example

```typescript
import { render } from '@testing-library/react';
import { UserCard } from '../UserCard';

test('UserCard renders correctly for active user', () => {
  const user = { name: 'Alice', role: 'Admin', status: 'active' };
  const { container } = render(<UserCard user={user} />);
  expect(container).toMatchSnapshot();
});
```

The first run creates `__snapshots__/UserCard.test.tsx.snap`. Subsequent runs compare against it.

**Updating snapshots** when intentional UI changes are made:
```bash
jest --updateSnapshot
# or short form:
jest -u
```

Review the diff carefully before committing updated snapshots — they represent a change in contract.

### When to Use Snapshot Tests

Use snapshots for:
- **CLI output**: the exact text a command prints to stdout
- **Serialized data**: JSON/XML output of a serializer where structure matters
- **Rendered components**: React/Vue component HTML output for regression detection
- **API response shapes**: the structure of a response payload (not values that change)

### When NOT to Use Snapshot Tests

Avoid snapshots for:
- **Output containing timestamps**: `"created_at": "2026-03-01T10:23:44Z"` will fail on every run
- **Output containing random or generated IDs**: UUIDs, session tokens, auto-increment IDs
- **Volatile output**: anything that changes legitimately between runs
- **Large blobs**: snapshots >100 lines become impossible to review meaningfully in code review

### Python Golden File Example

```python
# tests/conftest.py
from pathlib import Path

GOLDEN_DIR = Path(__file__).parent / "golden"

# tests/test_report.py
def test_generate_report_matches_golden_file():
    actual = generate_report(sample_data())
    golden_file = GOLDEN_DIR / "report.txt"

    if not golden_file.exists():
        # First run: create the golden file
        GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
        golden_file.write_text(actual)
        return  # pass on first run

    expected = golden_file.read_text()
    assert actual == expected, (
        f"Report output changed. If intentional, delete {golden_file} and re-run."
    )
```

Commit the `tests/golden/` directory. Any change to golden files in a PR diff signals a contract change that requires human review.

---

## Property-Based Tests (`:property`)

Generate invariant-based tests:
- **Round-trip**: serialize then deserialize returns original
- **Idempotency**: applying operation twice equals once
- **Monotonicity**: adding items never decreases total
- **Commutativity**: order of operations doesn't matter (where applicable)

### Python — Hypothesis

```python
from hypothesis import given, strategies as st
from myapp.codec import encode, decode

@given(st.text())
def test_encode_decode_roundtrip(original):
    """Encoding then decoding returns the original string for any input."""
    assert decode(encode(original)) == original

@given(st.lists(st.integers()))
def test_sort_is_idempotent(items):
    """Sorting an already-sorted list returns the same list."""
    once = sorted(items)
    twice = sorted(once)
    assert once == twice

@given(st.lists(st.integers(min_value=0)))
def test_sum_is_monotonic(items):
    """Adding a non-negative item never decreases the total."""
    if not items:
        return
    total = sum(items)
    extra = items[0]
    assert sum(items + [extra]) >= total
```

Run with: `pytest --hypothesis-show-statistics` to see how many examples were tested.

### JavaScript — fast-check

```typescript
import * as fc from 'fast-check';
import { encode, decode } from '../codec';

test('encode/decode roundtrip holds for any string', () => {
  fc.assert(
    fc.property(fc.string(), (original) => {
      expect(decode(encode(original))).toBe(original);
    })
  );
});

test('sort is idempotent', () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), (items) => {
      const once = [...items].sort((a, b) => a - b);
      const twice = [...once].sort((a, b) => a - b);
      expect(once).toEqual(twice);
    })
  );
});
```

### Rust — proptest

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn encode_decode_roundtrip(s in ".*") {
        let encoded = encode(&s);
        let decoded = decode(&encoded);
        prop_assert_eq!(decoded, s);
    }

    #[test]
    fn sort_is_idempotent(mut items in prop::collection::vec(any::<i32>(), 0..100)) {
        items.sort();
        let once = items.clone();
        items.sort();
        prop_assert_eq!(items, once);
    }
}
```

### Common Properties to Test

| Property | Description | Example |
|----------|-------------|---------|
| Round-trip | `decode(encode(x)) == x` | Serialization, compression, encryption |
| Idempotency | `f(f(x)) == f(x)` | Normalization, formatting, deduplication |
| Commutativity | `f(a, b) == f(b, a)` | Addition, set union, merge operations |
| Associativity | `f(f(a,b),c) == f(a,f(b,c))` | String concatenation, list append |
| Monotonicity | inputs grow → output doesn't shrink | Aggregations, sorting, filtering |
| Identity element | `f(x, identity) == x` | Addition with 0, multiplication with 1 |

### Shrinking

When a property test fails, the framework automatically finds the smallest failing example through a process called shrinking:

1. The test fails for input `["banana", "apple", "cherry", "date"]`
2. The framework tries smaller inputs: `["banana", "apple"]` — still fails
3. It keeps reducing: `["apple"]` — still fails
4. It reaches the minimal case: `["a"]` or even `[""]`

Shrinking makes property test failures actionable. Instead of debugging a failure with 100 random characters, you see the simplest input that reproduces it. Do not fight the shrinker — if a failing case looks absurdly simple, trust that it represents a real logic error.

---

## Hard Constraints
- ALWAYS match the project's existing test framework and patterns
- Never generate tests that import non-existent modules
- Include clear test names describing the scenario
- Tests must be independently runnable (no implicit ordering)
- Integration tests must handle setup and cleanup
