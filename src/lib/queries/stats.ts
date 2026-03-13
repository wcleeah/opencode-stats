import { queryOne } from '@/lib/db';
import type { GlobalStats } from '@/types';

function rangeWhere(column: string, startMs?: number, endMs?: number): { clause: string; args: number[] } {
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

export async function getGlobalStats(
  startMs?: number,
  endMs?: number,
): Promise<{ data: GlobalStats | null; error: string | null }> {
  if (startMs === undefined && endMs === undefined) {
    return queryOne<GlobalStats>(`
      SELECT
        (SELECT COUNT(*) FROM projects) AS total_projects,
        (SELECT COUNT(*) FROM sessions WHERE parent_session_id IS NULL AND deleted_at IS NULL) AS total_sessions,
        (SELECT COUNT(*) FROM turns WHERE synthetic = 0 AND compaction = 0 AND undone_at IS NULL) AS total_turns,
        COALESCE(SUM(total_tokens_in + total_tokens_cache_read), 0) AS total_tokens_in,
        COALESCE(SUM(total_tokens_out), 0) AS total_tokens_out,
        COALESCE(SUM(total_tokens_reasoning), 0) AS total_tokens_reasoning,
        COALESCE(SUM(total_tokens_cache_read), 0) AS total_tokens_cache_read,
        COALESCE(SUM(total_tokens_cache_write), 0) AS total_tokens_cache_write,
        COALESCE(SUM(reported_cost), 0) AS reported_cost,
        COALESCE(SUM(tool_call_count), 0) AS total_tool_calls,
        COALESCE(SUM(total_active_time_ms), 0) AS total_active_time_ms,
        COALESCE(SUM(total_response_time_ms), 0) AS total_response_time_ms,
        (SELECT COUNT(DISTINCT model_id) FROM responses WHERE model_id IS NOT NULL) AS models_used
      FROM daily_global_rollups
    `);
  }

  const range = rangeWhere('day_ms', startMs, endMs);
  return queryOne<GlobalStats>(`
    WITH scoped_days AS (
      SELECT *, CAST(strftime('%s', day || 'T00:00:00Z') AS INTEGER) * 1000 AS day_ms
      FROM daily_global_rollups
    )
    SELECT
      (SELECT COUNT(*) FROM projects) AS total_projects,
      (SELECT COUNT(*) FROM sessions WHERE parent_session_id IS NULL AND deleted_at IS NULL) AS total_sessions,
      COALESCE(SUM(turn_count), 0) AS total_turns,
      COALESCE(SUM(total_tokens_in + total_tokens_cache_read), 0) AS total_tokens_in,
      COALESCE(SUM(total_tokens_out), 0) AS total_tokens_out,
      COALESCE(SUM(total_tokens_reasoning), 0) AS total_tokens_reasoning,
      COALESCE(SUM(total_tokens_cache_read), 0) AS total_tokens_cache_read,
      COALESCE(SUM(total_tokens_cache_write), 0) AS total_tokens_cache_write,
      COALESCE(SUM(reported_cost), 0) AS reported_cost,
      COALESCE(SUM(tool_call_count), 0) AS total_tool_calls,
      COALESCE(SUM(total_active_time_ms), 0) AS total_active_time_ms,
      COALESCE(SUM(total_response_time_ms), 0) AS total_response_time_ms,
      (
        SELECT COUNT(DISTINCT model_id)
        FROM responses
        WHERE 1 = 1
          ${startMs !== undefined ? 'AND time_created >= ?' : ''}
          ${endMs !== undefined ? 'AND time_created <= ?' : ''}
      ) AS models_used
    FROM scoped_days
    ${range.clause}
  `, [...[startMs, endMs].filter((value): value is number => value !== undefined), ...range.args]);
}
