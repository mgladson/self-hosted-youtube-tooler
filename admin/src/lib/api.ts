const API_BASE = import.meta.env.VITE_API_URL || '/api';

export type CommitToGitResult = { status: 'started' };

// Triggers the "Sync Admin Data → Git" GitHub workflow, which mirrors the
// current prod admin state (employees, agencies, invoices) into a commit on
// main so a fresh deploy can be seeded from git. Resolves once GitHub accepts
// the dispatch; the commit itself lands shortly after when the runner finishes.
export async function commitToGit(): Promise<CommitToGitResult> {
  const res = await fetch(`${API_BASE}/admin/commit-to-git`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Sync failed: ${res.status}`);
  }
  return res.json();
}

export type BehaviorData = {
  summary: {
    totalPageViews: number;
    uniqueSessions: number;
    avgTimeOnPageMs: number;
    avgScrollDepth: number;
  };
  pageViews: { bucket: string; views: number; uniqueSessions: number }[];
  topPages: { path: string; pageType: string; views: number; uniqueSessions: number; avgTimeMs: number; avgScrollDepth: number }[];
  scrollDepth: { pageType: string; depth: number; count: number }[];
  topClicks: { text: string; tag: string; href: string; page: string; count: number }[];
  elementVisibility: { label: string; page: string; impressions: number; avgVisibleMs: number }[];
};

export async function fetchBehaviorAnalytics(start: string, end: string): Promise<BehaviorData> {
  const res = await fetch(
    `${API_BASE}/analytics/behavior?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`Behavior fetch failed: ${res.status}`);
  return res.json();
}

export type GeoCountryRow = {
  code: string;
  name: string;
  flag: string;
  lat: number;
  lng: number;
  visitors: number;
  views: number;
  registered: number;
  paid: number;
  paying: number;
  regions: { name: string; visitors: number; registered: number; paid: number; paying: number }[];
};

export type GeoData = { countries: GeoCountryRow[] };

export async function fetchGeoAnalytics(start: string, end: string, path?: string): Promise<GeoData> {
  const qs = new URLSearchParams({ start, end });
  if (path) qs.set('path', path);
  const res = await fetch(`${API_BASE}/analytics/geo?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Geo fetch failed: ${res.status}`);
  return res.json();
}

export type DeviceBucket = { label: string; visitors: number; views: number };
export type DevicePageRow = { path: string; deviceType: string; visitors: number; views: number };
export type DeviceData = {
  byDevice: DeviceBucket[];
  byBrowser: DeviceBucket[];
  byOs: DeviceBucket[];
  byPage: DevicePageRow[];
};

export async function fetchDeviceAnalytics(start: string, end: string, path?: string): Promise<DeviceData> {
  const qs = new URLSearchParams({ start, end });
  if (path) qs.set('path', path);
  const res = await fetch(`${API_BASE}/analytics/devices?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Device fetch failed: ${res.status}`);
  return res.json();
}

export type BannerData = {
  active: boolean;
  text: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  updatedAt: string;
};

export async function fetchBanner(): Promise<BannerData> {
  const res = await fetch(`${API_BASE}/banner`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Banner fetch failed: ${res.status}`);
  return res.json();
}

export async function updateBanner(data: Omit<BannerData, 'updatedAt'>): Promise<BannerData> {
  const res = await fetch(`${API_BASE}/banner`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Banner update failed: ${res.status}`);
  return res.json();
}

export type PagesData = {
  pages: Record<string, { underConstruction: boolean }>;
  updatedAt: string;
};

export async function fetchPages(): Promise<PagesData> {
  const res = await fetch(`${API_BASE}/pages`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Pages fetch failed: ${res.status}`);
  return res.json();
}

export async function updatePage(
  slug: string,
  underConstruction: boolean,
): Promise<{ slug: string; underConstruction: boolean; updatedAt: string }> {
  const res = await fetch(`${API_BASE}/pages/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ underConstruction }),
  });
  if (!res.ok) throw new Error(`Page update failed: ${res.status}`);
  return res.json();
}

// `zh` is optional so the long tail of bilingual fields (employee, testimonial)
// keep working without backfill. Only recipe content is expected to populate
// Chinese in the editor; everything else just leaves zh undefined.
export type LocalizedString = { en: string; my: string; zh?: string };

export type EmployeeField = {
  label: LocalizedString;
  value: LocalizedString;
  fullWidth?: boolean;
  divider?: boolean;
};

export type EmployeePhoto = { src: string; caption?: LocalizedString };

export type PastExperience = {
  role: LocalizedString;
  date: LocalizedString;
  numYears: LocalizedString;
  country: LocalizedString;
  // Employer family's ethnicity, shown in the public "Family" column (defaults
  // to Chinese for Singapore postings). Optional for back-compat with older rows.
  family?: LocalizedString;
  duties: LocalizedString;
};

export type AreaOfWork = {
  area: LocalizedString;
  areaNote?: LocalizedString;
  willingness?: LocalizedString;
  experience?: LocalizedString;
  experienceDetail?: LocalizedString;
  assessment: LocalizedString;
  proficiency?: 1 | 2 | 3 | 4 | 5 | 'na';
};

export type Language = {
  name: LocalizedString;
  listening?: LocalizedString;
  speaking?: LocalizedString;
  reading?: LocalizedString;
  writing?: LocalizedString;
};

// Non-public applicant contact + screening answers captured when a profile is
// auto-created from the Google Form intake. Shown read-only in the editor and
// stripped from the public payload by the api's redactEmployee — never rendered
// on the storefront.
export type EmployeeIntake = {
  nickName?: string;
  gender?: string;
  pregnant?: string;
  tattoos?: string;
  whatsapp?: string;
  visaExpiry?: string;
  // Passport expiry date (ISO yyyy-mm-dd) from the survey; admin can correct it.
  passportExpiry?: string;
  certifications?: string;
  experienceLevel?: string;
  residingCountry?: string;
  // Staying with us in Bangkok? Seeded from the survey, admin can adjust during
  // review. 'yes' | 'no' | '' (unset).
  stayingInBangkok?: string;
  email?: string;
  responseId?: string;
  submittedAt?: string;
  photoNote?: string;
  // Private-bucket object keys for the sensitive ID-document scans. Served only
  // through the admin-gated id-doc route (see idDocUrl); stripped from public.
  passportImage?: string;
  visaStampImage?: string;
  entryStampImage?: string;
};

export type CurrentEmployee = {
  slug: string;
  name: string;
  role: LocalizedString;
  image?: string;
  photos?: EmployeePhoto[];
  // A `photos[].src` chosen to fill the bio-data PDF's photo box; falls back to
  // `image` (the profile thumbnail) when unset.
  bioDataImage?: string;
  personal?: EmployeeField[];
  pastExperiences?: PastExperience[];
  caretakerSkills?: AreaOfWork[];
  householdSkills?: AreaOfWork[];
  languages?: Language[];
  availability?: EmployeeField[];
  // Which interview modes the FDW is reachable for — drives section (D) of the
  // bio-data PDF. Absent on legacy records (the PDF then assumes phone + video).
  interviewAvailability?: InterviewMode[];
  // Applicant contact + screening answers captured at intake (non-public). Set on
  // records auto-created from the Google Form intake (which land as status
  // 'pending'); shown read-only in the editor, stripped from the public payload.
  intake?: EmployeeIntake;
  accent: 'ochre' | 'crimson' | 'jade';
  lastUpdated?: string;
  disabled?: boolean;
  status?: EmployeeStatus;
};

export type EmployeeStatus = 'active' | 'placed' | 'disabled' | 'pending';

export type InterviewMode = 'not-available' | 'phone' | 'video' | 'in-person';

// Normalize the three-state status, tolerating legacy records that carry only
// the boolean `disabled`. Mirror of the api-side helper in employee-status.ts.
export function employeeStatus(
  e: Pick<CurrentEmployee, 'status' | 'disabled'>,
): EmployeeStatus {
  if (
    e.status === 'active' ||
    e.status === 'placed' ||
    e.status === 'disabled' ||
    e.status === 'pending'
  )
    return e.status;
  if (e.disabled === true) return 'disabled';
  return 'active';
}

export type CurrentEmployeesData = {
  employees: CurrentEmployee[];
  updatedAt: string;
};

export async function fetchAllEmployees(): Promise<CurrentEmployeesData> {
  const res = await fetch(`${API_BASE}/current-employees/all`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Employees fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchEmployee(slug: string): Promise<CurrentEmployee> {
  const res = await fetch(`${API_BASE}/current-employees/${encodeURIComponent(slug)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Employee fetch failed: ${res.status}`);
  return res.json();
}

export async function toggleEmployeeDisabled(
  slug: string,
  disabled: boolean,
): Promise<{ slug: string; disabled: boolean; changed: boolean; updatedAt: string }> {
  const res = await fetch(`${API_BASE}/current-employees/${encodeURIComponent(slug)}/disabled`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ disabled }),
  });
  if (!res.ok) throw new Error(`Employee toggle failed: ${res.status}`);
  return res.json();
}

export async function setEmployeeStatus(
  slug: string,
  status: EmployeeStatus,
): Promise<{ slug: string; status: EmployeeStatus; changed: boolean; updatedAt: string }> {
  const res = await fetch(`${API_BASE}/current-employees/${encodeURIComponent(slug)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Employee status update failed: ${res.status}`);
  return res.json();
}

export type CustomerLead = {
  email: string;
  name: string;
  picture: string | null;
  first_seen: string;
  last_seen: string;
  login_count: number;
};

export async function fetchCustomerLeads(): Promise<{ leads: CustomerLead[] }> {
  const res = await fetch(`${API_BASE}/customer-leads`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Customer leads fetch failed: ${res.status}`);
  return res.json();
}

export type EmployeeInput = Omit<
  CurrentEmployee,
  'slug' | 'lastUpdated' | 'disabled' | 'accent'
> & {
  // Optional on create — api auto-assigns the next accent in the
  // ochre→crimson→jade cycle when omitted.
  accent?: 'ochre' | 'crimson' | 'jade';
};

export async function createEmployee(data: EmployeeInput): Promise<CurrentEmployee> {
  const res = await fetch(`${API_BASE}/current-employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Employee create failed: ${res.status}`);
  }
  return res.json();
}

export async function updateEmployee(slug: string, data: EmployeeInput): Promise<CurrentEmployee> {
  const res = await fetch(`${API_BASE}/current-employees/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Employee update failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteEmployee(slug: string): Promise<void> {
  const res = await fetch(`${API_BASE}/current-employees/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Employee delete failed: ${res.status}`);
  }
}

// Generate the bio-data PDF (the employee's admin data overlaid on the official
// MOM form) and return it as a Blob for preview. Preview only — the server does
// not persist the file yet. Throws with the server's message on failure.
export async function generateBioDataPdf(slug: string): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/current-employees/${encodeURIComponent(slug)}/bio-data.pdf`,
    { method: 'POST', credentials: 'include' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Bio-data generation failed: ${res.status}`);
  }
  return res.blob();
}

// URL for viewing the saved bio-data PDF inline in a new tab (same-origin, so
// the browser sends the admin session cookie).
export function bioDataViewUrl(slug: string): string {
  return `${API_BASE}/current-employees/${encodeURIComponent(slug)}/bio-data.pdf?inline=1`;
}

// Email the saved bio-data PDF (the one bioDataViewUrl serves) to the brand
// mailbox as an attachment. Mirrors emailInvoicePdf. Throws the server message
// on failure (e.g. no PDF generated yet).
export async function emailBioDataPdf(
  slug: string,
): Promise<{ slug: string; sentTo: string; filename: string }> {
  const res = await fetch(
    `${API_BASE}/current-employees/${encodeURIComponent(slug)}/bio-data.pdf/email`,
    { method: 'POST', credentials: 'include' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Email send failed: ${res.status}`);
  }
  return res.json();
}

// Uploads an image to MinIO via the api. Returns the canonical `/images/…`
// path that should be persisted into the employee's `image` or `photos[].src`
// field. The file MUST be one of jpeg/png/webp/gif and ≤10MB — the api will
// reject anything else.
export async function uploadEmployeeImage(file: File): Promise<{ src: string }> {
  const res = await fetch(`${API_BASE}/current-employees/upload-image`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    credentials: 'include',
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Image upload failed: ${res.status}`);
  }
  return res.json();
}

export type IdDocKind = 'passport' | 'visa-stamp' | 'entry-stamp';

// Admin-gated URL for viewing a captured ID-document scan inline. Same-origin, so
// the browser sends the admin session cookie and the API streams it from the
// private bucket. `version` is an optional cache-buster to force <img> to refetch
// after a replace.
export function idDocUrl(slug: string, kind: IdDocKind, version?: number | string): string {
  const q = version ? `?v=${encodeURIComponent(String(version))}` : '';
  return `${API_BASE}/current-employees/${encodeURIComponent(slug)}/id-doc/${kind}${q}`;
}

// Upload/replace a sensitive ID-document scan (passport / visa stamp / entry
// stamp). The file MUST be jpeg/png/webp/gif and ≤10MB. Returns the private
// object key to store on the employee's `intake` block (persisted by
// updateEmployee).
export async function uploadEmployeeIdDoc(
  slug: string,
  kind: IdDocKind,
  file: File,
): Promise<{ key: string }> {
  const res = await fetch(
    `${API_BASE}/current-employees/${encodeURIComponent(slug)}/id-doc/${kind}`,
    {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      credentials: 'include',
      body: file,
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `ID document upload failed: ${res.status}`);
  }
  return res.json();
}

// Removes a previously uploaded employee image from MinIO. `src` is the value
// the api returned at upload (under IMAGE_PUBLIC_BASE — e.g. /cdn/ or /images/);
// the api accepts either prefix. Safe to call on already-missing keys — MinIO's
// remove is idempotent.
export async function deleteEmployeeImage(src: string): Promise<{ src: string; deleted: boolean }> {
  const res = await fetch(`${API_BASE}/current-employees/upload-image`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ src }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Image delete failed: ${res.status}`);
  }
  return res.json();
}

// ============================================================
// Invoices + Agencies
// ============================================================
export type InvoiceBillTo = {
  name: string;
  address: string;
  email?: string;
};

export type InvoiceLineItem = {
  employeeSlug: string;
  workerName: string;
  nationality?: string;
  placementDate: string; // YYYY-MM-DD
  amount: number;
};

export type Invoice = {
  id: string; // INV-NNNN
  issueDate: string;
  dueDate: string;
  billTo: InvoiceBillTo;
  lineItems: InvoiceLineItem[];
  paymentReceived: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type InvoicesListResponse = {
  invoices: Invoice[];
  nextNumber: number;
  updatedAt: string;
};

export type InvoiceInput = Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>;

export async function fetchInvoices(): Promise<InvoicesListResponse> {
  const res = await fetch(`${API_BASE}/invoices`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Invoices fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Invoice fetch failed: ${res.status}`);
  return res.json();
}

export async function createInvoice(data: InvoiceInput): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Invoice create failed: ${res.status}`);
  }
  return res.json();
}

export async function updateInvoice(id: string, data: InvoiceInput): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Invoice update failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteInvoice(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await fetch(`${API_BASE}/invoices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Invoice delete failed: ${res.status}`);
  return res.json();
}

// URL the browser can open directly to download the PDF — auth cookie
// rides along because the api lives under the same origin. Used by the
// "Download PDF" button via window.open() / <a download>.
export function invoicePdfUrl(id: string): string {
  return `${API_BASE}/invoices/${encodeURIComponent(id)}/pdf`;
}

// Fetch a helper's finalized MOM bio-data PDF (admin route — serves any status,
// active/placed/disabled). Returns the PDF blob; throws a friendly error when
// none is on file yet so the caller can toast it. The session cookie authorizes
// the request, like the other credentialed admin api calls.
export async function fetchBioDataPdf(slug: string): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/current-employees/${encodeURIComponent(slug)}/bio-data.pdf`,
    { credentials: 'include' },
  );
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('No bio-data PDF on file for this helper yet');
    }
    throw new Error(`Bio-data download failed: ${res.status}`);
  }
  return res.blob();
}

export async function emailInvoicePdf(
  id: string,
): Promise<{ id: string; sentTo: string; filename: string }> {
  const res = await fetch(`${API_BASE}/invoices/${encodeURIComponent(id)}/email`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Email send failed: ${res.status}`);
  }
  return res.json();
}

export type Agency = {
  id: string;
  name: string;
  address: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgenciesListResponse = {
  agencies: Agency[];
  updatedAt: string;
};

export type AgencyInput = Pick<Agency, 'name' | 'address' | 'email'>;

export async function fetchAgencies(): Promise<AgenciesListResponse> {
  const res = await fetch(`${API_BASE}/agencies`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Agencies fetch failed: ${res.status}`);
  return res.json();
}

export async function createAgency(data: AgencyInput): Promise<Agency> {
  const res = await fetch(`${API_BASE}/agencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Agency create failed: ${res.status}`);
  }
  return res.json();
}

export async function updateAgency(id: string, data: AgencyInput): Promise<Agency> {
  const res = await fetch(`${API_BASE}/agencies/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Agency update failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteAgency(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await fetch(`${API_BASE}/agencies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Agency delete failed: ${res.status}`);
  return res.json();
}

export async function sendCampaignEmail(
  recipients: { email: string }[],
  subject: string,
  body: string,
): Promise<{ sent: number; failed: number; errors?: string[] }> {
  const res = await fetch(`${API_BASE}/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ recipients, subject, body }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
  return res.json();
}

export type SupportTicket = {
  id: number;
  customerEmail: string;
  customerName: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

export type TicketMessage = {
  id: number;
  senderRole: string;
  senderName: string;
  senderEmail: string;
  body: string;
  createdAt: string;
};

export type TicketDetail = {
  ticket: SupportTicket;
  messages: TicketMessage[];
};

export async function fetchSupportTickets(status?: string): Promise<{ tickets: SupportTicket[] }> {
  const params = status ? `?status=${status}` : '';
  const res = await fetch(`${API_BASE}/support/tickets${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Support tickets fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchCustomerTickets(email: string): Promise<{ tickets: SupportTicket[] }> {
  const res = await fetch(`${API_BASE}/support/tickets?customer_email=${encodeURIComponent(email)}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Customer tickets fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSupportTicket(id: number): Promise<TicketDetail> {
  const res = await fetch(`${API_BASE}/support/tickets/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Support ticket fetch failed: ${res.status}`);
  return res.json();
}

export async function replySupportTicket(id: number, body: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/support/tickets/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`Reply failed: ${res.status}`);
  return res.json();
}

export type NewsletterSubscriber = {
  email: string;
  subscribedAt: string;
};

export type NewsletterData = {
  subscribers: NewsletterSubscriber[];
  enabled: boolean;
  total: number;
};

export async function fetchNewsletterSubscribers(): Promise<NewsletterData> {
  const res = await fetch(`${API_BASE}/newsletter/subscribers`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Newsletter fetch failed: ${res.status}`);
  return res.json();
}

export async function updateNewsletterSettings(enabled: boolean): Promise<{ enabled: boolean }> {
  const res = await fetch(`${API_BASE}/newsletter/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(`Newsletter settings update failed: ${res.status}`);
  return res.json();
}

export async function deleteNewsletterSubscriber(email: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/newsletter/subscribers/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Delete subscriber failed: ${res.status}`);
  return res.json();
}

export type GitCommit = {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  date: string;
  url: string;
};

export async function fetchGithubCommits(): Promise<GitCommit[]> {
  const repo = import.meta.env.VITE_GITHUB_REPO as string | undefined;
  if (!repo) return [];
  const res = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=20`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) return [];
  const data = await res.json() as Array<{
    sha: string;
    html_url: string;
    commit: { message: string; author: { name: string; email: string; date: string } };
  }>;
  return data.map((c) => ({
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    authorName: c.commit.author.name,
    authorEmail: c.commit.author.email,
    date: c.commit.author.date,
    url: c.html_url,
  }));
}

export type AuditLogEntry = {
  id: number;
  userEmail: string;
  userName: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  ipAddress: string | null;
  createdAt: string;
};

export type AuditLogsResponse = {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
};

export async function fetchAuditLogs(page = 1, resourceType?: string): Promise<AuditLogsResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (resourceType) params.set('resource_type', resourceType);
  const res = await fetch(`${API_BASE}/audit/logs?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Audit logs fetch failed: ${res.status}`);
  return res.json();
}

export async function updateTicketStatus(
  id: number,
  updates: { status?: string; priority?: string },
): Promise<{ id: number; status: string; priority: string }> {
  const res = await fetch(`${API_BASE}/support/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}

export type BannedIpEntry = {
  ip: string;
  reason: string;
  bannedAt: string;
};

export type SecurityEvent = {
  id: number;
  created_at: string;
  ip: string;
  country: string | null;
  event_type: string;
  endpoint: string | null;
  user_agent: string | null;
  bot_score: number | null;
  action: string | null;
  metadata: Record<string, unknown> | null;
};

export type ThreatActor = {
  ip: string;
  country: string | null;
  total_req: string;
  blocked_req: string;
  avg_bot_score: string;
  first_seen: string;
  last_seen: string;
};

export type RateLimitEntry = {
  endpoint: string;
  hits: string;
};

export type BlockedBreakdownEntry = { event_type?: string; country?: string; ua_class?: string; count: string };

export type RecentBanEntry = {
  user_email: string;
  action: string;
  ip_address: string;
  summary: string;
  created_at: string;
};

export type EventTimelineEntry = {
  bucket: string;
  total: string;
  blocked: string;
  flagged: string;
};

export type SecurityDashboard = {
  degraded: boolean;
  attackStatus: 'NORMAL' | 'ELEVATED' | 'ATTACK';
  attackDurationMinutes: number | null;
  stats: {
    counter429: number;
    totalReq: number;
    uniqueIps: number;
    rate429Pct: number;
  };
  bannedIps: BannedIpEntry[];
  recentEvents: SecurityEvent[];
  topThreatActors: ThreatActor[];
  rateLimitByEndpoint: RateLimitEntry[];
  blockedBreakdown: {
    byReason: BlockedBreakdownEntry[];
    byCountry: BlockedBreakdownEntry[];
    byUaClass: BlockedBreakdownEntry[];
  };
  authStats: {
    recentBans: RecentBanEntry[];
    failedLoginsCount: number;
  };
  eventTimeline: EventTimelineEntry[];
  infraStats: {
    valkeyMemoryMb: number;
    pgActiveConnections: number;
  };
  checkoutStats: {
    attemptsLast24h: number;
    successLast24h: number;
  };
};

export async function fetchSecurityDashboard(): Promise<SecurityDashboard> {
  const res = await fetch(`${API_BASE}/security/dashboard`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Security dashboard fetch failed: ${res.status}`);
  return res.json();
}

export type SecurityReport = {
  period: { start: string; end: string };
  generatedAt: string;
  gdprNote: string;
  summary: { totalEvents: number; blocked: number; flagged: number; uniqueIps: number };
  topThreatActors: {
    ip: string; country: string | null;
    totalReq: number; blockedReq: number;
    firstSeen: string; lastSeen: string; status: string;
  }[];
  actionableTasks: { severity: string; task: string; evidence: string; action: string }[];
};

export async function fetchSecurityReport(
  start?: string,
  end?: string,
): Promise<SecurityReport> {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/security/report${qs ? `?${qs}` : ''}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Security report fetch failed: ${res.status}`);
  return res.json();
}

export async function blockIp(ip: string, reason?: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/security/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ip, reason }),
  });
  if (!res.ok) throw new Error(`Block failed: ${res.status}`);
  return res.json();
}

export async function unblockIp(ip: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/security/block/${encodeURIComponent(ip)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Unblock failed: ${res.status}`);
  return res.json();
}

export type DirectAd = {
  id: string;
  placement: string;
  imageUrl: string;
  linkUrl: string;
  altText: string;
  startDate: string;
  endDate: string;
};

export type AdsConfig = {
  enabled: boolean;
  placements: Record<string, boolean>;
  providers: {
    googleAdsense: { enabled: boolean; clientId: string; autoAds: boolean };
    mediaNet: { enabled: boolean; customerId: string; widgetId: string };
    customDirect: { enabled: boolean };
  };
  settings: {
    respectDoNotTrack: boolean;
    disableOnCheckout: boolean;
    inFeedEveryN: number;
    inGridEveryN: number;
    lazyLoad: boolean;
  };
  directAds: DirectAd[];
  updatedAt: string;
};

export async function fetchAdsConfig(): Promise<AdsConfig> {
  const res = await fetch(`${API_BASE}/ads/config`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Ads config fetch failed: ${res.status}`);
  return res.json();
}

export async function updateAdsConfig(data: Partial<AdsConfig>): Promise<AdsConfig> {
  const res = await fetch(`${API_BASE}/ads/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Ads config update failed: ${res.status}`);
  return res.json();
}

export type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  author_name: string;
  status: 'draft' | 'published' | 'hidden';
  tags: string[];
  featured_image_url: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateBlogPostInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  author_name: string;
  status: 'draft' | 'published' | 'hidden';
  tags?: string[];
  featured_image_url?: string;
  seo_description?: string;
};

export type UpdateBlogPostInput = Partial<CreateBlogPostInput>;

export async function fetchAdminBlogPosts(): Promise<{ posts: BlogPost[] }> {
  const res = await fetch(`${API_BASE}/admin/blog`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Blog posts fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchAdminBlogPost(slug: string): Promise<BlogPost> {
  const res = await fetch(`${API_BASE}/admin/blog/${encodeURIComponent(slug)}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Blog post fetch failed: ${res.status}`);
  return res.json();
}

export async function createBlogPost(data: CreateBlogPostInput): Promise<BlogPost> {
  const res = await fetch(`${API_BASE}/admin/blog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error || `Create blog post failed: ${res.status}`), { status: res.status });
  }
  return res.json();
}

export async function updateBlogPost(slug: string, data: UpdateBlogPostInput): Promise<BlogPost> {
  const res = await fetch(`${API_BASE}/admin/blog/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw Object.assign(new Error(body.error || `Update blog post failed: ${res.status}`), { status: res.status });
  }
  return res.json();
}

export async function deleteBlogPost(slug: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/blog/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Delete blog post failed: ${res.status}`);
}
