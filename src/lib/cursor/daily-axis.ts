import type { CursorDailyUsage } from '@/types/cursor';

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayStart(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function emptyDay(day: string): CursorDailyUsage {
  return {
    day,
    event_count: 0,
    tokens_input: 0,
    tokens_input_cache_write: 0,
    tokens_cache_read: 0,
    tokens_output: 0,
    tokens_total: 0,
    cloud_agent_count: 0,
    ide_count: 0,
  };
}

export function fillCursorDailyUsage(
  startMs: number,
  endMs: number,
  rows: readonly CursorDailyUsage[],
): CursorDailyUsage[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return [];
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const filled: CursorDailyUsage[] = [];
  const endDay = utcDayStart(endMs);
  for (let cursor = utcDayStart(startMs); cursor <= endDay; cursor += DAY_MS) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    filled.push(byDay.get(day) ?? emptyDay(day));
  }
  return filled;
}
