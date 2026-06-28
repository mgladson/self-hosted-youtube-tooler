import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type ScrollData = {
  pageType: string;
  depth: number;
  count: number;
};

const COLORS: Record<string, string> = {
  home: '#4f46e5',
  product: '#10b981',
  products: '#f59e0b',
  collection: '#ec4899',
  collections: '#8b5cf6',
  search: '#06b6d4',
  cart: '#ef4444',
  page: '#6b7280',
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-primary mb-1">{label}% scroll depth</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs text-muted">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.fill }} />
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function ScrollDepthChart({ data }: { data: ScrollData[] }) {
  const pageTypes = [...new Set(data.map((d) => d.pageType))];
  const depthLevels = [25, 50, 75, 100];

  const chartData = depthLevels.map((depth) => {
    const row: Record<string, unknown> = { depth: `${depth}%` };
    for (const pt of pageTypes) {
      const match = data.find((d) => d.pageType === pt && d.depth === depth);
      row[pt] = match?.count || 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="depth"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          iconType="circle"
          iconSize={8}
        />
        {pageTypes.map((pt) => (
          <Bar
            key={pt}
            dataKey={pt}
            fill={COLORS[pt] || '#6b7280'}
            radius={[2, 2, 0, 0]}
            maxBarSize={40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
