import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { ArrowLeft } from '@/lib/icons';
import {
  fetchErrorGroup,
  setErrorStatus,
  deleteErrorGroup,
  type ErrorGroupDetail,
  type ErrorGroupStatus,
  type ErrorSample,
} from '@/lib/api';

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_VARIANT: Record<string, 'destructive' | 'success' | 'default'> = {
  open: 'destructive',
  resolved: 'success',
  ignored: 'default',
};

function SampleRow({ sample }: { sample: ErrorSample }) {
  return (
    <div className="border-b border-border last:border-b-0 py-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span title={formatAbsolute(sample.createdAt)}>{formatAbsolute(sample.createdAt)}</span>
        <Badge variant="destructive">{sample.statusCode}</Badge>
        {sample.code && <Badge variant="warning">{sample.code}</Badge>}
        <span className="font-mono">{sample.method}</span>
        <span>{formatBytes(sample.bytes)}</span>
        {sample.ip && <span>· {sample.ip}</span>}
        {sample.userEmail && <span>· {sample.userEmail}</span>}
        {sample.requestId && <span className="font-mono">· {sample.requestId}</span>}
      </div>
      <p className="mt-2 text-sm text-primary whitespace-pre-wrap break-words">{sample.message}</p>
      {sample.context && Object.keys(sample.context).length > 0 && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-background border border-border p-3 text-xs text-muted">
          {JSON.stringify(sample.context, null, 2)}
        </pre>
      )}
      {sample.stack && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-accent">Stack trace</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-background border border-border p-3 text-xs text-muted whitespace-pre-wrap break-words">
            {sample.stack}
          </pre>
        </details>
      )}
    </div>
  );
}

export function TechnicalDetail() {
  const { fingerprint = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ErrorGroupDetail | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchErrorGroup(fingerprint)
      .then((data) => {
        setDetail(data);
        setNote(data.group.note ?? '');
      })
      .catch(() => toast('Failed to load error group', 'error'))
      .finally(() => setLoading(false));
  }, [fingerprint, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(status: ErrorGroupStatus) {
    setBusy(true);
    try {
      await setErrorStatus(fingerprint, status, note || undefined);
      toast(`Marked ${status}`, 'success');
      setDetail((prev) => (prev ? { ...prev, group: { ...prev.group, status } } : prev));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this error group and all its occurrences? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await deleteErrorGroup(fingerprint);
      toast(`Deleted ${res.deletedEvents.toLocaleString()} occurrence${res.deletedEvents === 1 ? '' : 's'}`, 'success');
      navigate('/admin/technical');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/technical" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} />
        Back to errors
      </Link>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : !detail ? (
        <Card>
          <p className="text-muted">This error group no longer exists.</p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{detail.group.statusCode}</Badge>
                  {detail.group.code && <Badge variant="warning">{detail.group.code}</Badge>}
                  <Badge variant={STATUS_VARIANT[detail.group.status]}>{detail.group.status}</Badge>
                </div>
                <p className="mt-2 font-mono text-sm text-primary break-all">{detail.group.route}</p>
                <p className="mt-2 text-sm text-primary break-words">{detail.group.sampleMessage}</p>
                <p className="mt-3 text-xs text-muted">
                  {detail.group.count.toLocaleString()} occurrence{detail.group.count === 1 ? '' : 's'} ·{' '}
                  {formatBytes(detail.group.totalBytes)} total · first {formatAbsolute(detail.group.firstSeen)} · last{' '}
                  {formatAbsolute(detail.group.lastSeen)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {detail.group.status !== 'resolved' && (
                    <Button variant="primary" size="sm" onClick={() => changeStatus('resolved')} disabled={busy}>
                      Resolve
                    </Button>
                  )}
                  {detail.group.status !== 'ignored' && (
                    <Button variant="secondary" size="sm" onClick={() => changeStatus('ignored')} disabled={busy}>
                      Ignore
                    </Button>
                  )}
                  {detail.group.status !== 'open' && (
                    <Button variant="secondary" size="sm" onClick={() => changeStatus('open')} disabled={busy}>
                      Reopen
                    </Button>
                  )}
                </div>
                <Button variant="destructive" size="sm" onClick={remove} disabled={busy}>
                  Delete group
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <Textarea
                label="Triage note"
                placeholder="What's going on with this error? Saved when you set a status."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </Card>

          <Card padding={false}>
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-primary">
                Recent occurrences <span className="text-muted font-normal">({detail.samples.length})</span>
              </h2>
            </div>
            <div className="px-6">
              {detail.samples.length === 0 ? (
                <p className="py-8 text-center text-muted">No occurrences.</p>
              ) : (
                detail.samples.map((s) => <SampleRow key={s.id} sample={s} />)
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
