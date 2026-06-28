import { cn } from '@/lib/utils';

type PeriodSelectorProps = {
  periods: { key: string; label: string }[];
  activePeriod: string;
  onChange: (key: string) => void;
};

export function PeriodSelector({ periods, activePeriod, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex overflow-x-auto border-b border-border -mx-1">
      {periods.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
            activePeriod === p.key
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-primary hover:border-gray-300',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
