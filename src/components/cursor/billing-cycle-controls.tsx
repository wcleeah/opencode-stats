'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  getBillingCycleBounds,
  matchBillingCycleOffset,
} from '@/lib/cursor/billing-cycle';
import { cn } from '@/lib/utils';

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
  const router = useRouter();
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

  function goToOffset(offset: number): void {
    const cycle = getBillingCycleBounds(billingCycleStartDay, new Date(), offset);
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', cycle.from);
    params.set('to', cycle.to);
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`);
  }

  const displayOffset = activeOffset ?? 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-[10px] uppercase tracking-wide text-muted">
        Billing cycle
      </span>
      <div className="inline-flex items-center rounded-md border border-border">
        <button
          type="button"
          onClick={() => goToOffset(displayOffset - 1)}
          className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
          aria-label="Previous billing cycle"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => goToOffset(0)}
          className={cn(
            'border-x border-border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors',
            activeOffset === 0
              ? 'text-foreground'
              : 'text-muted hover:text-foreground',
          )}
        >
          This cycle
        </button>
        <button
          type="button"
          onClick={() => goToOffset(displayOffset + 1)}
          className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
          aria-label="Next billing cycle"
        >
          →
        </button>
      </div>
      <span className="text-xs text-foreground tabular-nums">{currentLabel}</span>
      {activeOffset === null && (from || to) && (
        <span className="text-[10px] text-muted">custom range</span>
      )}
    </div>
  );
}
