'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { CursorSettings } from '@/types/cursor';

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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const body = {
      planAmountUsd: Number(planAmountUsd),
      includedPoolUsd: Number(includedPoolUsd),
      billingCycleStartDay: Number(billingCycleStartDay),
    };

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
      return;
    }

    setMessage('Saved');
    startTransition(() => {
      router.refresh();
    });
  }

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
            Included pool ($/mo)
          </span>
          <input
            type="number"
            min={0}
            step="1"
            value={includedPoolUsd}
            onChange={(e) => setIncludedPoolUsd(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
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
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide text-foreground hover:bg-surface-alt disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        {message && <span className="text-xs text-success">{message}</span>}
        {error && <span className="text-xs text-error">{error}</span>}
      </div>
    </form>
  );
}
