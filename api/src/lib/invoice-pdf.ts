import path from 'node:path';
import PDFDocument from 'pdfkit';

// Find Care Helper branding & banking constants. Hardcoded here so the invoice
// template is the single source of truth — change a value once and every
// future invoice picks it up. If these ever need to vary by environment,
// swap to reading from `config` and surface them in admin Settings.
export const INVOICE_BRAND = {
  name: 'Find Care Helper',
  tagline: 'Fast, Easy, High Quality Employees',
  website: 'findcarehelper.com',
  email: 'findcarehelper@gmail.com',
  // From-address for the automated "Email PDF" send. Distinct from `email`
  // above (the customer-facing contact printed on the PDF): outbound invoice
  // mail is sent as no-reply so replies don't land in the contact inbox.
  mailFrom: 'noreply@findcarehelper.com',
  whatsappUrl: 'https://wa.me/qr/B6GMKE5VMO3UG1',
  bank: {
    name: 'Wise Asia-Pacific Pte. Ltd.',
    address: '2 Tanjong Katong Road, #07-01, PLQ3,\nSingapore 437161',
    accountName: 'Matthew Rivera Gladson',
    bankCode: '0516',
    accountNo: '299-991-25',
    swift: 'TRWISGSGXXX',
    note: 'Local SGD transfers accepted via FAST.',
  },
  thankYou: 'Thank you for choosing Find Care Helper.',
  footerNote:
    'Fees are governed by the employment agency regulations applicable in your jurisdiction. Please retain this invoice for your records.',
};

const COLORS = {
  navy: '#1F3445',
  navyDeep: '#162635',
  gold: '#D7A924',
  body: '#374151',
  muted: '#6B7280',
  border: '#D1D5DB',
  rowBg: '#F4F5F7',
  white: '#FFFFFF',
};

// Resolve asset paths relative to api workspace cwd. Dockerfile sets
// WORKDIR /app/api and the existing data-file routes (current-employees,
// banner, etc.) follow the same `process.cwd()`-relative convention.
const ASSET_DIR = path.resolve(process.cwd(), 'assets', 'invoice');
// `header.png` is the default pagoda-sunset banner. `header-bay.png` is an
// alternate sailboats-at-sunset design kept alongside it; swap the path
// below to switch the active design for all future invoices.
const ASSETS = {
  header: path.join(ASSET_DIR, 'header.png'),
  logo: path.join(ASSET_DIR, 'logo.png'),
  iconEmail: path.join(ASSET_DIR, 'icon-email.png'),
  iconWhatsapp: path.join(ASSET_DIR, 'icon-whatsapp.png'),
};

export type InvoiceLineItem = {
  employeeSlug: string;
  workerName: string;
  nationality?: string; // defaults to 'Myanmar'
  placementDate: string; // YYYY-MM-DD
  amount: number; // SGD
};

export type InvoiceBillTo = {
  name: string;
  address: string; // multi-line, separated by \n
  email?: string;
};

export type InvoiceRecord = {
  id: string; // INV-NNNN
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  billTo: InvoiceBillTo;
  lineItems: InvoiceLineItem[];
  paymentReceived: number;
  notes?: string;
  // Timestamps are written by the storage layer; the PDF renderer ignores
  // them but they ride along on the stored object.
  createdAt?: string;
  updatedAt?: string;
};

function formatSgd(amount: number): string {
  return amount.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  // YYYY-MM-DD → "22 May 2026". Falls back to the raw string if it can't
  // parse, so a malformed date doesn't blow up PDF generation.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

// Page geometry — A4 at default pdfkit resolution (595.28 x 841.89 pt).
// Margins are zero so the header banner can bleed edge-to-edge; content
// margins are applied per-section via CONTENT_LEFT/RIGHT.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_LEFT = 40;
const CONTENT_RIGHT = PAGE_WIDTH - 40;
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;

export function renderInvoicePdf(invoice: InvoiceRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title: `${INVOICE_BRAND.name} Invoice ${invoice.id}`,
        Author: INVOICE_BRAND.name,
        Subject: `Invoice ${invoice.id}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawAll(doc, invoice);
    } catch (err) {
      reject(err);
    }
  });
}

// Streaming variant for the HTTP route — pipes directly into reply.raw
// without buffering the whole PDF in memory. Returns a promise that
// resolves when the stream is closed.
export function streamInvoicePdf(
  invoice: InvoiceRecord,
  destination: NodeJS.WritableStream,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: {
        Title: `${INVOICE_BRAND.name} Invoice ${invoice.id}`,
        Author: INVOICE_BRAND.name,
        Subject: `Invoice ${invoice.id}`,
      },
    });
    doc.on('error', reject);
    destination.on('error', reject);
    destination.on('finish', () => resolve());
    doc.pipe(destination);
    try {
      drawAll(doc, invoice);
    } catch (err) {
      reject(err);
    }
  });
}

function drawAll(doc: PDFKit.PDFDocument, invoice: InvoiceRecord): void {
  const afterHeader = drawHeader(doc);
  const afterMeta = drawMetaRow(doc, invoice, afterHeader + 18);
  const afterBillTo = drawBillTo(doc, invoice, afterMeta + 20);
  const afterTable = drawLineItems(doc, invoice, afterBillTo + 20);
  const afterTotals = drawTotals(doc, invoice, afterTable + 8);
  drawFooter(doc, afterTotals + 28);
  drawPageFooterBar(doc);
  doc.end();
}

function drawHeader(doc: PDFKit.PDFDocument): number {
  // Full-bleed pagoda banner. The original invoice renders this image at a
  // slightly taller-than-native aspect; we match by fixing height to 175pt
  // and letting pdfkit stretch — the silhouettes still read clearly and
  // the band reads visually correct.
  const bannerH = 175;
  doc.image(ASSETS.header, 0, 0, { width: PAGE_WIDTH, height: bannerH });

  // Darkening tint over the banner art. The sunset highlights are bright
  // enough to wash out the white brand text and "INVOICE" label; a
  // semi-transparent navy wash drops the background luminance so the
  // overlaid white type stays legible while the sunset still reads through.
  doc.save();
  doc.fillOpacity(0.45).fillColor(COLORS.navyDeep).rect(0, 0, PAGE_WIDTH, bannerH).fill();
  doc.restore();

  // Brand text sits at the left edge of the banner. The circular logo that
  // previously preceded it has been disabled, so the brand block starts at the
  // content margin and lines up with the meta/bill-to columns below.
  const brandX = CONTENT_LEFT;

  // Readability panel behind the brand block. Even with the banner tint the
  // lighter tagline and url wash out over the bright sunset, so drop a
  // translucent gray card behind just this text to guarantee contrast.
  doc.font('Helvetica-Bold').fontSize(28);
  const brandNameW = doc.widthOfString(INVOICE_BRAND.name);
  doc.font('Helvetica-Oblique').fontSize(10);
  const brandTagW = doc.widthOfString(INVOICE_BRAND.tagline);
  const brandPanelW = Math.max(brandNameW, brandTagW) + 20;
  doc.save();
  doc.fillOpacity(0.55).fillColor('#2A2F37');
  doc.roundedRect(brandX - 10, 30, brandPanelW, 76, 6).fill();
  doc.restore();

  // Brand text overlaid on the left of the banner, right of the logo.
  doc
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(28)
    .text(INVOICE_BRAND.name, brandX, 36, { lineBreak: false });
  doc
    .font('Helvetica-Oblique')
    .fontSize(10)
    .text(INVOICE_BRAND.tagline, brandX, 72, { lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(INVOICE_BRAND.website, brandX, 90, { lineBreak: false });
  // Make the printed url a clickable link to the live site. Use the explicit
  // rect form (doc.link) rather than text's `link` option — the latter derives
  // a NaN annotation rect for absolutely-positioned, non-wrapping text here.
  const websiteW = doc.widthOfString(INVOICE_BRAND.website);
  doc.link(brandX, 90, websiteW, 12, `https://${INVOICE_BRAND.website}`);

  // "INVOICE" label on the right side of the banner.
  doc
    .font('Helvetica-Bold')
    .fontSize(34)
    .text('INVOICE', CONTENT_LEFT, 48, {
      width: CONTENT_WIDTH,
      align: 'right',
      lineBreak: false,
    });

  // Dark navy band beneath the banner, with a thin gold accent strip below.
  doc.rect(0, bannerH, PAGE_WIDTH, 16).fill(COLORS.navyDeep);
  doc.rect(0, bannerH + 16, PAGE_WIDTH, 4).fill(COLORS.gold);
  return bannerH + 20;
}

function drawMetaRow(doc: PDFKit.PDFDocument, invoice: InvoiceRecord, y: number): number {
  // Three-column meta strip: Invoice No, Invoice Date, Due Date.
  const colW = CONTENT_WIDTH / 3;
  const rowH = 50;
  doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, rowH).fill(COLORS.rowBg);
  doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, rowH).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  // Internal vertical separators.
  doc
    .moveTo(CONTENT_LEFT + colW, y)
    .lineTo(CONTENT_LEFT + colW, y + rowH)
    .stroke();
  doc
    .moveTo(CONTENT_LEFT + colW * 2, y)
    .lineTo(CONTENT_LEFT + colW * 2, y + rowH)
    .stroke();

  const labels = ['INVOICE NO.', 'INVOICE DATE', 'DUE DATE'];
  const values = [invoice.id, formatDate(invoice.issueDate), formatDate(invoice.dueDate)];
  for (let i = 0; i < 3; i++) {
    const x = CONTENT_LEFT + colW * i + 14;
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(labels[i], x, y + 12, { lineBreak: false });
    doc
      .fillColor(COLORS.navy)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(values[i], x, y + 26, { lineBreak: false });
  }
  return y + rowH;
}

function drawBillTo(doc: PDFKit.PDFDocument, invoice: InvoiceRecord, y: number): number {
  // Bill-to card: thin gold rule on top, label, then name + multi-line
  // address + optional email below.
  const lines: string[] = [invoice.billTo.name];
  if (invoice.billTo.address) {
    for (const line of invoice.billTo.address.split('\n')) {
      if (line.trim()) lines.push(line);
    }
  }
  if (invoice.billTo.email) lines.push(invoice.billTo.email);

  const padding = 16;
  const lineHeight = 14;
  const labelGap = 28;
  const boxH = labelGap + lines.length * lineHeight + padding;
  const boxW = CONTENT_WIDTH * 0.5;

  doc.rect(CONTENT_LEFT, y, boxW, boxH).fill(COLORS.rowBg);
  doc.rect(CONTENT_LEFT, y, boxW, 3).fill(COLORS.gold);

  doc
    .fillColor(COLORS.navy)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('BILL TO (RECEIVING AGENCY)', CONTENT_LEFT + padding, y + 12, { lineBreak: false });

  doc.fillColor(COLORS.body).font('Helvetica').fontSize(10);
  let cursor = y + labelGap + 6;
  for (const line of lines) {
    doc.text(line, CONTENT_LEFT + padding, cursor, { lineBreak: false });
    cursor += lineHeight;
  }
  return y + boxH;
}

function drawLineItems(doc: PDFKit.PDFDocument, invoice: InvoiceRecord, y: number): number {
  // Header row.
  const headerH = 28;
  const amountColW = 130;
  const descColW = CONTENT_WIDTH - amountColW;
  doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, headerH).fill(COLORS.navy);
  doc
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('DESCRIPTION', CONTENT_LEFT + 14, y + 10, { lineBreak: false });
  doc.text('INVOICE AMOUNT (SGD)', CONTENT_LEFT + descColW, y + 10, {
    width: amountColW - 14,
    align: 'right',
    lineBreak: false,
  });

  let cursor = y + headerH;
  for (let i = 0; i < invoice.lineItems.length; i++) {
    const item = invoice.lineItems[i];
    const nationality = item.nationality?.trim() || 'Myanmar';
    const rowH = 72;

    // Main description.
    doc
      .fillColor(COLORS.body)
      .font('Helvetica')
      .fontSize(11)
      .text(
        'Domestic Helper Placement & Processing Fee',
        CONTENT_LEFT + 14,
        cursor + 12,
        { lineBreak: false },
      );
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(
        'Includes recruitment, documentation, medical certifications, training, & deployment',
        CONTENT_LEFT + 14,
        cursor + 30,
        { lineBreak: false },
      );
    doc
      .fillColor(COLORS.body)
      .fontSize(9)
      .text(
        `Worker: ${item.workerName}  |  Nationality: ${nationality}`,
        CONTENT_LEFT + 14,
        cursor + 44,
        { lineBreak: false },
      );
    doc.text(
      `Date of Placement: ${formatDate(item.placementDate)}`,
      CONTENT_LEFT + 14,
      cursor + 58,
      { lineBreak: false },
    );

    // Amount, right-aligned.
    doc
      .fillColor(COLORS.body)
      .font('Helvetica')
      .fontSize(11)
      .text(formatSgd(item.amount), CONTENT_LEFT + descColW, cursor + 12, {
        width: amountColW - 14,
        align: 'right',
        lineBreak: false,
      });

    cursor += rowH;

    // Hairline divider between rows (skipped after the last row).
    if (i < invoice.lineItems.length - 1) {
      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(CONTENT_LEFT + 14, cursor)
        .lineTo(CONTENT_RIGHT - 14, cursor)
        .stroke();
    }
  }

  // Bottom rule under the table.
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(CONTENT_LEFT, cursor)
    .lineTo(CONTENT_RIGHT, cursor)
    .stroke();

  return cursor;
}

function drawTotals(doc: PDFKit.PDFDocument, invoice: InvoiceRecord, y: number): number {
  // Right-side totals block. Subtotal, tax (always 0), optional payment
  // received, then a navy "BALANCE DUE" emphasis bar.
  const subtotal = invoice.lineItems.reduce((acc, li) => acc + li.amount, 0);
  const tax = 0;
  // Floored at 0 so an overpayment never prints a negative "Balance Due".
  const balance = Math.max(0, subtotal + tax - invoice.paymentReceived);

  const blockW = 240;
  const blockX = CONTENT_RIGHT - blockW;
  const rowH = 22;

  const rows: { label: string; value: string; muted?: boolean }[] = [
    { label: 'Subtotal', value: `SGD ${formatSgd(subtotal)}` },
    { label: 'Tax / GST', value: formatSgd(tax) },
  ];
  if (invoice.paymentReceived > 0) {
    rows.push({ label: 'Payment Received', value: `- ${formatSgd(invoice.paymentReceived)}` });
  }

  let cursor = y;
  for (const row of rows) {
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(blockX, cursor + rowH)
      .lineTo(CONTENT_RIGHT, cursor + rowH)
      .stroke();
    doc
      .fillColor(row.muted ? COLORS.muted : COLORS.body)
      .font('Helvetica')
      .fontSize(10)
      .text(row.label, blockX + 8, cursor + 7, { lineBreak: false });
    doc.text(row.value, blockX, cursor + 7, {
      width: blockW - 8,
      align: 'right',
      lineBreak: false,
    });
    cursor += rowH;
  }

  // "Thank you" line on the left, balance due bar on the right.
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica-Oblique')
    .fontSize(10)
    .text(INVOICE_BRAND.thankYou, CONTENT_LEFT, cursor + 14, { lineBreak: false });

  const balanceH = 32;
  doc.rect(blockX, cursor + 6, blockW, balanceH).fill(COLORS.navy);
  doc
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('BALANCE DUE', blockX + 12, cursor + 17, { lineBreak: false });
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(`SGD ${formatSgd(balance)}`, blockX, cursor + 16, {
      width: blockW - 12,
      align: 'right',
      lineBreak: false,
    });

  return cursor + 6 + balanceH;
}

function drawFooter(doc: PDFKit.PDFDocument, y: number): void {
  // Two columns: payment instructions on the left, notes + contact on the
  // right.
  const colW = CONTENT_WIDTH / 2 - 10;
  const leftX = CONTENT_LEFT;
  const rightX = CONTENT_LEFT + CONTENT_WIDTH / 2 + 10;

  // Top divider line spanning both columns.
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(CONTENT_LEFT, y - 8)
    .lineTo(CONTENT_RIGHT, y - 8)
    .stroke();

  // LEFT: Payment instructions.
  doc
    .fillColor(COLORS.navy)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('PAYMENT INSTRUCTIONS', leftX, y, { lineBreak: false });

  doc.fillColor(COLORS.body).font('Helvetica').fontSize(9);
  let lcursor = y + 16;
  const lineH = 12;
  const lines = [
    `Bank: ${INVOICE_BRAND.bank.name}`,
    ...INVOICE_BRAND.bank.address.split('\n'),
    `Account Name: ${INVOICE_BRAND.bank.accountName}`,
    `Bank Code: ${INVOICE_BRAND.bank.bankCode} | Account No.: ${INVOICE_BRAND.bank.accountNo}`,
    `SWIFT/BIC: ${INVOICE_BRAND.bank.swift}`,
  ];
  for (const line of lines) {
    doc.text(line, leftX, lcursor, { width: colW, lineBreak: false });
    lcursor += lineH;
  }
  doc
    .fillColor(COLORS.navy)
    .font('Helvetica-Bold')
    .text(INVOICE_BRAND.bank.note, leftX, lcursor + 4, { width: colW, lineBreak: false });

  // RIGHT: Notes + contact icons.
  doc
    .fillColor(COLORS.navy)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('NOTES', rightX, y, { lineBreak: false });
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(9)
    .text(INVOICE_BRAND.footerNote, rightX, y + 16, { width: colW });

  // Contact strip — icons sized at 11x11 next to their text.
  const contactY = y + 70;
  doc
    .fillColor(COLORS.navy)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Contact us:', rightX, contactY, { lineBreak: false });
  doc.image(ASSETS.iconEmail, rightX, contactY + 14, { width: 11, height: 11 });
  doc
    .fillColor(COLORS.body)
    .font('Helvetica')
    .fontSize(9)
    .text(INVOICE_BRAND.email, rightX + 18, contactY + 15, { lineBreak: false });
  doc.image(ASSETS.iconWhatsapp, rightX, contactY + 30, { width: 11, height: 11 });
  doc.text(INVOICE_BRAND.whatsappUrl, rightX + 18, contactY + 31, { lineBreak: false });
}

function drawPageFooterBar(doc: PDFKit.PDFDocument): void {
  // Navy band at the very bottom edge of the page with "Page 1/1" on the
  // right — matches the original invoice's footer treatment.
  const barH = 18;
  doc.rect(0, PAGE_HEIGHT - barH, PAGE_WIDTH, barH).fill(COLORS.navy);
  doc
    .fillColor(COLORS.white)
    .font('Helvetica')
    .fontSize(8)
    .text('Page 1/1', 0, PAGE_HEIGHT - barH + 6, {
      width: PAGE_WIDTH - 18,
      align: 'right',
      lineBreak: false,
    });
}
