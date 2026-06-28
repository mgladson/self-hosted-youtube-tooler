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

type PageData = {
  path: string;
  pageType: string;
  views: number;
  uniqueSessions: number;
  avgTimeMs: number;
  avgScrollDepth: number;
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-primary mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs text-muted">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.fill }} />
          {p.name === 'avgTimeSec' ? 'Avg Time' : 'Avg Scroll'}: {p.name === 'avgTimeSec' ? `${p.value}s` : `${p.value}%`}
        </p>
      ))}
    </div>
  );
}

export function EngagementByPage({ data }: { data: PageData[] }) {
  const byType = new Map<string, { totalTime: number; totalScroll: number; count: number }>();

  for (const d of data) {
    const existing = byType.get(d.pageType) || { totalTime: 0, totalScroll: 0, count: 0 };
    existing.totalTime += d.avgTimeMs;
    existing.totalScroll += d.avgScrollDepth;
    existing.count += 1;
    byType.set(d.pageType, existing);
  }

  const chartData = [...byType.entries()].map(([type, agg]) => ({
    pageType: type,
    avgTimeSec: Math.round(agg.totalTime / agg.count / 1000),
    avgScrollDepth: Math.round(agg.totalScroll / agg.count),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="pageType"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
        <Bar dataKey="avgTimeSec" name="Avg Time (s)" fill="#4f46e5" radius={[2, 2, 0, 0]} maxBarSize={40} />
        <Bar dataKey="avgScrollDepth" name="Avg Scroll %" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
