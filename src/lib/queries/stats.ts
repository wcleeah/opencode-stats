import { queryOne } from '@/lib/db';
import type { GlobalStats } from '@/types';

export function getGlobalStats(): { data: GlobalStats | null; error: string | null } {
  return queryOne<GlobalStats>(`
    SELECT
      (SELECT COUNT(*) FROM projects WHERE id != '_unknown') AS total_projects,
      (SELECT COUNT(*) FROM sessions WHERE parent_id IS NULL) AS total_sessions,
      (SELECT COUNT(*) FROM user_messages
        WHERE synthetic = 0 AND undone_at IS NULL) AS total_turns,
      (SELECT COALESCE(SUM(tokens_in), 0) FROM assistant_messages) AS total_tokens_in,
      (SELECT COALESCE(SUM(tokens_out), 0) FROM assistant_messages) AS total_tokens_out,
      (SELECT COALESCE(SUM(tokens_cache_read), 0) FROM assistant_messages) AS total_tokens_cache_read,
      (SELECT COALESCE(SUM(tokens_cache_write), 0) FROM assistant_messages) AS total_tokens_cache_write,
      (SELECT COALESCE(SUM(cost), 0) FROM assistant_messages) AS total_cost,
      (SELECT COUNT(*) FROM tool_calls) AS total_tool_calls,
      (SELECT COUNT(DISTINCT model_id) FROM assistant_messages
        WHERE model_id IS NOT NULL) AS models_used
  `);
}
