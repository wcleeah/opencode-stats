import { queryOne } from '@/lib/db';
import type { GlobalStats } from '@/types';

export async function getGlobalStats(
  startMs?: number,
  endMs?: number,
): Promise<{
  data: GlobalStats | null;
  error: string | null;
}> {
  const amConditions: string[] = [];
  const umConditions: string[] = [];
  const tcConditions: string[] = [];
  const amParams: number[] = [];
  const umParams: number[] = [];
  const tcParams: number[] = [];

  if (startMs !== undefined) {
    amConditions.push('created_at >= ?');
    umConditions.push('created_at >= ?');
    tcConditions.push('started_at >= ?');
    amParams.push(startMs);
    umParams.push(startMs);
    tcParams.push(startMs);
  }
  if (endMs !== undefined) {
    amConditions.push('created_at <= ?');
    umConditions.push('created_at <= ?');
    tcConditions.push('started_at <= ?');
    amParams.push(endMs);
    umParams.push(endMs);
    tcParams.push(endMs);
  }

  const amWhere = amConditions.length > 0 ? `WHERE ${amConditions.join(' AND ')}` : '';
  const umWhere = umConditions.length > 0 ? `AND ${umConditions.join(' AND ')}` : '';
  const tcWhere = tcConditions.length > 0 ? `WHERE ${tcConditions.join(' AND ')}` : '';
  const amAnd = amConditions.length > 0 ? `AND ${amConditions.join(' AND ')}` : '';

  const totalParams = [
    ...umParams,
    ...amParams,
    ...amParams,
    ...amParams,
    ...amParams,
    ...amParams,
    ...tcParams,
    ...amParams,
  ];

  return queryOne<GlobalStats>(`
    SELECT
      (SELECT COUNT(*) FROM projects WHERE id != '_unknown') AS total_projects,
      (SELECT COUNT(*) FROM sessions WHERE parent_id IS NULL) AS total_sessions,
      (SELECT COUNT(*) FROM user_messages
        WHERE synthetic = 0 AND compaction = 0 AND undone_at IS NULL
        ${umWhere}) AS total_turns,
      (SELECT COALESCE(SUM(tokens_in + tokens_cache_read), 0)
        FROM assistant_messages ${amWhere}) AS total_tokens_in,
      (SELECT COALESCE(SUM(tokens_out), 0) FROM assistant_messages ${amWhere})
        AS total_tokens_out,
      (SELECT COALESCE(SUM(tokens_cache_read), 0) FROM assistant_messages ${amWhere})
        AS total_tokens_cache_read,
      (SELECT COALESCE(SUM(tokens_cache_write), 0) FROM assistant_messages ${amWhere})
        AS total_tokens_cache_write,
      (SELECT COALESCE(SUM(cost), 0) FROM assistant_messages ${amWhere}) AS reported_cost,
      (SELECT COUNT(*) FROM tool_calls ${tcWhere}) AS total_tool_calls,
      (SELECT COUNT(DISTINCT model_id) FROM assistant_messages
        WHERE model_id IS NOT NULL ${amAnd}) AS models_used
  `, totalParams.length > 0 ? totalParams : undefined);
}
