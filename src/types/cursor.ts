export interface CursorSettings {
  plan_amount_usd: number;
  /** Other Models included floor (at least $) */
  included_pool_usd: number;
  /**
   * Default Cursor Models pool denominator when a cycle has no override.
   * Cursor does not publish this; default ~$2000 calibrated from Ultra usage.
   */
  cursor_models_included_usd: number;
  billing_cycle_start_day: number;
  updated_at: number;
}

/** Per billing-cycle override for Cursor Models pool size (Y). */
export interface CursorCyclePool {
  cycle_start: string;
  cursor_models_included_usd: number;
  updated_at: number;
}

export interface CursorImport {
  id: number;
  filename: string;
  row_count: number;
  inserted_count: number;
  skipped_count: number;
  min_event_at: number | null;
  max_event_at: number | null;
  imported_at: number;
}

export interface CursorGlobalStats {
  event_count: number;
  charged_count: number;
  errored_count: number;
  cloud_agent_count: number;
  ide_count: number;
  model_count: number;
  tokens_input_cache_write: number;
  tokens_input: number;
  tokens_cache_read: number;
  tokens_output: number;
  tokens_total: number;
  min_event_at: number | null;
  max_event_at: number | null;
}

export interface CursorDailyUsage {
  day: string;
  event_count: number;
  tokens_input: number;
  tokens_input_cache_write: number;
  tokens_cache_read: number;
  tokens_output: number;
  tokens_total: number;
  cloud_agent_count: number;
  ide_count: number;
}

export interface CursorModelUsageRow {
  model: string;
  event_count: number;
  tokens_input: number;
  tokens_input_cache_write: number;
  tokens_cache_read: number;
  tokens_output: number;
  tokens_total: number;
}

export interface CursorAgentUsageRow {
  cloud_agent_id: string;
  event_count: number;
  tokens_input: number;
  tokens_input_cache_write: number;
  tokens_cache_read: number;
  tokens_output: number;
  tokens_total: number;
  last_event_at: number;
}

export interface CursorEventCostRow {
  model: string;
  reported_cost: number | null;
  tokens_input: number;
  tokens_input_cache_write: number;
  tokens_cache_read: number;
  tokens_output: number;
}

export interface CursorDailyModelUsageRow {
  day: string;
  model: string;
  reported_cost: number;
  tokens_input: number;
  tokens_input_cache_write: number;
  tokens_cache_read: number;
  tokens_output: number;
  tokens_total: number;
  event_count: number;
}
