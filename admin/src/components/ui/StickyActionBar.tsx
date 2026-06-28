import { Button } from './Button';

type StickyActionBarProps = {
  dirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  saveLabel?: string;
};

export function StickyActionBar({
  dirty,
  onSave,
  onDiscard,
  onDelete,
  onArchive,
  saveLabel = 'Save',
}: StickyActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-white px-6 py-3 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2">
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Delete
            </Button>
          )}
          {onArchive && (
            <Button variant="outline" size="sm" onClick={onArchive}>
              Archive
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-xs text-muted">Unsaved changes</span>
          )}
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
