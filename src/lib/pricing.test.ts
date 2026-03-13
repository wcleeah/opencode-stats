import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregateCostBreakdown, estimateCost } from './pricing';

test('pricing keeps reported cost when provider supplies it', () => {
  assert.deepEqual(
    estimateCost({
      reportedCost: 1.25,
      modelId: 'gpt-5.2',
      tokensIn: 0,
      tokensOut: 0,
      tokensCacheRead: 0,
      tokensCacheWrite: 0,
    }),
    { cost: 1.25, estimated: false },
  );
});

test('pricing estimates cost for known models', () => {
  const result = estimateCost({
    reportedCost: 0,
    modelId: 'claude-sonnet-4.5',
    tokensIn: 1000,
    tokensOut: 500,
    tokensCacheRead: 100,
    tokensCacheWrite: 50,
  });

  assert.equal(result.estimated, true);
  assert.ok(result.cost > 0);
});

test('pricing aggregates reported and estimated totals', () => {
  const total = aggregateCostBreakdown([
    {
      reportedCost: 2,
      modelId: 'gpt-5.2',
      tokensIn: 0,
      tokensOut: 0,
      tokensCacheRead: 0,
      tokensCacheWrite: 0,
    },
    {
      reportedCost: 0,
      modelId: 'claude-sonnet-4.5',
      tokensIn: 1000,
      tokensOut: 500,
      tokensCacheRead: 100,
      tokensCacheWrite: 50,
    },
  ]);

  assert.equal(total.reported, 2);
  assert.ok(total.estimated > 0);
  assert.ok(total.total > 2);
  assert.equal(total.hasEstimated, true);
});
