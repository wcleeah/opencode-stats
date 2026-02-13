import { queryAll, queryOne } from '@/lib/db';
import type {
  SessionWithStats,
  PaginatedResult,
  SubtaskNode,
  Session,
  SessionCostAggregate,
} from '@/types';

export async function getSessionsByProject(
  projectId: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ data: PaginatedResult<SessionWithStats> | null; error: string | null }> {
  const offset = (page - 1) * pageSize;

  const countResult = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sessions
     WHERE project_id = ? AND parent_id IS NULL`,
    [projectId],
  );

  if (countResult.error || !countResult.data) {
    return { data: null, error: countResult.error ?? 'Failed to count sessions' };
  }

  const total = countResult.data.total;
  const totalPages = Math.ceil(total / pageSize);

  const result = await queryAll<SessionWithStats>(`
    WITH RECURSIVE subtree AS (
      SELECT id, parent_id, id AS root_id
      FROM sessions
      WHERE project_id = ? AND parent_id IS NULL

      UNION ALL

      SELECT s.id, s.parent_id, st.root_id
      FROM sessions s
      JOIN subtree st ON s.parent_id = st.id
    )
    SELECT
      s.id,
      s.title,
      s.created_at,
      s.updated_at,
      s.additions,
      s.deletions,
      s.files_changed,
      s.archived_at,
      COALESCE(um.turn_count, 0) AS turn_count,
      COALESCE(am.total_tokens_in, 0) AS total_tokens_in,
      COALESCE(am.total_tokens_out, 0) AS total_tokens_out,
      COALESCE(am.total_tokens_cache_read, 0) AS total_tokens_cache_read,
      COALESCE(am.total_cost, 0) AS reported_cost,
      COALESCE(dur.total_active_time_ms, 0) AS total_active_time_ms,
      COALESCE(am.models_used, 0) AS models_used
    FROM sessions s
    LEFT JOIN (
      SELECT session_id, COUNT(*) AS turn_count
      FROM user_messages
      WHERE synthetic = 0 AND compaction = 0 AND undone_at IS NULL
      GROUP BY session_id
    ) um ON um.session_id = s.id
    LEFT JOIN (
      SELECT
        st.root_id,
        SUM(am.tokens_in + am.tokens_cache_read) AS total_tokens_in,
        SUM(am.tokens_out) AS total_tokens_out,
        SUM(am.tokens_cache_read) AS total_tokens_cache_read,
        SUM(am.cost) AS total_cost,
        COUNT(DISTINCT am.model_id) AS models_used
      FROM subtree st
      JOIN assistant_messages am ON am.session_id = st.id
      GROUP BY st.root_id
    ) am ON am.root_id = s.id
    LEFT JOIN (
      SELECT
        st.root_id,
        SUM(um.turn_duration_ms) AS total_active_time_ms
      FROM subtree st
      JOIN user_messages um ON um.session_id = st.id
      WHERE um.synthetic = 0 AND um.compaction = 0 AND um.undone_at IS NULL
        AND um.turn_duration_ms IS NOT NULL AND um.turn_duration_ms > 0
      GROUP BY st.root_id
    ) dur ON dur.root_id = s.id
    WHERE s.project_id = ?
      AND s.parent_id IS NULL
    ORDER BY s.updated_at DESC
    LIMIT ? OFFSET ?
  `, [projectId, projectId, pageSize, offset]);

  if (result.error || !result.data) {
    return { data: null, error: result.error ?? 'Failed to fetch sessions' };
  }

  return {
    data: {
      data: result.data,
      total,
      page,
      pageSize,
      totalPages,
    },
    error: null,
  };
}

export async function getSessionById(
  sessionId: string,
): Promise<{
  data: (Session & { project_worktree: string | null }) | null;
  error: string | null;
}> {
  return queryOne<Session & { project_worktree: string | null }>(`
    SELECT
      s.*,
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
    WITH RECURSIVE subtree AS (
      SELECT id, parent_id, id AS root_id
      FROM sessions
      WHERE id = ?

      UNION ALL

      SELECT s.id, s.parent_id, st.root_id
      FROM sessions s
      JOIN subtree st ON s.parent_id = st.id
    )
    SELECT
      s.id,
      s.title,
      s.created_at,
      s.updated_at,
      s.additions,
      s.deletions,
      s.files_changed,
      s.archived_at,
      COALESCE(um.turn_count, 0) AS turn_count,
      COALESCE(am.total_tokens_in, 0) AS total_tokens_in,
      COALESCE(am.total_tokens_out, 0) AS total_tokens_out,
      COALESCE(am.total_tokens_cache_read, 0) AS total_tokens_cache_read,
      COALESCE(am.total_cost, 0) AS reported_cost,
      COALESCE(dur.total_active_time_ms, 0) AS total_active_time_ms,
      COALESCE(am.models_used, 0) AS models_used
    FROM sessions s
    LEFT JOIN (
      SELECT session_id, COUNT(*) AS turn_count
      FROM user_messages
      WHERE synthetic = 0 AND compaction = 0 AND undone_at IS NULL
      GROUP BY session_id
    ) um ON um.session_id = s.id
    LEFT JOIN (
      SELECT
        st.root_id,
        SUM(am.tokens_in + am.tokens_cache_read) AS total_tokens_in,
        SUM(am.tokens_out) AS total_tokens_out,
        SUM(am.tokens_cache_read) AS total_tokens_cache_read,
        SUM(am.cost) AS total_cost,
        COUNT(DISTINCT am.model_id) AS models_used
      FROM subtree st
      JOIN assistant_messages am ON am.session_id = st.id
      GROUP BY st.root_id
    ) am ON am.root_id = s.id
    LEFT JOIN (
      SELECT
        st.root_id,
        SUM(um.turn_duration_ms) AS total_active_time_ms
      FROM subtree st
      JOIN user_messages um ON um.session_id = st.id
      WHERE um.synthetic = 0 AND um.compaction = 0 AND um.undone_at IS NULL
        AND um.turn_duration_ms IS NOT NULL AND um.turn_duration_ms > 0
      GROUP BY st.root_id
    ) dur ON dur.root_id = s.id
    WHERE s.id = ?
  `, [sessionId, sessionId]);
}

export async function getSubtaskTree(
  rootSessionId: string,
): Promise<{ data: SubtaskNode[] | null; error: string | null }> {
  return queryAll<SubtaskNode>(`
    WITH RECURSIVE subtree AS (
      SELECT id, parent_id, title, 0 AS depth
      FROM sessions
      WHERE id = ?

      UNION ALL

      SELECT s.id, s.parent_id, s.title, st.depth + 1
      FROM sessions s
      JOIN subtree st ON s.parent_id = st.id
    )
    SELECT * FROM subtree ORDER BY depth, id
  `, [rootSessionId]);
}

export async function getSessionCostBreakdown(
  rootSessionId: string,
): Promise<{ data: SessionCostAggregate[] | null; error: string | null }> {
  return queryAll<SessionCostAggregate>(`
    WITH RECURSIVE subtree AS (
      SELECT id
      FROM sessions
      WHERE id = ?

      UNION ALL

      SELECT s.id
      FROM sessions s
      JOIN subtree st ON s.parent_id = st.id
    )
    SELECT
      COALESCE(am.model_id, '_unknown') AS model_id,
      SUM(am.tokens_in + am.tokens_cache_read) AS total_in,
      SUM(am.tokens_out) AS total_out,
      SUM(am.tokens_cache_read) AS total_cache_read,
      SUM(am.tokens_cache_write) AS total_cache_write,
      SUM(am.cost) AS reported_cost
    FROM assistant_messages am
    JOIN subtree st ON st.id = am.session_id
    GROUP BY am.model_id
  `, [rootSessionId]);
}
