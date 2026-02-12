// --- Database entity types (matching SQLite schema) ---

export interface Project {
  id: string;
  worktree: string;
  vcs: string | null;
  created_at: number;
}

export interface Session {
  id: string;
  project_id: string;
  parent_id: string | null;
  directory: string;
  title: string | null;
  version: string | null;
  additions: number;
  deletions: number;
  files_changed: number;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
}

export interface UserMessage {
  id: string;
  session_id: string;
  content: string | null;
  synthetic: number;
  compaction: number;
  undone_at: number | null;
  created_at: number;
}

export interface AssistantMessage {
  id: string;
  user_message_id: string;
  session_id: string;
  agent: string;
  provider_id: string;
  model_id: string;
  summary: number;
  cost: number;
  tokens_in: number;
  tokens_out: number;
  tokens_reasoning: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  finish: string | null;
  error_type: string | null;
  error_message: string | null;
  created_at: number;
  completed_at: number | null;
}

export interface Step {
  id: string;
  assistant_message_id: string;
  session_id: string;
  cost: number;
  tokens_in: number;
  tokens_out: number;
  tokens_reasoning: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  finish_reason: string | null;
  created_at: number;
}

export interface ToolCall {
  id: string;
  step_id: string;
  session_id: string;
  call_id: string;
  tool: string;
  status: string;
  title: string | null;
  error: string | null;
  compacted_at: number | null;
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
}

export interface AssistantBlob {
  id: number;
  assistant_message_id: string;
  blob_type: 'text' | 'reasoning';
  content: string;
  size_bytes: number;
}

export interface ToolCallBlob {
  id: number;
  tool_call_id: string;
  blob_type: 'tool_input' | 'tool_output';
  content: string;
  size_bytes: number;
}

// --- Composite view types (for query results) ---

export interface SessionWithStats {
  id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
  additions: number;
  deletions: number;
  files_changed: number;
  archived_at: number | null;
  turn_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  models_used: number;
}

export interface ProjectWithStats {
  id: string;
  worktree: string;
  created_at: number;
  session_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  last_activity: number;
}

export interface MessageThread {
  user_message_id: string;
  user_content: string | null;
  synthetic: number;
  compaction: number;
  undone_at: number | null;
  user_created_at: number;
  assistant_message_id: string | null;
  model_id: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_reasoning: number | null;
  cost: number | null;
  finish: string | null;
  error_type: string | null;
  error_message: string | null;
  assistant_created_at: number | null;
  completed_at: number | null;
  assistant_text: string | null;
}

export interface DailyTokenUsage {
  day: string;
  total_in: number;
  total_out: number;
  total_reasoning: number;
  total_cost: number;
  response_count: number;
}

export interface ModelUsage {
  model_id: string;
  provider_id: string;
  response_count: number;
  total_in: number;
  total_out: number;
  total_reasoning: number;
  total_cache_read: number;
  total_cache_write: number;
  total_cost: number;
  avg_in: number;
  avg_out: number;
  cache_hit_pct: number;
}

export interface ToolUsage {
  tool: string;
  call_count: number;
  error_count: number;
  error_rate: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  total_input_bytes: number;
  total_output_bytes: number;
}

export interface SubtaskNode {
  id: string;
  parent_id: string | null;
  title: string | null;
  depth: number;
}

export interface DailyErrorRate {
  day: string;
  total_responses: number;
  errors: number;
  error_rate: number;
}

export interface CacheEfficiency {
  day: string;
  cached_tokens: number;
  total_input_tokens: number;
  cache_hit_pct: number;
}

export interface GlobalStats {
  total_projects: number;
  total_sessions: number;
  total_turns: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  total_cost: number;
  total_tool_calls: number;
  models_used: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
