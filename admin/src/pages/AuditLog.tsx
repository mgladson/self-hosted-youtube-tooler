import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Table, type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { fetchAuditLogs, fetchGithubCommits, type AuditLogEntry, type GitCommit } from '@/lib/api';

const PAGE_SIZE = 50;

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All activity' },
  { value: 'banner', label: 'Banner' },
  { value: 'page', label: 'Pages' },
  { value: 'support_ticket', label: 'Support tickets' },
  { value: 'email_campaign', label: 'Email campaigns' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'subscriber', label: 'Subscribers' },
];

const ACTION_VARIANT: Record<string, 'accent' | 'success' | 'destructive' | 'warning'> = {
  update: 'accent',
  create: 'success',
  delete: 'destructive',
  send: 'warning',
};

const RESOURCE_LABELS: Record<string, string> = {
  banner: 'Banner',
  page: 'Page',
  support_ticket: 'Support',
  email_campaign: 'Email',
  newsletter: 'Newsletter',
  subscriber: 'Subscriber',
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

const auditColumns: Column<AuditLogEntry>[] = [
  {
    key: 'when',
    header: 'When',
    className: 'w-24 whitespace-nowrap',
    render: (e) => (
      <span className="text-xs text-muted" title={formatAbsolute(e.createdAt)}>
        {relativeTime(e.createdAt)}
      </span>
    ),
  },
  {
    key: 'who',
    header: 'Who',
    className: 'min-w-[160px]',
    render: (e) => (
      <div>
        <p className="font-medium text-primary">{e.userName}</p>
        <p className="text-xs text-muted">{e.userEmail}</p>
      </div>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    className: 'w-28',
    render: (e) => (
      <div className="flex items-center gap-2">
        <Badge variant={ACTION_VARIANT[e.action] ?? 'accent'}>{e.action}</Badge>
        <span className="text-xs text-muted hidden lg:inline">
          {RESOURCE_LABELS[e.resourceType] ?? e.resourceType}
          {e.resourceId ? ` #${e.resourceId}` : ''}
        </span>
      </div>
    ),
  },
  {
    key: 'summary',
    header: 'Summary',
    render: (e) => <span className="text-muted">{e.summary}</span>,
  },
];

const commitColumns: Column<GitCommit>[] = [
  {
    key: 'when',
    header: 'When',
    className: 'w-24 whitespace-nowrap',
    render: (c) => (
      <span className="text-xs text-muted" title={formatAbsolute(c.date)}>
        {relativeTime(c.date)}
      </span>
    ),
  },
  {
    key: 'sha',
    header: 'Commit',
    className: 'w-20',
    render: (c) => (
      <a
        href={c.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-accent hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {c.shortSha}
      </a>
    ),
  },
  {
    key: 'author',
    header: 'Author',
    className: 'w-36',
    render: (c) => <span className="text-sm">{c.authorName}</span>,
  },
  {
    key: 'message',
    header: 'Message',
    render: (c) => <span className="text-muted">{c.message}</span>,
  },
];

const githubRepo = import.meta.env.VITE_GITHUB_REPO as string | undefined;

export function AuditLog() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [resourceType, setResourceType] = useState('');

  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(!!githubRepo);

  const loadLogs = useCallback(() => {
    setLoading(true);
    fetchAuditLogs(page, resourceType || undefined)
      .then((data) => {
        setLogs(data.logs);
        setTotal(data.total);
      })
      .catch(() => {
        toast('Failed to load audit log', 'error');
      })
      .finally(() => setLoading(false));
  }, [page, resourceType, toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!githubRepo) return;
    setCommitsLoading(true);
    fetchGithubCommits()
      .then(setCommits)
      .catch(() => {})
      .finally(() => setCommitsLoading(false));
  }, []);

  function handleFilterChange(value: string) {
    setResourceType(value);
    setPage(1);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Audit Log</h1>
          <p className="text-sm text-muted mt-1">
            {total > 0 ? `${total} admin event${total !== 1 ? 's' : ''} recorded` : 'No events recorded yet'}
          </p>
        </div>
        <div className="w-48">
          <Select
            value={resourceType}
            onChange={(e) => handleFilterChange(e.target.value)}
            options={RESOURCE_TYPE_OPTIONS}
          />
        </div>
      </div>

      <Card padding={false}>
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-primary">Admin Activity</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : (
          <Table
            columns={auditColumns}
            data={logs}
            rowKey={(e) => String(e.id)}
            emptyMessage="No activity found."
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        )}
      </Card>

      {githubRepo && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-primary">Recent Commits</h2>
            <a
              href={`https://github.com/${githubRepo}/commits`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              View on GitHub
            </a>
          </div>
          {commitsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : (
            <Table
              columns={commitColumns}
              data={commits}
              rowKey={(c) => c.sha}
              emptyMessage="No commits found or GitHub repo not reachable."
            />
          )}
        </Card>
      )}
    </div>
  );
}
