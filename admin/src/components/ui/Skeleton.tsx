import { cn } from '@/lib/utils';

type SkeletonProps = {
  className?: string;
};

export function SkeletonRect({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-skeleton', className)} />
  );
}

export function SkeletonCircle({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded-full bg-skeleton', className)} />
  );
}

export function SkeletonText({ className, lines = 3 }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-3 animate-pulse rounded bg-skeleton',
            i === lines - 1 ? 'w-3/4' : 'w-full',
          )}
        />
      ))}
    </div>
  );
}
