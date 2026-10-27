import assert from 'node:assert/strict';
import test from 'node:test';

import { fillCursorDailyUsage } from './daily-axis';
import type { CursorDailyUsage } from '@/types/cursor';

function row(day: string, tokens: number): CursorDailyUsage {
  return {
    day,
    event_count: tokens,
    tokens_input: 0,
    tokens_input_cache_write: 0,
    tokens_cache_read: 0,
    tokens_output: 0,
    tokens_total: tokens,
    cloud_agent_count: 0,
    ide_count: 0,
  };
}

test('cursor daily axis covers the selected cycle, including empty days', () => {
  const startMs = Date.parse('2026-10-01T08:00:00.000Z');
  const endMs = Date.parse('2026-11-01T08:00:00.000Z') - 1;
  const filled = fillCursorDailyUsage(startMs, endMs, [
    row('2026-10-10', 4),
    row('2026-10-06', 9),
    row('2026-09-30', 1),
  ]);

  assert.equal(filled[0]?.day, '2026-10-01');
  assert.equal(filled.at(-1)?.day, '2026-11-01');
  assert.equal(filled.length, 32);
  assert.equal(filled.find((entry) => entry.day === '2026-10-06')?.tokens_total, 9);
  assert.equal(filled.find((entry) => entry.day === '2026-10-01')?.event_count, 0);
  assert.equal(filled.some((entry) => entry.day === '2026-09-30'), false);
  assert.deepEqual(
    filled.slice(5, 7).map((entry) => entry.day),
    ['2026-10-06', '2026-10-07'],
  );
});
