---
name: event-driven
description: "Event-driven architecture patterns: CQRS (read/write separation), event sourcing (event stores/projections/snapshots), message broker patterns (Kafka/RabbitMQ/SQS with DLQ), and saga patterns (orchestration/choreography). Sub-commands: /event-driven:cqrs, :event-sourcing, :message-broker, :saga. Use when designing event-driven systems or implementing async workflows."
---

# Event-Driven Architecture

You are executing the `/event-driven` skill. You apply event-driven engineering best practices for CQRS, event sourcing, message brokers, and sagas.

Parse the sub-command from the user's invocation:
- `/event-driven` → show **menu** and wait for selection
- `/event-driven:cqrs` → **CQRS**
- `/event-driven:event-sourcing` → **Event Sourcing**
- `/event-driven:message-broker` → **Message Broker Patterns**
- `/event-driven:saga` → **Saga Patterns**

---

## Menu (no sub-command)

```
Event-Driven Architecture — Choose a topic:

1. cqrs            — Command/query separation, read models, write models
2. event-sourcing  — Event stores, projections, snapshots, replays
3. message-broker  — Kafka, RabbitMQ, SQS patterns, DLQ, idempotency
4. saga            — Orchestration vs choreography, compensation, timeouts
```

---

## CQRS (`:cqrs`)

### Architecture
```
                        ┌─────────────┐
                        │   API Layer │
                        └──────┬──────┘
                    ┌──────────┴──────────┐
                    ▼                      ▼
            ┌──────────────┐      ┌──────────────┐
            │ Command Side │      │  Query Side   │
            │              │      │               │
            │ • Validation │      │ • Read models │
            │ • Business   │      │ • Projections │
            │   rules      │      │ • Denormalized│
            │ • Write DB   │      │ • Read DB     │
            └──────┬───────┘      └───────▲───────┘
                   │                      │
                   │    ┌──────────┐      │
                   └───►│  Events  │──────┘
                        └──────────┘
```

### Command Side
```python
# Commands are imperative: "do this thing"
@dataclass(frozen=True)
class CreateOrder:
    user_id: str
    items: list[OrderItem]
    idempotency_key: str  # Client-provided for dedup

@dataclass(frozen=True)
class CancelOrder:
    order_id: str
    reason: str

class OrderCommandHandler:
    def __init__(self, repo: OrderRepository, events: EventPublisher):
        self.repo = repo
        self.events = events

    async def handle_create(self, cmd: CreateOrder) -> str:
        # Idempotency check
        existing = await self.repo.find_by_idempotency_key(cmd.idempotency_key)
        if existing:
            return existing.id

        # Business rules
        order = Order.create(user_id=cmd.user_id, items=cmd.items)
        await self.repo.save(order)

        # Publish event (fact: "this happened")
        await self.events.publish(OrderCreated(
            order_id=order.id,
            user_id=cmd.user_id,
            items=cmd.items,
            total=order.total,
            timestamp=datetime.now(UTC)
        ))
        return order.id
```

### Query Side (Read Model)
```python
# Projections: build optimized read models from events
class OrderDashboardProjection:
    """Denormalized view for dashboard queries."""

    async def handle(self, event: DomainEvent):
        match event:
            case OrderCreated():
                await self.db.execute("""
                    INSERT INTO order_dashboard (order_id, user_id, total, status, created_at)
                    VALUES ($1, $2, $3, 'pending', $4)
                """, event.order_id, event.user_id, event.total, event.timestamp)

            case OrderShipped():
                await self.db.execute("""
                    UPDATE order_dashboard
                    SET status = 'shipped', shipped_at = $2
                    WHERE order_id = $1
                """, event.order_id, event.timestamp)

# Query handler: reads from denormalized view
class OrderQueryHandler:
    async def get_dashboard(self, user_id: str) -> list[OrderSummary]:
        rows = await self.db.fetch("""
            SELECT order_id, total, status, created_at, shipped_at
            FROM order_dashboard
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        """, user_id)
        return [OrderSummary(**row) for row in rows]
```

---

## Event Sourcing (`:event-sourcing`)

### Event Store
```python
# Events are immutable facts — append-only log
@dataclass(frozen=True)
class OrderCreated:
    order_id: str
    user_id: str
    items: list[OrderItem]
    total: Decimal
    timestamp: datetime

@dataclass(frozen=True)
class OrderItemAdded:
    order_id: str
    product_id: str
    quantity: int
    price: Decimal
    timestamp: datetime

@dataclass(frozen=True)
class OrderCancelled:
    order_id: str
    reason: str
    cancelled_by: str
    timestamp: datetime

class EventStore:
    async def append(self, stream_id: str, events: list[DomainEvent],
                     expected_version: int) -> None:
        """Append events with optimistic concurrency check."""
        async with self.db.transaction():
            current = await self.get_stream_version(stream_id)
            if current != expected_version:
                raise ConcurrencyError(
                    f"Expected version {expected_version}, got {current}"
                )
            for event in events:
                await self.db.execute("""
                    INSERT INTO event_store (stream_id, version, event_type, data, metadata, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6)
                """, stream_id, current + 1, type(event).__name__,
                     json.dumps(asdict(event)), json.dumps(metadata), event.timestamp)
                current += 1

    async def read_stream(self, stream_id: str,
                          from_version: int = 0) -> list[DomainEvent]:
        rows = await self.db.fetch("""
            SELECT event_type, data FROM event_store
            WHERE stream_id = $1 AND version > $2
            ORDER BY version ASC
        """, stream_id, from_version)
        return [deserialize_event(row) for row in rows]
```

### Aggregate Reconstruction
```python
class Order:
    """Aggregate rebuilt from events."""

    def __init__(self):
        self.id = None
        self.status = None
        self.items = []
        self.total = Decimal(0)
        self.version = 0

    @classmethod
    def from_events(cls, events: list[DomainEvent]) -> "Order":
        order = cls()
        for event in events:
            order.apply(event)
        return order

    def apply(self, event: DomainEvent):
        match event:
            case OrderCreated():
                self.id = event.order_id
                self.status = "pending"
                self.items = event.items
                self.total = event.total
            case OrderCancelled():
                self.status = "cancelled"
        self.version += 1
```

### Snapshots
```python
class SnapshotStore:
    """Periodically snapshot aggregate state to avoid replaying all events."""

    SNAPSHOT_INTERVAL = 100  # Snapshot every 100 events

    async def load_aggregate(self, stream_id: str) -> Order:
        # Try loading from snapshot first
        snapshot = await self.db.fetchrow("""
            SELECT state, version FROM snapshots
            WHERE stream_id = $1
            ORDER BY version DESC LIMIT 1
        """, stream_id)

        if snapshot:
            order = Order.from_snapshot(snapshot["state"])
            from_version = snapshot["version"]
        else:
            order = Order()
            from_version = 0

        # Replay events after snapshot
        events = await self.event_store.read_stream(stream_id, from_version)
        for event in events:
            order.apply(event)

        # Create new snapshot if needed
        if order.version - (snapshot["version"] if snapshot else 0) >= self.SNAPSHOT_INTERVAL:
            await self.save_snapshot(stream_id, order)

        return order
```

---

## Message Broker Patterns (`:message-broker`)

### Kafka
```python
from confluent_kafka import Producer, Consumer

# Producer with idempotency
producer = Producer({
    'bootstrap.servers': 'kafka:9092',
    'enable.idempotence': True,  # Exactly-once semantics
    'acks': 'all',
    'retries': 3,
})

async def publish_order_event(event: OrderCreated):
    producer.produce(
        topic='orders.events',
        key=event.order_id.encode(),     # Partition by order ID
        value=json.dumps(asdict(event)).encode(),
        headers={'event-type': event.__class__.__name__},
        callback=delivery_callback
    )
    producer.flush()

# Consumer with consumer group
consumer = Consumer({
    'bootstrap.servers': 'kafka:9092',
    'group.id': 'inventory-service',
    'auto.offset.reset': 'earliest',
    'enable.auto.commit': False,  # Manual commit after processing
})

consumer.subscribe(['orders.events'])

while True:
    msg = consumer.poll(timeout=1.0)
    if msg is None:
        continue
    try:
        event = deserialize(msg.value())
        await process_event(event)  # Idempotent handler
        consumer.commit(msg)        # Commit after successful processing
    except Exception:
        # Send to DLQ after max retries
        await send_to_dlq(msg)
        consumer.commit(msg)
```

### RabbitMQ
```python
import aio_pika

async def setup_topology(connection):
    channel = await connection.channel()

    # Exchange for domain events
    exchange = await channel.declare_exchange(
        'orders', aio_pika.ExchangeType.TOPIC, durable=True
    )

    # Service-specific queue with DLQ
    dlq = await channel.declare_queue('inventory.dlq', durable=True)
    queue = await channel.declare_queue(
        'inventory.orders',
        durable=True,
        arguments={
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': 'inventory.dlq',
            'x-message-ttl': 86400000,  # 24h TTL
        }
    )
    await queue.bind(exchange, routing_key='order.*')

    async def handler(message: aio_pika.IncomingMessage):
        async with message.process():  # Auto-ack on success, nack on exception
            event = json.loads(message.body)
            await process_event(event)

    await queue.consume(handler)
```

### Idempotency Pattern
```python
class IdempotentConsumer:
    """Ensure each event is processed exactly once."""

    async def process(self, event_id: str, handler: Callable):
        # Check if already processed
        processed = await self.db.fetchval(
            "SELECT 1 FROM processed_events WHERE event_id = $1", event_id
        )
        if processed:
            return  # Skip duplicate

        async with self.db.transaction():
            await handler()
            await self.db.execute(
                "INSERT INTO processed_events (event_id, processed_at) VALUES ($1, NOW())",
                event_id
            )
```

---

## Saga Patterns (`:saga`)

### Orchestration vs Choreography
```
Orchestration (central coordinator):
┌───────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   Saga    │────►│ Inventory│────►│ Payment  │────►│ Shipping │
│Orchestrator│◄───│ Service  │◄───│ Service  │◄───│ Service  │
└───────────┘     └──────────┘     └──────────┘     └──────────┘
  ✅ Easy to understand, central error handling
  ❌ Single point of failure, tight coupling to orchestrator

Choreography (event-driven, no coordinator):
OrderPlaced ──► InventoryReserved ──► PaymentCharged ──► ShipmentScheduled
     │                  │                    │                   │
     ▼                  ▼                    ▼                   ▼
  Inventory          Payment             Shipping            Notification
  Service            Service             Service              Service
  ✅ Loose coupling, no SPOF
  ❌ Hard to track, debug, and reason about
```

### Choreography Implementation
```python
# Each service listens for events and publishes its own
class InventoryService:
    @event_handler("OrderPlaced")
    async def on_order_placed(self, event: OrderPlaced):
        try:
            await self.reserve_items(event.order_id, event.items)
            await self.publish(InventoryReserved(
                order_id=event.order_id,
                items=event.items
            ))
        except InsufficientStockError:
            await self.publish(InventoryReservationFailed(
                order_id=event.order_id,
                reason="insufficient_stock"
            ))

class PaymentService:
    @event_handler("InventoryReserved")
    async def on_inventory_reserved(self, event: InventoryReserved):
        try:
            result = await self.charge(event.order_id)
            await self.publish(PaymentCharged(order_id=event.order_id))
        except PaymentError:
            await self.publish(PaymentFailed(order_id=event.order_id))

    @event_handler("PaymentFailed")
    async def on_payment_failed(self, event: PaymentFailed):
        # Compensating action: release inventory
        await self.publish(ReleaseInventoryRequested(order_id=event.order_id))
```

### Timeout and Compensation
```python
class SagaWithTimeout:
    STEP_TIMEOUT = timedelta(minutes=5)

    async def execute(self):
        for step in self.steps:
            try:
                result = await asyncio.wait_for(
                    step.action(),
                    timeout=self.STEP_TIMEOUT.total_seconds()
                )
            except asyncio.TimeoutError:
                logger.error(f"Saga step timed out: {step.name}")
                await self.compensate()
                raise SagaTimeoutError(step.name)
            except Exception:
                await self.compensate()
                raise

    async def compensate(self):
        """Run compensating actions in reverse order."""
        for step in reversed(self.completed_steps):
            try:
                await step.compensation()
            except Exception as e:
                # Log but continue compensating remaining steps
                logger.error(f"Compensation failed for {step.name}: {e}")
                await self.alert_operations(step, e)
```

---

## Hard Constraints
- Events are immutable — never modify or delete published events
- Every event consumer must be idempotent (handle duplicate delivery)
- Include correlation IDs in all events for end-to-end tracing
- Dead letter queues (DLQ) are mandatory for all consumers
- Sagas must have compensation logic for every step
- Event schemas must be versioned (backward compatible by default)
- Never rely on event ordering across different partitions/streams
