import 'server-only';

import { execute, executeBatch, queryAll, queryOne } from '@/lib/db';
import { ensureCursorSchema } from '@/lib/cursor/schema';
import type { CursorCsvEvent } from '@/lib/cursor/csv';
import type {
  CursorAgentUsageRow,
  CursorCyclePool,
  CursorDailyModelUsageRow,
  CursorDailyUsage,
  CursorEventCostRow,
  CursorGlobalStats,
  CursorImport,
  CursorModelUsageRow,
  CursorSettings,
} from '@/types/cursor';

const DEFAULT_SETTINGS: CursorSettings = {
  plan_amount_usd: 200,
  included_pool_usd: 400,
  cursor_models_included_usd: 2000,
  billing_cycle_start_day: 1,
  updated_at: 0,
};

function rangeWhere(
  column: string,
  startMs?: number,
  endMs?: number,
): { clause: string; args: number[] } {
  const conditions: string[] = [];
  const args: number[] = [];

  if (startMs !== undefined) {
    conditions.push(`${column} >= ?`);
    args.push(startMs);
  }
  if (endMs !== undefined) {
    conditions.push(`${column} <= ?`);
    args.push(endMs);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    args,
  };
}

async function withSchema<T>(
  fn: () => Promise<{ data: T | null; error: string | null }>,
): Promise<{ data: T | null; error: string | null }> {
  const schema = await ensureCursorSchema();
  if (schema.error) {
    return { data: null, error: schema.error };
  }
  return fn();
}

export async function getCursorSettings(): Promise<{
  data: CursorSettings | null;
  error: string | null;
}> {
  return withSchema(async () => {
    const result = await queryOne<CursorSettings>(`
      SELECT
        plan_amount_usd,
        included_pool_usd,
        COALESCE(cursor_models_included_usd, 2000) AS cursor_models_included_usd,
        billing_cycle_start_day,
        updated_at
      FROM cursor_settings
      WHERE id = 1
    `);
    if (result.error) return result;
    if (!result.data) {
      return { data: { ...DEFAULT_SETTINGS, updated_at: Date.now() }, error: null };
    }
    return result;
  });
}

export async function updateCursorSettings(input: {
  planAmountUsd: number;
  includedPoolUsd: number;
  cursorModelsIncludedUsd: number;
  billingCycleStartDay: number;
}): Promise<{ data: CursorSettings | null; error: string | null }> {
  return withSchema(async () => {
    const updatedAt = Date.now();
    const write = await execute(
      `UPDATE cursor_settings
       SET plan_amount_usd = ?,
           included_pool_usd = ?,
           cursor_models_included_usd = ?,
           billing_cycle_start_day = ?,
           updated_at = ?
       WHERE id = 1`,
      [
        input.planAmountUsd,
        input.includedPoolUsd,
        input.cursorModelsIncludedUsd,
        input.billingCycleStartDay,
        updatedAt,
      ],
    );
    if (write.error) {
      return { data: null, error: write.error };
    }
    return getCursorSettings();
  });
}

export async function getCursorCyclePool(cycleStart: string): Promise<{
  data: CursorCyclePool | null;
  error: string | null;
}> {
  return withSchema(() =>
    queryOne<CursorCyclePool>(
      `SELECT
         cycle_start,
         cursor_models_included_usd,
         updated_at
       FROM cursor_cycle_pools
       WHERE cycle_start = ?`,
      [cycleStart],
    ),
  );
}

/**
 * Resolve Cursor Models pool size for a cycle.
 * Per-cycle override wins; otherwise falls back to global default.
 */
export async function resolveCursorModelsPoolUsd(params: {
  cycleStart: string;
  defaultUsd: number;
}): Promise<{ data: { amountUsd: number; fromCycleOverride: boolean } | null; error: string | null }> {
  const override = await getCursorCyclePool(params.cycleStart);
  if (override.error) {
    return { data: null, error: override.error };
  }
  if (override.data) {
    return {
      data: {
        amountUsd: override.data.cursor_models_included_usd,
        fromCycleOverride: true,
      },
      error: null,
    };
  }
  return {
    data: { amountUsd: params.defaultUsd, fromCycleOverride: false },
    error: null,
  };
}

export async function upsertCursorCyclePool(input: {
  cycleStart: string;
  cursorModelsIncludedUsd: number;
}): Promise<{ data: CursorCyclePool | null; error: string | null }> {
  return withSchema(async () => {
    const updatedAt = Date.now();
    const write = await execute(
      `INSERT INTO cursor_cycle_pools (cycle_start, cursor_models_included_usd, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(cycle_start) DO UPDATE SET
         cursor_models_included_usd = excluded.cursor_models_included_usd,
         updated_at = excluded.updated_at`,
      [input.cycleStart, input.cursorModelsIncludedUsd, updatedAt],
    );
    if (write.error) {
      return { data: null, error: write.error };
    }
    return getCursorCyclePool(input.cycleStart);
  });
}

export async function listCursorImports(limit: number = 20): Promise<{
  data: CursorImport[] | null;
  error: string | null;
}> {
  return withSchema(() =>
    queryAll<CursorImport>(
      `SELECT
         id,
         filename,
         row_count,
         inserted_count,
         skipped_count,
         min_event_at,
         max_event_at,
         imported_at
       FROM cursor_imports
       ORDER BY imported_at DESC
       LIMIT ?`,
      [limit],
    ),
  );
}

export async function getCursorGlobalStats(
  startMs?: number,
  endMs?: number,
): Promise<{ data: CursorGlobalStats | null; error: string | null }> {
  return withSchema(() => {
    const range = rangeWhere('event_at', startMs, endMs);
    return queryOne<CursorGlobalStats>(
      `SELECT
         COUNT(*) AS event_count,
         COALESCE(SUM(CASE WHEN lower(kind) LIKE '%error%' OR lower(cost_raw) = 'free' THEN 0 ELSE 1 END), 0)
           AS charged_count,
         COALESCE(SUM(CASE WHEN lower(kind) LIKE '%error%' OR lower(cost_raw) = 'free' THEN 1 ELSE 0 END), 0)
           AS errored_count,
         COALESCE(SUM(CASE WHEN cloud_agent_id IS NOT NULL AND cloud_agent_id != '' THEN 1 ELSE 0 END), 0)
           AS cloud_agent_count,
         COALESCE(SUM(CASE WHEN cloud_agent_id IS NULL OR cloud_agent_id = '' THEN 1 ELSE 0 END), 0)
           AS ide_count,
         COUNT(DISTINCT model) AS model_count,
         COALESCE(SUM(tokens_input_cache_write), 0) AS tokens_input_cache_write,
         COALESCE(SUM(tokens_input), 0) AS tokens_input,
         COALESCE(SUM(tokens_cache_read), 0) AS tokens_cache_read,
         COALESCE(SUM(tokens_output), 0) AS tokens_output,
         COALESCE(SUM(tokens_total), 0) AS tokens_total,
         MIN(event_at) AS min_event_at,
         MAX(event_at) AS max_event_at
       FROM cursor_usage_events
       ${range.clause}`,
      range.args,
    );
  });
}

export async function getCursorDailyUsage(
  startMs?: number,
  endMs?: number,
): Promise<{ data: CursorDailyUsage[] | null; error: string | null }> {
  return withSchema(() => {
    const range = rangeWhere('event_at', startMs, endMs);
    return queryAll<CursorDailyUsage>(
      `SELECT
         strftime('%Y-%m-%d', event_at / 1000, 'unixepoch') AS day,
         COUNT(*) AS event_count,
         COALESCE(SUM(tokens_input), 0) AS tokens_input,
         COALESCE(SUM(tokens_input_cache_write), 0) AS tokens_input_cache_write,
         COALESCE(SUM(tokens_cache_read), 0) AS tokens_cache_read,
         COALESCE(SUM(tokens_output), 0) AS tokens_output,
         COALESCE(SUM(tokens_total), 0) AS tokens_total,
         SUM(CASE WHEN cloud_agent_id IS NOT NULL AND cloud_agent_id != '' THEN 1 ELSE 0 END)
           AS cloud_agent_count,
         SUM(CASE WHEN cloud_agent_id IS NULL OR cloud_agent_id = '' THEN 1 ELSE 0 END)
           AS ide_count
       FROM cursor_usage_events
       ${range.clause}
       GROUP BY day
       ORDER BY day ASC`,
      range.args,
    );
  });
}

export async function getCursorModelUsage(
  startMs?: number,
  endMs?: number,
): Promise<{ data: CursorModelUsageRow[] | null; error: string | null }> {
  return withSchema(() => {
    const range = rangeWhere('event_at', startMs, endMs);
    return queryAll<CursorModelUsageRow>(
      `SELECT
         model,
         COUNT(*) AS event_count,
         COALESCE(SUM(tokens_input), 0) AS tokens_input,
         COALESCE(SUM(tokens_input_cache_write), 0) AS tokens_input_cache_write,
         COALESCE(SUM(tokens_cache_read), 0) AS tokens_cache_read,
         COALESCE(SUM(tokens_output), 0) AS tokens_output,
         COALESCE(SUM(tokens_total), 0) AS tokens_total
       FROM cursor_usage_events
       ${range.clause}
       GROUP BY model
       ORDER BY tokens_total DESC`,
      range.args,
    );
  });
}

export async function getCursorAgentUsage(
  startMs?: number,
  endMs?: number,
  limit: number = 25,
): Promise<{ data: CursorAgentUsageRow[] | null; error: string | null }> {
  return withSchema(() => {
    const range = rangeWhere('event_at', startMs, endMs);
    const where = range.clause
      ? `${range.clause} AND cloud_agent_id IS NOT NULL AND cloud_agent_id != ''`
      : `WHERE cloud_agent_id IS NOT NULL AND cloud_agent_id != ''`;
    return queryAll<CursorAgentUsageRow>(
      `SELECT
         cloud_agent_id,
         COUNT(*) AS event_count,
         COALESCE(SUM(tokens_input), 0) AS tokens_input,
         COALESCE(SUM(tokens_input_cache_write), 0) AS tokens_input_cache_write,
         COALESCE(SUM(tokens_cache_read), 0) AS tokens_cache_read,
         COALESCE(SUM(tokens_output), 0) AS tokens_output,
         COALESCE(SUM(tokens_total), 0) AS tokens_total,
         MAX(event_at) AS last_event_at
       FROM cursor_usage_events
       ${where}
       GROUP BY cloud_agent_id
       ORDER BY tokens_total DESC
       LIMIT ?`,
      [...range.args, limit],
    );
  });
}

export async function getCursorEventCostRows(
  startMs?: number,
  endMs?: number,
): Promise<{ data: CursorEventCostRow[] | null; error: string | null }> {
  return withSchema(() => {
    const range = rangeWhere('event_at', startMs, endMs);
    return queryAll<CursorEventCostRow>(
      `SELECT
         model,
         reported_cost,
         tokens_input,
         tokens_input_cache_write,
         tokens_cache_read,
         tokens_output
       FROM cursor_usage_events
       ${range.clause}`,
      range.args,
    );
  });
}

export async function getCursorDailyModelUsage(
  startMs?: number,
  endMs?: number,
): Promise<{ data: CursorDailyModelUsageRow[] | null; error: string | null }> {
  return withSchema(() => {
    const range = rangeWhere('event_at', startMs, endMs);
    return queryAll<CursorDailyModelUsageRow>(
      `SELECT
         strftime('%Y-%m-%d', event_at / 1000, 'unixepoch') AS day,
         model,
         COALESCE(SUM(CASE WHEN reported_cost IS NOT NULL THEN reported_cost ELSE 0 END), 0)
           AS reported_cost,
         COALESCE(SUM(tokens_input), 0) AS tokens_input,
         COALESCE(SUM(tokens_input_cache_write), 0) AS tokens_input_cache_write,
         COALESCE(SUM(tokens_cache_read), 0) AS tokens_cache_read,
         COALESCE(SUM(tokens_output), 0) AS tokens_output,
         COALESCE(SUM(tokens_total), 0) AS tokens_total,
         COUNT(*) AS event_count
       FROM cursor_usage_events
       ${range.clause}
       GROUP BY day, model
       ORDER BY day ASC`,
      range.args,
    );
  });
}

export interface CursorImportResult {
  importId: number;
  rowCount: number;
  insertedCount: number;
  skippedCount: number;
  parseErrors: string[];
  minEventAt: number | null;
  maxEventAt: number | null;
}

export async function importCursorEvents(params: {
  filename: string;
  events: CursorCsvEvent[];
  parseErrors: string[];
  minEventAt: number | null;
  maxEventAt: number | null;
}): Promise<{ data: CursorImportResult | null; error: string | null }> {
  const schema = await ensureCursorSchema();
  if (schema.error) {
    return { data: null, error: schema.error };
  }

  const importedAt = Date.now();
  const createImport = await execute(
    `INSERT INTO cursor_imports
      (filename, row_count, inserted_count, skipped_count, min_event_at, max_event_at, imported_at)
     VALUES (?, ?, 0, 0, ?, ?, ?)`,
    [
      params.filename,
      params.events.length,
      params.minEventAt,
      params.maxEventAt,
      importedAt,
    ],
  );
  if (createImport.error || !createImport.data) {
    return { data: null, error: createImport.error ?? 'Failed to create import' };
  }

  const importId = Number(createImport.data.lastInsertRowid);
  let insertedCount = 0;
  const chunkSize = 50;

  for (let i = 0; i < params.events.length; i += chunkSize) {
    const chunk = params.events.slice(i, i + chunkSize);
    const statements = chunk.map((event) => ({
      sql: `INSERT OR IGNORE INTO cursor_usage_events (
        event_hash,
        event_at,
        cloud_agent_id,
        automation_id,
        kind,
        model,
        max_mode,
        tokens_input_cache_write,
        tokens_input,
        tokens_cache_read,
        tokens_output,
        tokens_total,
        cost_raw,
        reported_cost,
        import_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        event.eventHash,
        event.eventAt,
        event.cloudAgentId,
        event.automationId,
        event.kind,
        event.model,
        event.maxMode ? 1 : 0,
        event.tokensInputCacheWrite,
        event.tokensInput,
        event.tokensCacheRead,
        event.tokensOutput,
        event.tokensTotal,
        event.costRaw,
        event.reportedCost,
        importId,
        importedAt,
      ],
    }));

    const batch = await executeBatch(statements);
    if (batch.error || !batch.data) {
      return { data: null, error: batch.error ?? 'Failed to insert events' };
    }
    for (const result of batch.data) {
      insertedCount += result.rowsAffected;
    }
  }

  const skippedCount = params.events.length - insertedCount;
  const update = await execute(
    `UPDATE cursor_imports
     SET inserted_count = ?, skipped_count = ?
     WHERE id = ?`,
    [insertedCount, skippedCount, importId],
  );
  if (update.error) {
    return { data: null, error: update.error };
  }

  return {
    data: {
      importId,
      rowCount: params.events.length,
      insertedCount,
      skippedCount,
      parseErrors: params.parseErrors,
      minEventAt: params.minEventAt,
      maxEventAt: params.maxEventAt,
    },
    error: null,
  };
}
