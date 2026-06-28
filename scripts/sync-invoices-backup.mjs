#!/usr/bin/env node
// Mirrors the prod invoice store (GET /api/invoices) into git as a durable,
// version-controlled backup at data/invoices.json. Invoices otherwise live
// only on the prod data volume, so this is what lets a fresh deploy be seeded
// with the latest invoice history. Backup only: nothing here seeds data back
// to prod, so it never reverts admin edits.
//
// Run by the "Sync Admin Data → Git" workflow alongside the employee/agency
// syncs; the workflow commits data/invoices.json if it changed.
//
// Required env:
//   EMPLOYEES_API_URL        e.g. https://findcarehelper.com/api
//   EMPLOYEES_SERVICE_TOKEN  matches the api's EMPLOYEES_SERVICE_TOKEN
//
// Exit codes:
//   0  data written (or already in sync)
//   1  could not fetch invoices or write the file

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const INVOICES_DATA = resolve(HERE, "../data/invoices.json");

async function fetchInvoicesFile() {
  const apiUrl = (process.env.EMPLOYEES_API_URL ?? "").replace(/\/$/, "");
  const token = process.env.EMPLOYEES_SERVICE_TOKEN ?? "";
  if (!apiUrl || !token) {
    throw new Error(
      "EMPLOYEES_API_URL and EMPLOYEES_SERVICE_TOKEN must be set in the environment.",
    );
  }
  const res = await fetch(`${apiUrl}/invoices`, {
    headers: { "X-Service-Token": token },
  });
  if (!res.ok) {
    throw new Error(`GET /invoices responded ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  // Return the store shape the API persists ({ invoices, nextNumber, updatedAt })
  // so the file we write to git matches the prod volume copy byte-for-byte and
  // an unchanged store yields no git diff.
  return {
    invoices: Array.isArray(data.invoices) ? data.invoices : [],
    nextNumber:
      typeof data.nextNumber === "number" && data.nextNumber > 0
        ? data.nextNumber
        : 1,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

// Write the full store with the same formatting the API uses (2-space indent +
// trailing newline) so the committed file is identical to the prod volume copy.
function writeInvoicesData(file) {
  const json = JSON.stringify(
    { invoices: file.invoices, nextNumber: file.nextNumber, updatedAt: file.updatedAt },
    null,
    2,
  );
  writeFileSync(INVOICES_DATA, json + "\n");
}

async function main() {
  let file;
  try {
    file = await fetchInvoicesFile();
  } catch (err) {
    console.error(`Failed to fetch invoices: ${err.message}`);
    process.exit(1);
  }

  try {
    writeInvoicesData(file);
  } catch (e) {
    console.error(`Failed to write ${INVOICES_DATA}: ${e.message}`);
    process.exit(1);
  }
  console.log(`Mirrored ${file.invoices.length} invoices into data/invoices.json.`);
}

main();
