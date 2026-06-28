import { UserBehavior } from '@/components/analytics/UserBehavior';

export function UserInsights() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">User Insights</h1>
        <p className="text-sm text-muted mt-1">Page views, sessions, scroll depth, and user behavior</p>
      </div>

      <UserBehavior />
    </div>
  );
}
