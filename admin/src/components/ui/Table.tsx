import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

export type Column<T> = {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSortChange?: (key: string, dir: SortDirection) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
};

function nextSortDir(current: SortDirection): SortDirection {
  if (current === null) return 'asc';
  if (current === 'asc') return 'desc';
  return null;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyMessage = 'No data found',
  selectable,
  onSelectionChange,
  sortKey,
  sortDirection,
  onSortChange,
  page,
  pageSize = 25,
  total,
  onPageChange,
}: TableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => data.map(rowKey), [data, rowKey]);

  const toggleSelection = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange?.(Array.from(next));
        return next;
      });
    },
    [onSelectionChange],
  );

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }, [visibleIds, onSelectionChange]);

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id)) && !allSelected;

  const handleSort = useCallback(
    (key: string) => {
      const currentDir: SortDirection = sortKey === key ? (sortDirection ?? null) : null;
      onSortChange?.(key, nextSortDir(currentDir));
    },
    [sortKey, sortDirection, onSortChange],
  );

  if (data.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">{emptyMessage}</p>
      </div>
    );
  }

  const showPagination = page !== undefined && total !== undefined && onPageChange;
  const totalPages = showPagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const startItem = showPagination ? (page - 1) * pageSize + 1 : 1;
  const endItem = showPagination ? Math.min(page * pageSize, total) : data.length;
  const displayTotal = total ?? data.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {selectable && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider',
                  col.sortable && 'cursor-pointer select-none hover:text-primary',
                  col.className,
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortKey === col.key && sortDirection && (
                    <svg
                      className={cn('h-3 w-3 transition-transform', sortDirection === 'desc' && 'rotate-180')}
                      viewBox="0 0 12 12"
                      fill="currentColor"
                    >
                      <path d="M6 2l4 5H2z" />
                    </svg>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const id = rowKey(item);
            return (
              <tr
                key={id}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors',
                  onRowClick && 'hover:bg-hover-bg cursor-pointer',
                  selectable && selectedIds.has(id) && 'bg-indigo-50/50',
                )}
              >
                {selectable && (
                  <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(id)}
                      onChange={() => toggleSelection(id)}
                      className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-sm', col.className)}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {showPagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
          <span className="text-xs text-muted">
            Showing {startItem}–{endItem} of {displayTotal}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded px-2 py-1 text-xs font-medium text-muted hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded px-2 py-1 text-xs font-medium text-muted hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function clearTableSelection(setter: React.Dispatch<React.SetStateAction<string[]>>) {
  setter([]);
}
