'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

interface UpdatePricingButtonProps {
  configured: boolean;
}

type LaunchState =
  | { status: 'idle' }
  | { status: 'launching' }
  | { status: 'launched'; agentUrl: string }
  | { status: 'error'; error: string };

function errorFromPayload(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

export function UpdatePricingButton({ configured }: UpdatePricingButtonProps) {
  const [state, setState] = useState<LaunchState>({ status: 'idle' });

  async function onLaunch(): Promise<void> {
    if (!configured) return;
    setState({ status: 'launching' });
    try {
      const response = await fetch('/api/cursor/update-pricing', { method: 'POST' });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setState({
          status: 'error',
          error: errorFromPayload(payload, 'Failed to launch pricing agent'),
        });
        return;
      }

      const data =
        payload && typeof payload === 'object' && 'data' in payload
          ? (payload as { data: unknown }).data
          : null;
      const agentUrl =
        data &&
        typeof data === 'object' &&
        'agentUrl' in data &&
        typeof (data as { agentUrl: unknown }).agentUrl === 'string'
          ? (data as { agentUrl: string }).agentUrl
          : null;

      if (!agentUrl) {
        setState({ status: 'error', error: 'Launch succeeded but no agent URL was returned.' });
        return;
      }

      setState({ status: 'launched', agentUrl });
    } catch (err) {
      setState({
        status: 'error',
        error: err instanceof Error ? err.message : 'Network error',
      });
    }
  }

  const busy = state.status === 'launching';
  const disabled = busy || !configured;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void onLaunch()}
        disabled={disabled}
        title={
          configured
            ? 'Launch a Cursor Cloud Agent to sync list rates from docs'
            : 'Set CURSOR_API_KEY to launch a Cloud Agent that updates pricing'
        }
        className={cn(
          'rounded-md border px-3 py-1.5 text-xs uppercase tracking-wide',
          'disabled:opacity-50',
          state.status === 'launched'
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-border text-foreground hover:bg-surface-alt',
        )}
      >
        {busy
          ? 'Launching…'
          : state.status === 'launched'
            ? 'Agent launched'
            : 'Update pricing'}
      </button>
      {state.status === 'launched' && (
        <a
          href={state.agentUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
        >
          Open agent
        </a>
      )}
      {state.status === 'error' && (
        <span role="alert" className="max-w-xs text-xs text-error">
          {state.error}
        </span>
      )}
      {!configured && (
        <span className="text-[10px] text-muted">Needs CURSOR_API_KEY</span>
      )}
    </div>
  );
}
