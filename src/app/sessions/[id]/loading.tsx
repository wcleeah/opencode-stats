import { StatCardSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function SessionDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-64" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div>
        <Skeleton className="h-3 w-32 mb-3" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-sm border border-border bg-grep-0 p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
