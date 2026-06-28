import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { MarginDataPoint } from '@/lib/analytics';
import { formatDollars } from '@/lib/analytics';

type MarginChartProps = {
  data: MarginDataPoint[];
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string; unit?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const names: Record<string, string> = {
    grossProfit: 'Gross Profit',
    netProfit: 'Net Profit',
    grossMarginPct: 'Gross Margin',
    netMarginPct: 'Net Margin',
  };
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-primary mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs text-muted">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {names[p.name] || p.name}: {p.name.includes('Pct') ? `${p.value}%` : formatDollars(p.value)}
        </p>
      ))}
    </div>
  );
}

export function MarginChart({ data }: MarginChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="dollars"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatDollars(v)}
          width={60}
        />
        <YAxis
          yAxisId="percent"
          orientation="right"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
          width={45}
          domain={[0, 100]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#6b7280' }}
          formatter={(value: string) => {
            const names: Record<string, string> = {
              grossProfit: 'Gross Profit',
              netProfit: 'Net Profit',
              grossMarginPct: 'Gross %',
              netMarginPct: 'Net %',
            };
            return names[value] || value;
          }}
        />
        <Bar yAxisId="dollars" dataKey="grossProfit" fill="#10b981" radius={[2, 2, 0, 0]} barSize={16} />
        <Bar yAxisId="dollars" dataKey="netProfit" fill="#4f46e5" radius={[2, 2, 0, 0]} barSize={16} />
        <Line yAxisId="percent" type="monotone" dataKey="grossMarginPct" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 4" />
        <Line yAxisId="percent" type="monotone" dataKey="netMarginPct" stroke="#4f46e5" strokeWidth={2} dot={false} strokeDasharray="4 4" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
