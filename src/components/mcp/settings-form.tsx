'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { McpSettings } from '@/types/mcp';
import { cn } from '@/lib/utils';

interface McpSettingsFormProps {
  settings: McpSettings;
}

export function McpSettingsForm({ settings }: McpSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [exaAllotmentUsd, setExaAllotmentUsd] = useState(
    String(settings.exa_allotment_usd),
  );
  const [exaPurchasedExtraUsd, setExaPurchasedExtraUsd] = useState(
    String(settings.exa_purchased_extra_usd),
  );
  const [tavilyWarnPct, setTavilyWarnPct] = useState(String(settings.tavily_warn_pct));
  const [exaWarnUsd, setExaWarnUsd] = useState(String(settings.exa_warn_usd));
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
      exaAllotmentUsd: Number(exaAllotmentUsd),
      exaPurchasedExtraUsd: Number(exaPurchasedExtraUsd),
      tavilyWarnPct: Number(tavilyWarnPct),
      exaWarnUsd: Number(exaWarnUsd),
    };

    try {
      const response = await fetch('/api/mcp/settings', {
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
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }

  const busy = pending || status === 'saving';

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            Exa monthly allotment ($)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={exaAllotmentUsd}
            onChange={(e) => setExaAllotmentUsd(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <span className="block text-[10px] text-muted">
            Free Tier is $10/mo. Remaining is estimated: allotment − used.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            Exa purchased extra ($)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={exaPurchasedExtraUsd}
            onChange={(e) => setExaPurchasedExtraUsd(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <span className="block text-[10px] text-muted">
            Credits bought beyond the free allotment this month.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            Tavily warn at (% used)
          </span>
          <input
            type="number"
            min={1}
            max={100}
            step="1"
            value={tavilyWarnPct}
            onChange={(e) => setTavilyWarnPct(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            Exa warn at ($ remaining)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={exaWarnUsd}
            onChange={(e) => setExaWarnUsd(e.target.value)}
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
