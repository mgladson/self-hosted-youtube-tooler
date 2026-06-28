import { useState } from 'react';
import { ArrowUpDown } from '@/lib/icons';

type PageData = {
  path: string;
  pageType: string;
  views: number;
  uniqueSessions: number;
  avgTimeMs: number;
  avgScrollDepth: number;
};

type SortKey = 'views' | 'uniqueSessions' | 'avgTimeMs' | 'avgScrollDepth';

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

export function TopPagesTable({ data }: { data: PageData[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('views');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...data].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No page data yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2.5 px-2 text-xs font-medium text-muted">Page</th>
            {([
              ['views', 'Views'],
              ['uniqueSessions', 'Sessions'],
              ['avgTimeMs', 'Avg Time'],
              ['avgScrollDepth', 'Scroll %'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <th
                key={key}
                className="text-right py-2.5 px-2 text-xs font-medium text-muted cursor-pointer hover:text-primary select-none"
                onClick={() => handleSort(key)}
              >
                <span className="inline-flex items-center gap-1">
                  {label}
                  <ArrowUpDown size={12} className={sortKey === key ? 'text-accent' : ''} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.path} className="border-b border-border last:border-0">
              <td className="py-2.5 px-2">
                <span className="font-medium text-primary truncate block max-w-[200px]">{d.path}</span>
                <span className="text-xs text-muted">{d.pageType}</span>
              </td>
              <td className="py-2.5 px-2 text-right font-medium text-primary">{d.views.toLocaleString()}</td>
              <td className="py-2.5 px-2 text-right text-muted">{d.uniqueSessions.toLocaleString()}</td>
              <td className="py-2.5 px-2 text-right text-muted">{formatTime(d.avgTimeMs)}</td>
              <td className="py-2.5 px-2 text-right text-muted">{d.avgScrollDepth}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
