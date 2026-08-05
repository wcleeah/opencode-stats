import test from 'node:test';
import assert from 'node:assert/strict';

import { computeCursorValueMetrics, formatMultiplier } from './value';

test('computeCursorValueMetrics compares actual pool to included floor', () => {
  const metrics = computeCursorValueMetrics({
    estimatedCost: 400,
    totalTokens: 100_000_000,
    planAmountUsd: 200,
    includedPoolUsd: 400,
    billingCycleStartDay: 1,
    now: new Date(2026, 7, 16, 0, 0, 0),
  });

  assert.equal(metrics.actualPoolUsd, 400);
  assert.equal(metrics.valueVsPlan, 2);
  assert.equal(metrics.actualVsIncluded, 1);
  assert.equal(metrics.exceededIncluded, false);
  assert.equal(metrics.dollarsPerMillionTokens, 2);
  assert.equal(metrics.estimatedCostPerMillionTokens, 4);
});

test('computeCursorValueMetrics marks exceeded included floor', () => {
  const metrics = computeCursorValueMetrics({
    estimatedCost: 1200,
    totalTokens: 10_000_000,
    planAmountUsd: 200,
    includedPoolUsd: 400,
    billingCycleStartDay: 1,
    now: new Date(2026, 7, 16, 0, 0, 0),
  });

  assert.equal(metrics.actualVsIncluded, 3);
  assert.equal(metrics.exceededIncluded, true);
});

test('formatMultiplier formats values', () => {
  assert.equal(formatMultiplier(2.45), '2.5×');
  assert.equal(formatMultiplier(0), '0.0×');
});
