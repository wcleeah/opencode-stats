import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBillingCycleBounds,
  matchBillingCycleOffset,
  billingCycleElapsedRatio,
  resolveSelectedCycle,
  cycleCutoffUtcMs,
  getHktParts,
  BILLING_CYCLE_CUTOFF_HOUR,
} from './billing-cycle';

test('cycleCutoffUtcMs is 16:00 HKT (08:00 UTC)', () => {
  const ms = cycleCutoffUtcMs(2026, 8, 1);
  assert.equal(ms, Date.UTC(2026, 7, 1, 8, 0, 0, 0));
  const parts = getHktParts(new Date(ms));
  assert.equal(parts.hour, BILLING_CYCLE_CUTOFF_HOUR);
  assert.equal(parts.day, 1);
  assert.equal(parts.month, 8);
});

test('getBillingCycleBounds uses HKT 16:00 window for day-1 cycles', () => {
  // Aug 15 12:00 HKT = Aug 15 04:00 UTC
  const now = new Date(Date.UTC(2026, 7, 15, 4, 0, 0));
  const cycle = getBillingCycleBounds(1, now, 0);
  assert.equal(cycle.from, '2026-08-01');
  assert.equal(cycle.to, '2026-09-01');
  assert.equal(cycle.startMs, cycleCutoffUtcMs(2026, 8, 1));
  assert.equal(cycle.endMs, cycleCutoffUtcMs(2026, 9, 1) - 1);
});

test('getBillingCycleBounds stays on previous cycle before 16:00 HKT on start day', () => {
  // Aug 1 15:00 HKT = Aug 1 07:00 UTC → still July cycle
  const before = new Date(Date.UTC(2026, 7, 1, 7, 0, 0));
  const cycle = getBillingCycleBounds(1, before, 0);
  assert.equal(cycle.from, '2026-07-01');
  assert.equal(cycle.to, '2026-08-01');

  // Aug 1 16:00 HKT = Aug 1 08:00 UTC → August cycle
  const atCutoff = new Date(Date.UTC(2026, 7, 1, 8, 0, 0));
  const next = getBillingCycleBounds(1, atCutoff, 0);
  assert.equal(next.from, '2026-08-01');
  assert.equal(next.to, '2026-09-01');
});

test('getBillingCycleBounds previous/next offsets shift by one month', () => {
  const now = new Date(Date.UTC(2026, 7, 15, 4, 0, 0));
  const prev = getBillingCycleBounds(1, now, -1);
  const next = getBillingCycleBounds(1, now, 1);
  assert.equal(prev.from, '2026-07-01');
  assert.equal(prev.to, '2026-08-01');
  assert.equal(next.from, '2026-09-01');
  assert.equal(next.to, '2026-10-01');
});

test('getBillingCycleBounds respects mid-month start day', () => {
  const now = new Date(Date.UTC(2026, 7, 20, 4, 0, 0)); // Aug 20 12:00 HKT
  const cycle = getBillingCycleBounds(15, now, 0);
  assert.equal(cycle.from, '2026-08-15');
  assert.equal(cycle.to, '2026-09-15');
  assert.equal(cycle.startMs, cycleCutoffUtcMs(2026, 8, 15));
  assert.equal(cycle.endMs, cycleCutoffUtcMs(2026, 9, 15) - 1);
});

test('matchBillingCycleOffset detects exact cycle ranges', () => {
  const now = new Date(Date.UTC(2026, 7, 15, 4, 0, 0));
  assert.equal(matchBillingCycleOffset(1, '2026-08-01', '2026-09-01', now), 0);
  assert.equal(matchBillingCycleOffset(1, '2026-07-01', '2026-08-01', now), -1);
  assert.equal(matchBillingCycleOffset(1, '2026-08-01', '2026-08-10', now), null);
});

test('billingCycleElapsedRatio is between 0 and 1 mid-cycle', () => {
  const now = new Date(Date.UTC(2026, 7, 15, 4, 0, 0));
  const ratio = billingCycleElapsedRatio(now, 1);
  assert.ok(ratio > 0.4 && ratio < 0.6);
});

test('resolveSelectedCycle prefers exact from/to cycle match', () => {
  const now = new Date(Date.UTC(2026, 7, 15, 4, 0, 0));
  const cycle = resolveSelectedCycle(1, '2026-07-01', '2026-08-01', now);
  assert.equal(cycle.from, '2026-07-01');
  assert.equal(cycle.to, '2026-08-01');
  assert.equal(cycle.startMs, cycleCutoffUtcMs(2026, 7, 1));
});

test('resolveSelectedCycle falls back to cycle containing from', () => {
  const now = new Date(Date.UTC(2026, 7, 15, 4, 0, 0));
  const cycle = resolveSelectedCycle(1, '2026-06-10', '2026-06-20', now);
  assert.equal(cycle.from, '2026-06-01');
  assert.equal(cycle.to, '2026-07-01');
});
