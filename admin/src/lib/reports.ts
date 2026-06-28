import type { Order } from './mock-data';

const PAYMENT_PROCESSING_RATE = 0.029;
const PAYMENT_FIXED_FEE_CENTS = 30;
const MONTHLY_PLATFORM_COST_CENTS = 20000;
const MARKETING_RATE = 0.08;

function paidOrders(orders: Order[], start: Date, end: Date): Order[] {
  return orders.filter((o) => {
    if (o.paymentStatus !== 'paid') return false;
    const d = new Date(o.createdAt);
    return d >= start && d <= end;
  });
}

function refundedOrders(orders: Order[], start: Date, end: Date): Order[] {
  return orders.filter((o) => {
    if (o.status !== 'refunded') return false;
    const d = new Date(o.createdAt);
    return d >= start && d <= end;
  });
}

export type FinanceSummary = {
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  taxCollected: number;
  paymentFees: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  netProfit: number;
  netMarginPct: number;
  orderCount: number;
};

export function getFinanceSummary(orders: Order[], start: Date, end: Date): FinanceSummary {
  const paid = paidOrders(orders, start, end);
  const refunded = refundedOrders(orders, start, end);

  const grossSales = paid.reduce((s, o) => s + o.items.reduce((is, it) => is + it.price, 0), 0);
  const discounts = paid.reduce((s, o) => s + (o.discountAmount || 0), 0);
  const refundTotal = refunded.reduce((s, o) => s + o.total, 0);
  const taxCollected = paid.reduce((s, o) => s + (o.taxAmount || 0), 0);
  const netSales = grossSales - discounts - refundTotal;
  const cogs = paid.reduce((s, o) => s + o.items.reduce((is, it) => is + it.cost, 0), 0);
  const grossProfit = netSales - cogs;
  const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const months = days / 30;
  const paymentFees = Math.round(netSales * PAYMENT_PROCESSING_RATE + paid.length * PAYMENT_FIXED_FEE_CENTS);
  const platformCosts = Math.round(MONTHLY_PLATFORM_COST_CENTS * months);
  const marketingCosts = Math.round(netSales * MARKETING_RATE);
  const operatingExpenses = paymentFees + platformCosts + marketingCosts;

  const netProfit = grossProfit - operatingExpenses;
  const netMarginPct = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  return {
    grossSales,
    discounts,
    refunds: refundTotal,
    netSales,
    taxCollected,
    paymentFees,
    cogs,
    grossProfit,
    grossMarginPct,
    operatingExpenses,
    netProfit,
    netMarginPct,
    orderCount: paid.length,
  };
}

export type ProductSalesRow = {
  productName: string;
  unitsSold: number;
  grossRevenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
};

export function getSalesByProduct(orders: Order[], start: Date, end: Date): ProductSalesRow[] {
  const paid = paidOrders(orders, start, end);
  const map = new Map<string, { name: string; units: number; revenue: number; cost: number }>();

  for (const o of paid) {
    for (const it of o.items) {
      const existing = map.get(it.productId);
      if (existing) {
        existing.units++;
        existing.revenue += it.price;
        existing.cost += it.cost;
      } else {
        map.set(it.productId, { name: it.productName, units: 1, revenue: it.price, cost: it.cost });
      }
    }
  }

  return [...map.values()]
    .map((v) => ({
      productName: v.name,
      unitsSold: v.units,
      grossRevenue: v.revenue,
      cogs: v.cost,
      grossProfit: v.revenue - v.cost,
      marginPct: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);
}

export type PaymentMethodRow = {
  method: string;
  count: number;
  gross: number;
  fees: number;
  net: number;
};

export function getPaymentsSummary(orders: Order[], start: Date, end: Date): PaymentMethodRow[] {
  const paid = paidOrders(orders, start, end);
  const gross = paid.reduce((s, o) => s + o.total, 0);
  const fees = Math.round(gross * PAYMENT_PROCESSING_RATE + paid.length * PAYMENT_FIXED_FEE_CENTS);
  return [
    {
      method: 'Stripe',
      count: paid.length,
      gross,
      fees,
      net: gross - fees,
    },
  ];
}

export type TaxPeriodRow = {
  label: string;
  grossSales: number;
  taxableAmount: number;
  taxCollected: number;
  netSales: number;
};

export function getTaxReport(orders: Order[], start: Date, end: Date): { periods: TaxPeriodRow[]; totals: TaxPeriodRow } {
  const paid = paidOrders(orders, start, end);

  const months = new Map<string, Order[]>();
  for (const o of paid) {
    const d = new Date(o.createdAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const arr = months.get(key) || [];
    arr.push(o);
    months.set(key, arr);
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sortedKeys = [...months.keys()].sort();

  const periods: TaxPeriodRow[] = sortedKeys.map((key) => {
    const ords = months.get(key)!;
    const grossSales = ords.reduce((s, o) => s + o.items.reduce((is, it) => is + it.price, 0), 0);
    const taxCollected = ords.reduce((s, o) => s + (o.taxAmount || 0), 0);
    const discounts = ords.reduce((s, o) => s + (o.discountAmount || 0), 0);
    const taxableAmount = grossSales - discounts;
    const [y, m] = key.split('-');
    return {
      label: `${monthNames[parseInt(m, 10) - 1]} ${y}`,
      grossSales,
      taxableAmount,
      taxCollected,
      netSales: grossSales - discounts,
    };
  });

  const totals: TaxPeriodRow = {
    label: 'Total',
    grossSales: periods.reduce((s, p) => s + p.grossSales, 0),
    taxableAmount: periods.reduce((s, p) => s + p.taxableAmount, 0),
    taxCollected: periods.reduce((s, p) => s + p.taxCollected, 0),
    netSales: periods.reduce((s, p) => s + p.netSales, 0),
  };

  return { periods, totals };
}

export type QuarterRow = {
  quarter: string;
  grossIncome: number;
  taxCollected: number;
  netIncome: number;
};

export function getQuarterlyTaxSummary(orders: Order[], year: number): QuarterRow[] {
  const quarters: QuarterRow[] = [];
  for (let q = 1; q <= 4; q++) {
    const startMonth = (q - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
    const paid = paidOrders(orders, start, end);
    const grossIncome = paid.reduce((s, o) => s + o.items.reduce((is, it) => is + it.price, 0), 0);
    const discounts = paid.reduce((s, o) => s + (o.discountAmount || 0), 0);
    const taxCollected = paid.reduce((s, o) => s + (o.taxAmount || 0), 0);
    quarters.push({
      quarter: `Q${q} ${year}`,
      grossIncome: grossIncome - discounts,
      taxCollected,
      netIncome: grossIncome - discounts - taxCollected,
    });
  }
  return quarters;
}

export type TaxFilingRow = {
  date: string;
  orderNumber: string;
  description: string;
  grossAmount: number;
  taxAmount: number;
  netAmount: number;
};

export function getTaxFilingCSVRows(orders: Order[], start: Date, end: Date): TaxFilingRow[] {
  const paid = paidOrders(orders, start, end);
  return paid
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((o) => {
      const subtotal = o.items.reduce((s, it) => s + it.price, 0);
      const discount = o.discountAmount || 0;
      const gross = subtotal - discount;
      const tax = o.taxAmount || 0;
      return {
        date: new Date(o.createdAt).toISOString().slice(0, 10),
        orderNumber: o.orderNumber,
        description: o.items.map((it) => it.productName).join('; '),
        grossAmount: gross,
        taxAmount: tax,
        netAmount: gross - tax,
      };
    });
}
