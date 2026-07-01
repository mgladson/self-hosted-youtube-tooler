import { useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home, BarChart3, Package, FolderOpen, ShoppingBag, Users,
  Mail, Megaphone, Settings, LogOut, X, DollarSign, Receipt,
  Percent, ChevronDown, Eye, MousePointer, Headphones, FileText, Rss, History, Shield, BookOpen, Star,
  AlertTriangle,
} from '@/lib/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/lib/hooks';

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

type NavItemDef = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  end?: boolean;
  badge?: number;
};

type NavGroup = {
  label?: string;
  items: NavItemDef[];
  children?: NavItemDef[];
};

function NavItem({ to, label, icon: Icon, end, badge }: NavItemDef) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-white'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white',
        )
      }
    >
      <Icon size={18} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function SubNavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'block rounded-lg py-1.5 pl-10 pr-3 text-sm transition-colors',
          isActive
            ? 'text-white font-medium'
            : 'text-sidebar-foreground/70 hover:text-white',
        )
      }
    >
      {label}
    </NavLink>
  );
}

function CollapsibleGroup({
  icon: Icon,
  label,
  items,
  badge,
  defaultOpen,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  items: { to: string; label: string; end?: boolean }[];
  badge?: number;
  defaultOpen?: boolean;
}) {
  const location = useLocation();
  const isChildActive = items.some((item) => location.pathname.startsWith(item.to));
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('sendburmese:sidebar:collapsed');
      if (stored) {
        const collapsed = JSON.parse(stored) as string[];
        if (collapsed.includes(label)) return false;
      }
    } catch {}
    return defaultOpen || isChildActive;
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        const stored = localStorage.getItem('sendburmese:sidebar:collapsed');
        const collapsed: string[] = stored ? JSON.parse(stored) : [];
        if (next) {
          const idx = collapsed.indexOf(label);
          if (idx !== -1) collapsed.splice(idx, 1);
        } else {
          if (!collapsed.includes(label)) collapsed.push(label);
        }
        localStorage.setItem('sendburmese:sidebar:collapsed', JSON.stringify(collapsed));
      } catch {}
      return next;
    });
  }, [label]);

  return (
    <div>
      <button
        onClick={toggle}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isChildActive
            ? 'text-white'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white',
        )}
      >
        <Icon size={18} />
        <span className="flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white min-w-[20px] text-center">
            {badge}
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn('transition-transform', open ? 'rotate-0' : '-rotate-90')}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <SubNavItem key={item.to} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { pending, processing } = useOrders();
  const orderBadge = pending + processing;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar lg:static lg:z-auto',
          'transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white text-sm font-bold">
              P
            </div>
            <div>
              <span className="text-sm font-semibold text-white">PixelCart</span>
              <span className="block text-[10px] text-sidebar-muted uppercase tracking-wider">Admin</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
          <NavItem to="/admin" label="Dashboard" icon={Home} end />

          <CollapsibleGroup
            icon={ShoppingBag}
            label="Orders"
            badge={orderBadge}
            defaultOpen
            items={[
              { to: '/admin/orders', label: 'All Orders', end: true },
            ]}
          />

          <CollapsibleGroup
            icon={Package}
            label="Products"
            defaultOpen
            items={[
              { to: '/admin/products', label: 'All Products', end: true },
              { to: '/admin/collections', label: 'Collections' },
            ]}
          />

          <CollapsibleGroup
            icon={Users}
            label="Customers"
            items={[
              { to: '/admin/customers', label: 'All Customers', end: true },
              { to: '/admin/customers/segments', label: 'Segments' },
            ]}
          />

          <NavItem to="/admin/discounts" label="Discounts" icon={Percent} />
          <NavItem to="/admin/analytics" label="Analytics" icon={BarChart3} />
          <NavItem to="/admin/insights" label="User Insights" icon={MousePointer} />
          <NavItem to="/admin/subscriptions" label="Subscriptions" icon={DollarSign} />

          <div className="my-3 border-t border-sidebar-border" />

          <NavItem to="/admin/email" label="Email" icon={Mail} />
          <NavItem to="/admin/banner" label="Banner" icon={Megaphone} />
          <NavItem to="/admin/ads" label="Advertising" icon={Eye} />
          <NavItem to="/admin/pages" label="Pages" icon={FileText} />
          <NavItem to="/admin/invoices" label="Invoices" icon={Receipt} />
          <NavItem to="/admin/blog" label="Blog" icon={BookOpen} />
          <NavItem to="/admin/reviews" label="Reviews" icon={Star} />
          <NavItem to="/admin/support" label="Support" icon={Headphones} />
          <NavItem to="/admin/newsletter" label="Newsletter" icon={Rss} />
          <NavItem to="/admin/customer-leads" label="Customer Leads" icon={Users} />

          <div className="my-3 border-t border-sidebar-border" />

          <CollapsibleGroup
            icon={DollarSign}
            label="Reports"
            items={[
              { to: '/admin/reports', label: 'Overview', end: true },
              { to: '/admin/reports/finance', label: 'Finance Reports' },
              { to: '/admin/reports/tax', label: 'Tax Reports' },
            ]}
          />

          <div className="my-3 border-t border-sidebar-border" />

          <NavItem to="/admin/security" label="Security" icon={Shield} />
          <NavItem to="/admin/technical" label="Technical" icon={AlertTriangle} />
          <NavItem to="/admin/settings" label="Settings" icon={Settings} />
          <NavItem to="/admin/audit-log" label="Audit Log" icon={History} />
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Admin"
              className="h-8 w-8 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-sidebar-muted truncate">{user?.email || ''}</p>
            </div>
            <button onClick={logout} className="p-1 rounded-lg hover:bg-sidebar-accent text-sidebar-muted">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
