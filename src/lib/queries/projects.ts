import { queryAll, queryOne } from '@/lib/db';
import type { ProjectWithStats, PaginatedResult } from '@/types';

export function getProjects(
  page: number = 1,
  pageSize: number = 20,
): { data: PaginatedResult<ProjectWithStats> | null; error: string | null } {
  const offset = (page - 1) * pageSize;

  const countResult = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM projects WHERE id != '_unknown'`
  );

  if (countResult.error || !countResult.data) {
    return { data: null, error: countResult.error ?? 'Failed to count projects' };
  }

  const total = countResult.data.total;
  const totalPages = Math.ceil(total / pageSize);

  const result = queryAll<ProjectWithStats>(`
    SELECT
      p.id,
      p.worktree,
      p.created_at,
      COUNT(DISTINCT s.id) FILTER (WHERE s.parent_id IS NULL) AS session_count,
      COALESCE(SUM(am.tokens_in), 0) AS total_tokens_in,
      COALESCE(SUM(am.tokens_out), 0) AS total_tokens_out,
      COALESCE(SUM(am.cost), 0) AS total_cost,
      COALESCE(MAX(s.updated_at), p.created_at) AS last_activity
    FROM projects p
    LEFT JOIN sessions s ON s.project_id = p.id
    LEFT JOIN assistant_messages am ON am.session_id = s.id
    WHERE p.id != '_unknown'
    GROUP BY p.id
    ORDER BY last_activity DESC
    LIMIT ? OFFSET ?
  `, [pageSize, offset]);

  if (result.error || !result.data) {
    return { data: null, error: result.error ?? 'Failed to fetch projects' };
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

export function getProjectById(
  projectId: string,
): { data: ProjectWithStats | null; error: string | null } {
  return queryOne<ProjectWithStats>(`
    SELECT
      p.id,
      p.worktree,
      p.created_at,
      COUNT(DISTINCT s.id) FILTER (WHERE s.parent_id IS NULL) AS session_count,
      COALESCE(SUM(am.tokens_in), 0) AS total_tokens_in,
      COALESCE(SUM(am.tokens_out), 0) AS total_tokens_out,
      COALESCE(SUM(am.cost), 0) AS total_cost,
      COALESCE(MAX(s.updated_at), p.created_at) AS last_activity
    FROM projects p
    LEFT JOIN sessions s ON s.project_id = p.id
    LEFT JOIN assistant_messages am ON am.session_id = s.id
    WHERE p.id = ?
    GROUP BY p.id
  `, [projectId]);
}
