import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ShoppingBag } from '@/lib/icons';
import { useOrders } from '@/lib/hooks';
import { formatPrice } from '@/lib/utils';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { orders, pending, processing } = useOrders();

  const recentOrders = orders.slice(0, 5);
  const hasNotifications = pending + processing > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg hover:bg-hover-bg transition-colors"
      >
        <Bell size={20} className="text-muted" />
        {hasNotifications && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-surface shadow-lg z-50">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-primary">Notifications</h3>
          </div>

          {recentOrders.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={24} className="mx-auto text-muted mb-2" />
              <p className="text-sm text-muted">No notifications</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {pending > 0 && (
                <button
                  onClick={() => { navigate('/admin/orders'); setOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-hover-bg transition-colors text-left border-b border-border"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10 text-amber-600 shrink-0">
                    <ShoppingBag size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary">{pending} pending order{pending !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted">Require attention</p>
                  </div>
                </button>
              )}
              {processing > 0 && (
                <button
                  onClick={() => { navigate('/admin/orders'); setOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-hover-bg transition-colors text-left border-b border-border"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-icon-bg text-accent shrink-0">
                    <ShoppingBag size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary">{processing} processing order{processing !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted">In progress</p>
                  </div>
                </button>
              )}
              {recentOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => { navigate(`/admin/orders/${order.id}`); setOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-hover-bg transition-colors text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kbd-bg text-muted shrink-0">
                    <ShoppingBag size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary truncate">
                      {order.orderNumber} — {order.customerName}
                    </p>
                    <p className="text-xs text-muted">{formatPrice(order.total)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="px-4 py-2 border-t border-border">
            <button
              onClick={() => { navigate('/admin/orders'); setOpen(false); }}
              className="text-xs text-accent hover:text-accent/80 font-medium"
            >
              View all orders
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
