import { StatCardSkeleton, TableSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function ToolsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div className="rounded-sm border border-border bg-grep-0 p-4">
        <Skeleton className="h-3 w-40 mb-3" />
        <Skeleton className="h-[320px] w-full" />
      </div>

      <div>
        <Skeleton className="h-3 w-20 mb-2" />
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}
