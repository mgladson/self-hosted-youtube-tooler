import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useUnsavedChangesGuard } from '@/lib/hooks';
import { ArrowLeft, Download, Send, Trash } from '@/lib/icons';
import {
  fetchInvoice,
  createInvoice,
  updateInvoice,
  emailInvoicePdf,
  invoicePdfUrl,
  fetchAgencies,
  createAgency,
  fetchAllEmployees,
  type Invoice,
  type InvoiceInput,
  type InvoiceLineItem,
  type Agency,
  type CurrentEmployee,
} from '@/lib/api';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Default due date = today + 9 days, matching the cadence of the original
// INV-0003 (issued 22 May, due 31 May).
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 9);
  return d.toISOString().slice(0, 10);
}

function emptyLineItem(): InvoiceLineItem {
  return {
    employeeSlug: '',
    workerName: '',
    placementDate: todayIso(),
    amount: 0,
  };
}

function formatSgd(n: number): string {
  return n.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Serialized snapshot of the invoice form's user-editable fields. Comparing the
// live snapshot against the one captured at load / after save tells the
// unsaved-changes guard whether there are pending edits.
type InvoiceFormSnapshot = {
  billToName: string;
  billToAddress: string;
  billToEmail: string;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  paymentReceived: number;
  notes: string;
};

function snapshotInvoiceForm(s: InvoiceFormSnapshot): string {
  return JSON.stringify(s);
}

// `null` slug picks "use the fields below" — the operator types name/address
// directly. Any non-null value is an agency id.
type BillToMode = string | null;

export function InvoiceEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [employees, setEmployees] = useState<CurrentEmployee[]>([]);
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);

  // Form state — mirrors InvoiceInput exactly, plus a billTo "mode" that
  // selects whether the bill-to comes from a saved agency or free-text.
  const [billToMode, setBillToMode] = useState<BillToMode>(null);
  const [billToName, setBillToName] = useState('');
  const [billToAddress, setBillToAddress] = useState('');
  const [billToEmail, setBillToEmail] = useState('');
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([emptyLineItem()]);
  const [paymentReceived, setPaymentReceived] = useState(0);
  const [notes, setNotes] = useState('');
  const [saveAgency, setSaveAgency] = useState(true);

  // Baseline snapshot captured on load and after each save; the form is "dirty"
  // when the live snapshot diverges from it. `saving` suppresses the guard so a
  // save that navigates (new invoice → its detail page) isn't itself blocked.
  const [baseline, setBaseline] = useState<string | null>(null);
  const currentSnapshot = useMemo(
    () =>
      snapshotInvoiceForm({
        billToName,
        billToAddress,
        billToEmail,
        issueDate,
        dueDate,
        lineItems,
        paymentReceived,
        notes,
      }),
    [billToName, billToAddress, billToEmail, issueDate, dueDate, lineItems, paymentReceived, notes],
  );
  const dirty = baseline !== null && currentSnapshot !== baseline;
  const blocker = useUnsavedChangesGuard(dirty && !saving);

  // Initial load — agencies + employees always; existing invoice if editing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [agencyData, employeeData, invoiceData] = await Promise.all([
          fetchAgencies(),
          fetchAllEmployees(),
          isNew ? Promise.resolve(null) : fetchInvoice(id as string),
        ]);
        if (cancelled) return;
        setAgencies(agencyData.agencies);
        setEmployees(employeeData.employees);
        if (invoiceData) {
          hydrateForm(invoiceData, agencyData.agencies);
          setSavedInvoice(invoiceData);
          setBaseline(
            snapshotInvoiceForm({
              billToName: invoiceData.billTo.name,
              billToAddress: invoiceData.billTo.address,
              billToEmail: invoiceData.billTo.email ?? '',
              issueDate: invoiceData.issueDate,
              dueDate: invoiceData.dueDate,
              lineItems:
                invoiceData.lineItems.length > 0
                  ? invoiceData.lineItems
                  : [emptyLineItem()],
              paymentReceived: invoiceData.paymentReceived,
              notes: invoiceData.notes ?? '',
            }),
          );
        } else {
          // New invoice: default the bill-to to the "TBD" placeholder agency so
          // the operator can leave it until the receiving agency is confirmed.
          const tbd = agencyData.agencies.find(
            (a) => a.name.trim().toUpperCase() === 'TBD',
          );
          if (tbd) {
            setBillToMode(tbd.id);
            setBillToName(tbd.name);
            setBillToAddress(tbd.address);
            setBillToEmail(tbd.email ?? '');
            setSaveAgency(false);
          }
          // Baseline reflects the seeded defaults (TBD bill-to if present, the
          // initial dates / empty line item otherwise) so an untouched new
          // invoice isn't flagged dirty.
          setBaseline(
            snapshotInvoiceForm({
              billToName: tbd?.name ?? '',
              billToAddress: tbd?.address ?? '',
              billToEmail: tbd?.email ?? '',
              issueDate,
              dueDate,
              lineItems,
              paymentReceived,
              notes,
            }),
          );
        }
      } catch {
        if (!cancelled) toast('Failed to load invoice data', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function hydrateForm(inv: Invoice, agencyList: Agency[]): void {
    setIssueDate(inv.issueDate);
    setDueDate(inv.dueDate);
    setBillToName(inv.billTo.name);
    setBillToAddress(inv.billTo.address);
    setBillToEmail(inv.billTo.email ?? '');
    setLineItems(inv.lineItems.length > 0 ? inv.lineItems : [emptyLineItem()]);
    setPaymentReceived(inv.paymentReceived);
    setNotes(inv.notes ?? '');
    // Prefer matching an agency by exact name + address so the dropdown
    // shows the same selection that originally created this invoice.
    const match = agencyList.find(
      (a) => a.name === inv.billTo.name && a.address === inv.billTo.address,
    );
    setBillToMode(match?.id ?? null);
    setSaveAgency(!match);
  }

  function applyAgency(agencyId: string): void {
    const agency = agencies.find((a) => a.id === agencyId);
    if (!agency) return;
    setBillToMode(agencyId);
    setBillToName(agency.name);
    setBillToAddress(agency.address);
    setBillToEmail(agency.email ?? '');
    setSaveAgency(false);
  }

  function updateLineItem(i: number, patch: Partial<InvoiceLineItem>): void {
    setLineItems((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  }

  function pickEmployeeForLine(i: number, slug: string): void {
    const employee = employees.find((e) => e.slug === slug);
    if (!employee) {
      updateLineItem(i, { employeeSlug: slug, workerName: '' });
      return;
    }
    updateLineItem(i, { employeeSlug: slug, workerName: employee.name });
  }

  const subtotal = useMemo(
    () => lineItems.reduce((s, li) => s + (Number.isFinite(li.amount) ? li.amount : 0), 0),
    [lineItems],
  );
  const balanceDue = Math.max(0, subtotal - paymentReceived);

  async function persistAgencyIfNeeded(): Promise<void> {
    if (!saveAgency || billToMode !== null) return;
    if (!billToName.trim()) return;
    try {
      const agency = await createAgency({
        name: billToName.trim(),
        address: billToAddress,
        email: billToEmail.trim() || undefined,
      });
      setAgencies((prev) => [...prev, agency]);
      setBillToMode(agency.id);
    } catch (err) {
      // Don't block the invoice save on an agency-save failure — the
      // invoice itself still has the bill-to snapshot.
      toast(
        err instanceof Error
          ? `Agency save failed: ${err.message}`
          : 'Agency save failed',
        'info',
      );
    }
  }

  async function handleSave(): Promise<void> {
    if (!billToName.trim()) {
      toast('Bill-to name is required', 'error');
      return;
    }
    if (lineItems.length === 0) {
      toast('At least one line item is required', 'error');
      return;
    }
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      if (!li.workerName.trim()) {
        toast(`Line ${i + 1}: enter a worker name`, 'error');
        return;
      }
      if (!Number.isFinite(li.amount) || li.amount <= 0) {
        toast(`Line ${i + 1}: amount must be greater than 0`, 'error');
        return;
      }
    }

    const payload: InvoiceInput = {
      issueDate,
      dueDate,
      billTo: {
        name: billToName.trim(),
        address: billToAddress,
        email: billToEmail.trim() || undefined,
      },
      lineItems: lineItems.map((li) => ({
        ...li,
        nationality: li.nationality?.trim() || undefined,
      })),
      paymentReceived,
      notes: notes.trim() || undefined,
    };

    setSaving(true);
    try {
      await persistAgencyIfNeeded();
      const result = isNew
        ? await createInvoice(payload)
        : await updateInvoice(id as string, payload);
      setSavedInvoice(result);
      setBaseline(currentSnapshot);
      toast(`Invoice ${result.id} ${isNew ? 'created' : 'updated'}`);
      if (isNew) {
        navigate(`/admin/invoices/${result.id}`, { replace: true });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleEmail(): Promise<void> {
    if (!savedInvoice) return;
    setSaving(true);
    try {
      const result = await emailInvoicePdf(savedInvoice.id);
      toast(`Emailed ${savedInvoice.id} to ${result.sentTo}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Email failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted">Loading…</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/invoices')}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-2"
          >
            <ArrowLeft size={15} /> Back to invoices
          </button>
          <h1 className="text-2xl font-bold text-primary">
            {isNew ? 'New Invoice' : savedInvoice?.id ?? 'Invoice'}
          </h1>
          <p className="text-sm text-muted mt-1">
            {isNew
              ? 'Number is allocated on save (next INV-NNNN).'
              : `Last updated ${savedInvoice?.updatedAt?.slice(0, 10) ?? '—'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedInvoice && (
            <>
              <Button
                variant="secondary"
                href={invoicePdfUrl(savedInvoice.id)}
                external
                target="_blank"
                rel="noreferrer"
                className="!gap-2"
              >
                <Download size={15} /> Download PDF
              </Button>
              <Button
                variant="secondary"
                onClick={handleEmail}
                disabled={saving}
                className="!gap-2"
              >
                <Send size={15} /> Email PDF
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create invoice' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="font-semibold text-primary mb-3">Bill To (Receiving Agency)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="Pick a saved agency"
                value={billToMode ?? '__new__'}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__new__') {
                    setBillToMode(null);
                  } else {
                    applyAgency(v);
                  }
                }}
                options={[
                  { value: '__new__', label: '— New agency / type below —' },
                  ...agencies.map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
              <Input
                label="Agency name *"
                value={billToName}
                onChange={(e) => {
                  setBillToName(e.target.value);
                  setBillToMode(null);
                }}
              />
            </div>
            <div className="mt-3">
              <Textarea
                label="Address (multi-line)"
                value={billToAddress}
                onChange={(e) => {
                  setBillToAddress(e.target.value);
                  setBillToMode(null);
                }}
                rows={3}
              />
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <Input
                label="Email (optional)"
                value={billToEmail}
                onChange={(e) => {
                  setBillToEmail(e.target.value);
                  setBillToMode(null);
                }}
                type="email"
              />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={saveAgency}
                  onChange={(e) => setSaveAgency(e.target.checked)}
                />
                Save this agency for autocomplete next time
              </label>
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-3">Invoice dates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Issue date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
              <Input
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-primary">Line items</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLineItems((prev) => [...prev, emptyLineItem()])}
              >
                + Add line
              </Button>
            </div>
            <div className="space-y-4">
              {lineItems.map((li, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-background/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted">#{i + 1}</span>
                    {lineItems.length > 1 && (
                      <button
                        onClick={() =>
                          setLineItems((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                      >
                        <Trash size={12} /> Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select
                      label="Pick a saved employee"
                      value={li.employeeSlug}
                      onChange={(e) => pickEmployeeForLine(i, e.target.value)}
                      options={[
                        { value: '', label: '— Type a name below —' },
                        ...employees.map((e) => ({
                          value: e.slug,
                          label: `${e.name}${e.disabled ? ' (disabled)' : ''}`,
                        })),
                      ]}
                    />
                    <Input
                      label="Worker name *"
                      value={li.workerName}
                      onChange={(e) =>
                        updateLineItem(i, { workerName: e.target.value, employeeSlug: '' })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      label="Date of Placement"
                      type="date"
                      value={li.placementDate}
                      onChange={(e) => updateLineItem(i, { placementDate: e.target.value })}
                    />
                    <Input
                      label="Amount (SGD) *"
                      type="number"
                      step="0.01"
                      min="0"
                      value={String(li.amount)}
                      onChange={(e) =>
                        updateLineItem(i, { amount: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      label="Nationality (defaults to Myanmar)"
                      value={li.nationality ?? ''}
                      onChange={(e) => updateLineItem(i, { nationality: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-3">Notes (optional)</h2>
            <Textarea
              label=""
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Overrides the default footer note on the PDF."
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-primary mb-4">Totals</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-primary font-mono">SGD {formatSgd(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tax / GST</dt>
                <dd className="text-primary font-mono">0.00</dd>
              </div>
              <div className="flex justify-between items-end gap-3">
                <dt className="text-muted">Payment Received</dt>
                <dd>
                  <Input
                    label=""
                    type="number"
                    step="0.01"
                    min="0"
                    value={String(paymentReceived)}
                    onChange={(e) => setPaymentReceived(parseFloat(e.target.value) || 0)}
                    className="w-32 text-right"
                  />
                </dd>
              </div>
              <div className="border-t border-border pt-3 flex justify-between text-base">
                <dt className="font-semibold text-primary">Balance Due</dt>
                <dd className="font-mono font-bold text-primary">SGD {formatSgd(balanceDue)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-2">PDF preview</h2>
            <p className="text-xs text-muted mb-3">
              The canonical PDF is rendered server-side. Save the invoice first, then open the live PDF in a new tab to preview.
            </p>
            {savedInvoice ? (
              <a
                href={invoicePdfUrl(savedInvoice.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <Download size={14} /> Open {savedInvoice.id}.pdf
              </a>
            ) : (
              <p className="text-xs text-muted italic">Available after first save.</p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Unsaved changes"
        footer={
          <>
            <Button variant="secondary" onClick={() => blocker.reset?.()}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Leave without saving
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          You have unsaved changes to this invoice. If you leave now they'll be lost.
        </p>
      </Modal>
    </div>
  );
}
