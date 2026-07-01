import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { PeriodSelector } from '@/components/ui/PeriodSelector';
import { MetricCard } from '@/components/analytics/MetricCard';
import { Users, DollarSign, TrendingUp, TrendingDown, Percent, Clock } from '@/lib/icons';
import { TIME_PERIODS } from '@/lib/analytics';
import { fetchSubscriptionAnalytics, type SubscriptionAnalytics } from '@/lib/api';

function formatBucket(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Subscriptions() {
  const [activePeriod, setActivePeriod] = useState('last-30');
  const [data, setData] = useState<SubscriptionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const period = TIME_PERIODS.find((p) => p.key === activePeriod)!;
  const [start, end] = useMemo(() => period.getDateRange(), [activePeriod]);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  useEffect(() => {
    setLoading(true);
    fetchSubscriptionAnalytics(startISO, endISO)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [startISO, endISO]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Subscriptions</h1>
        <p className="text-sm text-muted mt-1">
          Supporter plan health: active subscribers, MRR, and churn
        </p>
      </div>

      <div className="mb-6">
        <PeriodSelector
          periods={TIME_PERIODS.map((p) => ({ key: p.key, label: p.label }))}
          activePeriod={activePeriod}
          onChange={setActivePeriod}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted text-sm">Loading subscription data...</div>
      ) : !data ? (
        <div className="py-12 text-center text-muted text-sm">No subscription data available yet.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <MetricCard
              label="Active Supporters"
              value={data.summary.activeSubscribers.toLocaleString()}
              secondaryValue={data.summary.pastDue > 0 ? `${data.summary.pastDue} past due` : undefined}
              icon={Users}
            />
            <MetricCard
              label="Est. MRR"
              value={`$${data.summary.estMrrUsd.toLocaleString()}`}
              secondaryValue="estimated at $10/mo"
              icon={DollarSign}
            />
            <MetricCard
              label="Churn (period)"
              value={`${data.summary.churnRatePct}%`}
              secondaryValue={`${data.summary.canceledInPeriod} cancelled`}
              icon={Percent}
            />
            <MetricCard
              label="New (period)"
              value={data.summary.newInPeriod.toLocaleString()}
              icon={TrendingUp}
            />
            <MetricCard
              label="Cancelled (period)"
              value={data.summary.canceledInPeriod.toLocaleString()}
              icon={TrendingDown}
            />
            <MetricCard
              label="Avg Tenure"
              value={data.summary.avgTenureDays != null ? `${data.summary.avgTenureDays}d` : 'n/a'}
              secondaryValue="cancelled subscribers"
              icon={Clock}
            />
          </div>

          <Card className="mb-6">
            <h2 className="font-semibold text-primary mb-4">New vs Cancelled Over Time</h2>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">No subscription events in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted border-b border-border">
                      <th className="py-2 font-medium">Period</th>
                      <th className="py-2 font-medium text-right">New</th>
                      <th className="py-2 font-medium text-right">Cancelled</th>
                      <th className="py-2 font-medium text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.timeline.map((row) => {
                      const net = row.newSubs - row.canceled;
                      return (
                        <tr key={row.bucket} className="border-b border-border last:border-0">
                          <td className="py-2 text-primary">{formatBucket(row.bucket)}</td>
                          <td className="py-2 text-right text-emerald-600">{row.newSubs}</td>
                          <td className="py-2 text-right text-red-500">{row.canceled}</td>
                          <td className={`py-2 text-right font-medium ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {net > 0 ? '+' : ''}{net}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-4">Recent Cancellations</h2>
            {data.recentCancellations.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">No cancellations recorded yet.</p>
            ) : (
              <div className="space-y-0">
                {data.recentCancellations.map((row, i) => (
                  <div
                    key={`${row.email}-${i}`}
                    className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-primary truncate">{row.email}</span>
                    <span className="text-sm text-muted shrink-0 ml-4">{formatDate(row.canceledAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
