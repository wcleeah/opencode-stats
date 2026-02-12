/**
 * Model pricing data and cost estimation utilities.
 *
 * Prices are OpenCode Zen pricing (per token, USD).
 * Source: https://opencode.ai/docs/zen/
 *
 * Notes:
 * - Free-tier models are excluded (gpt-5-nano, big-pickle, etc.)
 * - Cache read uses the same per-token rate as regular input
 * - Some models have higher rates above 200K context; we use the base tier
 */

interface ModelPricing {
  /** Price per input token */
  input: number;
  /** Price per output token */
  output: number;
  /** Price per cache-write token (0 if not applicable) */
  cacheWrite: number;
}

/**
 * Known model pricing. Keys are model_id values as stored in the database.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-5.1-codex-mini': {
    input: 0.25 / 1_000_000,
    output: 2.00 / 1_000_000,
    cacheWrite: 0,
  },
  'minimax-m2.1': {
    input: 0.30 / 1_000_000,
    output: 1.20 / 1_000_000,
    cacheWrite: 0,
  },
  'minimax-m2.1-free': {
    input: 0.30 / 1_000_000,
    output: 1.20 / 1_000_000,
    cacheWrite: 0,
  },
  'kimi-k2-thinking': {
    input: 0.40 / 1_000_000,
    output: 2.50 / 1_000_000,
    cacheWrite: 0,
  },
  'kimi-k2': {
    input: 0.40 / 1_000_000,
    output: 2.50 / 1_000_000,
    cacheWrite: 0,
  },
  'qwen3-coder': {
    input: 0.45 / 1_000_000,
    output: 1.50 / 1_000_000,
    cacheWrite: 0,
  },
  'gemini-3-flash': {
    input: 0.50 / 1_000_000,
    output: 3.00 / 1_000_000,
    cacheWrite: 0,
  },
  'glm-4.6': {
    input: 0.60 / 1_000_000,
    output: 2.20 / 1_000_000,
    cacheWrite: 0,
  },
  'glm-4.7': {
    input: 0.60 / 1_000_000,
    output: 2.20 / 1_000_000,
    cacheWrite: 0,
  },
  'glm-4.7-free': {
    input: 0.60 / 1_000_000,
    output: 2.20 / 1_000_000,
    cacheWrite: 0,
  },
  'kimi-k2.5': {
    input: 0.60 / 1_000_000,
    output: 3.00 / 1_000_000,
    cacheWrite: 0,
  },
  'kimi-k2.5-free': {
    input: 0.60 / 1_000_000,
    output: 3.00 / 1_000_000,
    cacheWrite: 0,
  },
  'claude-3-5-haiku': {
    input: 0.80 / 1_000_000,
    output: 4.00 / 1_000_000,
    cacheWrite: 1.00 / 1_000_000,
  },
  'claude-haiku-4-5': {
    input: 1.00 / 1_000_000,
    output: 5.00 / 1_000_000,
    cacheWrite: 1.25 / 1_000_000,
  },
  'gpt-5': {
    input: 1.07 / 1_000_000,
    output: 8.50 / 1_000_000,
    cacheWrite: 0,
  },
  'gpt-5-codex': {
    input: 1.07 / 1_000_000,
    output: 8.50 / 1_000_000,
    cacheWrite: 0,
  },
  'gpt-5.1': {
    input: 1.07 / 1_000_000,
    output: 8.50 / 1_000_000,
    cacheWrite: 0,
  },
  'gpt-5.1-codex': {
    input: 1.07 / 1_000_000,
    output: 8.50 / 1_000_000,
    cacheWrite: 0,
  },
  'gpt-5.1-codex-max': {
    input: 1.25 / 1_000_000,
    output: 10.00 / 1_000_000,
    cacheWrite: 0,
  },
  'gpt-5.2': {
    input: 1.75 / 1_000_000,
    output: 14.00 / 1_000_000,
    cacheWrite: 0,
  },
  'gpt-5.2-codex': {
    input: 1.75 / 1_000_000,
    output: 14.00 / 1_000_000,
    cacheWrite: 0,
  },
  'gemini-3-pro': {
    input: 2.00 / 1_000_000,
    output: 12.00 / 1_000_000,
    cacheWrite: 0,
  },
  'grok-code': {
    input: 0.20 / 1_000_000,
    output: 1.50 / 1_000_000,
    cacheWrite: 0,
  },
  'claude-sonnet-4.5': {
    input: 3.00 / 1_000_000,
    output: 15.00 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
  },
  'claude-sonnet-4': {
    input: 3.00 / 1_000_000,
    output: 15.00 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
  },
  'claude-opus-4.5': {
    input: 5.00 / 1_000_000,
    output: 25.00 / 1_000_000,
    cacheWrite: 6.25 / 1_000_000,
  },
  'claude-opus-4.6': {
    input: 5.00 / 1_000_000,
    output: 25.00 / 1_000_000,
    cacheWrite: 6.25 / 1_000_000,
  },
  'claude-opus-4-1': {
    input: 15.00 / 1_000_000,
    output: 75.00 / 1_000_000,
    cacheWrite: 18.75 / 1_000_000,
  },
};

export interface CostEstimate {
  /** Estimated cost in USD */
  cost: number;
  /** Whether this is an estimate (true) or reported by the provider (false) */
  estimated: boolean;
}

/**
 * Estimate or return the cost for a response.
 *
 * If the provider already reported a non-zero cost, returns that.
 * Otherwise, estimates from token counts using known model pricing.
 * Cache reads use the same rate as regular input.
 */
export function estimateCost(params: {
  reportedCost: number;
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
}): CostEstimate {
  // If provider reported a real cost, use it
  if (params.reportedCost > 0) {
    return { cost: params.reportedCost, estimated: false };
  }

  const pricing = MODEL_PRICING[params.modelId];
  if (!pricing) {
    return { cost: 0, estimated: true };
  }

  const cost =
    params.tokensIn * pricing.input +
    params.tokensCacheWrite * pricing.cacheWrite +
    params.tokensOut * pricing.output;

  return { cost, estimated: true };
}

/**
 * Check if we have pricing data for a given model.
 */
export function hasPricing(modelId: string): boolean {
  return modelId in MODEL_PRICING;
}
