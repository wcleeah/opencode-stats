'use client';

import { useEffect, useState, type JSX, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { formatCost, formatTokens } from '@/lib/format';
import {
  applyGrokBotLens,
  grokBotHrefForLens,
  grokBotLensFromSearch,
  projectGrokBotBoard,
  type GrokBotBoard,
  type GrokBotLedger,
  type GrokBotLens,
  type GrokBotLensCommand,
} from '@/lib/grok-bot/board';
import type { GrokBotCharge } from '@/lib/grok-bot/charge';
import {
  formatGrokBotWallTime,
  grokBotWallTimeFromUtcMs,
} from '@/lib/grok-bot/cycle';
import { GROK_BOT_INS_LINE, GROK_BOT_OUTS_LINE } from '@/lib/grok-bot/href';
import { grokBotCompareStarts, grokBotPeriodCaption } from '@/lib/grok-bot/window';

import { GrokBotAddPeriod } from '@/components/grok-bot/add-period';
import { GrokBotSeriesChart } from '@/components/grok-bot/usage-chart';
import { GrokBotWindowStats } from '@/components/grok-bot/window-stats';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface GrokAnchor {
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

interface GrokBotScreenProps {
  readonly ledger: GrokBotLedger;
  readonly initialLens: GrokBotLens;
}

function sameLens(left: GrokBotLens, right: GrokBotLens): boolean {
  if (
    left.usage !== right.usage
    || left.mode !== right.mode
    || left.page !== right.page
    || left.focusStartMs !== right.focusStartMs
    || left.compareStarts.length !== right.compareStarts.length
    || left.window.kind !== right.window.kind
  ) {
    return false;
  }
  if (left.compareStarts.some((start, index) => start !== right.compareStarts[index])) {
    return false;
  }
  if (left.window.kind === 'cycle' && right.window.kind === 'cycle') {
    return left.window.offset === right.window.offset;
  }
  if (left.window.kind === 'range' && right.window.kind === 'range') {
    return left.window.startMs === right.window.startMs
      && left.window.endMs === right.window.endMs;
  }
  return false;
}

function useGrokBotBoard(ledger: GrokBotLedger, initialLens: GrokBotLens): {
  board: GrokBotBoard;
  anchor: (command: GrokBotLensCommand) => GrokAnchor;
  commit: (command: GrokBotLensCommand) => void;
  refresh: () => void;
} {
  const [lens, setLens] = useState(initialLens);
  const [seenLedger, setSeenLedger] = useState(ledger);
  const [urlFix, setUrlFix] = useState<string | null>(null);
  const router = useRouter();

  if (seenLedger !== ledger) {
    const next = grokBotLensFromSearch(ledger, grokBotHrefForLens(ledger, lens));
    setSeenLedger(ledger);
    if (!sameLens(next, lens)) setLens(next);
    if (next.page !== lens.page || next.usage !== lens.usage) {
      setUrlFix(grokBotHrefForLens(ledger, next));
    }
  }

  const board = projectGrokBotBoard(ledger, lens);

  useEffect(() => {
    const onPop = (): void => {
      setLens(grokBotLensFromSearch(ledger, window.location.search));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [ledger]);

  // First mount leaves urlFix null, so a dirty incoming URL stays.
  // replaceState does not add a history entry.
  useEffect(() => {
    if (urlFix === null) return;
    window.history.replaceState(null, '', urlFix);
  }, [urlFix]);

  function commit(command: GrokBotLensCommand): void {
    const next = applyGrokBotLens(ledger, lens, command);
    const href = grokBotHrefForLens(ledger, next);
    if (href === grokBotHrefForLens(ledger, lens)) return;
    window.history.pushState(null, '', href);
    setLens(next);
  }

  function anchor(command: GrokBotLensCommand): GrokAnchor {
    return {
      href: grokBotHrefForLens(ledger, applyGrokBotLens(ledger, lens, command)),
      onClick: (event) => {
        if (
          event.metaKey
          || event.ctrlKey
          || event.shiftKey
          || event.altKey
          || event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        commit(command);
      },
    };
  }

  function refresh(): void {
    router.refresh();
  }

  return { board, anchor, commit, refresh };
}

function chargeText(charge: GrokBotCharge): string {
  switch (charge.status) {
    case 'reported':
      return formatCost(charge.split.totalUsd, false);
    case 'rated':
      return formatCost(charge.split.totalUsd, true);
    case 'partial':
      return `${formatCost(charge.split.totalUsd, true)} · cache write unpriced`;
    case 'unbilled':
      return 'Free';
    case 'reported-missing':
      return 'Missing';
    case 'unpriced':
      return 'Unpriced';
  }
}

function eventTime(utcMs: number): string {
  return formatGrokBotWallTime(grokBotWallTimeFromUtcMs(utcMs, 'Asia/Hong_Kong'));
}

function PeriodStrip(props: {
  board: GrokBotBoard;
  anchor: (command: GrokBotLensCommand) => GrokAnchor;
  commit: (command: GrokBotLensCommand) => void;
}): JSX.Element {
  const { board, anchor, commit } = props;
  const periods = board.charts.periods;
  const starts = grokBotCompareStarts(periods);
  const chipOn = 'inline-flex items-center gap-1 rounded-md border border-foreground px-2 py-1 text-xs text-foreground';
  const chipOff = 'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground';

  return (
    <>
      {periods.length > 1
        ? periods.map((period) => {
            const caption = grokBotPeriodCaption(period, periods);
            const focused = period.startMs === board.focusStartMs;
            return (
              <span
                key={period.startMs}
                title={period.label}
                className={focused ? chipOn : chipOff}
              >
                <a
                  {...anchor({ type: 'focus', startMs: period.startMs })}
                  aria-current={focused ? 'page' : undefined}
                >
                  {caption}
                </a>
                {period.role === 'compare' ? (
                  <a
                    {...anchor({ type: 'remove-compare', startMs: period.startMs })}
                    aria-label={`Remove ${caption}`}
                    className="text-muted hover:text-foreground"
                  >
                    ×
                  </a>
                ) : null}
              </span>
            );
          })
        : null}
      <GrokBotAddPeriod
        primaryStartMs={board.window.startMs}
        primaryEndMs={board.window.endMs}
        compareStarts={starts}
        onAdd={(startMs) => commit({ type: 'add-compare', startMs })}
      />
    </>
  );
}

function CycleLinks(props: {
  board: GrokBotBoard;
  anchor: (command: GrokBotLensCommand) => GrokAnchor;
  commit: (command: GrokBotLensCommand) => void;
}): JSX.Element {
  const { board, anchor, commit } = props;
  const linkClass = 'px-2 py-1 text-xs text-muted hover:text-foreground transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted">
        Grok cycle · Asia/Hong_Kong
      </span>
      <div className="inline-flex items-center rounded-md border border-border">
        <a
          {...anchor({ type: 'cycle', offset: board.cycle.offset - 1 })}
          className={linkClass}
          aria-label="Previous cycle"
        >
          ←
        </a>
        <a
          {...anchor({ type: 'cycle', offset: 0 })}
          className="border-x border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground transition-colors"
        >
          This cycle
        </a>
        <a
          {...anchor({ type: 'cycle', offset: board.cycle.offset + 1 })}
          className={linkClass}
          aria-label="Next cycle"
        >
          →
        </a>
      </div>
      <span className="text-xs text-muted">{board.cycle.label}</span>
      {board.windowMode.kind === 'range' ? (
        <span className="text-xs text-muted">
          {eventTime(board.window.startMs)}
          {' to '}
          {eventTime(board.window.endMs)}
        </span>
      ) : null}
      <PeriodStrip board={board} anchor={anchor} commit={commit} />
    </div>
  );
}

function UsageLinks(props: {
  board: GrokBotBoard;
  anchor: (command: GrokBotLensCommand) => GrokAnchor;
}): JSX.Element {
  const { board, anchor } = props;
  const selected = new Set(board.selectedUsageTypeIds);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted">Usage</span>
      {board.usageTypes.map((type) => {
        const on = selected.has(type.id);
        return (
          <a
            key={type.id}
            {...anchor({ type: 'toggle-usage', id: type.id })}
            aria-current={on ? 'true' : undefined}
            className={
              on
                ? 'rounded-md border border-foreground px-2 py-1 text-xs text-foreground'
                : 'rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground'
            }
          >
            {type.label}
          </a>
        );
      })}
    </div>
  );
}

function EventPages(props: {
  page: number;
  totalPages: number;
  anchor: (command: GrokBotLensCommand) => GrokAnchor;
}): JSX.Element | null {
  const { page, totalPages, anchor } = props;
  if (totalPages <= 1) return null;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const linkClass = 'px-2 py-1 text-muted hover:text-foreground transition-colors';

  return (
    <nav className="flex items-center gap-1 text-sm">
      {page > 1 ? (
        <a {...anchor({ type: 'page', page: page - 1 })} className={linkClass}>
          &lt; prev
        </a>
      ) : (
        <span className="px-2 py-1 text-subtle">&lt; prev</span>
      )}
      {start > 1 ? (
        <>
          <a {...anchor({ type: 'page', page: 1 })} className={linkClass}>1</a>
          {start > 2 ? <span className="px-1 text-subtle">...</span> : null}
        </>
      ) : null}
      {pages.map((item) => (
        <a
          key={item}
          {...anchor({ type: 'page', page: item })}
          className={
            item === page
              ? 'px-2 py-1 transition-colors text-foreground font-bold'
              : linkClass
          }
        >
          {item}
        </a>
      ))}
      {end < totalPages ? (
        <>
          {end < totalPages - 1 ? <span className="px-1 text-subtle">...</span> : null}
          <a {...anchor({ type: 'page', page: totalPages })} className={linkClass}>
            {totalPages}
          </a>
        </>
      ) : null}
      {page < totalPages ? (
        <a {...anchor({ type: 'page', page: page + 1 })} className={linkClass}>
          next &gt;
        </a>
      ) : (
        <span className="px-2 py-1 text-subtle">next &gt;</span>
      )}
    </nav>
  );
}

export function GrokBotScreen({ ledger, initialLens }: GrokBotScreenProps): JSX.Element {
  const { board, anchor, commit, refresh } = useGrokBotBoard(ledger, initialLens);
  const mode = board.charts.mode;
  const totalPages = Math.ceil(board.totalRows / board.pageSize);
  const chartProps = {
    charts: board.charts,
    windowStartMs: board.window.startMs,
    windowEndMs: board.window.endMs,
    timeZone: board.timeZone,
    bucketMs: board.window.bucketMs,
    focusStartMs: board.focusStartMs,
    onWindow: (startMs: number, endMs: number) => commit({ type: 'range', startMs, endMs }),
    onFocus: (startMs: number) => commit({ type: 'focus', startMs }),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Grokbot Usage</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt"
          >
            Refresh
          </button>
          <Link
            href="/cursor/upload"
            className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt"
          >
            Upload CSV
          </Link>
        </div>
      </div>
      <CycleLinks board={board} anchor={anchor} commit={commit} />
      <UsageLinks board={board} anchor={anchor} />
      {board.cycleHasRows ? (
        <>
          <GrokBotWindowStats
            periods={board.charts.periods}
            focusStartMs={board.focusStartMs}
          />
          <a
            {...anchor({ type: 'chart-mode' })}
            aria-pressed={mode === 'ins-outs'}
            className={
              mode === 'ins-outs'
                ? 'rounded-md border border-foreground px-2 py-1 text-xs text-foreground'
                : 'rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground'
            }
          >
            {GROK_BOT_INS_LINE} / {GROK_BOT_OUTS_LINE}
          </a>
          <Card>
            <div className="mb-3 text-xs text-muted uppercase tracking-wider">Tokens</div>
            <GrokBotSeriesChart {...chartProps} measure="tokens" />
          </Card>
          <Card>
            <div className="mb-3 text-xs text-muted uppercase tracking-wider">Spending</div>
            <GrokBotSeriesChart {...chartProps} measure="usd" />
          </Card>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs text-muted uppercase tracking-wider">Events</div>
              {board.charts.periods.length > 1
                ? board.charts.periods.map((period) => {
                    const caption = grokBotPeriodCaption(period, board.charts.periods);
                    const focused = period.startMs === board.focusStartMs;
                    return (
                      <a
                        key={period.startMs}
                        {...anchor({ type: 'focus', startMs: period.startMs })}
                        aria-current={focused ? 'page' : undefined}
                        className={
                          focused
                            ? 'rounded-md border border-foreground px-2 py-1 text-xs text-foreground'
                            : 'rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground'
                        }
                      >
                        {caption}
                      </a>
                    );
                  })
                : null}
            </div>
            {board.totalRows === 0 ? (
              <Card>
                <p className="text-sm text-foreground">This window or filter has no rows.</p>
              </Card>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell header>Time</TableCell>
                      <TableCell header>Usage</TableCell>
                      <TableCell header>Kind</TableCell>
                      <TableCell header align="right">Input</TableCell>
                      <TableCell header align="right">Cache write</TableCell>
                      <TableCell header align="right">Cache read</TableCell>
                      <TableCell header align="right">Output</TableCell>
                      <TableCell header align="right">Total</TableCell>
                      <TableCell header align="right">Charge</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {board.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-muted">{eventTime(row.eventAt)}</TableCell>
                        <TableCell className="font-medium text-foreground">{row.label}</TableCell>
                        <TableCell>{row.kind}</TableCell>
                        <TableCell align="right">{formatTokens(row.tokensInput)}</TableCell>
                        <TableCell align="right">{formatTokens(row.tokensCacheWrite)}</TableCell>
                        <TableCell align="right">{formatTokens(row.tokensCacheRead)}</TableCell>
                        <TableCell align="right">{formatTokens(row.tokensOutput)}</TableCell>
                        <TableCell align="right">{formatTokens(row.tokensTotal)}</TableCell>
                        <TableCell align="right">{chargeText(row.charge)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <EventPages page={board.page} totalPages={totalPages} anchor={anchor} />
              </>
            )}
          </div>
        </>
      ) : (
        <Card className="space-y-3">
          <p className="text-sm text-foreground">No grok bot usage in this cycle.</p>
          <Link
            href="/cursor/upload"
            className="inline-block text-xs text-muted hover:text-foreground"
          >
            Upload CSV
          </Link>
        </Card>
      )}
    </div>
  );
}
