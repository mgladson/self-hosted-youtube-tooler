import { formatPrice, formatNumber } from '@/lib/utils';

type OrderMetricsBarProps = {
  total: number;
  pending: number;
  completed: number;
  revenue: number;
};

export function OrderMetricsBar({ total, pending, completed, revenue }: OrderMetricsBarProps) {
  const avg = total > 0 ? Math.round(revenue / total) : 0;

  const metrics = [
    { label: 'Total Orders', value: formatNumber(total) },
    { label: 'Pending', value: formatNumber(pending) },
    { label: 'Completed', value: formatNumber(completed) },
    { label: 'Revenue', value: formatPrice(revenue) },
    { label: 'Avg Order', value: formatPrice(avg) },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto mb-6">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex-1 min-w-[140px] rounded-lg border border-border bg-surface px-4 py-3"
        >
          <p className="text-xs text-muted mb-1">{m.label}</p>
          <p className="text-lg font-semibold text-primary">{m.value}</p>
        </div>
      ))}
    </div>
  );
}
