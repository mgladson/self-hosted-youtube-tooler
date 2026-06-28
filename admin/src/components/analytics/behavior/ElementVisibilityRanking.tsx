import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type VisibilityData = {
  label: string;
  page: string;
  impressions: number;
  avgVisibleMs: number;
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-primary mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs text-muted">
          {p.name === 'impressions' ? 'Views' : 'Avg visible'}: {p.name === 'impressions' ? p.value.toLocaleString() : `${(p.value / 1000).toFixed(1)}s`}
        </p>
      ))}
    </div>
  );
}

export function ElementVisibilityRanking({ data }: { data: VisibilityData[] }) {
  const chartData = data.slice(0, 10).map((d) => ({
    name: d.label.length > 25 ? d.label.slice(0, 25) + '...' : d.label,
    impressions: d.impressions,
    avgVisibleMs: d.avgVisibleMs,
  }));

  if (chartData.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No visibility data yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="impressions" fill="#4f46e5" radius={[0, 2, 2, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
