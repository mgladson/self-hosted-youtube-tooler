---
name: complexity-analyzer
description: "Code complexity analysis: cyclomatic complexity per function, cognitive complexity (nesting/flow breaks), afferent/efferent coupling metrics, and git churn hotspot detection. Sub-commands: /complexity-analyzer:cyclomatic, :cognitive, :coupling, :hotspots. Use when identifying refactoring targets, reviewing code quality, or analyzing technical debt."
---

# Complexity Analyzer

You are executing the `/complexity-analyzer` skill. You apply software complexity analysis for cyclomatic, cognitive, coupling, and hotspot detection.

Parse the sub-command from the user's invocation:
- `/complexity-analyzer` → show **menu** and wait for selection
- `/complexity-analyzer:cyclomatic` → **Cyclomatic Complexity**
- `/complexity-analyzer:cognitive` → **Cognitive Complexity**
- `/complexity-analyzer:coupling` → **Coupling Analysis**
- `/complexity-analyzer:hotspots` → **Hotspot Detection**

---

## Menu (no sub-command)

```
Complexity Analyzer — Choose a topic:

1. cyclomatic — Cyclomatic complexity per function, threshold enforcement
2. cognitive  — Cognitive complexity (nesting, flow breaks), readability
3. coupling   — Afferent/efferent coupling, instability metrics
4. hotspots   — Git churn × complexity = high-priority refactor targets
```

---

## Cyclomatic Complexity (`:cyclomatic`)

### Definition
```
Cyclomatic complexity = number of independent paths through code
Each decision point adds 1: if, else, for, while, case, &&, ||, catch, ?:

Thresholds:
  1-5:   Simple, easy to test
  6-10:  Moderate, needs good test coverage
  11-20: Complex, consider refactoring
  21+:   Very complex, must refactor
```

### Tools
```bash
# Python: radon
pip install radon
radon cc src/ -s -a -n C  # Show functions with complexity >= C

# JavaScript/TypeScript: eslint complexity rule
# .eslintrc: { "rules": { "complexity": ["error", 10] } }

# Go: gocyclo
go install github.com/fzipp/gocyclo/cmd/gocyclo@latest
gocyclo -over 10 .

# Java: PMD
pmd check -d src -R rulesets/java/design.xml -f text
```

### Refactoring Pattern
```python
# High complexity (CC=12)
def process_order(order):
    if order.status == 'new':
        if order.total > 100:
            if order.user.is_premium:
                discount = 0.2
            else:
                discount = 0.1
        else:
            discount = 0
        if order.has_coupon:
            discount += order.coupon.value
        order.apply_discount(discount)
        if order.payment_method == 'card':
            charge_card(order)
        elif order.payment_method == 'paypal':
            charge_paypal(order)
        else:
            raise ValueError("Unknown payment")

# Decomposed (each function CC=2-3)
def process_order(order):
    if order.status != 'new':
        return
    discount = calculate_discount(order)
    order.apply_discount(discount)
    charge_payment(order)

def calculate_discount(order):
    base = 0.2 if order.user.is_premium else 0.1 if order.total > 100 else 0
    coupon = order.coupon.value if order.has_coupon else 0
    return base + coupon

def charge_payment(order):
    handlers = {'card': charge_card, 'paypal': charge_paypal}
    handler = handlers.get(order.payment_method)
    if not handler:
        raise ValueError(f"Unknown payment: {order.payment_method}")
    handler(order)
```

### Additional Refactoring Patterns

**Replace conditionals with polymorphism:**
```python
# Bad: long if/elif chain selecting behavior by type
def calculate_area(shape):
    if shape.type == 'circle':
        return math.pi * shape.radius ** 2
    elif shape.type == 'rectangle':
        return shape.width * shape.height
    elif shape.type == 'triangle':
        return 0.5 * shape.base * shape.height
    # Adding a new shape requires modifying this function

# Good: polymorphism — each shape knows how to compute its area
class Circle:
    def area(self): return math.pi * self.radius ** 2

class Rectangle:
    def area(self): return self.width * self.height

class Triangle:
    def area(self): return 0.5 * self.base * self.height

# Adding a new shape requires no changes here
def calculate_area(shape):
    return shape.area()
```

**Extract method for each branch:**
```python
# Bad: one method handles every case (CC=8)
def handle_event(event):
    if event.type == 'login':
        # 10 lines of login logic
    elif event.type == 'logout':
        # 8 lines of logout logic
    elif event.type == 'purchase':
        # 15 lines of purchase logic

# Good: dispatch to dedicated handlers (CC=2 for dispatcher, low CC per handler)
def handle_event(event):
    handlers = {
        'login': handle_login,
        'logout': handle_logout,
        'purchase': handle_purchase,
    }
    handler = handlers.get(event.type)
    if handler:
        handler(event)
```

**Use strategy pattern to remove switch statements:**
```typescript
// Bad: switch that will grow with every new payment method
function processPayment(method: string, amount: number) {
  switch (method) {
    case 'card': return chargeCard(amount);
    case 'paypal': return chargePayPal(amount);
    case 'crypto': return chargeCrypto(amount);
    default: throw new Error(`Unknown method: ${method}`);
  }
}

// Good: strategy pattern — register handlers, never touch core dispatch logic
type PaymentStrategy = (amount: number) => Promise<Receipt>;

const strategies = new Map<string, PaymentStrategy>([
  ['card', chargeCard],
  ['paypal', chargePayPal],
  ['crypto', chargeCrypto],
]);

function processPayment(method: string, amount: number) {
  const strategy = strategies.get(method);
  if (!strategy) throw new Error(`Unknown method: ${method}`);
  return strategy(amount);
}
```

### Language-Specific Tools
```bash
# Python: radon with average and per-function detail
radon cc -a -s src/               # Average complexity across all files
radon cc -a -s src/ --min C       # Only show functions with CC >= C (10)
radon cc -a -s src/ --json        # JSON output for CI integration

# Go: gocyclo
gocyclo -over 10 ./...            # Report functions with CC > 10
gocyclo -avg ./...                # Show average complexity for each package

# JavaScript/TypeScript: ESLint complexity rule
# .eslintrc.json:
{
  "rules": {
    "complexity": ["error", { "max": 10 }]
  }
}
# Run: npx eslint src/ --rule 'complexity: [error, 10]'

# Ruby: flog
gem install flog
flog lib/                          # Higher score = more complex
```

---

## Cognitive Complexity (`:cognitive`)

### Definition
```
Cognitive complexity measures how hard code is to UNDERSTAND (not just test).
Increments for:
  +1: if, else, for, while, catch, switch, &&, ||, goto
  +nesting: each level of nesting adds to the increment

Key difference from cyclomatic:
  - Penalizes nesting (deeply nested code is harder to read)
  - Ignores shorthand (ternary doesn't add as much as if/else)
  - Rewards linear flow (early returns reduce nesting)
```

### Example
```python
# Cognitive complexity = 15 (high nesting)
def find_user(users, criteria):        # 0
    for user in users:                 # +1 (for)
        if user.active:                # +2 (if, nesting=1)
            if criteria.name:          # +3 (if, nesting=2)
                if user.name == criteria.name:  # +4 (if, nesting=3)
                    return user        # found!
            if criteria.email:         # +3 (if, nesting=2)
                if user.email == criteria.email: # +4 (if, nesting=3)
                    return user
    return None

# Cognitive complexity = 5 (flat, early returns)
def find_user(users, criteria):
    for user in users:                 # +1
        if not user.active:            # +2 (nesting=1)
            continue                   # +1 (continue)
        if matches_criteria(user, criteria):  # +2 (nesting=1)
            return user
    return None

def matches_criteria(user, criteria):
    if criteria.name and user.name != criteria.name:
        return False
    if criteria.email and user.email != criteria.email:
        return False
    return True
```

### Cognitive Complexity Scoring Example
```
Scoring rules (SonarSource model):
  Each structural keyword encountered: +1
  Each additional nesting level at time of increment: +N (where N = current depth)
  Labeled break/continue: +1 extra

Example walkthrough:

function processData(items) {             // depth=0
  for (const item of items) {            // +1 (for, depth=0), depth becomes 1
    if (item.active) {                   // +2 (if at depth=1), depth becomes 2
      if (item.value > 0) {             // +3 (if at depth=2), depth becomes 3
        for (const tag of item.tags) {  // +4 (for at depth=3), depth becomes 4
          if (tag === 'priority') {     // +5 (if at depth=4)
            process(item);
          }
        }
      }
    }
  }
}
// Total cognitive complexity = 1+2+3+4+5 = 15
```

### Before/After: Cognitive Complexity Reduction via Early Return
```typescript
// Before: cognitive complexity = 14 (deeply nested)
function getDiscount(user: User, order: Order): number {
  if (user) {
    if (user.isActive) {
      if (order) {
        if (order.total > 100) {
          if (user.isPremium) {
            return 0.25;
          } else {
            return 0.10;
          }
        } else {
          return 0;
        }
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  } else {
    return 0;
  }
}

// After: cognitive complexity = 4 (early returns flatten nesting)
function getDiscount(user: User, order: Order): number {
  if (!user || !user.isActive) return 0;   // +1
  if (!order) return 0;                     // +1
  if (order.total <= 100) return 0;         // +1
  return user.isPremium ? 0.25 : 0.10;     // +1 (ternary)
}
```

---

## Coupling Analysis (`:coupling`)

### Metrics
```
Afferent Coupling (Ca): Number of modules that depend ON this module
  High Ca = many dependents = risky to change (high impact)

Efferent Coupling (Ce): Number of modules this module depends ON
  High Ce = many dependencies = fragile (breaks when deps change)

Instability = Ce / (Ca + Ce)
  0.0 = maximally stable (many depend on it, it depends on nothing)
  1.0 = maximally unstable (nothing depends on it, many dependencies)

Stable Abstractions Principle:
  Stable modules (low I) should be abstract (interfaces)
  Unstable modules (high I) should be concrete (implementations)
```

### Analysis Process
```
1. For each module/package, count:
   - Incoming imports (Ca)
   - Outgoing imports (Ce)
2. Calculate Instability ratio
3. Flag violations:
   - Stable concrete modules → should be abstract
   - Unstable abstract modules → should be concrete
   - Circular dependencies → must break
```

### Dependency Graph Visualization
```bash
# madge: visualize JavaScript/TypeScript module dependencies
npm install -g madge

# Generate SVG dependency graph
madge --image deps.svg src/

# Find circular dependencies
madge --circular src/

# Show what depends on a specific file
madge --depends src/utils/auth.ts src/

# Generate JSON for further analysis
madge --json src/ > deps.json
```

### Package-Level Coupling Analysis
```
Analyze coupling at the package/module boundary, not just file level:

1. Group files by package/feature folder
2. Count inter-package imports:
   - How many packages does feature/auth import from?  (Ce)
   - How many packages import from feature/auth?       (Ca)
3. Flag packages where Ce > 5 (too many outgoing dependencies)
4. Flag packages with circular imports between them

Tools for package-level analysis:
  Python: pydeps package-name --show-deps
  Java:   jdeps --module-path . --multi-release 17 app.jar
  Go:     go mod graph | grep direct
  JS/TS:  madge --json src/ | jq '.["src/features/auth"]'
```

### Refactoring to Reduce Coupling
```
Dependency Injection:
  Instead of a module creating its own dependencies (hard coupling),
  receive them as constructor/function parameters.
  This makes dependencies explicit and swappable (for testing).

  // Bad: hard-coded dependency
  class OrderService {
    private db = new PostgresDatabase();  // directly coupled to Postgres
  }

  // Good: injected dependency
  class OrderService {
    constructor(private db: Database) {}  // depends on interface, not impl
  }

Event Bus / Message Passing:
  Instead of module A calling module B directly,
  A emits an event and B subscribes.
  Eliminates the direct import/coupling entirely.

  // Bad: UserService directly calls NotificationService
  userService.createUser(data);
  notificationService.sendWelcomeEmail(data.email);  // tight coupling

  // Good: event bus decouples them
  eventBus.emit('user.created', { email: data.email });
  // NotificationService subscribes independently

Interface Extraction:
  Define an interface/protocol/abstract class in a shared module.
  Both the caller and implementation depend on the interface,
  not on each other — this breaks direct coupling.
```

---

## Hotspot Detection (`:hotspots`)

### Git Churn + Complexity = Refactoring Priority
```bash
# Find files changed most frequently (last 6 months)
git log --since="6 months ago" --format=format: --name-only | \
  sort | uniq -c | sort -rn | head -20

# Combine with complexity data:
# High churn + High complexity = TOP PRIORITY refactor target
# High churn + Low complexity  = OK (frequently changed but simple)
# Low churn  + High complexity = Lower priority (complex but stable)
# Low churn  + Low complexity  = No action needed
```

### Prioritization Matrix
```
           High Complexity    Low Complexity
High Churn   REFACTOR NOW      OK (watch)
Low Churn    MONITOR            IGNORE
```

### Complete Git Churn + Complexity Analysis Script
```bash
#!/bin/bash
# Find the top 20 files by change frequency (churn) in the last 6 months
# Output: count filename

git log --format=format: --name-only | \
  sort | uniq -c | sort -rg | head -20

# Extended version: last N days, exclude deleted files, exclude test files
git log --since="180 days ago" --format=format: --name-only \
  -- '*.py' '*.ts' '*.go' \
  | grep -v '^$' \
  | grep -v 'test\|spec\|_test' \
  | sort | uniq -c | sort -rg | head -20

# Cross-reference with radon complexity (Python example):
# 1. Get top churned files:
CHURNED=$(git log --format=format: --name-only | sort | uniq -c | sort -rg | head -20 | awk '{print $2}')
# 2. Run complexity on each:
for f in $CHURNED; do
  echo "=== $f ==="
  radon cc "$f" -s -a 2>/dev/null
done
```

### Hotspot Prioritization Matrix — Detailed
```
Quadrant definitions:

HIGH CHURN + HIGH COMPLEXITY (top priority — refactor now):
  - Changed frequently AND hard to understand
  - Every change risks introducing bugs
  - Developers slow down here due to difficulty
  - Fix: extract functions, reduce complexity before next feature

HIGH CHURN + LOW COMPLEXITY (monitor):
  - Changed frequently but easy to understand
  - Low defect risk, but worth watching for complexity growth
  - Action: add tests if not covered, monitor trend

LOW CHURN + HIGH COMPLEXITY (defer):
  - Complex code but rarely touched
  - Lower risk: hard to change, but no one needs to
  - Action: document it thoroughly, add tests before any future change

LOW CHURN + LOW COMPLEXITY (ignore):
  - Simple code that rarely changes
  - No action needed
```

### Tracking Hotspot Reduction Over Sprints
```bash
# Capture a complexity snapshot at the start of each sprint
radon cc src/ -s --json > complexity-sprint-$(date +%Y%m%d).json

# Compare snapshots between sprints to measure improvement:
# 1. Get average complexity before:
cat complexity-sprint-20240101.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
scores = [block['complexity'] for file in data.values() for block in file]
print(f'Average: {sum(scores)/len(scores):.2f}, Max: {max(scores)}')"

# Track as a CI metric:
# - Report average function complexity on each PR
# - Fail if new functions introduced with CC > 10
# - Report trend (up/down/stable) in weekly engineering review

# Git churn snapshot (compare 6 months ago vs 3 months ago vs current):
git log --since="6 months ago" --until="3 months ago" --format=format: --name-only \
  | sort | uniq -c | sort -rg | head -10 > churn-6mo.txt

git log --since="3 months ago" --format=format: --name-only \
  | sort | uniq -c | sort -rg | head -10 > churn-3mo.txt

diff churn-6mo.txt churn-3mo.txt  # Did the hot files change?
```

---

## Hard Constraints
- Functions with cyclomatic complexity > 15 must be refactored before merge
- Cognitive complexity > 20 requires refactoring
- Circular dependencies must be broken immediately
- Hotspot analysis should drive refactoring sprints, not random cleanup
- Complexity metrics must be tracked in CI (fail build above thresholds)
- Cyclomatic complexity > 10 per function requires a refactor before the PR can be merged — no exceptions without explicit tech lead sign-off; the fix should be part of the same PR, not a follow-up ticket
- Never increase the complexity of an already-complex module (complexity ratchet): if a file is already at CC=18, any new PR that raises it further must be rejected until the existing complexity is reduced first; complexity debt compounds and must not be allowed to grow indefinitely
