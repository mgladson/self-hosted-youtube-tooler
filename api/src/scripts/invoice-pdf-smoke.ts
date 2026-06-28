// Smoke test for invoice-pdf.ts — renders a sample invoice matching the
// real INV-0003 to /tmp so it can be visually diffed against the original
// PDF. Run with:
//   cd api && npx tsx src/scripts/invoice-pdf-smoke.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderInvoicePdf, type InvoiceRecord } from '../lib/invoice-pdf.js';

const SAMPLE: InvoiceRecord = {
  id: 'INV-0003',
  issueDate: '2026-05-22',
  dueDate: '2026-05-31',
  billTo: {
    name: 'Helper Express',
    address: '400 Balestier Road, #02-06\nSingapore 329802',
    email: 'sales@helperexpress.com.sg',
  },
  lineItems: [
    {
      employeeSlug: 'employee-1',
      workerName: 'Naw Thay Muu',
      nationality: 'Myanmar',
      placementDate: '2026-05-18',
      amount: 1375.0,
    },
    {
      employeeSlug: 'employee-2',
      workerName: 'Eaindar Kyaw Lat',
      nationality: 'Myanmar',
      placementDate: '2026-05-14',
      amount: 600.0,
    },
  ],
  paymentReceived: 600.0,
};

async function main(): Promise<void> {
  const buf = await renderInvoicePdf(SAMPLE);
  const out = path.join('/tmp', `${SAMPLE.id}-smoke.pdf`);
  await fs.writeFile(out, buf);
  console.log(`Wrote ${out} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
