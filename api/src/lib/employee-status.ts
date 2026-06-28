// Employee visibility model. The data file historically used a boolean
// `disabled` flag; this module normalizes that into a four-state `status`:
//   - 'active'   : seeking a job offer (default; shown under the "Available" tab)
//   - 'placed'   : successfully placed (shown under "Successfully Placed", still indexed)
//   - 'pending'  : auto-created from the Google Form intake; hidden like
//                  'disabled' but awaiting human review (not yet vetted)
//   - 'disabled' : fully hidden from the public site (404 + de-indexed)
// Legacy `disabled: true` records map to 'disabled'; a missing status maps to
// 'active'. We keep the two helpers pure (no Fastify/PG/config imports) so they
// can be unit-tested in isolation and reused by both the read and write paths.

export type EmployeeStatus = 'active' | 'placed' | 'disabled' | 'pending';

export type EmployeeRecord = Record<string, unknown>;

export function employeeStatus(e: EmployeeRecord): EmployeeStatus {
  const s = e.status;
  if (s === 'active' || s === 'placed' || s === 'disabled' || s === 'pending') return s;
  if (e.disabled === true) return 'disabled';
  return 'active';
}

// Whether a record should appear on the public site (listing, detail page,
// sitemap, JSON-LD). Allowlist by design: only active + placed are public, so a
// freshly-submitted intake ('pending', awaiting review) and a deliberately
// disabled helper are BOTH hidden — and any future status defaults to hidden.
export function isPubliclyVisible(e: EmployeeRecord): boolean {
  const s = employeeStatus(e);
  return s === 'active' || s === 'placed';
}

// Public age buckets exposed on the redacted (logged-out) list payload. The
// exact age lives in the login-gated `personal` block and is never published;
// only this coarse bracket is, so the storefront can offer an age filter
// without leaking the precise number. Keep the boundaries in sync with the
// storefront's AGE_IDS.
export type AgeBracket = '21-25' | '26-30' | '31-35' | '36-40' | 'above-40';

function ageToBracket(age: number): AgeBracket | undefined {
  if (!Number.isFinite(age)) return undefined;
  if (age >= 21 && age <= 25) return '21-25';
  if (age >= 26 && age <= 30) return '26-30';
  if (age >= 31 && age <= 35) return '31-35';
  if (age >= 36 && age <= 40) return '36-40';
  if (age > 40) return 'above-40';
  return undefined; // under 21 or unparseable → no bracket
}

// Look up a (login-gated) `personal` row by an English-label keyword and return
// its trimmed EN value, or undefined. The label match is case-insensitive and
// substring, e.g. "age" matches "🎂 Age", "marital" matches "💍 Marital".
function personalValue(personal: unknown, labelKeyword: string): string | undefined {
  if (!Array.isArray(personal)) return undefined;
  for (const field of personal) {
    const label = (field as { label?: { en?: unknown } })?.label?.en;
    if (typeof label !== 'string' || !label.toLowerCase().includes(labelKeyword)) continue;
    const value = (field as { value?: { en?: unknown } })?.value?.en;
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number') return String(value);
    return undefined;
  }
  return undefined;
}

function extractAgeBracket(personal: unknown): AgeBracket | undefined {
  const raw = personalValue(personal, 'age');
  return raw === undefined ? undefined : ageToBracket(parseInt(raw.replace(/[^0-9]/g, ''), 10));
}

// Strip the login-gated fields (profile photo, gallery photos, and the personal
// bio-data section) and replace them with non-sensitive hints the storefront
// uses to render blurred placeholders. Preferences & availability is public and
// intentionally NOT stripped. This is the single chokepoint that guarantees
// locked data never reaches the public endpoint, the ISR cache, JSON-LD, or
// crawlers — the real values are served only by the session-guarded
// /api/customer/employee/:slug/private route.
export function redactEmployee<T extends EmployeeRecord>(e: T): T {
  const image = e.image;
  const photos = e.photos;
  const personal = e.personal;

  const redacted: EmployeeRecord = { ...e };
  delete redacted.image;
  delete redacted.photos;
  delete redacted.bioDataImage;
  delete redacted.personal;
  delete redacted.disabled;
  // Intake-only fields (applicant contact + screening, and the review flag) must
  // never reach the public payload, ISR cache, JSON-LD, or crawlers.
  delete redacted.intake;
  delete redacted.pendingReview;

  redacted.status = employeeStatus(e);
  redacted.hasImage = typeof image === 'string' && image.length > 0;
  redacted.photoCount = Array.isArray(photos) ? photos.length : 0;
  // Only the personal block is gated now (availability rides along publicly).
  redacted.hasLockedDetails = Array.isArray(personal) && personal.length > 0;

  // Coarse, non-identifying age bucket (exact age stays stripped with `personal`).
  const ageBracket = extractAgeBracket(personal);
  if (ageBracket) redacted.ageBracket = ageBracket;

  // Marital status and religion (EN value) are surfaced for the public list
  // filters; the rest of `personal` stays stripped.
  const maritalStatus = personalValue(personal, 'marital');
  if (maritalStatus) redacted.maritalStatus = maritalStatus;
  const religion = personalValue(personal, 'religion');
  if (religion) redacted.religion = religion;

  return redacted as T;
}
