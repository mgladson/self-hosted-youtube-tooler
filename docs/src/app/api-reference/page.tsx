import type { Metadata } from "next";
import DocLayout from "@/components/DocLayout";

export const metadata: Metadata = { title: "API Reference" };

const toc = [
  { id: "overview", label: "Overview", level: 2 },
  { id: "authentication", label: "Authentication", level: 2 },
  { id: "session-auth", label: "Session Authentication", level: 3 },
  { id: "api-keys", label: "API Keys", level: 3 },
  { id: "endpoints", label: "Endpoints", level: 2 },
  { id: "products", label: "Products", level: 3 },
  { id: "orders", label: "Orders", level: 3 },
  { id: "customers", label: "Customers", level: 3 },
  { id: "checkout", label: "Checkout", level: 3 },
  { id: "analytics", label: "Analytics", level: 3 },
  { id: "error-handling", label: "Error Handling", level: 2 },
  { id: "rate-limiting", label: "Rate Limiting", level: 2 },
  { id: "pagination", label: "Pagination", level: 2 },
];

export default function ApiReferencePage() {
  return (
    <DocLayout
      title="API Reference"
      description="Complete reference for the Stack REST API. All endpoints, authentication methods, request/response formats, and error codes."
      breadcrumb="API Reference"
      toc={toc}
      prev={{ label: "Platform Overview", href: "/platform-overview" }}
      next={{ label: "Security & Payments", href: "/security" }}
    >
      <h2 id="overview">
        Overview
        <a href="#overview" className="heading-anchor">#</a>
      </h2>
      <p>
        The Stack API is a RESTful JSON API built on Fastify 5. All endpoints
        are prefixed with <code>/api</code> and return JSON responses. The API
        powers both the storefront and admin panel.
      </p>
      <pre><code>{`Base URL: http://localhost:3001/api
Content-Type: application/json`}</code></pre>

      <h2 id="authentication">
        Authentication
        <a href="#authentication" className="heading-anchor">#</a>
      </h2>
      <p>
        The API supports two authentication methods depending on the use case.
      </p>

      <h3 id="session-auth">
        Session Authentication
        <a href="#session-auth" className="heading-anchor">#</a>
      </h3>
      <p>
        Used by the storefront and admin panel. Sessions are stored in Valkey
        with a configurable TTL. Authenticate by sending credentials to the
        login endpoint:
      </p>
      <pre><code>{`POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "your-password"
}

// Response
{
  "ok": true,
  "user": {
    "id": "usr_abc123",
    "email": "admin@example.com",
    "role": "admin"
  }
}`}</code></pre>
      <p>
        The response sets an <code>HttpOnly</code> session cookie. Subsequent
        requests are authenticated automatically via the cookie.
      </p>

      <h3 id="api-keys">
        API Keys
        <a href="#api-keys" className="heading-anchor">#</a>
      </h3>
      <p>
        For server-to-server integrations, use API keys passed in the{" "}
        <code>Authorization</code> header:
      </p>
      <pre><code>{`GET /api/products
Authorization: Bearer sk_test_EXAMPLE_DO_NOT_USE`}</code></pre>
      <p>
        API keys are created in the admin panel under <strong>Settings →
        API Keys</strong>. Each key can be scoped to specific permissions
        (read-only, write, admin).
      </p>

      <h2 id="endpoints">
        Endpoints
        <a href="#endpoints" className="heading-anchor">#</a>
      </h2>

      <h3 id="products">
        Products
        <a href="#products" className="heading-anchor">#</a>
      </h3>
      <table>
        <thead>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/products</code></td><td>List all products</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/products/:id</code></td><td>Get a single product</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/products</code></td><td>Create a product</td></tr>
          <tr><td><code>PATCH</code></td><td><code>/api/products/:id</code></td><td>Update a product</td></tr>
          <tr><td><code>DELETE</code></td><td><code>/api/products/:id</code></td><td>Delete a product</td></tr>
        </tbody>
      </table>
      <p>Example — list products with filtering:</p>
      <pre><code>{`GET /api/products?category=templates&sort=created_at&order=desc&limit=20

// Response
{
  "data": [
    {
      "id": "prod_abc123",
      "name": "Premium UI Kit",
      "slug": "premium-ui-kit",
      "price": 4900,
      "currency": "usd",
      "category": "templates",
      "status": "active",
      "created_at": "2026-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "per_page": 20,
    "total_pages": 3
  }
}`}</code></pre>

      <h3 id="orders">
        Orders
        <a href="#orders" className="heading-anchor">#</a>
      </h3>
      <table>
        <thead>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/orders</code></td><td>List all orders</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/orders/:id</code></td><td>Get order details</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/orders/:id/refund</code></td><td>Issue a refund</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/orders/:id/resend</code></td><td>Resend download links</td></tr>
        </tbody>
      </table>

      <h3 id="customers">
        Customers
        <a href="#customers" className="heading-anchor">#</a>
      </h3>
      <table>
        <thead>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/customers</code></td><td>List customers</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/customers/:id</code></td><td>Get customer profile</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/customers/:id/orders</code></td><td>Customer order history</td></tr>
        </tbody>
      </table>

      <h3 id="checkout">
        Checkout
        <a href="#checkout" className="heading-anchor">#</a>
      </h3>
      <table>
        <thead>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>POST</code></td><td><code>/api/checkout/session</code></td><td>Create Stripe checkout session</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/checkout/webhook</code></td><td>Stripe webhook handler</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/checkout/verify</code></td><td>Verify payment status</td></tr>
        </tbody>
      </table>

      <h3 id="analytics">
        Analytics
        <a href="#analytics" className="heading-anchor">#</a>
      </h3>
      <table>
        <thead>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/analytics/revenue</code></td><td>Revenue metrics</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/analytics/traffic</code></td><td>Traffic metrics</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/analytics/event</code></td><td>Track custom event</td></tr>
        </tbody>
      </table>

      <h2 id="error-handling">
        Error Handling
        <a href="#error-handling" className="heading-anchor">#</a>
      </h2>
      <p>
        The API uses standard HTTP status codes and returns consistent error
        objects:
      </p>
      <pre><code>{`// 400 Bad Request
{
  "error": "validation_error",
  "message": "Product name is required",
  "details": [
    { "field": "name", "message": "Required" }
  ]
}

// 401 Unauthorized
{
  "error": "unauthorized",
  "message": "Invalid or expired session"
}

// 404 Not Found
{
  "error": "not_found",
  "message": "Product not found"
}

// 429 Too Many Requests
{
  "error": "rate_limited",
  "message": "Rate limit exceeded",
  "retry_after": 30
}`}</code></pre>

      <h2 id="rate-limiting">
        Rate Limiting
        <a href="#rate-limiting" className="heading-anchor">#</a>
      </h2>
      <p>
        The API enforces rate limits to protect against abuse. Limits are
        applied per-IP for unauthenticated requests and per-user for
        authenticated requests.
      </p>
      <table>
        <thead>
          <tr><th>Tier</th><th>Limit</th><th>Window</th></tr>
        </thead>
        <tbody>
          <tr><td>Unauthenticated</td><td>60 requests</td><td>1 minute</td></tr>
          <tr><td>Authenticated</td><td>300 requests</td><td>1 minute</td></tr>
          <tr><td>Admin</td><td>600 requests</td><td>1 minute</td></tr>
        </tbody>
      </table>
      <p>
        Rate limit headers are included in every response: <code>X-RateLimit-Limit</code>,{" "}
        <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code>.
      </p>

      <h2 id="pagination">
        Pagination
        <a href="#pagination" className="heading-anchor">#</a>
      </h2>
      <p>
        List endpoints support cursor-based pagination with consistent
        parameters:
      </p>
      <pre><code>{`GET /api/products?limit=20&cursor=prod_abc123

// Response includes pagination metadata:
{
  "data": [...],
  "pagination": {
    "total": 142,
    "per_page": 20,
    "next_cursor": "prod_xyz789",
    "has_more": true
  }
}`}</code></pre>
    </DocLayout>
  );
}
