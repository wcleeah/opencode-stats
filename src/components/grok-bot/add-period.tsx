'use client';

import { useState, type JSX } from 'react';

import {
  formatGrokBotWallInput,
  formatGrokBotWallTime,
  grokBotWallTimeFromUtcMs,
  grokBotWallTimeToUtcMs,
  parseGrokBotWallInput,
} from '@/lib/grok-bot/cycle';
import { grokBotHref, type GrokBotHrefParams } from '@/lib/grok-bot/href';
import {
  GROK_BOT_PERIOD_NAME_MAX,
  setGrokBotPeriodName,
} from '@/lib/grok-bot/period-name';

import { grokBotPeriodNameError } from '@/components/grok-bot/period-name-field';
import { PendingAnchor } from '@/components/pending-anchor';

const TIME_ZONE = 'Asia/Hong_Kong' as const;
const NO_COMPARE_STARTS: readonly number[] = [];

interface GrokBotAddPeriodProps {
  readonly hrefParams: GrokBotHrefParams;
  readonly primaryDurationMs: number;
}

export function GrokBotAddPeriod(props: GrokBotAddPeriodProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [startValue, setStartValue] = useState('');
  const [nameValue, setNameValue] = useState('');
  const [armedStart, setArmedStart] = useState<number | null>(null);
  const wall = parseGrokBotWallInput(startValue);
  const chosenStartMs = wall === null ? null : grokBotWallTimeToUtcMs(wall, TIME_ZONE);
  const chosenEndMs = chosenStartMs === null
    ? null
    : chosenStartMs + props.primaryDurationMs;
  const compareStarts = props.hrefParams.compareStarts ?? NO_COMPARE_STARTS;
  const duplicate = chosenStartMs !== null && (
    chosenStartMs === props.hrefParams.primaryStartMs || compareStarts.includes(chosenStartMs)
  );
  const edited = chosenStartMs === null
    ? null
    : setGrokBotPeriodName(props.hrefParams.periodNames, chosenStartMs, nameValue);
  const canAdd = chosenStartMs !== null && !duplicate && edited?.ok === true;
  if (armedStart !== null && compareStarts.includes(armedStart)) {
    setOpen(false);
    setStartValue('');
    setNameValue('');
    setArmedStart(null);
  }

  function close(): void {
    setOpen(false);
    setStartValue('');
    setNameValue('');
    setArmedStart(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        Add period
      </button>
    );
  }

  const addHref = canAdd && edited?.ok === true && chosenStartMs !== null
    ? grokBotHref({
      ...props.hrefParams,
      compareStarts: [...compareStarts, chosenStartMs],
      periodNames: edited.names,
    })
    : '/cursor/grok';
  const nameError = edited !== null && edited.ok === false
    ? grokBotPeriodNameError(edited.reason)
    : null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">Compare start</span>
        <input
          type="datetime-local"
          step={60}
          value={startValue}
          aria-label="Compare start"
          onChange={(event) => setStartValue(event.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">Line name</span>
        <input
          type="text"
          value={nameValue}
          maxLength={GROK_BOT_PERIOD_NAME_MAX}
          aria-label="Line name"
          onChange={(event) => setNameValue(event.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">Compare end</span>
        <input
          type="datetime-local"
          step={60}
          value={chosenEndMs === null ? '' : formatGrokBotWallInput(chosenEndMs)}
          aria-label="Compare end"
          readOnly
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-muted"
        />
      </label>
      <PendingAnchor
        href={addHref}
        history="push"
        disabled={!canAdd}
        className="rounded-md border border-foreground px-2 py-1 text-xs text-foreground disabled:border-border disabled:text-muted"
        onClick={() => {
          if (chosenStartMs !== null) setArmedStart(chosenStartMs);
        }}
      >
        Add
      </PendingAnchor>
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
        onClick={close}
      >
        Cancel
      </button>
      {chosenEndMs !== null && chosenStartMs !== null ? (
        <p className="w-full text-xs text-muted">
          {formatGrokBotWallTime(grokBotWallTimeFromUtcMs(chosenStartMs, TIME_ZONE))}
          {' to '}
          {formatGrokBotWallTime(grokBotWallTimeFromUtcMs(chosenEndMs, TIME_ZONE))}
        </p>
      ) : (
        <p className="w-full text-xs text-muted">End follows the current range.</p>
      )}
      {duplicate || nameError !== null ? (
        <p className="w-full text-xs text-error">
          {nameError ?? 'That period is already on the graph.'}
        </p>
      ) : null}
    </div>
  );
}
