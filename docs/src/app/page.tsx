import type { Metadata } from "next";
import Link from "next/link";
import DocLayout from "@/components/DocLayout";

export const metadata: Metadata = { title: "Introduction" };

const toc = [
  { id: "what-is-stack", label: "What is Stack", level: 2 },
  { id: "architecture", label: "Architecture", level: 2 },
  { id: "storefront", label: "Storefront", level: 3 },
  { id: "admin-panel", label: "Admin Panel", level: 3 },
  { id: "api-layer", label: "API Layer", level: 3 },
  { id: "key-features", label: "Key Features", level: 2 },
  { id: "getting-help", label: "Getting Help", level: 2 },
];

export default function IntroPage() {
  return (
    <DocLayout
      title="Introduction"
      description="Welcome to StackDocs — the complete reference for building, customizing, and deploying your self-hosted digital product storefront."
      breadcrumb="Introduction"
      toc={toc}
      next={{ label: "Getting Started", href: "/getting-started" }}
    >
      <p>
        🚀 Jump right in with the{" "}
        <Link href="/getting-started">Getting Started guide</Link>
      </p>
      <p>
        📘 Learn what the platform can do in the{" "}
        <Link href="/platform-overview">Platform Overview</Link>
      </p>
      <p>
        ⚡ Build custom integrations with the{" "}
        <Link href="/api-reference">API Reference</Link>
      </p>
      <p>
        🔒 Understand how we handle payments and data in{" "}
        <Link href="/security">Security &amp; Payments</Link>
      </p>
      <p>
        🔗 Connect third-party services via{" "}
        <Link href="/integrations">Integrations</Link>
      </p>
      <p>
        🐞 Report bugs and request features on{" "}
        <a href="https://github.com">GitHub</a>
      </p>
      <p>
        🤝 Get support and connect with the community on{" "}
        <a href="https://discord.com">Discord</a>
      </p>

      <h2 id="what-is-stack">
        What is Stack
        <a href="#what-is-stack" className="heading-anchor">
          #
        </a>
      </h2>
      <p>
        Stack is a self-hosted, open-source commerce platform for selling
        digital products. It gives you a complete storefront, admin dashboard,
        and API — all running on your own infrastructure with no vendor lock-in.
      </p>
      <p>The platform is composed of three main pieces:</p>
      <ul>
        <li>
          <strong>Storefront</strong>. A server-rendered Next.js application that
          handles product browsing, search, cart, checkout, and customer
          accounts. Optimized for performance and SEO out of the box.
        </li>
        <li>
          <strong>Admin Panel</strong>. A React SPA for store management —
          product catalog, order fulfillment, analytics, customer support, and
          configuration. Accessible at <code>/admin</code>.
        </li>
        <li>
          <strong>API</strong>. A Fastify REST API that powers both the
          storefront and admin. Handles authentication, payments, file delivery,
          and all business logic.
        </li>
      </ul>

      <blockquote>
        <p>
          📝 Stack is designed for <strong>digital products</strong> — ebooks,
          software licenses, courses, templates, and downloadable assets. If you
          need physical product fulfillment, check the Integrations page for
          shipping provider support.
        </p>
      </blockquote>

      <h2 id="architecture">
        Architecture
        <a href="#architecture" className="heading-anchor">
          #
        </a>
      </h2>
      <p>
        Stack follows a modular monorepo architecture with clear service
        boundaries. All services communicate through the central API, and the
        infrastructure layer is fully containerized with Docker Compose.
      </p>

      <h3 id="storefront">
        Storefront
        <a href="#storefront" className="heading-anchor">
          #
        </a>
      </h3>
      <p>
        Built with <strong>Next.js 15</strong> using the App Router and React
        Server Components. The storefront handles all customer-facing pages
        including product listings, collections, search, shopping cart, and
        checkout. It renders server-side for fast initial loads and SEO, with
        client-side interactivity where needed.
      </p>

      <h3 id="admin-panel">
        Admin Panel
        <a href="#admin-panel" className="heading-anchor">
          #
        </a>
      </h3>
      <p>
        A <strong>Vite + React 19</strong> single-page application served at{" "}
        <code>/admin</code>. It provides a full management interface with
        real-time updates, bulk operations, and rich analytics dashboards. The
        admin communicates exclusively through the API layer.
      </p>

      <h3 id="api-layer">
        API Layer
        <a href="#api-layer" className="heading-anchor">
          #
        </a>
      </h3>
      <p>
        The <strong>Fastify 5</strong> API serves as the single source of truth.
        It manages PostgreSQL for persistent storage, Valkey (Redis-compatible)
        for sessions and caching, MinIO for S3-compatible file storage, and
        Stripe for payment processing. All routes are prefixed under{" "}
        <code>/api</code>.
      </p>

      <h2 id="key-features">
        Key Features
        <a href="#key-features" className="heading-anchor">
          #
        </a>
      </h2>
      <ul>
        <li>
          <strong>Self-hosted</strong> — full ownership of your data,
          infrastructure, and customer relationships
        </li>
        <li>
          <strong>Digital-first</strong> — purpose-built for selling downloads,
          licenses, and digital assets
        </li>
        <li>
          <strong>Modern stack</strong> — TypeScript end-to-end, React 19,
          Next.js 15 App Router, Fastify 5
        </li>
        <li>
          <strong>Production-ready infra</strong> — PostgreSQL, Redis-compatible
          cache, S3 storage, reverse proxy, email
        </li>
        <li>
          <strong>Stripe payments</strong> — checkout sessions, webhooks,
          subscription support
        </li>
        <li>
          <strong>Admin dashboard</strong> — product management, order tracking,
          customer support, analytics
        </li>
        <li>
          <strong>Developer-friendly</strong> — REST API, npm workspaces, Docker
          Compose, hot reload
        </li>
      </ul>

      <h2 id="getting-help">
        Getting Help
        <a href="#getting-help" className="heading-anchor">
          #
        </a>
      </h2>
      <p>
        If you run into issues or have questions, here&apos;s where to go:
      </p>
      <ul>
        <li>
          <strong>GitHub Issues</strong> — bug reports and feature requests
        </li>
        <li>
          <strong>Discord</strong> — real-time community support and discussion
        </li>
        <li>
          <strong>Stack Overflow</strong> — tag your questions with{" "}
          <code>stack-commerce</code>
        </li>
      </ul>
    </DocLayout>
  );
}
