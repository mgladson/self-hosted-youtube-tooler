import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Download } from '@/lib/icons';
import { fetchCustomerLeads, type CustomerLead } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { downloadCSV } from '@/lib/csv';

function fmtDate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function CustomerLeads() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<CustomerLead[]>([]);

  useEffect(() => {
    fetchCustomerLeads()
      .then((data) => setLeads(data.leads))
      .catch(() => toast('Failed to load customer leads', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleExport = () => {
    downloadCSV(
      'customer-leads',
      [
        { key: 'email', header: 'Email', value: (l) => l.email },
        { key: 'name', header: 'Name', value: (l) => l.name },
        { key: 'first_seen', header: 'First Seen', value: (l) => l.first_seen },
        { key: 'last_seen', header: 'Last Seen', value: (l) => l.last_seen },
        { key: 'login_count', header: 'Logins', value: (l) => String(l.login_count) },
      ],
      leads,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Customer Leads</h1>
          <p className="text-sm text-muted mt-1">
            Visitors who signed in with Google to view full helper bio-data and photos.
          </p>
        </div>
        {leads.length > 0 && (
          <Button variant="ghost" onClick={handleExport}>
            <Download size={16} />
            Export CSV
          </Button>
        )}
      </div>

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-primary">
            Leads
            <Badge variant="accent" className="ml-2">{leads.length}</Badge>
          </h2>
          <p className="text-xs text-muted mt-0.5">Captured automatically on customer login</p>
        </div>

        {leads.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted">No leads yet</p>
            <p className="text-xs text-muted mt-1">
              Leads appear here once visitors log in to view gated profiles.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Name</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Email</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">First Seen</th>
                <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Last Seen</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Logins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => (
                <tr key={lead.email} className="hover:bg-hover-bg">
                  <td className="py-2.5 px-4 text-sm font-medium text-primary">{lead.name || '—'}</td>
                  <td className="py-2.5 px-4 text-sm text-muted">{lead.email}</td>
                  <td className="py-2.5 px-4 text-sm text-muted">{fmtDate(lead.first_seen)}</td>
                  <td className="py-2.5 px-4 text-sm text-muted">{fmtDate(lead.last_seen)}</td>
                  <td className="py-2.5 px-4 text-sm text-right text-muted">{lead.login_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
