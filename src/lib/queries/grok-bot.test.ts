import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE_MS = Date.parse('2026-10-14T03:30:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

interface Charge {
  status: string;
  split?: { totalUsd: number; insUsd: number };
  unpricedCacheWriteTokens?: number;
}

interface SummaryRow {
  usageType: string;
  kind: string;
  tokensTotal: number;
  charge: Charge;
}

interface TotalsSummary {
  ins: number;
  outs: number;
  totalUsd: number;
  insUsd: number;
  unpricedCacheWriteTokens: number;
  includesCardEstimate: boolean;
}

interface ChartPoint {
  bucketStartMs: number;
  values?: { tokens: number; usd: number }[][];
  sides?: {
    insTokens: number;
    outsTokens: number;
    insUsd: number;
    outsUsd: number;
  }[];
}

interface PeriodSummary {
  role: string;
  delta: number | null;
  shortLabel: string;
}

interface ChartSummary {
  mode: string;
  lines: { id: string; label: string }[];
  periods: PeriodSummary[];
  points: ChartPoint[];
}

interface BoardSummary {
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
  totals: TotalsSummary;
  charts: ChartSummary;
  rows: SummaryRow[];
}

interface Payload {
  bad: { data: BoardSummary | null; error: string | null };
  short: { data: BoardSummary | null; error: string | null };
  shortSplit: { data: BoardSummary | null; error: string | null };
  cycle: { data: BoardSummary | null; error: string | null };
  page2: { data: BoardSummary | null; error: string | null };
  page99: { data: BoardSummary | null; error: string | null };
  cua: { data: BoardSummary | null; error: string | null };
  empty: { data: BoardSummary | null; error: string | null };
  future: { data: BoardSummary | null; error: string | null };
  compare: { data: BoardSummary | null; error: string | null };
  junk: { data: BoardSummary | null; error: string | null };
}

function byTypeValue(
  board: BoardSummary,
  bucketStartMs: number,
  typeId: string,
  periodIndex = 0,
): { tokens: number; usd: number } {
  assert.equal(board.charts.mode, 'by-type');
  const index = board.charts.lines.findIndex((line) => line.id === typeId);
  assert.ok(index >= 0, typeId);
  const point = board.charts.points.find((entry) => entry.bucketStartMs === bucketStartMs);
  assert.ok(point, String(bucketStartMs));
  const value = point.values?.[index]?.[periodIndex];
  assert.ok(value, typeId);
  return value;
}

function primarySide(point: ChartPoint): {
  insTokens: number;
  outsTokens: number;
  insUsd: number;
  outsUsd: number;
} {
  const side = point.sides?.[0];
  assert.ok(side);
  return side;
}

function requireBoard(
  result: { data: BoardSummary | null; error: string | null },
  label: string,
): BoardSummary {
  assert.equal(result.error, null, label);
  assert.ok(result.data, label);
  return result.data;
}

test('grok bot board prices member rows and leaves cursor models out', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grok-board-'));
  const dbPath = join(dir, 'board.db');
  const result = spawnSync(process.execPath, [
    '--conditions=react-server',
    '--import', 'tsx',
    'src/lib/queries/grok-bot.live.ts',
  ], {
    cwd: '/workspace',
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${dbPath}`,
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const line = result.stdout.trim().split('\n').filter((entry) => entry.startsWith('{')).at(-1);
  assert.ok(line, result.stdout);
  const payload = JSON.parse(line) as Payload;

  assert.equal(payload.bad.data, null);
  assert.equal(payload.bad.error, 'Invalid grok cycle clock.');

  const short = requireBoard(payload.short, 'short');
  assert.equal(short.totalRows, 1);
  assert.equal(short.cycleHasRows, true);
  assert.equal(short.bucketMs, 60_000);
  assert.equal(short.charts.mode, 'by-type');
  assert.equal(short.charts.points.length, 3);
  assert.deepEqual(short.charts.lines.map((line) => line.id), [
    'grok-bot-default',
    'grok-bot-cua',
    'grok-bot-knowledge-work',
  ]);
  assert.equal(short.charts.points[0].bucketStartMs, BASE_MS);
  assert.equal(short.charts.points[1].bucketStartMs, BASE_MS + 60_000);
  assert.equal(byTypeValue(short, BASE_MS + 60_000, 'grok-bot-default').tokens, 12);
  assert.equal(byTypeValue(short, BASE_MS + 60_000, 'grok-bot-cua').tokens, 0);
  assert.equal(byTypeValue(short, BASE_MS + 120_000, 'grok-bot-default').tokens, 0);
  assert.deepEqual(short.totals, {
    ins: 12,
    outs: 0,
    totalUsd: 12 * 2 / 1_000_000,
    insUsd: 12 * 2 / 1_000_000,
    unpricedCacheWriteTokens: 0,
    includesCardEstimate: true,
  });
  assert.equal(short.rows.length, 1);
  assert.equal(short.rows[0].usageType, 'grok-bot-default');
  assert.equal(short.rows[0].tokensTotal, 12);
  assert.equal(short.usageTypeIds.includes('cursor-grok-4.7'), false);

  const shortSplit = requireBoard(payload.shortSplit, 'shortSplit');
  assert.equal(shortSplit.charts.mode, 'ins-outs');
  assert.equal(shortSplit.charts.lines.length, 0);
  assert.equal(shortSplit.charts.points.length, 3);
  assert.deepEqual(shortSplit.totals, short.totals);
  const splitTokens = shortSplit.charts.points.reduce(
    (sum, point) => sum + primarySide(point).insTokens + primarySide(point).outsTokens,
    0,
  );
  const splitUsd = shortSplit.charts.points.reduce(
    (sum, point) => sum + primarySide(point).insUsd + primarySide(point).outsUsd,
    0,
  );
  assert.equal(splitTokens, short.totals.ins + short.totals.outs);
  assert.equal(splitUsd, short.totals.totalUsd);
  assert.equal(primarySide(shortSplit.charts.points[1]).insTokens, 12);
  assert.equal(primarySide(shortSplit.charts.points[1]).outsTokens, 0);

  const cycle = requireBoard(payload.cycle, 'cycle');
  assert.equal(cycle.totalRows, 55);
  assert.equal(cycle.pageSize, 50);
  assert.equal(cycle.page, 1);
  assert.equal(cycle.rows.length, 50);
  assert.equal(cycle.charts.points.length, 168);
  assert.equal(cycle.bucketMs, HOUR_MS);
  assert.equal(cycle.cycleStartMs, BASE_MS);
  assert.equal(cycle.offset, 0);
  assert.equal(cycle.usageTypeIds.includes('cursor-grok-4.7'), false);
  assert.equal(cycle.rows.every((row) => row.usageType.startsWith('grok-bot-')), true);
  assert.equal(byTypeValue(cycle, BASE_MS + DAY_MS, 'grok-bot-default').tokens, 1_000_000 + 4);
  assert.equal(byTypeValue(cycle, BASE_MS + DAY_MS, 'grok-bot-cua').tokens, 100);
  assert.equal(byTypeValue(cycle, BASE_MS + DAY_MS, 'grok-bot-knowledge-work').tokens, 8);
  assert.equal(byTypeValue(cycle, BASE_MS, 'grok-bot-default').tokens, 12);

  const second = requireBoard(payload.page2, 'page2');
  assert.equal(second.page, 2);
  assert.equal(second.rows.length, 5);
  assert.deepEqual(second.rows.map((row) => ({
    usageType: row.usageType,
    kind: row.kind,
    tokensTotal: row.tokensTotal,
    charge: row.charge,
  })), [
    {
      usageType: 'grok-bot-knowledge-work',
      kind: 'Included',
      tokensTotal: 8,
      charge: {
        status: 'rated',
        split: { totalUsd: 8 * 2 / 1_000_000, insUsd: 8 * 2 / 1_000_000 },
      },
    },
    {
      usageType: 'grok-bot-default',
      kind: 'Free',
      tokensTotal: 4,
      charge: { status: 'unbilled' },
    },
    {
      usageType: 'grok-bot-cua',
      kind: 'On-Demand',
      tokensTotal: 100,
      charge: {
        status: 'reported',
        split: { totalUsd: 3.5, insUsd: 3.5 },
      },
    },
    {
      usageType: 'grok-bot-default',
      kind: 'Included',
      tokensTotal: 1_000_000,
      charge: {
        status: 'rated',
        split: { totalUsd: 2, insUsd: 2 },
      },
    },
    {
      usageType: 'grok-bot-default',
      kind: 'Included',
      tokensTotal: 12,
      charge: {
        status: 'rated',
        split: {
          totalUsd: 12 * 2 / 1_000_000,
          insUsd: 12 * 2 / 1_000_000,
        },
      },
    },
  ]);

  const clamped = requireBoard(payload.page99, 'page99');
  assert.equal(clamped.page, 2);
  assert.equal(clamped.rows.length, 5);

  const cua = requireBoard(payload.cua, 'cua');
  assert.equal(cua.totalRows, 1);
  assert.equal(cua.rows[0].usageType, 'grok-bot-cua');
  assert.deepEqual(cua.rows[0].charge, {
    status: 'reported',
    split: { totalUsd: 3.5, insUsd: 3.5 },
  });
  assert.deepEqual(cua.charts.lines.map((line) => line.id), ['grok-bot-cua']);

  const empty = requireBoard(payload.empty, 'empty');
  assert.equal(empty.cycleHasRows, true);
  assert.equal(empty.totalRows, 0);
  assert.equal(empty.page, 1);
  assert.equal(empty.rows.length, 0);
  assert.deepEqual(empty.charts.lines.map((line) => line.id), [
    'grok-bot-default',
    'grok-bot-cua',
    'grok-bot-knowledge-work',
  ]);
  const emptyTokens = empty.charts.points.reduce((sum, point) => (
    sum + (point.values ?? []).reduce((lineSum, cells) => (
      lineSum + cells.reduce((cellSum, cell) => cellSum + cell.tokens, 0)
    ), 0)
  ), 0);
  assert.equal(emptyTokens, 0);
  assert.equal(empty.charts.points.length, 1);

  const future = requireBoard(payload.future, 'future');
  assert.equal(future.cycleHasRows, false);
  assert.equal(future.totalRows, 0);
  assert.equal(future.cycleStartMs, Date.parse('2026-10-21T03:30:00.000Z'));
  assert.equal(future.charts.lines.length, 0);
  assert.equal(future.charts.points.length, 0);

  const compare = requireBoard(payload.compare, 'compare');
  assert.equal(compare.charts.periods.length, 2);
  assert.equal(compare.charts.periods[0].role, 'primary');
  assert.equal(compare.charts.periods[0].shortLabel, 'Wed 14 Oct 2026');
  assert.equal(compare.charts.periods[1].role, 'compare');
  assert.equal(compare.charts.periods[1].delta, -1);
  assert.equal(compare.charts.periods[1].shortLabel, 'Wed 7 Oct 2026');
  assert.deepEqual(compare.totals, short.totals);
  assert.deepEqual(compare.rows, short.rows);
  assert.equal(compare.totalRows, short.totalRows);
  assert.equal(compare.charts.points.length, short.charts.points.length);
  assert.equal(
    byTypeValue(compare, BASE_MS + 60_000, 'grok-bot-default', 0).tokens,
    12,
  );
  assert.equal(
    byTypeValue(compare, BASE_MS + 60_000, 'grok-bot-default', 1).tokens,
    77,
  );
  assert.equal(byTypeValue(compare, BASE_MS, 'grok-bot-default', 1).tokens, 0);
  assert.equal(
    byTypeValue(compare, BASE_MS + 60_000, 'grok-bot-default', 1).usd,
    77 * 2 / 1_000_000,
  );

  const junk = requireBoard(payload.junk, 'junk');
  assert.deepEqual(junk, short);
});
