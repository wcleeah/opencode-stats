import test from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateCursorCost,
  hasCursorPricing,
  aggregateCursorCost,
  resolvePricingKey,
  getCursorUsagePool,
  SAMPLE_CSV_MODELS,
} from './pricing';

test('cursor pricing covers every model in the sample CSV', () => {
  for (const model of SAMPLE_CSV_MODELS) {
    assert.equal(
      hasCursorPricing(model),
      true,
      `missing pricing for CSV model: ${model}`,
    );
  }
});

test('resolvePricingKey maps CSV effort variants to base families', () => {
  assert.equal(resolvePricingKey('gpt-5.6-sol-medium'), 'gpt-5.6-sol');
  assert.equal(resolvePricingKey('gpt-5.6-terra-medium'), 'gpt-5.6-terra');
  assert.equal(resolvePricingKey('gpt-5.6-sol-high-fast'), 'gpt-5.6-sol-fast');
  assert.equal(resolvePricingKey('claude-sonnet-5-thinking-xhigh'), 'claude-sonnet-5');
  assert.equal(resolvePricingKey('claude-opus-4-8-thinking-medium'), 'claude-opus-4-8');
  assert.equal(resolvePricingKey('claude-fable-5-thinking-high'), 'claude-fable-5');
  assert.equal(resolvePricingKey('claude-fable-5-1-thinking-high'), 'claude-fable-5-1');
  assert.equal(resolvePricingKey('claude-opus-5-5-thinking-high'), 'claude-opus-5-5');
  assert.equal(resolvePricingKey('claude-opus-5-5-high-fast'), 'claude-opus-5-5-fast');
  assert.equal(resolvePricingKey('cursor-grok-4.5-high-fast'), 'cursor-grok-4.5-fast');
  assert.equal(resolvePricingKey('cursor-grok-4.5-high'), 'cursor-grok-4.5');
  assert.equal(resolvePricingKey('cursor-grok-4.7-high-fast'), 'cursor-grok-4.7-fast');
  assert.equal(resolvePricingKey('cursor-grok-4.7-500k-high-fast'), 'cursor-grok-4.7-500k-fast');
  assert.equal(resolvePricingKey('composer-2.5-fast'), 'composer-2.5-fast');
  assert.equal(resolvePricingKey('claude-4.5-sonnet'), 'claude-4.5-sonnet');
  assert.equal(resolvePricingKey('muse-spark-1.3-max'), 'muse-spark-1.3');
  assert.equal(resolvePricingKey('muse-spark-1.3-minimal'), 'muse-spark-1.3');
  assert.equal(resolvePricingKey('gemini-3.8-flash-high'), 'gemini-3.8-flash');
  assert.equal(resolvePricingKey('gpt-5.1-codex-max'), 'gpt-5.1-codex-max');
  assert.equal(resolvePricingKey('claude-sonnet-5-5-thinking-high'), 'claude-sonnet-5-5');
  assert.equal(resolvePricingKey('claude-haiku-5-5-thinking-high'), 'claude-haiku-5-5');
  assert.equal(resolvePricingKey('claude-haiku-5.5'), 'claude-haiku-5.5');
  assert.equal(resolvePricingKey('gemini-4-argon-minimal'), 'gemini-4-argon');
  assert.equal(resolvePricingKey('gemini-3.5-flash-lite'), 'gemini-3.5-flash-lite');
  assert.equal(resolvePricingKey('glm-5.3-flash'), 'glm-5.3-flash');
  assert.equal(resolvePricingKey('muse-wonder-1.0-max'), 'muse-wonder-1.0');
  assert.equal(resolvePricingKey('deepseek-v4-1-flash-1017-none'), 'deepseek-v4-1-flash-1017');
  assert.equal(resolvePricingKey('deepseek-v4.1-flash-1017-high'), 'deepseek-v4.1-flash-1017');
  assert.equal(resolvePricingKey('claude-opus-4.8-high-fast'), 'claude-opus-4.8-fast');
});

test('getCursorUsagePool classifies first-party vs third-party', () => {
  assert.equal(getCursorUsagePool('cursor-grok-4.5-high-fast'), 'cursor');
  assert.equal(getCursorUsagePool('cursor-grok-4.6-high-fast'), 'cursor');
  assert.equal(getCursorUsagePool('cursor-grok-4.7-high-fast'), 'cursor');
  assert.equal(getCursorUsagePool('composer-2.5-fast'), 'cursor');
  assert.equal(getCursorUsagePool('auto-cost'), 'cursor');
  assert.equal(getCursorUsagePool('gpt-5.6-sol-medium'), 'other');
  assert.equal(getCursorUsagePool('claude-sonnet-5-thinking-high'), 'other');
  assert.equal(getCursorUsagePool('claude-4.5-sonnet'), 'other');
  assert.equal(getCursorUsagePool('claude-opus-5-5-thinking-high'), 'other');
  assert.equal(getCursorUsagePool('muse-spark-1.3-max'), 'other');
  assert.equal(getCursorUsagePool('gemini-3.8-flash'), 'other');
  assert.equal(getCursorUsagePool('claude-sonnet-5-5-thinking-high'), 'other');
  assert.equal(getCursorUsagePool('claude-haiku-5-5-thinking-high'), 'other');
  assert.equal(getCursorUsagePool('gemini-4-argon-medium'), 'other');
  assert.equal(getCursorUsagePool('gemini-3.5-flash-lite'), 'other');
  assert.equal(getCursorUsagePool('glm-5.3-flash'), 'other');
  assert.equal(getCursorUsagePool('muse-wonder-1.0-high'), 'other');
  assert.equal(getCursorUsagePool('deepseek-v4-1-flash-1017-max'), 'other');
});

test('estimateCursorCost uses published grok fast rates', () => {
  const result = estimateCursorCost({
    reportedCost: null,
    modelId: 'cursor-grok-4.5-high-fast',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
  });

  assert.equal(result.knownPricing, true);
  assert.equal(result.estimated, true);
  assert.equal(result.cost, 4 + 18);
});

test('estimateCursorCost uses gpt-5.6-sol promo rates after 21 Aug 2026', () => {
  const result = estimateCursorCost({
    reportedCost: null,
    modelId: 'gpt-5.6-sol-medium',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 0,
    eventAt: Date.UTC(2026, 7, 21),
  });
  assert.equal(result.knownPricing, true);
  assert.equal(result.cost, 4);
});

test('estimateCursorCost uses gpt-5.6-sol launch rates before 21 Aug 2026', () => {
  const before = estimateCursorCost({
    reportedCost: null,
    modelId: 'gpt-5.6-sol-medium',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
    eventAt: Date.UTC(2026, 7, 20, 23, 59, 59, 999),
  });
  assert.equal(before.cost, 5 + 30);

  const onCutoff = estimateCursorCost({
    reportedCost: null,
    modelId: 'gpt-5.6-sol-medium',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
    eventAt: Date.UTC(2026, 7, 21),
  });
  assert.equal(onCutoff.cost, 4 + 20);
});

test('estimateCursorCost keeps gpt-5.6-sol promo through 21 Nov 2026', () => {
  const lastPromoDay = estimateCursorCost({
    reportedCost: null,
    modelId: 'gpt-5.6-sol',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 0,
    eventAt: Date.UTC(2026, 10, 21, 12),
  });
  assert.equal(lastPromoDay.cost, 4);
});

test('estimateCursorCost uses claude sonnet 5 list rates', () => {
  const result = estimateCursorCost({
    reportedCost: null,
    modelId: 'claude-sonnet-5-thinking-high',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
  });
  assert.equal(result.cost, 2 + 10);
});

test('estimateCursorCost uses grok 4.6 and composer fast cache-read rates', () => {
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'cursor-grok-4.6-xhigh-fast',
      tokensInput: 0,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 0,
    }).cost,
    1,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'composer-2.5-fast',
      tokensInput: 0,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 0,
    }).cost,
    0.5,
  );
});

test('estimateCursorCost uses grok 4.7 launch rates not grok 4.5 fast output', () => {
  const standard = estimateCursorCost({
    reportedCost: null,
    modelId: 'cursor-grok-4.7-high',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
  });
  assert.equal(standard.cost, 2 + 6);

  const fast = estimateCursorCost({
    reportedCost: null,
    modelId: 'cursor-grok-4.7-high-fast',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
  });
  assert.equal(fast.cost, 4 + 12);
});

test('estimateCursorCost uses grok 4.7 500k long-context rows', () => {
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'cursor-grok-4.7-500k-high-fast',
      tokensInput: 0,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 0,
    }).cost,
    1.5,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'grok-4.7-500k',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 1_000_000,
    }).cost,
    4 + 12,
  );
});

test('estimateCursorCost uses claude opus 5.5 list and fast rates', () => {
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'claude-opus-5-5-thinking-high',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 1_000_000,
    }).cost,
    4 + 20,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'claude-opus-5-5-high-fast',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 1_000_000,
    }).cost,
    8 + 40,
  );
});

test('estimateCursorCost uses fable 5.1 cache-read not fable 5 cache-read', () => {
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'claude-fable-5-1-thinking-high',
      tokensInput: 0,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 0,
    }).cost,
    0.25,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'claude-fable-5-thinking-high',
      tokensInput: 0,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 0,
    }).cost,
    1,
  );
});

test('estimateCursorCost uses gemini 3.8 flash and muse spark list rates', () => {
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'gemini-3.8-flash',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 1_000_000,
      eventAt: Date.UTC(2026, 9, 14),
    }).cost,
    0.75 + 3.75,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'muse-spark-1.3-max',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 1_000_000,
    }).cost,
    1.25 + 0.15 + 4.25,
  );
});

test('estimateCursorCost keeps gemini 3.7 and 3.8 output at $3.50 before 14 Oct 2026', () => {
  const before = {
    reportedCost: null,
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
    eventAt: Date.UTC(2026, 9, 13, 23, 59, 59, 999),
  };
  assert.equal(
    estimateCursorCost({ ...before, modelId: 'gemini-3.8-flash' }).cost,
    0.75 + 3.5,
  );
  assert.equal(
    estimateCursorCost({ ...before, modelId: 'gemini-3.7-flash' }).cost,
    0.75 + 3.5,
  );

  const onCutoff = {
    ...before,
    eventAt: Date.UTC(2026, 9, 14),
  };
  assert.equal(
    estimateCursorCost({ ...onCutoff, modelId: 'gemini-3.7-flash' }).cost,
    0.75 + 3.75,
  );
});

test('estimateCursorCost uses sonnet 5.5 cache-read cut on 7 Oct 2026', () => {
  const cacheRead = {
    reportedCost: null,
    modelId: 'claude-sonnet-5-5-thinking-high',
    tokensInput: 0,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 1_000_000,
    tokensOutput: 0,
  };
  assert.equal(
    estimateCursorCost({
      ...cacheRead,
      eventAt: Date.UTC(2026, 9, 6, 23, 59, 59, 999),
    }).cost,
    0.2,
  );
  assert.equal(
    estimateCursorCost({
      ...cacheRead,
      eventAt: Date.UTC(2026, 9, 7),
    }).cost,
    0.1,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'claude-sonnet-5.5',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 1_000_000,
      tokensCacheRead: 0,
      tokensOutput: 1_000_000,
      eventAt: Date.UTC(2026, 8, 29),
    }).cost,
    2 + 2.5 + 10,
  );
});

test('estimateCursorCost uses opus 4.8 fast rates not the standard row', () => {
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'claude-opus-4-8-fast',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 1_000_000,
    }).cost,
    10 + 50,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'claude-opus-4.8-high-fast',
      tokensInput: 0,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 0,
    }).cost,
    1,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'claude-opus-4-8-thinking-high',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 1_000_000,
    }).cost,
    5 + 25,
  );
});

test('estimateCursorCost uses october 2026 third-party list rates', () => {
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'claude-haiku-5-5-thinking-high',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 1_000_000,
      tokensCacheRead: 1_000_000,
      tokensOutput: 1_000_000,
    }).cost,
    0.1 + 0.125 + 0.01 + 0.5,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'gemini-4-argon-medium',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 1_000_000,
      eventAt: Date.UTC(2026, 11, 1),
    }).cost,
    2 + 0.1 + 10,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'muse-wonder-1.0-high',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 1_000_000,
    }).cost,
    4 + 0.2 + 20,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'deepseek-v4-1-flash-1017-max',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 1_000_000,
      tokensOutput: 1_000_000,
    }).cost,
    0.3 + 0.006 + 1.2,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'glm-5.3-flash',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 1_000_000,
    }).cost,
    0.15 + 0.5,
  );
  assert.equal(
    estimateCursorCost({
      reportedCost: null,
      modelId: 'gemini-3.5-flash-lite',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 1_000_000,
    }).cost,
    0.3 + 2.5,
  );
});

test('estimateCursorCost uses gpt-5.6-sol fast at 2x promo rates', () => {
  const result = estimateCursorCost({
    reportedCost: null,
    modelId: 'gpt-5.6-sol-high-fast',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
    eventAt: Date.UTC(2026, 7, 21),
  });
  assert.equal(result.cost, 8 + 40);
});

test('estimateCursorCost prefers numeric reported cost', () => {
  const result = estimateCursorCost({
    reportedCost: 1.5,
    modelId: 'cursor-grok-4.5-high-fast',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 1_000_000,
  });
  assert.deepEqual(result, {
    cost: 1.5,
    estimated: false,
    knownPricing: true,
  });
});

test('aggregateCursorCost sums estimates', () => {
  const total = aggregateCursorCost([
    {
      reportedCost: null,
      modelId: 'composer-2.5',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
    },
    {
      reportedCost: null,
      modelId: 'unknown-model',
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 0,
      tokensCacheRead: 0,
      tokensOutput: 0,
    },
  ]);

  assert.equal(total.total, 0.5);
  assert.equal(total.unknownModels, 1);
  assert.equal(total.hasEstimated, true);
});
