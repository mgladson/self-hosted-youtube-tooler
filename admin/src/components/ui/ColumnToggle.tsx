import { useState, useRef, useEffect } from 'react';
import type { Column } from './Table';

type ColumnToggleProps<T> = {
  columns: Column<T>[];
  visibleKeys: Set<string>;
  onChange: (visibleKeys: Set<string>) => void;
};

export function ColumnToggle<T>({ columns, visibleKeys, onChange }: ColumnToggleProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted hover:bg-gray-50 transition-colors"
      >
        Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-border bg-white shadow-lg py-1">
          {columns.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visibleKeys.has(col.key)}
                onChange={() => {
                  const next = new Set(visibleKeys);
                  if (next.has(col.key)) next.delete(col.key);
                  else next.add(col.key);
                  onChange(next);
                }}
                className="h-3.5 w-3.5 rounded border-gray-300 text-accent focus:ring-accent"
              />
              {col.header}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
