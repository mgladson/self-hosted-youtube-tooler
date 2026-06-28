import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, type Column } from '@/components/ui/Table';
import { BulkActionsBar } from '@/components/ui/BulkActionsBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, Download, Users } from '@/lib/icons';
import { useCustomers } from '@/lib/hooks';
import { type Customer } from '@/lib/mock-data';
import { formatPrice, formatDate } from '@/lib/utils';
import { downloadCSV, centsToDollars, formatISODate } from '@/lib/csv';

const PAGE_SIZE = 25;

const columns: Column<Customer>[] = [
  {
    key: 'customer',
    header: 'Customer',
    render: (c) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-icon-bg text-xs font-medium text-accent">
          {c.email.charAt(0).toUpperCase()}
        </div>
        <p className="font-medium">{c.email}</p>
      </div>
    ),
  },
  {
    key: 'orders',
    header: 'Orders',
    render: (c) => c.totalOrders,
  },
  {
    key: 'spent',
    header: 'Total Spent',
    render: (c) => <span className="font-medium">{formatPrice(c.totalSpent)}</span>,
  },
  {
    key: 'joined',
    header: 'Joined',
    render: (c) => <span className="text-muted">{formatDate(c.createdAt)}</span>,
  },
  {
    key: 'lastOrder',
    header: 'Last Order',
    render: (c) => <span className="text-muted">{formatDate(c.lastOrderAt)}</span>,
  },
];

export function CustomerList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { customers: filtered, total } = useCustomers(search ? { search } : undefined);
  const allCount = useCustomers().total;

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  if (allCount === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Customers</h1>
          <p className="text-sm text-muted mt-1">View and manage your customers</p>
        </div>
        <Card>
          <EmptyState
            icon={Users}
            heading="No customers yet"
            description="Customers will appear here after their first purchase."
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Customers</h1>
          <p className="text-sm text-muted mt-1">View and manage your customers</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          downloadCSV('customers.csv', [
            { key: 'email', header: 'Email', value: (c: Customer) => c.email },
            { key: 'orders', header: 'Total Orders', value: (c: Customer) => c.totalOrders },
            { key: 'spent', header: 'Total Spent (USD)', value: (c: Customer) => centsToDollars(c.totalSpent) },
            { key: 'joined', header: 'Joined', value: (c: Customer) => formatISODate(c.createdAt) },
            { key: 'lastOrder', header: 'Last Order', value: (c: Customer) => formatISODate(c.lastOrderAt) },
          ], filtered);
        }}>
          <Download size={14} />
          Export CSV
        </Button>
      </div>

      <BulkActionsBar
        selectedIds={selectedIds}
        actions={[{ label: 'Export selected', onClick: () => {} }]}
        onClear={() => setSelectedIds([])}
      />

      <Card padding={false}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 max-w-sm">
            <Search size={16} className="text-muted" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="bg-transparent text-sm text-primary placeholder:text-muted-foreground focus:outline-none flex-1"
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={paged}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/admin/customers/${c.id}`)}
          emptyMessage="No customers found"
          selectable
          onSelectionChange={setSelectedIds}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}
