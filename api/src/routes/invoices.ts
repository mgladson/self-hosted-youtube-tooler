import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';
import { meetsMinTier } from '../plugins/auth-guard.js';
import {
  renderInvoicePdf,
  streamInvoicePdf,
  INVOICE_BRAND,
  type InvoiceRecord,
  type InvoiceBillTo,
  type InvoiceLineItem,
} from '../lib/invoice-pdf.js';

// Storage lives on the prod data volume alongside the other JSON-backed
// admin data (current-employees, ads, etc.). The volume persists across
// deploys so invoice history isn't lost on a rebuild.
const INVOICES_PATH = path.resolve(process.cwd(), '..', 'data', 'invoices.json');

type InvoicesFile = {
  invoices: InvoiceRecord[];
  nextNumber: number;
  updatedAt: string;
};

const EMPTY_FILE: InvoicesFile = { invoices: [], nextNumber: 1, updatedAt: '' };

// PUT/POST take the full editable surface plus the runtime metadata fields
// that the server controls (createdAt/updatedAt). The id is server-allocated
// on create and immutable on update — body.id is ignored.
type InvoiceWriteBody = Partial<
  Omit<InvoiceRecord, 'id'> & { saveAgency?: boolean }
>;

async function readFromDisk(): Promise<InvoicesFile> {
  try {
    const raw = await fs.readFile(INVOICES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<InvoicesFile>;
    return {
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      nextNumber:
        typeof parsed.nextNumber === 'number' && parsed.nextNumber > 0
          ? parsed.nextNumber
          : 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return { ...EMPTY_FILE };
  }
}

async function writeToDisk(file: InvoicesFile): Promise<void> {
  await fs.writeFile(INVOICES_PATH, JSON.stringify(file, null, 2) + '\n');
}

// Format an invoice number from a counter — INV-001 .. INV-999 padded to
// three digits, then grows naturally past 999 (INV-1000, etc.). Never
// reused: counter is monotonically increasing across all writes/deletes.
function formatInvoiceId(n: number): string {
  return `INV-${String(n).padStart(3, '0')}`;
}

// Three-digit sequence parsed from an invoice id: "INV-004" -> "004",
// "INV-0001" -> "001". Shared by the download filename and the email subject.
function invoiceSeq(id: string): string {
  return String(parseInt(id.replace(/\D/g, ''), 10) || 0).padStart(3, '0');
}

// Human-friendly download name for a rendered invoice:
//   Invoice<NNN>_<Worker>.pdf   e.g. Invoice004_MoeAyeNwe.pdf
// The worker is the first line item's name with spaces and punctuation
// stripped; falls back gracefully when missing so the header is always valid.
function invoiceFilename(invoice: InvoiceRecord): string {
  const worker =
    invoice.lineItems[0]?.workerName.replace(/[^A-Za-z0-9]+/g, '') || 'Worker';
  return `Invoice${invoiceSeq(invoice.id)}_${worker}.pdf`;
}

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function validBillTo(body: unknown): body is InvoiceBillTo {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Partial<InvoiceBillTo>;
  if (typeof b.name !== 'string' || b.name.trim().length === 0) return false;
  if (typeof b.address !== 'string') return false;
  if (b.email !== undefined && typeof b.email !== 'string') return false;
  return true;
}

function validLineItem(item: unknown): item is InvoiceLineItem {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Partial<InvoiceLineItem>;
  // employeeSlug links to a saved employee when chosen from the picker, but is
  // empty for a manually typed worker. workerName is the field that's required.
  if (i.employeeSlug !== undefined && typeof i.employeeSlug !== 'string') return false;
  if (typeof i.workerName !== 'string' || i.workerName.trim() === '') return false;
  if (!isValidDate(i.placementDate)) return false;
  if (typeof i.amount !== 'number' || !Number.isFinite(i.amount) || i.amount < 0) return false;
  if (i.nationality !== undefined && typeof i.nationality !== 'string') return false;
  return true;
}

// Returns an error string or null. Required fields: billTo (name+address),
// issueDate, dueDate, at least one valid line item, paymentReceived >= 0.
function validateInvoiceBody(body: InvoiceWriteBody): string | null {
  if (!isValidDate(body.issueDate)) return 'issueDate must be YYYY-MM-DD';
  if (!isValidDate(body.dueDate)) return 'dueDate must be YYYY-MM-DD';
  if (!validBillTo(body.billTo)) return 'billTo.name and billTo.address are required';
  if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
    return 'at least one line item is required';
  }
  for (let i = 0; i < body.lineItems.length; i++) {
    if (!validLineItem(body.lineItems[i])) {
      return `lineItems[${i}] is invalid (need workerName, placementDate, amount)`;
    }
  }
  const pr = body.paymentReceived;
  if (pr !== undefined && (typeof pr !== 'number' || !Number.isFinite(pr) || pr < 0)) {
    return 'paymentReceived must be a non-negative number';
  }
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    return 'notes must be a string';
  }
  return null;
}

// Build a normalized InvoiceRecord from a validated body. Strips unknown
// fields, defaults paymentReceived to 0, ensures lineItems are
// well-shaped objects.
function normalizeInvoice(
  id: string,
  body: InvoiceWriteBody,
  createdAt: string,
  updatedAt: string,
): InvoiceRecord {
  return {
    id,
    issueDate: body.issueDate as string,
    dueDate: body.dueDate as string,
    billTo: {
      name: (body.billTo as InvoiceBillTo).name.trim(),
      address: (body.billTo as InvoiceBillTo).address,
      email: (body.billTo as InvoiceBillTo).email?.trim() || undefined,
    },
    lineItems: (body.lineItems as InvoiceLineItem[]).map((li) => ({
      employeeSlug: li.employeeSlug ?? '',
      workerName: li.workerName.trim(),
      nationality: li.nationality?.trim() || undefined,
      placementDate: li.placementDate,
      amount: Math.round(li.amount * 100) / 100,
    })),
    paymentReceived: Math.round((body.paymentReceived ?? 0) * 100) / 100,
    notes: body.notes?.trim() || undefined,
    createdAt,
    updatedAt,
  };
}

const SERVICE_TOKEN_HEADER = 'x-service-token';

// Auth for the create + email endpoints, which the "Create Invoice" GH Action
// drives without a browser session. Allows either:
//   (a) a logged-in admin with editor+ tier (admin UI clicks), OR
//   (b) a request carrying X-Service-Token matching EMPLOYEES_SERVICE_TOKEN
//       (the GH Action — the same token the Toggle Employee workflow uses).
// Returns the actor identity (for the audit log) on allow, or sends 403 and
// returns null so the caller can `return reply` the rejection directly.
function authorizeInvoiceWriteOrReject(
  request: FastifyRequest,
  reply: FastifyReply,
): { email: string; name: string } | null {
  const expectedToken = process.env.EMPLOYEES_SERVICE_TOKEN;
  const headerToken = request.headers[SERVICE_TOKEN_HEADER];
  if (
    expectedToken &&
    typeof headerToken === 'string' &&
    headerToken.length === expectedToken.length &&
    crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(expectedToken))
  ) {
    return { email: 'github-actions@bot', name: 'github-actions[bot]' };
  }

  const user = request.session?.user;
  if (user && user.role === 'admin' && meetsMinTier(user.adminTier, 'editor')) {
    return { email: user.email, name: user.name };
  }

  reply.status(403).send({ error: 'Forbidden' });
  return null;
}

export async function invoicesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/invoices — list. Allows the logged-in admin (editor+) for the
  // admin UI, OR X-Service-Token for the "Sync Admin Data → Git" workflow's
  // invoice backup script — same dual-auth the create/email endpoints use, so
  // the sync can mirror invoices.json into git the way it does employees/agencies.
  fastify.get('/api/invoices', async (request, reply) => {
    const actor = authorizeInvoiceWriteOrReject(request, reply);
    if (!actor) return reply;
    reply.header('Cache-Control', 'no-store');
    const file = await readFromDisk();
    return reply.send(file);
  });

  // GET /api/invoices/:id — single invoice.
  fastify.get<{ Params: { id: string } }>(
    '/api/invoices/:id',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const { id } = request.params;
      const file = await readFromDisk();
      const invoice = file.invoices.find((i) => i.id === id);
      if (!invoice) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }
      reply.header('Cache-Control', 'no-store');
      return reply.send(invoice);
    },
  );

  // POST /api/invoices — create. Allocates the next INV-NNNN, increments
  // the counter monotonically (counter is never decremented, even on
  // subsequent delete).
  fastify.post<{ Body: InvoiceWriteBody }>(
    '/api/invoices',
    async (request, reply) => {
      const actor = authorizeInvoiceWriteOrReject(request, reply);
      if (!actor) return reply;

      const body = request.body ?? {};
      const validationError = validateInvoiceBody(body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const file = await readFromDisk();
      const id = formatInvoiceId(file.nextNumber);
      const now = new Date().toISOString();
      const created = normalizeInvoice(id, body, now, now);

      file.invoices.push(created);
      file.nextNumber += 1;
      file.updatedAt = now;

      try {
        await writeToDisk(file);
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write invoices.json');
        return reply.status(500).send({ error: 'Failed to save invoice' });
      }

      writeAuditLog(fastify, {
        userEmail: actor.email,
        userName: actor.name,
        action: 'create',
        resourceType: 'invoice',
        resourceId: id,
        summary: `Created invoice ${id} for ${created.billTo.name} (SGD ${created.lineItems.reduce((s, li) => s + li.amount, 0).toFixed(2)})`,
        ip: getClientIp(request),
      }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

      return reply.status(201).send(created);
    },
  );

  // PUT /api/invoices/:id — update. id and createdAt are immutable. The
  // counter is not affected — editing INV-0003 leaves nextNumber unchanged.
  fastify.put<{ Params: { id: string }; Body: InvoiceWriteBody }>(
    '/api/invoices/:id',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { id } = request.params;
      const body = request.body ?? {};
      const validationError = validateInvoiceBody(body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const file = await readFromDisk();
      const idx = file.invoices.findIndex((i) => i.id === id);
      if (idx < 0) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }

      const existing = file.invoices[idx];
      const now = new Date().toISOString();
      const updated = normalizeInvoice(id, body, existing.createdAt ?? now, now);
      file.invoices[idx] = updated;
      file.updatedAt = now;

      try {
        await writeToDisk(file);
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write invoices.json');
        return reply.status(500).send({ error: 'Failed to save invoice' });
      }

      writeAuditLog(fastify, {
        userEmail: user.email,
        userName: user.name,
        action: 'update',
        resourceType: 'invoice',
        resourceId: id,
        summary: `Updated invoice ${id} (${updated.billTo.name})`,
        ip: getClientIp(request),
      }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

      return reply.send(updated);
    },
  );

  // GET /api/invoices/:id/pdf — render the invoice as a PDF and stream it
  // back. Same auth as the JSON endpoint. Content-Disposition is `inline`
  // so a browser preview opens the file rather than forcing a download
  // (the admin UI's "Download" button uses the same endpoint with a
  // download attribute on the anchor to override).
  fastify.get<{ Params: { id: string } }>(
    '/api/invoices/:id/pdf',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const { id } = request.params;
      const file = await readFromDisk();
      const invoice = file.invoices.find((i) => i.id === id);
      if (!invoice) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }
      // Stream the PDF through a PassThrough instead of buffering the whole
      // (~2 MB) document in memory: streamInvoicePdf pipes the PDFKit doc into
      // the PassThrough and Fastify pipes that to the socket with backpressure,
      // so only a small window is held at once. Routing through reply.send
      // (rather than hijacking reply.raw) keeps Fastify's normal pipeline —
      // onResponse metrics and stream error handling, so a render failure
      // before the first byte still becomes a clean 500. Content-Length is
      // omitted (not known until render finishes) so the body is sent chunked.
      const stream = new PassThrough();
      streamInvoicePdf(invoice, stream).catch((err) => {
        request.log.error({ err, id }, 'invoice pdf stream failed');
        stream.destroy(err instanceof Error ? err : new Error(String(err)));
      });
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="${invoiceFilename(invoice)}"`)
        .header('Cache-Control', 'no-store');
      return reply.send(stream);
    },
  );

  // POST /api/invoices/:id/email — render the invoice and email it (as a
  // PDF attachment) to the Send Burmese mailbox. Recipient is always the
  // brand email; we don't accept a body-level override so a compromised
  // admin session can't exfiltrate invoice data to an arbitrary address.
  fastify.post<{ Params: { id: string } }>(
    '/api/invoices/:id/email',
    async (request, reply) => {
      const actor = authorizeInvoiceWriteOrReject(request, reply);
      if (!actor) return reply;
      const { id } = request.params;
      const file = await readFromDisk();
      const invoice = file.invoices.find((i) => i.id === id);
      if (!invoice) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }

      const buf = await renderInvoicePdf(invoice);
      const subtotal = invoice.lineItems.reduce((s, li) => s + li.amount, 0);
      const balance = subtotal - invoice.paymentReceived;
      // Worker(s) on the invoice. The subject leads with the first worker to
      // stay short; the body lists every worker so multi-placement invoices
      // still show each name.
      const workerNames = invoice.lineItems
        .map((li) => li.workerName.trim())
        .filter(Boolean);
      const primaryWorker = workerNames[0] || 'Worker';
      const workerList = workerNames.length > 0 ? workerNames.join(', ') : 'Worker';
      // Headline amount = invoice total, shown as a plain figure (drop the
      // trailing ".00" on whole amounts) to match the "(1500 SGD)" style.
      const total = Math.round(subtotal * 100) / 100;
      const totalStr = Number.isInteger(total) ? String(total) : total.toFixed(2);
      const filename = `${INVOICE_BRAND.name.replace(/\s+/g, '')}_Invoice_${id}_${invoice.billTo.name.replace(/[^A-Za-z0-9]+/g, '')}_${invoice.issueDate}.pdf`;
      const subject = `Invoice ${invoiceSeq(id)} ${primaryWorker} (${totalStr} SGD) ${invoice.billTo.name}`;
      const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#374151;line-height:1.5">
  <p>Invoice <strong>${id}</strong> for <strong>${invoice.billTo.name}</strong> is attached.</p>
  <ul style="padding-left:18px;margin:8px 0">
    <li>Worker/Employee: ${workerList}</li>
    <li>Issue date: ${invoice.issueDate}</li>
    <li>Due date: ${invoice.dueDate}</li>
    <li>Subtotal: SGD ${subtotal.toFixed(2)}</li>
    <li>Payment received: SGD ${invoice.paymentReceived.toFixed(2)}</li>
    <li><strong>Balance due: SGD ${balance.toFixed(2)}</strong></li>
  </ul>
  <p style="color:#6B7280;font-size:12px">Sent automatically by ${INVOICE_BRAND.name} admin.</p>
</div>`;

      try {
        await fastify.mailer.sendMail(
          INVOICE_BRAND.email,
          subject,
          html,
          undefined,
          [{ filename, content: buf, contentType: 'application/pdf' }],
          INVOICE_BRAND.mailFrom,
        );
      } catch (err) {
        fastify.log.error({ err, id }, 'Failed to email invoice PDF');
        return reply.status(502).send({ error: 'Failed to send email' });
      }

      writeAuditLog(fastify, {
        userEmail: actor.email,
        userName: actor.name,
        action: 'send',
        resourceType: 'invoice',
        resourceId: id,
        summary: `Emailed invoice ${id} (${invoice.billTo.name}) to ${INVOICE_BRAND.email}`,
        ip: getClientIp(request),
      }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

      return reply.send({ id, sentTo: INVOICE_BRAND.email, filename });
    },
  );

  // DELETE /api/invoices/:id — remove. nextNumber is NOT decremented, so
  // future invoices skip the deleted slot rather than reusing it.
  fastify.delete<{ Params: { id: string } }>(
    '/api/invoices/:id',
    async (request, reply) => {
      const user = request.session?.user;
      if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'editor')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const { id } = request.params;
      const file = await readFromDisk();
      const idx = file.invoices.findIndex((i) => i.id === id);
      if (idx < 0) {
        return reply.status(404).send({ error: 'Invoice not found' });
      }
      const removed = file.invoices[idx];
      file.invoices.splice(idx, 1);
      file.updatedAt = new Date().toISOString();

      try {
        await writeToDisk(file);
      } catch (err) {
        fastify.log.error({ err }, 'Failed to write invoices.json');
        return reply.status(500).send({ error: 'Failed to delete invoice' });
      }

      writeAuditLog(fastify, {
        userEmail: user.email,
        userName: user.name,
        action: 'delete',
        resourceType: 'invoice',
        resourceId: id,
        summary: `Deleted invoice ${id} (${removed.billTo.name})`,
        ip: getClientIp(request),
      }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

      return reply.send({ id, deleted: true });
    },
  );
}
