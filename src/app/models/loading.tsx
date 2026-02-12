import { StatCardSkeleton, TableSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function ModelsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-28" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div>
        <Skeleton className="h-3 w-32 mb-2" />
        <TableSkeleton rows={5} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-sm border border-border bg-grep-0 p-4">
          <Skeleton className="h-3 w-40 mb-3" />
          <Skeleton className="h-[280px] w-full" />
        </div>
        <div className="rounded-sm border border-border bg-grep-0 p-4">
          <Skeleton className="h-3 w-36 mb-3" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      </div>
    </div>
  );
}
