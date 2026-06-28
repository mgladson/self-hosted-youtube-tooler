#!/usr/bin/env node
// One-shot migration: extracts the currentEmployees array literal from
// storefront/src/lib/site-data.ts and writes it as JSON to
// data/current-employees.json. Safe to re-run; overwrites the JSON.
//
// Usage: node scripts/migrate-employees-to-json.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_DATA = resolve(HERE, "../storefront/src/lib/site-data.ts");
const TARGET = resolve(HERE, "../data/current-employees.json");

const src = readFileSync(SITE_DATA, "utf8");

const header = "export const currentEmployees: CurrentEmployee[] = ";
const headerIdx = src.indexOf(header);
if (headerIdx < 0) {
  console.error("currentEmployees array not found");
  process.exit(1);
}
const arrayStart = headerIdx + header.length;
const arrayEnd = src.indexOf("\n];", arrayStart);
if (arrayEnd < 0) {
  console.error("currentEmployees array end not found");
  process.exit(1);
}
const literal = src.substring(arrayStart, arrayEnd + 2); // include `];`-2 to keep `]`

// eslint-disable-next-line no-new-func
const employees = new Function(`return ${literal};`)();
if (!Array.isArray(employees)) {
  console.error("Extracted value is not an array");
  process.exit(1);
}

const out = {
  employees,
  updatedAt: "",
};

writeFileSync(TARGET, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${employees.length} employees to ${TARGET}`);
