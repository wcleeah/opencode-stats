import { queryAll, queryOne } from '@/lib/db';
import type { DailyTimeUsage, TimeStats, ProjectTimeBreakdown } from '@/types';

export async function getTimeStats(
  startMs?: number,
  endMs?: number,
): Promise<{ data: TimeStats | null; error: string | null }> {
  const umConditions: string[] = [
    'um.synthetic = 0',
    'um.compaction = 0',
    'um.undone_at IS NULL',
    'um.turn_duration_ms IS NOT NULL',
    'um.turn_duration_ms > 0',
  ];
  const umParams: number[] = [];

  const amConditions: string[] = [
    'am.completed_at IS NOT NULL',
  ];
  const amParams: number[] = [];

  if (startMs !== undefined) {
    umConditions.push('um.created_at >= ?');
    umParams.push(startMs);
    amConditions.push('am.created_at >= ?');
    amParams.push(startMs);
  }
  if (endMs !== undefined) {
    umConditions.push('um.created_at <= ?');
    umParams.push(endMs);
    amConditions.push('am.created_at <= ?');
    amParams.push(endMs);
  }

  const umWhere = `WHERE ${umConditions.join(' AND ')}`;
  const amWhere = `WHERE ${amConditions.join(' AND ')}`;

  return queryOne<TimeStats>(`
    SELECT
      COALESCE(t.total_active_time_ms, 0) AS total_active_time_ms,
      COALESCE(t.total_turns, 0) AS total_turns,
      COALESCE(t.avg_turn_duration_ms, 0) AS avg_turn_duration_ms,
      COALESCE(t.max_turn_duration_ms, 0) AS max_turn_duration_ms,
      COALESCE(r.avg_response_time_ms, 0) AS avg_response_time_ms,
      COALESCE(r.total_responses, 0) AS total_responses
    FROM (
      SELECT
        SUM(um.turn_duration_ms) AS total_active_time_ms,
        COUNT(*) AS total_turns,
        ROUND(AVG(um.turn_duration_ms), 0) AS avg_turn_duration_ms,
        MAX(um.turn_duration_ms) AS max_turn_duration_ms
      FROM user_messages um
      ${umWhere}
    ) t,
    (
      SELECT
        ROUND(AVG(am.completed_at - am.created_at), 0) AS avg_response_time_ms,
        COUNT(*) AS total_responses
      FROM assistant_messages am
      ${amWhere}
    ) r
  `, [...umParams, ...amParams]);
}

export async function getDailyTimeUsage(
  startMs?: number,
  endMs?: number,
): Promise<{ data: DailyTimeUsage[] | null; error: string | null }> {
  const umConditions: string[] = [
    'um.synthetic = 0',
    'um.compaction = 0',
    'um.undone_at IS NULL',
    'um.turn_duration_ms IS NOT NULL',
    'um.turn_duration_ms > 0',
  ];
  const umParams: number[] = [];

  const amConditions: string[] = [
    'am.completed_at IS NOT NULL',
  ];
  const amParams: number[] = [];

  if (startMs !== undefined) {
    umConditions.push('um.created_at >= ?');
    umParams.push(startMs);
    amConditions.push('am.created_at >= ?');
    amParams.push(startMs);
  }
  if (endMs !== undefined) {
    umConditions.push('um.created_at <= ?');
    umParams.push(endMs);
    amConditions.push('am.created_at <= ?');
    amParams.push(endMs);
  }

  const umWhere = `WHERE ${umConditions.join(' AND ')}`;
  const amWhere = `WHERE ${amConditions.join(' AND ')}`;

  // Use a UNION approach: get daily data from both tables, then join by day
  return queryAll<DailyTimeUsage>(`
    SELECT
      COALESCE(t.day, r.day) AS day,
      COALESCE(t.total_active_time_ms, 0) AS total_active_time_ms,
      COALESCE(r.total_response_time_ms, 0) AS total_response_time_ms,
      COALESCE(t.turn_count, 0) AS turn_count,
      COALESCE(r.response_count, 0) AS response_count
    FROM (
      SELECT
        DATE(um.created_at / 1000, 'unixepoch', 'localtime') AS day,
        SUM(um.turn_duration_ms) AS total_active_time_ms,
        COUNT(*) AS turn_count
      FROM user_messages um
      ${umWhere}
      GROUP BY day
    ) t
    FULL OUTER JOIN (
      SELECT
        DATE(am.created_at / 1000, 'unixepoch', 'localtime') AS day,
        SUM(am.completed_at - am.created_at) AS total_response_time_ms,
        COUNT(*) AS response_count
      FROM assistant_messages am
      ${amWhere}
      GROUP BY day
    ) r ON r.day = t.day
    ORDER BY day
  `, [...umParams, ...amParams]);
}

export async function getProjectTimeBreakdown(
  startMs?: number,
  endMs?: number,
): Promise<{ data: ProjectTimeBreakdown[] | null; error: string | null }> {
  const umConditions: string[] = [
    'um.synthetic = 0',
    'um.compaction = 0',
    'um.undone_at IS NULL',
    'um.turn_duration_ms IS NOT NULL',
    'um.turn_duration_ms > 0',
  ];
  const umParams: number[] = [];

  const amConditions: string[] = [
    'am.completed_at IS NOT NULL',
  ];
  const amParams: number[] = [];

  if (startMs !== undefined) {
    umConditions.push('um.created_at >= ?');
    umParams.push(startMs);
    amConditions.push('am.created_at >= ?');
    amParams.push(startMs);
  }
  if (endMs !== undefined) {
    umConditions.push('um.created_at <= ?');
    umParams.push(endMs);
    amConditions.push('am.created_at <= ?');
    amParams.push(endMs);
  }

  const umWhere = `WHERE ${umConditions.join(' AND ')}`;
  const amWhere = `WHERE ${amConditions.join(' AND ')}`;

  return queryAll<ProjectTimeBreakdown>(`
    SELECT
      p.id AS project_id,
      p.worktree,
      COALESCE(t.total_active_time_ms, 0) AS total_active_time_ms,
      COALESCE(t.turn_count, 0) AS turn_count,
      COALESCE(t.avg_turn_duration_ms, 0) AS avg_turn_duration_ms,
      COALESCE(r.avg_response_time_ms, 0) AS avg_response_time_ms,
      COALESCE(t.last_activity, r.last_activity, p.created_at) AS last_activity
    FROM projects p
    LEFT JOIN (
      SELECT
        s.project_id,
        SUM(um.turn_duration_ms) AS total_active_time_ms,
        COUNT(*) AS turn_count,
        ROUND(AVG(um.turn_duration_ms), 0) AS avg_turn_duration_ms,
        MAX(um.created_at) AS last_activity
      FROM sessions s
      JOIN user_messages um ON um.session_id = s.id
      ${umWhere}
      GROUP BY s.project_id
    ) t ON t.project_id = p.id
    LEFT JOIN (
      SELECT
        s.project_id,
        ROUND(AVG(am.completed_at - am.created_at), 0) AS avg_response_time_ms,
        MAX(am.created_at) AS last_activity
      FROM sessions s
      JOIN assistant_messages am ON am.session_id = s.id
      ${amWhere}
      GROUP BY s.project_id
    ) r ON r.project_id = p.id
    WHERE p.id != '_unknown'
      AND (t.total_active_time_ms > 0 OR r.avg_response_time_ms > 0)
    ORDER BY total_active_time_ms DESC
    LIMIT 20
  `, [...umParams, ...amParams]);
}
