export type StatsSource = 'opencode' | 'cursor' | 'saas';

export const STATS_SOURCE_COOKIE = 'stats_source';

export function parseStatsSource(value: string | undefined | null): StatsSource {
  if (value === 'cursor') return 'cursor';
  // `mcp` is the previous cookie value for this mode.
  if (value === 'saas' || value === 'mcp') return 'saas';
  return 'opencode';
}

export function sourceHome(source: StatsSource): string {
  if (source === 'cursor') return '/cursor';
  if (source === 'saas') return '/saas';
  return '/';
}

export function sourceBrandLabel(source: StatsSource): string {
  if (source === 'cursor') return 'Cursor Stats';
  if (source === 'saas') return 'SaaS Stats';
  return 'OpenCode Stats';
}
