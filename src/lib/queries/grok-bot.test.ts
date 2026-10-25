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
  usd?: number;
}

interface SummaryRow {
  usageType: string;
  kind: string;
  tokensTotal: number;
  charge: Charge;
}

interface SummaryPoint {
  bucketStartMs: number;
  tokensByType: Record<string, number>;
}

interface BoardSummary {
  totalRows: number;
  page: number;
  pageSize: number;
  cycleHasRows: boolean;
  seriesLength: number;
  seriesTypeIds: string[];
  usageTypeIds: string[];
  windowStartMs: number;
  windowEndMs: number;
  bucketMs: number;
  cycleStartMs: number;
  offset: number;
  rows: SummaryRow[];
  points: SummaryPoint[];
}

interface Payload {
  bad: { data: BoardSummary | null; error: string | null };
  short: { data: BoardSummary | null; error: string | null };
  cycle: { data: BoardSummary | null; error: string | null };
  page2: { data: BoardSummary | null; error: string | null };
  page99: { data: BoardSummary | null; error: string | null };
  cua: { data: BoardSummary | null; error: string | null };
  empty: { data: BoardSummary | null; error: string | null };
  future: { data: BoardSummary | null; error: string | null };
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
  assert.equal(short.seriesLength, 3);
  assert.deepEqual(short.seriesTypeIds, [
    'grok-bot-default',
    'grok-bot-cua',
    'grok-bot-knowledge-work',
  ]);
  assert.equal(short.points[0].bucketStartMs, BASE_MS);
  assert.equal(short.points[1].bucketStartMs, BASE_MS + 60_000);
  assert.equal(short.points[1].tokensByType['grok-bot-default'], 12);
  assert.equal(short.points[1].tokensByType['grok-bot-cua'], 0);
  assert.equal(short.points[2].tokensByType['grok-bot-default'], 0);
  assert.equal(short.rows.length, 1);
  assert.equal(short.rows[0].usageType, 'grok-bot-default');
  assert.equal(short.rows[0].tokensTotal, 12);
  assert.equal(short.usageTypeIds.includes('cursor-grok-4.7'), false);

  const cycle = requireBoard(payload.cycle, 'cycle');
  assert.equal(cycle.totalRows, 55);
  assert.equal(cycle.pageSize, 50);
  assert.equal(cycle.page, 1);
  assert.equal(cycle.rows.length, 50);
  assert.equal(cycle.seriesLength, 168);
  assert.equal(cycle.bucketMs, HOUR_MS);
  assert.equal(cycle.cycleStartMs, BASE_MS);
  assert.equal(cycle.offset, 0);
  assert.equal(cycle.usageTypeIds.includes('cursor-grok-4.7'), false);
  assert.equal(cycle.rows.every((row) => row.usageType.startsWith('grok-bot-')), true);
  const dayBucket = cycle.points.find((point) => point.bucketStartMs === BASE_MS + DAY_MS);
  assert.ok(dayBucket, 'day bucket');
  assert.equal(dayBucket.tokensByType['grok-bot-default'], 1_000_000 + 4);
  assert.equal(dayBucket.tokensByType['grok-bot-cua'], 100);
  assert.equal(dayBucket.tokensByType['grok-bot-knowledge-work'], 8);
  const firstHour = cycle.points.find((point) => point.bucketStartMs === BASE_MS);
  assert.ok(firstHour, 'first hour');
  assert.equal(firstHour.tokensByType['grok-bot-default'], 12);

  const second = requireBoard(payload.page2, 'page2');
  assert.equal(second.page, 2);
  assert.equal(second.rows.length, 5);
  assert.deepEqual(second.rows.map((row) => ({
    usageType: row.usageType,
    kind: row.kind,
    tokensTotal: row.tokensTotal,
    status: row.charge.status,
    usd: row.charge.usd,
  })), [
    {
      usageType: 'grok-bot-knowledge-work',
      kind: 'Included',
      tokensTotal: 8,
      status: 'unpriced',
      usd: undefined,
    },
    {
      usageType: 'grok-bot-default',
      kind: 'Free',
      tokensTotal: 4,
      status: 'unbilled',
      usd: undefined,
    },
    {
      usageType: 'grok-bot-cua',
      kind: 'On-Demand',
      tokensTotal: 100,
      status: 'reported',
      usd: 3.5,
    },
    {
      usageType: 'grok-bot-default',
      kind: 'Included',
      tokensTotal: 1_000_000,
      status: 'rated',
      usd: 2,
    },
    {
      usageType: 'grok-bot-default',
      kind: 'Included',
      tokensTotal: 12,
      status: 'rated',
      usd: 12 * 2 / 1_000_000,
    },
  ]);

  const clamped = requireBoard(payload.page99, 'page99');
  assert.equal(clamped.page, 2);
  assert.equal(clamped.rows.length, 5);

  const cua = requireBoard(payload.cua, 'cua');
  assert.equal(cua.totalRows, 1);
  assert.equal(cua.rows[0].usageType, 'grok-bot-cua');
  assert.deepEqual(cua.rows[0].charge, { status: 'reported', usd: 3.5 });
  assert.deepEqual(cua.seriesTypeIds, ['grok-bot-cua']);

  const empty = requireBoard(payload.empty, 'empty');
  assert.equal(empty.cycleHasRows, true);
  assert.equal(empty.totalRows, 0);
  assert.equal(empty.page, 1);
  assert.equal(empty.rows.length, 0);
  assert.deepEqual(empty.seriesTypeIds, [
    'grok-bot-default',
    'grok-bot-cua',
    'grok-bot-knowledge-work',
  ]);
  const emptyTokens = empty.points.reduce((sum, point) => (
    sum + Object.values(point.tokensByType).reduce((inner, value) => inner + value, 0)
  ), 0);
  assert.equal(emptyTokens, 0);
  assert.equal(empty.seriesLength, 1);

  const future = requireBoard(payload.future, 'future');
  assert.equal(future.cycleHasRows, false);
  assert.equal(future.totalRows, 0);
  assert.equal(future.cycleStartMs, Date.parse('2026-10-21T03:30:00.000Z'));
  assert.equal(future.seriesTypeIds.length, 0);
});
