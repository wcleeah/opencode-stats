import test from 'node:test';
import assert from 'node:assert/strict';

import { grokBotHref, toggleGrokBotUsageParam } from './href';

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
  });
  const cycleParams = paramsOf(cycle);
  assert.equal(cycleParams.get('cycle'), '-1');
  assert.equal(cycleParams.has('start'), false);
  assert.equal(cycleParams.has('end'), false);
  assert.equal(cycleParams.has('from'), false);
  assert.equal(cycleParams.has('to'), false);
  assert.equal(cycleParams.get('usage'), 'grok-bot-default');
  assert.equal(cycleParams.has('page'), false);

  const range = grokBotHref({ startMs: 5, endMs: 9, page: 2 });
  const rangeParams = paramsOf(range);
  assert.equal(rangeParams.get('start'), '5');
  assert.equal(rangeParams.get('end'), '9');
  assert.equal(rangeParams.has('cycle'), false);
  assert.equal(rangeParams.get('page'), '2');
  assert.equal(rangeParams.has('from'), false);
  assert.equal(rangeParams.has('to'), false);

  assert.equal(grokBotHref({}), '/cursor/grok');
  assert.equal(grokBotHref({ usage: '  ', page: 1 }), '/cursor/grok');
  assert.equal(grokBotHref({ startMs: 5 }), '/cursor/grok');
  assert.equal(cycle.includes('from='), false);
  assert.equal(cycle.includes('to='), false);
  assert.equal(range.includes('from='), false);
  assert.equal(range.includes('to='), false);
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
