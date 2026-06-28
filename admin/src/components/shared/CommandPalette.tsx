import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ShoppingBag, Users, FileText, X } from '@/lib/icons';
import { searchProvider, type SearchResult } from '@/lib/search';

const typeIcons: Record<SearchResult['type'], typeof Package> = {
  product: Package,
  order: ShoppingBag,
  customer: Users,
  page: FileText,
};

const typeLabels: Record<SearchResult['type'], string> = {
  product: 'Products',
  order: 'Orders',
  customer: 'Customers',
  page: 'Pages',
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    searchProvider.search(query).then((r) => {
      if (!controller.signal.aborted) {
        setResults(r);
        setActiveIndex(0);
      }
    });
    return () => controller.abort();
  }, [query]);

  const select = useCallback(
    (result: SearchResult) => {
      onClose();
      navigate(result.href);
    },
    [navigate, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(1, results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + results.length) % Math.max(1, results.length));
      } else if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault();
        select(results[activeIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [results, activeIndex, select, onClose],
  );

  if (!open) return null;

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-surface shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search products, orders, customers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted-foreground focus:outline-none"
          />
          <button onClick={onClose} className="text-muted hover:text-primary">
            <X size={16} />
          </button>
        </div>

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {(['product', 'order', 'customer', 'page'] as const).map((type) => {
              const items = grouped[type];
              if (!items?.length) return null;
              const Icon = typeIcons[type];
              return (
                <div key={type}>
                  <div className="px-4 py-1.5 text-xs font-medium text-muted uppercase tracking-wider">
                    {typeLabels[type]}
                  </div>
                  {items.map((item) => {
                    const idx = flatIndex++;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => select(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                          idx === activeIndex ? 'bg-icon-bg text-accent' : 'text-primary hover:bg-hover-bg'
                        }`}
                      >
                        <Icon size={16} className="shrink-0 text-muted" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{item.label}</span>
                          {item.sublabel && (
                            <span className="ml-2 text-xs text-muted">{item.sublabel}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">No results found</div>
        )}

        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted">
          <span><kbd className="rounded bg-kbd-bg px-1.5 py-0.5 font-mono text-[10px]">&uarr;&darr;</kbd> Navigate</span>
          <span><kbd className="rounded bg-kbd-bg px-1.5 py-0.5 font-mono text-[10px]">&crarr;</kbd> Select</span>
          <span><kbd className="rounded bg-kbd-bg px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
