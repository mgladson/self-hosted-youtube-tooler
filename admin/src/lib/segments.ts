import { getCustomers, getOrders, type Customer, type Order } from './mock-data';

export type Segment = {
  id: string;
  name: string;
  description: string;
  filter: (customers: Customer[], orders: Order[]) => Customer[];
};

const segments: Segment[] = [
  {
    id: 'all',
    name: 'All Customers',
    description: 'Every customer in your store',
    filter: (customers) => customers,
  },
  {
    id: 'refund-requested',
    name: 'Refund Requested',
    description: 'Customers with a refunded order status but payment not yet refunded',
    filter: (customers, orders) => {
      const emails = new Set(
        orders
          .filter((o) => o.status === 'refunded' && o.paymentStatus !== 'refunded')
          .map((o) => o.customerEmail),
      );
      return customers.filter((c) => emails.has(c.email));
    },
  },
  {
    id: 'refunded',
    name: 'Refunded Customers',
    description: 'Customers who have had at least one refund',
    filter: (customers, orders) => {
      const emails = new Set(
        orders.filter((o) => o.status === 'refunded').map((o) => o.customerEmail),
      );
      return customers.filter((c) => emails.has(c.email));
    },
  },
  {
    id: 'happy',
    name: 'Happy Customers',
    description: 'Customers with completed orders and zero refunds',
    filter: (customers, orders) => {
      const refundedEmails = new Set(
        orders.filter((o) => o.status === 'refunded').map((o) => o.customerEmail),
      );
      const completedEmails = new Set(
        orders
          .filter((o) => o.status === 'completed' && o.paymentStatus === 'paid')
          .map((o) => o.customerEmail),
      );
      return customers.filter(
        (c) => completedEmails.has(c.email) && !refundedEmails.has(c.email),
      );
    },
  },
  {
    id: 'inactive',
    name: 'Inactive Customers',
    description: 'No orders in the last 60 days',
    filter: (customers) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);
      return customers.filter((c) => new Date(c.lastOrderAt) < cutoff);
    },
  },
  {
    id: 'high-spenders',
    name: 'High Spenders',
    description: 'Top 25% of customers by total spent',
    filter: (customers) => {
      if (customers.length === 0) return [];
      const sorted = [...customers].sort((a, b) => b.totalSpent - a.totalSpent);
      const cutoffIdx = Math.max(1, Math.ceil(customers.length * 0.25));
      const threshold = sorted[cutoffIdx - 1].totalSpent;
      return customers.filter((c) => c.totalSpent >= threshold);
    },
  },
  {
    id: 'new',
    name: 'New Customers',
    description: 'Joined in the last 30 days',
    filter: (customers) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return customers.filter((c) => new Date(c.createdAt) >= cutoff);
    },
  },
];

export function getSegments(): Segment[] {
  return segments;
}

export function getSegmentCustomers(segmentId: string): Customer[] {
  const segment = segments.find((s) => s.id === segmentId);
  if (!segment) return [];
  return segment.filter(getCustomers(), getOrders());
}
