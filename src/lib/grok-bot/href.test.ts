import test from 'node:test';
import assert from 'node:assert/strict';

import {
  grokBotHref,
  grokBotRangeHref,
  parseGrokBotChartMode,
  parseGrokBotCompareStarts,
  parseGrokBotFocusStart,
  removeGrokBotCompareStart,
  toggleGrokBotUsageParam,
} from './href';
import { setGrokBotPeriodName } from './period-name';

const CATALOG = [
  'grok-bot-default',
  'grok-bot-automation',
  'grok-bot-cua',
  'grok-bot-knowledge-work',
];

function paramsOf(href: string): URLSearchParams {
  return new URL(href, 'http://localhost').searchParams;
}

test('grokBotHref never emits from or to and a cycle omits start and end', () => {
  const cycle = grokBotHref({
    periodNames: [],
    cycle: -1,
    startMs: 5,
    endMs: 9,
    usage: 'grok-bot-default',
    page: 1,
    mode: 'by-type',
  });
  const cycleParams = paramsOf(cycle);
  assert.equal(cycleParams.get('cycle'), '-1');
  assert.equal(cycleParams.has('start'), false);
  assert.equal(cycleParams.has('end'), false);
  assert.equal(cycleParams.has('from'), false);
  assert.equal(cycleParams.has('to'), false);
  assert.equal(cycleParams.get('usage'), 'grok-bot-default');
  assert.equal(cycleParams.has('page'), false);
  assert.equal(cycleParams.has('view'), false);
  assert.equal(cycleParams.has('cmp'), false);

  const range = grokBotHref({ periodNames: [], startMs: 5, endMs: 9, page: 2, mode: 'by-type' });
  const rangeParams = paramsOf(range);
  assert.equal(rangeParams.get('start'), '5');
  assert.equal(rangeParams.get('end'), '9');
  assert.equal(rangeParams.has('cycle'), false);
  assert.equal(rangeParams.get('page'), '2');
  assert.equal(rangeParams.has('from'), false);
  assert.equal(rangeParams.has('to'), false);
  assert.equal(rangeParams.has('view'), false);
  assert.equal(rangeParams.has('cmp'), false);

  assert.equal(grokBotHref({ mode: 'by-type', periodNames: [] }), '/cursor/grok');
  assert.equal(grokBotHref({ usage: '  ', page: 1, mode: 'by-type', periodNames: [] }), '/cursor/grok');
  assert.equal(grokBotHref({ startMs: 5, mode: 'by-type', periodNames: [] }), '/cursor/grok');
  assert.equal(cycle.includes('from='), false);
  assert.equal(cycle.includes('to='), false);
  assert.equal(range.includes('from='), false);
  assert.equal(range.includes('to='), false);
});

test('ins-outs sets view and every other value stays by-type', () => {
  const on = grokBotHref({
    periodNames: [],
    startMs: 5,
    endMs: 9,
    usage: 'grok-bot-default',
    page: 3,
    mode: 'ins-outs',
  });
  const params = paramsOf(on);
  assert.equal(params.get('view'), 'ins-outs');
  assert.equal(params.get('start'), '5');
  assert.equal(params.get('end'), '9');
  assert.equal(params.get('usage'), 'grok-bot-default');
  assert.equal(params.get('page'), '3');
  assert.equal(params.has('cycle'), false);

  assert.equal(parseGrokBotChartMode(undefined), 'by-type');
  assert.equal(parseGrokBotChartMode('by-type'), 'by-type');
  assert.equal(parseGrokBotChartMode('nope'), 'by-type');
  assert.equal(parseGrokBotChartMode('ins-outs'), 'ins-outs');
});

test('an absent or empty cmp still prints today\'s query string', () => {
  const today = grokBotHref({
    periodNames: [],
    cycle: -1,
    usage: 'grok-bot-default',
    page: 1,
    mode: 'by-type',
  });
  assert.equal(today, '/cursor/grok?cycle=-1&usage=grok-bot-default');
  assert.equal(paramsOf(today).has('cmp'), false);
  assert.equal(paramsOf(today).has('focus'), false);
  assert.equal(
    grokBotHref({
      periodNames: [],
      cycle: -1,
      usage: 'grok-bot-default',
      page: 1,
      mode: 'by-type',
      compareStarts: [],
    }),
    today,
  );
  assert.equal(grokBotHref({ mode: 'by-type', periodNames: [] }), '/cursor/grok');
});

test('cmp keeps start order and drops duplicates, the primary, and junk', () => {
  const primary = 1_700_000_000_000;
  const later = primary - 86_400_000;
  const earlier = primary - 8 * 86_400_000;
  const fourth = primary - 4 * 86_400_000;
  const parsed = parseGrokBotCompareStarts(
    `${later},nope,-1,${primary},${earlier},${later},0,${fourth}`,
    primary,
  );
  assert.deepEqual(parsed, [later, earlier, 0, fourth]);
  assert.deepEqual(parseGrokBotCompareStarts(parsed.join(','), primary), parsed);
  assert.deepEqual(parseGrokBotCompareStarts(String(primary), primary), []);
  assert.deepEqual(parseGrokBotCompareStarts('-1,-8', primary), []);
  assert.deepEqual(parseGrokBotCompareStarts(undefined, primary), []);

  const written = grokBotHref({
    periodNames: [],
    startMs: primary,
    endMs: primary + 86_400_000,
    usage: 'grok-bot-automation',
    mode: 'ins-outs',
    compareStarts: [earlier, later],
    focusStartMs: later,
  });
  assert.equal(
    written,
    `/cursor/grok?start=${primary}&end=${primary + 86_400_000}&usage=grok-bot-automation&view=ins-outs&focus=${later}&cmp=${earlier},${later}`,
  );
  assert.equal(paramsOf(written).get('cmp'), `${earlier},${later}`);
  assert.equal(paramsOf(written).get('focus'), String(later));
  assert.equal(
    grokBotHref({
      periodNames: [],
      mode: 'by-type',
      focusStartMs: primary,
      primaryStartMs: primary,
      compareStarts: [later],
    }),
    `/cursor/grok?cmp=${later}`,
  );
});

test('focus falls back unless it names a drawn period, and remove keeps order', () => {
  const primary = 1_700_000_000_000;
  const starts = parseGrokBotCompareStarts(`${primary - 2},${primary - 1},${primary - 3}`, primary);
  assert.equal(parseGrokBotFocusStart(undefined, [primary, ...starts]), primary);
  assert.equal(parseGrokBotFocusStart('nope', [primary, ...starts]), primary);
  assert.equal(parseGrokBotFocusStart(String(primary), [primary, ...starts]), primary);
  assert.equal(parseGrokBotFocusStart(String(starts[2]), [primary, ...starts]), starts[2]);
  assert.equal(parseGrokBotFocusStart(String(primary - 9), [primary, ...starts]), primary);

  const removed = removeGrokBotCompareStart(starts, starts[1]);
  assert.deepEqual(removed, [starts[0], starts[2]]);
  assert.deepEqual(removeGrokBotCompareStart(removed, primary - 9), removed);
});

test('names stays one parameter and cmp stays comma-separated integers', () => {
  const primary = 1_710_000_000_000;
  const earlier = 1_700_000_000_000;
  const later = 1_720_000_000_000;
  const text = 'Go, "live" & 東京';
  const edited = setGrokBotPeriodName([], primary, text);
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  const href = grokBotHref({
    startMs: primary,
    endMs: primary + 86_400_000,
    mode: 'by-type',
    compareStarts: [earlier, later],
    periodNames: edited.names,
  });
  const params = paramsOf(href);
  assert.equal(href.includes('names='), true);
  assert.equal(href.includes(`cmp=${earlier},${later}`), true);
  assert.deepEqual(params.get('cmp')?.split(','), [String(earlier), String(later)]);
  assert.deepEqual(JSON.parse(params.get('names') ?? 'null'), [[primary, text]]);

  const empty = grokBotHref({
    mode: 'by-type',
    compareStarts: [earlier],
    periodNames: [],
  });
  assert.equal(paramsOf(empty).has('names'), false);
  assert.equal(empty.includes('names='), false);
  assert.equal(paramsOf(empty).get('cmp'), String(earlier));
});

test('grokBotRangeHref writes the clipped window and moves the primary name', () => {
  const primary = 1_700_000_000_000;
  const compare = primary - 86_400_000;
  const nextStart = primary + 3_600_000;
  const nextEnd = nextStart + 86_400_000;
  const named = setGrokBotPeriodName([], primary, 'Launch');
  assert.equal(named.ok, true);
  if (!named.ok) return;
  const both = setGrokBotPeriodName(named.names, compare, 'Older');
  assert.equal(both.ok, true);
  if (!both.ok) return;

  const followed = grokBotRangeHref({
    cycle: -2,
    page: 3,
    startMs: primary,
    endMs: primary + 1_000,
    usage: 'grok-bot-default',
    mode: 'by-type',
    compareStarts: [compare],
    focusStartMs: primary,
    primaryStartMs: primary,
    periodNames: both.names,
  }, nextStart, nextEnd);
  const followedParams = paramsOf(followed);
  assert.equal(followedParams.get('start'), String(nextStart));
  assert.equal(followedParams.get('end'), String(nextEnd));
  assert.equal(followedParams.has('cycle'), false);
  assert.equal(followedParams.has('page'), false);
  assert.equal(followedParams.has('focus'), false);
  assert.equal(followedParams.get('usage'), 'grok-bot-default');
  assert.equal(followedParams.get('cmp'), String(compare));
  assert.deepEqual(JSON.parse(followedParams.get('names') ?? 'null'), [
    [compare, 'Older'],
    [nextStart, 'Launch'],
  ]);

  const kept = grokBotRangeHref({
    mode: 'ins-outs',
    compareStarts: [compare],
    focusStartMs: compare,
    primaryStartMs: primary,
    periodNames: both.names,
  }, nextStart, nextEnd);
  const keptParams = paramsOf(kept);
  assert.equal(keptParams.get('focus'), String(compare));
  assert.equal(keptParams.get('view'), 'ins-outs');
  assert.equal(keptParams.has('cycle'), false);
  assert.equal(keptParams.has('page'), false);

  const missing = grokBotRangeHref({
    mode: 'by-type',
    primaryStartMs: primary,
    periodNames: named.names,
  }, nextStart, nextEnd);
  assert.equal(paramsOf(missing).has('focus'), false);
  assert.deepEqual(JSON.parse(paramsOf(missing).get('names') ?? 'null'), [
    [nextStart, 'Launch'],
  ]);
});

test('toggleGrokBotUsageParam drops one id and returns all by clearing the last', () => {
  assert.equal(
    toggleGrokBotUsageParam(CATALOG, undefined, 'grok-bot-cua'),
    'grok-bot-default,grok-bot-automation,grok-bot-knowledge-work',
  );
  assert.equal(
    toggleGrokBotUsageParam(
      CATALOG,
      'grok-bot-default,grok-bot-automation,grok-bot-knowledge-work',
      'grok-bot-cua',
    ),
    undefined,
  );
  assert.equal(
    toggleGrokBotUsageParam(CATALOG, 'grok-bot-cua', 'grok-bot-cua'),
    undefined,
  );
});
