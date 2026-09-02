import 'server-only';

import { execute, executeBatch } from '@/lib/db';
import {
  DEFAULT_EXA_ALLOTMENT_USD,
  DEFAULT_EXA_WARN_USD,
  DEFAULT_TAVILY_WARN_PCT,
} from '@/lib/mcp/constants';

let schemaReady: Promise<void> | null = null;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS mcp_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    exa_allotment_usd REAL NOT NULL DEFAULT 10,
    exa_purchased_extra_usd REAL NOT NULL DEFAULT 0,
    tavily_warn_pct REAL NOT NULL DEFAULT 80,
    exa_warn_usd REAL NOT NULL DEFAULT 2,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mcp_usage_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fetched_at INTEGER NOT NULL,
    cycle_month TEXT NOT NULL,
    tavily_ok INTEGER NOT NULL DEFAULT 0,
    tavily_error TEXT,
    tavily_plan TEXT,
    tavily_plan_usage INTEGER,
    tavily_plan_limit INTEGER,
    tavily_paygo_usage INTEGER,
    tavily_paygo_limit INTEGER,
    tavily_search_usage INTEGER,
    tavily_extract_usage INTEGER,
    tavily_crawl_usage INTEGER,
    tavily_map_usage INTEGER,
    tavily_research_usage INTEGER,
    tavily_key_usage INTEGER,
    tavily_key_limit INTEGER,
    exa_ok INTEGER NOT NULL DEFAULT 0,
    exa_error TEXT,
    exa_api_key_id TEXT,
    exa_api_key_name TEXT,
    exa_total_cost_usd REAL,
    exa_breakdown_json TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mcp_usage_snapshots_fetched
    ON mcp_usage_snapshots(fetched_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_mcp_usage_snapshots_month
    ON mcp_usage_snapshots(cycle_month, fetched_at)`,
] as const;

export async function ensureMcpSchema(): Promise<{ error: string | null }> {
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
        `INSERT OR IGNORE INTO mcp_settings
          (id, exa_allotment_usd, exa_purchased_extra_usd, tavily_warn_pct,
           exa_warn_usd, updated_at)
         VALUES (1, ?, 0, ?, ?, ?)`,
        [
          DEFAULT_EXA_ALLOTMENT_USD,
          DEFAULT_TAVILY_WARN_PCT,
          DEFAULT_EXA_WARN_USD,
          Date.now(),
        ],
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
    console.error('[ensureMcpSchema]', message);
    return { error: message };
  }
}
