/**
 * Realized-value helpers for Cursor subscription vs estimated API usage.
 */

import { billingCycleElapsedRatio } from '@/lib/cursor/billing-cycle';

export interface CursorValueMetrics {
  /** Combined est. cost (Cursor Models + Other Models) */
  estimatedCost: number;
  /** Est. cost for Cursor Models pool (Grok / Composer / Auto) */
  cursorPoolUsd: number;
  /** Est. cost for Other Models pool (third-party) */
  otherPoolUsd: number;
  planAmountUsd: number;
  /** Configured Other Models included floor ("at least this amount") */
  includedPoolUsd: number;
  valueVsPlan: number;
  /** otherPool / includedPool (at-least floor for Other Models) */
  otherVsIncluded: number;
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
  cursorPoolUsd: number;
  otherPoolUsd: number;
  totalTokens: number;
  planAmountUsd: number;
  includedPoolUsd: number;
  billingCycleStartDay: number;
  now?: Date;
}): CursorValueMetrics {
  const now = params.now ?? new Date();
  const estimatedCost = params.cursorPoolUsd + params.otherPoolUsd;
  const cycleElapsedRatio = billingCycleElapsedRatio(
    now,
    params.billingCycleStartDay,
  );
  const expectedProRataCost = params.planAmountUsd * cycleElapsedRatio;
  const otherVsIncluded = safeRatio(
    params.otherPoolUsd,
    params.includedPoolUsd,
  );

  return {
    estimatedCost,
    cursorPoolUsd: params.cursorPoolUsd,
    otherPoolUsd: params.otherPoolUsd,
    planAmountUsd: params.planAmountUsd,
    includedPoolUsd: params.includedPoolUsd,
    valueVsPlan: safeRatio(estimatedCost, params.planAmountUsd),
    otherVsIncluded,
    exceededIncluded: params.otherPoolUsd > params.includedPoolUsd,
    dollarsPerMillionTokens: safeRatio(
      params.planAmountUsd * 1_000_000,
      params.totalTokens,
    ),
    estimatedCostPerMillionTokens: safeRatio(
      estimatedCost * 1_000_000,
      params.totalTokens,
    ),
    cycleElapsedRatio,
    expectedProRataCost,
    burnRatio: safeRatio(estimatedCost, expectedProRataCost),
  };
}

export function formatMultiplier(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0.0×';
  return `${value.toFixed(1)}×`;
}
