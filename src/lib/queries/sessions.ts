import { queryAll, queryOne } from '@/lib/db';
import type {
  PaginatedResult,
  Session,
  SessionCostAggregate,
  SessionWithStats,
  SubtaskNode,
} from '@/types';

export async function getSessionsByProject(
  projectId: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ data: PaginatedResult<SessionWithStats> | null; error: string | null }> {
  const offset = (page - 1) * pageSize;

  const countResult = await queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM sessions WHERE project_id = ? AND parent_session_id IS NULL AND deleted_at IS NULL',
    [projectId],
  );

  if (countResult.error || !countResult.data) {
    return { data: null, error: countResult.error ?? 'Failed to count sessions' };
  }

  const rows = await queryAll<SessionWithStats>(`
    SELECT
      s.id,
      s.project_id,
      s.title,
      s.time_created AS created_at,
      s.time_updated AS updated_at,
      s.summary_additions AS additions,
      s.summary_deletions AS deletions,
      s.summary_files AS files_changed,
      s.archived_at,
      COALESCE(sr.turn_count, 0) AS turn_count,
      COALESCE(sr.total_tokens_in, 0) AS total_tokens_in,
      COALESCE(sr.total_tokens_out, 0) AS total_tokens_out,
      COALESCE(sr.total_tokens_reasoning, 0) AS total_tokens_reasoning,
      COALESCE(sr.total_tokens_cache_read, 0) AS total_tokens_cache_read,
      COALESCE(sr.total_tokens_cache_write, 0) AS total_tokens_cache_write,
      COALESCE(sr.total_turn_wall_time_ms, 0) AS total_turn_wall_time_ms,
      COALESCE(sr.total_assistant_time_ms, 0) AS total_assistant_time_ms,
      COALESCE(sr.total_tool_time_ms, 0) AS total_tool_time_ms,
      COALESCE(sr.total_tool_calls, 0) AS total_tool_calls,
      COALESCE(sr.models_used, 0) AS models_used,
      COALESCE(sr.reported_cost, 0) AS reported_cost
    FROM sessions s
    LEFT JOIN session_rollups sr ON sr.session_id = s.id
    WHERE s.project_id = ?
      AND s.parent_session_id IS NULL
      AND s.deleted_at IS NULL
    ORDER BY COALESCE(sr.last_activity, s.time_updated) DESC, s.id DESC
    LIMIT ? OFFSET ?
  `, [projectId, pageSize, offset]);

  if (rows.error || !rows.data) {
    return { data: null, error: rows.error ?? 'Failed to fetch sessions' };
  }

  return {
    data: {
      data: rows.data,
      total: countResult.data.total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(countResult.data.total / pageSize)),
    },
    error: null,
  };
}

export async function getSessionById(
  sessionId: string,
): Promise<{ data: (Session & { project_worktree: string | null }) | null; error: string | null }> {
  return queryOne<Session & { project_worktree: string | null }>(`
    SELECT
      s.*,
      s.time_created AS created_at,
      s.time_updated AS updated_at,
      p.worktree AS project_worktree
    FROM sessions s
    LEFT JOIN projects p ON p.id = s.project_id
    WHERE s.id = ?
  `, [sessionId]);
}

export async function getSessionStats(
  sessionId: string,
): Promise<{ data: SessionWithStats | null; error: string | null }> {
  return queryOne<SessionWithStats>(`
    SELECT
      s.id,
      s.project_id,
      s.title,
      s.time_created AS created_at,
      s.time_updated AS updated_at,
      s.summary_additions AS additions,
      s.summary_deletions AS deletions,
      s.summary_files AS files_changed,
      s.archived_at,
      COALESCE(sr.turn_count, 0) AS turn_count,
      COALESCE(sr.total_tokens_in, 0) AS total_tokens_in,
      COALESCE(sr.total_tokens_out, 0) AS total_tokens_out,
      COALESCE(sr.total_tokens_reasoning, 0) AS total_tokens_reasoning,
      COALESCE(sr.total_tokens_cache_read, 0) AS total_tokens_cache_read,
      COALESCE(sr.total_tokens_cache_write, 0) AS total_tokens_cache_write,
      COALESCE(sr.total_turn_wall_time_ms, 0) AS total_turn_wall_time_ms,
      COALESCE(sr.total_assistant_time_ms, 0) AS total_assistant_time_ms,
      COALESCE(sr.total_tool_time_ms, 0) AS total_tool_time_ms,
      COALESCE(sr.total_tool_calls, 0) AS total_tool_calls,
      COALESCE(sr.models_used, 0) AS models_used,
      COALESCE(sr.reported_cost, 0) AS reported_cost
    FROM sessions s
    LEFT JOIN session_rollups sr ON sr.session_id = s.id
    WHERE s.id = ?
  `, [sessionId]);
}

export async function getSubtaskTree(
  rootSessionId: string,
): Promise<{ data: SubtaskNode[] | null; error: string | null }> {
  return queryAll<SubtaskNode>(`
    WITH RECURSIVE subtree AS (
      SELECT id, parent_session_id, title, 0 AS depth
      FROM sessions
      WHERE id = ?

      UNION ALL

      SELECT s.id, s.parent_session_id, s.title, subtree.depth + 1 AS depth
      FROM sessions s
      JOIN subtree ON s.parent_session_id = subtree.id
      WHERE s.deleted_at IS NULL
    )
    SELECT * FROM subtree ORDER BY depth, id
  `, [rootSessionId]);
}

export async function getSessionCostBreakdown(
  rootSessionId: string,
): Promise<{ data: SessionCostAggregate[] | null; error: string | null }> {
  return queryAll<SessionCostAggregate>(`
    SELECT
      model_id,
      total_tokens_in AS total_in,
      total_tokens_out AS total_out,
      total_tokens_cache_read AS total_cache_read,
      total_tokens_cache_write AS total_cache_write,
      reported_cost
    FROM session_model_rollups
    WHERE session_id = ?
    ORDER BY total_out DESC, model_id ASC
  `, [rootSessionId]);
}
