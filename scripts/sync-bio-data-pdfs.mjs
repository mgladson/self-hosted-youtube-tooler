// Mirror the prod bio-data PDFs into git so admin-generated ones survive
// deploys (the files are baked into the api image at build time, so a runtime
// "Generate" would otherwise be lost on the next deploy). Fetches the roster
// (GET /current-employees/all) then downloads each employee's bio-data PDF
// (GET /:slug/bio-data.pdf) with the service token, writing
// api/assets/bio-data/<slug>.pdf. Profiles with no PDF on file (404) are
// skipped, and byte-identical files are left untouched so there's no no-op
// churn. Backup only — never writes back to prod.
//
// Env (shared with the other sync scripts):
//   EMPLOYEES_API_URL        e.g. https://findcarehelper.com/api
//   EMPLOYEES_SERVICE_TOKEN  matches the api's EMPLOYEES_SERVICE_TOKEN
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiUrl = (process.env.EMPLOYEES_API_URL ?? '').replace(/\/$/, '');
const token = process.env.EMPLOYEES_SERVICE_TOKEN ?? '';
if (!apiUrl || !token) {
  console.error('EMPLOYEES_API_URL and EMPLOYEES_SERVICE_TOKEN must be set in the environment.');
  process.exit(1);
}
const headers = { 'X-Service-Token': token };
const BIO_DIR = resolve('api/assets/bio-data');

const rosterRes = await fetch(`${apiUrl}/current-employees/all`, { headers });
if (!rosterRes.ok) {
  console.error(`GET /current-employees/all responded ${rosterRes.status}: ${await rosterRes.text()}`);
  process.exit(1);
}
const roster = await rosterRes.json();
const employees = Array.isArray(roster.employees) ? roster.employees : [];

let written = 0;
let skipped = 0;
for (const e of employees) {
  const slug = e?.slug;
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) continue;
  const res = await fetch(
    `${apiUrl}/current-employees/${encodeURIComponent(slug)}/bio-data.pdf`,
    { headers },
  );
  if (res.status === 404) {
    skipped++;
    continue;
  }
  if (!res.ok) {
    console.warn(`skip ${slug}: ${res.status}`);
    skipped++;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = resolve(BIO_DIR, `${slug}.pdf`);
  try {
    if (Buffer.compare(readFileSync(dest), buf) === 0) continue; // unchanged
  } catch {
    // no committed copy yet — fall through and write it
  }
  writeFileSync(dest, buf);
  written++;
  console.log(`synced ${slug}.pdf (${buf.length} bytes)`);
}
console.log(`bio-data PDFs: ${written} written, ${skipped} without a PDF on file.`);
