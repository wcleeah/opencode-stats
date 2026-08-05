/**
 * Realized-value helpers for Cursor subscription vs estimated API usage.
 */

import { billingCycleElapsedRatio } from '@/lib/cursor/billing-cycle';

export interface CursorValueMetrics {
  estimatedCost: number;
  /** Alias for estimatedCost — actual API-equivalent pool used */
  actualPoolUsd: number;
  planAmountUsd: number;
  /** Configured floor ("at least this amount") */
  includedPoolUsd: number;
  valueVsPlan: number;
  /** actualPool / includedPool (at-least floor) */
  actualVsIncluded: number;
  exceededIncluded: boolean;
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
  const actualVsIncluded = safeRatio(
    params.estimatedCost,
    params.includedPoolUsd,
  );

  return {
    estimatedCost: params.estimatedCost,
    actualPoolUsd: params.estimatedCost,
    planAmountUsd: params.planAmountUsd,
    includedPoolUsd: params.includedPoolUsd,
    valueVsPlan: safeRatio(params.estimatedCost, params.planAmountUsd),
    actualVsIncluded,
    exceededIncluded: params.estimatedCost > params.includedPoolUsd,
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
