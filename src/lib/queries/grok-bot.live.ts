import { execute } from '@/lib/db';
import { ensureCursorSchema } from '@/lib/cursor/schema';
import type { GrokBotAlignedCharts, GrokBotWindowTotals } from '@/lib/grok-bot/window';
import {
  getGrokBotBoard,
  type GrokBotBoard,
  type GrokBotTableRow,
} from '@/lib/queries/grok-bot';

const BASE_MS = Date.parse('2026-10-14T03:30:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date(BASE_MS);

const CLOCK = { weekday: 'wednesday', hour: 11, minute: 30 };

interface RowInput {
  hash: string;
  eventAt: number;
  model: string;
  kind: string;
  costRaw: string;
  reportedCost: number | null;
  tokensInput: number;
  tokensCacheWrite: number;
  tokensCacheRead: number;
  tokensOutput: number;
  tokensTotal: number;
}

async function insertRow(row: RowInput): Promise<void> {
  const result = await execute(
    `INSERT INTO cursor_usage_events (
      event_hash, event_at, kind, model, max_mode,
      tokens_input_cache_write, tokens_input, tokens_cache_read,
      tokens_output, tokens_total, cost_raw, reported_cost, created_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.hash,
      row.eventAt,
      row.kind,
      row.model,
      row.tokensCacheWrite,
      row.tokensInput,
      row.tokensCacheRead,
      row.tokensOutput,
      row.tokensTotal,
      row.costRaw,
      row.reportedCost,
      BASE_MS,
    ],
  );
  if (result.error) throw new Error(result.error);
}

function summarizeRow(row: GrokBotTableRow): {
  usageType: string;
  kind: string;
  tokensTotal: number;
  charge: GrokBotTableRow['charge'];
} {
  return {
    usageType: row.usageType,
    kind: row.kind,
    tokensTotal: row.tokensTotal,
    charge: row.charge,
  };
}

function summarizeCharts(charts: GrokBotAlignedCharts): {
  mode: GrokBotAlignedCharts['mode'];
  lines: Array<{ id: string; label: string }>;
  periods: Array<{ role: 'primary' | 'compare'; startMs: number; shortLabel: string }>;
  points: Array<{
    bucketStartMs: number;
    values?: Array<Array<{ tokens: number; usd: number }>>;
    sides?: Array<{
      insTokens: number;
      outsTokens: number;
      insUsd: number;
      outsUsd: number;
    }>;
  }>;
} {
  const periods = charts.periods.map((period) => ({
    role: period.role,
    startMs: period.startMs,
    shortLabel: period.shortLabel,
  }));
  if (charts.mode === 'by-type') {
    return {
      mode: charts.mode,
      lines: charts.lines.map((line) => ({ id: line.id, label: line.label })),
      periods,
      points: charts.points.map((point) => ({
        bucketStartMs: point.bucketStartMs,
        values: point.values.map((cells) => cells.map((cell) => ({
          tokens: cell.tokens,
          usd: cell.usd,
        }))),
      })),
    };
  }
  return {
    mode: charts.mode,
    lines: [],
    periods,
    points: charts.points.map((point) => ({
      bucketStartMs: point.bucketStartMs,
      sides: point.sides.map((side) => ({
        insTokens: side.insTokens,
        outsTokens: side.outsTokens,
        insUsd: side.insUsd,
        outsUsd: side.outsUsd,
      })),
    })),
  };
}

function summarizeTotals(totals: GrokBotWindowTotals): {
  ins: number;
  outs: number;
  totalUsd: number;
  insUsd: number;
  unpricedCacheWriteTokens: number;
  includesCardEstimate: boolean;
} {
  return {
    ins: totals.tokens.ins,
    outs: totals.tokens.outs,
    totalUsd: totals.spend.totalUsd,
    insUsd: totals.spend.insUsd,
    unpricedCacheWriteTokens: totals.spend.unpricedCacheWriteTokens,
    includesCardEstimate: totals.spend.includesCardEstimate,
  };
}

function summarizeBoard(board: GrokBotBoard): {
  totalRows: number;
  page: number;
  pageSize: number;
  cycleHasRows: boolean;
  usageTypeIds: string[];
  windowStartMs: number;
  windowEndMs: number;
  bucketMs: number;
  cycleStartMs: number;
  offset: number;
  focusStartMs: number;
  totals: ReturnType<typeof summarizeTotals>;
  charts: ReturnType<typeof summarizeCharts>;
  rows: ReturnType<typeof summarizeRow>[];
} {
  return {
    totalRows: board.totalRows,
    page: board.page,
    pageSize: board.pageSize,
    cycleHasRows: board.cycleHasRows,
    usageTypeIds: board.usageTypes.map((entry) => entry.id),
    windowStartMs: board.window.startMs,
    windowEndMs: board.window.endMs,
    bucketMs: board.window.bucketMs,
    cycleStartMs: board.cycle.startMs,
    offset: board.cycle.offset,
    focusStartMs: board.focusStartMs,
    totals: summarizeTotals(board.charts.periods[0].totals),
    charts: summarizeCharts(board.charts),
    rows: board.rows.map(summarizeRow),
  };
}

async function load(query: {
  cycle?: string;
  start?: string;
  end?: string;
  usage?: string;
  page?: string;
  view?: string;
  cmp?: string;
  focus?: string;
  weekday?: string;
}): Promise<{ data: ReturnType<typeof summarizeBoard> | null; error: string | null }> {
  const result = await getGrokBotBoard({
    weekday: query.weekday ?? CLOCK.weekday,
    hour: CLOCK.hour,
    minute: CLOCK.minute,
    cycle: query.cycle,
    start: query.start,
    end: query.end,
    usage: query.usage,
    page: query.page,
    view: query.view,
    cmp: query.cmp,
    focus: query.focus,
    now: NOW,
  });
  if (result.error || !result.data) return { data: null, error: result.error };
  return { data: summarizeBoard(result.data), error: null };
}

async function main(): Promise<void> {
  const schema = await ensureCursorSchema();
  if (schema.error) throw new Error(schema.error);

  const day = BASE_MS + DAY_MS;
  const rows: RowInput[] = [
    {
      hash: 'bucket',
      eventAt: BASE_MS + 90_000,
      model: 'grok-bot-default',
      kind: 'Included',
      costRaw: 'Included',
      reportedCost: null,
      tokensInput: 12,
      tokensCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
      tokensTotal: 12,
    },
    {
      hash: 'rated',
      eventAt: day,
      model: 'grok-bot-default',
      kind: 'Included',
      costRaw: 'Included',
      reportedCost: null,
      tokensInput: 1_000_000,
      tokensCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
      tokensTotal: 1_000_000,
    },
    {
      hash: 'cua',
      eventAt: day + 1,
      model: 'grok-bot-cua',
      kind: 'On-Demand',
      costRaw: '3.5',
      reportedCost: 3.5,
      tokensInput: 100,
      tokensCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
      tokensTotal: 100,
    },
    {
      hash: 'free',
      eventAt: day + 2,
      model: 'grok-bot-default',
      kind: 'Free',
      costRaw: 'Free',
      reportedCost: null,
      tokensInput: 4,
      tokensCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
      tokensTotal: 4,
    },
    {
      hash: 'knowledge',
      eventAt: day + 3,
      model: 'grok-bot-knowledge-work',
      kind: 'Included',
      costRaw: 'Included',
      reportedCost: null,
      tokensInput: 8,
      tokensCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
      tokensTotal: 8,
    },
    {
      hash: 'cursor',
      eventAt: BASE_MS + 5_000,
      model: 'cursor-grok-4.7',
      kind: 'Included',
      costRaw: 'Included',
      reportedCost: 9,
      tokensInput: 99,
      tokensCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
      tokensTotal: 99,
    },
    {
      hash: 'previous-cycle',
      eventAt: BASE_MS - 7 * DAY_MS + 90_000,
      model: 'grok-bot-default',
      kind: 'Included',
      costRaw: 'Included',
      reportedCost: null,
      tokensInput: 77,
      tokensCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
      tokensTotal: 77,
    },
  ];
  for (let index = 0; index < 50; index += 1) {
    rows.push({
      hash: `extra-${index}`,
      eventAt: BASE_MS + 2 * DAY_MS + index,
      model: 'grok-bot-default',
      kind: 'Included',
      costRaw: 'Included',
      reportedCost: null,
      tokensInput: 1,
      tokensCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
      tokensTotal: 1,
    });
  }
  for (const row of rows) await insertRow(row);

  const shortEnd = BASE_MS + 180_000 - 1;
  const emptyStart = BASE_MS + 3 * DAY_MS;
  const compareStart = BASE_MS - 7 * DAY_MS;
  const [bad, short, shortSplit, cycle, page2, page99, cua, empty, future, compare, focused, junk] = (
    await Promise.all([
      load({ weekday: 'funday' }),
      load({ start: String(BASE_MS), end: String(shortEnd) }),
      load({ start: String(BASE_MS), end: String(shortEnd), view: 'ins-outs' }),
      load({}),
      load({ page: '2' }),
      load({ page: '99' }),
      load({ usage: 'grok-bot-cua' }),
      load({ start: String(emptyStart), end: String(emptyStart + 60_000 - 1) }),
      load({ cycle: '1' }),
      load({ start: String(BASE_MS), end: String(shortEnd), cmp: String(compareStart) }),
      load({
        start: String(BASE_MS),
        end: String(shortEnd),
        cmp: String(compareStart),
        focus: String(compareStart),
      }),
      load({
        start: String(BASE_MS),
        end: String(shortEnd),
        cmp: `nope,-1,${BASE_MS}`,
      }),
    ])
  );

  console.log(JSON.stringify({
    bad,
    short,
    shortSplit,
    cycle,
    page2,
    page99,
    cua,
    empty,
    future,
    compare,
    focused,
    junk,
  }));
}

function isDirectRun(): boolean {
  const entry = process.argv[1] ?? '';
  return entry.endsWith('grok-bot.live.ts');
}

if (isDirectRun()) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
