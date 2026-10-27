import type { CursorDailyUsage } from '@/types/cursor';

export function fillCursorDailyUsage(
  _startMs: number,
  _endMs: number,
  rows: readonly CursorDailyUsage[],
): CursorDailyUsage[] {
  return [...rows];
}
