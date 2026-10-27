import test from 'node:test';
import assert from 'node:assert/strict';

import { createClient } from '@libsql/client';

import {
  DEFAULT_GROK_BOT_CYCLE,
  formatGrokBotWallDate,
  formatGrokBotWallTime,
  grokBotBucketMs,
  grokBotBucketStartSql,
  grokBotCycleBounds,
  grokBotWallTimeFromUtcMs,
  grokBotWallTimeToUtcMs,
  parseGrokBotCycleClock,
  clipGrokBotWindow,
  focusedBucketWallMs,
  formatGrokBotWallInput,
  grokBotBucketTickLabel,
  grokBotCycleLinkLabels,
  grokBotDayTickIndexes,
  grokBotDraftHint,
  parseGrokBotWallInput,
  parseGrokDraftRange,
  projectGrokBotPeriods,
  resolveGrokBotWindow,
} from './cycle';
import { parseGrokBotCompareStarts } from './href';

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

test('wall date is the clockless portion of wall time', () => {
  const wall = grokBotWallTimeFromUtcMs(DEFAULT_START, 'Asia/Hong_Kong');
  assert.equal(formatGrokBotWallDate(wall), 'Wed 14 Oct 2026');
  assert.equal(formatGrokBotWallTime(wall), 'Wed 14 Oct 2026 11:30');
});

test('a compared window copies the primary span and bucket width', () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;
  const clock = {
    weekday: 'wednesday' as const,
    hour: 11,
    minute: 30,
    timeZone: 'Asia/Hong_Kong' as const,
  };
  const now = new Date(DEFAULT_START);
  const cyclePrimary = resolveGrokBotWindow({ clock, now, cycle: '0' });
  const older = DEFAULT_START - 8 * weekMs;
  const newer = PREVIOUS_START;
  const starts = parseGrokBotCompareStarts(
    `${older},${cyclePrimary.window.startMs},${newer}`,
    cyclePrimary.window.startMs,
  );
  assert.deepEqual(starts, [older, newer]);
  const cycleProjected = projectGrokBotPeriods({
    clock,
    primary: cyclePrimary,
    compareStarts: starts,
  });
  const span = cyclePrimary.window.endMs - cyclePrimary.window.startMs;
  assert.equal(cycleProjected[0].role, 'primary');
  assert.equal(cycleProjected[0].window, cyclePrimary.window);
  assert.equal(cycleProjected[0].label, 'Wed 14 Oct 2026 11:30 to Wed 21 Oct 2026 11:29');
  assert.equal(cycleProjected[0].shortLabel, 'Wed 14 Oct 2026');
  assert.equal(cycleProjected[1].role, 'compare');
  assert.equal(cycleProjected[1].window.startMs, older);
  assert.equal(cycleProjected[1].window.endMs, older + span);
  assert.equal(cycleProjected[1].window.bucketMs, 60 * 60 * 1000);
  assert.equal(cycleProjected[1].shortLabel, 'Wed 19 Aug 2026');
  assert.equal(cycleProjected[2].window.startMs, newer);
  assert.equal(cycleProjected[2].window.endMs, newer + span);
  assert.equal(cycleProjected[2].window.bucketMs, cyclePrimary.window.bucketMs);
  assert.equal(cycleProjected[2].shortLabel, 'Wed 7 Oct 2026');
  assert.equal(
    cycleProjected[2].label,
    'Wed 7 Oct 2026 11:30 to Wed 14 Oct 2026 11:29',
  );

  const brushedStart = DEFAULT_START + 6 * dayMs;
  const brushed = resolveGrokBotWindow({
    clock,
    now,
    start: String(brushedStart),
    end: String(brushedStart + 8 * dayMs),
  });
  const compareStart = PREVIOUS_START + 6 * dayMs;
  const compared = projectGrokBotPeriods({
    clock,
    primary: brushed,
    compareStarts: parseGrokBotCompareStarts(String(compareStart), brushed.window.startMs),
  });
  const brushedSpan = brushed.window.endMs - brushed.window.startMs;
  assert.equal(brushedSpan, weekMs - 1);
  assert.equal(compared[0].window, brushed.window);
  assert.equal(compared[0].label, 'Tue 20 Oct 2026 11:30 to Tue 27 Oct 2026 11:29');
  assert.equal(compared[0].shortLabel, 'Tue 20 Oct 2026');
  assert.notEqual(compared[0].label, brushed.cycle.label);
  assert.equal(compared[1].role, 'compare');
  assert.equal(compared[1].window.startMs, compareStart);
  assert.equal(compared[1].window.endMs, compareStart + brushedSpan);
  assert.equal(compared[1].window.bucketMs, brushed.window.bucketMs);
  assert.equal(compared[1].window.bucketMs, 60 * 60 * 1000);
  assert.equal(compared[1].shortLabel, 'Tue 13 Oct 2026');
  assert.equal(compared[1].label, 'Tue 13 Oct 2026 11:30 to Tue 20 Oct 2026 11:29');
});

test('a solo week axis names the selected calendar day and minute', () => {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const currentStart = Date.parse('2026-10-21T03:30:00.000Z');
  const previousStart = Date.parse('2026-10-14T03:30:00.000Z');
  assert.equal(
    grokBotBucketTickLabel(currentStart, weekMs, 'Asia/Hong_Kong'),
    'Wed 21 11:30',
  );
  assert.equal(
    grokBotBucketTickLabel(previousStart, weekMs, 'Asia/Hong_Kong'),
    'Wed 14 11:30',
  );
  assert.equal(
    grokBotBucketTickLabel(currentStart, 30 * 60 * 1000, 'Asia/Hong_Kong'),
    '11:30',
  );
  assert.equal(
    grokBotBucketTickLabel(currentStart, 24 * 60 * 60 * 1000, 'Asia/Hong_Kong'),
    '21 11:30',
  );
  const hourMs = 60 * 60 * 1000;
  assert.equal(
    grokBotBucketTickLabel(currentStart + 167 * hourMs, weekMs, 'Asia/Hong_Kong'),
    'Wed 28 10:30',
  );
  assert.deepEqual(grokBotDayTickIndexes(168, hourMs, weekMs), [
    0, 24, 48, 72, 96, 120, 144, 167,
  ]);
  assert.equal(grokBotDayTickIndexes(96, 15 * 60 * 1000, 24 * 60 * 60 * 1000), null);
});

test('clip swaps a reversed pair and keeps the span between one minute and seven days', () => {
  const week = 7 * 24 * 60 * 60 * 1000;
  assert.deepEqual(clipGrokBotWindow(200_000, 10), { startMs: 10, endMs: 200_000 });
  assert.deepEqual(clipGrokBotWindow(100, 100 + week + 5), {
    startMs: 100,
    endMs: 100 + week - 1,
  });
  assert.deepEqual(clipGrokBotWindow(100, 100 + week - 1), {
    startMs: 100,
    endMs: 100 + week - 1,
  });
  assert.deepEqual(clipGrokBotWindow(100, 100 + 1_000), {
    startMs: 100,
    endMs: 100 + 60_000 - 1,
  });
  assert.deepEqual(clipGrokBotWindow(100, 100 + 60_000 - 1), {
    startMs: 100,
    endMs: 100 + 60_000 - 1,
  });
});

test('wall input is a Hong Kong minute and the draft end includes that minute', () => {
  assert.equal(formatGrokBotWallInput(DEFAULT_START), '2026-10-14T11:30');
  assert.equal(formatGrokBotWallInput(DEFAULT_START + 60_000 - 1), '2026-10-14T11:30');
  assert.deepEqual(parseGrokBotWallInput('2026-10-14T11:30'), {
    year: 2026,
    month: 10,
    day: 14,
    hour: 11,
    minute: 30,
  });
  assert.equal(parseGrokBotWallInput('2026-10-14 11:30'), null);
  assert.equal(parseGrokBotWallInput('2026-13-14T11:30'), null);

  const sameMinute = parseGrokDraftRange('2026-10-14T11:30', '2026-10-14T11:30');
  assert.equal(sameMinute.ok, true);
  if (!sameMinute.ok) return;
  assert.deepEqual(sameMinute.reasons, []);
  assert.equal(sameMinute.startMs, DEFAULT_START);
  assert.equal(sameMinute.endMs, DEFAULT_START + 60_000 - 1);
  assert.equal(grokBotDraftHint(sameMinute), null);

  const hourLater = Date.parse('2026-10-14T04:30:00.000Z');
  const hour = parseGrokDraftRange('2026-10-14T11:30', '2026-10-14T12:30');
  assert.equal(hour.ok, true);
  if (!hour.ok) return;
  assert.deepEqual(hour.reasons, []);
  assert.equal(hour.startMs, DEFAULT_START);
  assert.equal(hour.endMs, hourLater + 60_000 - 1);

  const reversed = parseGrokDraftRange('2026-10-14T15:00', '2026-10-14T11:30');
  assert.equal(reversed.ok, true);
  if (!reversed.ok) return;
  assert.deepEqual(reversed.reasons, ['swapped']);
  assert.equal(reversed.startMs, DEFAULT_START + 60_000 - 1);
  assert.equal(reversed.endMs, Date.parse('2026-10-14T07:00:00.000Z'));
  assert.equal(grokBotDraftHint(reversed), 'Apply swaps the two times.');

  const week = 7 * 24 * 60 * 60 * 1000;
  const tooLong = parseGrokDraftRange('2026-10-14T11:30', '2026-10-22T11:30');
  assert.equal(tooLong.ok, true);
  if (!tooLong.ok) return;
  assert.deepEqual(tooLong.reasons, ['max-span']);
  assert.equal(tooLong.startMs, DEFAULT_START);
  assert.equal(tooLong.endMs, DEFAULT_START + week - 1);
  assert.equal(grokBotDraftHint(tooLong), 'Apply keeps the first 7 days.');

  const tooShort = parseGrokDraftRange('2026-10-14T11:31', '2026-10-14T11:30');
  assert.equal(tooShort.ok, true);
  if (!tooShort.ok) return;
  const swappedStart = DEFAULT_START + 60_000 - 1;
  assert.deepEqual(tooShort.reasons, ['swapped', 'min-span']);
  assert.equal(tooShort.startMs, swappedStart);
  assert.equal(tooShort.endMs, swappedStart + 60_000 - 1);
  assert.equal(
    grokBotDraftHint(tooShort),
    'Apply swaps the two times. Apply keeps at least one minute.',
  );

  assert.deepEqual(parseGrokDraftRange('', '2026-10-14T11:30'), {
    ok: false,
    reason: 'incomplete',
  });
  assert.deepEqual(parseGrokDraftRange('2026-10-14T11:30', ''), {
    ok: false,
    reason: 'incomplete',
  });
  assert.deepEqual(parseGrokDraftRange('yesterday', '2026-10-14T11:30'), {
    ok: false,
    reason: 'invalid',
  });
  assert.equal(grokBotDraftHint({ ok: false, reason: 'invalid' }), null);
});

test('cycle link labels keep This cycle on offset 0', () => {
  const now = new Date(DEFAULT_START);
  const labels = grokBotCycleLinkLabels(DEFAULT_GROK_BOT_CYCLE, now, -3);
  assert.equal(labels.current, 'Wed 14 Oct 2026 11:30 to Wed 21 Oct 2026 11:29');
  assert.equal(
    labels.previous,
    grokBotCycleBounds(DEFAULT_GROK_BOT_CYCLE, now, -4).label,
  );
  assert.equal(
    labels.next,
    grokBotCycleBounds(DEFAULT_GROK_BOT_CYCLE, now, -2).label,
  );
  assert.notEqual(labels.current, grokBotCycleBounds(DEFAULT_GROK_BOT_CYCLE, now, -3).label);
});

test('focused bucket wall time shifts by the focus start', () => {
  assert.equal(focusedBucketWallMs(500, 100, 100), 500);
  assert.equal(focusedBucketWallMs(500, 100, 1_000), 1_400);
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
