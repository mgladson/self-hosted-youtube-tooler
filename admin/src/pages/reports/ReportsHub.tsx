import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { DollarSign, Receipt } from '@/lib/icons';
import { getOrders } from '@/lib/mock-data';
import { formatPrice } from '@/lib/utils';
import { Link } from 'react-router-dom';

type ReportCardProps = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  href: string;
};

function ReportCard({ icon: Icon, title, description, metric, metricLabel, href }: ReportCardProps) {
  return (
    <Link to={href} className="block">
      <Card className="hover:border-accent/30 hover:shadow-md transition-all cursor-pointer h-full">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-icon-bg text-accent shrink-0">
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-primary mb-1">{title}</h3>
            <p className="text-xs text-muted mb-3">{description}</p>
            <div className="rounded-lg bg-hover-bg px-3 py-2">
              <p className="text-lg font-bold text-primary">{metric}</p>
              <p className="text-[10px] text-muted uppercase tracking-wide">{metricLabel}</p>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function ReportsHub() {
  const allOrders = getOrders();

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentOrders = allOrders.filter(
      (o) => new Date(o.createdAt) >= thirtyDaysAgo && o.paymentStatus === 'paid',
    );

    const revenue = recentOrders.reduce((s, o) => s + o.total, 0);
    const tax = recentOrders.reduce((s, o) => s + (o.taxAmount || 0), 0);

    return { revenue, tax, orderCount: recentOrders.length };
  }, [allOrders]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Reports</h1>
        <p className="text-sm text-muted mt-1">Financial and tax reporting</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReportCard
          icon={DollarSign}
          title="Finance Reports"
          description="Revenue, profit margins, sales by product, and payment method analysis"
          metric={formatPrice(stats.revenue)}
          metricLabel={`Revenue last 30 days (${stats.orderCount} orders)`}
          href="/admin/reports/finance"
        />
        <ReportCard
          icon={Receipt}
          title="Tax Reports"
          description="Tax collected by jurisdiction and period"
          metric={formatPrice(stats.tax)}
          metricLabel="Tax collected last 30 days"
          href="/admin/reports/tax"
        />
      </div>
    </div>
  );
}
