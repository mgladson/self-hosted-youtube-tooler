import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, type Column } from '@/components/ui/Table';
import { ArrowLeft, X, Headphones } from '@/lib/icons';
import { getCustomerById, getOrders, type Order } from '@/lib/mock-data';
import { fetchCustomerTickets, type SupportTicket } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';

const statusVariant: Record<string, 'success' | 'warning' | 'accent' | 'destructive'> = {
  completed: 'success',
  processing: 'accent',
  pending: 'warning',
  refunded: 'destructive',
};

const orderColumns: Column<Order>[] = [
  {
    key: 'order',
    header: 'Order',
    render: (o) => <span className="font-medium">{o.orderNumber}</span>,
  },
  {
    key: 'total',
    header: 'Total',
    render: (o) => formatPrice(o.total),
  },
  {
    key: 'status',
    header: 'Status',
    render: (o) => (
      <Badge variant={statusVariant[o.status]}>
        {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'date',
    header: 'Date',
    render: (o) => <span className="text-muted">{formatDate(o.createdAt)}</span>,
  },
];

const TICKET_STATUS_VARIANT: Record<string, 'accent' | 'warning' | 'success' | 'default'> = {
  open: 'accent',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
};

const TICKET_PRIORITY_VARIANT: Record<string, 'default' | 'warning' | 'destructive'> = {
  low: 'default',
  medium: 'warning',
  high: 'destructive',
};

const CUSTOMER_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive'> = {
  active: 'success',
  inactive: 'warning',
  churned: 'destructive',
};

const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  active: 'Active Customer',
  inactive: 'Inactive',
  churned: 'Churned',
};

type Tab = 'overview' | 'tickets';

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customer = getCustomerById(id || '');
  const [tab, setTab] = useState<Tab>('overview');
  const [notes, setNotes] = useState<string>(() => {
    try { return localStorage.getItem(`sendburmese:notes:customer:${id}`) || ''; } catch { return ''; }
  });
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`sendburmese:tags:customer:${id}`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setTicketsLoading(true);
    fetchCustomerTickets(customer.email)
      .then((data) => setTickets(data.tickets))
      .catch(() => setTickets([]))
      .finally(() => setTicketsLoading(false));
  }, [customer?.email]);

  if (!customer) {
    return (
      <div>
        <Link to="/admin/customers" className="flex items-center gap-2 text-sm text-muted hover:text-primary mb-6">
          <ArrowLeft size={16} />
          Back to Customers
        </Link>
        <Card>
          <p className="text-center text-muted py-8">Customer not found</p>
        </Card>
      </div>
    );
  }

  const customerOrders = getOrders().filter(
    (o) => o.customerEmail === customer.email,
  );

  const saveNotes = () => {
    try { localStorage.setItem(`sendburmese:notes:customer:${id}`, notes); } catch {}
  };

  const saveTags = (newTags: string[]) => {
    try { localStorage.setItem(`sendburmese:tags:customer:${id}`, JSON.stringify(newTags)); } catch {}
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      const next = [...tags, t];
      setTags(next);
      saveTags(next);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    saveTags(next);
  };

  const initial = customer.email.charAt(0).toUpperCase();
  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div>
      <Link to="/admin/customers" className="flex items-center gap-2 text-sm text-muted hover:text-primary mb-6">
        <ArrowLeft size={16} />
        Back to Customers
      </Link>

      <h1 className="text-2xl font-bold text-primary mb-6">{customer.email}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            <button
              onClick={() => setTab('overview')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === 'overview'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setTab('tickets')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                tab === 'tickets'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              Support Tickets
              {tickets.length > 0 && (
                <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold min-w-[18px] ${
                  openTickets > 0 ? 'bg-accent/10 text-accent' : 'bg-kbd-bg text-muted'
                }`}>
                  {tickets.length}
                </span>
              )}
            </button>
          </div>

          {/* Overview Tab */}
          {tab === 'overview' && (
            <>
              <Card padding={false}>
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="font-semibold text-primary">Order History ({customerOrders.length})</h2>
                </div>
                <Table
                  columns={orderColumns}
                  data={customerOrders}
                  rowKey={(o) => o.id}
                  emptyMessage="No orders yet"
                />
              </Card>

              <Card>
                <h2 className="text-sm font-semibold text-primary mb-3">Notes</h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Add internal notes about this customer..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 resize-y min-h-[80px]"
                  rows={3}
                />
              </Card>
            </>
          )}

          {/* Support Tickets Tab */}
          {tab === 'tickets' && (
            <Card padding={false}>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-primary">Support Tickets ({tickets.length})</h2>
              </div>
              {ticketsLoading ? (
                <div className="px-6 py-12 text-center text-sm text-muted">Loading tickets...</div>
              ) : tickets.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Headphones size={32} className="mx-auto text-muted mb-3" />
                  <p className="text-sm text-muted">No support tickets from this customer</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => navigate(`/admin/support/${ticket.id}`)}
                      className="w-full px-6 py-3 flex items-center gap-4 text-left hover:bg-hover-bg transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{ticket.subject}</p>
                        <p className="text-xs text-muted mt-0.5">#{ticket.id} · {formatDate(ticket.createdAt)}</p>
                      </div>
                      <Badge variant={TICKET_STATUS_VARIANT[ticket.status] || 'default'}>
                        {ticket.status.replaceAll('_', ' ')}
                      </Badge>
                      <Badge variant={TICKET_PRIORITY_VARIANT[ticket.priority] || 'default'}>
                        {ticket.priority}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-icon-bg text-lg font-semibold text-accent mb-3">
                {initial}
              </div>
              <h2 className="font-semibold text-primary">{customer.email}</h2>
              <div className="mt-2">
                <Badge dot variant={CUSTOMER_STATUS_VARIANT[customer.status]}>
                  {CUSTOMER_STATUS_LABEL[customer.status]}
                </Badge>
              </div>
            </div>
            <dl className="space-y-2 pt-4 border-t border-border">
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Joined</dt>
                <dd className="text-xs text-primary">{formatDate(customer.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Total Orders</dt>
                <dd className="text-xs text-primary">{customer.totalOrders}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Total Spent</dt>
                <dd className="text-xs font-medium text-primary">{formatPrice(customer.totalSpent)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Last Order</dt>
                <dd className="text-xs text-primary">{formatDate(customer.lastOrderAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Open Tickets</dt>
                <dd className="text-xs text-primary">{openTickets}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-primary mb-3">Tags</h2>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-kbd-bg px-2.5 py-0.5 text-xs font-medium text-muted"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add tag..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
