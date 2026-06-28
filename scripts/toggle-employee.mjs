#!/usr/bin/env node
// Sets the three-state `status` (active | placed | disabled) on a current
// employee by calling the prod admin API. Driven by the "Set Employee Status"
// GitHub Action and safe to run locally if you set the env vars.
//
// Why HTTP and not a local file edit: the canonical employees JSON lives
// on a host volume on prod that bypasses git. Editing the git copy of
// data/current-employees.json does NOT reach prod state. The API behind
// /api/current-employees/:slug/status is the single write path, used by
// both the admin tab and this script.
//
// Required env:
//   EMPLOYEES_API_URL       — e.g. https://findcarehelper.com/api
//   EMPLOYEES_SERVICE_TOKEN — matches the api's EMPLOYEES_SERVICE_TOKEN
//
// Usage:
//   node scripts/toggle-employee.mjs --name "Full Name" --status active|placed|disabled
//
// Exit codes:
//   0  changed (or already in desired state)
//   1  employee not found / network error / unauthorized
//   2  bad arguments / missing env

const STATUSES = ["active", "placed", "disabled"];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") out.name = argv[++i];
    else if (a === "--status") out.status = argv[++i];
  }
  return out;
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findSlugByName(apiUrl, token, name) {
  // The admin /all endpoint accepts the service token, so we get the FULL
  // roster — including already-disabled profiles, which a reclassification
  // to active/placed needs to find.
  const res = await fetch(`${apiUrl}/current-employees/all`, {
    headers: { "X-Service-Token": token },
  });
  if (res.status === 403) {
    // Fallback to the public list (active + placed only) if /all rejects the
    // token for any reason. Disabled profiles won't be found this way.
    const pub = await fetch(`${apiUrl}/current-employees`);
    if (!pub.ok) throw new Error(`public list fetch failed: ${pub.status}`);
    const data = await pub.json();
    const match = (data.employees ?? []).find((e) => e.name === name);
    return match ? match.slug : null;
  }
  if (!res.ok) throw new Error(`/all fetch failed: ${res.status}`);
  const data = await res.json();
  const match = (data.employees ?? []).find((e) => e.name === name);
  return match ? match.slug : null;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.name || !STATUSES.includes(args.status)) {
    console.error(
      'Usage: toggle-employee.mjs --name "Full Name" --status active|placed|disabled',
    );
    process.exit(2);
  }

  const apiUrl = (process.env.EMPLOYEES_API_URL ?? "").replace(/\/$/, "");
  const token = process.env.EMPLOYEES_SERVICE_TOKEN ?? "";
  if (!apiUrl || !token) {
    console.error(
      "EMPLOYEES_API_URL and EMPLOYEES_SERVICE_TOKEN must be set in the environment.",
    );
    process.exit(2);
  }

  // Names aren't unique IDs but in practice no two candidates share a full
  // name. If the lookup fails, fall back to slug derivation — the API 404s
  // cleanly if the guess is wrong.
  let slug = await findSlugByName(apiUrl, token, args.name);
  if (!slug) {
    slug = slugify(args.name);
    console.log(`Name lookup empty, trying derived slug: ${slug}`);
  }

  const res = await fetch(
    `${apiUrl}/current-employees/${encodeURIComponent(slug)}/status`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": token,
      },
      body: JSON.stringify({ status: args.status }),
    },
  );

  if (res.status === 404) {
    console.error(`Employee not found at slug "${slug}".`);
    process.exit(1);
  }
  if (res.status === 403) {
    console.error("Forbidden — check EMPLOYEES_SERVICE_TOKEN matches the api's.");
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`API responded ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const result = await res.json();
  if (result.changed === false) {
    console.log(`No change — ${args.name} (slug=${slug}) was already ${args.status}.`);
  } else {
    console.log(`Set ${args.name} (slug=${slug}) to ${args.status} on prod.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
