import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Trash, Download } from '@/lib/icons';
import {
  fetchNewsletterSubscribers,
  updateNewsletterSettings,
  deleteNewsletterSubscriber,
  type NewsletterSubscriber,
} from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { downloadCSV } from '@/lib/csv';

export function Newsletter() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  useEffect(() => {
    fetchNewsletterSubscribers()
      .then((data) => {
        setEnabled(data.enabled);
        setSubscribers(data.subscribers);
      })
      .catch(() => toast('Failed to load newsletter data', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleToggleEnabled = async () => {
    setTogglingEnabled(true);
    try {
      const result = await updateNewsletterSettings(!enabled);
      setEnabled(result.enabled);
      toast(result.enabled ? 'Newsletter signup enabled' : 'Newsletter signup disabled');
    } catch {
      toast('Failed to update settings', 'error');
    } finally {
      setTogglingEnabled(false);
    }
  };

  const handleDelete = async (email: string) => {
    setDeletingEmail(email);
    try {
      await deleteNewsletterSubscriber(email);
      setSubscribers((prev) => prev.filter((s) => s.email !== email));
      toast('Subscriber removed');
    } catch {
      toast('Failed to remove subscriber', 'error');
    } finally {
      setDeletingEmail(null);
    }
  };

  const handleExport = () => {
    downloadCSV(
      'newsletter-subscribers',
      [
        { key: 'email', header: 'Email', value: (s) => s.email },
        { key: 'subscribedAt', header: 'Subscribed At', value: (s) => s.subscribedAt },
      ],
      subscribers,
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
          <h1 className="text-2xl font-bold text-primary">Newsletter</h1>
          <p className="text-sm text-muted mt-1">Manage subscribers and storefront signup visibility</p>
        </div>
        {subscribers.length > 0 && (
          <Button variant="ghost" onClick={handleExport}>
            <Download size={16} />
            Export CSV
          </Button>
        )}
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Settings */}
        <Card>
          <h2 className="font-semibold text-primary mb-4">Signup Section</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              role="switch"
              aria-checked={enabled}
              tabIndex={0}
              onClick={togglingEnabled ? undefined : handleToggleEnabled}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !togglingEnabled) {
                  e.preventDefault();
                  handleToggleEnabled();
                }
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                togglingEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${enabled ? 'bg-accent' : 'bg-skeleton'}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-surface transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </div>
            <div>
              <span className="text-sm font-medium text-primary">
                {enabled ? 'Signup section is visible on storefront' : 'Signup section is hidden on storefront'}
              </span>
              <p className="text-xs text-muted mt-0.5">
                Toggle to show or hide the newsletter signup section on the home page
              </p>
            </div>
          </label>
        </Card>

        {/* Subscribers */}
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-primary">
                Subscribers
                <Badge variant="accent" className="ml-2">{subscribers.length}</Badge>
              </h2>
              <p className="text-xs text-muted mt-0.5">Emails collected from the storefront signup form</p>
            </div>
          </div>

          {subscribers.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-muted">No subscribers yet</p>
              <p className="text-xs text-muted mt-1">
                {enabled
                  ? 'Subscribers will appear here once visitors sign up'
                  : 'Enable the signup section to start collecting emails'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Email</th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Subscribed</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscribers.map((sub) => (
                  <tr key={sub.email} className="hover:bg-hover-bg">
                    <td className="py-2.5 px-4 text-sm font-medium">{sub.email}</td>
                    <td className="py-2.5 px-4 text-sm text-muted">
                      {new Date(sub.subscribedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(sub.email)}
                        disabled={deletingEmail === sub.email}
                        className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Remove subscriber"
                      >
                        <Trash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
