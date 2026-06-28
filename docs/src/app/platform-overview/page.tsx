import type { Metadata } from "next";
import DocLayout from "@/components/DocLayout";

export const metadata: Metadata = { title: "Platform Overview" };

const toc = [
  { id: "storefront", label: "Storefront", level: 2 },
  { id: "product-catalog", label: "Product Catalog", level: 3 },
  { id: "search-and-filtering", label: "Search & Filtering", level: 3 },
  { id: "checkout-flow", label: "Checkout Flow", level: 3 },
  { id: "admin-panel", label: "Admin Panel", level: 2 },
  { id: "product-management", label: "Product Management", level: 3 },
  { id: "order-fulfillment", label: "Order Fulfillment", level: 3 },
  { id: "analytics-dashboard", label: "Analytics Dashboard", level: 3 },
  { id: "infrastructure", label: "Infrastructure", level: 2 },
  { id: "database", label: "Database", level: 3 },
  { id: "file-storage", label: "File Storage", level: 3 },
  { id: "caching", label: "Caching", level: 3 },
  { id: "comparison", label: "Comparison with Alternatives", level: 2 },
];

export default function PlatformOverviewPage() {
  return (
    <DocLayout
      title="Platform Overview"
      description="A comprehensive look at what Stack provides — from the customer-facing storefront to the admin dashboard and underlying infrastructure."
      breadcrumb="Platform Overview"
      toc={toc}
      prev={{ label: "Getting Started", href: "/getting-started" }}
      next={{ label: "API Reference", href: "/api-reference" }}
    >
      <p>
        Stack is a complete e-commerce platform optimized for digital products.
        Unlike general-purpose solutions that bolt on digital delivery as an
        afterthought, Stack was built from the ground up for selling downloads,
        licenses, courses, and digital assets.
      </p>

      <h2 id="storefront">
        Storefront
        <a href="#storefront" className="heading-anchor">#</a>
      </h2>
      <p>
        The customer-facing storefront is a server-rendered Next.js 15
        application using the App Router. It prioritizes performance, SEO, and
        conversion — every page is optimized for Core Web Vitals.
      </p>

      <h3 id="product-catalog">
        Product Catalog
        <a href="#product-catalog" className="heading-anchor">#</a>
      </h3>
      <p>
        Products are organized into collections with rich metadata — titles,
        descriptions, images, categories, tags, and custom attributes. Each
        product page includes:
      </p>
      <ul>
        <li>High-quality image gallery with zoom</li>
        <li>Formatted descriptions with markdown support</li>
        <li>Pricing tiers and variant selection</li>
        <li>Related product recommendations</li>
        <li>Customer reviews and ratings</li>
      </ul>

      <h3 id="search-and-filtering">
        Search &amp; Filtering
        <a href="#search-and-filtering" className="heading-anchor">#</a>
      </h3>
      <p>
        Full-text search powered by PostgreSQL&apos;s built-in text search
        capabilities. Customers can filter by category, price range, format,
        and custom attributes. Search results are ranked by relevance with
        typo tolerance.
      </p>

      <h3 id="checkout-flow">
        Checkout Flow
        <a href="#checkout-flow" className="heading-anchor">#</a>
      </h3>
      <p>
        The checkout process is streamlined for digital products — no shipping
        address forms, no delivery options. Customers go from cart to payment
        in two steps:
      </p>
      <ol>
        <li><strong>Review cart</strong> — verify items, apply discount codes</li>
        <li><strong>Payment</strong> — Stripe Checkout handles card processing, Apple Pay, Google Pay</li>
      </ol>
      <p>
        After successful payment, customers immediately receive access to their
        purchases via secure download links and email confirmation.
      </p>

      <blockquote>
        <p>
          💡 Stripe Checkout handles PCI compliance, 3D Secure authentication,
          and international payment methods automatically. You never touch
          raw card data.
        </p>
      </blockquote>

      <h2 id="admin-panel">
        Admin Panel
        <a href="#admin-panel" className="heading-anchor">#</a>
      </h2>
      <p>
        The admin panel is a Vite + React SPA accessible at <code>/admin</code>.
        It provides full control over your store without touching code.
      </p>

      <h3 id="product-management">
        Product Management
        <a href="#product-management" className="heading-anchor">#</a>
      </h3>
      <p>Create, edit, and organize your product catalog:</p>
      <ul>
        <li>Rich text editor for product descriptions</li>
        <li>Drag-and-drop file uploads for deliverables</li>
        <li>Collection and category management</li>
        <li>Bulk operations — publish, unpublish, delete, price changes</li>
        <li>Product duplication for creating variants</li>
      </ul>

      <h3 id="order-fulfillment">
        Order Fulfillment
        <a href="#order-fulfillment" className="heading-anchor">#</a>
      </h3>
      <p>
        Digital fulfillment is automatic — when payment confirms, download
        links are generated and emailed. The admin panel shows:
      </p>
      <ul>
        <li>Real-time order stream with status filters</li>
        <li>Customer details and purchase history</li>
        <li>Refund processing through Stripe</li>
        <li>Download link regeneration for customer support</li>
      </ul>

      <h3 id="analytics-dashboard">
        Analytics Dashboard
        <a href="#analytics-dashboard" className="heading-anchor">#</a>
      </h3>
      <p>
        Track your store&apos;s performance with built-in analytics:
      </p>
      <ul>
        <li><strong>Revenue</strong> — daily, weekly, monthly breakdowns with trend lines</li>
        <li><strong>Top products</strong> — best sellers ranked by revenue and units</li>
        <li><strong>Traffic</strong> — page views, unique visitors, referral sources</li>
        <li><strong>Conversion</strong> — funnel analysis from visit to purchase</li>
      </ul>

      <h2 id="infrastructure">
        Infrastructure
        <a href="#infrastructure" className="heading-anchor">#</a>
      </h2>
      <p>
        Stack runs on battle-tested open-source infrastructure, fully
        containerized with Docker Compose for both development and production.
      </p>

      <h3 id="database">
        Database
        <a href="#database" className="heading-anchor">#</a>
      </h3>
      <p>
        <strong>PostgreSQL 16</strong> handles all persistent data — products,
        orders, customers, analytics events. Migrations are managed with{" "}
        <code>node-pg-migrate</code> and run automatically on API startup.
      </p>

      <h3 id="file-storage">
        File Storage
        <a href="#file-storage" className="heading-anchor">#</a>
      </h3>
      <p>
        <strong>MinIO</strong> provides S3-compatible object storage for product
        files, images, and assets. In production, you can swap in AWS S3,
        Google Cloud Storage, or any S3-compatible provider by changing the
        endpoint configuration.
      </p>

      <h3 id="caching">
        Caching
        <a href="#caching" className="heading-anchor">#</a>
      </h3>
      <p>
        <strong>Valkey 8</strong> (Redis-compatible) handles session storage,
        rate limiting, and response caching. The API uses it for fast session
        lookups and the storefront caches product data for sub-second page loads.
      </p>

      <h2 id="comparison">
        Comparison with Alternatives
        <a href="#comparison" className="heading-anchor">#</a>
      </h2>
      <p>
        How Stack compares to other options for selling digital products:
      </p>

      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Stack</th>
            <th>Shopify</th>
            <th>Gumroad</th>
            <th>WooCommerce</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Self-hosted</td><td>✅</td><td>❌</td><td>❌</td><td>✅</td></tr>
          <tr><td>Digital-first</td><td>✅</td><td>❌</td><td>✅</td><td>❌</td></tr>
          <tr><td>No transaction fees</td><td>✅</td><td>❌</td><td>❌</td><td>✅</td></tr>
          <tr><td>Modern stack</td><td>✅</td><td>—</td><td>—</td><td>❌</td></tr>
          <tr><td>API-first</td><td>✅</td><td>✅</td><td>❌</td><td>❌</td></tr>
          <tr><td>Built-in analytics</td><td>✅</td><td>✅</td><td>✅</td><td>Plugin</td></tr>
          <tr><td>Open source</td><td>✅</td><td>❌</td><td>❌</td><td>✅</td></tr>
        </tbody>
      </table>

      <blockquote>
        <p>
          📝 Stack trades managed-hosting convenience for full control. You own
          your infrastructure, data, and customer relationships. There are no
          platform fees beyond your own hosting costs and Stripe&apos;s standard
          processing fees.
        </p>
      </blockquote>
    </DocLayout>
  );
}
