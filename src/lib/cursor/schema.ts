import 'server-only';

import { execute, executeBatch } from '@/lib/db';

let schemaReady: Promise<void> | null = null;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS cursor_usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_hash TEXT NOT NULL UNIQUE,
    event_at INTEGER NOT NULL,
    cloud_agent_id TEXT,
    automation_id TEXT,
    kind TEXT NOT NULL,
    model TEXT NOT NULL,
    max_mode INTEGER NOT NULL DEFAULT 0,
    tokens_input_cache_write INTEGER NOT NULL DEFAULT 0,
    tokens_input INTEGER NOT NULL DEFAULT 0,
    tokens_cache_read INTEGER NOT NULL DEFAULT 0,
    tokens_output INTEGER NOT NULL DEFAULT 0,
    tokens_total INTEGER NOT NULL DEFAULT 0,
    cost_raw TEXT NOT NULL,
    reported_cost REAL,
    import_id INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cursor_usage_events_event_at
    ON cursor_usage_events(event_at)`,
  `CREATE INDEX IF NOT EXISTS idx_cursor_usage_events_model
    ON cursor_usage_events(model)`,
  `CREATE INDEX IF NOT EXISTS idx_cursor_usage_events_agent
    ON cursor_usage_events(cloud_agent_id)`,
  `CREATE TABLE IF NOT EXISTS cursor_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    inserted_count INTEGER NOT NULL,
    skipped_count INTEGER NOT NULL,
    min_event_at INTEGER,
    max_event_at INTEGER,
    imported_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cursor_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    plan_amount_usd REAL NOT NULL DEFAULT 200,
    included_pool_usd REAL NOT NULL DEFAULT 400,
    billing_cycle_start_day INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  )`,
] as const;

export async function ensureCursorSchema(): Promise<{ error: string | null }> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const result = await executeBatch(
        SCHEMA_STATEMENTS.map((sql) => ({ sql })),
      );
      if (result.error) {
        schemaReady = null;
        throw new Error(result.error);
      }

      const seed = await execute(
        `INSERT OR IGNORE INTO cursor_settings
          (id, plan_amount_usd, included_pool_usd, billing_cycle_start_day, updated_at)
         VALUES (1, 200, 400, 1, ?)`,
        [Date.now()],
      );
      if (seed.error) {
        schemaReady = null;
        throw new Error(seed.error);
      }
    })();
  }

  try {
    await schemaReady;
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ensureCursorSchema]', message);
    return { error: message };
  }
}
