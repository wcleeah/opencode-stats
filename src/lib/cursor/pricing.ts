/**
 * Cursor published model pricing (USD per token).
 *
 * Sources (synced Aug 2026):
 * - https://cursor.com/docs/models-and-pricing
 * - https://cursor.com/docs/account/teams/pricing
 * - https://cursor.com/docs/models/grok-4-5
 * - https://cursor.com/docs/models/grok-4-6
 * - https://cursor.com/docs/models/cursor-composer-2-5
 *
 * When docs omit cache-write (`-`), cache-write is billed at the input rate.
 * Effort / thinking suffixes in CSV model IDs resolve to the base model rate.
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
 * Base published rates keyed by normalized model family id.
 * CSV effort variants (e.g. `gpt-5.6-sol-medium`) resolve via {@link resolvePricingKey}.
 */
const CURSOR_MODEL_PRICING: Record<string, CursorModelPricing> = {
  // —— Cursor first-party ——
  auto: rate(1.25, 6, 0.25, 1.25),
  'auto-cost': rate(1.25, 6, 0.25, 1.25),
  'composer-1': rate(1.25, 10, 0.125),
  'composer-2.5': rate(0.5, 2.5, 0.2),
  'composer-2.5-fast': rate(3, 15, 0.5),
  // Grok 4.5 / 4.6 standard + fast (list rates; 4.6 launch discount not applied)
  'cursor-grok-4.5': rate(2, 6, 0.5),
  'cursor-grok-4.5-fast': rate(4, 12, 1),
  'grok-4.5': rate(2, 6, 0.5),
  'grok-4.5-fast': rate(4, 12, 1),
  'cursor-grok-4.6': rate(2, 6, 0.5),
  'cursor-grok-4.6-fast': rate(4, 12, 1),
  'grok-4.6': rate(2, 6, 0.5),
  'grok-4.6-fast': rate(4, 12, 1),

  // —— Anthropic ——
  'claude-4-sonnet': rate(3, 15, 0.3, 3.75),
  'claude-4-sonnet-1m': rate(6, 22.5, 0.6, 7.5),
  'claude-4.5-haiku': rate(1, 5, 0.1, 1.25),
  'claude-4.5-opus': rate(5, 25, 0.5, 6.25),
  'claude-4.5-sonnet': rate(3, 15, 0.3, 3.75),
  'claude-4.6-opus': rate(5, 25, 0.5, 6.25),
  'claude-4.6-sonnet': rate(3, 15, 0.3, 3.75),
  'claude-4.7-opus': rate(5, 25, 0.5, 6.25),
  'claude-fable-5': rate(10, 50, 1, 12.5),
  'claude-opus-4.7-fast': rate(30, 150, 3, 37.5),
  'claude-opus-4-7-fast': rate(30, 150, 3, 37.5),
  'claude-opus-4.8': rate(5, 25, 0.5, 6.25),
  'claude-opus-4-8': rate(5, 25, 0.5, 6.25),
  'claude-opus-4-8-fast': rate(5, 25, 0.5, 6.25),
  'claude-opus-5': rate(5, 25, 0.5, 6.25),
  'claude-opus-5-fast': rate(5, 25, 0.5, 6.25),
  // Claude Sonnet 5 — list $2/$10 (cache write $2.5, cache read $0.2)
  'claude-sonnet-5': rate(2, 10, 0.2, 2.5),
  'claude-sonnet-4.5': rate(3, 15, 0.3, 3.75),
  'claude-opus-4.5': rate(5, 25, 0.5, 6.25),
  'claude-opus-4.6': rate(5, 25, 0.5, 6.25),

  // —— Google ——
  'gemini-2.5-flash': rate(0.3, 2.5, 0.03),
  'gemini-3-flash': rate(0.5, 3, 0.05),
  'gemini-3-pro': rate(2, 12, 0.2),
  'gemini-3-pro-image-preview': rate(2, 12, 0.2),
  'gemini-3.1-pro': rate(2, 12, 0.2),
  'gemini-3.5-flash': rate(1.5, 9, 0.15),
  'gemini-3.6-flash': rate(1.5, 7.5, 0.15),
  'gemini-3.7-flash': rate(0.75, 3.5, 0.075),

  // —— Z.ai ——
  'glm-5.2': rate(1.4, 4.4, 0.26),

  // —— OpenAI ——
  'gpt-5': rate(1.25, 10, 0.125),
  'gpt-5-fast': rate(2.5, 20, 0.25),
  'gpt-5-mini': rate(0.25, 2, 0.025),
  'gpt-5-codex': rate(1.25, 10, 0.125),
  'gpt-5.1-codex': rate(1.25, 10, 0.125),
  'gpt-5.1-codex-max': rate(1.25, 10, 0.125),
  'gpt-5.1-codex-mini': rate(0.25, 2, 0.025),
  'gpt-5.2': rate(1.75, 14, 0.175),
  'gpt-5.2-codex': rate(1.75, 14, 0.175),
  'gpt-5.3-codex': rate(1.75, 14, 0.175),
  'gpt-5.4': rate(2.5, 15, 0.25),
  'gpt-5.4-mini': rate(0.75, 4.5, 0.075),
  'gpt-5.4-nano': rate(0.2, 1.25, 0.02),
  'gpt-5.5': rate(5, 30, 0.5),
  'gpt-5.6-luna': rate(0.2, 1.2, 0.02, 0.25),
  'gpt-5.6-sol': rate(5, 30, 0.5, 6.25),
  'gpt-5.6-terra': rate(2, 12, 0.2, 2.5),

  // —— Moonshot ——
  'kimi-k2.7-code': rate(0.95, 4, 0.19),
  'kimi-k3': rate(3, 15, 0.3),
};

/** Explicit CSV / product slugs that differ from the docs table name. */
const MODEL_ALIASES: Record<string, string> = {
  // Grok effort variants → standard / fast families
  'cursor-grok-4.5-low': 'cursor-grok-4.5',
  'cursor-grok-4.5-medium': 'cursor-grok-4.5',
  'cursor-grok-4.5-high': 'cursor-grok-4.5',
  'cursor-grok-4.5-low-fast': 'cursor-grok-4.5-fast',
  'cursor-grok-4.5-medium-fast': 'cursor-grok-4.5-fast',
  'cursor-grok-4.5-high-fast': 'cursor-grok-4.5-fast',
  'cursor-grok-4.6-low': 'cursor-grok-4.6',
  'cursor-grok-4.6-medium': 'cursor-grok-4.6',
  'cursor-grok-4.6-high': 'cursor-grok-4.6',
  'cursor-grok-4.6-xhigh': 'cursor-grok-4.6',
  'cursor-grok-4.6-low-fast': 'cursor-grok-4.6-fast',
  'cursor-grok-4.6-medium-fast': 'cursor-grok-4.6-fast',
  'cursor-grok-4.6-high-fast': 'cursor-grok-4.6-fast',
  'cursor-grok-4.6-xhigh-fast': 'cursor-grok-4.6-fast',
  'grok-4.6-low': 'grok-4.6',
  'grok-4.6-medium': 'grok-4.6',
  'grok-4.6-high': 'grok-4.6',
  'grok-4.6-xhigh': 'grok-4.6',
  'grok-4.6-low-fast': 'grok-4.6-fast',
  'grok-4.6-medium-fast': 'grok-4.6-fast',
  'grok-4.6-high-fast': 'grok-4.6-fast',
  'grok-4.6-xhigh-fast': 'grok-4.6-fast',

  // Claude Sonnet 5 thinking efforts (CSV)
  'claude-sonnet-5-thinking-low': 'claude-sonnet-5',
  'claude-sonnet-5-thinking-medium': 'claude-sonnet-5',
  'claude-sonnet-5-thinking-high': 'claude-sonnet-5',
  'claude-sonnet-5-thinking-xhigh': 'claude-sonnet-5',

  // Claude Opus 4.8 thinking efforts (CSV)
  'claude-opus-4-8-thinking-low': 'claude-opus-4-8',
  'claude-opus-4-8-thinking-medium': 'claude-opus-4-8',
  'claude-opus-4-8-thinking-high': 'claude-opus-4-8',
  'claude-opus-4-8-thinking-xhigh': 'claude-opus-4-8',

  // Claude Fable 5 thinking (CSV)
  'claude-fable-5-thinking-low': 'claude-fable-5',
  'claude-fable-5-thinking-medium': 'claude-fable-5',
  'claude-fable-5-thinking-high': 'claude-fable-5',
  'claude-fable-5-thinking-xhigh': 'claude-fable-5',

  // GPT-5.6 effort variants (CSV)
  'gpt-5.6-sol-low': 'gpt-5.6-sol',
  'gpt-5.6-sol-medium': 'gpt-5.6-sol',
  'gpt-5.6-sol-high': 'gpt-5.6-sol',
  'gpt-5.6-sol-xhigh': 'gpt-5.6-sol',
  'gpt-5.6-terra-low': 'gpt-5.6-terra',
  'gpt-5.6-terra-medium': 'gpt-5.6-terra',
  'gpt-5.6-terra-high': 'gpt-5.6-terra',
  'gpt-5.6-terra-xhigh': 'gpt-5.6-terra',
  'gpt-5.6-luna-low': 'gpt-5.6-luna',
  'gpt-5.6-luna-medium': 'gpt-5.6-luna',
  'gpt-5.6-luna-high': 'gpt-5.6-luna',
  'gpt-5.6-luna-xhigh': 'gpt-5.6-luna',
};

export function normalizeCursorModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

/**
 * Resolve a CSV / product model id to a pricing table key.
 */
export function resolvePricingKey(modelId: string): string | null {
  const id = normalizeCursorModelId(modelId);
  if (!id) return null;
  if (id in CURSOR_MODEL_PRICING) return id;
  if (id in MODEL_ALIASES) return MODEL_ALIASES[id];

  // Strip thinking + effort: foo-thinking-high → foo
  const withoutThinking = id.replace(/-thinking-(xhigh|high|medium|low)$/, '');
  if (withoutThinking in CURSOR_MODEL_PRICING) return withoutThinking;
  if (withoutThinking in MODEL_ALIASES) return MODEL_ALIASES[withoutThinking];

  // foo-high-fast → foo-fast
  const effortFast = id.match(/^(.*)-(?:low|medium|high|xhigh)-fast$/);
  if (effortFast) {
    const fastKey = `${effortFast[1]}-fast`;
    if (fastKey in CURSOR_MODEL_PRICING) return fastKey;
    if (fastKey in MODEL_ALIASES) return MODEL_ALIASES[fastKey];
  }

  // foo-high → foo (non-fast effort)
  const withoutEffort = id.replace(/-(xhigh|high|medium|low)$/, '');
  if (withoutEffort in CURSOR_MODEL_PRICING) return withoutEffort;
  if (withoutEffort in MODEL_ALIASES) return MODEL_ALIASES[withoutEffort];

  return null;
}

export function getCursorPricing(modelId: string): CursorModelPricing | null {
  const key = resolvePricingKey(modelId);
  if (!key) return null;
  return CURSOR_MODEL_PRICING[key] ?? null;
}

export function hasCursorPricing(modelId: string): boolean {
  return getCursorPricing(modelId) !== null;
}

/**
 * Cursor's two usage pools:
 * - `cursor`: Cursor Models (Grok 4.6 / 4.5, Composer 2.5) + Auto Cost
 * - `other`: third-party models (Claude, GPT, Gemini, …)
 *
 * Ultra's "$400 included" floor applies to the Other Models pool.
 * Source: https://cursor.com/docs/models-and-pricing
 */
export type CursorUsagePool = 'cursor' | 'other';

export function getCursorUsagePool(modelId: string): CursorUsagePool {
  const key = resolvePricingKey(modelId) ?? normalizeCursorModelId(modelId);
  if (
    key === 'auto' ||
    key === 'auto-cost' ||
    key.startsWith('composer-') ||
    key.startsWith('cursor-grok-') ||
    key.startsWith('grok-')
  ) {
    return 'cursor';
  }
  // Unresolved / third-party slugs draw from Other Models.
  return 'other';
}

export interface CursorCostEstimate {
  cost: number;
  estimated: boolean;
  knownPricing: boolean;
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

/** Models present in the Aug 2026 sample CSV — used by tests. */
export const SAMPLE_CSV_MODELS = [
  'cursor-grok-4.5-high-fast',
  'gpt-5.6-sol-medium',
  'cursor-grok-4.5-high',
  'claude-sonnet-5-thinking-high',
  'claude-sonnet-5-thinking-medium',
  'claude-opus-4-8-thinking-medium',
  'gpt-5.6-sol-low',
  'gpt-5.6-terra-medium',
  'claude-sonnet-5-thinking-low',
  'gpt-5.6-sol-high',
  'claude-opus-4-8-thinking-high',
  'claude-sonnet-5-thinking-xhigh',
  'composer-2.5-fast',
  'claude-4.5-sonnet',
  'claude-fable-5-thinking-high',
] as const;
