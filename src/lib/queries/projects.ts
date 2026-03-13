import { queryAll, queryOne } from '@/lib/db';
import type { PaginatedResult, ProjectCostAggregate, ProjectWithStats } from '@/types';

export async function getProjects(
  page: number = 1,
  pageSize: number = 20,
): Promise<{ data: PaginatedResult<ProjectWithStats> | null; error: string | null }> {
  const offset = (page - 1) * pageSize;

  const countResult = await queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM projects');
  if (countResult.error || !countResult.data) {
    return { data: null, error: countResult.error ?? 'Failed to count projects' };
  }

  const rows = await queryAll<ProjectWithStats>(`
    SELECT
      p.id,
      p.worktree,
      p.name,
      p.time_created AS created_at,
      p.time_updated AS updated_at,
      COALESCE(pr.session_count, 0) AS session_count,
      COALESCE(pr.turn_count, 0) AS turn_count,
      COALESCE(pr.total_tokens_in, 0) AS total_tokens_in,
      COALESCE(pr.total_tokens_out, 0) AS total_tokens_out,
      COALESCE(pr.total_tokens_reasoning, 0) AS total_tokens_reasoning,
      COALESCE(pr.total_tokens_cache_read, 0) AS total_tokens_cache_read,
      COALESCE(pr.total_tokens_cache_write, 0) AS total_tokens_cache_write,
      COALESCE(pr.total_turn_wall_time_ms, 0) AS total_turn_wall_time_ms,
      COALESCE(pr.total_assistant_time_ms, 0) AS total_assistant_time_ms,
      COALESCE(pr.total_tool_time_ms, 0) AS total_tool_time_ms,
      COALESCE(pr.total_tool_calls, 0) AS total_tool_calls,
      COALESCE(pr.models_used, 0) AS models_used,
      COALESCE(pr.reported_cost, 0) AS reported_cost,
      pr.last_activity
    FROM projects p
    LEFT JOIN project_rollups pr ON pr.project_id = p.id
    ORDER BY COALESCE(pr.last_activity, p.time_updated) DESC, p.worktree ASC
    LIMIT ? OFFSET ?
  `, [pageSize, offset]);

  if (rows.error || !rows.data) {
    return { data: null, error: rows.error ?? 'Failed to fetch projects' };
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

export async function getProjectById(
  projectId: string,
): Promise<{ data: ProjectWithStats | null; error: string | null }> {
  return queryOne<ProjectWithStats>(`
    SELECT
      p.id,
      p.worktree,
      p.name,
      p.time_created AS created_at,
      p.time_updated AS updated_at,
      COALESCE(pr.session_count, 0) AS session_count,
      COALESCE(pr.turn_count, 0) AS turn_count,
      COALESCE(pr.total_tokens_in, 0) AS total_tokens_in,
      COALESCE(pr.total_tokens_out, 0) AS total_tokens_out,
      COALESCE(pr.total_tokens_reasoning, 0) AS total_tokens_reasoning,
      COALESCE(pr.total_tokens_cache_read, 0) AS total_tokens_cache_read,
      COALESCE(pr.total_tokens_cache_write, 0) AS total_tokens_cache_write,
      COALESCE(pr.total_turn_wall_time_ms, 0) AS total_turn_wall_time_ms,
      COALESCE(pr.total_assistant_time_ms, 0) AS total_assistant_time_ms,
      COALESCE(pr.total_tool_time_ms, 0) AS total_tool_time_ms,
      COALESCE(pr.total_tool_calls, 0) AS total_tool_calls,
      COALESCE(pr.models_used, 0) AS models_used,
      COALESCE(pr.reported_cost, 0) AS reported_cost,
      pr.last_activity
    FROM projects p
    LEFT JOIN project_rollups pr ON pr.project_id = p.id
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
      project_id,
      model_id,
      total_tokens_in AS total_in,
      total_tokens_out AS total_out,
      total_tokens_cache_read AS total_cache_read,
      total_tokens_cache_write AS total_cache_write,
      reported_cost
    FROM project_model_rollups
    WHERE project_id IN (${placeholders})
    ORDER BY project_id, total_out DESC, model_id ASC
  `, projectIds);
}
