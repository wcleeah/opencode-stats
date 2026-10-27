'use client';

import { useState, type JSX } from 'react';

import { grokBotHref, type GrokBotHrefParams } from '@/lib/grok-bot/href';
import {
  GROK_BOT_PERIOD_NAME_MAX,
  setGrokBotPeriodName,
  type GrokBotPeriodName,
} from '@/lib/grok-bot/period-name';

import { PendingAnchor } from '@/components/pending-anchor';

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
  readonly title: string;
  readonly hrefParams: GrokBotHrefParams;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(props.name ?? '');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const edited = setGrokBotPeriodName(props.hrefParams.periodNames, props.startMs, draft);
  const unchanged = draft.trim() === (props.name ?? '');
  if (submitted !== null && (props.name ?? '') === submitted) {
    setOpen(false);
    setDraft(props.name ?? '');
    setSubmitted(null);
  }

  function close(): void {
    setOpen(false);
    setDraft(props.name ?? '');
    setSubmitted(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
        aria-label={`Rename ${props.title}`}
        onClick={() => {
          setDraft(props.name ?? '');
          setSubmitted(null);
          setOpen(true);
        }}
      >
        Rename
      </button>
    );
  }

  const saveClass = 'rounded-md border border-foreground px-2 py-1 text-xs text-foreground';

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">Line name</span>
        <input
          type="text"
          value={draft}
          maxLength={GROK_BOT_PERIOD_NAME_MAX}
          aria-label="Line name"
          onChange={(event) => setDraft(event.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      {edited.ok && !unchanged ? (
        <PendingAnchor
          href={grokBotHref({ ...props.hrefParams, periodNames: edited.names })}
          history="push"
          className={saveClass}
          onClick={() => setSubmitted(draft.trim())}
        >
          Save
        </PendingAnchor>
      ) : (
        <button
          type="button"
          className={edited.ok ? saveClass : `${saveClass} disabled:border-border disabled:text-muted`}
          disabled={!edited.ok}
          onClick={edited.ok ? close : undefined}
        >
          Save
        </button>
      )}
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
        onClick={close}
      >
        Cancel
      </button>
      {edited.ok ? null : (
        <p className="w-full text-xs text-error">{grokBotPeriodNameError(edited.reason)}</p>
      )}
    </div>
  );
}
