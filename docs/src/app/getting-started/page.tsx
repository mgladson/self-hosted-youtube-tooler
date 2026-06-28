import type { Metadata } from "next";
import Link from "next/link";
import DocLayout from "@/components/DocLayout";

export const metadata: Metadata = { title: "Getting Started" };

const toc = [
  { id: "prerequisites", label: "Prerequisites", level: 2 },
  { id: "installation", label: "Installation", level: 2 },
  { id: "clone-the-repo", label: "Clone the Repository", level: 3 },
  { id: "environment-setup", label: "Environment Setup", level: 3 },
  { id: "start-services", label: "Start Services", level: 3 },
  { id: "your-first-product", label: "Your First Product", level: 2 },
  { id: "create-a-product", label: "Create a Product", level: 3 },
  { id: "configure-pricing", label: "Configure Pricing", level: 3 },
  { id: "upload-files", label: "Upload Deliverable Files", level: 3 },
  { id: "project-structure", label: "Project Structure", level: 2 },
  { id: "development-workflow", label: "Development Workflow", level: 2 },
  { id: "next-steps", label: "Next Steps", level: 2 },
];

export default function GettingStartedPage() {
  return (
    <DocLayout
      title="Getting Started"
      description="Set up your Stack development environment and create your first digital product in under 10 minutes."
      breadcrumb="Getting Started"
      toc={toc}
      prev={{ label: "Introduction", href: "/" }}
      next={{ label: "Platform Overview", href: "/platform-overview" }}
    >
      <h2 id="prerequisites">
        Prerequisites
        <a href="#prerequisites" className="heading-anchor">#</a>
      </h2>
      <p>Before you begin, make sure you have the following installed on your machine:</p>
      <ul>
        <li><strong>Node.js 18+</strong> — we recommend using <a href="https://github.com/nvm-sh/nvm">nvm</a> to manage versions</li>
        <li><strong>Docker &amp; Docker Compose</strong> — for running PostgreSQL, Valkey, MinIO, and Caddy</li>
        <li><strong>Git</strong> — for cloning the repository</li>
        <li><strong>Stripe account</strong> — free test-mode account for payment processing (optional for initial setup)</li>
      </ul>
      <blockquote>
        <p>📝 Stack uses npm workspaces for dependency management. Yarn and pnpm are not officially supported but may work with minor adjustments.</p>
      </blockquote>

      <h2 id="installation">
        Installation
        <a href="#installation" className="heading-anchor">#</a>
      </h2>

      <h3 id="clone-the-repo">
        Clone the Repository
        <a href="#clone-the-repo" className="heading-anchor">#</a>
      </h3>
      <pre><code>{`git clone https://github.com/your-org/stack-commerce.git
cd stack-commerce
npm install`}</code></pre>
      <p>
        The <code>npm install</code> command installs dependencies for all
        workspaces — the API, storefront, admin panel, and shared packages.
      </p>

      <h3 id="environment-setup">
        Environment Setup
        <a href="#environment-setup" className="heading-anchor">#</a>
      </h3>
      <p>Copy the example environment file and configure your settings:</p>
      <pre><code>{`cp .env.example .env`}</code></pre>
      <p>Key variables to configure:</p>

      <table>
        <thead>
          <tr><th>Variable</th><th>Description</th><th>Default</th></tr>
        </thead>
        <tbody>
          <tr><td><code>DATABASE_URL</code></td><td>PostgreSQL connection string</td><td><code>postgres://stack:stack@localhost:5432/stack</code></td></tr>
          <tr><td><code>VALKEY_URL</code></td><td>Redis-compatible cache URL</td><td><code>redis://localhost:6379</code></td></tr>
          <tr><td><code>S3_ENDPOINT</code></td><td>MinIO / S3 endpoint</td><td><code>http://localhost:9000</code></td></tr>
          <tr><td><code>STRIPE_SECRET_KEY</code></td><td>Stripe test secret key</td><td>—</td></tr>
          <tr><td><code>SESSION_SECRET</code></td><td>Random string for session encryption</td><td>auto-generated</td></tr>
        </tbody>
      </table>

      <h3 id="start-services">
        Start Services
        <a href="#start-services" className="heading-anchor">#</a>
      </h3>
      <p>Start the full development stack with a single command:</p>
      <pre><code>{`npm run dev`}</code></pre>
      <p>This spins up:</p>
      <ul>
        <li><strong>Storefront</strong> at <code>http://localhost:3000</code></li>
        <li><strong>API</strong> at <code>http://localhost:3001</code></li>
        <li><strong>Admin</strong> at <code>http://localhost:3002/admin/</code></li>
        <li><strong>Caddy</strong> reverse proxy at <code>http://localhost</code></li>
        <li><strong>PostgreSQL</strong>, <strong>Valkey</strong>, and <strong>MinIO</strong> as backing services</li>
      </ul>
      <blockquote>
        <p>💡 Caddy automatically routes <code>/api/*</code> to the API server and <code>/admin/*</code> to the admin panel, giving you clean URLs in development.</p>
      </blockquote>

      <h2 id="your-first-product">
        Your First Product
        <a href="#your-first-product" className="heading-anchor">#</a>
      </h2>
      <p>Once services are running, navigate to the admin panel to create your first product.</p>

      <h3 id="create-a-product">
        Create a Product
        <a href="#create-a-product" className="heading-anchor">#</a>
      </h3>
      <ol>
        <li>Open the admin panel at <code>http://localhost/admin/</code></li>
        <li>Log in with the default credentials (check <code>.env</code>)</li>
        <li>Navigate to <strong>Products → Add Product</strong></li>
        <li>Fill in the product name, description, and category</li>
      </ol>

      <h3 id="configure-pricing">
        Configure Pricing
        <a href="#configure-pricing" className="heading-anchor">#</a>
      </h3>
      <p>
        Each product supports multiple pricing tiers. Set a base price, and
        optionally add discount codes or volume pricing. Prices are managed
        through Stripe, so changes sync automatically.
      </p>

      <h3 id="upload-files">
        Upload Deliverable Files
        <a href="#upload-files" className="heading-anchor">#</a>
      </h3>
      <p>
        Upload the digital files customers will receive after purchase. Stack
        stores files in MinIO (S3-compatible) and generates secure, expiring
        download links. Supported: ZIP, PDF, EPUB, MP4, and any file type up to
        the configured size limit.
      </p>

      <h2 id="project-structure">
        Project Structure
        <a href="#project-structure" className="heading-anchor">#</a>
      </h2>
      <pre><code>{`stack-commerce/
├── api/                # Fastify REST API
│   └── src/
│       ├── routes/     # Route handlers
│       ├── plugins/    # Fastify plugins
│       └── config.ts   # Environment config
├── storefront/         # Next.js storefront
│   └── src/
│       ├── app/        # App Router pages
│       ├── components/ # React components
│       └── lib/        # Utilities
├── admin/              # Vite + React admin panel
│   └── src/
│       ├── pages/      # Page components
│       ├── components/ # Shared UI
│       └── contexts/   # React contexts
├── shared/             # Shared types & utils
├── migrations/         # Database migrations
├── docker-compose.yml  # Development services
└── package.json        # Workspace root`}</code></pre>

      <h2 id="development-workflow">
        Development Workflow
        <a href="#development-workflow" className="heading-anchor">#</a>
      </h2>
      <p>
        All three applications support hot module reload in development. Edit
        files and see changes instantly:
      </p>
      <ul>
        <li><strong>API</strong> — uses <code>tsx watch</code> for automatic restart on file changes</li>
        <li><strong>Storefront</strong> — Next.js Fast Refresh with the App Router</li>
        <li><strong>Admin</strong> — Vite HMR for instant component updates</li>
      </ul>
      <p>Database migrations run automatically on API startup, or manually with:</p>
      <pre><code>{`npm run migrate up`}</code></pre>

      <h2 id="next-steps">
        Next Steps
        <a href="#next-steps" className="heading-anchor">#</a>
      </h2>
      <p>Now that your environment is set up:</p>
      <ul>
        <li><Link href="/platform-overview">Platform Overview</Link> — understand the full feature set</li>
        <li><Link href="/api-reference">API Reference</Link> — build custom integrations</li>
        <li><Link href="/security">Security &amp; Payments</Link> — configure Stripe and understand data handling</li>
        <li><Link href="/integrations">Integrations</Link> — connect third-party services</li>
      </ul>
    </DocLayout>
  );
}
