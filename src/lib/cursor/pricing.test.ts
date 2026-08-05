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
  assert.equal(resolvePricingKey('claude-sonnet-5-thinking-xhigh'), 'claude-sonnet-5');
  assert.equal(resolvePricingKey('claude-opus-4-8-thinking-medium'), 'claude-opus-4-8');
  assert.equal(resolvePricingKey('claude-fable-5-thinking-high'), 'claude-fable-5');
  assert.equal(resolvePricingKey('cursor-grok-4.5-high-fast'), 'cursor-grok-4.5-fast');
  assert.equal(resolvePricingKey('cursor-grok-4.5-high'), 'cursor-grok-4.5');
  assert.equal(resolvePricingKey('composer-2.5-fast'), 'composer-2.5-fast');
  assert.equal(resolvePricingKey('claude-4.5-sonnet'), 'claude-4.5-sonnet');
});

test('getCursorUsagePool classifies first-party vs third-party', () => {
  assert.equal(getCursorUsagePool('cursor-grok-4.5-high-fast'), 'cursor');
  assert.equal(getCursorUsagePool('composer-2.5-fast'), 'cursor');
  assert.equal(getCursorUsagePool('auto-cost'), 'cursor');
  assert.equal(getCursorUsagePool('gpt-5.6-sol-medium'), 'other');
  assert.equal(getCursorUsagePool('claude-sonnet-5-thinking-high'), 'other');
  assert.equal(getCursorUsagePool('claude-4.5-sonnet'), 'other');
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

test('estimateCursorCost uses gpt-5.6-sol rates for effort variants', () => {
  const result = estimateCursorCost({
    reportedCost: null,
    modelId: 'gpt-5.6-sol-medium',
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 0,
  });
  assert.equal(result.knownPricing, true);
  assert.equal(result.cost, 5);
});

test('estimateCursorCost uses claude sonnet 5 promo rates', () => {
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
