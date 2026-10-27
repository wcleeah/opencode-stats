'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import {
  getBillingCycleBounds,
  matchBillingCycleOffset,
} from '@/lib/cursor/billing-cycle';
import { cn } from '@/lib/utils';

import { PendingAnchor } from '@/components/pending-anchor';

interface BillingCycleControlsProps {
  billingCycleStartDay: number;
  from?: string;
  to?: string;
  className?: string;
}

export function BillingCycleControls({
  billingCycleStartDay,
  from,
  to,
  className,
}: BillingCycleControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeOffset = useMemo(
    () => matchBillingCycleOffset(billingCycleStartDay, from, to),
    [billingCycleStartDay, from, to],
  );

  const currentLabel = useMemo(() => {
    if (activeOffset === null) {
      return getBillingCycleBounds(billingCycleStartDay, new Date(), 0).label;
    }
    return getBillingCycleBounds(billingCycleStartDay, new Date(), activeOffset).label;
  }, [activeOffset, billingCycleStartDay]);

  function cycleHref(offset: number): string {
    const cycle = getBillingCycleBounds(billingCycleStartDay, new Date(), offset);
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', cycle.from);
    params.set('to', cycle.to);
    params.delete('page');
    return `${pathname}?${params.toString()}`;
  }

  const displayOffset = activeOffset ?? 0;
  const linkClass = 'px-2 py-1 text-xs text-muted hover:text-foreground transition-colors';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-[10px] uppercase tracking-wide text-muted">
        Billing cycle · 16:00 HKT
      </span>
      <div className="inline-flex items-center rounded-md border border-border">
        <PendingAnchor
          href={cycleHref(displayOffset - 1)}
          history="replace"
          className={linkClass}
          ariaLabel="Previous billing cycle"
          title={getBillingCycleBounds(billingCycleStartDay, new Date(), displayOffset - 1).label}
        >
          ←
        </PendingAnchor>
        <PendingAnchor
          href={cycleHref(0)}
          history="replace"
          title={getBillingCycleBounds(billingCycleStartDay, new Date(), 0).label}
          className={cn(
            'border-x border-border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors',
            activeOffset === 0
              ? 'text-foreground'
              : 'text-muted hover:text-foreground',
          )}
        >
          This cycle
        </PendingAnchor>
        <PendingAnchor
          href={cycleHref(displayOffset + 1)}
          history="replace"
          className={linkClass}
          ariaLabel="Next billing cycle"
          title={getBillingCycleBounds(billingCycleStartDay, new Date(), displayOffset + 1).label}
        >
          →
        </PendingAnchor>
      </div>
      <span className="text-xs text-foreground tabular-nums">{currentLabel}</span>
      {activeOffset === null && (from || to) && (
        <span className="text-[10px] text-muted">custom range</span>
      )}
    </div>
  );
}
