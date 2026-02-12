import { StatCardSkeleton, TableSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-48" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div>
        <Skeleton className="h-3 w-24 mb-2" />
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}
