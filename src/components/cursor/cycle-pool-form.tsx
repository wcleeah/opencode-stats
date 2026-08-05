'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

interface CyclePoolFormProps {
  cycleStart: string;
  cycleLabel: string;
  amountUsd: number;
  fromCycleOverride: boolean;
  defaultUsd: number;
}

export function CyclePoolForm({
  cycleStart,
  cycleLabel,
  amountUsd,
  fromCycleOverride,
  defaultUsd,
}: CyclePoolFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(String(amountUsd));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setStatus('saving');

    try {
      const response = await fetch('/api/cursor/cycle-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleStart,
          cursorModelsIncludedUsd: Number(value),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const err =
          payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          typeof (payload as { error: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'Failed to save cycle pool';
        setError(err);
        setStatus('error');
        return;
      }

      setStatus('saved');
      startTransition(() => {
        router.refresh();
      });
      window.setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }

  const busy = pending || status === 'saving';

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="block min-w-[10rem] space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">
          Cursor pool for cycle
        </span>
        <input
          type="number"
          min={0}
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm sm:w-32"
        />
      </label>
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
            : 'Save for cycle'}
      </button>
      <div className="text-[10px] text-muted sm:pb-1.5">
        {cycleLabel}
        {fromCycleOverride ? ' · cycle override' : ` · using default $${defaultUsd}`}
      </div>
      {status === 'error' && error && (
        <span className="text-xs text-error">{error}</span>
      )}
    </form>
  );
}
