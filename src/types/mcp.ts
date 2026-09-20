export interface McpSettings {
  tavily_warn_pct: number;
  updated_at: number;
}

export interface McpLink {
  id: number;
  name: string;
  url: string;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface McpUsageSnapshot {
  id: number;
  fetched_at: number;
  cycle_month: string;
  tavily_ok: number;
  tavily_error: string | null;
  tavily_plan: string | null;
  tavily_plan_usage: number | null;
  tavily_plan_limit: number | null;
  tavily_paygo_usage: number | null;
  tavily_paygo_limit: number | null;
  tavily_search_usage: number | null;
  tavily_extract_usage: number | null;
  tavily_crawl_usage: number | null;
  tavily_map_usage: number | null;
  tavily_research_usage: number | null;
  tavily_key_usage: number | null;
  tavily_key_limit: number | null;
}

export interface McpToolUsageRow {
  tool: string;
  provider: 'exa' | 'tavily';
  call_count: number;
  error_count: number;
  error_rate: number;
  avg_duration_ms: number;
  max_duration_ms: number;
}

export interface McpDailySnapshotPoint {
  day: string;
  tavily_plan_usage: number | null;
}
