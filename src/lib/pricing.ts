/**
 * Model pricing data and cost estimation utilities.
 *
 * Prices are OpenCode Zen pricing (per token, USD).
 * Source: https://opencode.ai/docs/zen/
 *
 * Notes:
 * - Free-tier models are excluded (gpt-5-nano, big-pickle, etc.)
 * - Cache read uses a dedicated cacheRead rate per model
 * - Some models have higher rates above 200K context; we use the base tier
 */

interface ModelPricing {
    /** Price per input token */
    input: number;
    /** Price per output token */
    output: number;
    /** Price per cache-read token */
    cacheRead: number;
    /** Price per cache-write token (0 if not applicable) */
    cacheWrite: number;
}

/**
 * Known model pricing. Keys are model_id values as stored in the database.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
    "minimax-m2.1": {
        input: 0.3 / 1_000_000,
        output: 1.2 / 1_000_000,
        cacheRead: 0.1 / 1_000_000,
        cacheWrite: 0,
    },
    "minimax-m2.1-free": {
        input: 0.3 / 1_000_000,
        output: 1.2 / 1_000_000,
        cacheRead: 0.1 / 1_000_000,
        cacheWrite: 0,
    },
    "glm-4.7": {
        input: 0.6 / 1_000_000,
        output: 2.2 / 1_000_000,
        cacheRead: 0.1 / 1_000_000,
        cacheWrite: 0,
    },
    "glm-4.7-free": {
        input: 0.6 / 1_000_000,
        output: 2.2 / 1_000_000,
        cacheRead: 0.1 / 1_000_000,
        cacheWrite: 0,
    },
    "kimi-k2.5": {
        input: 0.6 / 1_000_000,
        output: 3.0 / 1_000_000,
        cacheRead: 0.08 / 1_000_000,
        cacheWrite: 0,
    },
    "kimi-k2.5-free": {
        input: 0.6 / 1_000_000,
        output: 3.0 / 1_000_000,
        cacheRead: 0.08 / 1_000_000,
        cacheWrite: 0,
    },
    "gpt-5.2": {
        input: 1.75 / 1_000_000,
        output: 14.0 / 1_000_000,
        cacheRead: 0.175 / 1_000_000,
        cacheWrite: 0,
    },
    "gpt-5.2-codex": {
        input: 1.75 / 1_000_000,
        output: 14.0 / 1_000_000,
        cacheRead: 0.175 / 1_000_000,
        cacheWrite: 0,
    },
    "gpt-5.3-codex": {
        input: 1.75 / 1_000_000,
        output: 14.0 / 1_000_000,
        cacheRead: 0.175 / 1_000_000,
        cacheWrite: 0 / 1_000_000,
    },
    "gpt-5.4": {
        input: 2.5 / 1_000_000,
        output: 15.0 / 1_000_000,
        cacheRead: 0.25 / 1_000_000,
        cacheWrite: 0 / 1_000_000,
    },
    "gemini-3-pro": {
        input: 2.0 / 1_000_000,
        output: 12.0 / 1_000_000,
        cacheRead: 0.2 / 1_000_000,
        cacheWrite: 0,
    },
    "grok-code": {
        input: 0.2 / 1_000_000,
        output: 1.5 / 1_000_000,
        cacheRead: 0,
        cacheWrite: 0,
    },
    "claude-sonnet-4.5": {
        input: 3.0 / 1_000_000,
        output: 15.0 / 1_000_000,
        cacheRead: 0.3 / 1_000_000,
        cacheWrite: 3.75 / 1_000_000,
    },
    "claude-opus-4.5": {
        input: 5.0 / 1_000_000,
        output: 25.0 / 1_000_000,
        cacheRead: 0.5 / 1_000_000,
        cacheWrite: 6.25 / 1_000_000,
    },
    "claude-opus-4.6": {
        input: 5.0 / 1_000_000,
        output: 25.0 / 1_000_000,
        cacheRead: 0.5 / 1_000_000,
        cacheWrite: 6.25 / 1_000_000,
    },
};

export interface CostEstimate {
    /** Estimated cost in USD */
    cost: number;
    /** Whether this is an estimate (true) or reported by the provider (false) */
    estimated: boolean;
}

export interface CostBreakdown {
    total: number;
    reported: number;
    estimated: number;
    hasEstimated: boolean;
}

export interface CostBreakdownInput {
    reportedCost: number;
    modelId: string;
    tokensIn: number;
    tokensOut: number;
    tokensCacheRead: number;
    tokensCacheWrite: number;
}

/**
 * Estimate or return the cost for a response.
 *
 * If the provider already reported a non-zero cost, returns that.
 * Otherwise, estimates from token counts using known model pricing.
 * Cache reads use the model cacheRead rate.
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
        params.tokensCacheRead * pricing.cacheRead +
        params.tokensCacheWrite * pricing.cacheWrite +
        params.tokensOut * pricing.output;

    return { cost, estimated: true };
}

export function aggregateCostBreakdown(
    rows: CostBreakdownInput[],
): CostBreakdown {
    let reported = 0;
    let estimated = 0;

    for (const row of rows) {
        const est = estimateCost({
            reportedCost: row.reportedCost,
            modelId: row.modelId,
            tokensIn: row.tokensIn,
            tokensOut: row.tokensOut,
            tokensCacheRead: row.tokensCacheRead,
            tokensCacheWrite: row.tokensCacheWrite,
        });

        if (est.estimated) {
            estimated += est.cost;
        } else {
            reported += est.cost;
        }
    }

    const total = reported + estimated;
    return {
        total,
        reported,
        estimated,
        hasEstimated: estimated > 0,
    };
}

/**
 * Check if we have pricing data for a given model.
 */
export function hasPricing(modelId: string): boolean {
    return modelId in MODEL_PRICING;
}
