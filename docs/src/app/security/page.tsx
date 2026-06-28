import type { Metadata } from "next";
import DocLayout from "@/components/DocLayout";

export const metadata: Metadata = { title: "Security & Payments" };

const toc = [
  { id: "security-overview", label: "Security Overview", level: 2 },
  { id: "payment-processing", label: "Payment Processing", level: 2 },
  { id: "stripe-integration", label: "Stripe Integration", level: 3 },
  { id: "checkout-sessions", label: "Checkout Sessions", level: 3 },
  { id: "webhooks", label: "Webhook Verification", level: 3 },
  { id: "data-protection", label: "Data Protection", level: 2 },
  { id: "encryption", label: "Encryption", level: 3 },
  { id: "session-management", label: "Session Management", level: 3 },
  { id: "file-security", label: "File Delivery Security", level: 3 },
  { id: "access-control", label: "Access Control", level: 2 },
  { id: "admin-auth", label: "Admin Authentication", level: 3 },
  { id: "role-permissions", label: "Role-Based Permissions", level: 3 },
  { id: "ip-restrictions", label: "IP Restrictions", level: 3 },
  { id: "compliance", label: "Compliance", level: 2 },
  { id: "security-checklist", label: "Production Security Checklist", level: 2 },
];

export default function SecurityPage() {
  return (
    <DocLayout
      title="Security & Payments"
      description="How Stack handles payment processing, data protection, access control, and security best practices for production deployments."
      breadcrumb="Security & Payments"
      toc={toc}
      prev={{ label: "API Reference", href: "/api-reference" }}
      next={{ label: "Integrations", href: "/integrations" }}
    >
      <h2 id="security-overview">
        Security Overview
        <a href="#security-overview" className="heading-anchor">#</a>
      </h2>
      <p>
        Stack is designed with security as a foundational principle. Since
        you&apos;re self-hosting, you have full control over your security
        posture — but it also means you&apos;re responsible for keeping your
        deployment secure.
      </p>
      <p>Key security principles:</p>
      <ul>
        <li><strong>No raw card data</strong> — Stripe handles all payment information; card numbers never touch your servers</li>
        <li><strong>Encrypted sessions</strong> — server-side sessions stored in Valkey with signed cookies</li>
        <li><strong>Signed file URLs</strong> — time-limited download links prevent unauthorized access</li>
        <li><strong>Input validation</strong> — all API inputs validated with JSON Schema</li>
        <li><strong>CORS &amp; CSP</strong> — strict content security policies configured via Caddy</li>
      </ul>

      <h2 id="payment-processing">
        Payment Processing
        <a href="#payment-processing" className="heading-anchor">#</a>
      </h2>

      <h3 id="stripe-integration">
        Stripe Integration
        <a href="#stripe-integration" className="heading-anchor">#</a>
      </h3>
      <p>
        Stack uses <strong>Stripe Checkout</strong> for payment processing.
        This means:
      </p>
      <ul>
        <li>Customers are redirected to Stripe&apos;s hosted payment page</li>
        <li>Stripe handles PCI compliance, 3D Secure, fraud detection</li>
        <li>Support for 135+ currencies and local payment methods</li>
        <li>Apple Pay, Google Pay, and Link supported automatically</li>
      </ul>
      <p>
        Configure your Stripe keys in the environment:
      </p>
      <pre><code>{`STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...`}</code></pre>

      <blockquote>
        <p>
          🔒 Never commit Stripe keys to version control. Use environment
          variables or a secrets manager in production.
        </p>
      </blockquote>

      <h3 id="checkout-sessions">
        Checkout Sessions
        <a href="#checkout-sessions" className="heading-anchor">#</a>
      </h3>
      <p>
        When a customer initiates checkout, the API creates a Stripe Checkout
        Session with the cart contents. The flow:
      </p>
      <ol>
        <li>Customer clicks &quot;Checkout&quot; on the storefront</li>
        <li>API creates a Stripe Checkout Session with line items</li>
        <li>Customer is redirected to Stripe&apos;s payment page</li>
        <li>On success, Stripe redirects back with a session ID</li>
        <li>Webhook confirms payment and triggers fulfillment</li>
      </ol>

      <h3 id="webhooks">
        Webhook Verification
        <a href="#webhooks" className="heading-anchor">#</a>
      </h3>
      <p>
        All incoming Stripe webhooks are verified using the webhook signing
        secret. The API validates the <code>Stripe-Signature</code> header
        before processing any event. Unverified webhooks are rejected with a
        400 status.
      </p>
      <pre><code>{`// Webhook events handled:
checkout.session.completed  → Create order, send download links
payment_intent.payment_failed → Log failure, notify admin
charge.refunded → Update order status, revoke access
customer.subscription.updated → Handle subscription changes`}</code></pre>

      <h2 id="data-protection">
        Data Protection
        <a href="#data-protection" className="heading-anchor">#</a>
      </h2>

      <h3 id="encryption">
        Encryption
        <a href="#encryption" className="heading-anchor">#</a>
      </h3>
      <p>Data is encrypted at multiple layers:</p>
      <ul>
        <li><strong>In transit</strong> — TLS 1.3 enforced by Caddy (automatic HTTPS in production)</li>
        <li><strong>At rest</strong> — PostgreSQL supports transparent data encryption; MinIO supports server-side encryption</li>
        <li><strong>Sessions</strong> — encrypted with the <code>SESSION_SECRET</code> key using AES-256-GCM</li>
        <li><strong>API keys</strong> — hashed with bcrypt before storage, never stored in plaintext</li>
      </ul>

      <h3 id="session-management">
        Session Management
        <a href="#session-management" className="heading-anchor">#</a>
      </h3>
      <p>Sessions are managed server-side in Valkey with the following defaults:</p>
      <table>
        <thead>
          <tr><th>Setting</th><th>Default</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td>TTL</td><td>24 hours</td><td>Session expires after inactivity</td></tr>
          <tr><td>Cookie flags</td><td><code>HttpOnly, Secure, SameSite=Lax</code></td><td>Prevents XSS/CSRF attacks</td></tr>
          <tr><td>Rotation</td><td>On privilege change</td><td>New session ID after login/role change</td></tr>
          <tr><td>Max sessions</td><td>5 per user</td><td>Oldest session evicted on overflow</td></tr>
        </tbody>
      </table>

      <h3 id="file-security">
        File Delivery Security
        <a href="#file-security" className="heading-anchor">#</a>
      </h3>
      <p>
        Digital product files are stored in MinIO with private access. When a
        customer purchases a product, the API generates a{" "}
        <strong>pre-signed URL</strong> with:
      </p>
      <ul>
        <li><strong>Expiration</strong> — links expire after 24 hours by default</li>
        <li><strong>Download limit</strong> — configurable per product (default: 5 downloads)</li>
        <li><strong>IP binding</strong> — optional: restrict downloads to the purchaser&apos;s IP</li>
        <li><strong>Audit trail</strong> — every download attempt is logged</li>
      </ul>

      <h2 id="access-control">
        Access Control
        <a href="#access-control" className="heading-anchor">#</a>
      </h2>

      <h3 id="admin-auth">
        Admin Authentication
        <a href="#admin-auth" className="heading-anchor">#</a>
      </h3>
      <p>
        Admin accounts use email/password authentication with enforced password
        requirements. Failed login attempts trigger progressive delays to prevent
        brute-force attacks.
      </p>

      <h3 id="role-permissions">
        Role-Based Permissions
        <a href="#role-permissions" className="heading-anchor">#</a>
      </h3>
      <table>
        <thead>
          <tr><th>Role</th><th>Products</th><th>Orders</th><th>Analytics</th><th>Settings</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Owner</strong></td><td>Full</td><td>Full</td><td>Full</td><td>Full</td></tr>
          <tr><td><strong>Admin</strong></td><td>Full</td><td>Full</td><td>Full</td><td>Read</td></tr>
          <tr><td><strong>Editor</strong></td><td>Edit</td><td>Read</td><td>Read</td><td>—</td></tr>
          <tr><td><strong>Support</strong></td><td>Read</td><td>Read + Resend</td><td>—</td><td>—</td></tr>
        </tbody>
      </table>

      <h3 id="ip-restrictions">
        IP Restrictions
        <a href="#ip-restrictions" className="heading-anchor">#</a>
      </h3>
      <p>
        Admin panel access can be restricted to specific IP addresses or CIDR
        ranges. Configure in the environment or admin settings. Blocked IPs
        receive a 403 response.
      </p>

      <h2 id="compliance">
        Compliance
        <a href="#compliance" className="heading-anchor">#</a>
      </h2>
      <p>Stack helps you meet common compliance requirements:</p>
      <ul>
        <li><strong>PCI DSS</strong> — Stripe Checkout handles all cardholder data, keeping you out of PCI scope</li>
        <li><strong>GDPR</strong> — customer data export and deletion endpoints available via the API</li>
        <li><strong>Cookie consent</strong> — only essential cookies used by default; analytics cookies are opt-in</li>
      </ul>

      <blockquote>
        <p>
          📝 Compliance is a shared responsibility. Stack provides the tools,
          but you&apos;re responsible for configuring them appropriately and
          maintaining compliance with applicable regulations.
        </p>
      </blockquote>

      <h2 id="security-checklist">
        Production Security Checklist
        <a href="#security-checklist" className="heading-anchor">#</a>
      </h2>
      <p>Before deploying to production, verify:</p>
      <ul>
        <li>☐ <code>SESSION_SECRET</code> is a strong random value (32+ chars)</li>
        <li>☐ Stripe webhook secret is configured and verified</li>
        <li>☐ HTTPS is enabled (Caddy does this automatically with a domain)</li>
        <li>☐ Database credentials are not defaults</li>
        <li>☐ MinIO access keys are rotated from defaults</li>
        <li>☐ Admin IP restrictions are configured</li>
        <li>☐ Rate limiting is tuned for your expected traffic</li>
        <li>☐ Backup strategy is in place for PostgreSQL and MinIO</li>
        <li>☐ Monitoring and alerting is configured</li>
        <li>☐ Dependencies are up to date (<code>npm audit</code>)</li>
      </ul>
    </DocLayout>
  );
}
