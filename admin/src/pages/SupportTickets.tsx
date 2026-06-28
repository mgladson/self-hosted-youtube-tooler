import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Headphones, Search } from '@/lib/icons';

type Ticket = {
  id: number;
  customerEmail: string;
  customerName: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_TABS = ['all', 'open', 'in_progress', 'resolved', 'closed'] as const;

const STATUS_VARIANTS: Record<string, 'default' | 'accent' | 'success' | 'warning' | 'destructive'> = {
  open: 'accent',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
};

const PRIORITY_VARIANTS: Record<string, 'default' | 'accent' | 'destructive' | 'warning'> = {
  low: 'default',
  medium: 'warning',
  high: 'destructive',
};

export function SupportTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    fetch(`/api/support/tickets${params}`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : { tickets: [] })
      .then((data) => setTickets(data.tickets || []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = search
    ? tickets.filter(
        (t) =>
          t.subject.toLowerCase().includes(search.toLowerCase()) ||
          t.customerName.toLowerCase().includes(search.toLowerCase()) ||
          t.customerEmail.toLowerCase().includes(search.toLowerCase()),
      )
    : tickets;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Support Tickets</h1>
          <p className="text-sm text-muted mt-1">Manage customer support requests</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatusFilter(tab); setLoading(true); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              statusFilter === tab
                ? 'bg-accent text-white'
                : 'text-muted hover:text-primary hover:bg-surface',
            )}
          >
            {tab === 'all' ? 'All' : tab.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tickets..."
          className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading tickets...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Headphones size={32} className="mx-auto text-muted mb-2" />
            <p className="text-sm text-muted">No tickets found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider bg-surface/50">
              <span>Subject</span>
              <span className="w-24 text-center">Status</span>
              <span className="w-20 text-center">Priority</span>
              <span className="w-28 text-right">Customer</span>
              <span className="w-24 text-right">Date</span>
            </div>
            {filtered.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => navigate(`/admin/support/${ticket.id}`)}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-surface/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted">#{ticket.id}</p>
                </div>
                <div className="w-24 text-center">
                  <Badge variant={STATUS_VARIANTS[ticket.status] || 'default'}>
                    {ticket.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                </div>
                <div className="w-20 text-center">
                  <Badge variant={PRIORITY_VARIANTS[ticket.priority] || 'default'}>
                    {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                  </Badge>
                </div>
                <div className="w-28 text-right">
                  <p className="text-xs text-primary truncate">{ticket.customerName}</p>
                </div>
                <div className="w-24 text-right text-xs text-muted">
                  {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
