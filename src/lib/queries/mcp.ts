import 'server-only';

import { execute, queryAll, queryOne } from '@/lib/db';
import { getUtcCalendarMonth } from '@/lib/mcp/calendar';
import {
  DEFAULT_TAVILY_WARN_PCT,
  MCP_MIN_REFRESH_MS,
  MCP_SNAPSHOT_TTL_MS,
} from '@/lib/mcp/constants';
import { readMcpEnvConfig } from '@/lib/mcp/env';
import { lastSnapshotPerUtcDay } from '@/lib/mcp/history';
import {
  computeTavilyMetrics,
  type TavilyPoolMetrics,
} from '@/lib/mcp/metrics';
import { ensureMcpSchema } from '@/lib/mcp/schema';
import { fetchTavilyUsage } from '@/lib/mcp/tavily';
import type {
  McpDailySnapshotPoint,
  McpLink,
  McpSettings,
  McpUsageSnapshot,
} from '@/types/mcp';

const DEFAULT_SETTINGS: McpSettings = {
  tavily_warn_pct: DEFAULT_TAVILY_WARN_PCT,
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
  tavily_key_limit
`;

const LINK_SELECT = `
  id,
  name,
  url,
  sort_order,
  created_at,
  updated_at
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
        tavily_warn_pct,
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
  tavilyWarnPct: number;
}): Promise<{ data: McpSettings | null; error: string | null }> {
  return withSchema(async () => {
    const updatedAt = Date.now();
    const write = await execute(
      `UPDATE mcp_settings
       SET tavily_warn_pct = ?,
           updated_at = ?
       WHERE id = 1`,
      [input.tavilyWarnPct, updatedAt],
    );
    if (write.error) {
      return { data: null, error: write.error };
    }
    return getMcpSettings();
  });
}

export async function listMcpLinks(): Promise<{
  data: McpLink[] | null;
  error: string | null;
}> {
  return withSchema(() =>
    queryAll<McpLink>(
      `SELECT ${LINK_SELECT}
       FROM mcp_links
       ORDER BY sort_order ASC, id ASC`,
    ),
  );
}

export async function getMcpLink(id: number): Promise<{
  data: McpLink | null;
  error: string | null;
}> {
  return withSchema(() =>
    queryOne<McpLink>(
      `SELECT ${LINK_SELECT}
       FROM mcp_links
       WHERE id = ?`,
      [id],
    ),
  );
}

async function nextLinkSortOrder(): Promise<number> {
  const result = await queryOne<{ max_sort: number | null }>(
    'SELECT MAX(sort_order) AS max_sort FROM mcp_links',
  );
  return (result.data?.max_sort ?? -1) + 1;
}

export async function createMcpLink(input: {
  name: string;
  url: string;
  sortOrder?: number | null;
}): Promise<{ data: McpLink | null; error: string | null }> {
  return withSchema(async () => {
    const now = Date.now();
    const sortOrder = input.sortOrder ?? (await nextLinkSortOrder());
    const write = await execute(
      `INSERT INTO mcp_links (name, url, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [input.name, input.url, sortOrder, now, now],
    );
    if (write.error || !write.data) {
      return { data: null, error: write.error ?? 'Failed to create link.' };
    }
    return getMcpLink(Number(write.data.lastInsertRowid));
  });
}

export async function updateMcpLink(input: {
  id: number;
  name: string;
  url: string;
  sortOrder: number;
}): Promise<{ data: McpLink | null; error: string | null }> {
  return withSchema(async () => {
    const existing = await getMcpLink(input.id);
    if (existing.error) return existing;
    if (!existing.data) {
      return { data: null, error: 'Link not found.' };
    }

    const write = await execute(
      `UPDATE mcp_links
       SET name = ?,
           url = ?,
           sort_order = ?,
           updated_at = ?
       WHERE id = ?`,
      [input.name, input.url, input.sortOrder, Date.now(), input.id],
    );
    if (write.error) {
      return { data: null, error: write.error };
    }
    return getMcpLink(input.id);
  });
}

export async function deleteMcpLink(id: number): Promise<{
  data: { deleted: true } | null;
  error: string | null;
}> {
  return withSchema(async () => {
    const existing = await getMcpLink(id);
    if (existing.error) {
      return { data: null, error: existing.error };
    }
    if (!existing.data) {
      return { data: null, error: 'Link not found.' };
    }

    const write = await execute('DELETE FROM mcp_links WHERE id = ?', [id]);
    if (write.error) {
      return { data: null, error: write.error };
    }
    return { data: { deleted: true }, error: null };
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
  return nowMs - snapshot.fetched_at < ttlMs;
}

async function fetchAndStoreSnapshot(now: Date): Promise<{
  data: McpUsageSnapshot | null;
  error: string | null;
}> {
  const env = readMcpEnvConfig();
  const month = getUtcCalendarMonth(now);

  let tavilyOk = 0;
  let tavilyError: string | null = null;
  let tavily = null as Awaited<ReturnType<typeof fetchTavilyUsage>>['data'];

  if (env.tavilyApiKey) {
    const result = await fetchTavilyUsage(env.tavilyApiKey);
    if (result.error || !result.data) {
      tavilyError = result.error ?? 'Tavily usage fetch failed.';
    } else {
      tavily = result.data;
      tavilyOk = 1;
    }
  } else {
    tavilyError = 'TAVILY_API_KEY is not set.';
  }

  const fetchedAt = now.getTime();
  const insert = await execute(
    `INSERT INTO mcp_usage_snapshots (
       fetched_at, cycle_month,
       tavily_ok, tavily_error, tavily_plan, tavily_plan_usage, tavily_plan_limit,
       tavily_paygo_usage, tavily_paygo_limit, tavily_search_usage, tavily_extract_usage,
       tavily_crawl_usage, tavily_map_usage, tavily_research_usage, tavily_key_usage,
       tavily_key_limit
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export interface McpShellData {
  settings: McpSettings;
  links: McpLink[];
}

export async function getMcpShell(): Promise<{
  data: McpShellData | null;
  error: string | null;
}> {
  const [settingsResult, linksResult] = await Promise.all([
    getMcpSettings(),
    listMcpLinks(),
  ]);
  if (settingsResult.error || !settingsResult.data) {
    return { data: null, error: settingsResult.error ?? 'Failed to load SaaS settings.' };
  }
  if (linksResult.error) {
    return { data: null, error: linksResult.error };
  }
  return {
    data: {
      settings: settingsResult.data,
      links: linksResult.data ?? [],
    },
    error: null,
  };
}

export interface McpTavilyDashboardData {
  settings: McpSettings;
  snapshot: McpUsageSnapshot | null;
  skippedRefresh: boolean;
  tavily: TavilyPoolMetrics | null;
  tavilyConfigured: boolean;
  monthKey: string;
  monthLabel: string;
  elapsedRatio: number;
  daysUntilReset: number;
  lastFetchedAt: number | null;
  nextRefreshAt: number | null;
  history: McpDailySnapshotPoint[];
}

export async function getMcpTavilyDashboard(params?: {
  forceRefresh?: boolean;
  now?: Date;
}): Promise<{ data: McpTavilyDashboardData | null; error: string | null }> {
  const now = params?.now ?? new Date();
  const env = readMcpEnvConfig();
  const month = getUtcCalendarMonth(now);

  const [settingsResult, refreshed] = await Promise.all([
    getMcpSettings(),
    env.tavilyConfigured
      ? refreshMcpSnapshot({ force: params?.forceRefresh, now })
      : getLatestMcpSnapshot().then((result) => ({
        data: result.data ?? null,
        error: null,
        skipped: true,
      })),
  ]);

  if (settingsResult.error || !settingsResult.data) {
    return { data: null, error: settingsResult.error ?? 'Failed to load SaaS settings.' };
  }
  if (refreshed.error && !refreshed.data) {
    return { data: null, error: refreshed.error };
  }

  const settings = settingsResult.data;
  const snapshot = refreshed.data;
  const historyResult = await listMcpSnapshots({ cycleMonth: month.key });
  const history = lastSnapshotPerUtcDay(historyResult.data ?? []);

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
      tavilyConfigured: env.tavilyConfigured,
      monthKey: month.key,
      monthLabel: month.label,
      elapsedRatio: month.elapsedRatio,
      daysUntilReset: month.daysUntilReset,
      lastFetchedAt,
      nextRefreshAt,
      history,
    },
    error: null,
  };
}
