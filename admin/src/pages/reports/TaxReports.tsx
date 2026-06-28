import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download } from '@/lib/icons';
import { getOrders } from '@/lib/mock-data';
import { getTaxReport, getQuarterlyTaxSummary, getTaxFilingCSVRows } from '@/lib/reports';
import { formatPrice } from '@/lib/utils';
import { downloadCSV, centsToDollars } from '@/lib/csv';

export function TaxReports() {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [taxRate, setTaxRate] = useState(8);
  const allOrders = getOrders();

  const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
  const yearEnd = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999));

  const taxReport = useMemo(() => getTaxReport(allOrders, yearStart, yearEnd), [allOrders, yearStart, yearEnd]);
  const quarters = useMemo(() => getQuarterlyTaxSummary(allOrders, selectedYear), [allOrders, selectedYear]);
  const quarterTotals = useMemo(() => ({
    grossIncome: quarters.reduce((s, q) => s + q.grossIncome, 0),
    taxCollected: quarters.reduce((s, q) => s + q.taxCollected, 0),
    netIncome: quarters.reduce((s, q) => s + q.netIncome, 0),
  }), [quarters]);

  const handleExportQuarterly = () => {
    downloadCSV(`tax-quarterly-${selectedYear}.csv`, [
      { key: 'quarter', header: 'Quarter', value: (r: typeof quarters[0]) => r.quarter },
      { key: 'gross', header: 'Gross Income (USD)', value: (r: typeof quarters[0]) => centsToDollars(r.grossIncome) },
      { key: 'tax', header: 'Tax Collected (USD)', value: (r: typeof quarters[0]) => centsToDollars(r.taxCollected) },
      { key: 'net', header: 'Net Income (USD)', value: (r: typeof quarters[0]) => centsToDollars(r.netIncome) },
    ], quarters);
  };

  const handleExportMonthly = () => {
    downloadCSV(`tax-monthly-${selectedYear}.csv`, [
      { key: 'month', header: 'Month', value: (r: typeof taxReport.periods[0]) => r.label },
      { key: 'gross', header: 'Gross Sales (USD)', value: (r: typeof taxReport.periods[0]) => centsToDollars(r.grossSales) },
      { key: 'taxable', header: 'Taxable Amount (USD)', value: (r: typeof taxReport.periods[0]) => centsToDollars(r.taxableAmount) },
      { key: 'tax', header: 'Tax Collected (USD)', value: (r: typeof taxReport.periods[0]) => centsToDollars(r.taxCollected) },
      { key: 'net', header: 'Net Sales (USD)', value: (r: typeof taxReport.periods[0]) => centsToDollars(r.netSales) },
    ], taxReport.periods);
  };

  const handleExportTaxFiling = () => {
    const rows = getTaxFilingCSVRows(allOrders, yearStart, yearEnd);
    downloadCSV(`tax-filing-${selectedYear}.csv`, [
      { key: 'date', header: 'Date', value: (r: typeof rows[0]) => r.date },
      { key: 'order', header: 'Order Number', value: (r: typeof rows[0]) => r.orderNumber },
      { key: 'desc', header: 'Description', value: (r: typeof rows[0]) => r.description },
      { key: 'gross', header: 'Gross Amount (USD)', value: (r: typeof rows[0]) => centsToDollars(r.grossAmount) },
      { key: 'tax', header: 'Tax Amount (USD)', value: (r: typeof rows[0]) => centsToDollars(r.taxAmount) },
      { key: 'net', header: 'Net Amount (USD)', value: (r: typeof rows[0]) => centsToDollars(r.netAmount) },
    ], rows);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Tax Reports</h1>
          <p className="text-sm text-muted mt-1">Export tax data for filing</p>
        </div>
        <Button onClick={handleExportTaxFiling}>
          <Download size={16} />
          Export for Tax Filing
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-primary">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-primary">Tax Rate:</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              min={0}
              max={100}
              step={0.5}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-primary text-right focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <span className="text-sm text-muted">%</span>
          </div>
          <span className="text-xs text-muted ml-1">(display only — data uses rate at time of order)</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Quarterly Summary */}
        <Card padding={false}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-lg font-semibold text-primary">Quarterly Summary — {selectedYear}</h2>
            <Button variant="outline" size="sm" onClick={handleExportQuarterly}>
              <Download size={14} />
              Export CSV
            </Button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Quarter</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Gross Income</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Tax Collected</th>
                <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Net Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quarters.map((q) => (
                <tr key={q.quarter}>
                  <td className="py-2.5 px-4 text-sm font-medium">{q.quarter}</td>
                  <td className="py-2.5 px-4 text-sm text-right">{formatPrice(q.grossIncome)}</td>
                  <td className="py-2.5 px-4 text-sm text-right text-muted">{formatPrice(q.taxCollected)}</td>
                  <td className="py-2.5 px-4 text-sm text-right font-medium">{formatPrice(q.netIncome)}</td>
                </tr>
              ))}
              <tr className="bg-hover-bg font-semibold">
                <td className="py-2.5 px-4 text-sm">Full Year</td>
                <td className="py-2.5 px-4 text-sm text-right">{formatPrice(quarterTotals.grossIncome)}</td>
                <td className="py-2.5 px-4 text-sm text-right">{formatPrice(quarterTotals.taxCollected)}</td>
                <td className="py-2.5 px-4 text-sm text-right">{formatPrice(quarterTotals.netIncome)}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Monthly Breakdown */}
        <Card padding={false}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-lg font-semibold text-primary">Monthly Breakdown</h2>
            <Button variant="outline" size="sm" onClick={handleExportMonthly}>
              <Download size={14} />
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Month</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Gross Sales</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Taxable Amount</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Tax Collected</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Net Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {taxReport.periods.map((row) => (
                  <tr key={row.label}>
                    <td className="py-2.5 px-4 text-sm font-medium">{row.label}</td>
                    <td className="py-2.5 px-4 text-sm text-right">{formatPrice(row.grossSales)}</td>
                    <td className="py-2.5 px-4 text-sm text-right text-muted">{formatPrice(row.taxableAmount)}</td>
                    <td className="py-2.5 px-4 text-sm text-right text-muted">{formatPrice(row.taxCollected)}</td>
                    <td className="py-2.5 px-4 text-sm text-right font-medium">{formatPrice(row.netSales)}</td>
                  </tr>
                ))}
                {taxReport.periods.length > 0 && (
                  <tr className="bg-hover-bg font-semibold">
                    <td className="py-2.5 px-4 text-sm">Total</td>
                    <td className="py-2.5 px-4 text-sm text-right">{formatPrice(taxReport.totals.grossSales)}</td>
                    <td className="py-2.5 px-4 text-sm text-right">{formatPrice(taxReport.totals.taxableAmount)}</td>
                    <td className="py-2.5 px-4 text-sm text-right">{formatPrice(taxReport.totals.taxCollected)}</td>
                    <td className="py-2.5 px-4 text-sm text-right">{formatPrice(taxReport.totals.netSales)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {taxReport.periods.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted">No data for {selectedYear}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
