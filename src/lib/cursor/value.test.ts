import test from 'node:test';
import assert from 'node:assert/strict';

import {
  billingCycleElapsedRatio,
  computeCursorValueMetrics,
  formatMultiplier,
} from './value';

test('billingCycleElapsedRatio respects cycle start day', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0); // Aug 15
  const ratio = billingCycleElapsedRatio(now, 1);
  assert.ok(ratio > 0.4 && ratio < 0.6);
});

test('computeCursorValueMetrics reports both value ratios', () => {
  const metrics = computeCursorValueMetrics({
    estimatedCost: 400,
    totalTokens: 100_000_000,
    planAmountUsd: 200,
    includedPoolUsd: 400,
    billingCycleStartDay: 1,
    now: new Date(2026, 7, 16, 0, 0, 0),
  });

  assert.equal(metrics.valueVsPlan, 2);
  assert.equal(metrics.valueVsPool, 1);
  assert.equal(metrics.dollarsPerMillionTokens, 2);
  assert.equal(metrics.estimatedCostPerMillionTokens, 4);
});

test('formatMultiplier formats values', () => {
  assert.equal(formatMultiplier(2.45), '2.5×');
  assert.equal(formatMultiplier(0), '0.0×');
});
