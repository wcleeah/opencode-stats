export type StatsSource = 'cursor' | 'saas';

export const STATS_SOURCE_COOKIE = 'stats_source';

export function parseStatsSource(value: string | undefined | null): StatsSource {
  if (value === 'cursor') return 'cursor';
  // `mcp` and `opencode` are previous cookie values for other modes.
  return 'saas';
}

export function sourceHome(source: StatsSource): string {
  return source === 'cursor' ? '/cursor' : '/saas';
}

export function sourceBrandLabel(source: StatsSource): string {
  return source === 'cursor' ? 'Cursor Stats' : 'SaaS Stats';
}
