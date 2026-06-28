---
name: performance-profiler
description: "Performance profiling patterns: CPU flame graph analysis, memory leak detection, I/O bottleneck identification, database query optimization, and micro-benchmark setup. Sub-commands: /performance-profiler:cpu, :memory, :io, :database, :benchmark. Use when diagnosing performance issues, profiling applications, or optimizing hot paths."
---

# Performance Profiler

You are executing the `/performance-profiler` skill. You apply performance engineering best practices for CPU, memory, I/O, database, and benchmarking.

Parse the sub-command from the user's invocation:
- `/performance-profiler` → show **menu** and wait for selection
- `/performance-profiler:cpu` → **CPU Profiling**
- `/performance-profiler:memory` → **Memory Profiling**
- `/performance-profiler:io` → **I/O Analysis**
- `/performance-profiler:database` → **Database Optimization**
- `/performance-profiler:benchmark` → **Benchmarking**

---

## Menu (no sub-command)

```
Performance Profiler — Choose a topic:

1. cpu       — Flame graphs, hot path identification, CPU sampling
2. memory    — Leak detection, heap analysis, GC tuning
3. io        — I/O bottlenecks, connection pooling, async optimization
4. database  — Slow query analysis, EXPLAIN plans, index recommendations
5. benchmark — Micro-benchmark setup per language (pytest-benchmark, JMH, BenchmarkDotNet)
```

---

## CPU Profiling (`:cpu`)

### Python (cProfile + py-spy)
```bash
# py-spy: sampling profiler, no code changes needed
py-spy record -o profile.svg -- python app.py
py-spy top -- python app.py  # Live top-like view

# cProfile: deterministic profiler
python -m cProfile -o output.prof app.py
# Visualize: snakeviz output.prof
```

### Node.js
```bash
# Built-in profiler
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Clinic.js flame
npx clinic flame -- node app.js
```

### Go
```go
import _ "net/http/pprof"
// Access: http://localhost:6060/debug/pprof/
// go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
// (pprof) web  # Opens flame graph in browser
```

### Flame Graph Interpretation
```
Wide bars = time spent (optimize these first)
Deep stacks = many call layers (consider flattening)
Plateaus = single function dominating CPU

Action: Identify the widest bars, read bottom-up
  Bottom = entry point → Top = leaf functions (actual work)
  Focus on YOUR code, not framework internals
```

### Flame Graph Reading Guide
```
Wide bars (horizontal span):
  - Represent wall-clock or CPU time consumed by that function
  - The wider the bar, the more time is spent — these are your primary targets
  - A bar that spans >5% of the total width warrants investigation

Deep stacks (vertical height):
  - Represent nested call chains
  - Very deep stacks (>20 frames) suggest over-abstraction or recursive loops
  - Deep stacks are not always bad — frameworks have deep stacks by nature

"Flat top" pattern:
  - A wide bar with NO children bars on top
  - Means the function itself (not a callee) is doing the work
  - This is the most actionable finding — optimize this function directly

Reading strategy:
  1. Find the widest bars first (most time consumed)
  2. Trace upward to see which callers are responsible
  3. Look for flat tops — those are the true hotspots
  4. Ignore narrow bars (<1%) unless they appear repeatedly across many callers
```

### Language-Specific Profiling Commands
```bash
# Python: live top-like sampling (attach to running process)
py-spy top --pid <PID>

# Python: record and generate flame graph SVG
py-spy record -o profile.svg --pid <PID>

# Node.js: generate V8 profile log, then process it
node --prof app.js
node --prof-process isolate-0x*.log > processed.txt

# Go: serve pprof over HTTP, then visualize
# In code: import _ "net/http/pprof"
go tool pprof -http :8080 cpu.pb.gz
# Or capture 30s CPU profile:
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
```

### Hot Path Optimization Checklist
```
1. Avoid repeated allocations in loops
   - Pre-allocate buffers/slices outside the loop
   - Reuse objects via pool (sync.Pool in Go, object pools in JS)
   - Profile allocation rate, not just CPU time

2. Prefer value types over heap-allocated references where possible
   - Struct embedding vs. pointer indirection (Go)
   - Stack allocations are faster than heap allocations
   - Avoid boxing primitives in hot paths (Java/C#)

3. Batch operations to reduce overhead
   - Batch database writes instead of one row at a time
   - Batch API calls to reduce network round-trips
   - Use bulk inserts: INSERT INTO ... VALUES (...), (...), (...)

4. Minimize function call overhead in tight loops
   - Inline small utility functions where the compiler won't auto-inline
   - Avoid interface dispatch in hot paths (prefer concrete types)

5. Cache computed values
   - Memoize pure functions called repeatedly with same arguments
   - Pre-compute lookup tables for expensive transformations
```

---

## Memory Profiling (`:memory`)

### Python (tracemalloc + memray)
```python
import tracemalloc
tracemalloc.start()

# ... run workload ...

snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics('lineno')
for stat in top_stats[:10]:
    print(stat)
```

```bash
# memray: production memory profiler
python -m memray run app.py
python -m memray flamegraph memray-output.bin
```

### Node.js
```bash
# Heap snapshot
node --inspect app.js
# Chrome DevTools → Memory → Take Heap Snapshot

# Track allocations over time
node --expose-gc --max-old-space-size=512 app.js
```

### Common Leak Patterns
```
1. Unbounded caches (no eviction policy)
2. Event listeners not removed (addEventListener without removeEventListener)
3. Closures capturing large objects
4. Global collections that grow forever
5. Circular references preventing GC (weak references fix this)
```

### Common Leak Patterns — Extended
```
Global caches without eviction:
  - Any cache that only grows and never expires entries will leak
  - Fix: use LRU cache with a size cap (e.g., lru-cache in Node, functools.lru_cache in Python)
  - Fix: add TTL-based expiry to cached entries

Event listeners not removed:
  - Common in long-lived processes and SPA navigation
  - Fix: always pair addEventListener with removeEventListener in cleanup
  - Fix: use AbortController or WeakRef patterns to auto-clean

Circular references:
  - Object A holds reference to B, B holds reference to A — GC may not collect
  - Fix: use WeakMap / WeakRef in JavaScript for back-references
  - Fix: in Python, use weakref.ref() for parent references in tree structures
```

### Python tracemalloc Snapshot Analysis
```python
import tracemalloc

tracemalloc.start()

# ... run the code you want to profile ...

snapshot = tracemalloc.take_snapshot()

# Top 10 lines by memory usage
top_stats = snapshot.statistics('lineno')
print("[ Top 10 memory consumers ]")
for stat in top_stats[:10]:
    print(stat)

# Compare two snapshots to find what grew
snapshot1 = tracemalloc.take_snapshot()
# ... run more code ...
snapshot2 = tracemalloc.take_snapshot()
top_stats = snapshot2.compare_to(snapshot1, 'lineno')
for stat in top_stats[:10]:
    print(stat)
```

### Node.js Heap Snapshot Analysis with Chrome DevTools
```
1. Start Node with inspector: node --inspect app.js
2. Open Chrome → navigate to chrome://inspect
3. Click "Open dedicated DevTools for Node"
4. Go to Memory tab → select "Heap snapshot" → click "Take snapshot"
5. Look for:
   - Objects with high "Retained Size" — these hold the most memory
   - "(closure)" entries — may indicate leaked closures
   - Detached DOM nodes — elements removed from DOM but still referenced
6. Take two snapshots (before and after a suspected leak cycle)
   → Use "Comparison" view to see what objects were created and not released
```

---

## I/O Analysis (`:io`)

### Connection Pooling
```python
# Bad: new connection per request
async def get_user(user_id):
    conn = await asyncpg.connect(DATABASE_URL)
    user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    await conn.close()
    return user

# Good: connection pool
pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)

async def get_user(user_id):
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
```

### Async I/O Patterns
```python
# Sequential: 3 API calls take 3x latency
result_a = await fetch_service_a()
result_b = await fetch_service_b()
result_c = await fetch_service_c()

# Concurrent: 3 API calls take max(latency) time
result_a, result_b, result_c = await asyncio.gather(
    fetch_service_a(),
    fetch_service_b(),
    fetch_service_c()
)
```

---

## Database Optimization (`:database`)

### Slow Query Detection
```sql
-- PostgreSQL: find slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries > 100ms
SELECT pg_reload_conf();
```

### Index Recommendations
```sql
-- Find missing indexes (sequential scans on large tables)
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100 AND seq_tup_read > 10000
ORDER BY seq_tup_read DESC;
```

### EXPLAIN ANALYZE Output Interpretation
```sql
-- Run EXPLAIN ANALYZE to see actual execution plan
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 42 AND status = 'open';
```

```
Key terms to understand:

Seq Scan:
  - Full table scan — reads every row
  - Expected for small tables (<1000 rows) or when returning >20% of rows
  - Problem: when seen on large tables with selective WHERE clauses

Index Scan:
  - Uses an index to find matching rows directly
  - Much faster than Seq Scan for selective queries
  - Look for this on large tables with WHERE/JOIN conditions

cost=X..Y:
  - X = startup cost (before first row is returned)
  - Y = total estimated cost
  - These are planner estimates — compare with actual times

rows=N (estimated) vs. actual rows=M:
  - Large discrepancy means statistics are stale → run ANALYZE
  - Bad estimates lead to bad plan choices

Loops=N:
  - Node was executed N times (common in nested loop joins)
  - Multiply cost by loops to get true total cost
```

### Index Strategy
```sql
-- Composite index: put most selective column first
-- If querying WHERE status = 'open' AND user_id = 42
-- user_id is more selective (fewer matches) → put it first
CREATE INDEX idx_orders_user_status ON orders (user_id, status);

-- Partial index: index only rows matching a condition
-- Ideal when most queries filter on a common value
CREATE INDEX idx_orders_open ON orders (created_at)
  WHERE status = 'open';

-- Expression index: index on computed value
CREATE INDEX idx_users_lower_email ON users (lower(email));
-- Now this query can use the index:
-- SELECT * FROM users WHERE lower(email) = 'test@example.com';
```

### Connection Pool Sizing Formula
```
pool_size = (num_cores * 2) + effective_spindle_count

Where:
  num_cores             = number of CPU cores available to the database server
  effective_spindle_count = number of disk spindles (1 for SSD, count HDDs for HDD arrays)

Examples:
  4-core server, SSD:    pool_size = (4 * 2) + 1 = 9  → use 10
  8-core server, SSD:    pool_size = (8 * 2) + 1 = 17 → use 20
  8-core server, 4 HDDs: pool_size = (8 * 2) + 4 = 20

Note: This is the DB-side pool size. Application-side pools should not
exceed this number across all application instances combined.
```

---

## Benchmarking (`:benchmark`)

### Python (pytest-benchmark)
```python
def test_parse_json(benchmark):
    data = '{"key": "value", "number": 42}'
    result = benchmark(json.loads, data)
    assert result["key"] == "value"

# Run: pytest --benchmark-only --benchmark-sort=mean
```

### Go
```go
func BenchmarkParseJSON(b *testing.B) {
    data := []byte(`{"key": "value", "number": 42}`)
    for i := 0; i < b.N; i++ {
        var result map[string]interface{}
        json.Unmarshal(data, &result)
    }
}
// Run: go test -bench=. -benchmem
```

---

## Hard Constraints
- Never profile in production without sampling (use py-spy, async-profiler — not cProfile)
- Benchmark results must include: ops/sec, p50/p95/p99 latency, memory allocation
- Always compare before/after with the same workload and hardware
- Connection pools must have both min and max size configured
- Database optimization must start with EXPLAIN ANALYZE, not guessing
- Always profile with production-like data volumes — benchmarks with 100 rows won't reveal N+1 problems at scale; test with realistic row counts (millions, not hundreds)
- Never optimize without measuring first — no premature optimization; identify the actual bottleneck via profiling before writing any optimization code
- Document baseline metrics before and after every optimization: capture p50/p95/p99 latency, throughput (ops/sec), and memory usage both before and after, and include these numbers in the PR description
