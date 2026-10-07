import { Skeleton } from '@/components/ui/skeleton';
import {
  McpLinksAndSettingsSkeleton,
  TavilySectionSkeleton,
} from '@/components/mcp/saas-skeletons';

export default function SaasLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-7 w-40" />
      <McpLinksAndSettingsSkeleton />
      <TavilySectionSkeleton />
    </div>
  );
}
