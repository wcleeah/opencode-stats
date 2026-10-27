'use client';

import { useState, type JSX } from 'react';

import {
  formatGrokBotWallTime,
  grokBotWallTimeFromUtcMs,
  grokBotWallTimeToUtcMs,
  type GrokBotWallTime,
} from '@/lib/grok-bot/cycle';

const TIME_ZONE = 'Asia/Hong_Kong' as const;

interface GrokBotAddPeriodProps {
  readonly primaryStartMs: number;
  readonly primaryEndMs: number;
  readonly compareStarts: readonly number[];
  readonly onAdd: (startMs: number) => void;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function wallInputValue(utcMs: number): string {
  const wall = grokBotWallTimeFromUtcMs(utcMs, TIME_ZONE);
  return `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}T${pad2(wall.hour)}:${pad2(wall.minute)}`;
}

function parseWallInput(
  value: string,
): Pick<GrokBotWallTime, 'year' | 'month' | 'day' | 'hour' | 'minute'> | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

export function GrokBotAddPeriod(props: GrokBotAddPeriodProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [startValue, setStartValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const span = props.primaryEndMs - props.primaryStartMs;
  const wall = parseWallInput(startValue);
  const chosenStartMs = wall === null ? null : grokBotWallTimeToUtcMs(wall, TIME_ZONE);
  const chosenEndMs = chosenStartMs === null ? null : chosenStartMs + span;
  const duplicate = chosenStartMs !== null && (
    chosenStartMs === props.primaryStartMs || props.compareStarts.includes(chosenStartMs)
  );

  function close(): void {
    setOpen(false);
    setStartValue('');
    setError(null);
  }

  function confirm(): void {
    if (chosenStartMs === null) return;
    if (duplicate) {
      setError('That period is already on the graph.');
      return;
    }
    props.onAdd(chosenStartMs);
    close();
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

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">Compare start</span>
        <input
          type="datetime-local"
          step={60}
          value={startValue}
          aria-label="Compare start"
          onChange={(event) => {
            setStartValue(event.target.value);
            setError(null);
          }}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">Compare end</span>
        <input
          type="datetime-local"
          step={60}
          value={chosenEndMs === null ? '' : wallInputValue(chosenEndMs)}
          aria-label="Compare end"
          readOnly
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-muted"
        />
      </label>
      <button
        type="button"
        disabled={chosenStartMs === null}
        className="rounded-md border border-foreground px-2 py-1 text-xs text-foreground disabled:border-border disabled:text-muted"
        onClick={confirm}
      >
        Add
      </button>
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
      {duplicate || error !== null ? (
        <p className="w-full text-xs text-error">
          {error ?? 'That period is already on the graph.'}
        </p>
      ) : null}
    </div>
  );
}
