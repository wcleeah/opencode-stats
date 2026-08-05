/**
 * Cursor published model pricing (USD per token).
 * Source: https://cursor.com/docs/models-and-pricing
 *
 * Cache-write is billed at the input rate when Cursor docs omit a dedicated rate.
 */

export interface CursorModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PER_M = 1_000_000;

function rate(
  inputPerM: number,
  outputPerM: number,
  cacheReadPerM: number,
  cacheWritePerM: number = inputPerM,
): CursorModelPricing {
  return {
    input: inputPerM / PER_M,
    output: outputPerM / PER_M,
    cacheRead: cacheReadPerM / PER_M,
    cacheWrite: cacheWritePerM / PER_M,
  };
}

/**
 * Keys match CSV `Model` values and common aliases.
 */
const CURSOR_MODEL_PRICING: Record<string, CursorModelPricing> = {
  // Cursor first-party — Grok 4.5
  'cursor-grok-4.5': rate(2, 6, 0.5),
  'cursor-grok-4.5-low': rate(2, 6, 0.5),
  'cursor-grok-4.5-medium': rate(2, 6, 0.5),
  'cursor-grok-4.5-high': rate(2, 6, 0.5),
  'cursor-grok-4.5-fast': rate(4, 18, 1),
  'cursor-grok-4.5-low-fast': rate(4, 18, 1),
  'cursor-grok-4.5-medium-fast': rate(4, 18, 1),
  'cursor-grok-4.5-high-fast': rate(4, 18, 1),

  // Cursor first-party — Composer 2.5
  'composer-2.5': rate(0.5, 2.5, 0.2),
  'composer-2.5-fast': rate(3, 15, 0.3),

  // Auto Cost (flat rates)
  auto: rate(1.25, 6, 0.25, 1.25),
  'auto-cost': rate(1.25, 6, 0.25, 1.25),

  // Common third-party aliases seen in Cursor CSV exports
  'claude-4.5-sonnet': rate(3, 15, 0.3, 3.75),
  'claude-4.5-haiku': rate(1, 5, 0.1, 1.25),
  'claude-4.5-opus': rate(5, 25, 0.5, 6.25),
  'claude-4.6-sonnet': rate(3, 15, 0.3, 3.75),
  'claude-4.6-opus': rate(5, 25, 0.5, 6.25),
  'claude-sonnet-4.5': rate(3, 15, 0.3, 3.75),
  'claude-opus-4.5': rate(5, 25, 0.5, 6.25),
  'gpt-5.2': rate(1.75, 14, 0.175),
  'gpt-5.3-codex': rate(1.75, 14, 0.175),
  'gpt-5.4': rate(2.5, 15, 0.25),
  'gemini-3-pro': rate(2, 12, 0.2),
  'gemini-3.5-flash': rate(1.5, 9, 0.15),
};

export interface CursorCostEstimate {
  cost: number;
  estimated: boolean;
  knownPricing: boolean;
}

export function normalizeCursorModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

export function getCursorPricing(modelId: string): CursorModelPricing | null {
  return CURSOR_MODEL_PRICING[normalizeCursorModelId(modelId)] ?? null;
}

export function hasCursorPricing(modelId: string): boolean {
  return getCursorPricing(modelId) !== null;
}

/**
 * Estimate API-equivalent cost for a Cursor usage event.
 * Numeric `reportedCost` (when present) is preferred over token estimates.
 */
export function estimateCursorCost(params: {
  reportedCost: number | null;
  modelId: string;
  tokensInput: number;
  tokensInputCacheWrite: number;
  tokensCacheRead: number;
  tokensOutput: number;
}): CursorCostEstimate {
  if (params.reportedCost !== null && params.reportedCost > 0) {
    return { cost: params.reportedCost, estimated: false, knownPricing: true };
  }

  const pricing = getCursorPricing(params.modelId);
  if (!pricing) {
    return { cost: 0, estimated: true, knownPricing: false };
  }

  const cost =
    params.tokensInput * pricing.input +
    params.tokensInputCacheWrite * pricing.cacheWrite +
    params.tokensCacheRead * pricing.cacheRead +
    params.tokensOutput * pricing.output;

  return { cost, estimated: true, knownPricing: true };
}

export function aggregateCursorCost(
  rows: Array<{
    reportedCost: number | null;
    modelId: string;
    tokensInput: number;
    tokensInputCacheWrite: number;
    tokensCacheRead: number;
    tokensOutput: number;
  }>,
): { total: number; hasEstimated: boolean; unknownModels: number } {
  let total = 0;
  let hasEstimated = false;
  let unknownModels = 0;

  for (const row of rows) {
    const est = estimateCursorCost(row);
    total += est.cost;
    if (est.estimated) hasEstimated = true;
    if (!est.knownPricing) unknownModels += 1;
  }

  return { total, hasEstimated, unknownModels };
}
