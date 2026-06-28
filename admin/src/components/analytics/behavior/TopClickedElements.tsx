type ClickData = {
  text: string;
  tag: string;
  href: string;
  page: string;
  count: number;
};

export function TopClickedElements({ data }: { data: ClickData[] }) {
  const totalClicks = data.reduce((sum, d) => sum + d.count, 0);

  if (data.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No click data yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2.5 px-2 text-xs font-medium text-muted">#</th>
            <th className="text-left py-2.5 px-2 text-xs font-medium text-muted">Element</th>
            <th className="text-left py-2.5 px-2 text-xs font-medium text-muted">Page</th>
            <th className="text-right py-2.5 px-2 text-xs font-medium text-muted">Clicks</th>
            <th className="text-right py-2.5 px-2 text-xs font-medium text-muted">%</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 15).map((d, i) => (
            <tr key={`${d.text}-${d.page}-${i}`} className="border-b border-border last:border-0">
              <td className="py-2.5 px-2 text-muted">{i + 1}</td>
              <td className="py-2.5 px-2">
                <span className="font-medium text-primary truncate block max-w-[200px]">
                  {d.text || '(no text)'}
                </span>
                <span className="text-xs text-muted">{d.tag}</span>
              </td>
              <td className="py-2.5 px-2 text-muted truncate max-w-[120px]">{d.page}</td>
              <td className="py-2.5 px-2 text-right font-medium text-primary">{d.count.toLocaleString()}</td>
              <td className="py-2.5 px-2 text-right text-muted">
                {totalClicks > 0 ? ((d.count / totalClicks) * 100).toFixed(1) : '0'}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
