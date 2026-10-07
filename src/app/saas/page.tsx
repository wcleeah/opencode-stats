export const dynamic = 'force-dynamic';

import { Suspense } from 'react';

import { McpLinksAndSettings } from '@/components/mcp/links-and-settings';
import {
  McpLinksAndSettingsSkeleton,
  TavilySectionSkeleton,
} from '@/components/mcp/saas-skeletons';
import { TavilySection } from '@/components/mcp/tavily-section';

export default function McpDashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold">SaaS Stats</h1>
      <Suspense fallback={<McpLinksAndSettingsSkeleton />}>
        <McpLinksAndSettings />
      </Suspense>
      <Suspense fallback={<TavilySectionSkeleton />}>
        <TavilySection />
      </Suspense>
    </div>
  );
}
