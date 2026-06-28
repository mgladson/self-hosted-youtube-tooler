import type { Metadata } from "next";
import Link from "next/link";
import DocLayout from "@/components/DocLayout";

export const metadata: Metadata = { title: "Integrations" };

const toc = [
  { id: "overview", label: "Overview", level: 2 },
  { id: "payment-providers", label: "Payment Providers", level: 2 },
  { id: "stripe", label: "Stripe", level: 3 },
  { id: "additional-providers", label: "Additional Providers", level: 3 },
  { id: "email-services", label: "Email Services", level: 2 },
  { id: "transactional-email", label: "Transactional Email", level: 3 },
  { id: "email-templates", label: "Email Templates", level: 3 },
  { id: "storage-providers", label: "Storage Providers", level: 2 },
  { id: "analytics-tracking", label: "Analytics & Tracking", level: 2 },
  { id: "webhooks", label: "Webhooks", level: 2 },
  { id: "webhook-events", label: "Webhook Events", level: 3 },
  { id: "webhook-security", label: "Webhook Security", level: 3 },
  { id: "third-party", label: "Third-Party Services", level: 2 },
  { id: "building-custom", label: "Building Custom Integrations", level: 2 },
];

export default function IntegrationsPage() {
  return (
    <DocLayout
      title="Integrations"
      description="Connect Stack with payment providers, email services, storage backends, analytics platforms, and custom third-party services via webhooks and the API."
      breadcrumb="Integrations"
      toc={toc}
      prev={{ label: "Security & Payments", href: "/security" }}
    >
      <h2 id="overview">
        Overview
        <a href="#overview" className="heading-anchor">#</a>
      </h2>
      <p>
        Stack is designed to integrate cleanly with external services. Core
        integrations — payments, email, and storage — are configured via
        environment variables. Custom integrations can be built using webhooks
        and the REST API.
      </p>

      <h2 id="payment-providers">
        Payment Providers
        <a href="#payment-providers" className="heading-anchor">#</a>
      </h2>

      <h3 id="stripe">
        Stripe
        <a href="#stripe" className="heading-anchor">#</a>
      </h3>
      <p>
        Stripe is the primary payment provider. It handles checkout,
        subscriptions, refunds, and payouts. Configuration:
      </p>
      <pre><code>{`# Required
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional
STRIPE_PUBLISHABLE_KEY=pk_live_...   # For client-side elements
STRIPE_CURRENCY=usd                   # Default currency
STRIPE_TAX_ENABLED=true               # Enable Stripe Tax`}</code></pre>
      <p>Stripe features used by Stack:</p>
      <ul>
        <li><strong>Checkout Sessions</strong> — hosted payment pages with built-in fraud detection</li>
        <li><strong>Customer Portal</strong> — self-service subscription management</li>
        <li><strong>Invoices</strong> — automatic invoice generation and delivery</li>
        <li><strong>Tax</strong> — automatic tax calculation for supported regions</li>
        <li><strong>Coupons</strong> — discount codes with usage limits and expiry dates</li>
      </ul>

      <h3 id="additional-providers">
        Additional Providers
        <a href="#additional-providers" className="heading-anchor">#</a>
      </h3>
      <p>
        While Stripe is the recommended provider, the payment layer is
        abstracted to support alternatives. Community-maintained adapters exist
        for:
      </p>
      <ul>
        <li><strong>LemonSqueezy</strong> — merchant of record, handles tax collection</li>
        <li><strong>Paddle</strong> — merchant of record with subscription support</li>
        <li><strong>PayPal</strong> — for markets where Stripe isn&apos;t available</li>
      </ul>

      <blockquote>
        <p>
          📝 Community payment adapters are maintained separately and may not
          support all Stack features. Check adapter documentation for
          compatibility.
        </p>
      </blockquote>

      <h2 id="email-services">
        Email Services
        <a href="#email-services" className="heading-anchor">#</a>
      </h2>

      <h3 id="transactional-email">
        Transactional Email
        <a href="#transactional-email" className="heading-anchor">#</a>
      </h3>
      <p>
        Stack sends transactional emails for order confirmations, download
        links, password resets, and support replies. Configure your email
        provider:
      </p>
      <pre><code>{`# SMTP (works with any provider)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
SMTP_FROM=orders@yourstore.com

# Or use provider-specific APIs:
EMAIL_PROVIDER=resend           # resend, sendgrid, postmark, ses
EMAIL_API_KEY=re_xxxxx`}</code></pre>
      <p>In development, Stack uses <strong>Mailpit</strong> to catch all outgoing emails. View them at <code>http://localhost:8025</code>.</p>

      <h3 id="email-templates">
        Email Templates
        <a href="#email-templates" className="heading-anchor">#</a>
      </h3>
      <p>Built-in email templates include:</p>
      <ul>
        <li><strong>Order confirmation</strong> — receipt with line items and download links</li>
        <li><strong>Download ready</strong> — sent when file processing completes</li>
        <li><strong>Password reset</strong> — secure reset link with expiry</li>
        <li><strong>Support reply</strong> — notification when support responds</li>
        <li><strong>Refund processed</strong> — confirmation with refund details</li>
      </ul>
      <p>
        Templates are customizable HTML files in the <code>api/src/templates/</code>{" "}
        directory. Variables are injected using <code>{"{{variable}}"}</code>{" "}
        syntax.
      </p>

      <h2 id="storage-providers">
        Storage Providers
        <a href="#storage-providers" className="heading-anchor">#</a>
      </h2>
      <p>
        Stack uses the S3 protocol for file storage, making it compatible with
        multiple providers:
      </p>
      <table>
        <thead>
          <tr><th>Provider</th><th>Configuration</th><th>Notes</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>MinIO</strong></td><td>Default (local)</td><td>Included in Docker Compose</td></tr>
          <tr><td><strong>AWS S3</strong></td><td><code>S3_ENDPOINT=s3.amazonaws.com</code></td><td>Production recommended</td></tr>
          <tr><td><strong>Cloudflare R2</strong></td><td><code>S3_ENDPOINT=xxx.r2.cloudflarestorage.com</code></td><td>No egress fees</td></tr>
          <tr><td><strong>Backblaze B2</strong></td><td><code>S3_ENDPOINT=s3.us-west-004.backblazeb2.com</code></td><td>Cost-effective</td></tr>
          <tr><td><strong>DigitalOcean Spaces</strong></td><td><code>S3_ENDPOINT=nyc3.digitaloceanspaces.com</code></td><td>CDN included</td></tr>
        </tbody>
      </table>

      <h2 id="analytics-tracking">
        Analytics &amp; Tracking
        <a href="#analytics-tracking" className="heading-anchor">#</a>
      </h2>
      <p>
        Stack includes built-in analytics, but you can also connect external
        tracking services. The storefront supports:
      </p>
      <ul>
        <li><strong>Google Analytics 4</strong> — set <code>NEXT_PUBLIC_GA_ID</code></li>
        <li><strong>Plausible</strong> — set <code>NEXT_PUBLIC_PLAUSIBLE_DOMAIN</code></li>
        <li><strong>PostHog</strong> — set <code>NEXT_PUBLIC_POSTHOG_KEY</code></li>
        <li><strong>Facebook Pixel</strong> — set <code>NEXT_PUBLIC_FB_PIXEL_ID</code></li>
      </ul>
      <p>
        E-commerce events (view_item, add_to_cart, purchase) are automatically
        emitted to configured analytics providers.
      </p>

      <h2 id="webhooks">
        Webhooks
        <a href="#webhooks" className="heading-anchor">#</a>
      </h2>
      <p>
        Stack can send webhook notifications to your own services when events
        occur. Configure webhook endpoints in the admin panel under{" "}
        <strong>Settings → Webhooks</strong>.
      </p>

      <h3 id="webhook-events">
        Webhook Events
        <a href="#webhook-events" className="heading-anchor">#</a>
      </h3>
      <table>
        <thead>
          <tr><th>Event</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>order.created</code></td><td>New order placed and payment confirmed</td></tr>
          <tr><td><code>order.refunded</code></td><td>Order refund processed</td></tr>
          <tr><td><code>product.created</code></td><td>New product published</td></tr>
          <tr><td><code>product.updated</code></td><td>Product details changed</td></tr>
          <tr><td><code>customer.created</code></td><td>New customer account created</td></tr>
          <tr><td><code>download.completed</code></td><td>Customer downloaded a file</td></tr>
        </tbody>
      </table>

      <h3 id="webhook-security">
        Webhook Security
        <a href="#webhook-security" className="heading-anchor">#</a>
      </h3>
      <p>
        Each webhook delivery includes a signature in the{" "}
        <code>X-Stack-Signature</code> header. Verify it on your end:
      </p>
      <pre><code>{`import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}</code></pre>

      <h2 id="third-party">
        Third-Party Services
        <a href="#third-party" className="heading-anchor">#</a>
      </h2>
      <p>Common third-party integrations:</p>
      <ul>
        <li><strong>Slack</strong> — get notified on new orders, support tickets, and refunds via webhook → Slack workflow</li>
        <li><strong>Zapier / Make</strong> — connect Stack events to 5000+ apps via webhooks</li>
        <li><strong>Discord</strong> — post order notifications to a channel</li>
        <li><strong>Notion</strong> — sync product catalog and order data</li>
      </ul>

      <h2 id="building-custom">
        Building Custom Integrations
        <a href="#building-custom" className="heading-anchor">#</a>
      </h2>
      <p>
        For integrations not covered above, use the REST API and webhooks to
        build custom solutions:
      </p>
      <ol>
        <li><strong>API Keys</strong> — create a scoped API key in admin settings</li>
        <li><strong>Webhooks</strong> — subscribe to relevant events</li>
        <li><strong>REST API</strong> — use the <Link href="/api-reference">API Reference</Link> to read and write data</li>
      </ol>
      <pre><code>{`// Example: Sync new orders to an external CRM
app.post('/webhook/stack', async (req, res) => {
  const event = req.body;

  if (event.type === 'order.created') {
    await crm.createContact({
      email: event.data.customer_email,
      name: event.data.customer_name,
      tags: ['customer', 'stack-commerce'],
      custom: {
        order_id: event.data.id,
        total: event.data.total,
      }
    });
  }

  res.json({ received: true });
});`}</code></pre>

      <blockquote>
        <p>
          💡 When building integrations, always verify webhook signatures,
          handle retries idempotently, and respond with a 200 status quickly
          to avoid timeouts.
        </p>
      </blockquote>
    </DocLayout>
  );
}
