import { TableSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <TableSkeleton rows={10} />
    </div>
  );
}
