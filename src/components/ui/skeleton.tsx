import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-sm bg-surface-alt',
        className,
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-sm border border-border bg-surface p-4">
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-7 w-24 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-sm border border-border bg-surface">
      <div className="border-b border-border p-3">
        <Skeleton className="h-4 w-full" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border p-3 last:border-b-0">
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
