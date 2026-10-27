import test from 'node:test';
import assert from 'node:assert/strict';

import {
  moveGrokBotPeriodName,
  parseGrokBotPeriodNames,
  serializeGrokBotPeriodNames,
  setGrokBotPeriodName,
  type GrokBotPeriodNames,
} from './period-name';

const EARLY = 1_700_000_000_000;
const LATE = 1_710_000_000_000;
const SPECIAL = 'Go, "live" & 東京';

function kept(
  names: GrokBotPeriodNames,
): ReadonlyArray<{ readonly startMs: number; readonly name: string }> {
  return names.map((item) => ({ startMs: item.startMs, name: item.name }));
}

function succeed(
  names: GrokBotPeriodNames,
  startMs: number,
  raw: string,
): GrokBotPeriodNames {
  const edited = setGrokBotPeriodName(names, startMs, raw);
  assert.equal(edited.ok, true);
  if (!edited.ok) throw new Error('expected the name edit to succeed');
  return edited.names;
}

test('a name with comma, quote, ampersand, space, and non-ASCII round-trips', () => {
  const names = succeed(succeed([], LATE, SPECIAL), EARLY, 'Baseline');
  const serialized = serializeGrokBotPeriodNames(names);
  assert.equal(typeof serialized, 'string');
  const parsed = parseGrokBotPeriodNames(serialized, [LATE, EARLY, EARLY - 86_400_000]);
  assert.deepEqual(kept(parsed), [
    { startMs: EARLY, name: 'Baseline' },
    { startMs: LATE, name: SPECIAL },
  ]);
  assert.equal(parsed[1]?.name, SPECIAL);
});

test('bad JSON, an invisible start, and a duplicate start parse to the kept names', () => {
  const visible = [LATE];
  assert.deepEqual(parseGrokBotPeriodNames('{', visible), []);
  assert.deepEqual(parseGrokBotPeriodNames('{"start":1}', visible), []);
  assert.deepEqual(parseGrokBotPeriodNames(undefined, visible), []);

  const raw = JSON.stringify([
    [EARLY, 'Hidden'],
    [-1, 'Negative'],
    [LATE, '   '],
    [LATE, 'a'.repeat(65)],
    [LATE, 'bad\nname'],
    [LATE, 'First'],
    [LATE, 'Second'],
    [LATE, 12],
  ]);
  const parsed = parseGrokBotPeriodNames(raw, visible);
  assert.deepEqual(kept(parsed), [{ startMs: LATE, name: 'First' }]);
});

test('set clears a blank name, keeps an identical set, and rejects length and controls', () => {
  const named = succeed(succeed([], EARLY, 'Baseline'), LATE, '  Launch  ');
  assert.deepEqual(kept(named), [
    { startMs: EARLY, name: 'Baseline' },
    { startMs: LATE, name: 'Launch' },
  ]);

  const again = setGrokBotPeriodName(named, LATE, 'Launch');
  assert.equal(again.ok, true);
  if (again.ok) assert.deepEqual(again.names, named);

  const cleared = setGrokBotPeriodName(named, LATE, '');
  assert.deepEqual(cleared, {
    ok: true,
    names: [{ startMs: EARLY, name: 'Baseline' }],
  });

  assert.deepEqual(
    setGrokBotPeriodName(named, LATE, 'a'.repeat(65)),
    { ok: false, reason: 'too-long' },
  );
  assert.deepEqual(
    setGrokBotPeriodName(named, LATE, 'line\nbreak'),
    { ok: false, reason: 'unsupported' },
  );
  assert.deepEqual(
    setGrokBotPeriodName([], LATE, `ok${String.fromCharCode(0x7f)}`),
    { ok: false, reason: 'unsupported' },
  );
  assert.equal(succeed([], LATE, 'a'.repeat(64)).length, 1);
});

test('move leaves a nameless source in place and keeps that source on an occupied start', () => {
  const onlyDestination = succeed([], LATE, 'Kept');
  assert.equal(moveGrokBotPeriodName(onlyDestination, EARLY, LATE), onlyDestination);
  assert.equal(moveGrokBotPeriodName(onlyDestination, LATE, LATE), onlyDestination);

  const both = succeed(succeed([], EARLY, 'Source'), LATE, 'Destination');
  const moved = moveGrokBotPeriodName(both, EARLY, LATE);
  assert.deepEqual(kept(moved), [{ startMs: LATE, name: 'Source' }]);
  assert.equal(moveGrokBotPeriodName(moved, EARLY, LATE), moved);
});
