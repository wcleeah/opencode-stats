import 'server-only';

import { queryAll, queryOne } from '@/lib/db';
import { ensureCursorSchema } from '@/lib/cursor/schema';
import {
  GROK_BOT_CYCLE_TIME_ZONE,
  grokBotBucketStartSql,
  parseGrokBotCycleClock,
  projectGrokBotPeriods,
  resolveGrokBotWindow,
  type GrokBotWindowMode,
} from '@/lib/grok-bot/cycle';
import {
  parseGrokBotChartMode,
  parseGrokBotCompareStarts,
  parseGrokBotFocusStart,
} from '@/lib/grok-bot/href';
import { parseGrokBotPeriodNames } from '@/lib/grok-bot/period-name';
import { grokBotModelSql, isGrokBotModel, normalizeGrokBotModelId } from '@/lib/grok-bot/membership';
import {
  grokBotUsageCatalog,
  priceGrokBotRow,
  type GrokBotCharge,
  type GrokBotPriceInput,
  type GrokBotUsageTypeOption,
} from '@/lib/grok-bot/rates';
import {
  alignGrokBotPeriods,
  foldGrokBotWindow,
  type GrokBotAlignedCharts,
  type GrokBotFoldEvent,
} from '@/lib/grok-bot/window';

export const GROK_BOT_PAGE_SIZE = 50;

export interface GrokBotBoardQuery {
  weekday: string;
  hour: number;
  minute: number;
  cycle?: string;
  start?: string;
  end?: string;
  usage?: string;
  page?: string;
  view?: string;
  cmp?: string;
  focus?: string;
  names?: string;
  now?: Date;
}

export interface GrokBotTableRow {
  id: number;
  eventAt: number;
  usageType: string;
  label: string;
  kind: string;
  tokensInput: number;
  tokensCacheWrite: number;
  tokensCacheRead: number;
  tokensOutput: number;
  tokensTotal: number;
  charge: GrokBotCharge;
}

export interface GrokBotBoard {
  cycle: {
    offset: number;
    startMs: number;
    endMs: number;
    label: string;
  };
  windowMode: GrokBotWindowMode;
  window: { startMs: number; endMs: number; bucketMs: number };
  timeZone: 'Asia/Hong_Kong';
  usageTypes: readonly GrokBotUsageTypeOption[];
  selectedUsageTypeIds: readonly string[];
  usageParam: string | undefined;
  charts: GrokBotAlignedCharts;
  focusStartMs: number;
  rows: readonly GrokBotTableRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  cycleHasRows: boolean;
}

interface SqlPriceFields {
  model: string;
  kind: string;
  cost_raw: string;
  reported_cost: number | bigint | null;
  tokens_input: number | bigint;
  tokens_input_cache_write: number | bigint;
  tokens_cache_read: number | bigint;
  tokens_output: number | bigint;
}

interface SqlEventRow extends SqlPriceFields {
  id: number | bigint;
  event_at: number | bigint;
  tokens_total: number | bigint;
}

interface SqlScanRow extends SqlPriceFields {
  bucket_start: number | bigint;
}

function asNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function asNullableNumber(value: number | bigint | null): number | null {
  if (value === null) return null;
  return asNumber(value);
}

function priceInput(row: SqlPriceFields): GrokBotPriceInput {
  return {
    model: row.model,
    kind: row.kind,
    costRaw: row.cost_raw,
    reportedCost: asNullableNumber(row.reported_cost),
    tokensInput: asNumber(row.tokens_input),
    tokensInputCacheWrite: asNumber(row.tokens_input_cache_write),
    tokensCacheRead: asNumber(row.tokens_cache_read),
    tokensOutput: asNumber(row.tokens_output),
  };
}

function foldEvent(row: SqlScanRow): GrokBotFoldEvent {
  return {
    bucketStartMs: asNumber(row.bucket_start),
    usageType: normalizeGrokBotModelId(row.model),
    priced: priceGrokBotRow(priceInput(row)),
  };
}

function parsePage(page: string | undefined): number {
  if (page === undefined) return 1;
  const trimmed = page.trim();
  if (!/^\d+$/.test(trimmed)) return 1;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

function selectUsage(
  catalog: readonly GrokBotUsageTypeOption[],
  usage: string | undefined,
): { ids: readonly string[]; param: string | undefined } {
  const ids = catalog.map((entry) => entry.id);
  if (usage === undefined || usage.trim() === '') {
    return { ids, param: undefined };
  }
  const wanted = new Set(
    usage
      .split(',')
      .map((part) => normalizeGrokBotModelId(part))
      .filter((part) => isGrokBotModel(part)),
  );
  const picked = ids.filter((id) => wanted.has(id));
  if (picked.length === 0 || picked.length === ids.length) {
    return { ids, param: undefined };
  }
  return { ids: picked, param: picked.join(',') };
}

function eventFilter(
  startMs: number,
  endMs: number,
  explicitIds: readonly string[] | undefined,
): { clause: string; args: Array<number | string> } {
  const args: Array<number | string> = [startMs, endMs];
  let clause = `event_at >= ? AND event_at <= ? AND ${grokBotModelSql('model')}`;
  if (explicitIds && explicitIds.length > 0) {
    clause += ` AND lower(model) IN (${explicitIds.map(() => '?').join(', ')})`;
    args.push(...explicitIds);
  }
  return { clause, args };
}

export async function getGrokBotBoard(
  query: GrokBotBoardQuery,
): Promise<{ data: GrokBotBoard | null; error: string | null }> {
  const schema = await ensureCursorSchema();
  if (schema.error) return { data: null, error: schema.error };

  const clock = parseGrokBotCycleClock({
    weekday: query.weekday,
    hour: query.hour,
    minute: query.minute,
  });
  if (!clock) return { data: null, error: 'Invalid grok cycle clock.' };

  const now = query.now ?? new Date();
  const primary = resolveGrokBotWindow({
    clock,
    now,
    cycle: query.cycle,
    start: query.start,
    end: query.end,
  });
  const compareStarts = parseGrokBotCompareStarts(query.cmp, primary.window.startMs);
  const projected = projectGrokBotPeriods({
    clock,
    primary,
    compareStarts,
  });
  const focusStartMs = parseGrokBotFocusStart(
    query.focus,
    projected.map((period) => period.window.startMs),
  );
  const membership = grokBotModelSql('model');
  const cycleArgs = [primary.cycle.startMs, primary.cycle.endMs];

  const [modelsResult, cycleProbe] = await Promise.all([
    queryAll<{ model: string }>(
      `SELECT DISTINCT model
       FROM cursor_usage_events
       WHERE event_at >= ? AND event_at <= ? AND ${membership}`,
      cycleArgs,
    ),
    queryOne<{ id: number | bigint }>(
      `SELECT id
       FROM cursor_usage_events
       WHERE event_at >= ? AND event_at <= ? AND ${membership}
       LIMIT 1`,
      cycleArgs,
    ),
  ]);
  if (modelsResult.error) return { data: null, error: modelsResult.error };
  if (cycleProbe.error) return { data: null, error: cycleProbe.error };

  const catalog = grokBotUsageCatalog((modelsResult.data ?? []).map((row) => row.model));
  const selection = selectUsage(catalog, query.usage);
  const inCycle = new Set(
    (modelsResult.data ?? []).map((row) => normalizeGrokBotModelId(row.model)),
  );
  const selectedIds = new Set(selection.ids);
  const seriesTypes = catalog.filter(
    (entry) => selectedIds.has(entry.id) && inCycle.has(entry.id),
  );
  const explicitIds = selection.param === undefined ? undefined : selection.ids;
  const seriesLines = seriesTypes.map((entry) => ({ id: entry.id, label: entry.label }));
  const mode = parseGrokBotChartMode(query.view);
  const scans = projected.map((period) => {
    const filter = eventFilter(period.window.startMs, period.window.endMs, explicitIds);
    return {
      filter,
      query: queryAll<SqlScanRow>(
        `SELECT
          ${grokBotBucketStartSql('event_at')} AS bucket_start,
          model,
          kind,
          cost_raw,
          reported_cost,
          tokens_input,
          tokens_input_cache_write,
          tokens_cache_read,
          tokens_output
        FROM cursor_usage_events
        WHERE ${filter.clause}`,
        [
          period.window.startMs,
          period.window.startMs,
          period.window.bucketMs,
          period.window.bucketMs,
          ...filter.args,
        ],
      ),
    };
  });
  const focusIndex = Math.max(
    0,
    projected.findIndex((period) => period.window.startMs === focusStartMs),
  );
  const tableFilter = scans[focusIndex].filter;

  const [scanResults, countResult] = await Promise.all([
    Promise.all(scans.map((scan) => scan.query)),
    queryOne<{ total: number | bigint }>(
      `SELECT COUNT(*) AS total FROM cursor_usage_events WHERE ${tableFilter.clause}`,
      tableFilter.args,
    ),
  ]);
  for (const scanResult of scanResults) {
    if (scanResult.error) return { data: null, error: scanResult.error };
  }
  if (countResult.error || !countResult.data) {
    return { data: null, error: countResult.error ?? 'Failed to count Grokbot rows.' };
  }

  const totalRows = asNumber(countResult.data.total);
  const pageCount = totalRows === 0 ? 1 : Math.ceil(totalRows / GROK_BOT_PAGE_SIZE);
  const page = totalRows === 0 ? 1 : Math.min(parsePage(query.page), pageCount);

  let sqlRows: SqlEventRow[] = [];
  if (totalRows > 0) {
    const rowResult = await queryAll<SqlEventRow>(
      `SELECT
         id,
         event_at,
         model,
         kind,
         cost_raw,
         reported_cost,
         tokens_input,
         tokens_input_cache_write,
         tokens_cache_read,
         tokens_output,
         tokens_total
       FROM cursor_usage_events
       WHERE ${tableFilter.clause}
       ORDER BY event_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...tableFilter.args, GROK_BOT_PAGE_SIZE, (page - 1) * GROK_BOT_PAGE_SIZE],
    );
    if (rowResult.error || !rowResult.data) {
      return { data: null, error: rowResult.error ?? 'Failed to load Grokbot rows.' };
    }
    sqlRows = rowResult.data;
  }

  const labels = new Map(catalog.map((entry) => [entry.id, entry.label]));
  const rows: GrokBotTableRow[] = sqlRows.map((row) => {
    const usageType = normalizeGrokBotModelId(row.model);
    const priced = priceInput(row);
    return {
      id: asNumber(row.id),
      eventAt: asNumber(row.event_at),
      usageType,
      label: labels.get(usageType) ?? usageType,
      kind: row.kind,
      tokensInput: priced.tokensInput,
      tokensCacheWrite: priced.tokensInputCacheWrite,
      tokensCacheRead: priced.tokensCacheRead,
      tokensOutput: priced.tokensOutput,
      tokensTotal: asNumber(row.tokens_total),
      charge: priceGrokBotRow(priced).charge,
    };
  });
  const folds = projected.map((period, index) => ({
    projected: period,
    folded: foldGrokBotWindow({
      windowStartMs: period.window.startMs,
      windowEndMs: period.window.endMs,
      bucketMs: period.window.bucketMs,
      seriesTypes: seriesLines,
      events: (scanResults[index].data ?? []).map(foldEvent),
      mode,
    }),
  }));
  const names = parseGrokBotPeriodNames(
    query.names,
    projected.map((period) => period.window.startMs),
  );
  const charts = alignGrokBotPeriods({ seriesTypes: seriesLines, folds, names });

  return {
    data: {
      cycle: {
        offset: primary.cycle.offset,
        startMs: primary.cycle.startMs,
        endMs: primary.cycle.endMs,
        label: primary.cycle.label,
      },
      windowMode: primary.mode,
      window: primary.window,
      timeZone: GROK_BOT_CYCLE_TIME_ZONE,
      usageTypes: catalog,
      selectedUsageTypeIds: selection.ids,
      usageParam: selection.param,
      charts,
      focusStartMs,
      rows,
      page,
      pageSize: GROK_BOT_PAGE_SIZE,
      totalRows,
      cycleHasRows: cycleProbe.data !== null,
    },
    error: null,
  };
}
