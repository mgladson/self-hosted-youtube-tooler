#!/usr/bin/env node
// Adds a new receiving agency to the prod admin API (POST /api/agencies) — the
// same single write path the admin Agencies tab and the Create Invoice workflow
// use. Driven by the "Add Agency" GitHub Action; safe to run locally if you set
// the env vars.
//
// Why HTTP and not a local file edit: the canonical agencies JSON lives on a
// host volume on prod that bypasses git (same as invoices/current-employees).
// Editing the git copy of data/agencies.json does NOT reach prod state — the API
// is the single write path. The workflow mirrors the updated store back into git
// afterwards (scripts/sync-agency-workflow-options.mjs) so the committed
// data/agencies.json stays a faithful, version-controlled backup.
//
// Required env:
//   EMPLOYEES_API_URL        — e.g. https://findcarehelper.com/api
//   EMPLOYEES_SERVICE_TOKEN  — matches the api's EMPLOYEES_SERVICE_TOKEN
//
// Agency fields (env — the workflow maps its inputs onto these):
//   AGENCY_NAME     (required)  agency display name; must not already exist
//   AGENCY_ADDRESS  (optional)  billing address; " | " separates lines
//   AGENCY_EMAIL    (optional)  billing email
//
// Refusing a duplicate name is deliberate: the store technically allows
// same-named records, but accidentally forking one agency into two is exactly
// the mess this avoids. To change an existing agency, edit it in the admin
// Agencies tab instead.
//
// Exit codes:
//   0  agency created
//   1  API / network error
//   2  bad input / missing env / duplicate name

function envTrim(name) {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

async function fetchAgencies(apiUrl, token) {
  const res = await fetch(`${apiUrl}/agencies`, {
    headers: { "X-Service-Token": token },
  });
  if (!res.ok) {
    throw new Error(`GET /agencies responded ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return Array.isArray(data.agencies) ? data.agencies : [];
}

async function main() {
  const apiUrl = (process.env.EMPLOYEES_API_URL ?? "").replace(/\/$/, "");
  const token = process.env.EMPLOYEES_SERVICE_TOKEN ?? "";
  if (!apiUrl || !token) {
    console.error(
      "EMPLOYEES_API_URL and EMPLOYEES_SERVICE_TOKEN must be set in the environment.",
    );
    process.exit(2);
  }

  const name = envTrim("AGENCY_NAME");
  if (!name) {
    console.error("AGENCY_NAME is required.");
    process.exit(2);
  }
  // GH text inputs are single-line; the workflow asks for " | " between address
  // lines and we expand those to real newlines, matching the Create Invoice
  // script and the multi-line address the admin editor stores.
  const address = envTrim("AGENCY_ADDRESS").split(" | ").join("\n");
  const email = envTrim("AGENCY_EMAIL");

  // Refuse a duplicate name up front so an "add" can never silently fork an
  // existing agency into two records (the admin Agencies tab is for edits).
  let existing;
  try {
    existing = await fetchAgencies(apiUrl, token);
  } catch (err) {
    console.error(`Could not read existing agencies — ${err.message}`);
    process.exit(1);
  }
  const clash = existing.find(
    (a) =>
      typeof a?.name === "string" &&
      a.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (clash) {
    console.error(
      `An agency named "${clash.name}" already exists. Edit it in the admin Agencies tab instead of adding a duplicate.`,
    );
    process.exit(2);
  }

  const body = {
    name,
    address,
    ...(email ? { email } : {}),
  };

  const res = await fetch(`${apiUrl}/agencies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": token,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 403) {
    console.error("Forbidden — check EMPLOYEES_SERVICE_TOKEN matches the api's.");
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Create failed — API responded ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const created = await res.json();
  console.log(`Created agency "${created.name}" (${created.id}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
