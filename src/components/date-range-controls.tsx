'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

interface DateRangeControlsProps {
  from?: string;
  to?: string;
  className?: string;
}

export function DateRangeControls({ from, to, className }: DateRangeControlsProps) {
  const [localFrom, setLocalFrom] = useState(from ?? '');
  const [localTo, setLocalTo] = useState(to ?? '');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function startOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function addDays(value: Date, days: number): Date {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
  }

  const presets = useMemo(() => {
    const now = new Date();
    const today = formatDate(now);
    const sevenDaysStart = formatDate(startOfDay(addDays(now, -6)));
    const firstOfMonth = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
    return {
      today: { from: today, to: today },
      sevenDays: { from: sevenDaysStart, to: today },
      month: { from: firstOfMonth, to: today },
    };
  }, []);

  const canApply = useMemo(
    () => localFrom.trim() !== (from ?? '') || localTo.trim() !== (to ?? ''),
    [localFrom, localTo, from, to],
  );

  const activePreset = useMemo(() => {
    if (from === presets.today.from && to === presets.today.to) return 'today';
    if (from === presets.sevenDays.from && to === presets.sevenDays.to) return 'sevenDays';
    if (from === presets.month.from && to === presets.month.to) return 'month';
    return null;
  }, [from, to, presets]);

  useEffect(() => {
    setLocalFrom(from ?? '');
    setLocalTo(to ?? '');
  }, [from, to]);

  function buildUrl(nextFrom: string, nextTo: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (nextFrom.trim()) {
      params.set('from', nextFrom.trim());
    } else {
      params.delete('from');
    }
    if (nextTo.trim()) {
      params.set('to', nextTo.trim());
    } else {
      params.delete('to');
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function applyRange() {
    router.replace(buildUrl(localFrom, localTo));
  }

  function applyPreset(nextFrom: string, nextTo: string) {
    setLocalFrom(nextFrom);
    setLocalTo(nextTo);
    router.replace(buildUrl(nextFrom, nextTo));
  }

  function clearRange() {
    setLocalFrom('');
    setLocalTo('');
    router.replace(buildUrl('', ''));
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => applyPreset(presets.today.from, presets.today.to)}
          className={cn(
            'rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide',
            activePreset === 'today'
              ? 'text-foreground border-accent'
              : 'text-muted hover:text-foreground transition-colors',
          )}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => applyPreset(presets.sevenDays.from, presets.sevenDays.to)}
          className={cn(
            'rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide',
            activePreset === 'sevenDays'
              ? 'text-foreground border-accent'
              : 'text-muted hover:text-foreground transition-colors',
          )}
        >
          7 days
        </button>
        <button
          type="button"
          onClick={() => applyPreset(presets.month.from, presets.month.to)}
          className={cn(
            'rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide',
            activePreset === 'month'
              ? 'text-foreground border-accent'
              : 'text-muted hover:text-foreground transition-colors',
          )}
        >
          Current month
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
        <label className="text-[10px] uppercase tracking-wide text-muted">From</label>
        <input
          type="date"
          value={localFrom}
          onChange={(event) => setLocalFrom(event.target.value)}
          className="bg-transparent text-xs text-foreground outline-none"
        />
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
        <label className="text-[10px] uppercase tracking-wide text-muted">To</label>
        <input
          type="date"
          value={localTo}
          onChange={(event) => setLocalTo(event.target.value)}
          className="bg-transparent text-xs text-foreground outline-none"
        />
      </div>
      <button
        type="button"
        onClick={applyRange}
        disabled={!canApply}
        className={cn(
          'rounded-md border border-border px-3 py-1 text-xs uppercase tracking-wide',
          canApply
            ? 'text-foreground hover:text-accent transition-colors'
            : 'text-grep-8 cursor-not-allowed',
        )}
      >
        Apply
      </button>
      <button
        type="button"
        onClick={clearRange}
        disabled={!localFrom && !localTo}
        className={cn(
          'rounded-md border border-border px-3 py-1 text-xs uppercase tracking-wide',
          localFrom || localTo
            ? 'text-muted hover:text-foreground transition-colors'
            : 'text-grep-8 cursor-not-allowed',
        )}
      >
        Clear
      </button>
    </div>
  );
}
