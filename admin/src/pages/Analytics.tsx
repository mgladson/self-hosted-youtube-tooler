import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';

export function Analytics() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Analytics</h1>
        <p className="text-sm text-muted mt-1">Revenue metrics and financial performance</p>
      </div>

      <AnalyticsOverview />
    </div>
  );
}
