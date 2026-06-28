import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Pencil, Receipt, Search, Download, Send, Trash } from '@/lib/icons';
import {
  fetchInvoices,
  deleteInvoice,
  emailInvoicePdf,
  invoicePdfUrl,
  type Invoice,
} from '@/lib/api';

type StatusFilter = 'all' | 'outstanding' | 'paid' | 'overdue';

// Subtotal + balance derived from the line items. The api stores
// paymentReceived but the totals aren't persisted on the record, so the
// admin list computes them once per render. Balance is floored at 0 so an
// overpayment (payment recorded above the total) reads as fully paid rather
// than a negative "owed" figure — matching the editor's Balance Due.
function invoiceTotals(invoice: Invoice): { subtotal: number; balance: number } {
  const subtotal = invoice.lineItems.reduce((s, li) => s + li.amount, 0);
  return { subtotal, balance: Math.max(0, subtotal - invoice.paymentReceived) };
}

function invoiceStatus(invoice: Invoice): 'paid' | 'outstanding' | 'overdue' {
  const { balance } = invoiceTotals(invoice);
  if (balance <= 0.0001) return 'paid';
  const today = new Date().toISOString().slice(0, 10);
  if (invoice.dueDate < today) return 'overdue';
  return 'outstanding';
}

function workerFirstNames(invoice: Invoice): string {
  return invoice.lineItems
    .map((li) => li.workerName.trim().split(/\s+/)[0])
    .filter(Boolean)
    .join(' + ');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSgd(n: number): string {
  return n.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function Invoices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  useEffect(() => {
    fetchInvoices()
      .then((data) => setInvoices(data.invoices))
      .catch(() => toast('Failed to load invoices', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleEmail = async (invoice: Invoice) => {
    setPendingId(invoice.id);
    try {
      const result = await emailInvoicePdf(invoice.id);
      toast(`Emailed ${invoice.id} to ${result.sentTo}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to email invoice', 'error');
    } finally {
      setPendingId(null);
    }
  };

  const runDelete = async (invoice: Invoice) => {
    setPendingId(invoice.id);
    try {
      await deleteInvoice(invoice.id);
      setInvoices((prev) => prev.filter((i) => i.id !== invoice.id));
      toast(`Invoice ${invoice.id} deleted`);
    } catch {
      toast('Failed to delete invoice', 'error');
    } finally {
      setPendingId(null);
      setDeleteTarget(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const status = invoiceStatus(invoice);
      if (statusFilter === 'paid' && status !== 'paid') return false;
      if (statusFilter === 'outstanding' && status === 'paid') return false;
      if (statusFilter === 'overdue' && status !== 'overdue') return false;
      if (q) {
        const haystack =
          `${invoice.id} ${invoice.billTo.name} ${invoice.lineItems.map((li) => li.workerName).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, query]);

  // Render newest invoices first regardless of file order, since the
  // operator usually wants the most recent activity at the top.
  const ordered = useMemo(
    () => [...filtered].sort((a, b) => (b.id > a.id ? 1 : -1)),
    [filtered],
  );

  const tabs: { key: StatusFilter; label: string; count: number }[] = useMemo(
    () => [
      { key: 'all', label: 'All', count: invoices.length },
      {
        key: 'outstanding',
        label: 'Outstanding',
        count: invoices.filter((i) => invoiceStatus(i) !== 'paid').length,
      },
      {
        key: 'overdue',
        label: 'Overdue',
        count: invoices.filter((i) => invoiceStatus(i) === 'overdue').length,
      },
      {
        key: 'paid',
        label: 'Paid',
        count: invoices.filter((i) => invoiceStatus(i) === 'paid').length,
      },
    ],
    [invoices],
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Invoices</h1>
          <p className="text-sm text-muted mt-1">
            Generate PDF invoices from your current employees. Download or email each invoice to {' '}
            <span className="font-medium text-primary">findcarehelper@gmail.com</span>.
          </p>
        </div>
        <Button href="/admin/invoices/new">New Invoice</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === tab.key
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted hover:text-primary hover:bg-hover-bg'
              }`}
            >
              {tab.label} <span className="ml-1 text-xs opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search number, agency, worker"
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-surface border border-border text-primary placeholder:text-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="p-6 text-sm text-muted">Loading…</div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            heading="No invoices yet"
            description="Generate your first invoice for an existing employee."
            actionLabel="New Invoice"
            actionHref="/admin/invoices/new"
          />
        ) : ordered.length === 0 ? (
          <div className="p-6 text-sm text-muted">
            No invoices match {query ? `"${query}"` : 'this filter'}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Number</th>
                <th className="px-4 py-3 text-left">Issued</th>
                <th className="px-4 py-3 text-left">Worker Name</th>
                <th className="px-4 py-3 text-left">Bill To</th>
                <th className="px-4 py-3 text-left">Due</th>
                <th className="px-4 py-3 text-right">Balance (SGD)</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordered.map((invoice) => {
                const { balance } = invoiceTotals(invoice);
                const status = invoiceStatus(invoice);
                const isPending = pendingId === invoice.id;
                return (
                  <tr key={invoice.id} className="hover:bg-hover-bg transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/admin/invoices/${invoice.id}`)}
                        className="font-mono font-semibold text-primary hover:text-accent transition-colors text-left"
                      >
                        {invoice.id}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-muted">{formatDate(invoice.issueDate)}</td>
                    <td className="px-4 py-4 text-primary">{workerFirstNames(invoice)}</td>
                    <td className="px-4 py-4 text-primary">{invoice.billTo.name}</td>
                    <td className="px-4 py-4 text-muted">{formatDate(invoice.dueDate)}</td>
                    <td className="px-4 py-4 text-right font-mono text-primary">
                      {formatSgd(balance)}
                    </td>
                    <td className="px-4 py-4">
                      {status === 'paid' ? (
                        <Badge variant="success" dot>Paid</Badge>
                      ) : status === 'overdue' ? (
                        <Badge variant="destructive" dot>Overdue</Badge>
                      ) : (
                        <Badge variant="warning" dot>Outstanding</Badge>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={invoicePdfUrl(invoice.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors"
                          title="Download PDF"
                        >
                          <Download size={15} />
                        </a>
                        <button
                          onClick={() => handleEmail(invoice)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors disabled:opacity-50"
                          title="Email PDF to findcarehelper@gmail.com"
                        >
                          <Send size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/invoices/${invoice.id}`)}
                          className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(invoice)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete invoice"
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete invoice"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={!!pendingId}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && runDelete(deleteTarget)}
              disabled={!!pendingId}
            >
              {pendingId ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Delete <span className="font-mono font-semibold text-primary">{deleteTarget?.id}</span> for{' '}
          <span className="font-semibold text-primary">{deleteTarget?.billTo.name}</span>?
        </p>
        <p className="mt-2 text-sm text-muted">
          The invoice number is not reused — future invoices skip this slot rather than refilling it.
        </p>
      </Modal>
    </div>
  );
}
