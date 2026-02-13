import { queryAll, queryOne } from '@/lib/db';
import type { ProjectWithStats, PaginatedResult, ProjectCostAggregate } from '@/types';

export async function getProjects(
  page: number = 1,
  pageSize: number = 20,
): Promise<{ data: PaginatedResult<ProjectWithStats> | null; error: string | null }> {
  const offset = (page - 1) * pageSize;

  const countResult = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM projects WHERE id != '_unknown'`
  );

  if (countResult.error || !countResult.data) {
    return { data: null, error: countResult.error ?? 'Failed to count projects' };
  }

  const total = countResult.data.total;
  const totalPages = Math.ceil(total / pageSize);

  const result = await queryAll<ProjectWithStats>(`
    SELECT
      p.id,
      p.worktree,
      p.created_at,
      COALESCE(sc.session_count, 0) AS session_count,
      COALESCE(am.total_tokens_in, 0) AS total_tokens_in,
      COALESCE(am.total_tokens_out, 0) AS total_tokens_out,
      COALESCE(am.total_cost, 0) AS reported_cost,
      COALESCE(sc.last_activity, p.created_at) AS last_activity
    FROM projects p
    LEFT JOIN (
      SELECT
        project_id,
        COUNT(*) FILTER (WHERE parent_id IS NULL) AS session_count,
        MAX(updated_at) AS last_activity
      FROM sessions
      GROUP BY project_id
    ) sc ON sc.project_id = p.id
    LEFT JOIN (
      SELECT
        s.project_id,
        SUM(am.tokens_in) AS total_tokens_in,
        SUM(am.tokens_out) AS total_tokens_out,
        SUM(am.cost) AS total_cost
      FROM sessions s
      LEFT JOIN assistant_messages am ON am.session_id = s.id
      GROUP BY s.project_id
    ) am ON am.project_id = p.id
    WHERE p.id != '_unknown'
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

export async function getProjectById(
  projectId: string,
): Promise<{ data: ProjectWithStats | null; error: string | null }> {
  return queryOne<ProjectWithStats>(`
    SELECT
      p.id,
      p.worktree,
      p.created_at,
      COALESCE(sc.session_count, 0) AS session_count,
      COALESCE(am.total_tokens_in, 0) AS total_tokens_in,
      COALESCE(am.total_tokens_out, 0) AS total_tokens_out,
      COALESCE(am.total_cost, 0) AS reported_cost,
      COALESCE(sc.last_activity, p.created_at) AS last_activity
    FROM projects p
    LEFT JOIN (
      SELECT
        project_id,
        COUNT(*) FILTER (WHERE parent_id IS NULL) AS session_count,
        MAX(updated_at) AS last_activity
      FROM sessions
      GROUP BY project_id
    ) sc ON sc.project_id = p.id
    LEFT JOIN (
      SELECT
        s.project_id,
        SUM(am.tokens_in) AS total_tokens_in,
        SUM(am.tokens_out) AS total_tokens_out,
        SUM(am.cost) AS total_cost
      FROM sessions s
      LEFT JOIN assistant_messages am ON am.session_id = s.id
      GROUP BY s.project_id
    ) am ON am.project_id = p.id
    WHERE p.id = ?
  `, [projectId]);
}

export async function getProjectCostBreakdowns(
  projectIds: string[],
): Promise<{ data: ProjectCostAggregate[] | null; error: string | null }> {
  if (projectIds.length === 0) {
    return { data: [], error: null };
  }

  const placeholders = projectIds.map(() => '?').join(', ');

  return queryAll<ProjectCostAggregate>(`
    SELECT
      s.project_id,
      COALESCE(am.model_id, '_unknown') AS model_id,
      SUM(am.tokens_in) AS total_in,
      SUM(am.tokens_out) AS total_out,
      SUM(am.tokens_cache_read) AS total_cache_read,
      SUM(am.tokens_cache_write) AS total_cache_write,
      SUM(am.cost) AS reported_cost
    FROM sessions s
    JOIN assistant_messages am ON am.session_id = s.id
    WHERE s.project_id IN (${placeholders})
    GROUP BY s.project_id, am.model_id
  `, projectIds);
}
