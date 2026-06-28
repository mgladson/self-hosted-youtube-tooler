import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Mail, Send, Eye, X } from '@/lib/icons';
import { getSegments, getSegmentCustomers } from '@/lib/segments';
import { sendCampaignEmail } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type SentEntry = {
  segment: string;
  count: number;
  subject: string;
  timestamp: string;
};

const emailTabs = ['Compose', 'History'] as const;

export function Email() {
  const { toast } = useToast();
  const segments = getSegments();

  const [activeTab, setActiveTab] = useState<string>('Compose');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [sentLog, setSentLog] = useState<SentEntry[]>([]);

  const recipients = useMemo(
    () => getSegmentCustomers(selectedSegment),
    [selectedSegment],
  );

  const currentSegment = segments.find((s) => s.id === selectedSegment);
  const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, 10);

  const handleSend = async () => {
    setShowConfirm(false);
    setSending(true);
    try {
      const result = await sendCampaignEmail(
        recipients.map((c) => ({ email: c.email })),
        subject,
        body,
      );
      toast(
        `Sent ${result.sent} email${result.sent !== 1 ? 's' : ''}${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        result.failed > 0 ? 'error' : 'success',
      );
      setSentLog((prev) => [
        {
          segment: currentSegment?.name || selectedSegment,
          count: result.sent,
          subject,
          timestamp: new Date().toLocaleString(),
        },
        ...prev,
      ]);
      setSubject('');
      setBody('');
    } catch {
      toast('Failed to send emails', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Email Campaigns</h1>
          <p className="text-sm text-muted mt-1">Send targeted emails to customer segments</p>
        </div>
      </div>

      <div className="flex border-b border-border mb-6">
        {emailTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-primary hover:border-border',
            )}
          >
            {tab}
            {tab === 'History' && sentLog.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({sentLog.length})</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'History' && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-primary">Campaign History</h2>
            <p className="text-xs text-muted mt-0.5">Emails sent during this session</p>
          </div>
          {sentLog.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Mail size={24} className="mx-auto text-muted mb-2" />
              <p className="text-sm text-muted">No campaigns sent yet</p>
              <p className="text-xs text-muted mt-1">Campaigns you send will appear here</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Date</th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Segment</th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Subject</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Recipients</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sentLog.map((entry, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-4 text-sm text-muted">{entry.timestamp}</td>
                    <td className="py-2.5 px-4 text-sm font-medium">{entry.segment}</td>
                    <td className="py-2.5 px-4 text-sm truncate max-w-[200px]">{entry.subject}</td>
                    <td className="py-2.5 px-4 text-sm text-right">
                      <Badge variant="success">{entry.count}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {activeTab === 'Compose' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Compose */}
        <div className="lg:col-span-2 space-y-6">
          {/* Segment Picker */}
          <Card>
            <h2 className="text-sm font-semibold text-primary mb-3">Select Audience</h2>
            <div className="flex flex-wrap gap-2">
              {segments.map((seg) => {
                const count = getSegmentCustomers(seg.id).length;
                return (
                  <button
                    key={seg.id}
                    onClick={() => {
                      setSelectedSegment(seg.id);
                      setShowAllRecipients(false);
                    }}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      selectedSegment === seg.id
                        ? 'bg-accent text-white'
                        : 'bg-kbd-bg text-muted hover:bg-skeleton',
                    )}
                  >
                    {seg.name}
                    <span className="ml-1.5 opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
            {currentSegment && (
              <p className="text-xs text-muted mt-2">{currentSegment.description}</p>
            )}
          </Card>

          {/* Recipients Preview */}
          <Card padding={false}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">
                Recipients
                <Badge variant="accent" className="ml-2">{recipients.length}</Badge>
              </h2>
            </div>
            {recipients.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">No customers match this segment</p>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {visibleRecipients.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-icon-bg text-[10px] font-medium text-accent">
                        {c.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{c.email}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {recipients.length > 10 && (
                  <div className="px-4 py-2 border-t border-border">
                    <button
                      onClick={() => setShowAllRecipients(!showAllRecipients)}
                      className="text-xs text-accent hover:underline"
                    >
                      {showAllRecipients
                        ? 'Show fewer'
                        : `Show all ${recipients.length} recipients`}
                    </button>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Compose Form */}
          <Card>
            <h2 className="text-sm font-semibold text-primary mb-3">Compose Email</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-muted">Body (HTML)</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(true)}
                    disabled={!body}
                  >
                    <Eye size={14} />
                    Preview
                  </Button>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="<h1>Hello!</h1><p>We have exciting news...</p>"
                  rows={10}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
                />
              </div>

              {/* Send */}
              <div className="flex items-center gap-3 pt-2">
                {!showConfirm ? (
                  <Button
                    onClick={() => setShowConfirm(true)}
                    disabled={!subject || !body || recipients.length === 0 || sending}
                  >
                    <Send size={16} />
                    Send to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-2">
                    <p className="text-sm text-amber-800">
                      Send {recipients.length} email{recipients.length !== 1 ? 's' : ''}?
                    </p>
                    <Button size="sm" onClick={handleSend} disabled={sending}>
                      {sending ? 'Sending...' : 'Confirm'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowConfirm(false)}
                      disabled={sending}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Sent Log */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-primary mb-3">
              <Mail size={14} className="inline mr-1.5" />
              Sent This Session
            </h2>
            {sentLog.length === 0 ? (
              <p className="text-xs text-muted">No emails sent yet</p>
            ) : (
              <div className="space-y-2">
                {sentLog.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-hover-bg px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">{entry.segment}</p>
                      <p className="text-[10px] text-muted">{entry.timestamp}</p>
                    </div>
                    <Badge variant="success">{entry.count} sent</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-primary mb-3">Tips</h2>
            <ul className="space-y-2 text-xs text-muted">
              <li>Use the <strong>Body (HTML)</strong> field to write HTML emails</li>
              <li>Click <strong>Preview</strong> to see how the email will look</li>
              <li>In development, all emails go to <a href="http://localhost:8025" target="_blank" rel="noreferrer" className="text-accent hover:underline">Mailpit</a></li>
              <li>Segment counts update based on current customer data</li>
            </ul>
          </Card>
        </div>
      </div>}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-xl border border-border shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-primary">Email Preview</h3>
                <p className="text-xs text-muted mt-0.5">Subject: {subject || '(no subject)'}</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-hover-bg rounded-lg">
                <X size={16} className="text-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                sandbox=""
                srcDoc={body}
                className="w-full min-h-[300px] border-0"
                title="Email preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
