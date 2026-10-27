export const dynamic = 'force-dynamic';

import { formatCost, formatTokens } from '@/lib/format';
import {
  formatGrokBotWallTime,
  grokBotWallTimeFromUtcMs,
} from '@/lib/grok-bot/cycle';
import {
  GROK_BOT_INS_LINE,
  GROK_BOT_OUTS_LINE,
  grokBotHref,
  removeGrokBotCompareStart,
  toggleGrokBotUsageParam,
  type GrokBotChartMode,
  type GrokBotHrefParams,
} from '@/lib/grok-bot/href';
import { grokBotPeriodNames } from '@/lib/grok-bot/period-name';
import { grokBotPeriodTitle } from '@/lib/grok-bot/period-title';
import type { GrokBotCharge } from '@/lib/grok-bot/rates';
import { grokBotCompareStarts } from '@/lib/grok-bot/window';
import { getCursorSettings } from '@/lib/queries/cursor';
import { getGrokBotBoard, type GrokBotBoard } from '@/lib/queries/grok-bot';

import { GrokBotAddPeriod } from '@/components/grok-bot/add-period';
import { GrokBotPeriodNameField } from '@/components/grok-bot/period-name-field';
import { GrokBotSeriesChart } from '@/components/grok-bot/usage-chart';
import { GrokWindowEditor } from '@/components/grok-bot/window-editor';
import { GrokBotWindowStats } from '@/components/grok-bot/window-stats';
import { PendingAnchor } from '@/components/pending-anchor';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface GrokPageProps {
  searchParams: Promise<{
    cycle?: string;
    start?: string;
    end?: string;
    usage?: string;
    page?: string;
    view?: string;
    cmp?: string;
    focus?: string;
    names?: string;
  }>;
}

function linkParams(board: GrokBotBoard): GrokBotHrefParams {
  const windowHref = board.windowMode.kind === 'cycle'
    ? { cycle: board.windowMode.offset }
    : { startMs: board.windowMode.startMs, endMs: board.windowMode.endMs };
  return {
    ...windowHref,
    usage: board.usageParam,
    mode: board.charts.mode,
    compareStarts: grokBotCompareStarts(board.charts.periods),
    focusStartMs: board.focusStartMs,
    primaryStartMs: board.window.startMs,
    periodNames: grokBotPeriodNames(board.charts.periods),
  };
}

function hrefFor(
  board: GrokBotBoard,
  overrides: Partial<GrokBotHrefParams> = {},
): string {
  const base = linkParams(board);
  return grokBotHref({
    ...base,
    ...overrides,
    periodNames: overrides.periodNames ?? base.periodNames,
  });
}

function focusHref(board: GrokBotBoard, startMs: number): string {
  return hrefFor(board, { focusStartMs: startMs, page: undefined });
}

function GrokHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-bold">Grokbot Usage</h1>
      <PendingAnchor
        href="/cursor/upload"
        history="push"
        className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt"
      >
        Upload CSV
      </PendingAnchor>
    </div>
  );
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

function PeriodStrip({ board }: { board: GrokBotBoard }) {
  const periods = board.charts.periods;
  const starts = grokBotCompareStarts(periods);
  const hrefParams = linkParams(board);
  const chipOn = 'inline-flex items-center gap-1 rounded-md border border-foreground px-2 py-1 text-xs text-foreground';
  const chipOff = 'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground';
  const showChips = periods.length > 1;

  return (
    <>
      {periods.map((period, index) => {
        const title = grokBotPeriodTitle(index, periods);
        const focused = period.startMs === board.focusStartMs;
        const removeHref = showChips && period.role === 'compare'
          ? hrefFor(board, {
              compareStarts: removeGrokBotCompareStart(starts, period.startMs),
              focusStartMs: period.startMs === board.focusStartMs
                ? board.window.startMs
                : board.focusStartMs,
            })
          : undefined;
        return (
          <span key={period.startMs} className="inline-flex items-center gap-1">
            {showChips ? (
              <span title={period.label} className={focused ? chipOn : chipOff}>
                {focused ? (
                  <span aria-current="page">{title}</span>
                ) : (
                  <PendingAnchor
                    href={focusHref(board, period.startMs)}
                    history="push"
                  >
                    {title}
                  </PendingAnchor>
                )}
                {removeHref === undefined ? null : (
                  <PendingAnchor
                    href={removeHref}
                    history="push"
                    ariaLabel={`Remove ${title}`}
                    className="text-muted hover:text-foreground"
                  >
                    ×
                  </PendingAnchor>
                )}
              </span>
            ) : null}
            <GrokBotPeriodNameField
              startMs={period.startMs}
              name={period.name}
              title={title}
              hrefParams={hrefParams}
            />
          </span>
        );
      })}
      <GrokBotAddPeriod
        hrefParams={hrefParams}
        primaryDurationMs={board.window.endMs - board.window.startMs}
      />
    </>
  );
}

function CycleLinks({ board }: { board: GrokBotBoard }) {
  const previousHref = hrefFor(board, { cycle: board.cycle.offset - 1, page: undefined });
  const nextHref = hrefFor(board, { cycle: board.cycle.offset + 1, page: undefined });
  const thisHref = hrefFor(board, { cycle: 0, page: undefined });
  const linkClass = 'px-2 py-1 text-xs text-muted hover:text-foreground transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted">
        Grok cycle · Asia/Hong_Kong
      </span>
      <div className="inline-flex items-center rounded-md border border-border">
        <PendingAnchor
          href={previousHref}
          history="push"
          className={linkClass}
          ariaLabel="Previous cycle"
          title={board.cycleLinkLabels.previous}
        >
          ←
        </PendingAnchor>
        <PendingAnchor
          href={thisHref}
          history="push"
          title={board.cycleLinkLabels.current}
          className="border-x border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground transition-colors"
        >
          This cycle
        </PendingAnchor>
        <PendingAnchor
          href={nextHref}
          history="push"
          className={linkClass}
          ariaLabel="Next cycle"
          title={board.cycleLinkLabels.next}
        >
          →
        </PendingAnchor>
      </div>
      <PeriodStrip board={board} />
    </div>
  );
}

function UsageLinks({ board }: { board: GrokBotBoard }) {
  const catalogIds = board.usageTypes.map((entry) => entry.id);
  const selected = new Set(board.selectedUsageTypeIds);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted">Usage</span>
      {board.usageTypes.map((type) => {
        const href = hrefFor(board, {
          usage: toggleGrokBotUsageParam(catalogIds, board.usageParam, type.id),
          page: undefined,
        });
        const on = selected.has(type.id);
        return (
          <PendingAnchor
            key={type.id}
            href={href}
            history="push"
            ariaCurrent={on ? 'true' : undefined}
            className={
              on
                ? 'rounded-md border border-foreground px-2 py-1 text-xs text-foreground'
                : 'rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground'
            }
          >
            {type.label}
          </PendingAnchor>
        );
      })}
    </div>
  );
}

export default async function GrokbotUsagePage({ searchParams }: GrokPageProps) {
  const params = await searchParams;
  const settingsResult = await getCursorSettings();
  if (settingsResult.error || !settingsResult.data) {
    return (
      <div className="space-y-6">
        <GrokHeader />
        <p className="text-sm text-error">
          {settingsResult.error ?? 'Failed to load Grokbot usage.'}
        </p>
      </div>
    );
  }

  const settings = settingsResult.data;
  const boardResult = await getGrokBotBoard({
    weekday: settings.grok_cycle_weekday,
    hour: settings.grok_cycle_hour,
    minute: settings.grok_cycle_minute,
    cycle: params.cycle,
    start: params.start,
    end: params.end,
    usage: params.usage,
    page: params.page,
    view: params.view,
    cmp: params.cmp,
    focus: params.focus,
    names: params.names,
  });
  if (boardResult.error || !boardResult.data) {
    return (
      <div className="space-y-6">
        <GrokHeader />
        <p className="text-sm text-error">
          {boardResult.error ?? 'Failed to load Grokbot usage.'}
        </p>
      </div>
    );
  }

  const board = boardResult.data;
  const mode: GrokBotChartMode = board.charts.mode;
  const pageBase = hrefFor(board);
  const toggleHref = hrefFor(board, {
    mode: mode === 'by-type' ? 'ins-outs' : 'by-type',
    page: undefined,
  });
  const focusTargets = board.charts.periods.map((period) => ({
    startMs: period.startMs,
    href: focusHref(board, period.startMs),
  }));
  const chartProps = {
    charts: board.charts,
    windowStartMs: board.window.startMs,
    windowEndMs: board.window.endMs,
    timeZone: board.timeZone,
    bucketMs: board.window.bucketMs,
    focusStartMs: board.focusStartMs,
    focusTargets,
  };
  const totalPages = Math.ceil(board.totalRows / board.pageSize);

  return (
    <div className="space-y-6">
      <GrokHeader />
      <CycleLinks board={board} />
      <UsageLinks board={board} />
      {board.cycleHasRows ? (
        <>
          <GrokBotWindowStats
            periods={board.charts.periods}
            focusStartMs={board.focusStartMs}
          />
          <PendingAnchor
            href={toggleHref}
            history="push"
            ariaPressed={mode === 'ins-outs'}
            className={
              mode === 'ins-outs'
                ? 'rounded-md border border-foreground px-2 py-1 text-xs text-foreground'
                : 'rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground'
            }
          >
            {GROK_BOT_INS_LINE} / {GROK_BOT_OUTS_LINE}
          </PendingAnchor>
          <GrokWindowEditor
            windowStartMs={board.window.startMs}
            windowEndMs={board.window.endMs}
            timeZone={board.timeZone}
            hrefParams={linkParams(board)}
          >
            <Card>
              <div className="mb-3 text-xs text-muted uppercase tracking-wider">Tokens</div>
              <GrokBotSeriesChart {...chartProps} measure="tokens" />
            </Card>
            <Card>
              <div className="mb-3 text-xs text-muted uppercase tracking-wider">Spending</div>
              <GrokBotSeriesChart {...chartProps} measure="usd" />
            </Card>
          </GrokWindowEditor>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs text-muted uppercase tracking-wider">Events</div>
              {board.charts.periods.length > 1
                ? board.charts.periods.map((period, index) => {
                    const title = grokBotPeriodTitle(index, board.charts.periods);
                    const focused = period.startMs === board.focusStartMs;
                    const className = focused
                      ? 'rounded-md border border-foreground px-2 py-1 text-xs text-foreground'
                      : 'rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground';
                    if (focused) {
                      return (
                        <span
                          key={period.startMs}
                          title={period.label}
                          aria-current="page"
                          className={className}
                        >
                          {title}
                        </span>
                      );
                    }
                    return (
                      <PendingAnchor
                        key={period.startMs}
                        href={focusHref(board, period.startMs)}
                        history="push"
                        title={period.label}
                        className={className}
                      >
                        {title}
                      </PendingAnchor>
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
              <Pagination page={board.page} totalPages={totalPages} baseUrl={pageBase} />
              </>
            )}
          </div>
        </>
      ) : (
        <Card className="space-y-3">
          <p className="text-sm text-foreground">No grok bot usage in this cycle.</p>
          <PendingAnchor
            href="/cursor/upload"
            history="push"
            className="inline-block text-xs text-muted hover:text-foreground"
          >
            Upload CSV
          </PendingAnchor>
        </Card>
      )}
    </div>
  );
}
