import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addGrokBotCompareDelta,
  grokBotHref,
  parseGrokBotChartMode,
  parseGrokBotCompareDeltas,
  removeGrokBotCompareDelta,
  toggleGrokBotUsageParam,
  type GrokBotNegativeCycleDelta,
} from './href';

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

  const range = grokBotHref({ startMs: 5, endMs: 9, page: 2, mode: 'by-type' });
  const rangeParams = paramsOf(range);
  assert.equal(rangeParams.get('start'), '5');
  assert.equal(rangeParams.get('end'), '9');
  assert.equal(rangeParams.has('cycle'), false);
  assert.equal(rangeParams.get('page'), '2');
  assert.equal(rangeParams.has('from'), false);
  assert.equal(rangeParams.has('to'), false);
  assert.equal(rangeParams.has('view'), false);
  assert.equal(rangeParams.has('cmp'), false);

  assert.equal(grokBotHref({ mode: 'by-type' }), '/cursor/grok');
  assert.equal(grokBotHref({ usage: '  ', page: 1, mode: 'by-type' }), '/cursor/grok');
  assert.equal(grokBotHref({ startMs: 5, mode: 'by-type' }), '/cursor/grok');
  assert.equal(cycle.includes('from='), false);
  assert.equal(cycle.includes('to='), false);
  assert.equal(range.includes('from='), false);
  assert.equal(range.includes('to='), false);
});

test('ins-outs sets view and every other value stays by-type', () => {
  const on = grokBotHref({
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

function delta(value: number): GrokBotNegativeCycleDelta {
  return value as GrokBotNegativeCycleDelta;
}

test('an absent or empty cmp still prints today\'s query string', () => {
  const today = grokBotHref({
    cycle: -1,
    usage: 'grok-bot-default',
    page: 1,
    mode: 'by-type',
  });
  assert.equal(today, '/cursor/grok?cycle=-1&usage=grok-bot-default');
  assert.equal(paramsOf(today).has('cmp'), false);
  assert.equal(
    grokBotHref({
      cycle: -1,
      usage: 'grok-bot-default',
      page: 1,
      mode: 'by-type',
      compareDeltas: [],
    }),
    today,
  );
  assert.equal(grokBotHref({ mode: 'by-type' }), '/cursor/grok');
});

test('cmp keeps the given order and drops junk down to the three nearest weeks', () => {
  const parsed = parseGrokBotCompareDeltas('-8,-1,0,nope,-3,-2,-1,53,-53,-52');
  assert.deepEqual(parsed, [-1, -2, -3]);
  assert.deepEqual(parseGrokBotCompareDeltas(parsed.join(',')), parsed);
  assert.deepEqual(parseGrokBotCompareDeltas('-52'), [-52]);
  assert.deepEqual(parseGrokBotCompareDeltas('-53'), []);
  assert.deepEqual(parseGrokBotCompareDeltas('1'), []);
  assert.deepEqual(parseGrokBotCompareDeltas('0'), []);
  assert.deepEqual(parseGrokBotCompareDeltas(undefined), []);

  const written = grokBotHref({
    startMs: 1_700_000_000_000,
    endMs: 1_700_086_400_000,
    usage: 'grok-bot-automation',
    mode: 'ins-outs',
    compareDeltas: [delta(-8), delta(-1)],
  });
  assert.equal(
    written,
    '/cursor/grok?start=1700000000000&end=1700086400000&usage=grok-bot-automation&view=ins-outs&cmp=-8,-1',
  );
  assert.equal(paramsOf(written).get('cmp'), '-8,-1');
});

test('add fills the nearest hole and remove keeps the remaining order', () => {
  assert.deepEqual(addGrokBotCompareDelta([]), [-1]);
  assert.deepEqual(addGrokBotCompareDelta(parseGrokBotCompareDeltas('-8')), [-1, -8]);
  const gapped = parseGrokBotCompareDeltas('-1,-3');
  const filled = addGrokBotCompareDelta(gapped);
  assert.deepEqual(filled, [-1, -2, -3]);
  assert.deepEqual(addGrokBotCompareDelta(gapped), filled);
  assert.equal(addGrokBotCompareDelta(parseGrokBotCompareDeltas('-1,-2,-3')), undefined);

  const three = parseGrokBotCompareDeltas('-1,-3,-8');
  const removed = removeGrokBotCompareDelta(three, three[1]);
  assert.deepEqual(removed, [-1, -8]);
  const absent = parseGrokBotCompareDeltas('-2')[0];
  assert.ok(absent);
  assert.deepEqual(removeGrokBotCompareDelta(removed, absent), [-1, -8]);
  const unsorted = [delta(-8), delta(-1), delta(-3)];
  assert.deepEqual(removeGrokBotCompareDelta(unsorted, unsorted[0]), [delta(-1), delta(-3)]);
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
