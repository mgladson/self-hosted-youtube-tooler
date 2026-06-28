---
name: graphql-patterns
description: "GraphQL development patterns: schema-first SDL design, resolver patterns with DataLoader, Apollo Federation for microservices, security (depth limiting/cost analysis), and WebSocket subscriptions. Sub-commands: /graphql-patterns:schema, :resolvers, :federation, :security, :subscriptions. Use when building GraphQL APIs, reviewing schemas, or optimizing resolvers."
---

# GraphQL Patterns

You are executing the `/graphql-patterns` skill. You apply GraphQL engineering best practices for schema design, resolvers, federation, security, and subscriptions.

Parse the sub-command from the user's invocation:
- `/graphql-patterns` → show **menu** and wait for selection
- `/graphql-patterns:schema` → **Schema Design**
- `/graphql-patterns:resolvers` → **Resolver Patterns**
- `/graphql-patterns:federation` → **Apollo Federation**
- `/graphql-patterns:security` → **Security**
- `/graphql-patterns:subscriptions` → **Subscriptions**

---

## Menu (no sub-command)

```
GraphQL Patterns — Choose a topic:

1. schema        — Schema-first SDL, type design, input types, interfaces, unions
2. resolvers     — DataLoader N+1 prevention, field resolvers, error handling
3. federation    — Apollo Federation subgraph decomposition, entity resolution
4. security      — Query depth limiting, cost analysis, rate limiting, auth
5. subscriptions — WebSocket patterns, filtering, scaling
```

---

## Schema Design (`:schema`)

### Schema-First SDL
```graphql
# schema.graphql — Design types before resolvers

type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: PaginationInput): UserConnection!
  me: User!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
}

# Use Relay-style connections for pagination
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Input types for mutations (separate from output types)
input CreateUserInput {
  email: String!
  name: String!
  role: UserRole = MEMBER
}

input UpdateUserInput {
  name: String
  role: UserRole
}

# Mutation payloads with errors
type CreateUserPayload {
  user: User
  errors: [UserError!]!
}

type UserError {
  field: String!
  message: String!
  code: ErrorCode!
}

# Enums for constrained values
enum UserRole {
  ADMIN
  MEMBER
  VIEWER
}

enum ErrorCode {
  VALIDATION_ERROR
  NOT_FOUND
  DUPLICATE
  UNAUTHORIZED
}

# Interfaces for shared fields
interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

type User implements Node & Timestamped {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
  orders(first: Int, after: String): OrderConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Unions for polymorphic types
union SearchResult = User | Product | Order

# Custom scalars
scalar DateTime
scalar EmailAddress
scalar URL
```

### Naming Conventions
```
Types:          PascalCase     — User, OrderItem
Fields:         camelCase      — firstName, createdAt
Enums:          SCREAMING_CASE — ADMIN, IN_PROGRESS
Input types:    {Action}{Type}Input — CreateUserInput
Payloads:       {Action}{Type}Payload — CreateUserPayload
Connections:    {Type}Connection — UserConnection
Edges:          {Type}Edge — UserEdge
```

---

## Resolver Patterns (`:resolvers`)

### DataLoader for N+1 Prevention
```typescript
// loaders.ts — Batch and cache database calls
import DataLoader from 'dataloader';

export function createLoaders(db: Database) {
  return {
    userById: new DataLoader<string, User>(async (ids) => {
      const users = await db.users.findByIds([...ids]);
      const userMap = new Map(users.map(u => [u.id, u]));
      return ids.map(id => userMap.get(id) ?? new Error(`User ${id} not found`));
    }),

    ordersByUserId: new DataLoader<string, Order[]>(async (userIds) => {
      const orders = await db.orders.findByUserIds([...userIds]);
      const grouped = groupBy(orders, 'userId');
      return userIds.map(id => grouped[id] ?? []);
    }),
  };
}

// resolvers.ts
const resolvers = {
  Query: {
    user: (_, { id }, ctx) => ctx.loaders.userById.load(id),
    me: (_, __, ctx) => ctx.loaders.userById.load(ctx.userId),
  },

  User: {
    // Field resolver — uses DataLoader, NOT direct DB call
    orders: (user, { first, after }, ctx) => {
      return ctx.loaders.ordersByUserId.load(user.id);
    },
  },

  Mutation: {
    createUser: async (_, { input }, ctx) => {
      const errors = validateCreateUser(input);
      if (errors.length > 0) return { user: null, errors };

      const user = await ctx.db.users.create(input);
      return { user, errors: [] };
    },
  },
};
```

### Error Handling Pattern
```typescript
// Return errors in payload, don't throw for business logic errors
// Only throw for unexpected/system errors

const resolvers = {
  Mutation: {
    updateUser: async (_, { id, input }, ctx) => {
      const user = await ctx.loaders.userById.load(id);
      if (!user) {
        return {
          user: null,
          errors: [{ field: 'id', message: 'User not found', code: 'NOT_FOUND' }]
        };
      }

      if (!ctx.canEdit(user)) {
        return {
          user: null,
          errors: [{ field: '', message: 'Not authorized', code: 'UNAUTHORIZED' }]
        };
      }

      const updated = await ctx.db.users.update(id, input);
      return { user: updated, errors: [] };
    },
  },
};
```

---

## Apollo Federation (`:federation`)

### Subgraph Decomposition
```
Gateway (Apollo Router)
├── Users Subgraph    — User, Profile, Team
├── Orders Subgraph   — Order, OrderItem, Payment
├── Products Subgraph — Product, Category, Inventory
└── Reviews Subgraph  — Review, Rating
```

### Entity Definition
```graphql
# users-subgraph/schema.graphql
type User @key(fields: "id") {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
}

# orders-subgraph/schema.graphql
# Extend User from users subgraph
type User @key(fields: "id") {
  id: ID!
  orders: [Order!]!  # Added by orders subgraph
}

type Order @key(fields: "id") {
  id: ID!
  user: User!
  items: [OrderItem!]!
  total: Float!
  status: OrderStatus!
}
```

### Entity Resolver
```typescript
// orders-subgraph/resolvers.ts
const resolvers = {
  User: {
    __resolveReference: (ref, ctx) => {
      // Only resolve fields this subgraph owns
      return { id: ref.id };
    },
    orders: (user, _, ctx) => ctx.db.orders.findByUserId(user.id),
  },
};
```

---

## Security (`:security`)

### Query Depth Limiting
```typescript
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  schema,
  validationRules: [depthLimit(7)], // Prevent deeply nested queries
});

// Blocks: { user { orders { items { product { reviews { author { orders ... } } } } } } }
```

### Query Cost Analysis
```typescript
import { createComplexityRule, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity';

const complexityRule = createComplexityRule({
  maximumComplexity: 1000,
  estimators: [
    fieldExtensionsEstimator(),
    simpleEstimator({ defaultComplexity: 1 }),
  ],
  onComplete: (complexity) => {
    console.log('Query complexity:', complexity);
  },
});

// In schema: annotate expensive fields
// type User { orders(first: Int): [Order!]! @complexity(value: 5, multipliers: ["first"]) }
```

### Authentication & Authorization
```typescript
// Directive-based auth
const typeDefs = gql`
  directive @auth(requires: UserRole = MEMBER) on FIELD_DEFINITION

  type Query {
    me: User! @auth
    users: [User!]! @auth(requires: ADMIN)
    publicProducts: [Product!]!  # No @auth = public
  }
`;

// Auth directive implementation
class AuthDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const requiredRole = this.args.requires;
    const originalResolve = field.resolve;

    field.resolve = async function (source, args, ctx, info) {
      if (!ctx.user) throw new AuthenticationError('Not authenticated');
      if (requiredRole && !ctx.user.hasRole(requiredRole)) {
        throw new ForbiddenError('Insufficient permissions');
      }
      return originalResolve.call(this, source, args, ctx, info);
    };
  }
}
```

---

## Subscriptions (`:subscriptions`)

### WebSocket Pattern
```typescript
import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub(); // Use RedisPubSub in production

const resolvers = {
  Subscription: {
    orderStatusChanged: {
      subscribe: (_, { orderId }, ctx) => {
        // Verify user can access this order
        if (!ctx.canAccessOrder(orderId)) {
          throw new ForbiddenError('Not authorized');
        }
        return pubsub.asyncIterator(`ORDER_STATUS_${orderId}`);
      },
    },

    newNotification: {
      subscribe: withFilter(
        () => pubsub.asyncIterator('NOTIFICATION'),
        (payload, variables, ctx) => {
          // Only deliver to intended recipient
          return payload.userId === ctx.userId;
        }
      ),
    },
  },

  Mutation: {
    updateOrderStatus: async (_, { id, status }, ctx) => {
      const order = await ctx.db.orders.updateStatus(id, status);
      await pubsub.publish(`ORDER_STATUS_${id}`, {
        orderStatusChanged: order,
      });
      return order;
    },
  },
};
```

---

## Hard Constraints
- Always use DataLoader for field resolvers that access the database
- Input types and output types must be separate (never reuse)
- Mutation payloads must include an errors array for business logic errors
- Query depth must be limited (max 7-10 levels)
- Subscriptions must verify authorization before subscribing
- Use Relay-style connections for all paginated lists
- Never expose internal database IDs — use opaque global IDs
