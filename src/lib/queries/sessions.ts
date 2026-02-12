import { queryAll, queryOne } from '@/lib/db';
import type { SessionWithStats, PaginatedResult, SubtaskNode, Session } from '@/types';

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
    SELECT
      s.id,
      s.title,
      s.created_at,
      s.updated_at,
      s.additions,
      s.deletions,
      s.files_changed,
      s.archived_at,
      COUNT(DISTINCT um.id) FILTER (
        WHERE um.synthetic = 0 AND um.undone_at IS NULL
      ) AS turn_count,
      COALESCE(SUM(am.tokens_in), 0) AS total_tokens_in,
      COALESCE(SUM(am.tokens_out), 0) AS total_tokens_out,
      COALESCE(SUM(am.cost), 0) AS total_cost,
      COUNT(DISTINCT am.model_id) AS models_used
    FROM sessions s
    LEFT JOIN user_messages um ON um.session_id = s.id
    LEFT JOIN assistant_messages am ON am.session_id = s.id
    WHERE s.project_id = ?
      AND s.parent_id IS NULL
    GROUP BY s.id
    ORDER BY s.updated_at DESC
    LIMIT ? OFFSET ?
  `, [projectId, pageSize, offset]);

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
    SELECT
      s.id,
      s.title,
      s.created_at,
      s.updated_at,
      s.additions,
      s.deletions,
      s.files_changed,
      s.archived_at,
      COUNT(DISTINCT um.id) FILTER (
        WHERE um.synthetic = 0 AND um.undone_at IS NULL
      ) AS turn_count,
      COALESCE(SUM(am.tokens_in), 0) AS total_tokens_in,
      COALESCE(SUM(am.tokens_out), 0) AS total_tokens_out,
      COALESCE(SUM(am.cost), 0) AS total_cost,
      COUNT(DISTINCT am.model_id) AS models_used
    FROM sessions s
    LEFT JOIN user_messages um ON um.session_id = s.id
    LEFT JOIN assistant_messages am ON am.session_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `, [sessionId]);
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
