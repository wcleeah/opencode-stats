/**
 * Realized-value helpers for Cursor subscription vs estimated API usage.
 */

export interface CursorValueMetrics {
  estimatedCost: number;
  planAmountUsd: number;
  includedPoolUsd: number;
  valueVsPlan: number;
  valueVsPool: number;
  dollarsPerMillionTokens: number;
  estimatedCostPerMillionTokens: number;
  cycleElapsedRatio: number;
  expectedProRataCost: number;
  burnRatio: number;
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

/**
 * Compute fraction of the current billing cycle that has elapsed [0, 1].
 * `billingCycleStartDay` is 1–28 to avoid month-length edge cases.
 */
export function billingCycleElapsedRatio(
  now: Date,
  billingCycleStartDay: number,
): number {
  const startDay = Math.min(28, Math.max(1, Math.round(billingCycleStartDay)));
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  let cycleStart: Date;
  if (day >= startDay) {
    cycleStart = new Date(year, month, startDay, 0, 0, 0, 0);
  } else {
    cycleStart = new Date(year, month - 1, startDay, 0, 0, 0, 0);
  }

  const nextCycleStart = new Date(
    cycleStart.getFullYear(),
    cycleStart.getMonth() + 1,
    startDay,
    0,
    0,
    0,
    0,
  );

  const totalMs = nextCycleStart.getTime() - cycleStart.getTime();
  const elapsedMs = Math.min(
    Math.max(now.getTime() - cycleStart.getTime(), 0),
    totalMs,
  );
  return safeRatio(elapsedMs, totalMs);
}

export function computeCursorValueMetrics(params: {
  estimatedCost: number;
  totalTokens: number;
  planAmountUsd: number;
  includedPoolUsd: number;
  billingCycleStartDay: number;
  now?: Date;
}): CursorValueMetrics {
  const now = params.now ?? new Date();
  const cycleElapsedRatio = billingCycleElapsedRatio(
    now,
    params.billingCycleStartDay,
  );
  const expectedProRataCost = params.planAmountUsd * cycleElapsedRatio;

  return {
    estimatedCost: params.estimatedCost,
    planAmountUsd: params.planAmountUsd,
    includedPoolUsd: params.includedPoolUsd,
    valueVsPlan: safeRatio(params.estimatedCost, params.planAmountUsd),
    valueVsPool: safeRatio(params.estimatedCost, params.includedPoolUsd),
    dollarsPerMillionTokens: safeRatio(
      params.planAmountUsd * 1_000_000,
      params.totalTokens,
    ),
    estimatedCostPerMillionTokens: safeRatio(
      params.estimatedCost * 1_000_000,
      params.totalTokens,
    ),
    cycleElapsedRatio,
    expectedProRataCost,
    burnRatio: safeRatio(params.estimatedCost, expectedProRataCost),
  };
}

export function formatMultiplier(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0.0×';
  return `${value.toFixed(1)}×`;
}
