export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { formatCost, formatTokens } from '@/lib/format';
import {
  formatGrokBotWallTime,
  grokBotWallTimeFromUtcMs,
} from '@/lib/grok-bot/cycle';
import {
  GROK_BOT_INS_LINE,
  GROK_BOT_OUTS_LINE,
  grokBotHref,
  toggleGrokBotUsageParam,
} from '@/lib/grok-bot/href';
import type { GrokBotCharge } from '@/lib/grok-bot/rates';
import { getCursorSettings } from '@/lib/queries/cursor';
import { getGrokBotBoard, type GrokBotBoard } from '@/lib/queries/grok-bot';

import { GrokBotSeriesChart } from '@/components/grok-bot/usage-chart';
import { GrokBotWindowStats } from '@/components/grok-bot/window-stats';
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
  }>;
}

function GrokHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-bold">Grokbot Usage</h1>
      <Link
        href="/cursor/upload"
        className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt"
      >
        Upload CSV
      </Link>
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

function CycleLinks({ board }: { board: GrokBotBoard }) {
  const mode = board.charts.mode;
  const previousHref = grokBotHref({
    cycle: board.cycle.offset - 1,
    usage: board.usageParam,
    mode,
  });
  const nextHref = grokBotHref({
    cycle: board.cycle.offset + 1,
    usage: board.usageParam,
    mode,
  });
  const thisHref = grokBotHref({ cycle: 0, usage: board.usageParam, mode });
  const linkClass = 'px-2 py-1 text-xs text-muted hover:text-foreground transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted">
        Grok cycle · Asia/Hong_Kong
      </span>
      <div className="inline-flex items-center rounded-md border border-border">
        <Link href={previousHref} className={linkClass} aria-label="Previous cycle">
          ←
        </Link>
        <Link
          href={thisHref}
          className="border-x border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted hover:text-foreground transition-colors"
        >
          This cycle
        </Link>
        <Link href={nextHref} className={linkClass} aria-label="Next cycle">
          →
        </Link>
      </div>
      <span className="text-xs text-muted">{board.cycle.label}</span>
      {board.windowMode.kind === 'range' ? (
        <span className="text-xs text-muted">
          {eventTime(board.window.startMs)}
          {' to '}
          {eventTime(board.window.endMs)}
        </span>
      ) : null}
    </div>
  );
}

function UsageLinks({ board }: { board: GrokBotBoard }) {
  const windowHref = board.windowMode.kind === 'cycle'
    ? { cycle: board.windowMode.offset }
    : { startMs: board.windowMode.startMs, endMs: board.windowMode.endMs };
  const catalogIds = board.usageTypes.map((entry) => entry.id);
  const selected = new Set(board.selectedUsageTypeIds);
  const mode = board.charts.mode;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted">Usage</span>
      {board.usageTypes.map((type) => {
        const href = grokBotHref({
          ...windowHref,
          usage: toggleGrokBotUsageParam(catalogIds, board.usageParam, type.id),
          mode,
        });
        const on = selected.has(type.id);
        return (
          <Link
            key={type.id}
            href={href}
            aria-current={on ? 'true' : undefined}
            className={
              on
                ? 'rounded-md border border-foreground px-2 py-1 text-xs text-foreground'
                : 'rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground'
            }
          >
            {type.label}
          </Link>
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
  const mode = board.charts.mode;
  const windowHref = board.windowMode.kind === 'cycle'
    ? { cycle: board.windowMode.offset }
    : { startMs: board.windowMode.startMs, endMs: board.windowMode.endMs };
  const pageBase = grokBotHref({
    ...windowHref,
    usage: board.usageParam,
    mode,
  });
  const toggleHref = grokBotHref({
    ...windowHref,
    usage: board.usageParam,
    mode: mode === 'by-type' ? 'ins-outs' : 'by-type',
  });
  const chartProps = {
    charts: board.charts,
    windowStartMs: board.window.startMs,
    windowEndMs: board.window.endMs,
    timeZone: board.timeZone,
    usageParam: board.usageParam,
  };
  const totalPages = Math.ceil(board.totalRows / board.pageSize);

  return (
    <div className="space-y-6">
      <GrokHeader />
      <CycleLinks board={board} />
      <UsageLinks board={board} />
      {board.cycleHasRows ? (
        <>
          <GrokBotWindowStats totals={board.totals} />
          <Link
            href={toggleHref}
            aria-pressed={mode === 'ins-outs'}
            className={
              mode === 'ins-outs'
                ? 'rounded-md border border-foreground px-2 py-1 text-xs text-foreground'
                : 'rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground'
            }
          >
            {GROK_BOT_INS_LINE} / {GROK_BOT_OUTS_LINE}
          </Link>
          <Card>
            <div className="mb-3 text-xs text-muted uppercase tracking-wider">Tokens</div>
            <GrokBotSeriesChart {...chartProps} measure="tokens" />
          </Card>
          <Card>
            <div className="mb-3 text-xs text-muted uppercase tracking-wider">Spending</div>
            <GrokBotSeriesChart
              {...chartProps}
              measure="usd"
              dollarsAreEstimates={board.totals.spend.includesCardEstimate}
            />
          </Card>
          {board.totalRows === 0 ? (
            <Card>
              <p className="text-sm text-foreground">This window or filter has no rows.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-muted uppercase tracking-wider">Events</div>
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
            </div>
          )}
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
