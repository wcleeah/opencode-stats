import { utcDayKey } from '@/lib/mcp/calendar';
import type { McpDailySnapshotPoint, McpUsageSnapshot } from '@/types/mcp';

/** Last snapshot of each UTC day, for sparse poll history charts. */
export function lastSnapshotPerUtcDay(
  snapshots: McpUsageSnapshot[],
): McpDailySnapshotPoint[] {
  const last = new Map<string, McpUsageSnapshot>();
  for (const snapshot of snapshots) {
    last.set(utcDayKey(snapshot.fetched_at), snapshot);
  }
  return [...last.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, snapshot]) => ({
      day,
      tavily_plan_usage: snapshot.tavily_plan_usage,
      exa_total_cost_usd: snapshot.exa_total_cost_usd,
    }));
}
