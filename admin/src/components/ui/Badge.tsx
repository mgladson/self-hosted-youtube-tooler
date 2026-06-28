import { cn } from '@/lib/utils';

type Variant = 'default' | 'accent' | 'success' | 'warning' | 'destructive' | 'outline';

type BadgeProps = {
  variant?: Variant;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
};

const variants: Record<Variant, string> = {
  default: 'bg-kbd-bg text-muted',
  accent: 'bg-icon-bg text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  outline: 'border border-border text-muted bg-transparent',
};

const dotColors: Record<Variant, string> = {
  default: 'bg-gray-500',
  accent: 'bg-accent',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  destructive: 'bg-red-500',
  outline: 'bg-gray-400',
};

export function Badge({ variant = 'default', dot, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {dot && <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}
