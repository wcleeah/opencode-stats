'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { CursorSettings } from '@/types/cursor';
import { cn } from '@/lib/utils';

interface CursorSettingsFormProps {
  settings: CursorSettings;
}

export function CursorSettingsForm({ settings }: CursorSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [planAmountUsd, setPlanAmountUsd] = useState(String(settings.plan_amount_usd));
  const [includedPoolUsd, setIncludedPoolUsd] = useState(
    String(settings.included_pool_usd),
  );
  const [billingCycleStartDay, setBillingCycleStartDay] = useState(
    String(settings.billing_cycle_start_day),
  );
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'saved') return;
    const timer = window.setTimeout(() => setStatus('idle'), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setStatus('saving');

    const body = {
      planAmountUsd: Number(planAmountUsd),
      includedPoolUsd: Number(includedPoolUsd),
      billingCycleStartDay: Number(billingCycleStartDay),
    };

    try {
      const response = await fetch('/api/cursor/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const err =
          payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          typeof (payload as { error: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'Failed to save settings';
        setError(err);
        setStatus('error');
        return;
      }

      setStatus('saved');
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      setStatus('error');
    }
  }

  const busy = pending || status === 'saving';

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            Plan paid ($/mo)
          </span>
          <input
            type="number"
            min={0}
            step="1"
            value={planAmountUsd}
            onChange={(e) => setPlanAmountUsd(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            Other Models included (at least $)
          </span>
          <input
            type="number"
            min={0}
            step="1"
            value={includedPoolUsd}
            onChange={(e) => setIncludedPoolUsd(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <span className="block text-[10px] text-muted">
            Floor for third-party models (Ultra ≥$400). Cursor Models are separate.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            Cycle start day (1–28)
          </span>
          <input
            type="number"
            min={1}
            max={28}
            step="1"
            value={billingCycleStartDay}
            onChange={(e) => setBillingCycleStartDay(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs uppercase tracking-wide transition-colors disabled:opacity-50',
            status === 'saved'
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-border text-foreground hover:bg-surface-alt',
          )}
        >
          {status === 'saving' || pending
            ? 'Saving…'
            : status === 'saved'
              ? 'Saved ✓'
              : 'Save settings'}
        </button>

        {status === 'saved' && (
          <span
            role="status"
            className="rounded-sm border border-success/30 bg-success/10 px-2 py-1 text-xs text-success"
          >
            Settings saved
          </span>
        )}
        {status === 'error' && error && (
          <span
            role="alert"
            className="rounded-sm border border-error/30 bg-error/10 px-2 py-1 text-xs text-error"
          >
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
