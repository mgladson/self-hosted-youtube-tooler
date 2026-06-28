import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { ArrowLeft } from '@/lib/icons';
import { getSegments, getSegmentCustomers } from '@/lib/segments';
import { getCustomers } from '@/lib/mock-data';

export function Segments() {
  const segments = getSegments();
  const totalCustomers = getCustomers().length;

  const segmentData = useMemo(
    () =>
      segments.map((s) => ({
        ...s,
        size: getSegmentCustomers(s.id).length,
      })),
    [segments],
  );

  return (
    <div>
      <Link to="/admin/customers" className="flex items-center gap-2 text-sm text-muted hover:text-primary mb-6">
        <ArrowLeft size={16} />
        Back to Customers
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Customer Segments</h1>
        <p className="text-sm text-muted mt-1">View and manage customer groups</p>
      </div>

      <Card padding={false}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Segment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Size</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider w-1/3">Distribution</th>
            </tr>
          </thead>
          <tbody>
            {segmentData.map((s) => {
              const pct = totalCustomers > 0 ? (s.size / totalCustomers) * 100 : 0;
              return (
                <tr key={s.id} className="border-b border-border last:border-b-0 hover:bg-hover-bg transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/customers?segment=${s.id}`}
                      className="block"
                    >
                      <p className="text-sm font-medium text-primary hover:text-accent">{s.name}</p>
                      <p className="text-xs text-muted">{s.description}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-primary">
                    {s.size} customer{s.size !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-kbd-bg overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
