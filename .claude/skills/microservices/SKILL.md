---
name: microservices
description: "Microservices architecture patterns: bounded context decomposition (DDD), communication patterns (gRPC/REST/events), resilience (circuit breakers/retry/bulkhead), and observability (distributed tracing/service mesh). Sub-commands: /microservices:decompose, :communication, :resilience, :observability. Use when designing or reviewing microservice architectures."
---

# Microservices

You are executing the `/microservices` skill. You apply microservices engineering best practices for decomposition, communication, resilience, and observability.

Parse the sub-command from the user's invocation:
- `/microservices` → show **menu** and wait for selection
- `/microservices:decompose` → **Service Decomposition**
- `/microservices:communication` → **Communication Patterns**
- `/microservices:resilience` → **Resilience Patterns**
- `/microservices:observability` → **Observability**

---

## Menu (no sub-command)

```
Microservices — Choose a topic:

1. decompose      — Bounded context analysis, DDD, service boundaries
2. communication  — Sync (gRPC/REST) vs async (events), API gateway patterns
3. resilience     — Circuit breakers, retry, bulkhead, timeout, saga patterns
4. observability  — Distributed tracing, service mesh, health checks, logging
```

---

## Service Decomposition (`:decompose`)

### Bounded Context Analysis (DDD)
```
Step 1: Identify business capabilities
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  User Management │  │  Order Processing│  │   Inventory     │
│                  │  │                  │  │                 │
│  • Registration  │  │  • Cart          │  │  • Stock levels │
│  • Auth          │  │  • Checkout      │  │  • Warehouses   │
│  • Profile       │  │  • Payment       │  │  • Procurement  │
│  • Preferences   │  │  • Fulfillment   │  │  • Forecasting  │
└─────────────────┘  └─────────────────┘  └─────────────────┘

Step 2: Map context relationships
┌──────────┐  upstream   ┌──────────┐  upstream   ┌──────────┐
│  Users   │ ──────────► │  Orders  │ ──────────► │ Payments │
└──────────┘  (customer  └──────────┘  (conformist)└──────────┘
              -supplier)       │
                               │ async events
                               ▼
                         ┌──────────┐
                         │Inventory │
                         └──────────┘

Step 3: Define service boundaries
  Rule: Each service owns its data (no shared databases)
  Rule: Services communicate via APIs or events, never direct DB access
  Rule: A service should be ownable by one team (2-pizza team)
```

### Decomposition Heuristics
```
When to split:
✅ Different rates of change (auth changes rarely, orders change weekly)
✅ Different scaling requirements (search needs 10x the compute of auth)
✅ Different data ownership (inventory is warehouses, orders is customers)
✅ Independent deployment needed (payment updates shouldn't block catalog)

When NOT to split:
❌ Tight data coupling (split would require distributed transactions)
❌ Synchronous call chains (A→B→C→D = distributed monolith)
❌ < 3 developers total (overhead outweighs benefits)
❌ Splitting for "clean architecture" only (premature decomposition)
```

### Service Template
```
service-name/
├── cmd/server/          # Entry point
├── internal/
│   ├── domain/          # Business logic (no external deps)
│   │   ├── model.go
│   │   ├── repository.go  # Interface only
│   │   └── service.go
│   ├── handler/         # HTTP/gRPC handlers
│   ├── repository/      # Database implementations
│   └── client/          # External service clients
├── api/
│   ├── proto/           # gRPC protobuf definitions
│   └── openapi/         # REST API spec
├── migrations/          # Database migrations
├── Dockerfile
└── docker-compose.yml   # Local development
```

---

## Communication Patterns (`:communication`)

### Sync vs Async Decision Matrix
```
| Pattern      | Use When                           | Example                    |
|-------------|------------------------------------|-----------------------------|
| REST        | CRUD, public APIs, browser clients | GET /api/v1/products       |
| gRPC        | Internal service-to-service, perf  | GetUser(userId)            |
| Events      | Eventual consistency OK, fan-out   | OrderPlaced → Inventory    |
| GraphQL     | Client-driven queries, BFF         | Frontend data aggregation  |
```

### gRPC Service Definition
```protobuf
syntax = "proto3";
package orders.v1;

service OrderService {
  rpc CreateOrder(CreateOrderRequest) returns (CreateOrderResponse);
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse);
  rpc StreamOrderUpdates(StreamRequest) returns (stream OrderUpdate);
}

message CreateOrderRequest {
  string user_id = 1;
  repeated OrderItem items = 2;
}

message Order {
  string id = 1;
  string user_id = 2;
  OrderStatus status = 3;
  google.protobuf.Timestamp created_at = 4;
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_CONFIRMED = 2;
  ORDER_STATUS_SHIPPED = 3;
  ORDER_STATUS_DELIVERED = 4;
}
```

### Event-Driven Communication
```json
// CloudEvents format
{
  "specversion": "1.0",
  "type": "com.example.orders.created",
  "source": "/orders-service",
  "id": "A234-1234-1234",
  "time": "2024-01-15T10:30:00Z",
  "datacontenttype": "application/json",
  "data": {
    "orderId": "ord-123",
    "userId": "usr-456",
    "items": [{"productId": "prod-789", "quantity": 2}],
    "total": 59.98
  }
}
```

### API Gateway Pattern
```yaml
# Kong / API Gateway configuration
services:
  - name: users-service
    url: http://users:8080
    routes:
      - paths: ["/api/v1/users"]
        methods: ["GET", "POST", "PUT", "DELETE"]
    plugins:
      - name: rate-limiting
        config: { minute: 100 }
      - name: jwt

  - name: orders-service
    url: http://orders:8080
    routes:
      - paths: ["/api/v1/orders"]
    plugins:
      - name: rate-limiting
        config: { minute: 50 }
      - name: jwt
      - name: request-transformer
        config:
          add:
            headers: ["X-Consumer-ID:$(consumer.id)"]
```

---

## Resilience Patterns (`:resilience`)

### Circuit Breaker
```python
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30)
def call_payment_service(order_id: str, amount: float) -> PaymentResult:
    response = httpx.post(f"{PAYMENT_URL}/charge", json={
        "order_id": order_id,
        "amount": amount
    }, timeout=5.0)
    response.raise_for_status()
    return PaymentResult(**response.json())

# States:
# CLOSED  → Normal operation, counting failures
# OPEN    → All calls fail fast (no network call), after failure_threshold
# HALF-OPEN → After recovery_timeout, allow one test call
```

### Retry with Exponential Backoff
```python
import tenacity

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=10),
    retry=tenacity.retry_if_exception_type(httpx.HTTPStatusError),
    before_sleep=lambda retry_state: logger.warning(
        f"Retry {retry_state.attempt_number} for {retry_state.fn.__name__}"
    )
)
def fetch_inventory(product_id: str) -> int:
    response = httpx.get(f"{INVENTORY_URL}/stock/{product_id}", timeout=3.0)
    response.raise_for_status()
    return response.json()["quantity"]
```

### Bulkhead Pattern
```python
import asyncio

# Limit concurrent calls to each downstream service
payment_semaphore = asyncio.Semaphore(10)   # Max 10 concurrent payment calls
inventory_semaphore = asyncio.Semaphore(20) # Max 20 concurrent inventory calls

async def process_order(order: Order):
    async with payment_semaphore:
        payment = await charge_payment(order)
    async with inventory_semaphore:
        await reserve_inventory(order.items)
```

### Saga Pattern (Orchestration)
```python
class OrderSaga:
    """Orchestration saga: central coordinator manages steps + compensations."""

    async def execute(self, order: Order):
        steps = [
            SagaStep(
                action=lambda: self.reserve_inventory(order),
                compensation=lambda: self.release_inventory(order)
            ),
            SagaStep(
                action=lambda: self.charge_payment(order),
                compensation=lambda: self.refund_payment(order)
            ),
            SagaStep(
                action=lambda: self.schedule_shipping(order),
                compensation=lambda: self.cancel_shipping(order)
            ),
        ]

        completed = []
        try:
            for step in steps:
                await step.action()
                completed.append(step)
        except Exception:
            # Compensate in reverse order
            for step in reversed(completed):
                await step.compensation()
            raise
```

---

## Observability (`:observability`)

### Distributed Tracing (OpenTelemetry)
```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Setup
provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("orders-service")

async def create_order(request: CreateOrderRequest):
    with tracer.start_as_current_span("create_order") as span:
        span.set_attribute("user.id", request.user_id)
        span.set_attribute("order.item_count", len(request.items))

        # Trace propagates to downstream services automatically
        inventory = await check_inventory(request.items)
        payment = await charge_payment(request)

        span.set_attribute("order.total", payment.amount)
        return Order(...)
```

### Health Checks
```python
@app.get("/health/live")
async def liveness():
    """Kubernetes liveness: is the process alive?"""
    return {"status": "ok"}

@app.get("/health/ready")
async def readiness():
    """Kubernetes readiness: can it handle traffic?"""
    checks = {
        "database": await check_db_connection(),
        "cache": await check_redis_connection(),
    }
    all_healthy = all(checks.values())
    return JSONResponse(
        status_code=200 if all_healthy else 503,
        content={"status": "ready" if all_healthy else "not_ready", "checks": checks}
    )

@app.get("/health/startup")
async def startup():
    """Kubernetes startup: has initial setup completed?"""
    return {"status": "started", "migrations": migration_status}
```

### Structured Logging
```python
import structlog

logger = structlog.get_logger()

# Every log line includes: service, trace_id, span_id, timestamp
logger.info("order_created",
    order_id="ord-123",
    user_id="usr-456",
    total=59.98,
    item_count=3,
    duration_ms=45
)

# Output (JSON):
# {"event": "order_created", "service": "orders", "trace_id": "abc123",
#  "order_id": "ord-123", "user_id": "usr-456", "total": 59.98, ...}
```

---

## Hard Constraints
- Each service must own its database — no shared databases
- All inter-service communication must be through defined APIs or events
- Every service must have health checks (liveness + readiness)
- Distributed tracing must propagate context across service boundaries
- Services must handle downstream failures gracefully (circuit breakers, retries)
- Events must be idempotent — consumers must handle duplicate delivery
- Service-to-service auth must use mTLS or service tokens, never user credentials
