import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { PeriodSelector } from '@/components/ui/PeriodSelector';
import { MetricCard } from '@/components/analytics/MetricCard';
import { RevenueChart } from '@/components/analytics/RevenueChart';
import { MarginChart } from '@/components/analytics/MarginChart';
import { DollarSign, ShoppingBag, Percent, TrendingUp, TrendingDown } from '@/lib/icons';
import { getOrders } from '@/lib/mock-data';
import { formatPrice } from '@/lib/utils';
import {
  TIME_PERIODS,
  getChartData,
  getMarginChartData,
  getPeriodComparison,
  formatCompactPrice,
} from '@/lib/analytics';

const granularityLabels = { day: 'Daily', week: 'Weekly', month: 'Monthly' } as const;

export function AnalyticsOverview() {
  const [activePeriod, setActivePeriod] = useState('last-30');
  const allOrders = getOrders();
  const period = TIME_PERIODS.find((p) => p.key === activePeriod)!;
  const [start, end] = period.getDateRange();

  const comparison = useMemo(
    () => getPeriodComparison(allOrders, start, end),
    [allOrders, activePeriod],
  );
  const chart = useMemo(
    () => getChartData(allOrders, start, end),
    [allOrders, activePeriod],
  );
  const marginData = useMemo(
    () => getMarginChartData(allOrders, start, end),
    [allOrders, activePeriod],
  );

  const { current } = comparison;

  return (
    <div>
      <div className="mb-6">
        <PeriodSelector
          periods={TIME_PERIODS.map((p) => ({ key: p.key, label: p.label }))}
          activePeriod={activePeriod}
          onChange={setActivePeriod}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard
          label="Total Revenue"
          value={formatPrice(current.totalRevenue)}
          icon={DollarSign}
          change={{
            value: `${comparison.revenueChange > 0 ? '+' : ''}${comparison.revenueChange}%`,
            positive: comparison.revenueChange >= 0,
          }}
        />
        <MetricCard
          label="Avg Order Value"
          value={formatPrice(current.avgOrderValue)}
          secondaryValue={`${current.orderCount} orders`}
          icon={ShoppingBag}
          change={{
            value: `${comparison.avgOrderChange > 0 ? '+' : ''}${comparison.avgOrderChange}%`,
            positive: comparison.avgOrderChange >= 0,
          }}
        />
        <MetricCard
          label="Gross Margin"
          value={`${current.grossMarginPercent.toFixed(1)}%`}
          secondaryValue={formatPrice(current.grossProfit)}
          icon={Percent}
          change={{
            value: `${comparison.marginChange > 0 ? '+' : ''}${comparison.marginChange}pp`,
            positive: comparison.marginChange >= 0,
          }}
        />
        <MetricCard
          label="Net Margin"
          value={`${current.netMarginPercent.toFixed(1)}%`}
          secondaryValue={formatPrice(current.netProfit)}
          icon={Percent}
        />
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-primary">Revenue Over Time</h2>
          <span className="text-xs text-muted bg-gray-100 px-2 py-1 rounded">
            {granularityLabels[chart.granularity]}
          </span>
        </div>
        <RevenueChart data={chart.data} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="font-semibold text-primary mb-4">Profit Margins</h2>
          <MarginChart data={marginData} />
        </Card>

        <Card>
          <h2 className="font-semibold text-primary mb-4">Period Summary</h2>
          <div className="space-y-0">
            {[
              { label: 'Total Revenue', value: formatPrice(current.totalRevenue) },
              { label: 'Total Orders', value: String(current.orderCount) },
              { label: 'Avg Order Value', value: formatPrice(current.avgOrderValue) },
              { label: 'Avg Daily Revenue', value: formatPrice(current.avgDailyRevenue) },
              { label: 'COGS', value: formatPrice(current.totalCost) },
              { label: 'Gross Profit', value: `${formatPrice(current.grossProfit)} (${current.grossMarginPercent.toFixed(1)}%)` },
              { label: 'Operating Expenses', value: formatPrice(current.operatingExpenses) },
              { label: 'Net Profit', value: `${formatPrice(current.netProfit)} (${current.netMarginPercent.toFixed(1)}%)` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <span className="text-sm text-muted">{row.label}</span>
                <span className="text-sm font-medium text-primary">{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-primary mb-4">vs Previous Period</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Revenue', value: `${comparison.revenueChange > 0 ? '+' : ''}${comparison.revenueChange}%`, positive: comparison.revenueChange >= 0, detail: `${formatCompactPrice(comparison.previous.totalRevenue)} → ${formatCompactPrice(comparison.current.totalRevenue)}` },
            { label: 'Orders', value: `${comparison.orderCountChange > 0 ? '+' : ''}${comparison.orderCountChange}%`, positive: comparison.orderCountChange >= 0, detail: `${comparison.previous.orderCount} → ${comparison.current.orderCount}` },
            { label: 'Avg Order', value: `${comparison.avgOrderChange > 0 ? '+' : ''}${comparison.avgOrderChange}%`, positive: comparison.avgOrderChange >= 0, detail: `${formatCompactPrice(comparison.previous.avgOrderValue)} → ${formatCompactPrice(comparison.current.avgOrderValue)}` },
            { label: 'Gross Margin', value: `${comparison.marginChange > 0 ? '+' : ''}${comparison.marginChange}pp`, positive: comparison.marginChange >= 0, detail: `${comparison.previous.grossMarginPercent.toFixed(1)}% → ${comparison.current.grossMarginPercent.toFixed(1)}%` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted mb-1">{item.label}</p>
              <div className="flex items-center gap-1.5 mb-1">
                {item.positive ? (
                  <TrendingUp size={16} className="text-emerald-600" />
                ) : (
                  <TrendingDown size={16} className="text-red-500" />
                )}
                <span className={`text-lg font-bold ${item.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {item.value}
                </span>
              </div>
              <p className="text-xs text-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
