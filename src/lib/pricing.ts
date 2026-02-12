/**
 * Model pricing data and cost estimation utilities.
 *
 * When the provider is github-copilot, cost is always reported as 0.
 * This module estimates costs from token counts using known model pricing.
 *
 * Prices are per-token in USD. Source: https://docs.anthropic.com/en/docs/about-claude/models
 * and https://openai.com/api/pricing/ (as of 2025).
 */

interface ModelPricing {
  /** Price per input token (non-cached) */
  input: number;
  /** Price per output token */
  output: number;
  /** Price per cached-read input token */
  cacheRead: number;
  /** Price per cache-write token */
  cacheWrite: number;
}

/**
 * Known model pricing. Keys are model_id values from the database.
 * Partial matches are tried if an exact match is not found.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 4 Opus
  'claude-opus-4-20250514': {
    input: 15 / 1_000_000,
    output: 75 / 1_000_000,
    cacheRead: 1.5 / 1_000_000,
    cacheWrite: 18.75 / 1_000_000,
  },
  // Claude 4 Sonnet
  'claude-sonnet-4-20250514': {
    input: 3 / 1_000_000,
    output: 15 / 1_000_000,
    cacheRead: 0.3 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
  },
  // Claude 3.5 Sonnet
  'claude-3-5-sonnet-20241022': {
    input: 3 / 1_000_000,
    output: 15 / 1_000_000,
    cacheRead: 0.3 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
  },
  'claude-3-5-sonnet-latest': {
    input: 3 / 1_000_000,
    output: 15 / 1_000_000,
    cacheRead: 0.3 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
  },
  // Claude 3.5 Haiku
  'claude-3-5-haiku-20241022': {
    input: 0.8 / 1_000_000,
    output: 4 / 1_000_000,
    cacheRead: 0.08 / 1_000_000,
    cacheWrite: 1 / 1_000_000,
  },
  'claude-3-5-haiku-latest': {
    input: 0.8 / 1_000_000,
    output: 4 / 1_000_000,
    cacheRead: 0.08 / 1_000_000,
    cacheWrite: 1 / 1_000_000,
  },
  // Claude 3 Opus
  'claude-3-opus-20240229': {
    input: 15 / 1_000_000,
    output: 75 / 1_000_000,
    cacheRead: 1.5 / 1_000_000,
    cacheWrite: 18.75 / 1_000_000,
  },
  // Claude 3 Haiku
  'claude-3-haiku-20240307': {
    input: 0.25 / 1_000_000,
    output: 1.25 / 1_000_000,
    cacheRead: 0.03 / 1_000_000,
    cacheWrite: 0.3 / 1_000_000,
  },
  // GPT-4o
  'gpt-4o': {
    input: 2.5 / 1_000_000,
    output: 10 / 1_000_000,
    cacheRead: 1.25 / 1_000_000,
    cacheWrite: 2.5 / 1_000_000,
  },
  'gpt-4o-2024-11-20': {
    input: 2.5 / 1_000_000,
    output: 10 / 1_000_000,
    cacheRead: 1.25 / 1_000_000,
    cacheWrite: 2.5 / 1_000_000,
  },
  // GPT-4o mini
  'gpt-4o-mini': {
    input: 0.15 / 1_000_000,
    output: 0.6 / 1_000_000,
    cacheRead: 0.075 / 1_000_000,
    cacheWrite: 0.15 / 1_000_000,
  },
  // GPT-4.1
  'gpt-4.1': {
    input: 2 / 1_000_000,
    output: 8 / 1_000_000,
    cacheRead: 0.5 / 1_000_000,
    cacheWrite: 2 / 1_000_000,
  },
  // GPT-4.1 mini
  'gpt-4.1-mini': {
    input: 0.4 / 1_000_000,
    output: 1.6 / 1_000_000,
    cacheRead: 0.1 / 1_000_000,
    cacheWrite: 0.4 / 1_000_000,
  },
  // GPT-4.1 nano
  'gpt-4.1-nano': {
    input: 0.1 / 1_000_000,
    output: 0.4 / 1_000_000,
    cacheRead: 0.025 / 1_000_000,
    cacheWrite: 0.1 / 1_000_000,
  },
  // o1
  'o1': {
    input: 15 / 1_000_000,
    output: 60 / 1_000_000,
    cacheRead: 7.5 / 1_000_000,
    cacheWrite: 15 / 1_000_000,
  },
  // o1-mini
  'o1-mini': {
    input: 1.1 / 1_000_000,
    output: 4.4 / 1_000_000,
    cacheRead: 0.55 / 1_000_000,
    cacheWrite: 1.1 / 1_000_000,
  },
  // o3
  'o3': {
    input: 2 / 1_000_000,
    output: 8 / 1_000_000,
    cacheRead: 0.5 / 1_000_000,
    cacheWrite: 2 / 1_000_000,
  },
  // o3-mini
  'o3-mini': {
    input: 1.1 / 1_000_000,
    output: 4.4 / 1_000_000,
    cacheRead: 0.55 / 1_000_000,
    cacheWrite: 1.1 / 1_000_000,
  },
  // o4-mini
  'o4-mini': {
    input: 1.1 / 1_000_000,
    output: 4.4 / 1_000_000,
    cacheRead: 0.275 / 1_000_000,
    cacheWrite: 1.1 / 1_000_000,
  },
  // Gemini 2.5 Pro
  'gemini-2.5-pro': {
    input: 1.25 / 1_000_000,
    output: 10 / 1_000_000,
    cacheRead: 0.315 / 1_000_000,
    cacheWrite: 1.25 / 1_000_000,
  },
  // Gemini 2.5 Flash
  'gemini-2.5-flash': {
    input: 0.15 / 1_000_000,
    output: 0.6 / 1_000_000,
    cacheRead: 0.0375 / 1_000_000,
    cacheWrite: 0.15 / 1_000_000,
  },
};

/**
 * Partial match patterns: if the model_id contains one of these substrings,
 * use the corresponding pricing. Checked in order, first match wins.
 */
const PARTIAL_MATCHES: Array<[string, string]> = [
  ['claude-opus-4', 'claude-opus-4-20250514'],
  ['claude-sonnet-4', 'claude-sonnet-4-20250514'],
  ['claude-3-5-sonnet', 'claude-3-5-sonnet-20241022'],
  ['claude-3-5-haiku', 'claude-3-5-haiku-20241022'],
  ['claude-3-opus', 'claude-3-opus-20240229'],
  ['claude-3-haiku', 'claude-3-haiku-20240307'],
  ['gpt-4o-mini', 'gpt-4o-mini'],
  ['gpt-4o', 'gpt-4o'],
  ['gpt-4.1-nano', 'gpt-4.1-nano'],
  ['gpt-4.1-mini', 'gpt-4.1-mini'],
  ['gpt-4.1', 'gpt-4.1'],
  ['o4-mini', 'o4-mini'],
  ['o3-mini', 'o3-mini'],
  ['o3', 'o3'],
  ['o1-mini', 'o1-mini'],
  ['o1', 'o1'],
  ['gemini-2.5-pro', 'gemini-2.5-pro'],
  ['gemini-2.5-flash', 'gemini-2.5-flash'],
];

function findPricing(modelId: string): ModelPricing | null {
  // Exact match first
  if (MODEL_PRICING[modelId]) {
    return MODEL_PRICING[modelId];
  }

  // Partial match
  const lower = modelId.toLowerCase();
  for (const [pattern, key] of PARTIAL_MATCHES) {
    if (lower.includes(pattern)) {
      return MODEL_PRICING[key] ?? null;
    }
  }

  return null;
}

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

  const pricing = findPricing(params.modelId);
  if (!pricing) {
    return { cost: 0, estimated: true };
  }

  // Non-cached input tokens = total input minus cache read
  const freshInput = Math.max(0, params.tokensIn - params.tokensCacheRead);

  const cost =
    freshInput * pricing.input +
    params.tokensCacheRead * pricing.cacheRead +
    params.tokensCacheWrite * pricing.cacheWrite +
    params.tokensOut * pricing.output;

  return { cost, estimated: true };
}

/**
 * Check if we have pricing data for a given model.
 */
export function hasPricing(modelId: string): boolean {
  return findPricing(modelId) !== null;
}
