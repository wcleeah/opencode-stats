import { queryAll, queryOne } from '@/lib/db';
import type { DailyTimeUsage, ProjectTimeBreakdown, TimeStats } from '@/types';

function dayRangeSql(startMs?: number, endMs?: number): { where: string; args: number[] } {
  const conditions: string[] = [];
  const args: number[] = [];

  if (startMs !== undefined) {
    conditions.push(`CAST(strftime('%s', day || 'T00:00:00Z') AS INTEGER) * 1000 >= ?`);
    args.push(startMs);
  }

  if (endMs !== undefined) {
    conditions.push(`CAST(strftime('%s', day || 'T00:00:00Z') AS INTEGER) * 1000 <= ?`);
    args.push(endMs);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    args,
  };
}

export async function getTimeStats(
  startMs?: number,
  endMs?: number,
): Promise<{ data: TimeStats | null; error: string | null }> {
  const range = dayRangeSql(startMs, endMs);
  return queryOne<TimeStats>(`
    SELECT
      COALESCE(SUM(total_turn_wall_time_ms), 0) AS total_turn_wall_time_ms,
      COALESCE(SUM(total_assistant_time_ms), 0) AS total_assistant_time_ms,
      COALESCE(SUM(total_tool_time_ms), 0) AS total_tool_time_ms,
      COALESCE(SUM(turn_count), 0) AS total_turns,
      CASE WHEN COALESCE(SUM(turn_count), 0) > 0
        THEN ROUND(1.0 * SUM(total_turn_wall_time_ms) / SUM(turn_count), 0)
        ELSE 0
      END AS avg_turn_wall_time_ms,
      COALESCE(MAX(max_turn_wall_time_ms), 0) AS max_turn_wall_time_ms,
      CASE WHEN COALESCE(SUM(response_count), 0) > 0
        THEN ROUND(1.0 * SUM(total_assistant_time_ms) / SUM(response_count), 0)
        ELSE 0
      END AS avg_assistant_time_ms,
      COALESCE(MAX(max_assistant_time_ms), 0) AS max_assistant_time_ms,
      CASE WHEN COALESCE(SUM(response_count), 0) > 0
        THEN ROUND(1.0 * SUM(total_tool_time_ms) / SUM(response_count), 0)
        ELSE 0
      END AS avg_tool_duration_ms,
      COALESCE(MAX(max_tool_duration_ms), 0) AS max_tool_duration_ms,
      COALESCE(SUM(response_count), 0) AS total_responses
    FROM daily_global_rollups
    ${range.where}
  `, range.args.length > 0 ? range.args : undefined);
}

export async function getDailyTimeUsage(
  startMs?: number,
  endMs?: number,
): Promise<{ data: DailyTimeUsage[] | null; error: string | null }> {
  const range = dayRangeSql(startMs, endMs);
  return queryAll<DailyTimeUsage>(`
    SELECT
      day,
      total_turn_wall_time_ms,
      total_assistant_time_ms,
      total_tool_time_ms,
      turn_count,
      response_count
    FROM daily_global_rollups
    ${range.where}
    ORDER BY day
  `, range.args.length > 0 ? range.args : undefined);
}

export async function getProjectTimeBreakdown(
  startMs?: number,
  endMs?: number,
): Promise<{ data: ProjectTimeBreakdown[] | null; error: string | null }> {
  const range = dayRangeSql(startMs, endMs);
  return queryAll<ProjectTimeBreakdown>(`
    WITH filtered AS (
      SELECT d.*, p.worktree
      FROM daily_project_rollups d
      JOIN projects p ON p.id = d.project_id
      ${range.where}
    )
    SELECT
      project_id,
      worktree,
      COALESCE(SUM(total_turn_wall_time_ms), 0) AS total_turn_wall_time_ms,
      COALESCE(SUM(total_assistant_time_ms), 0) AS total_assistant_time_ms,
      COALESCE(SUM(total_tool_time_ms), 0) AS total_tool_time_ms,
      COALESCE(SUM(turn_count), 0) AS turn_count,
      CASE WHEN COALESCE(SUM(turn_count), 0) > 0
        THEN ROUND(1.0 * SUM(total_turn_wall_time_ms) / SUM(turn_count), 0)
        ELSE 0
      END AS avg_turn_wall_time_ms,
      CASE WHEN COALESCE(SUM(response_count), 0) > 0
        THEN ROUND(1.0 * SUM(total_assistant_time_ms) / SUM(response_count), 0)
        ELSE 0
      END AS avg_assistant_time_ms,
      CASE WHEN COALESCE(SUM(response_count), 0) > 0
        THEN ROUND(1.0 * SUM(total_tool_time_ms) / SUM(response_count), 0)
        ELSE 0
      END AS avg_tool_duration_ms,
      MAX(updated_at) AS last_activity
    FROM filtered
    GROUP BY project_id, worktree
    ORDER BY total_turn_wall_time_ms DESC, project_id ASC
    LIMIT 20
  `, range.args.length > 0 ? range.args : undefined);
}
