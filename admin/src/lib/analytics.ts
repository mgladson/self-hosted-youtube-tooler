import type { Order } from './mock-data';
import { formatPrice } from './utils';

const PAYMENT_PROCESSING_RATE = 0.029;
const PAYMENT_FIXED_FEE_CENTS = 30;
const MONTHLY_PLATFORM_COST_CENTS = 20000;
const MARKETING_RATE = 0.08;

export type TimePeriod = {
  key: string;
  label: string;
  getDateRange: () => [Date, Date];
};

function rangeEndingNow(daysBack: number): [Date, Date] {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);
  return [start, end];
}

export const TIME_PERIODS: TimePeriod[] = [
  {
    key: 'last-24h',
    label: 'Last 24 Hours',
    getDateRange: () => rangeEndingNow(1),
  },
  {
    key: 'last-7',
    label: 'Last 7 Days',
    getDateRange: () => rangeEndingNow(7),
  },
  {
    key: 'last-14',
    label: 'Last 14 Days',
    getDateRange: () => rangeEndingNow(14),
  },
  {
    key: 'current-month',
    label: 'Current Month',
    getDateRange: () => {
      const end = new Date();
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      return [start, end];
    },
  },
  {
    key: 'last-30',
    label: 'Last 30 Days',
    getDateRange: () => rangeEndingNow(30),
  },
  {
    key: 'last-60',
    label: 'Last 60 Days',
    getDateRange: () => rangeEndingNow(60),
  },
  {
    key: 'last-90',
    label: 'Last 3 Months',
    getDateRange: () => rangeEndingNow(90),
  },
  {
    key: 'last-180',
    label: 'Last 6 Months',
    getDateRange: () => rangeEndingNow(180),
  },
  {
    key: 'ytd',
    label: 'Year to Date',
    getDateRange: () => {
      const end = new Date();
      const start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
      return [start, end];
    },
  },
  {
    key: 'last-365',
    label: 'Last 12 Months',
    getDateRange: () => rangeEndingNow(365),
  },
];

export function filterOrdersByPeriod(orders: Order[], start: Date, end: Date): Order[] {
  return orders.filter((o) => {
    if (o.paymentStatus !== 'paid') return false;
    const d = new Date(o.createdAt);
    return d >= start && d <= end;
  });
}

export type PeriodMetrics = {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  netProfit: number;
  netMarginPercent: number;
  orderCount: number;
  avgOrderValue: number;
  avgDailyRevenue: number;
  operatingExpenses: number;
};

export function getPeriodMetrics(orders: Order[], start: Date, end: Date): PeriodMetrics {
  const filtered = filterOrdersByPeriod(orders, start, end);
  const totalRevenue = filtered.reduce((s, o) => s + o.total, 0);
  const totalCost = filtered.reduce(
    (s, o) => s + o.items.reduce((is, it) => is + it.cost, 0),
    0,
  );
  const grossProfit = totalRevenue - totalCost;
  const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const months = days / 30;

  const paymentFees = Math.round(
    totalRevenue * PAYMENT_PROCESSING_RATE + filtered.length * PAYMENT_FIXED_FEE_CENTS,
  );
  const platformCosts = Math.round(MONTHLY_PLATFORM_COST_CENTS * months);
  const marketingCosts = Math.round(totalRevenue * MARKETING_RATE);
  const operatingExpenses = paymentFees + platformCosts + marketingCosts;

  const netProfit = grossProfit - operatingExpenses;
  const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    totalCost,
    grossProfit,
    grossMarginPercent,
    netProfit,
    netMarginPercent,
    orderCount: filtered.length,
    avgOrderValue: filtered.length > 0 ? Math.round(totalRevenue / filtered.length) : 0,
    avgDailyRevenue: Math.round(totalRevenue / days),
    operatingExpenses,
  };
}

type Granularity = 'day' | 'week' | 'month';

function getGranularity(start: Date, end: Date): Granularity {
  const days = (end.getTime() - start.getTime()) / 86400000;
  if (days <= 60) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

function formatBucketKey(d: Date, gran: Granularity): string {
  if (gran === 'month') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return d.toISOString().slice(0, 10);
}

function formatBucketLabel(key: string, gran: Granularity): string {
  if (gran === 'month') {
    const [y, m] = key.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  }
  const d = new Date(key + 'T00:00:00Z');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function getWeekKey(d: Date): string {
  const day = new Date(d);
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day.toISOString().slice(0, 10);
}

export type ChartDataPoint = {
  label: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  average: number;
};

export function getChartData(
  orders: Order[],
  start: Date,
  end: Date,
): { data: ChartDataPoint[]; granularity: Granularity } {
  const gran = getGranularity(start, end);
  const filtered = filterOrdersByPeriod(orders, start, end);

  const buckets = new Map<string, { revenue: number; cost: number }>();

  // Pre-fill buckets
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = gran === 'week' ? getWeekKey(d) : formatBucketKey(d, gran);
    if (!buckets.has(key)) buckets.set(key, { revenue: 0, cost: 0 });
  }

  for (const o of filtered) {
    const d = new Date(o.createdAt);
    const key = gran === 'week' ? getWeekKey(d) : formatBucketKey(d, gran);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += o.total;
      bucket.cost += o.items.reduce((s, it) => s + it.cost, 0);
    }
  }

  const sortedKeys = [...buckets.keys()].sort();
  let cumulativeRevenue = 0;
  const data: ChartDataPoint[] = sortedKeys.map((key, i) => {
    const b = buckets.get(key)!;
    const revenueDollars = b.revenue / 100;
    const costDollars = b.cost / 100;
    cumulativeRevenue += revenueDollars;
    return {
      label: formatBucketLabel(key, gran),
      revenue: revenueDollars,
      cost: costDollars,
      grossProfit: revenueDollars - costDollars,
      average: Math.round((cumulativeRevenue / (i + 1)) * 100) / 100,
    };
  });

  return { data, granularity: gran };
}

export type MarginDataPoint = {
  label: string;
  grossProfit: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
};

export function getMarginChartData(orders: Order[], start: Date, end: Date): MarginDataPoint[] {
  const gran = getGranularity(start, end);
  const filtered = filterOrdersByPeriod(orders, start, end);

  const buckets = new Map<string, { revenue: number; cost: number; count: number }>();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = gran === 'week' ? getWeekKey(d) : formatBucketKey(d, gran);
    if (!buckets.has(key)) buckets.set(key, { revenue: 0, cost: 0, count: 0 });
  }

  for (const o of filtered) {
    const d = new Date(o.createdAt);
    const key = gran === 'week' ? getWeekKey(d) : formatBucketKey(d, gran);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += o.total;
      bucket.cost += o.items.reduce((s, it) => s + it.cost, 0);
      bucket.count++;
    }
  }

  const sortedKeys = [...buckets.keys()].sort();
  return sortedKeys.map((key) => {
    const b = buckets.get(key)!;
    const grossProfit = (b.revenue - b.cost) / 100;
    const paymentFees = (b.revenue * PAYMENT_PROCESSING_RATE + b.count * PAYMENT_FIXED_FEE_CENTS) / 100;
    const marketing = (b.revenue * MARKETING_RATE) / 100;
    const revenueDollars = b.revenue / 100;
    const netProfit = grossProfit - paymentFees - marketing;
    return {
      label: formatBucketLabel(key, gran),
      grossProfit: Math.round(grossProfit * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      grossMarginPct: revenueDollars > 0 ? Math.round(((grossProfit / revenueDollars) * 100) * 10) / 10 : 0,
      netMarginPct: revenueDollars > 0 ? Math.round(((netProfit / revenueDollars) * 100) * 10) / 10 : 0,
    };
  });
}

export type PeriodComparison = {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  revenueChange: number;
  orderCountChange: number;
  avgOrderChange: number;
  marginChange: number;
};

export function getPeriodComparison(orders: Order[], start: Date, end: Date): PeriodComparison {
  const periodMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);

  const current = getPeriodMetrics(orders, start, end);
  const previous = getPeriodMetrics(orders, prevStart, prevEnd);

  const pctChange = (curr: number, prev: number) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : curr > 0 ? 100 : 0;

  return {
    current,
    previous,
    revenueChange: pctChange(current.totalRevenue, previous.totalRevenue),
    orderCountChange: pctChange(current.orderCount, previous.orderCount),
    avgOrderChange: pctChange(current.avgOrderValue, previous.avgOrderValue),
    marginChange: Math.round((current.grossMarginPercent - previous.grossMarginPercent) * 10) / 10,
  };
}

export function formatCompactPrice(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return formatPrice(cents);
}

export function formatDollars(dollars: number): string {
  if (dollars >= 1000000) return `$${(dollars / 1000000).toFixed(1)}M`;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(0)}`;
}
