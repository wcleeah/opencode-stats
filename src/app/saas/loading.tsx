import { StatCardSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function SaasLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-24 w-full" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
