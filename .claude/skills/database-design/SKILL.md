---
name: database-design
description: "Database design patterns: schema design with ERD generation (Mermaid), migration generation (Alembic/Knex/Flyway/EF), query optimization (EXPLAIN analysis), and normalization review. Sub-commands: /database-design:schema, :migration, :optimize, :normalize. Use when designing databases, writing migrations, or optimizing queries."
---

# Database Design

You are executing the `/database-design` skill. You apply database engineering best practices for schema design, migrations, query optimization, and normalization.

Parse the sub-command from the user's invocation:
- `/database-design` → show **menu** and wait for selection
- `/database-design:schema` → **Schema Design**
- `/database-design:migration` → **Migration Generation**
- `/database-design:optimize` → **Query Optimization**
- `/database-design:normalize` → **Normalization Review**

---

## Menu (no sub-command)

Present this when invoked without a sub-command:

```
Database Design — Choose a topic:

1. schema    — ERD generation, table design, indexes, constraints, relationships
2. migration — Migration scripts for Alembic, Knex, Flyway, EF Core, ActiveRecord
3. optimize  — EXPLAIN plan analysis, index recommendations, query rewriting
4. normalize — Normalization analysis (1NF → 3NF → BCNF), denormalization trade-offs
```

---

## Schema Design (`:schema`)

### Process
1. Read existing models/schemas/migrations in the codebase
2. Identify entities, relationships, and cardinalities
3. Generate ERD in Mermaid syntax
4. Recommend indexes, constraints, and data types

### ERD Generation (Mermaid)
```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar(255) email UK "NOT NULL"
        varchar(255) password_hash "NOT NULL"
        timestamp created_at "DEFAULT NOW()"
        timestamp updated_at
    }
    ORDERS {
        uuid id PK
        uuid user_id FK "NOT NULL"
        decimal(10,2) total "NOT NULL"
        varchar(20) status "DEFAULT 'pending'"
        timestamp created_at "DEFAULT NOW()"
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK "NOT NULL"
        uuid product_id FK "NOT NULL"
        integer quantity "NOT NULL CHECK > 0"
        decimal(10,2) unit_price "NOT NULL"
    }
    PRODUCTS {
        uuid id PK
        varchar(255) name "NOT NULL"
        text description
        decimal(10,2) price "NOT NULL CHECK >= 0"
        integer stock "NOT NULL DEFAULT 0"
        boolean active "DEFAULT true"
    }

    USERS ||--o{ ORDERS : places
    ORDERS ||--|{ ORDER_ITEMS : contains
    PRODUCTS ||--o{ ORDER_ITEMS : "included in"
```

### Table Design Best Practices
```sql
-- Use UUIDs for public-facing IDs, BIGSERIAL for internal
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_unique UNIQUE (email)
);

-- Indexes: cover common query patterns
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_status_created ON users (status, created_at DESC);

-- Partial index for active users only
CREATE INDEX idx_users_active ON users (email)
    WHERE status = 'active';

-- Junction table with composite PK
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

-- Audit trail with trigger
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_table_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_changed_at ON audit_log (changed_at DESC);
```

### Data Type Selection Guide
```
| Use Case              | PostgreSQL       | MySQL            | SQLite     |
|-----------------------|-----------------|------------------|------------|
| Primary key           | UUID / BIGSERIAL| BINARY(16) / BIGINT| INTEGER   |
| Email/short string    | VARCHAR(255)    | VARCHAR(255)     | TEXT       |
| Long text             | TEXT            | TEXT / LONGTEXT  | TEXT       |
| Money                 | NUMERIC(12,2)  | DECIMAL(12,2)    | INTEGER¹   |
| Timestamp             | TIMESTAMPTZ    | DATETIME(6)      | TEXT²      |
| Boolean               | BOOLEAN        | TINYINT(1)       | INTEGER    |
| JSON                  | JSONB          | JSON             | TEXT       |
| IP address            | INET           | VARCHAR(45)      | TEXT       |

¹ Store cents as integers  ² Store as ISO 8601 strings
```

---

## Migration Generation (`:migration`)

### Process
1. Detect the project's migration tool (Alembic, Knex, Flyway, EF Core, ActiveRecord, Prisma)
2. Read existing migrations to understand naming conventions and patterns
3. Generate migration with both up and down operations
4. Include data migration steps if schema change requires data transformation

### Alembic (Python/SQLAlchemy)
```python
"""add user_preferences table

Revision ID: a1b2c3d4e5f6
Revises: previous_revision_id
Create Date: 2024-01-15 10:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'a1b2c3d4e5f6'
down_revision = 'previous_revision_id'

def upgrade() -> None:
    op.create_table(
        'user_preferences',
        sa.Column('id', UUID(), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('preferences', JSONB(), nullable=False, server_default='{}'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )
    op.create_index('idx_user_prefs_user_id', 'user_preferences', ['user_id'], unique=True)

def downgrade() -> None:
    op.drop_index('idx_user_prefs_user_id')
    op.drop_table('user_preferences')
```

### Knex (Node.js)
```javascript
exports.up = function(knex) {
    return knex.schema.createTable('user_preferences', (table) => {
        table.uuid('id').primary().defaultTo(knex.fn.uuid());
        table.uuid('user_id').notNullable()
            .references('id').inTable('users').onDelete('CASCADE');
        table.jsonb('preferences').notNullable().defaultTo('{}');
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.unique('user_id');
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('user_preferences');
};
```

### Flyway (Java/SQL)
```sql
-- V20240115_1__add_user_preferences.sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_prefs_user_id ON user_preferences (user_id);
```

### EF Core (C#)
```csharp
public partial class AddUserPreferences : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "UserPreferences",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                UserId = table.Column<Guid>(nullable: false),
                Preferences = table.Column<string>(type: "jsonb", nullable: false, defaultValue: "{}"),
                UpdatedAt = table.Column<DateTimeOffset>(nullable: true, defaultValueSql: "NOW()")
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_UserPreferences", x => x.Id);
                table.ForeignKey("FK_UserPreferences_Users", x => x.UserId,
                    "Users", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("IX_UserPreferences_UserId",
            "UserPreferences", "UserId", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("UserPreferences");
    }
}
```

---

## Query Optimization (`:optimize`)

### Process
1. Run EXPLAIN ANALYZE on the target query
2. Identify sequential scans, nested loops, and high-cost nodes
3. Recommend indexes, query rewrites, or schema changes
4. Estimate improvement

### EXPLAIN Plan Analysis
```sql
-- Before optimization: sequential scan on large table
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id, o.total, u.email
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'pending'
  AND o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC
LIMIT 20;

-- Reading the plan:
-- Seq Scan on orders  (cost=0.00..45000.00 rows=1500 width=52)
--   Filter: (status = 'pending' AND created_at > ...)
--   Rows Removed by Filter: 998500
-- ❌ Problem: Sequential scan filtering 99.85% of rows

-- Fix: Composite index matching WHERE + ORDER BY
CREATE INDEX idx_orders_status_created
    ON orders (status, created_at DESC)
    WHERE status IN ('pending', 'processing');

-- After: Index Scan (cost=0.42..85.30 rows=1500 width=52) — 500x faster
```

### Common Optimization Patterns
```sql
-- 1. Cover queries with covering indexes (avoid table lookups)
CREATE INDEX idx_orders_covering ON orders (status, created_at DESC)
    INCLUDE (total, user_id);

-- 2. Replace correlated subqueries with JOINs
-- ❌ Slow: subquery runs per row
SELECT u.*, (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count
FROM users u;

-- ✅ Fast: single join with aggregation
SELECT u.*, COALESCE(oc.cnt, 0) AS order_count
FROM users u
LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM orders GROUP BY user_id) oc
    ON oc.user_id = u.id;

-- 3. Use EXISTS instead of IN for large subqueries
-- ❌ Slow with large result sets
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > 100);

-- ✅ Faster: short-circuits on first match
SELECT * FROM users u WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.total > 100
);

-- 4. Pagination: Use keyset pagination for large datasets
-- ❌ Slow: OFFSET scans and discards rows
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 10000;

-- ✅ Fast: seek to last seen position
SELECT * FROM orders
WHERE created_at < '2024-01-15T10:00:00Z'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Normalization Review (`:normalize`)

### Process
1. Analyze existing tables for normalization violations
2. Classify current normal form (1NF → 2NF → 3NF → BCNF)
3. Recommend normalization or justified denormalization

### Normal Forms Reference
```
1NF: Atomic values, no repeating groups
  ❌ tags VARCHAR = "red,blue,green"
  ✅ Separate tag_assignments table

2NF: 1NF + no partial dependencies (all non-key columns depend on full PK)
  ❌ order_items(order_id, product_id, product_name) — product_name depends only on product_id
  ✅ Move product_name to products table

3NF: 2NF + no transitive dependencies
  ❌ orders(id, user_id, user_email) — email depends on user_id, not order
  ✅ Join to users table for email

BCNF: 3NF + every determinant is a candidate key
  Rare violations — typically in tables with overlapping candidate keys
```

### Denormalization Trade-offs
```sql
-- When to denormalize (with justification):

-- 1. Read-heavy counters: avoid COUNT(*) on every page load
ALTER TABLE users ADD COLUMN order_count INTEGER NOT NULL DEFAULT 0;
-- Maintain via trigger or application code

-- 2. Materialized aggregations for dashboards
CREATE MATERIALIZED VIEW daily_revenue AS
SELECT DATE(created_at) AS day, SUM(total) AS revenue, COUNT(*) AS orders
FROM orders WHERE status = 'completed'
GROUP BY DATE(created_at);

CREATE UNIQUE INDEX ON daily_revenue (day);
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_revenue;

-- 3. JSON columns for truly flexible schemas (user preferences, form responses)
-- OK: user-controlled, schema-free data
-- NOT OK: data you query frequently by sub-fields
```

---

## Hard Constraints
- Always include both up and down migrations
- Foreign keys must specify ON DELETE behavior (CASCADE, SET NULL, or RESTRICT)
- Every table must have a primary key
- Timestamps must use timezone-aware types (TIMESTAMPTZ, DATETIME with TZ)
- Indexes must cover the WHERE + ORDER BY patterns of frequent queries
- Never store passwords in plain text — always hash
- Money values: use NUMERIC/DECIMAL, never FLOAT
