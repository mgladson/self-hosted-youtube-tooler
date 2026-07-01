import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Table, type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import {
  fetchErrorGroups,
  fetchErrorSummary,
  purgeErrors,
  type ErrorGroup,
  type ErrorSort,
  type ErrorStatusFilter,
  type ErrorSummary,
} from '@/lib/api';

const PAGE_SIZE = 50;

const SORT_OPTIONS = [
  { value: 'count', label: 'Most frequent' },
  { value: 'bytes', label: 'Largest size' },
  { value: 'last_seen', label: 'Most recent' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All statuses' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored' },
];

const PURGE_OPTIONS = [
  { value: 'resolved', label: 'Clear resolved' },
  { value: 'ignored', label: 'Clear ignored' },
  { value: '7', label: 'Older than 7 days' },
  { value: '30', label: 'Older than 30 days' },
  { value: 'all', label: 'Everything' },
];

const STATUS_VARIANT: Record<string, 'destructive' | 'success' | 'default'> = {
  open: 'destructive',
  resolved: 'success',
  ignored: 'default',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const columns: Column<ErrorGroup>[] = [
  {
    key: 'count',
    header: 'Count',
    className: 'w-24 whitespace-nowrap',
    render: (g) => (
      <div>
        <p className="font-semibold text-primary">{g.count.toLocaleString()}</p>
        <p className="text-[11px] text-muted">{formatBytes(g.totalBytes)}</p>
      </div>
    ),
  },
  {
    key: 'lastSeen',
    header: 'Last seen',
    className: 'w-24 whitespace-nowrap',
    render: (g) => (
      <span className="text-xs text-muted" title={formatAbsolute(g.lastSeen)}>
        {relativeTime(g.lastSeen)}
      </span>
    ),
  },
  {
    key: 'endpoint',
    header: 'Endpoint',
    className: 'min-w-[180px]',
    render: (g) => (
      <div className="flex items-center gap-2">
        <Badge variant="destructive">{g.statusCode}</Badge>
        <span className="font-mono text-xs text-primary truncate max-w-[220px]" title={g.route}>
          {g.route}
        </span>
      </div>
    ),
  },
  {
    key: 'code',
    header: 'Code',
    className: 'w-28',
    render: (g) => (g.code ? <Badge variant="warning">{g.code}</Badge> : <span className="text-xs text-muted">—</span>),
  },
  {
    key: 'message',
    header: 'Message',
    render: (g) => (
      <div className="flex items-center gap-2">
        {g.status !== 'open' && (
          <Badge variant={STATUS_VARIANT[g.status]}>{g.status}</Badge>
        )}
        <span className="text-muted truncate max-w-[420px]" title={g.sampleMessage}>
          {g.sampleMessage}
        </span>
      </div>
    ),
  },
];

export function Technical() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ErrorGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ErrorSort>('count');
  const [status, setStatus] = useState<ErrorStatusFilter>('open');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const [summary, setSummary] = useState<ErrorSummary | null>(null);

  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeChoice, setPurgeChoice] = useState('resolved');
  const [purging, setPurging] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchErrorGroups({ page, sort, status, q: query || undefined })
      .then((data) => {
        setGroups(data.groups);
        setTotal(data.total);
      })
      .catch(() => toast('Failed to load errors', 'error'))
      .finally(() => setLoading(false));
  }, [page, sort, status, query, toast]);

  const loadSummary = useCallback(() => {
    fetchErrorSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(search.trim());
    setPage(1);
  }

  async function runPurge() {
    setPurging(true);
    try {
      const body =
        purgeChoice === 'all'
          ? { all: true }
          : purgeChoice === 'resolved' || purgeChoice === 'ignored'
            ? { status: purgeChoice as 'resolved' | 'ignored' }
            : { olderThanDays: Number(purgeChoice) };
      const res = await purgeErrors(body);
      toast(`Garbage-collected ${res.deletedEvents.toLocaleString()} error${res.deletedEvents === 1 ? '' : 's'}`, 'success');
      setPurgeOpen(false);
      setPage(1);
      load();
      loadSummary();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Purge failed', 'error');
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Technical</h1>
          <p className="text-sm text-muted mt-1">
            {summary
              ? `${summary.openGroups.toLocaleString()} open ${summary.openGroups === 1 ? 'group' : 'groups'} · ${summary.events24h.toLocaleString()} in last 24h · ${summary.totalEvents.toLocaleString()} total · kept ${summary.retentionDays}d`
              : 'Captured server errors from the web feature sets'}
          </p>
        </div>
        <Button variant="destructive" onClick={() => setPurgeOpen(true)}>
          Garbage collect
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Select
            label="Sort by"
            value={sort}
            onChange={(e) => resetToFirstPage(setSort)(e.target.value as ErrorSort)}
            options={SORT_OPTIONS}
          />
        </div>
        <div className="w-44">
          <Select
            label="Status"
            value={status}
            onChange={(e) => resetToFirstPage(setStatus)(e.target.value as ErrorStatusFilter)}
            options={STATUS_OPTIONS}
          />
        </div>
        <form onSubmit={submitSearch} className="flex-1 min-w-[220px]">
          <Input
            label="Search message"
            placeholder="e.g. timeout, 403, unavailable"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      <Card padding={false}>
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-primary">
            Error groups {total > 0 && <span className="text-muted font-normal">({total.toLocaleString()})</span>}
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : (
          <Table
            columns={columns}
            data={groups}
            rowKey={(g) => g.fingerprint}
            onRowClick={(g) => navigate(`/admin/technical/${g.fingerprint}`)}
            emptyMessage="No errors captured. Nice."
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        )}
      </Card>

      <Modal
        open={purgeOpen}
        onClose={() => setPurgeOpen(false)}
        title="Garbage collect errors"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPurgeOpen(false)} disabled={purging}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={runPurge} disabled={purging}>
              {purging ? 'Purging…' : 'Purge'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Permanently delete captured errors. This cannot be undone.
          </p>
          <Select
            label="What to purge"
            value={purgeChoice}
            onChange={(e) => setPurgeChoice(e.target.value)}
            options={PURGE_OPTIONS}
          />
        </div>
      </Modal>
    </div>
  );
}
