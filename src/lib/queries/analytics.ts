import { queryAll } from '@/lib/db';
import type {
  DailyTokenUsage,
  ModelUsage,
  ToolUsage,
  DailyErrorRate,
  CacheEfficiency,
} from '@/types';

export function getDailyTokenUsage(
  startMs?: number,
  endMs?: number,
): { data: DailyTokenUsage[] | null; error: string | null } {
  const conditions: string[] = [];
  const params: number[] = [];

  if (startMs !== undefined) {
    conditions.push('am.created_at >= ?');
    params.push(startMs);
  }
  if (endMs !== undefined) {
    conditions.push('am.created_at <= ?');
    params.push(endMs);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return queryAll<DailyTokenUsage>(`
    SELECT
      DATE(am.created_at / 1000, 'unixepoch', 'localtime') AS day,
      SUM(am.tokens_in) AS total_in,
      SUM(am.tokens_out) AS total_out,
      SUM(am.tokens_reasoning) AS total_reasoning,
      SUM(am.cost) AS total_cost,
      COUNT(*) AS response_count
    FROM assistant_messages am
    ${where}
    GROUP BY day
    ORDER BY day
  `, params.length > 0 ? params : undefined);
}

export function getModelUsage(): { data: ModelUsage[] | null; error: string | null } {
  return queryAll<ModelUsage>(`
    SELECT
      am.model_id,
      am.provider_id,
      COUNT(*) AS response_count,
      SUM(am.tokens_in) AS total_in,
      SUM(am.tokens_out) AS total_out,
      SUM(am.tokens_reasoning) AS total_reasoning,
      SUM(am.cost) AS total_cost,
      ROUND(AVG(am.tokens_in), 0) AS avg_in,
      ROUND(AVG(am.tokens_out), 0) AS avg_out,
      CASE WHEN SUM(am.tokens_in) > 0
        THEN ROUND(100.0 * SUM(am.tokens_cache_read) / SUM(am.tokens_in), 1)
        ELSE 0
      END AS cache_hit_pct
    FROM assistant_messages am
    WHERE am.model_id IS NOT NULL
    GROUP BY am.model_id, am.provider_id
    ORDER BY total_out DESC
  `);
}

export function getToolUsage(): { data: ToolUsage[] | null; error: string | null } {
  return queryAll<ToolUsage>(`
    SELECT
      tc.tool,
      COUNT(*) AS call_count,
      SUM(CASE WHEN tc.status = 'error' THEN 1 ELSE 0 END) AS error_count,
      ROUND(
        100.0 * SUM(CASE WHEN tc.status = 'error' THEN 1 ELSE 0 END) / COUNT(*),
        1
      ) AS error_rate,
      ROUND(AVG(tc.duration_ms), 0) AS avg_duration_ms,
      MAX(tc.duration_ms) AS max_duration_ms,
      SUM(COALESCE(tcb_in.size_bytes, 0)) AS total_input_bytes,
      SUM(COALESCE(tcb_out.size_bytes, 0)) AS total_output_bytes
    FROM tool_calls tc
    LEFT JOIN tool_call_blobs tcb_in
      ON tcb_in.tool_call_id = tc.id AND tcb_in.blob_type = 'tool_input'
    LEFT JOIN tool_call_blobs tcb_out
      ON tcb_out.tool_call_id = tc.id AND tcb_out.blob_type = 'tool_output'
    GROUP BY tc.tool
    ORDER BY call_count DESC
  `);
}

export function getDailyErrorRate(): { data: DailyErrorRate[] | null; error: string | null } {
  return queryAll<DailyErrorRate>(`
    SELECT
      DATE(am.created_at / 1000, 'unixepoch', 'localtime') AS day,
      COUNT(*) AS total_responses,
      SUM(CASE WHEN am.error_type IS NOT NULL THEN 1 ELSE 0 END) AS errors,
      ROUND(
        100.0 * SUM(CASE WHEN am.error_type IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*),
        1
      ) AS error_rate
    FROM assistant_messages am
    GROUP BY day
    ORDER BY day
  `);
}

export function getCacheEfficiency(): {
  data: CacheEfficiency[] | null;
  error: string | null;
} {
  return queryAll<CacheEfficiency>(`
    SELECT
      DATE(am.created_at / 1000, 'unixepoch', 'localtime') AS day,
      SUM(am.tokens_cache_read) AS cached_tokens,
      SUM(am.tokens_in) AS total_input_tokens,
      CASE WHEN SUM(am.tokens_in) > 0
        THEN ROUND(100.0 * SUM(am.tokens_cache_read) / SUM(am.tokens_in), 1)
        ELSE 0
      END AS cache_hit_pct
    FROM assistant_messages am
    GROUP BY day
    ORDER BY day
  `);
}
