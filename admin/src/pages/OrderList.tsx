import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, type Column, type SortDirection } from '@/components/ui/Table';
import { BulkActionsBar } from '@/components/ui/BulkActionsBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { OrderMetricsBar } from '@/components/orders/OrderMetricsBar';
import { Download, ShoppingBag } from '@/lib/icons';
import { useOrders } from '@/lib/hooks';
import { type Order } from '@/lib/mock-data';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import { downloadCSV, centsToDollars, formatISODate } from '@/lib/csv';

const statusVariant: Record<string, 'success' | 'warning' | 'accent' | 'destructive'> = {
  completed: 'success',
  processing: 'accent',
  pending: 'warning',
  refunded: 'destructive',
};

const paymentVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
  paid: 'success',
  pending: 'warning',
  refunded: 'destructive',
};

const tabs = ['All', 'Pending', 'Processing', 'Completed', 'Refunded'] as const;
const PAGE_SIZE = 25;

const columns: Column<Order>[] = [
  {
    key: 'order',
    header: 'Order',
    render: (o) => <span className="font-medium">{o.orderNumber}</span>,
  },
  {
    key: 'customer',
    header: 'Customer',
    render: (o) => (
      <div>
        <p className="font-medium">{o.customerName}</p>
        <p className="text-xs text-muted">{o.customerEmail}</p>
      </div>
    ),
  },
  {
    key: 'items',
    header: 'Items',
    render: (o) => <span className="text-muted">{o.items.length} item{o.items.length !== 1 ? 's' : ''}</span>,
  },
  {
    key: 'total',
    header: 'Total',
    sortable: true,
    sortValue: (o) => o.total,
    render: (o) => <span className="font-medium">{formatPrice(o.total)}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    sortValue: (o) => o.status,
    render: (o) => (
      <Badge variant={statusVariant[o.status]}>
        {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'payment',
    header: 'Payment',
    render: (o) => (
      <Badge variant={paymentVariant[o.paymentStatus]}>
        {o.paymentStatus.charAt(0).toUpperCase() + o.paymentStatus.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'fulfillment',
    header: 'Fulfillment',
    render: (o) => (
      <Badge variant={o.status === 'completed' ? 'success' : 'warning'}>
        {o.status === 'completed' ? 'Delivered' : 'Pending'}
      </Badge>
    ),
  },
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    sortValue: (o) => new Date(o.createdAt).getTime(),
    render: (o) => <span className="text-muted">{formatDate(o.createdAt)}</span>,
  },
];

export function OrderList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(
    () => new Set(columns.map((c) => c.key)),
  );

  const statusFilter = activeTab === 'All' ? undefined : activeTab.toLowerCase() as Order['status'];
  const { orders: allFiltered, total: allTotal, pending, processing, completed } = useOrders(
    statusFilter ? { status: statusFilter } : undefined,
  );
  const { orders: allOrders } = useOrders();

  const revenue = useMemo(
    () => allOrders.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0),
    [allOrders],
  );

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return allFiltered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return allFiltered;
    const list = [...allFiltered];
    list.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [allFiltered, sortKey, sortDir]);

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
    setSelectedIds([]);
  }, []);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    setSelectedIds([]);
  }, []);

  const filteredColumns = useMemo(
    () => columns.filter((c) => visibleKeys.has(c.key)),
    [visibleKeys],
  );

  if (allOrders.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Orders</h1>
          <p className="text-sm text-muted mt-1">Manage customer orders</p>
        </div>
        <Card>
          <EmptyState
            icon={ShoppingBag}
            heading="No orders yet"
            description="When customers place orders, they'll appear here."
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Orders</h1>
          <p className="text-sm text-muted mt-1">Manage customer orders</p>
        </div>
        <div className="flex items-center gap-2">
        <ColumnToggle columns={columns} visibleKeys={visibleKeys} onChange={setVisibleKeys} />
        <Button variant="outline" size="sm" onClick={() => {
          downloadCSV('orders.csv', [
            { key: 'order', header: 'Order Number', value: (o: Order) => o.orderNumber },
            { key: 'date', header: 'Date', value: (o: Order) => formatISODate(o.createdAt) },
            { key: 'customer', header: 'Customer', value: (o: Order) => o.customerName },
            { key: 'email', header: 'Email', value: (o: Order) => o.customerEmail },
            { key: 'items', header: 'Items', value: (o: Order) => o.items.length },
            { key: 'subtotal', header: 'Subtotal (USD)', value: (o: Order) => centsToDollars(o.items.reduce((s, it) => s + it.price, 0)) },
            { key: 'tax', header: 'Tax (USD)', value: (o: Order) => centsToDollars(o.taxAmount || 0) },
            { key: 'total', header: 'Total (USD)', value: (o: Order) => centsToDollars(o.total) },
            { key: 'status', header: 'Status', value: (o: Order) => o.status },
            { key: 'payment', header: 'Payment Status', value: (o: Order) => o.paymentStatus },
          ], allFiltered);
        }}>
          <Download size={14} />
          Export CSV
        </Button>
        </div>
      </div>

      <OrderMetricsBar
        total={allOrders.length}
        pending={pending}
        completed={completed}
        revenue={revenue}
      />

      <BulkActionsBar
        selectedIds={selectedIds}
        actions={[
          { label: 'Export selected', onClick: () => {} },
        ]}
        onClear={() => setSelectedIds([])}
      />

      <Card padding={false}>
        <div className="flex border-b border-border">
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
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({tab === 'All'
                  ? allOrders.length
                  : tab === 'Pending' ? pending
                  : tab === 'Processing' ? processing
                  : tab === 'Completed' ? completed
                  : allOrders.filter((o) => o.status === 'refunded').length})
              </span>
            </button>
          ))}
        </div>

        <Table
          columns={filteredColumns}
          data={paged}
          rowKey={(o) => o.id}
          onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
          emptyMessage={`No ${activeTab.toLowerCase()} orders`}
          selectable
          onSelectionChange={setSelectedIds}
          sortKey={sortKey}
          sortDirection={sortDir}
          onSortChange={handleSortChange}
          page={page}
          pageSize={PAGE_SIZE}
          total={allFiltered.length}
          onPageChange={handlePageChange}
        />
      </Card>
    </div>
  );
}
