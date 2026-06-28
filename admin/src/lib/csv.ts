export type CSVColumn<T> = {
  key: string;
  header: string;
  value: (row: T) => string | number;
};

function escapeCSV(val: string): string {
  // Neutralize spreadsheet formula injection: a value beginning with a formula
  // trigger (= + - @) or a leading tab/CR is evaluated as a formula by
  // Excel/Sheets/LibreOffice. Prefix with a single quote so it renders as text.
  const s = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCSV<T>(
  filename: string,
  columns: CSVColumn<T>[],
  rows: T[],
): void {
  const header = columns.map((c) => escapeCSV(c.header)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const v = c.value(row);
          return escapeCSV(String(v));
        })
        .join(','),
    )
    .join('\n');

  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatISODate(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 10);
}
