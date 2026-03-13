import { queryAll } from '@/lib/db';
import type {
  CacheEfficiency,
  DailyErrorRate,
  DailyTokenUsage,
  ModelUsage,
  ToolUsage,
} from '@/types';

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

export async function getDailyTokenUsage(
  startMs?: number,
  endMs?: number,
): Promise<{ data: DailyTokenUsage[] | null; error: string | null }> {
  const range = dayRangeSql(startMs, endMs);
  return queryAll<DailyTokenUsage>(`
    SELECT
      day,
      total_tokens_in + total_tokens_cache_read AS total_in,
      total_tokens_out AS total_out,
      total_tokens_reasoning AS total_reasoning,
      reported_cost,
      response_count
    FROM daily_global_rollups
    ${range.where}
    ORDER BY day
  `, range.args.length > 0 ? range.args : undefined);
}

export async function getModelUsage(
  startMs?: number,
  endMs?: number,
): Promise<{ data: ModelUsage[] | null; error: string | null }> {
  const conditions: string[] = [];
  const args: number[] = [];

  if (startMs !== undefined) {
    conditions.push(`time_created >= ?`);
    args.push(startMs);
  }
  if (endMs !== undefined) {
    conditions.push(`time_created <= ?`);
    args.push(endMs);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return queryAll<ModelUsage>(`
    SELECT
      model_id,
      provider_id,
      COUNT(*) AS response_count,
      SUM(CASE WHEN error_type IS NOT NULL THEN 1 ELSE 0 END) AS error_count,
      COALESCE(SUM(tokens_in + tokens_cache_read), 0) AS total_in,
      COALESCE(SUM(tokens_out), 0) AS total_out,
      COALESCE(SUM(tokens_reasoning), 0) AS total_reasoning,
      COALESCE(SUM(tokens_cache_read), 0) AS total_cache_read,
      COALESCE(SUM(tokens_cache_write), 0) AS total_cache_write,
      COALESCE(SUM(cost), 0) AS total_cost,
      CASE
        WHEN COALESCE(SUM(tokens_in + tokens_cache_read), 0) > 0
          THEN ROUND(100.0 * SUM(tokens_cache_read) / SUM(tokens_in + tokens_cache_read), 1)
        ELSE 0
      END AS cache_hit_pct
    FROM responses
    ${where}
    GROUP BY model_id, provider_id
    ORDER BY total_out DESC, response_count DESC
  `, args.length > 0 ? args : undefined);
}

export async function getToolUsage(): Promise<{ data: ToolUsage[] | null; error: string | null }> {
  return queryAll<ToolUsage>(`
    SELECT
      tool,
      call_count,
      error_count,
      CASE WHEN call_count > 0 THEN ROUND(100.0 * error_count / call_count, 1) ELSE 0 END AS error_rate,
      avg_duration_ms,
      max_duration_ms,
      total_input_bytes,
      total_output_bytes
    FROM tool_rollups
    ORDER BY call_count DESC, tool ASC
  `);
}

export async function getDailyErrorRate(
  startMs?: number,
  endMs?: number,
): Promise<{ data: DailyErrorRate[] | null; error: string | null }> {
  const range = dayRangeSql(startMs, endMs);
  return queryAll<DailyErrorRate>(`
    SELECT
      day,
      response_count AS total_responses,
      error_count AS errors,
      CASE WHEN response_count > 0 THEN ROUND(100.0 * error_count / response_count, 1) ELSE 0 END AS error_rate
    FROM daily_global_rollups
    ${range.where}
    ORDER BY day
  `, range.args.length > 0 ? range.args : undefined);
}

export async function getCacheEfficiency(
  startMs?: number,
  endMs?: number,
): Promise<{ data: CacheEfficiency[] | null; error: string | null }> {
  const range = dayRangeSql(startMs, endMs);
  return queryAll<CacheEfficiency>(`
    SELECT
      day,
      total_tokens_cache_read AS cached_tokens,
      total_tokens_in + total_tokens_cache_read AS total_input_tokens,
      CASE
        WHEN total_tokens_in + total_tokens_cache_read > 0
          THEN ROUND(100.0 * total_tokens_cache_read / (total_tokens_in + total_tokens_cache_read), 1)
        ELSE 0
      END AS cache_hit_pct
    FROM daily_global_rollups
    ${range.where}
    ORDER BY day
  `, range.args.length > 0 ? range.args : undefined);
}
