import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import type { DeviceData } from '@/lib/api';

const DEVICE_COLORS: Record<string, string> = {
  desktop: '#6366f1',
  mobile: '#10b981',
  tablet: '#f59e0b',
  bot: '#ef4444',
  unknown: '#64748b',
};

function colorFor(label: string, palette: string[]): string {
  if (DEVICE_COLORS[label.toLowerCase()]) return DEVICE_COLORS[label.toLowerCase()];
  const idx = label.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  return palette[idx];
}

const BROWSER_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const OS_PALETTE = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#84cc16'];

type Bucket = { label: string; visitors: number; views: number };

function Breakdown({ title, data, palette }: { title: string; data: Bucket[]; palette: string[] }) {
  const total = data.reduce((s, d) => s + d.visitors, 0);
  const max = data[0]?.visitors || 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-primary">{title}</p>
        <p className="text-xs text-muted tabular-nums">
          Total: <span className="font-medium text-primary">{total.toLocaleString()}</span>
        </p>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-muted py-4 text-center">No data yet</p>
      ) : (
        <div className="space-y-1.5">
          {data.slice(0, 10).map((d) => {
            const barPct = (d.visitors / max) * 100;
            const sharePct = total > 0 ? (d.visitors / total) * 100 : 0;
            const color = colorFor(d.label, palette);
            return (
              <div key={d.label} className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary w-24 shrink-0 truncate capitalize">{d.label}</span>
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${barPct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-sm font-semibold text-primary w-16 text-right shrink-0 tabular-nums">
                  {d.visitors.toLocaleString()}
                </span>
                <span className="text-xs text-muted w-10 text-right shrink-0 tabular-nums">
                  {sharePct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Props = {
  data: DeviceData | null;
  pathOptions?: string[];
  pathFilter?: string;
  onPathFilterChange?: (path: string) => void;
};

export function DeviceDistribution({ data, pathOptions, pathFilter, onPathFilterChange }: Props) {
  const perPage = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<string, { path: string; total: number; mobile: number; desktop: number; tablet: number; bot: number; unknown: number }>();
    for (const row of data.byPage) {
      const g = grouped.get(row.path) ?? { path: row.path, total: 0, mobile: 0, desktop: 0, tablet: 0, bot: 0, unknown: 0 };
      g.total += row.visitors;
      if (row.deviceType === 'mobile') g.mobile += row.visitors;
      else if (row.deviceType === 'desktop') g.desktop += row.visitors;
      else if (row.deviceType === 'tablet') g.tablet += row.visitors;
      else if (row.deviceType === 'bot') g.bot += row.visitors;
      else g.unknown += row.visitors;
      grouped.set(row.path, g);
    }
    return [...grouped.values()].sort((a, b) => b.total - a.total).slice(0, 15);
  }, [data]);

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-primary">Device & Browser</h2>
        {onPathFilterChange && pathOptions && pathOptions.length > 0 && (
          <select
            value={pathFilter ?? ''}
            onChange={(e) => onPathFilterChange(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-md bg-surface border border-border text-primary"
          >
            <option value="">All pages</option>
            {pathOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      {!data ? (
        <div className="py-12 text-center text-muted text-sm">
          No device data yet. Visitors will appear here once tracking events are received.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Breakdown title="By Device Type" data={data.byDevice} palette={[]} />
            <Breakdown title="By Browser" data={data.byBrowser} palette={BROWSER_PALETTE} />
            <Breakdown title="By OS" data={data.byOs} palette={OS_PALETTE} />
          </div>

          {perPage.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-sm font-semibold text-primary mb-3">Devices per Page</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-2 text-xs font-medium text-muted">Page</th>
                      <th className="text-right py-2.5 px-2 text-xs font-medium text-muted">Visitors</th>
                      <th className="text-right py-2.5 px-2 text-xs font-medium text-muted">Desktop</th>
                      <th className="text-right py-2.5 px-2 text-xs font-medium text-muted">Mobile</th>
                      <th className="text-right py-2.5 px-2 text-xs font-medium text-muted">Tablet</th>
                      <th className="text-right py-2.5 px-2 text-xs font-medium text-muted">Bot</th>
                      <th className="text-right py-2.5 px-2 text-xs font-medium text-muted">Unknown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perPage.map((row) => (
                      <tr key={row.path} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-2 text-primary truncate max-w-[260px]">{row.path}</td>
                        <td className="py-2.5 px-2 text-right font-medium text-primary tabular-nums">{row.total.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right text-muted tabular-nums">{row.desktop.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right text-muted tabular-nums">{row.mobile.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right text-muted tabular-nums">{row.tablet.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right text-muted tabular-nums">{row.bot > 0 ? <span style={{ color: '#ef4444' }}>{row.bot.toLocaleString()}</span> : row.bot.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-right text-muted tabular-nums">{row.unknown.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
