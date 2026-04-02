export interface Project {
  id: string;
  worktree: string;
  vcs: string | null;
  name: string | null;
  icon_url: string | null;
  icon_color: string | null;
  time_created: number;
  time_updated: number;
  time_initialized: number | null;
}

export interface Session {
  id: string;
  project_id: string;
  parent_session_id: string | null;
  root_session_id: string;
  slug: string;
  directory: string;
  title: string;
  version: string;
  share_url: string | null;
  summary_additions: number;
  summary_deletions: number;
  summary_files: number;
  archived_at: number | null;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
  time_created: number;
  time_updated: number;
}

export interface Turn {
  id: string;
  session_id: string;
  root_session_id: string;
  project_id: string;
  content: string | null;
  synthetic: number;
  compaction: number;
  undone_at: number | null;
  time_created: number;
  time_updated: number;
  turn_duration_ms: number | null;
}

export interface Response {
  id: string;
  turn_id: string;
  session_id: string;
  root_session_id: string;
  project_id: string;
  agent: string | null;
  provider_id: string;
  model_id: string;
  summary: number;
  finish: string | null;
  error_type: string | null;
  error_message: string | null;
  cost: number;
  tokens_in: number;
  tokens_out: number;
  tokens_reasoning: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  time_created: number;
  time_completed: number | null;
  response_time_ms: number | null;
}

export interface ResponsePart {
  response_id: string;
  part_id: string;
  part_type: 'text' | 'reasoning' | string;
  sort_key: string;
  content: string;
  size_bytes: number;
}

export interface ToolCallDetail {
  id: string;
  response_id: string;
  tool: string;
  title: string | null;
  status: string;
  error: string | null;
  duration_ms: number | null;
  input_content: string | null;
  output_content: string | null;
}

export interface SessionRollup {
  session_id: string;
  root_session_id: string;
  project_id: string;
  session_count: number;
  turn_count: number;
  response_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  reported_cost: number;
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  total_tool_calls: number;
  models_used: number;
  last_activity: number | null;
  updated_at: number;
}

export interface SessionModelRollup {
  session_id: string;
  model_id: string;
  provider_id: string;
  response_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  reported_cost: number;
}

export interface ProjectRollup {
  project_id: string;
  session_count: number;
  turn_count: number;
  response_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  reported_cost: number;
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  total_tool_calls: number;
  models_used: number;
  last_activity: number | null;
  updated_at: number;
}

export interface ProjectModelRollup {
  project_id: string;
  model_id: string;
  provider_id: string;
  response_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  reported_cost: number;
}

export interface ToolRollup {
  tool: string;
  call_count: number;
  error_count: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  total_input_bytes: number;
  total_output_bytes: number;
  last_called_at: number | null;
  updated_at: number;
}

export interface DailyGlobalRollup {
  day: string;
  turn_count: number;
  response_count: number;
  tool_call_count: number;
  error_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  reported_cost: number;
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  max_turn_wall_time_ms: number;
  max_assistant_time_ms: number;
  max_tool_duration_ms: number;
  updated_at: number;
}

export interface DailyModelRollup {
  day: string;
  model_id: string;
  provider_id: string;
  response_count: number;
  error_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  reported_cost: number;
  updated_at: number;
}

export interface DailyToolRollup {
  day: string;
  tool: string;
  call_count: number;
  error_count: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  total_input_bytes: number;
  total_output_bytes: number;
  updated_at: number;
}

export interface DailyProjectRollup {
  day: string;
  project_id: string;
  turn_count: number;
  response_count: number;
  error_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  reported_cost: number;
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  max_turn_wall_time_ms: number;
  max_assistant_time_ms: number;
  max_tool_duration_ms: number;
  updated_at: number;
}

export interface SessionWithStats {
  id: string;
  project_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  additions: number;
  deletions: number;
  files_changed: number;
  archived_at: number | null;
  turn_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  total_tool_calls: number;
  models_used: number;
  reported_cost: number;
}

export interface ProjectWithStats {
  id: string;
  worktree: string;
  name: string | null;
  created_at: number;
  updated_at: number;
  session_count: number;
  turn_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  total_tool_calls: number;
  models_used: number;
  reported_cost: number;
  last_activity: number | null;
}

export interface GlobalStats {
  total_projects: number;
  total_sessions: number;
  total_turns: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number;
  total_tokens_cache_read: number;
  total_tokens_cache_write: number;
  reported_cost: number;
  total_tool_calls: number;
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  models_used: number;
}

export interface DailyTokenUsage {
  day: string;
  total_in: number;
  total_out: number;
  total_reasoning: number;
  reported_cost: number;
  response_count: number;
}

export interface ModelUsage {
  model_id: string;
  provider_id: string;
  response_count: number;
  error_count: number;
  total_in: number;
  total_out: number;
  total_reasoning: number;
  total_cache_read: number;
  total_cache_write: number;
  total_cost: number;
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

export interface ProjectCostAggregate {
  project_id: string;
  model_id: string;
  total_in: number;
  total_out: number;
  total_cache_read: number;
  total_cache_write: number;
  reported_cost: number;
}

export interface SessionCostAggregate {
  model_id: string;
  total_in: number;
  total_out: number;
  total_cache_read: number;
  total_cache_write: number;
  reported_cost: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MessageThread {
  turn_id: string;
  user_content: string | null;
  synthetic: number;
  compaction: number;
  undone_at: number | null;
  user_created_at: number;
  turn_duration_ms: number | null;
  response_id: string | null;
  model_id: string | null;
  provider_id: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_reasoning: number | null;
  total_cost: number | null;
  finish: string | null;
  error_type: string | null;
  error_message: string | null;
  response_created_at: number | null;
  time_completed: number | null;
}

export interface SessionDetailToolCall extends ToolCallDetail {
  assistant_message_id: string;
}

export interface SubtaskNode {
  id: string;
  parent_session_id: string | null;
  title: string;
  depth: number;
}

export interface DailyTimeUsage {
  day: string;
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  turn_count: number;
  response_count: number;
}

export interface TimeStats {
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  total_turns: number;
  avg_turn_wall_time_ms: number;
  max_turn_wall_time_ms: number;
  avg_assistant_time_ms: number;
  max_assistant_time_ms: number;
  avg_tool_duration_ms: number;
  max_tool_duration_ms: number;
  total_responses: number;
}

export interface ProjectTimeBreakdown {
  project_id: string;
  worktree: string;
  total_turn_wall_time_ms: number;
  total_assistant_time_ms: number;
  total_tool_time_ms: number;
  turn_count: number;
  avg_turn_wall_time_ms: number;
  avg_assistant_time_ms: number;
  avg_tool_duration_ms: number;
  last_activity: number | null;
}
