export type StatsSource = 'opencode' | 'cursor' | 'mcp';

export const STATS_SOURCE_COOKIE = 'stats_source';

export function parseStatsSource(value: string | undefined | null): StatsSource {
  if (value === 'cursor' || value === 'mcp') return value;
  return 'opencode';
}

export function sourceHome(source: StatsSource): string {
  if (source === 'cursor') return '/cursor';
  if (source === 'mcp') return '/mcp';
  return '/';
}

export function sourceBrandLabel(source: StatsSource): string {
  if (source === 'cursor') return 'Cursor Stats';
  if (source === 'mcp') return 'MCP Credits';
  return 'OpenCode Stats';
}
