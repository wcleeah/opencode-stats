'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

interface McpRefreshButtonProps {
  lastFetchedAt: number | null;
  nextRefreshAt: number | null;
}

export function McpRefreshButton({
  lastFetchedAt,
  nextRefreshAt,
}: McpRefreshButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'refreshing' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const coolingDown = nextRefreshAt !== null && now < nextRefreshAt;
  const busy = pending || status === 'refreshing';

  async function onRefresh(): Promise<void> {
    setError(null);
    setStatus('refreshing');
    try {
      const response = await fetch('/api/mcp/refresh', { method: 'POST' });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const err =
          payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          typeof (payload as { error: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'Refresh failed';
        setError(err);
        setStatus('error');
        return;
      }
      setStatus('idle');
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void onRefresh()}
        disabled={busy || coolingDown}
        className={cn(
          'rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide',
          'hover:bg-surface-alt disabled:opacity-50',
        )}
      >
        {busy ? 'Refreshing…' : coolingDown ? 'Cached' : 'Refresh'}
      </button>
      {lastFetchedAt !== null && (
        <span className="text-[10px] text-muted">
          Polled {new Date(lastFetchedAt).toISOString().slice(11, 16)} UTC
        </span>
      )}
      {status === 'error' && error && (
        <span role="alert" className="text-xs text-error">
          {error}
        </span>
      )}
    </div>
  );
}
