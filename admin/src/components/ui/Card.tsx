import { cn } from '@/lib/utils';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
};

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-xl border border-border shadow-sm',
        padding && 'p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
