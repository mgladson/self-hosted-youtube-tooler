import { Button } from './Button';

type BulkAction = {
  label: string;
  onClick: (ids: string[]) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
};

type BulkActionsBarProps = {
  selectedIds: string[];
  actions: BulkAction[];
  onClear: () => void;
};

export function BulkActionsBar({ selectedIds, actions, onClear }: BulkActionsBarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 mb-2">
      <span className="text-sm font-medium text-indigo-700">
        {selectedIds.length} selected
      </span>
      <div className="flex items-center gap-2 ml-auto">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant || 'outline'}
            size="sm"
            onClick={() => action.onClick(selectedIds)}
          >
            {action.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
