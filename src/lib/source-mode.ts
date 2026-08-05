export type StatsSource = 'opencode' | 'cursor';

export const STATS_SOURCE_COOKIE = 'stats_source';

export function parseStatsSource(value: string | undefined | null): StatsSource {
  return value === 'cursor' ? 'cursor' : 'opencode';
}
