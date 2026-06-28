import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { ShoppingBag, Clock, Package, ChevronRight } from '@/lib/icons';

type ActivityItem = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  count: number;
  href: string;
  color: string;
};

type ActivityFeedProps = {
  pendingOrders: number;
  processingOrders: number;
  draftProducts: number;
};

export function ActivityFeed({ pendingOrders, processingOrders, draftProducts }: ActivityFeedProps) {
  const items: ActivityItem[] = [
    {
      icon: Clock,
      label: 'orders pending',
      count: pendingOrders,
      href: '/admin/orders',
      color: 'text-yellow-600 bg-yellow-50',
    },
    {
      icon: ShoppingBag,
      label: 'orders processing',
      count: processingOrders,
      href: '/admin/orders',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      icon: Package,
      label: 'products in draft',
      count: draftProducts,
      href: '/admin/products',
      color: 'text-muted bg-kbd-bg',
    },
  ];

  const activeItems = items.filter((i) => i.count > 0);

  return (
    <Card>
      <h2 className="font-semibold text-primary mb-4">Things to do</h2>
      {activeItems.length === 0 ? (
        <p className="text-sm text-muted">You're all caught up!</p>
      ) : (
        <div className="space-y-1">
          {activeItems.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-hover-bg transition-colors group"
            >
              <div className={`rounded-lg p-1.5 ${item.color}`}>
                <item.icon size={16} />
              </div>
              <span className="flex-1 text-sm">
                <span className="font-medium">{item.count}</span>{' '}
                <span className="text-muted">{item.label}</span>
              </span>
              <ChevronRight size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
