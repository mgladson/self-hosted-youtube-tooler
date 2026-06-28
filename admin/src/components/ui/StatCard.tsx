import { Card } from './Card';
import { TrendingUp } from '@/lib/icons';

type StatCardProps = {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: { value: string; positive: boolean };
};

export function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted mb-1">{label}</p>
          <p className="text-2xl font-bold text-primary">{value}</p>
        </div>
        <div className="rounded-lg bg-icon-bg p-2.5">
          <Icon size={20} className="text-accent" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          <TrendingUp size={14} className={trend.positive ? 'text-emerald-600' : 'text-red-500'} />
          <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.value}
          </span>
          <span className="text-xs text-muted">vs last month</span>
        </div>
      )}
    </Card>
  );
}
