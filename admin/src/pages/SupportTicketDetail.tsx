import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Send } from '@/lib/icons';
import { useAuth } from '@/contexts/AuthContext';

type Message = {
  id: number;
  senderRole: string;
  senderName: string;
  senderEmail: string;
  body: string;
  createdAt: string;
};

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

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high'];

const STATUS_VARIANTS: Record<string, 'default' | 'accent' | 'success' | 'warning' | 'destructive'> = {
  open: 'accent',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
};

export function SupportTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/support/tickets/${id}`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setTicket(data.ticket);
          setMessages(data.messages);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: reply.trim() }),
      });

      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            senderRole: 'admin',
            senderName: user?.name || 'Admin',
            senderEmail: user?.email || '',
            body: reply.trim(),
            createdAt: new Date().toISOString(),
          },
        ]);
        setReply('');
      }
    } catch {}
    setSending(false);
  }

  async function handleStatusChange(status: string) {
    try {
      const res = await fetch(`/api/support/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setTicket((prev) => prev ? { ...prev, status } : prev);
      }
    } catch {}
  }

  async function handlePriorityChange(priority: string) {
    try {
      const res = await fetch(`/api/support/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priority }),
      });
      if (res.ok) {
        setTicket((prev) => prev ? { ...prev, priority } : prev);
      }
    } catch {}
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted">Loading...</div>;
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">Ticket not found.</p>
        <Button variant="ghost" onClick={() => navigate('/admin/support')}>Back to tickets</Button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/admin/support')}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to tickets
      </button>

      {/* Ticket header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary">{ticket.subject}</h1>
          <p className="text-sm text-muted mt-1">
            From <strong>{ticket.customerName}</strong> ({ticket.customerEmail})
          </p>
          <p className="text-xs text-muted mt-0.5">
            Created {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          <select
            value={ticket.priority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)} Priority
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <Card className="mb-6">
        <div className="divide-y divide-border">
          {messages.map((msg) => (
            <div key={msg.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  msg.senderRole === 'admin' ? 'bg-accent/20 text-accent' : 'bg-kbd-bg text-muted'
                }`}>
                  {msg.senderName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-primary">{msg.senderName}</span>
                <Badge variant={msg.senderRole === 'admin' ? 'accent' : 'default'}>
                  {msg.senderRole === 'admin' ? 'Admin' : 'Customer'}
                </Badge>
                <span className="text-xs text-muted">
                  {new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-primary whitespace-pre-wrap pl-9">{msg.body}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Reply */}
      {ticket.status !== 'closed' ? (
        <Card>
          <form onSubmit={handleReply} className="p-4">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply to the customer..."
              rows={4}
              maxLength={5000}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none mb-3"
            />
            <Button type="submit" disabled={sending || !reply.trim()}>
              <Send size={14} className="mr-1.5" />
              {sending ? 'Sending...' : 'Send Reply'}
            </Button>
          </form>
        </Card>
      ) : (
        <Card>
          <div className="p-4 text-center text-sm text-muted">
            This ticket is closed. Change the status to reopen it.
          </div>
        </Card>
      )}
    </div>
  );
}
