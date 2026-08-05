import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBillingCycleBounds,
  matchBillingCycleOffset,
  billingCycleElapsedRatio,
  resolveSelectedCycle,
} from './billing-cycle';

test('getBillingCycleBounds returns current month window for day-1 cycles', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0); // Aug 15
  const cycle = getBillingCycleBounds(1, now, 0);
  assert.equal(cycle.from, '2026-08-01');
  assert.equal(cycle.to, '2026-08-31');
});

test('getBillingCycleBounds previous/next offsets shift by one month', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0);
  const prev = getBillingCycleBounds(1, now, -1);
  const next = getBillingCycleBounds(1, now, 1);
  assert.equal(prev.from, '2026-07-01');
  assert.equal(prev.to, '2026-07-31');
  assert.equal(next.from, '2026-09-01');
  assert.equal(next.to, '2026-09-30');
});

test('getBillingCycleBounds respects mid-month start day', () => {
  const now = new Date(2026, 7, 20, 12, 0, 0); // Aug 20
  const cycle = getBillingCycleBounds(15, now, 0);
  assert.equal(cycle.from, '2026-08-15');
  assert.equal(cycle.to, '2026-09-14');
});

test('matchBillingCycleOffset detects exact cycle ranges', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0);
  assert.equal(matchBillingCycleOffset(1, '2026-08-01', '2026-08-31', now), 0);
  assert.equal(matchBillingCycleOffset(1, '2026-07-01', '2026-07-31', now), -1);
  assert.equal(matchBillingCycleOffset(1, '2026-08-01', '2026-08-10', now), null);
});

test('billingCycleElapsedRatio is between 0 and 1 mid-cycle', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0);
  const ratio = billingCycleElapsedRatio(now, 1);
  assert.ok(ratio > 0.4 && ratio < 0.6);
});

test('resolveSelectedCycle prefers exact from/to cycle match', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0);
  const cycle = resolveSelectedCycle(1, '2026-07-01', '2026-07-31', now);
  assert.equal(cycle.from, '2026-07-01');
  assert.equal(cycle.to, '2026-07-31');
});

test('resolveSelectedCycle falls back to cycle containing from', () => {
  const now = new Date(2026, 7, 15, 12, 0, 0);
  const cycle = resolveSelectedCycle(1, '2026-06-10', '2026-06-20', now);
  assert.equal(cycle.from, '2026-06-01');
  assert.equal(cycle.to, '2026-06-30');
});
