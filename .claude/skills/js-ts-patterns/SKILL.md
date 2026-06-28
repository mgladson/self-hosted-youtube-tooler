---
name: js-ts-patterns
description: "JavaScript/TypeScript best practices: modern JS patterns, TypeScript advanced types, Node.js backend patterns, and testing (Vitest/Jest/Playwright). Sub-commands: /js-ts-patterns:modern-js, :typescript, :nodejs, :testing. Use when building JS/TS applications or reviewing frontend/backend code."
---

# JavaScript & TypeScript Patterns

You are executing the `/js-ts-patterns` skill. You apply modern JavaScript and TypeScript engineering patterns: ES2024+ features, advanced type system usage, Node.js backend patterns, and comprehensive testing strategies.

Parse the sub-command from the user's invocation:
- `/js-ts-patterns` → show **menu** and wait for selection
- `/js-ts-patterns:modern-js` → **Modern JavaScript Patterns**
- `/js-ts-patterns:typescript` → **TypeScript Advanced Types**
- `/js-ts-patterns:nodejs` → **Node.js Backend Patterns**
- `/js-ts-patterns:testing` → **Testing Patterns**

---

## Menu (no sub-command)

```
JavaScript & TypeScript Patterns — Choose a topic:

1. modern-js  — ES2024+: structuredClone, Object.groupBy, Promise.any, top-level await
2. typescript — Advanced types: generics, conditional types, mapped types, template literals
3. nodejs     — Express/Fastify patterns, middleware, error handling, graceful shutdown
4. testing    — Vitest/Jest unit tests, Playwright E2E, MSW for API mocking
```

Ask: "Which topic? Or describe what you're building and I'll recommend the right patterns."

---

## Modern JavaScript Patterns (`:modern-js`)

### Read current code

1. Glob for `**/*.js`, `**/*.mjs`, `**/*.ts` files
2. Check `package.json` for `type: "module"` and Node.js version
3. Identify outdated patterns to modernize

### ES2024+ Key Features

```javascript
// structuredClone — deep copy without JSON round-trip
const original = { nested: { value: 42 }, date: new Date() };
const copy = structuredClone(original); // handles Date, Map, Set, etc.

// Object.groupBy — replace reduce() grouping patterns
const products = [
  { name: "Apple", category: "fruit" },
  { name: "Banana", category: "fruit" },
  { name: "Carrot", category: "vegetable" },
];
const grouped = Object.groupBy(products, ({ category }) => category);
// { fruit: [...], vegetable: [...] }

// Array.fromAsync — async iterables to arrays
const lines = await Array.fromAsync(readLines(file));

// Promise.any — first success (vs Promise.race = first settled)
const fastest = await Promise.any([
  fetch("/api/primary"),
  fetch("/api/secondary"),
  fetch("/api/tertiary"),
]);

// Top-level await in ESM
const config = await loadConfig();
export { config };

// Temporal API (Stage 3) — immutable dates
// import { Temporal } from "@js-temporal/polyfill";
// const now = Temporal.Now.zonedDateTimeISO();
// const tomorrow = now.add({ days: 1 });

// Using declarations (Stage 3) — automatic cleanup
async function processFile(path) {
  await using handle = await fs.open(path);
  // handle.close() called automatically on exit
}

// Error.cause — chained errors
try {
  await fetchData();
} catch (err) {
  throw new Error("Failed to load dashboard", { cause: err });
}

// Logical assignment
config.debug ??= false;     // assign if null/undefined
config.logging ||= "info";  // assign if falsy
config.count &&= count + 1; // assign if truthy
```

### Modern async patterns

```javascript
// AbortController for cancellable fetch
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// AsyncGenerator for streaming
async function* streamLines(readable) {
  let buffer = "";
  for await (const chunk of readable) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line
    yield* lines;
  }
  if (buffer) yield buffer;
}
```

---

## TypeScript Advanced Types (`:typescript`)

### Read current code

1. Check `tsconfig.json` for strict mode settings
2. Glob for `**/*.ts`, `**/*.tsx`
3. Look for `any` usage, missing types, overly broad unions

### Advanced Type System

```typescript
// Generic constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Conditional types
type IsArray<T> = T extends any[] ? true : false;
type Flatten<T> = T extends Array<infer Item> ? Item : T;

// Mapped types
type Readonly<T> = { readonly [K in keyof T]: T[K] };
type Optional<T> = { [K in keyof T]?: T[K] };
type Nullable<T> = { [K in keyof T]: T[K] | null };

// Template literal types
type EventName = "click" | "focus" | "blur";
type HandlerName = `on${Capitalize<EventName>}`;
// "onClick" | "onFocus" | "onBlur"

type ApiRoute = `/api/${string}`;
const route: ApiRoute = "/api/users"; // ✓
// const bad: ApiRoute = "/health";  // ✗ Type error

// Discriminated unions with exhaustive checking
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "rectangle": return shape.width * shape.height;
    case "triangle": return 0.5 * shape.base * shape.height;
    default:
      // Exhaustiveness check — TypeScript errors if a case is missing
      const _exhaustive: never = shape;
      throw new Error(`Unknown shape: ${_exhaustive}`);
  }
}

// Utility types
type User = { id: string; name: string; email: string; role: "admin" | "user" };
type CreateUser = Omit<User, "id">;
type UpdateUser = Partial<Pick<User, "name" | "email">>;
type UserPreview = Pick<User, "id" | "name">;

// Branded/Nominal types — prevent mixing IDs
type UserId = string & { readonly _brand: "UserId" };
type OrderId = string & { readonly _brand: "OrderId" };

function createUserId(id: string): UserId {
  return id as UserId;
}

// Cannot accidentally pass OrderId where UserId expected:
// takeUser(createOrderId("123")); // ✗ Type error

// satisfies — validate without widening type
const palette = {
  red: [255, 0, 0],
  green: "#00ff00",
} satisfies Record<string, string | number[]>;
// palette.red is number[], not string | number[]
```

### tsconfig.json best practices

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

---

## Node.js Backend Patterns (`:nodejs`)

### Fastify application structure

```typescript
// src/app.ts
import Fastify, { FastifyInstance } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

  // Schema-validated route
  app.post(
    "/users",
    {
      schema: {
        body: Type.Object({
          name: Type.String({ minLength: 1 }),
          email: Type.String({ format: "email" }),
        }),
        response: {
          201: Type.Object({ id: Type.String(), name: Type.String() }),
          400: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const user = await createUser(request.body);
      return reply.status(201).send(user);
    }
  );

  return app;
}

// Global error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error({ err: error, reqId: request.id }, "Request failed");
  if (error.validation) {
    return reply.status(400).send({ error: error.message });
  }
  return reply.status(500).send({ error: "Internal server error" });
});
```

### Graceful shutdown

```typescript
// src/server.ts
const app = buildApp();

async function start() {
  await app.listen({ port: 3000, host: "0.0.0.0" });
}

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down gracefully");
  await app.close();          // Closes server, awaits in-flight requests
  await closeDbConnections(); // Close DB pool
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## Testing Patterns (`:testing`)

### Vitest (recommended for Vite/modern projects)

```typescript
// Unit test with vi.fn() mocking
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "../services/user";

describe("UserService", () => {
  let userRepo: MockedObject<UserRepository>;
  let service: UserService;

  beforeEach(() => {
    userRepo = {
      findById: vi.fn(),
      save: vi.fn(),
    };
    service = new UserService(userRepo);
  });

  it("returns null for unknown user", async () => {
    userRepo.findById.mockResolvedValue(null);
    const result = await service.getUser("unknown-id");
    expect(result).toBeNull();
    expect(userRepo.findById).toHaveBeenCalledWith("unknown-id");
  });

  it("throws on invalid email", async () => {
    await expect(service.createUser({ email: "not-an-email" }))
      .rejects.toThrow("Invalid email");
  });
});

// MSW for API mocking (no network calls in tests)
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("/api/users/:id", ({ params }) => {
    return HttpResponse.json({ id: params.id, name: "Alice" });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Playwright E2E

```typescript
// tests/e2e/login.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Login flow", () => {
  test("successful login redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrongpass");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("Invalid credentials");
  });
});
```

**`playwright.config.ts`:**
```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html"], ["github"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```
