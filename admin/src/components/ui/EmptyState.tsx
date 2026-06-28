import { cn } from '@/lib/utils';
import { Button } from './Button';

type EmptyStateProps = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  heading: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  heading,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-kbd-bg mb-4">
        <Icon size={24} className="text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-primary mb-1">{heading}</h3>
      <p className="text-sm text-muted max-w-sm mb-6">{description}</p>
      {actionLabel && (actionHref || onAction) && (
        <Button href={actionHref} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
