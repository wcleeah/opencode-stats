import 'server-only';

import { queryAll, queryOne } from '@/lib/db';
import { ensureCursorSchema } from '@/lib/cursor/schema';
import {
  GROK_BOT_CYCLE_TIME_ZONE,
  grokBotBucketStartSql,
  fillGrokBotSeries,
  parseGrokBotCycleClock,
  resolveGrokBotWindow,
  type GrokBotSeriesPoint,
  type GrokBotWindowMode,
} from '@/lib/grok-bot/cycle';
import { grokBotModelSql, isGrokBotModel, normalizeGrokBotModelId } from '@/lib/grok-bot/membership';
import {
  grokBotUsageCatalog,
  priceGrokBotRow,
  type GrokBotCharge,
  type GrokBotUsageTypeOption,
} from '@/lib/grok-bot/rates';

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
  seriesTypes: readonly GrokBotUsageTypeOption[];
  series: readonly GrokBotSeriesPoint[];
  rows: readonly GrokBotTableRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  cycleHasRows: boolean;
}

interface SqlEventRow {
  id: number | bigint;
  event_at: number | bigint;
  model: string;
  kind: string;
  cost_raw: string;
  reported_cost: number | bigint | null;
  tokens_input: number | bigint;
  tokens_input_cache_write: number | bigint;
  tokens_cache_read: number | bigint;
  tokens_output: number | bigint;
  tokens_total: number | bigint;
}

function asNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function asNullableNumber(value: number | bigint | null): number | null {
  if (value === null) return null;
  return asNumber(value);
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

  const resolved = resolveGrokBotWindow({
    clock,
    now: query.now ?? new Date(),
    cycle: query.cycle,
    start: query.start,
    end: query.end,
  });
  const membership = grokBotModelSql('model');
  const cycleArgs = [resolved.cycle.startMs, resolved.cycle.endMs];

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
  const filter = eventFilter(
    resolved.window.startMs,
    resolved.window.endMs,
    selection.param === undefined ? undefined : selection.ids,
  );

  const seriesSql = `
    SELECT
      ${grokBotBucketStartSql('event_at')} AS bucket_start,
      model,
      COALESCE(SUM(tokens_total), 0) AS tokens_total
    FROM cursor_usage_events
    WHERE ${filter.clause}
    GROUP BY bucket_start, model
  `;
  const seriesArgs = [
    resolved.window.startMs,
    resolved.window.startMs,
    resolved.window.bucketMs,
    resolved.window.bucketMs,
    ...filter.args,
  ];

  const [seriesResult, countResult] = await Promise.all([
    queryAll<{
      bucket_start: number | bigint;
      model: string;
      tokens_total: number | bigint;
    }>(seriesSql, seriesArgs),
    queryOne<{ total: number | bigint }>(
      `SELECT COUNT(*) AS total FROM cursor_usage_events WHERE ${filter.clause}`,
      filter.args,
    ),
  ]);
  if (seriesResult.error) return { data: null, error: seriesResult.error };
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
       WHERE ${filter.clause}
       ORDER BY event_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...filter.args, GROK_BOT_PAGE_SIZE, (page - 1) * GROK_BOT_PAGE_SIZE],
    );
    if (rowResult.error || !rowResult.data) {
      return { data: null, error: rowResult.error ?? 'Failed to load Grokbot rows.' };
    }
    sqlRows = rowResult.data;
  }

  const sums = new Map<string, { bucketStartMs: number; usageType: string; tokensTotal: number }>();
  for (const row of seriesResult.data ?? []) {
    const usageType = normalizeGrokBotModelId(row.model);
    const bucketStartMs = asNumber(row.bucket_start);
    const key = `${bucketStartMs}:${usageType}`;
    const tokensTotal = asNumber(row.tokens_total);
    const existing = sums.get(key);
    if (existing) existing.tokensTotal += tokensTotal;
    else sums.set(key, { bucketStartMs, usageType, tokensTotal });
  }

  const labels = new Map(catalog.map((entry) => [entry.id, entry.label]));
  const rows: GrokBotTableRow[] = sqlRows.map((row) => {
    const usageType = normalizeGrokBotModelId(row.model);
    const tokensInput = asNumber(row.tokens_input);
    const tokensCacheWrite = asNumber(row.tokens_input_cache_write);
    const tokensCacheRead = asNumber(row.tokens_cache_read);
    const tokensOutput = asNumber(row.tokens_output);
    return {
      id: asNumber(row.id),
      eventAt: asNumber(row.event_at),
      usageType,
      label: labels.get(usageType) ?? usageType,
      kind: row.kind,
      tokensInput,
      tokensCacheWrite,
      tokensCacheRead,
      tokensOutput,
      tokensTotal: asNumber(row.tokens_total),
      charge: priceGrokBotRow({
        model: row.model,
        kind: row.kind,
        costRaw: row.cost_raw,
        reportedCost: asNullableNumber(row.reported_cost),
        tokensInput,
        tokensInputCacheWrite: tokensCacheWrite,
        tokensCacheRead,
        tokensOutput,
      }),
    };
  });

  return {
    data: {
      cycle: {
        offset: resolved.cycle.offset,
        startMs: resolved.cycle.startMs,
        endMs: resolved.cycle.endMs,
        label: resolved.cycle.label,
      },
      windowMode: resolved.mode,
      window: resolved.window,
      timeZone: GROK_BOT_CYCLE_TIME_ZONE,
      usageTypes: catalog,
      selectedUsageTypeIds: selection.ids,
      usageParam: selection.param,
      seriesTypes,
      series: fillGrokBotSeries({
        windowStartMs: resolved.window.startMs,
        windowEndMs: resolved.window.endMs,
        bucketMs: resolved.window.bucketMs,
        typeIds: seriesTypes.map((entry) => entry.id),
        sums: [...sums.values()],
      }),
      rows,
      page,
      pageSize: GROK_BOT_PAGE_SIZE,
      totalRows,
      cycleHasRows: cycleProbe.data !== null,
    },
    error: null,
  };
}
