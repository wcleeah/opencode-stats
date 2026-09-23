import Link from 'next/link';

import { UpdatePricingButton } from '@/components/cursor/update-pricing-button';

interface CursorDashboardHeaderProps {
  canLaunchPricingAgent: boolean;
  planSummary?: string;
}

export function CursorDashboardHeader({
  canLaunchPricingAgent,
  planSummary,
}: CursorDashboardHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-lg font-bold">Cursor Dashboard</h1>
        {planSummary ? <div className="text-xs text-muted">{planSummary}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <UpdatePricingButton configured={canLaunchPricingAgent} />
        <Link
          href="/cursor/upload"
          className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt"
        >
          Upload CSV
        </Link>
      </div>
    </div>
  );
}
