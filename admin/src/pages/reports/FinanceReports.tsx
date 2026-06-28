import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PeriodSelector } from '@/components/ui/PeriodSelector';
import { Download } from '@/lib/icons';
import { TIME_PERIODS } from '@/lib/analytics';
import { getOrders } from '@/lib/mock-data';
import { getFinanceSummary, getSalesByProduct, getPaymentsSummary } from '@/lib/reports';
import { formatPrice } from '@/lib/utils';
import { downloadCSV, centsToDollars } from '@/lib/csv';

function SummaryRow({ label, amount, pctOfGross, indent, bold, negative }: {
  label: string;
  amount: number;
  pctOfGross?: number;
  indent?: boolean;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <tr className={bold ? 'font-semibold bg-hover-bg' : ''}>
      <td className={`py-2.5 px-4 text-sm ${indent ? 'pl-8' : ''} ${bold ? 'text-primary' : 'text-muted'}`}>
        {negative && amount > 0 ? `(-) ${label}` : label}
      </td>
      <td className={`py-2.5 px-4 text-sm text-right ${bold ? 'text-primary' : ''}`}>
        {negative && amount > 0 ? `-${formatPrice(amount)}` : formatPrice(amount)}
      </td>
      <td className="py-2.5 px-4 text-sm text-right text-muted">
        {pctOfGross !== undefined ? `${pctOfGross.toFixed(1)}%` : ''}
      </td>
    </tr>
  );
}

export function FinanceReports() {
  const [activePeriod, setActivePeriod] = useState('last-30');
  const allOrders = getOrders();

  const period = TIME_PERIODS.find((p) => p.key === activePeriod)!;
  const [start, end] = period.getDateRange();

  const summary = useMemo(() => getFinanceSummary(allOrders, start, end), [allOrders, start, end]);
  const productSales = useMemo(() => getSalesByProduct(allOrders, start, end), [allOrders, start, end]);
  const payments = useMemo(() => getPaymentsSummary(allOrders, start, end), [allOrders, start, end]);

  const handleExportSummary = () => {
    downloadCSV('finance-summary.csv', [
      { key: 'metric', header: 'Metric', value: (r: { metric: string; amount: number }) => r.metric },
      { key: 'amount', header: 'Amount (USD)', value: (r: { metric: string; amount: number }) => centsToDollars(r.amount) },
    ], [
      { metric: 'Gross Sales', amount: summary.grossSales },
      { metric: 'Discounts', amount: -summary.discounts },
      { metric: 'Refunds', amount: -summary.refunds },
      { metric: 'Net Sales', amount: summary.netSales },
      { metric: 'Tax Collected', amount: summary.taxCollected },
      { metric: 'COGS', amount: -summary.cogs },
      { metric: 'Gross Profit', amount: summary.grossProfit },
      { metric: 'Payment Processing Fees', amount: -summary.paymentFees },
      { metric: 'Operating Expenses', amount: -summary.operatingExpenses },
      { metric: 'Net Profit', amount: summary.netProfit },
    ]);
  };

  const handleExportProducts = () => {
    downloadCSV('sales-by-product.csv', [
      { key: 'product', header: 'Product', value: (r: typeof productSales[0]) => r.productName },
      { key: 'units', header: 'Units Sold', value: (r: typeof productSales[0]) => r.unitsSold },
      { key: 'revenue', header: 'Revenue (USD)', value: (r: typeof productSales[0]) => centsToDollars(r.grossRevenue) },
      { key: 'cogs', header: 'COGS (USD)', value: (r: typeof productSales[0]) => centsToDollars(r.cogs) },
      { key: 'profit', header: 'Gross Profit (USD)', value: (r: typeof productSales[0]) => centsToDollars(r.grossProfit) },
      { key: 'margin', header: 'Margin %', value: (r: typeof productSales[0]) => r.marginPct.toFixed(1) },
    ], productSales);
  };

  const handleExportPayments = () => {
    downloadCSV('payments-by-method.csv', [
      { key: 'method', header: 'Method', value: (r: typeof payments[0]) => r.method },
      { key: 'count', header: 'Transactions', value: (r: typeof payments[0]) => r.count },
      { key: 'gross', header: 'Gross (USD)', value: (r: typeof payments[0]) => centsToDollars(r.gross) },
      { key: 'fees', header: 'Fees (USD)', value: (r: typeof payments[0]) => centsToDollars(r.fees) },
      { key: 'net', header: 'Net (USD)', value: (r: typeof payments[0]) => centsToDollars(r.net) },
    ], payments);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Finance Reports</h1>
        <p className="text-sm text-muted mt-1">Financial summaries, sales breakdown, and payment analysis</p>
      </div>

      <PeriodSelector
        periods={TIME_PERIODS}
        activePeriod={activePeriod}
        onChange={setActivePeriod}
      />

      <div className="mt-6 space-y-6">
        {/* Finance Summary */}
        <Card padding={false}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold text-primary">Finance Summary</h2>
              <p className="text-xs text-muted">{summary.orderCount} orders in period</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportSummary}>
              <Download size={14} />
              Export CSV
            </Button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Metric</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Amount</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">% of Gross</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <SummaryRow label="Gross Sales" amount={summary.grossSales} pctOfGross={100} />
              <SummaryRow label="Discounts" amount={summary.discounts} pctOfGross={summary.grossSales > 0 ? (summary.discounts / summary.grossSales) * 100 : 0} negative indent />
              <SummaryRow label="Refunds" amount={summary.refunds} pctOfGross={summary.grossSales > 0 ? (summary.refunds / summary.grossSales) * 100 : 0} negative indent />
              <SummaryRow label="Net Sales" amount={summary.netSales} bold />
              <SummaryRow label="Tax Collected" amount={summary.taxCollected} pctOfGross={summary.grossSales > 0 ? (summary.taxCollected / summary.grossSales) * 100 : 0} />
              <SummaryRow label="Cost of Goods Sold" amount={summary.cogs} pctOfGross={summary.grossSales > 0 ? (summary.cogs / summary.grossSales) * 100 : 0} negative indent />
              <SummaryRow label={`Gross Profit (${summary.grossMarginPct.toFixed(1)}%)`} amount={summary.grossProfit} bold />
              <SummaryRow label="Payment Processing Fees" amount={summary.paymentFees} negative indent />
              <SummaryRow label="Total Operating Expenses" amount={summary.operatingExpenses} pctOfGross={summary.grossSales > 0 ? (summary.operatingExpenses / summary.grossSales) * 100 : 0} negative />
              <SummaryRow label={`Net Profit (${summary.netMarginPct.toFixed(1)}%)`} amount={summary.netProfit} bold />
            </tbody>
          </table>
        </Card>

        {/* Sales by Product */}
        <Card padding={false}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-lg font-semibold text-primary">Sales by Product</h2>
            <Button variant="outline" size="sm" onClick={handleExportProducts}>
              <Download size={14} />
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Product</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Units</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Revenue</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">COGS</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Gross Profit</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {productSales.map((row) => (
                  <tr key={row.productName}>
                    <td className="py-2.5 px-4 text-sm font-medium">{row.productName}</td>
                    <td className="py-2.5 px-4 text-sm text-right text-muted">{row.unitsSold}</td>
                    <td className="py-2.5 px-4 text-sm text-right">{formatPrice(row.grossRevenue)}</td>
                    <td className="py-2.5 px-4 text-sm text-right text-muted">{formatPrice(row.cogs)}</td>
                    <td className="py-2.5 px-4 text-sm text-right font-medium">{formatPrice(row.grossProfit)}</td>
                    <td className="py-2.5 px-4 text-sm text-right text-muted">{row.marginPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Payments by Method */}
        <Card padding={false}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-lg font-semibold text-primary">Payments by Method</h2>
            <Button variant="outline" size="sm" onClick={handleExportPayments}>
              <Download size={14} />
              Export CSV
            </Button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Method</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Transactions</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Gross</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Fees</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((row) => (
                <tr key={row.method}>
                  <td className="py-2.5 px-4 text-sm font-medium">{row.method}</td>
                  <td className="py-2.5 px-4 text-sm text-right text-muted">{row.count}</td>
                  <td className="py-2.5 px-4 text-sm text-right">{formatPrice(row.gross)}</td>
                  <td className="py-2.5 px-4 text-sm text-right text-muted">-{formatPrice(row.fees)}</td>
                  <td className="py-2.5 px-4 text-sm text-right font-medium">{formatPrice(row.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
