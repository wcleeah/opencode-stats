import type { InStatement } from '@libsql/client/web';

import type { CursorCsvEvent } from '@/lib/cursor/csv';

const INSERT_SQL = `INSERT OR IGNORE INTO cursor_usage_events (
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
      ) VALUES `;

/** Bindings per event row. Keep under SQLite's common 999 variable cap. */
export const CURSOR_EVENT_PARAM_COUNT = 16;

/** Rows per INSERT … VALUES (…), (…). 50 * 16 = 800 placeholders. */
export const CURSOR_IMPORT_ROWS_PER_STATEMENT = 50;

/**
 * Multi-row INSERT statements grouped into one libsql `batch()` HTTP call.
 * Each `execute`/`batch` is a Cloudflare Worker subrequest to Turso; a CSV
 * with tens of thousands of rows used to issue one batch per 50 rows and
 * hit the per-invocation subrequest limit.
 */
export const CURSOR_IMPORT_STATEMENTS_PER_BATCH = 40;

const ROW_PLACEHOLDER = `(${Array.from({ length: CURSOR_EVENT_PARAM_COUNT }, () => '?').join(', ')})`;

export function cursorEventArgs(
  event: CursorCsvEvent,
  importId: number,
  importedAt: number,
): Array<string | number | null> {
  return [
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
  ];
}

export function buildCursorEventInsertStatement(
  events: CursorCsvEvent[],
  importId: number,
  importedAt: number,
): InStatement {
  if (events.length === 0) {
    throw new Error('buildCursorEventInsertStatement requires at least one event');
  }
  if (events.length > CURSOR_IMPORT_ROWS_PER_STATEMENT) {
    throw new Error(
      `buildCursorEventInsertStatement supports at most ${CURSOR_IMPORT_ROWS_PER_STATEMENT} rows`,
    );
  }

  const placeholders = Array.from({ length: events.length }, () => ROW_PLACEHOLDER).join(', ');
  const args = events.flatMap((event) => cursorEventArgs(event, importId, importedAt));

  return {
    sql: `${INSERT_SQL}${placeholders}`,
    args,
  };
}

export function buildCursorEventInsertBatches(
  events: CursorCsvEvent[],
  importId: number,
  importedAt: number,
): InStatement[][] {
  const statements: InStatement[] = [];

  for (let i = 0; i < events.length; i += CURSOR_IMPORT_ROWS_PER_STATEMENT) {
    const rows = events.slice(i, i + CURSOR_IMPORT_ROWS_PER_STATEMENT);
    statements.push(buildCursorEventInsertStatement(rows, importId, importedAt));
  }

  const batches: InStatement[][] = [];
  for (let i = 0; i < statements.length; i += CURSOR_IMPORT_STATEMENTS_PER_BATCH) {
    batches.push(statements.slice(i, i + CURSOR_IMPORT_STATEMENTS_PER_BATCH));
  }
  return batches;
}

export function cursorImportHttpCallCount(eventCount: number): number {
  if (eventCount <= 0) {
    return 0;
  }
  const statementCount = Math.ceil(eventCount / CURSOR_IMPORT_ROWS_PER_STATEMENT);
  return Math.ceil(statementCount / CURSOR_IMPORT_STATEMENTS_PER_BATCH);
}
