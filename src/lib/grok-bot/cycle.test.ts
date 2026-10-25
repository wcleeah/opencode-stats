import test from 'node:test';
import assert from 'node:assert/strict';

import { createClient } from '@libsql/client';

import {
  DEFAULT_GROK_BOT_CYCLE,
  grokBotBucketMs,
  grokBotBucketStartSql,
  grokBotCycleBounds,
  grokBotWallTimeFromUtcMs,
  grokBotWallTimeToUtcMs,
  parseGrokBotCycleClock,
  resolveGrokBotWindow,
} from './cycle';

const DEFAULT_START = Date.parse('2026-10-14T03:30:00.000Z');
const PREVIOUS_START = Date.parse('2026-10-07T03:30:00.000Z');
const NEXT_START = Date.parse('2026-10-21T03:30:00.000Z');

test('default clock parses wednesday 11:30 and rejects substitutes', () => {
  assert.deepEqual(
    parseGrokBotCycleClock({ weekday: 'Wednesday', hour: 11, minute: 30 }),
    DEFAULT_GROK_BOT_CYCLE,
  );
  assert.equal(parseGrokBotCycleClock({ weekday: 'funday', hour: 11, minute: 30 }), null);
  assert.equal(parseGrokBotCycleClock({ weekday: 3, hour: 11, minute: 30 }), null);
  assert.equal(parseGrokBotCycleClock({ weekday: 'wednesday', hour: 24, minute: 0 }), null);
  assert.equal(parseGrokBotCycleClock({ weekday: 'wednesday', hour: 11, minute: 60 }), null);
});

test('default cycle starts at 2026-10-14 03:30 UTC', () => {
  const clock = DEFAULT_GROK_BOT_CYCLE;
  const start = grokBotCycleBounds(clock, new Date(DEFAULT_START), 0);
  assert.equal(start.startMs, DEFAULT_START);
  assert.equal(start.endMs, NEXT_START - 1);
  assert.equal(start.label, 'Wed 14 Oct 2026 11:30 to Wed 21 Oct 2026 11:29');

  const earlier = grokBotCycleBounds(clock, new Date(DEFAULT_START - 1), 0);
  assert.equal(earlier.startMs, PREVIOUS_START);

  const next = grokBotCycleBounds(clock, new Date(DEFAULT_START), 1);
  assert.equal(next.startMs, NEXT_START);

  const wall = grokBotWallTimeFromUtcMs(DEFAULT_START, 'Asia/Hong_Kong');
  assert.equal(wall.year, 2026);
  assert.equal(wall.month, 10);
  assert.equal(wall.day, 14);
  assert.equal(wall.hour, 11);
  assert.equal(wall.minute, 30);
  assert.equal(wall.weekday, 'wednesday');
  assert.equal(
    grokBotWallTimeToUtcMs(
      { year: 2026, month: 10, day: 14, hour: 11, minute: 30 },
      'Asia/Hong_Kong',
    ),
    DEFAULT_START,
  );
});

test('thursday 09:15 clock starts at thursday 01:15 UTC', () => {
  const clock = parseGrokBotCycleClock({ weekday: 'Thursday', hour: 9, minute: 15 });
  assert.ok(clock);
  const thursday = Date.parse('2026-10-15T01:15:00.000Z');
  const start = grokBotCycleBounds(clock, new Date(thursday), 0);
  assert.equal(start.startMs, thursday);
  const earlier = grokBotCycleBounds(clock, new Date(thursday - 1), 0);
  assert.equal(earlier.startMs, Date.parse('2026-10-08T01:15:00.000Z'));
});

test('resolveGrokBotWindow prefers cycle, clamps span, and swaps reversed ends', () => {
  const now = new Date(DEFAULT_START);
  const clock = DEFAULT_GROK_BOT_CYCLE;
  const cycle = resolveGrokBotWindow({
    clock,
    now,
    cycle: '0',
    start: '1',
    end: '2',
  });
  assert.deepEqual(cycle.mode, { kind: 'cycle', offset: 0 });
  assert.equal(cycle.window.startMs, DEFAULT_START);
  assert.equal(cycle.window.endMs, NEXT_START - 1);
  assert.equal(cycle.cycle.offset, 0);
  assert.equal(cycle.cycle.startMs, cycle.window.startMs);

  const longStart = Date.parse('2026-10-01T00:00:00.000Z');
  const week = 7 * 24 * 60 * 60 * 1000;
  const clamped = resolveGrokBotWindow({
    clock,
    now,
    start: String(longStart),
    end: String(longStart + 8 * 24 * 60 * 60 * 1000),
  });
  assert.deepEqual(clamped.mode, {
    kind: 'range',
    startMs: longStart,
    endMs: longStart + week - 1,
  });
  assert.equal(clamped.window.endMs, longStart + week - 1);

  const shortStart = 1_000_000;
  const grown = resolveGrokBotWindow({
    clock,
    now,
    start: String(shortStart + 10_000),
    end: String(shortStart),
  });
  assert.equal(grown.window.startMs, shortStart);
  assert.equal(grown.window.endMs, shortStart + 60_000 - 1);

  const fallback = resolveGrokBotWindow({ clock, now, start: 'nope' });
  assert.deepEqual(fallback.mode, { kind: 'cycle', offset: 0 });
  assert.equal(fallback.window.startMs, DEFAULT_START);
});

test('bucket width steps from one minute to one hour', () => {
  assert.equal(grokBotBucketMs(6 * 60 * 60 * 1000), 60_000);
  assert.equal(grokBotBucketMs(6 * 60 * 60 * 1000 + 1), 15 * 60 * 1000);
  assert.equal(grokBotBucketMs(48 * 60 * 60 * 1000), 15 * 60 * 1000);
  assert.equal(grokBotBucketMs(48 * 60 * 60 * 1000 + 1), 60 * 60 * 1000);
  const week = 7 * 24 * 60 * 60 * 1000;
  assert.equal(grokBotBucketMs(week), 60 * 60 * 1000);
});

test('sqlite groups an event into the window bucket', async () => {
  const windowStartMs = 1_700_000_000_000;
  const bucketMs = 60_000;
  const eventAt = windowStartMs + 90_000;
  const expected = windowStartMs + 60_000;

  const client = createClient({ url: 'file::memory:' });
  await client.execute('CREATE TABLE events (event_at INTEGER NOT NULL)');
  await client.execute({
    sql: 'INSERT INTO events (event_at) VALUES (?)',
    args: [eventAt],
  });
  const result = await client.execute({
    sql: `SELECT ${grokBotBucketStartSql('event_at')} AS bucket FROM events`,
    args: [windowStartMs, windowStartMs, bucketMs, bucketMs],
  });
  assert.equal(Number(result.rows[0].bucket), expected);
});
