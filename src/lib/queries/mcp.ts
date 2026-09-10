import 'server-only';

import { execute, queryAll, queryOne } from '@/lib/db';
import { getUtcCalendarMonth, utcDayKey } from '@/lib/mcp/calendar';
import {
  DEFAULT_EXA_ALLOTMENT_USD,
  DEFAULT_EXA_WARN_USD,
  DEFAULT_TAVILY_WARN_PCT,
  MCP_MIN_REFRESH_MS,
  MCP_SNAPSHOT_TTL_MS,
} from '@/lib/mcp/constants';
import { readMcpEnvConfig } from '@/lib/mcp/env';
import {
  fetchExaUsage,
  isGenericExaAuthError,
  parseExaBreakdownJson,
  resolveExaApiKeyId,
  type ExaCostBreakdown,
} from '@/lib/mcp/exa';
import { lastSnapshotPerUtcDay } from '@/lib/mcp/history';
import {
  computeExaMetrics,
  computeTavilyMetrics,
  isMcpProviderTool,
  mcpToolProvider,
  type ExaPoolMetrics,
  type TavilyPoolMetrics,
} from '@/lib/mcp/metrics';
import { ensureMcpSchema } from '@/lib/mcp/schema';
import { fetchTavilyUsage } from '@/lib/mcp/tavily';
import type {
  McpDailySnapshotPoint,
  McpSettings,
  McpToolUsageRow,
  McpUsageSnapshot,
} from '@/types/mcp';

const DEFAULT_SETTINGS: McpSettings = {
  exa_allotment_usd: DEFAULT_EXA_ALLOTMENT_USD,
  exa_purchased_extra_usd: 0,
  tavily_warn_pct: DEFAULT_TAVILY_WARN_PCT,
  exa_warn_usd: DEFAULT_EXA_WARN_USD,
  updated_at: 0,
};

const SNAPSHOT_SELECT = `
  id,
  fetched_at,
  cycle_month,
  tavily_ok,
  tavily_error,
  tavily_plan,
  tavily_plan_usage,
  tavily_plan_limit,
  tavily_paygo_usage,
  tavily_paygo_limit,
  tavily_search_usage,
  tavily_extract_usage,
  tavily_crawl_usage,
  tavily_map_usage,
  tavily_research_usage,
  tavily_key_usage,
  tavily_key_limit,
  exa_ok,
  exa_error,
  exa_api_key_id,
  exa_api_key_name,
  exa_total_cost_usd,
  exa_breakdown_json
`;

let inflightRefresh: Promise<{
  data: McpUsageSnapshot | null;
  error: string | null;
  skipped: boolean;
}> | null = null;

async function withSchema<T>(
  fn: () => Promise<{ data: T | null; error: string | null }>,
): Promise<{ data: T | null; error: string | null }> {
  const schema = await ensureMcpSchema();
  if (schema.error) {
    return { data: null, error: schema.error };
  }
  return fn();
}

export async function getMcpSettings(): Promise<{
  data: McpSettings | null;
  error: string | null;
}> {
  return withSchema(async () => {
    const result = await queryOne<McpSettings>(`
      SELECT
        exa_allotment_usd,
        exa_purchased_extra_usd,
        tavily_warn_pct,
        exa_warn_usd,
        updated_at
      FROM mcp_settings
      WHERE id = 1
    `);
    if (result.error) return result;
    if (!result.data) {
      return { data: { ...DEFAULT_SETTINGS, updated_at: Date.now() }, error: null };
    }
    return result;
  });
}

export async function updateMcpSettings(input: {
  exaAllotmentUsd: number;
  exaPurchasedExtraUsd: number;
  tavilyWarnPct: number;
  exaWarnUsd: number;
}): Promise<{ data: McpSettings | null; error: string | null }> {
  return withSchema(async () => {
    const updatedAt = Date.now();
    const write = await execute(
      `UPDATE mcp_settings
       SET exa_allotment_usd = ?,
           exa_purchased_extra_usd = ?,
           tavily_warn_pct = ?,
           exa_warn_usd = ?,
           updated_at = ?
       WHERE id = 1`,
      [
        input.exaAllotmentUsd,
        input.exaPurchasedExtraUsd,
        input.tavilyWarnPct,
        input.exaWarnUsd,
        updatedAt,
      ],
    );
    if (write.error) {
      return { data: null, error: write.error };
    }
    return getMcpSettings();
  });
}

export async function getLatestMcpSnapshot(): Promise<{
  data: McpUsageSnapshot | null;
  error: string | null;
}> {
  return withSchema(() =>
    queryOne<McpUsageSnapshot>(
      `SELECT ${SNAPSHOT_SELECT}
       FROM mcp_usage_snapshots
       ORDER BY fetched_at DESC
       LIMIT 1`,
    ),
  );
}

export async function listMcpSnapshots(params: {
  cycleMonth: string;
  limit?: number;
}): Promise<{ data: McpUsageSnapshot[] | null; error: string | null }> {
  const limit = params.limit ?? 500;
  return withSchema(() =>
    queryAll<McpUsageSnapshot>(
      `SELECT ${SNAPSHOT_SELECT}
       FROM mcp_usage_snapshots
       WHERE cycle_month = ?
       ORDER BY fetched_at ASC
       LIMIT ?`,
      [params.cycleMonth, limit],
    ),
  );
}

function snapshotIsFresh(
  snapshot: McpUsageSnapshot | null,
  cycleMonth: string,
  nowMs: number,
  ttlMs: number,
): boolean {
  if (!snapshot) return false;
  if (snapshot.cycle_month !== cycleMonth) return false;
  if (isGenericExaAuthError(snapshot.exa_error)) return false;
  return nowMs - snapshot.fetched_at < ttlMs;
}

async function fetchAndStoreSnapshot(now: Date): Promise<{
  data: McpUsageSnapshot | null;
  error: string | null;
}> {
  const env = readMcpEnvConfig();
  const month = getUtcCalendarMonth(now);
  const startIso = new Date(month.startMs).toISOString();
  const endIso = now.toISOString();

  let tavilyOk = 0;
  let tavilyError: string | null = null;
  let tavily = null as Awaited<ReturnType<typeof fetchTavilyUsage>>['data'];
  let exaOk = 0;
  let exaError: string | null = null;
  let exa = null as Awaited<ReturnType<typeof fetchExaUsage>>['data'];
  let exaKeyName: string | null = null;
  let exaKeyId: string | null = env.exaApiKeyId;

  const jobs: Promise<void>[] = [];

  if (env.tavilyApiKey) {
    jobs.push(
      (async () => {
        const result = await fetchTavilyUsage(env.tavilyApiKey as string);
        if (result.error || !result.data) {
          tavilyError = result.error ?? 'Tavily usage fetch failed.';
          return;
        }
        tavily = result.data;
        tavilyOk = 1;
      })(),
    );
  } else {
    tavilyError = 'TAVILY_API_KEY is not set.';
  }

  if (env.exaServiceKey) {
    jobs.push(
      (async () => {
        const resolved = await resolveExaApiKeyId({
          serviceKey: env.exaServiceKey as string,
          configuredId: env.exaApiKeyId,
        });
        if (resolved.error || !resolved.data) {
          exaError = resolved.error ?? 'Could not resolve Exa API key id.';
          return;
        }
        exaKeyId = resolved.data.id;
        exaKeyName = resolved.data.name;
        const result = await fetchExaUsage({
          serviceKey: env.exaServiceKey as string,
          apiKeyId: resolved.data.id,
          startIso,
          endIso,
        });
        if (result.error || !result.data) {
          exaError = result.error ?? 'Exa usage fetch failed.';
          return;
        }
        exa = result.data;
        exaOk = 1;
        if (result.data.apiKeyName) {
          exaKeyName = result.data.apiKeyName;
        }
      })(),
    );
  } else {
    exaError = 'EXA_API_KEY is not set.';
  }

  await Promise.all(jobs);

  const breakdownJson = exa ? JSON.stringify(exa.breakdown) : null;
  const fetchedAt = now.getTime();
  const insert = await execute(
    `INSERT INTO mcp_usage_snapshots (
       fetched_at, cycle_month,
       tavily_ok, tavily_error, tavily_plan, tavily_plan_usage, tavily_plan_limit,
       tavily_paygo_usage, tavily_paygo_limit, tavily_search_usage, tavily_extract_usage,
       tavily_crawl_usage, tavily_map_usage, tavily_research_usage, tavily_key_usage,
       tavily_key_limit,
       exa_ok, exa_error, exa_api_key_id, exa_api_key_name, exa_total_cost_usd,
       exa_breakdown_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fetchedAt,
      month.key,
      tavilyOk,
      tavilyError,
      tavily?.plan ?? null,
      tavily?.planUsage ?? null,
      tavily?.planLimit ?? null,
      tavily?.paygoUsage ?? null,
      tavily?.paygoLimit ?? null,
      tavily?.searchUsage ?? null,
      tavily?.extractUsage ?? null,
      tavily?.crawlUsage ?? null,
      tavily?.mapUsage ?? null,
      tavily?.researchUsage ?? null,
      tavily?.keyUsage ?? null,
      tavily?.keyLimit ?? null,
      exaOk,
      exaError,
      exa?.apiKeyId ?? exaKeyId,
      exa?.apiKeyName ?? exaKeyName,
      exa?.totalCostUsd ?? null,
      breakdownJson,
    ],
  );
  if (insert.error) {
    return { data: null, error: insert.error };
  }

  return getLatestMcpSnapshot();
}

export async function refreshMcpSnapshot(params?: {
  force?: boolean;
  now?: Date;
}): Promise<{
  data: McpUsageSnapshot | null;
  error: string | null;
  skipped: boolean;
}> {
  const schema = await ensureMcpSchema();
  if (schema.error) {
    return { data: null, error: schema.error, skipped: false };
  }

  if (inflightRefresh) {
    return inflightRefresh;
  }

  inflightRefresh = (async () => {
    const now = params?.now ?? new Date();
    const month = getUtcCalendarMonth(now);
    const latest = await getLatestMcpSnapshot();
    if (latest.error) {
      return { data: null, error: latest.error, skipped: false };
    }

    const ttl = params?.force ? MCP_MIN_REFRESH_MS : MCP_SNAPSHOT_TTL_MS;
    if (snapshotIsFresh(latest.data, month.key, now.getTime(), ttl)) {
      return { data: latest.data, error: null, skipped: true };
    }

    const stored = await fetchAndStoreSnapshot(now);
    return { data: stored.data, error: stored.error, skipped: false };
  })();

  try {
    return await inflightRefresh;
  } finally {
    inflightRefresh = null;
  }
}

const MCP_TOOL_SQL = `
  (
    lower(tool) = 'exa'
    OR lower(tool) LIKE 'exa_%'
    OR lower(tool) LIKE 'exa-%'
    OR lower(tool) LIKE '%_exa'
    OR lower(tool) LIKE '%_exa_%'
    OR lower(tool) = 'tavily'
    OR lower(tool) LIKE 'tavily_%'
    OR lower(tool) LIKE 'tavily-%'
    OR lower(tool) LIKE '%_tavily%'
  )
`;

export async function getMcpLocalToolUsage(params: {
  startDay: string;
  endDay: string;
}): Promise<{
  data: McpToolUsageRow[] | null;
  error: string | null;
  source: 'daily' | 'all_time' | 'none';
}> {
  const daily = await queryAll<{
    tool: string;
    call_count: number;
    error_count: number;
    avg_duration_ms: number;
    max_duration_ms: number;
  }>(
    `SELECT
       tool,
       COALESCE(SUM(call_count), 0) AS call_count,
       COALESCE(SUM(error_count), 0) AS error_count,
       CASE
         WHEN COALESCE(SUM(call_count), 0) > 0
           THEN ROUND(1.0 * SUM(avg_duration_ms * call_count) / SUM(call_count), 1)
         ELSE 0
       END AS avg_duration_ms,
       COALESCE(MAX(max_duration_ms), 0) AS max_duration_ms
     FROM daily_tool_rollups
     WHERE day >= ? AND day <= ?
       AND ${MCP_TOOL_SQL}
     GROUP BY tool
     ORDER BY call_count DESC, tool ASC`,
    [params.startDay, params.endDay],
  );

  if (!daily.error && daily.data) {
    return {
      data: toToolRows(daily.data),
      error: null,
      source: 'daily',
    };
  }

  const allTime = await queryAll<{
    tool: string;
    call_count: number;
    error_count: number;
    avg_duration_ms: number;
    max_duration_ms: number;
  }>(
    `SELECT
       tool,
       call_count,
       error_count,
       avg_duration_ms,
       max_duration_ms
     FROM tool_rollups
     WHERE ${MCP_TOOL_SQL}
     ORDER BY call_count DESC, tool ASC`,
  );

  if (allTime.error) {
    console.error('[getMcpLocalToolUsage]', daily.error ?? allTime.error);
    return { data: [], error: null, source: 'none' };
  }

  return {
    data: toToolRows(allTime.data ?? []),
    error: null,
    source: (allTime.data && allTime.data.length > 0) ? 'all_time' : 'none',
  };
}

function toToolRows(
  rows: Array<{
    tool: string;
    call_count: number;
    error_count: number;
    avg_duration_ms: number;
    max_duration_ms: number;
  }>,
): McpToolUsageRow[] {
  return rows
    .filter((row) => isMcpProviderTool(row.tool))
    .map((row) => {
      const provider = mcpToolProvider(row.tool);
      if (!provider) {
        return null;
      }
      const callCount = Number(row.call_count) || 0;
      const errorCount = Number(row.error_count) || 0;
      return {
        tool: row.tool,
        provider,
        call_count: callCount,
        error_count: errorCount,
        error_rate: callCount > 0 ? Math.round((1000 * errorCount) / callCount) / 10 : 0,
        avg_duration_ms: Number(row.avg_duration_ms) || 0,
        max_duration_ms: Number(row.max_duration_ms) || 0,
      };
    })
    .filter((row): row is McpToolUsageRow => row !== null);
}

export interface McpDashboardData {
  settings: McpSettings;
  snapshot: McpUsageSnapshot | null;
  skippedRefresh: boolean;
  tavily: TavilyPoolMetrics | null;
  exa: ExaPoolMetrics | null;
  tavilyConfigured: boolean;
  exaConfigured: boolean;
  monthKey: string;
  monthLabel: string;
  elapsedRatio: number;
  daysUntilReset: number;
  lastFetchedAt: number | null;
  nextRefreshAt: number | null;
  history: McpDailySnapshotPoint[];
  localTools: McpToolUsageRow[];
  localToolSource: 'daily' | 'all_time' | 'none';
  exaBreakdown: ExaCostBreakdown[];
}

export async function getMcpDashboard(params?: {
  forceRefresh?: boolean;
  now?: Date;
}): Promise<{ data: McpDashboardData | null; error: string | null }> {
  const now = params?.now ?? new Date();
  const env = readMcpEnvConfig();
  const month = getUtcCalendarMonth(now);

  const settingsResult = await getMcpSettings();
  if (settingsResult.error || !settingsResult.data) {
    return { data: null, error: settingsResult.error ?? 'Failed to load MCP settings.' };
  }
  const settings = settingsResult.data;

  const refreshed = (env.tavilyConfigured || env.exaConfigured)
    ? await refreshMcpSnapshot({ force: params?.forceRefresh, now })
    : { data: (await getLatestMcpSnapshot()).data ?? null, error: null, skipped: true };

  if (refreshed.error && !refreshed.data) {
    return { data: null, error: refreshed.error };
  }

  const snapshot = refreshed.data;
  const historyResult = await listMcpSnapshots({ cycleMonth: month.key });
  const history = lastSnapshotPerUtcDay(historyResult.data ?? []);

  const startDay = utcDayKey(month.startMs);
  const endDay = utcDayKey(month.endMs);
  const localToolsResult = await getMcpLocalToolUsage({ startDay, endDay });

  const tavily = snapshot?.tavily_ok
    ? computeTavilyMetrics({
      plan: snapshot.tavily_plan,
      planUsage: snapshot.tavily_plan_usage ?? 0,
      planLimit: snapshot.tavily_plan_limit,
      paygoUsage: snapshot.tavily_paygo_usage ?? 0,
      paygoLimit: snapshot.tavily_paygo_limit,
      elapsedRatio: month.elapsedRatio,
      warnPct: settings.tavily_warn_pct,
    })
    : null;

  const exa = snapshot?.exa_ok
    ? computeExaMetrics({
      usedUsd: snapshot.exa_total_cost_usd ?? 0,
      allotmentUsd: settings.exa_allotment_usd,
      purchasedExtraUsd: settings.exa_purchased_extra_usd,
      elapsedRatio: month.elapsedRatio,
      warnRemainingUsd: settings.exa_warn_usd,
    })
    : null;

  const lastFetchedAt = snapshot?.fetched_at ?? null;
  const nextRefreshAt = lastFetchedAt !== null
    ? lastFetchedAt + MCP_SNAPSHOT_TTL_MS
    : null;

  return {
    data: {
      settings,
      snapshot,
      skippedRefresh: refreshed.skipped,
      tavily,
      exa,
      tavilyConfigured: env.tavilyConfigured,
      exaConfigured: env.exaConfigured,
      monthKey: month.key,
      monthLabel: month.label,
      elapsedRatio: month.elapsedRatio,
      daysUntilReset: month.daysUntilReset,
      lastFetchedAt,
      nextRefreshAt,
      history,
      localTools: localToolsResult.data ?? [],
      localToolSource: localToolsResult.source,
      exaBreakdown: parseExaBreakdownJson(snapshot?.exa_breakdown_json ?? null),
    },
    error: null,
  };
}
