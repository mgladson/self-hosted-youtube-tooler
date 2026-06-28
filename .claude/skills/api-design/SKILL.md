---
name: api-design
description: "API design patterns: RESTful API design (Richardson maturity model), OpenAPI 3.1 spec generation, versioning strategies, pagination patterns, and RFC 7807 error responses. Sub-commands: /api-design:rest, :openapi, :versioning, :pagination, :errors. Use when designing APIs, generating specs, or establishing API conventions."
---

# API Design

You are executing the `/api-design` skill. You apply API engineering best practices for REST design, OpenAPI specs, versioning, pagination, and error handling.

Parse the sub-command from the user's invocation:
- `/api-design` → show **menu** and wait for selection
- `/api-design:rest` → **RESTful Design**
- `/api-design:openapi` → **OpenAPI Spec Generation**
- `/api-design:versioning` → **Versioning Strategy**
- `/api-design:pagination` → **Pagination Patterns**
- `/api-design:errors` → **Error Responses**

---

## Menu (no sub-command)

```
API Design — Choose a topic:

1. rest        — RESTful resource design, HTTP methods, status codes, HATEOAS
2. openapi     — OpenAPI 3.1 spec generation, schema components, examples
3. versioning  — URL vs header vs query versioning, deprecation strategy
4. pagination  — Cursor vs offset, keyset pagination, page metadata
5. errors      — RFC 7807 Problem Details, error taxonomy, validation errors
```

---

## RESTful Design (`:rest`)

### Richardson Maturity Model
```
Level 0: Single endpoint, POST everything (RPC-style)
Level 1: Resources (/users, /orders) but single HTTP method
Level 2: Resources + HTTP methods (GET, POST, PUT, DELETE) + status codes ← Target this
Level 3: Level 2 + HATEOAS (hypermedia links) — optional for most APIs
```

### Resource Naming Conventions
```
✅ Good:
GET    /api/v1/users                    — List users
GET    /api/v1/users/{id}               — Get user
POST   /api/v1/users                    — Create user
PUT    /api/v1/users/{id}               — Full update
PATCH  /api/v1/users/{id}               — Partial update
DELETE /api/v1/users/{id}               — Delete user

GET    /api/v1/users/{id}/orders        — User's orders (sub-resource)
POST   /api/v1/users/{id}/orders        — Create order for user

POST   /api/v1/orders/{id}/cancel       — Action on resource (verb as sub-resource)
POST   /api/v1/reports/generate         — Non-CRUD operation

❌ Bad:
GET    /api/v1/getUsers                 — verb in resource name
POST   /api/v1/user/create              — redundant verb
GET    /api/v1/user_orders              — use nesting instead
DELETE /api/v1/users/{id}/delete        — redundant verb
```

### HTTP Status Code Guide
```
2xx Success:
  200 OK            — GET, PUT, PATCH success with body
  201 Created       — POST success, include Location header
  204 No Content    — DELETE success, no body

3xx Redirection:
  301 Moved         — Resource permanently moved
  304 Not Modified  — Conditional GET, use cached version

4xx Client Error:
  400 Bad Request   — Validation failure, malformed request
  401 Unauthorized  — Missing or invalid authentication
  403 Forbidden     — Authenticated but not authorized
  404 Not Found     — Resource doesn't exist
  409 Conflict      — Duplicate resource, state conflict
  422 Unprocessable — Semantically invalid (valid JSON, bad values)
  429 Too Many      — Rate limited, include Retry-After header

5xx Server Error:
  500 Internal      — Unexpected server error
  502 Bad Gateway   — Upstream service failure
  503 Unavailable   — Service down, include Retry-After
```

### Request/Response Patterns
```json
// POST /api/v1/users
// Request:
{
    "email": "user@example.com",
    "name": "Jane Smith",
    "role": "member"
}

// Response: 201 Created
// Location: /api/v1/users/550e8400-e29b-41d4-a716-446655440000
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Jane Smith",
    "role": "member",
    "created_at": "2024-01-15T10:30:00Z",
    "links": {
        "self": "/api/v1/users/550e8400-e29b-41d4-a716-446655440000",
        "orders": "/api/v1/users/550e8400-e29b-41d4-a716-446655440000/orders"
    }
}
```

---

## OpenAPI Spec Generation (`:openapi`)

### Process
1. Read existing routes/controllers/handlers in the codebase
2. Infer request/response schemas from types, models, or validation rules
3. Generate OpenAPI 3.1 spec with reusable components

### OpenAPI 3.1 Template
```yaml
openapi: "3.1.0"
info:
  title: My API
  version: "1.0.0"
  description: Production API for managing resources
  contact:
    email: api-support@example.com

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://api-staging.example.com/v1
    description: Staging

paths:
  /users:
    get:
      operationId: listUsers
      summary: List all users
      tags: [Users]
      parameters:
        - $ref: "#/components/parameters/PageCursor"
        - $ref: "#/components/parameters/PageSize"
        - name: status
          in: query
          schema:
            type: string
            enum: [active, suspended, deleted]
      responses:
        "200":
          description: Paginated list of users
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserListResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"

    post:
      operationId: createUser
      summary: Create a new user
      tags: [Users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateUserRequest"
      responses:
        "201":
          description: User created
          headers:
            Location:
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "400":
          $ref: "#/components/responses/ValidationError"
        "409":
          $ref: "#/components/responses/Conflict"

components:
  schemas:
    User:
      type: object
      required: [id, email, name, created_at]
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
          maxLength: 100
        created_at:
          type: string
          format: date-time

    CreateUserRequest:
      type: object
      required: [email, name]
      properties:
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 100
        role:
          type: string
          enum: [admin, member, viewer]
          default: member

    ProblemDetail:
      type: object
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
          format: uri

  parameters:
    PageCursor:
      name: cursor
      in: query
      description: Pagination cursor from previous response
      schema:
        type: string
    PageSize:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20

  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"
    ValidationError:
      description: Request validation failed
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"
    Conflict:
      description: Resource conflict
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - BearerAuth: []
```

---

## Versioning Strategy (`:versioning`)

### Comparison
```
| Strategy       | Example                          | Pros                    | Cons                     |
|----------------|----------------------------------|-------------------------|--------------------------|
| URL path       | /api/v1/users                    | Explicit, cache-friendly| URL changes on version   |
| Header         | Accept: application/vnd.api.v2   | Clean URLs              | Hidden, harder to test   |
| Query param    | /api/users?version=2             | Easy to test            | Not RESTful              |

Recommendation: URL path versioning (/api/v1/) for most APIs — explicit and cache-friendly.
```

### Deprecation Process
```
1. Add Sunset header to deprecated endpoints:
   Sunset: Sat, 01 Jun 2025 00:00:00 GMT
   Deprecation: true
   Link: <https://api.example.com/v2/users>; rel="successor-version"

2. Return warning in response body:
   "warnings": ["This endpoint is deprecated. Migrate to /api/v2/users by June 2025."]

3. Log usage of deprecated endpoints for migration tracking

4. Timeline: announce → 6 months with warnings → sunset
```

---

## Pagination Patterns (`:pagination`)

### Cursor-Based (Recommended)
```json
// Request: GET /api/v1/orders?limit=20&cursor=eyJpZCI6MTAwfQ==

// Response:
{
    "data": [...],
    "pagination": {
        "next_cursor": "eyJpZCI6MTIwfQ==",
        "has_more": true
    }
}

// Cursor is base64-encoded: {"id": 120, "created_at": "2024-01-15T10:00:00Z"}
// Stable under concurrent inserts/deletes
```

### Offset-Based (Simple, Small Datasets)
```json
// Request: GET /api/v1/products?page=3&per_page=20

// Response:
{
    "data": [...],
    "pagination": {
        "page": 3,
        "per_page": 20,
        "total": 150,
        "total_pages": 8
    }
}

// ⚠️ Warning: Slow for large offsets (OFFSET 10000 scans and discards rows)
```

---

## Error Responses (`:errors`)

### RFC 7807 Problem Details
```json
// Content-Type: application/problem+json

// Validation error (400):
{
    "type": "https://api.example.com/errors/validation",
    "title": "Validation Failed",
    "status": 400,
    "detail": "Request body contains 2 validation errors",
    "instance": "/api/v1/users",
    "errors": [
        {
            "field": "email",
            "code": "invalid_format",
            "message": "Must be a valid email address"
        },
        {
            "field": "name",
            "code": "too_short",
            "message": "Must be at least 1 character",
            "meta": { "min_length": 1 }
        }
    ]
}

// Resource conflict (409):
{
    "type": "https://api.example.com/errors/duplicate-email",
    "title": "Email Already Exists",
    "status": 409,
    "detail": "A user with email 'user@example.com' already exists",
    "instance": "/api/v1/users"
}

// Rate limited (429):
{
    "type": "https://api.example.com/errors/rate-limit",
    "title": "Rate Limit Exceeded",
    "status": 429,
    "detail": "You have exceeded 100 requests per minute",
    "instance": "/api/v1/users",
    "retry_after": 32
}
```

---

## Hard Constraints
- All endpoints must require authentication unless explicitly public
- Use plural nouns for resource names (/users, not /user)
- Always return consistent envelope structure across all endpoints
- Include request IDs in responses for debugging (X-Request-Id header)
- Rate limiting must return 429 with Retry-After header
- All timestamps must be ISO 8601 with timezone (UTC preferred)
- Never expose internal IDs, stack traces, or implementation details in error responses
