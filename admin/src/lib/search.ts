import { getProducts, getOrders, getCustomers } from './mock-data';

export type SearchResult = {
  type: 'product' | 'order' | 'customer' | 'page';
  id: string;
  label: string;
  sublabel?: string;
  href: string;
};

export type SearchProvider = {
  search(query: string): Promise<SearchResult[]>;
};

const staticPages: SearchResult[] = [
  { type: 'page', id: 'dashboard', label: 'Dashboard', href: '/admin' },
  { type: 'page', id: 'orders', label: 'Orders', href: '/admin/orders' },
  { type: 'page', id: 'products', label: 'Products', href: '/admin/products' },
  { type: 'page', id: 'customers', label: 'Customers', href: '/admin/customers' },
  { type: 'page', id: 'analytics', label: 'Analytics', href: '/admin/analytics' },
  { type: 'page', id: 'settings', label: 'Settings', href: '/admin/settings' },
  { type: 'page', id: 'email', label: 'Email Campaigns', href: '/admin/email' },
  { type: 'page', id: 'banner', label: 'Banner Management', href: '/admin/banner' },
];

export class MockSearchProvider implements SearchProvider {
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    const products = getProducts()
      .filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p): SearchResult => ({
        type: 'product',
        id: p.id,
        label: p.name,
        sublabel: p.category,
        href: `/admin/products/${p.slug}`,
      }));
    results.push(...products);

    const orders = getOrders()
      .filter((o) => o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q))
      .slice(0, 5)
      .map((o): SearchResult => ({
        type: 'order',
        id: o.id,
        label: o.orderNumber,
        sublabel: o.customerName,
        href: `/admin/orders/${o.id}`,
      }));
    results.push(...orders);

    const customers = getCustomers()
      .filter((c) => c.email.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c): SearchResult => ({
        type: 'customer',
        id: c.id,
        label: c.email,
        href: `/admin/customers/${c.id}`,
      }));
    results.push(...customers);

    const pages = staticPages
      .filter((p) => p.label.toLowerCase().includes(q))
      .slice(0, 5);
    results.push(...pages);

    return results;
  }
}

export const searchProvider: SearchProvider = new MockSearchProvider();
