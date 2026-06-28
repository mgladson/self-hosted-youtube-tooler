import { useEffect, useMemo } from 'react';
import { useBlocker } from 'react-router-dom';
import {
  getOrders,
  getProducts,
  getCustomers,
  type Order,
  type Product,
  type Customer,
} from './mock-data';

export type OrderFilters = {
  status?: Order['status'];
  paymentStatus?: Order['paymentStatus'];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ProductFilters = {
  status?: Product['status'];
  category?: string;
  search?: string;
};

export type CustomerFilters = {
  search?: string;
};

export function useOrders(filters?: OrderFilters) {
  return useMemo(() => {
    let list = getOrders();

    if (filters?.status) {
      list = list.filter((o) => o.status === filters.status);
    }
    if (filters?.paymentStatus) {
      list = list.filter((o) => o.paymentStatus === filters.paymentStatus);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q),
      );
    }
    if (filters?.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      list = list.filter((o) => new Date(o.createdAt).getTime() >= from);
    }
    if (filters?.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      list = list.filter((o) => new Date(o.createdAt).getTime() <= to);
    }

    const all = getOrders();
    const pending = all.filter((o) => o.status === 'pending').length;
    const processing = all.filter((o) => o.status === 'processing').length;
    const completed = all.filter((o) => o.status === 'completed').length;
    const refunded = all.filter((o) => o.status === 'refunded').length;

    return {
      orders: list,
      total: list.length,
      pending,
      processing,
      completed,
      refunded,
    };
  }, [filters?.status, filters?.paymentStatus, filters?.search, filters?.dateFrom, filters?.dateTo]);
}

export function useProducts(filters?: ProductFilters) {
  return useMemo(() => {
    let list = getProducts();

    if (filters?.status) {
      list = list.filter((p) => p.status === filters.status);
    }
    if (filters?.category) {
      list = list.filter((p) => p.category === filters.category);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    const all = getProducts();
    const active = all.filter((p) => p.status === 'active').length;
    const drafts = all.filter((p) => p.status === 'draft').length;
    const archived = all.filter((p) => p.status === 'archived').length;

    return {
      products: list,
      total: list.length,
      active,
      drafts,
      archived,
    };
  }, [filters?.status, filters?.category, filters?.search]);
}

export function useCustomers(filters?: CustomerFilters) {
  return useMemo(() => {
    let list = getCustomers();

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (c) => c.email.toLowerCase().includes(q),
      );
    }

    return {
      customers: list,
      total: list.length,
    };
  }, [filters?.search]);
}

// ── Unsaved-changes navigation guard ───────────────────────────────────────
// Blocks the user from abandoning a dirty form. Two layers:
//   1. react-router's `useBlocker` intercepts in-app navigation (sidebar links,
//      Back / Cancel buttons, the browser back button) so the caller can show a
//      confirm dialog driven off the returned blocker's state.
//   2. a `beforeunload` listener covers hard navigations the router never sees
//      (tab close, refresh, off-site links) with the browser's native prompt.
// Pass `when` = true while the form has unsaved edits.
export function useUnsavedChangesGuard(when: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );

  // If the form becomes clean (e.g. saved) while a block is pending, drop it so
  // a stale dialog can't strand the user.
  useEffect(() => {
    if (blocker.state === 'blocked' && !when) {
      blocker.reset();
    }
  }, [blocker, when]);

  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);

  return blocker;
}
