'use client';

import { useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';

import { grokBotHref, type GrokBotHrefParams } from '@/lib/grok-bot/href';
import {
  GROK_BOT_PERIOD_NAME_MAX,
  setGrokBotPeriodName,
  type GrokBotPeriodName,
} from '@/lib/grok-bot/period-name';

export function grokBotPeriodNameError(
  reason: 'too-long' | 'unsupported',
): string {
  switch (reason) {
    case 'too-long':
      return `Use at most ${GROK_BOT_PERIOD_NAME_MAX} characters.`;
    case 'unsupported':
      return 'Keep the name on one line.';
    default: {
      const unreachable: never = reason;
      return unreachable;
    }
  }
}

export function GrokBotPeriodNameField(props: {
  readonly startMs: number;
  readonly name: GrokBotPeriodName | undefined;
  readonly hrefParams: GrokBotHrefParams;
}): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(props.name ?? '');
  const [error, setError] = useState<string | null>(null);

  function close(): void {
    setOpen(false);
    setDraft(props.name ?? '');
    setError(null);
  }

  function confirm(): void {
    if (draft.trim() === (props.name ?? '')) {
      close();
      return;
    }
    const edited = setGrokBotPeriodName(props.hrefParams.periodNames, props.startMs, draft);
    if (!edited.ok) {
      setError(grokBotPeriodNameError(edited.reason));
      return;
    }
    router.push(grokBotHref({ ...props.hrefParams, periodNames: edited.names }));
    close();
  }

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
        onClick={() => {
          setDraft(props.name ?? '');
          setError(null);
          setOpen(true);
        }}
      >
        {props.name ?? 'Name'}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">Line name</span>
        <input
          type="text"
          value={draft}
          maxLength={GROK_BOT_PERIOD_NAME_MAX}
          aria-label="Line name"
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="button"
        className="rounded-md border border-foreground px-2 py-1 text-xs text-foreground"
        onClick={confirm}
      >
        Save
      </button>
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
        onClick={close}
      >
        Cancel
      </button>
      {error !== null ? (
        <p className="w-full text-xs text-error">{error}</p>
      ) : null}
    </div>
  );
}
