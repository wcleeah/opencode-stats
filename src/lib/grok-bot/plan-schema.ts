import 'server-only';

import { executeBatch } from '@/lib/db';

let schemaReady: Promise<void> | null = null;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS grok_bot_plan_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schema_version INTEGER NOT NULL,
    captured_at TEXT NOT NULL,
    captured_at_ms INTEGER NOT NULL,
    source TEXT NOT NULL,
    plan TEXT NOT NULL,
    weekly_usage_percent_used REAL NOT NULL,
    reset_timezone TEXT NOT NULL,
    reset_label TEXT NOT NULL,
    reset_iso_approx TEXT NOT NULL,
    on_demand_monthly_limit REAL,
    on_demand_amount REAL,
    payload_json TEXT NOT NULL,
    received_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_grok_bot_plan_snapshots_source_captured
    ON grok_bot_plan_snapshots(source, captured_at)`,
  `CREATE INDEX IF NOT EXISTS idx_grok_bot_plan_snapshots_captured
    ON grok_bot_plan_snapshots(captured_at_ms, id)`,
] as const;

export async function ensureGrokBotPlanSchema(): Promise<{ error: string | null }> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const result = await executeBatch(
        SCHEMA_STATEMENTS.map((sql) => ({ sql })),
      );
      if (result.error) {
        schemaReady = null;
        throw new Error(result.error);
      }
    })();
  }

  try {
    await schemaReady;
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ensureGrokBotPlanSchema]', message);
    return { error: message };
  }
}
