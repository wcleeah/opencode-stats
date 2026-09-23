import { StatCardSkeleton, TableSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <Skeleton className="h-3 w-32 mb-3" />
        <Skeleton className="h-[280px] w-full" />
      </div>

      <div>
        <Skeleton className="h-3 w-24 mb-2" />
        <TableSkeleton rows={5} />
      </div>
    </div>
  );
}
