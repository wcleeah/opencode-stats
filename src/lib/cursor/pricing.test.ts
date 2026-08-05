import test from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateCursorCost,
  hasCursorPricing,
  aggregateCursorCost,
} from './pricing';

test('cursor pricing covers sample CSV models', () => {
  assert.equal(hasCursorPricing('cursor-grok-4.5-high-fast'), true);
  assert.equal(hasCursorPricing('cursor-grok-4.5-high'), true);
  assert.equal(hasCursorPricing('composer-2.5-fast'), true);
  assert.equal(hasCursorPricing('claude-4.5-sonnet'), true);
});

test('estimateCursorCost uses published grok fast rates', () => {
  const result = estimateCursorCost({
    reportedCost: null,
    modelId: 'cursor-grok-4.5-high-fast',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
  });

  assert.equal(result.knownPricing, true);
  assert.equal(result.estimated, true);
  assert.equal(result.cost, 4 + 18);
});

test('estimateCursorCost prefers numeric reported cost', () => {
  const result = estimateCursorCost({
    reportedCost: 1.5,
    modelId: 'cursor-grok-4.5-high-fast',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
  });
  assert.deepEqual(result, {
    cost: 1.5,
    estimated: false,
    knownPricing: true,
  });
});

test('aggregateCursorCost sums estimates', () => {
  const total = aggregateCursorCost([
    {
      reportedCost: null,
      modelId: 'composer-2.5',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
    },
    {
      reportedCost: null,
      modelId: 'unknown-model',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
    },
  ]);

  assert.equal(total.total, 0.5);
  assert.equal(total.unknownModels, 1);
  assert.equal(total.hasEstimated, true);
});
