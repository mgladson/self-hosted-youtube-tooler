import { Card } from '@/components/ui/Card';
import { TrendingUp, TrendingDown } from '@/lib/icons';

type MetricCardProps = {
  label: string;
  value: string;
  secondaryValue?: string;
  change?: { value: string; positive: boolean };
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

export function MetricCard({ label, value, secondaryValue, change, icon: Icon }: MetricCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted mb-1">{label}</p>
          <p className="text-2xl font-bold text-primary">{value}</p>
          {secondaryValue && (
            <p className="text-sm text-muted mt-0.5">{secondaryValue}</p>
          )}
        </div>
        <div className="rounded-lg bg-icon-bg p-2.5 shrink-0">
          <Icon size={20} className="text-accent" />
        </div>
      </div>
      {change && (
        <div className="mt-3 flex items-center gap-1">
          {change.positive ? (
            <TrendingUp size={14} className="text-emerald-600" />
          ) : (
            <TrendingDown size={14} className="text-red-500" />
          )}
          <span className={`text-xs font-medium ${change.positive ? 'text-emerald-600' : 'text-red-500'}`}>
            {change.value}
          </span>
          <span className="text-xs text-muted">vs prev period</span>
        </div>
      )}
    </Card>
  );
}
