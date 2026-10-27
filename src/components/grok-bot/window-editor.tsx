'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  clipGrokBotWindow,
  formatGrokBotWallInput,
  grokBotDraftHint,
  parseGrokDraftRange,
} from '@/lib/grok-bot/cycle';
import { grokBotRangeHref, type GrokBotHrefParams } from '@/lib/grok-bot/href';

import { PendingAnchor } from '@/components/pending-anchor';

const RANGE_PENDING_MS = 8_000;

export interface GrokWindowEditorProps {
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly timeZone: 'Asia/Hong_Kong';
  readonly hrefParams: GrokBotHrefParams;
  readonly children: ReactNode;
}

export interface GrokRangeCommit {
  commitRange(startMs: number, endMs: number): void;
  readonly rangePending: boolean;
}

const GrokRangeCommitContext = createContext<GrokRangeCommit | null>(null);

export function useGrokRangeCommit(): GrokRangeCommit {
  const value = useContext(GrokRangeCommitContext);
  if (value === null) throw new Error('useGrokRangeCommit requires GrokWindowEditor');
  return value;
}

export function GrokWindowEditor(props: GrokWindowEditorProps): JSX.Element {
  const router = useRouter();
  const [draftStart, setDraftStart] = useState(() => formatGrokBotWallInput(props.windowStartMs));
  const [draftEnd, setDraftEnd] = useState(() => formatGrokBotWallInput(props.windowEndMs));
  const [trackedStart, setTrackedStart] = useState(props.windowStartMs);
  const [trackedEnd, setTrackedEnd] = useState(props.windowEndMs);
  const [pending, setPending] = useState({ epoch: 0, active: false });
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (props.windowStartMs !== trackedStart || props.windowEndMs !== trackedEnd) {
    setTrackedStart(props.windowStartMs);
    setTrackedEnd(props.windowEndMs);
    setDraftStart(formatGrokBotWallInput(props.windowStartMs));
    setDraftEnd(formatGrokBotWallInput(props.windowEndMs));
    if (pending.active) setPending({ epoch: pending.epoch + 1, active: false });
  }

  useEffect(() => () => {
    if (pendingTimer.current !== null) clearTimeout(pendingTimer.current);
  }, []);

  // useLinkStatus does not observe router.push, so the brush keeps its own flag.
  function armPending(): void {
    const epoch = pending.epoch + 1;
    setPending({ epoch, active: true });
    if (pendingTimer.current !== null) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      pendingTimer.current = null;
      setPending((current) => (
        current.epoch === epoch ? { epoch, active: false } : current
      ));
    }, RANGE_PENDING_MS);
  }

  function commitRange(startMs: number, endMs: number): void {
    const clipped = clipGrokBotWindow(startMs, endMs);
    if (clipped.startMs === props.windowStartMs && clipped.endMs === props.windowEndMs) return;
    armPending();
    router.push(grokBotRangeHref(props.hrefParams, clipped.startMs, clipped.endMs));
  }

  const draft = parseGrokDraftRange(draftStart, draftEnd);
  const applyEnabled = draft.ok
    && (draft.startMs !== props.windowStartMs || draft.endMs !== props.windowEndMs);
  const applyHref = draft.ok
    ? grokBotRangeHref(props.hrefParams, draft.startMs, draft.endMs)
    : grokBotRangeHref(props.hrefParams, props.windowStartMs, props.windowEndMs);
  const hint = applyEnabled ? grokBotDraftHint(draft) : null;
  const commit: GrokRangeCommit = { commitRange, rangePending: pending.active };

  return (
    <GrokRangeCommitContext.Provider value={commit}>
      <div className="space-y-6" data-timezone={props.timeZone}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-muted">Start</span>
              <input
                type="datetime-local"
                step={60}
                value={draftStart}
                aria-label="Window start"
                onChange={(event) => setDraftStart(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-muted">End</span>
              <input
                type="datetime-local"
                step={60}
                value={draftEnd}
                aria-label="Window end"
                onChange={(event) => setDraftEnd(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          {hint === null ? null : (
            <p className="text-[10px] text-muted">{hint}</p>
          )}
          <div className="flex items-center gap-3">
            <PendingAnchor
              href={applyHref}
              history="push"
              disabled={!applyEnabled}
              className={
                applyEnabled
                  ? 'rounded-md border border-border px-3 py-1 text-xs uppercase tracking-wide text-foreground transition-colors'
                  : 'cursor-not-allowed rounded-md border border-border px-3 py-1 text-xs uppercase tracking-wide text-subtle'
              }
            >
              Apply
            </PendingAnchor>
            {pending.active ? (
              <p role="status" className="text-[10px] text-muted">Updating…</p>
            ) : null}
          </div>
        </div>
        {props.children}
      </div>
    </GrokRangeCommitContext.Provider>
  );
}
