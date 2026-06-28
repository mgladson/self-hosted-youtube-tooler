#!/usr/bin/env node
// Creates an invoice (and optionally emails the PDF) by calling the prod admin
// API. Driven by the "Create Invoice" GitHub Action and safe to run locally if
// you set the env vars.
//
// Why HTTP and not a local file edit: the canonical invoices JSON lives on a
// host volume on prod that bypasses git, exactly like current-employees.
// Editing the git copy of data/invoices.json does NOT reach prod state. The API
// behind POST /api/invoices is the single write path, used by both the admin
// Invoices tab and this script; POST /api/invoices/:id/email then renders the
// PDF and mails it to the business mailbox.
//
// Required env:
//   EMPLOYEES_API_URL        — e.g. https://findcarehelper.com/api
//   EMPLOYEES_SERVICE_TOKEN  — matches the api's EMPLOYEES_SERVICE_TOKEN
//
// Invoice fields (env — the workflow maps its inputs onto these):
//   INVOICE_WORKER_NAME      (required)  worker / employee full name
//   INVOICE_AMOUNT           (required)  placement fee in SGD, numbers only
//   INVOICE_AGENCY           (optional)  agency-dropdown pick; a saved agency overrides INVOICE_BILL_TO_NAME and autofills its address/email
//   INVOICE_BILL_TO_NAME     (required*) bill-to name for a NEW agency (*required only when no saved agency is picked)
//   INVOICE_BILL_TO_ADDRESS  (optional)  billing address; " | " separates lines; blank reuses the matched agency's address
//   INVOICE_BILL_TO_EMAIL    (optional)  customer email printed on the PDF; blank reuses the matched agency's email
//   INVOICE_DATE             (optional)  YYYY-MM-DD; used for BOTH issue + placement; blank = today (UTC)
//   INVOICE_DUE_DATE         (optional)  YYYY-MM-DD; blank = 7 days after INVOICE_DATE
//   INVOICE_PAYMENT_RECEIVED (optional)  SGD already paid; blank = 0
//   INVOICE_NATIONALITY      (optional)  worker nationality; blank = Myanmar
//   INVOICE_NOTES            (optional)  footer note shown on the invoice
//   INVOICE_SEND_EMAIL       (optional)  "Yes" (default) to email the PDF, anything else to skip
//
// Exit codes:
//   0  invoice created (and emailed, if requested)
//   1  API / network error (if create succeeded, the new id is still printed)
//   2  bad input / missing env

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysUtc(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function envTrim(name) {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

// The agency dropdown's "type a new one" sentinel option (see
// create-invoice.yml). Matched loosely so the option's leading emoji can never
// cause a mismatch across the workflow → env boundary.
function isNewAgencySentinel(value) {
  return value === "" || value.toLowerCase().includes("type a new agency");
}

// Read the saved receiving agencies so a typed bill-to name can autofill its
// address/email. Best-effort: any failure just returns [] so the invoice is
// still created from whatever the operator typed.
async function fetchAgencies(apiUrl, token) {
  try {
    const res = await fetch(`${apiUrl}/agencies`, {
      headers: { "X-Service-Token": token },
    });
    if (!res.ok) {
      console.error(`Agency autofill skipped — GET /agencies responded ${res.status}.`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data.agencies) ? data.agencies : [];
  } catch (err) {
    console.error(`Agency autofill skipped — ${err.message}`);
    return [];
  }
}

// Persist a brand-new agency so the next invoice can autofill it. Best-effort:
// a failure is logged but never fails the run (the invoice already exists).
async function saveAgency(apiUrl, token, agency) {
  try {
    const res = await fetch(`${apiUrl}/agencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Service-Token": token },
      body: JSON.stringify(agency),
    });
    if (!res.ok) {
      console.error(`Could not save new agency — POST /agencies responded ${res.status}.`);
      return;
    }
    console.log(`Saved new agency "${agency.name}" for next time.`);
  } catch (err) {
    console.error(`Could not save new agency — ${err.message}`);
  }
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

  const workerName = envTrim("INVOICE_WORKER_NAME");
  const amountRaw = envTrim("INVOICE_AMOUNT");
  // Bill-to name comes from the agency dropdown when a saved agency is picked,
  // otherwise from the typed field (a brand-new agency).
  const agencyChoice = envTrim("INVOICE_AGENCY");
  const billToName = isNewAgencySentinel(agencyChoice)
    ? envTrim("INVOICE_BILL_TO_NAME")
    : agencyChoice;
  if (!workerName || !billToName || !amountRaw) {
    console.error(
      "Worker name, an agency (picked from the list or typed), and amount are required.",
    );
    process.exit(2);
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) {
    console.error(`INVOICE_AMOUNT must be a non-negative number (got "${amountRaw}").`);
    process.exit(2);
  }

  const paymentRaw = envTrim("INVOICE_PAYMENT_RECEIVED");
  const paymentReceived = paymentRaw ? Number(paymentRaw) : 0;
  if (!Number.isFinite(paymentReceived) || paymentReceived < 0) {
    console.error(
      `INVOICE_PAYMENT_RECEIVED must be a non-negative number (got "${paymentRaw}").`,
    );
    process.exit(2);
  }

  // One date for both the invoice issue date and the worker's placement date.
  const issueDate = envTrim("INVOICE_DATE") || todayUtc();
  if (!DATE_RE.test(issueDate)) {
    console.error(`INVOICE_DATE must be in YYYY-MM-DD format (got "${issueDate}").`);
    process.exit(2);
  }
  // Payment is due 7 days after the invoice date. INVOICE_DUE_DATE can still
  // override this (e.g. for local runs).
  const dueDate = envTrim("INVOICE_DUE_DATE") || addDaysUtc(issueDate, 7);
  if (!DATE_RE.test(dueDate)) {
    console.error(`INVOICE_DUE_DATE must be in YYYY-MM-DD format (got "${dueDate}").`);
    process.exit(2);
  }

  const address = envTrim("INVOICE_BILL_TO_ADDRESS");
  const email = envTrim("INVOICE_BILL_TO_EMAIL");
  const nationality = envTrim("INVOICE_NATIONALITY") || "Myanmar";
  const notes = envTrim("INVOICE_NOTES");
  const sendEmail = (envTrim("INVOICE_SEND_EMAIL") || "Yes").toLowerCase() === "yes";

  // Bill-to autofill: if the typed agency name matches a saved agency, reuse its
  // address/email for any field left blank (typed values win). Mirrors the admin
  // editor's "pick a saved agency"; a name with no match is a new agency and is
  // saved back after the invoice is created so it autofills next time.
  const agencies = await fetchAgencies(apiUrl, token);
  const agencyMatch = agencies.find(
    (a) =>
      typeof a?.name === "string" &&
      a.name.trim().toLowerCase() === billToName.toLowerCase(),
  );
  // GH text inputs are single-line; the workflow asks the operator to use " | "
  // between address lines and we expand those to real newlines. A saved agency's
  // address is already newline-separated, so it's used verbatim as the fallback.
  const billToAddress = address
    ? address.split(" | ").join("\n")
    : agencyMatch?.address ?? "";
  const billToEmail = email || (agencyMatch?.email ?? "");
  if (agencyMatch) {
    console.log(
      `Matched saved agency "${agencyMatch.name}" — autofilled blank bill-to fields.`,
    );
  }

  const body = {
    issueDate,
    dueDate,
    billTo: {
      name: billToName,
      address: billToAddress,
      ...(billToEmail ? { email: billToEmail } : {}),
    },
    lineItems: [
      {
        workerName,
        nationality,
        placementDate: issueDate,
        amount,
      },
    ],
    paymentReceived,
    ...(notes ? { notes } : {}),
  };

  // --- Create -------------------------------------------------------------
  const createRes = await fetch(`${apiUrl}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": token,
    },
    body: JSON.stringify(body),
  });

  if (createRes.status === 403) {
    console.error("Forbidden — check EMPLOYEES_SERVICE_TOKEN matches the api's.");
    process.exit(1);
  }
  if (!createRes.ok) {
    console.error(
      `Create failed — API responded ${createRes.status}: ${await createRes.text()}`,
    );
    process.exit(1);
  }

  const created = await createRes.json();
  const id = created.id;
  const total = body.lineItems.reduce((s, li) => s + li.amount, 0);
  console.log(
    `Created ${id} for ${billToName} — ${workerName}, SGD ${total.toFixed(2)} (due ${dueDate}).`,
  );

  // New agency (typed name didn't match a saved one) → persist it for next time.
  if (!agencyMatch && billToName && billToAddress) {
    await saveAgency(apiUrl, token, {
      name: billToName,
      address: billToAddress,
      ...(billToEmail ? { email: billToEmail } : {}),
    });
  }

  // --- Email (optional) ---------------------------------------------------
  if (!sendEmail) {
    console.log(`Skipped email (INVOICE_SEND_EMAIL is not "Yes"). Invoice ${id} saved.`);
    return;
  }

  const emailRes = await fetch(
    `${apiUrl}/invoices/${encodeURIComponent(id)}/email`,
    {
      method: "POST",
      headers: { "X-Service-Token": token },
    },
  );

  if (!emailRes.ok) {
    // The invoice WAS created — say so clearly (so it isn't re-created on a
    // retry) but still fail the run so the email problem is visible.
    console.error(
      `Invoice ${id} was created, but emailing failed — API responded ${emailRes.status}: ${await emailRes.text()}`,
    );
    process.exit(1);
  }

  const sent = await emailRes.json();
  console.log(`Emailed invoice ${id} to ${sent.sentTo} (${sent.filename}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
