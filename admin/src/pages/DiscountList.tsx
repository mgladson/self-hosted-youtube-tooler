import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, type Column, type SortDirection } from '@/components/ui/Table';
import { BulkActionsBar } from '@/components/ui/BulkActionsBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Plus, Search, Percent } from '@/lib/icons';
import { getDiscounts, type Discount } from '@/lib/mock-data';
import { formatPrice, formatDate, cn } from '@/lib/utils';

const PAGE_SIZE = 25;

function discountStatus(d: Discount): 'Active' | 'Expired' | 'Scheduled' | 'Inactive' {
  const now = new Date();
  if (!d.active) return 'Inactive';
  if (d.endsAt && new Date(d.endsAt) < now) return 'Expired';
  if (new Date(d.startsAt) > now) return 'Scheduled';
  if (d.maxUses && d.currentUses >= d.maxUses) return 'Expired';
  return 'Active';
}

const statusVariant: Record<string, 'success' | 'warning' | 'default' | 'accent'> = {
  Active: 'success',
  Expired: 'default',
  Scheduled: 'accent',
  Inactive: 'warning',
};

const tabs = ['All', 'Active', 'Expired', 'Scheduled'] as const;

const columns: Column<Discount>[] = [
  {
    key: 'code',
    header: 'Code',
    render: (d) => <span className="font-mono font-medium">{d.code}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    render: (d) => (
      <Badge variant="default">
        {d.type === 'percentage' ? 'Percentage' : 'Fixed'}
      </Badge>
    ),
  },
  {
    key: 'value',
    header: 'Value',
    sortable: true,
    sortValue: (d) => d.value,
    render: (d) => (
      <span className="font-medium">
        {d.type === 'percentage' ? `${d.value}%` : formatPrice(d.value)}
      </span>
    ),
  },
  {
    key: 'usage',
    header: 'Usage',
    render: (d) => (
      <span className="text-muted">
        {d.currentUses}{d.maxUses ? ` / ${d.maxUses}` : ' (unlimited)'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (d) => {
      const s = discountStatus(d);
      return <Badge variant={statusVariant[s]}>{s}</Badge>;
    },
  },
  {
    key: 'dates',
    header: 'Dates',
    sortable: true,
    sortValue: (d) => new Date(d.startsAt).getTime(),
    render: (d) => (
      <span className="text-muted text-xs">
        {formatDate(d.startsAt)}
        {d.endsAt ? ` — ${formatDate(d.endsAt)}` : ' — No end'}
      </span>
    ),
  },
];

export function DiscountList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allDiscounts = getDiscounts();

  const filtered = useMemo(() => {
    let list = allDiscounts;
    if (activeTab !== 'All') {
      list = list.filter((d) => discountStatus(d) === activeTab);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.code.toLowerCase().includes(q));
    }
    return list;
  }, [allDiscounts, activeTab, search]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const list = [...filtered];
    list.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setPage(1);
    setSortKey(undefined);
    setSortDir(null);
    setSelectedIds([]);
  }, []);

  const handleSortChange = useCallback((key: string, dir: SortDirection) => {
    setSortKey(dir ? key : undefined);
    setSortDir(dir);
    setPage(1);
  }, []);

  if (allDiscounts.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Discounts</h1>
          <p className="text-sm text-muted mt-1">Manage discount codes</p>
        </div>
        <Card>
          <EmptyState
            icon={Percent}
            heading="No discounts yet"
            description="Create your first discount code to offer deals to customers."
            actionLabel="Create discount"
            actionHref="/admin/discounts/new"
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 mb-6 text-sm text-yellow-800">
        Preview — discounts are not yet active in checkout
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Discounts</h1>
          <p className="text-sm text-muted mt-1">Manage discount codes</p>
        </div>
        <Button href="/admin/discounts/new">
          <Plus size={16} />
          Create discount
        </Button>
      </div>

      <BulkActionsBar
        selectedIds={selectedIds}
        actions={[{ label: 'Delete', onClick: () => {}, variant: 'destructive' }]}
        onClear={() => setSelectedIds([])}
      />

      <Card padding={false}>
        <div className="flex items-center justify-between border-b border-border">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-primary hover:border-border',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pr-4">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
              <Search size={14} className="text-muted" />
              <input
                type="text"
                placeholder="Search codes..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="bg-transparent text-sm text-primary placeholder:text-muted-foreground focus:outline-none w-32"
              />
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          data={paged}
          rowKey={(d) => d.id}
          onRowClick={(d) => navigate(`/admin/discounts/${d.id}`)}
          emptyMessage="No discounts found"
          selectable
          onSelectionChange={setSelectedIds}
          sortKey={sortKey}
          sortDirection={sortDir}
          onSortChange={handleSortChange}
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}
