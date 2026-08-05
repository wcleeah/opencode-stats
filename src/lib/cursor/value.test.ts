import test from 'node:test';
import assert from 'node:assert/strict';

import { computeCursorValueMetrics, formatMultiplier } from './value';

test('computeCursorValueMetrics splits cursor vs other pools', () => {
  const metrics = computeCursorValueMetrics({
    cursorPoolUsd: 800,
    otherPoolUsd: 400,
    totalTokens: 100_000_000,
    planAmountUsd: 200,
    includedPoolUsd: 400,
    billingCycleStartDay: 1,
    now: new Date(2026, 7, 16, 0, 0, 0),
  });

  assert.equal(metrics.estimatedCost, 1200);
  assert.equal(metrics.cursorPoolUsd, 800);
  assert.equal(metrics.otherPoolUsd, 400);
  assert.equal(metrics.valueVsPlan, 6);
  assert.equal(metrics.otherVsIncluded, 1);
  assert.equal(metrics.exceededIncluded, false);
});

test('included floor compares against Other Models pool only', () => {
  const metrics = computeCursorValueMetrics({
    cursorPoolUsd: 5000,
    otherPoolUsd: 100,
    totalTokens: 10_000_000,
    planAmountUsd: 200,
    includedPoolUsd: 400,
    billingCycleStartDay: 1,
    now: new Date(2026, 7, 16, 0, 0, 0),
  });

  assert.equal(metrics.exceededIncluded, false);
  assert.equal(metrics.otherVsIncluded, 0.25);
});

test('computeCursorValueMetrics marks exceeded other-models floor', () => {
  const metrics = computeCursorValueMetrics({
    cursorPoolUsd: 10,
    otherPoolUsd: 1200,
    totalTokens: 10_000_000,
    planAmountUsd: 200,
    includedPoolUsd: 400,
    billingCycleStartDay: 1,
    now: new Date(2026, 7, 16, 0, 0, 0),
  });

  assert.equal(metrics.otherVsIncluded, 3);
  assert.equal(metrics.exceededIncluded, true);
});

test('formatMultiplier formats values', () => {
  assert.equal(formatMultiplier(2.45), '2.5×');
  assert.equal(formatMultiplier(0), '0.0×');
});
