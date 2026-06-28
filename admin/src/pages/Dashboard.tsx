import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PeriodSelector } from '@/components/ui/PeriodSelector';
import { Table, type Column } from '@/components/ui/Table';
import { DollarSign, ShoppingBag, Users, ExternalLink, Plus, BarChart3 } from '@/lib/icons';
import { useOrders, useProducts } from '@/lib/hooks';
import { getOrders, type Order } from '@/lib/mock-data';
import { formatPrice, formatDate, formatNumber } from '@/lib/utils';
import { getChartData } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { RevenueChart } from '@/components/analytics/RevenueChart';

const statusVariant: Record<string, 'success' | 'warning' | 'accent' | 'destructive'> = {
  completed: 'success',
  processing: 'accent',
  pending: 'warning',
  refunded: 'destructive',
};

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
    key: 'total',
    header: 'Total',
    render: (o) => formatPrice(o.total),
  },
  {
    key: 'status',
    header: 'Status',
    render: (o) => (
      <Badge variant={statusVariant[o.status]}>
        {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'date',
    header: 'Date',
    render: (o) => <span className="text-muted">{formatDate(o.createdAt)}</span>,
  },
];

const periods = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: '12m', label: 'Last 12 months' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getPeriodDates(key: string): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const to = new Date();
  const from = new Date();
  const days = key === '7d' ? 7 : key === '30d' ? 30 : key === '90d' ? 90 : 365;
  from.setDate(to.getDate() - days);
  const prevTo = new Date(from);
  const prevFrom = new Date(from);
  prevFrom.setDate(prevTo.getDate() - days);
  return { from, to, prevFrom, prevTo };
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState('30d');
  const { pending, processing } = useOrders();
  const { drafts } = useProducts();

  const allOrders = getOrders();
  const recentOrders = allOrders.slice(0, 5);

  const stats = useMemo(() => {
    const { from, to, prevFrom, prevTo } = getPeriodDates(period);

    const inPeriod = allOrders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= from && d <= to;
    });
    const inPrev = allOrders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= prevFrom && d <= prevTo;
    });

    const revenue = inPeriod.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);
    const prevRevenue = inPrev.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);

    const orderCount = inPeriod.length;
    const prevOrderCount = inPrev.length;

    const avgOrder = orderCount > 0 ? Math.round(revenue / orderCount) : 0;
    const prevAvgOrder = prevOrderCount > 0 ? Math.round(prevRevenue / prevOrderCount) : 0;

    const uniqueCustomers = new Set(inPeriod.map((o) => o.customerEmail)).size;
    const prevUniqueCustomers = new Set(inPrev.map((o) => o.customerEmail)).size;

    function pctChange(cur: number, prev: number): { value: string; positive: boolean } {
      if (prev === 0) return { value: cur > 0 ? '+100%' : '0%', positive: cur >= 0 };
      const pct = ((cur - prev) / prev) * 100;
      return { value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, positive: pct >= 0 };
    }

    return {
      revenue,
      revenueTrend: pctChange(revenue, prevRevenue),
      orderCount,
      ordersTrend: pctChange(orderCount, prevOrderCount),
      avgOrder,
      avgOrderTrend: pctChange(avgOrder, prevAvgOrder),
      uniqueCustomers,
      customersTrend: pctChange(uniqueCustomers, prevUniqueCustomers),
    };
  }, [allOrders, period]);

  const chartData = useMemo(() => {
    const { from, to } = getPeriodDates(period);
    return getChartData(allOrders, from, to).data;
  }, [allOrders, period]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">
          {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-muted mt-1">Here&apos;s what&apos;s happening with your store.</p>
      </div>

      <div className="mb-6">
        <PeriodSelector periods={periods} activePeriod={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total Sales"
          value={formatPrice(stats.revenue)}
          icon={DollarSign}
          trend={stats.revenueTrend}
        />
        <StatCard
          label="Total Orders"
          value={formatNumber(stats.orderCount)}
          icon={ShoppingBag}
          trend={stats.ordersTrend}
        />
        <StatCard
          label="Avg Order Value"
          value={formatPrice(stats.avgOrder)}
          icon={BarChart3}
          trend={stats.avgOrderTrend}
        />
        <StatCard
          label="Customers"
          value={formatNumber(stats.uniqueCustomers)}
          icon={Users}
          trend={stats.customersTrend}
        />
      </div>

      <Card padding={false} className="mb-8">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-primary">Sales Over Time</h2>
        </div>
        <div className="p-4">
          <RevenueChart data={chartData} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-primary">Recent Orders</h2>
              <Button variant="ghost" size="sm" href="/admin/orders">
                View all
              </Button>
            </div>
            <Table
              columns={columns}
              data={recentOrders}
              rowKey={(o) => o.id}
              onRowClick={() => navigate('/admin/orders')}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <ActivityFeed
            pendingOrders={pending}
            processingOrders={processing}
            draftProducts={drafts}
          />
          <Card>
            <h2 className="font-semibold text-primary mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button variant="primary" className="w-full justify-start" href="/admin/products/new">
                <Plus size={16} />
                Add Product
              </Button>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-hover-bg transition-colors"
              >
                <ExternalLink size={16} />
                View Storefront
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
