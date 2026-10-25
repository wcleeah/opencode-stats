import test from 'node:test';
import assert from 'node:assert/strict';

import {
  grokBotOutsUsd,
  grokBotUsageCatalog,
  priceGrokBotRow,
  type GrokBotPriceInput,
  type GrokBotPricedRow,
} from './rates';

function row(overrides: Partial<GrokBotPriceInput>): GrokBotPriceInput {
  return {
    model: 'grok-bot-default',
    kind: 'Included',
    costRaw: 'Included',
    reportedCost: null,
    tokensInput: 0,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 0,
    ...overrides,
  };
}

function assertRow(actual: GrokBotPricedRow, expected: GrokBotPricedRow): void {
  assert.deepEqual(actual, expected);
}

test('included default, automation, and knowledge work use the shared card', () => {
  assertRow(
    priceGrokBotRow(row({ tokensInput: 1_000_000 })),
    {
      tokens: { ins: 1_000_000, outs: 0 },
      charge: { status: 'rated', split: { totalUsd: 2, insUsd: 2 } },
    },
  );

  assertRow(
    priceGrokBotRow(row({
      model: 'grok-bot-automation',
      tokensInput: 1_000_000,
    })),
    {
      tokens: { ins: 1_000_000, outs: 0 },
      charge: { status: 'rated', split: { totalUsd: 2, insUsd: 2 } },
    },
  );

  assertRow(
    priceGrokBotRow(row({
      model: 'grok-bot-knowledge-work',
      tokensInput: 1_000_000,
      tokensCacheRead: 1_000_000,
      tokensOutput: 1_000_000,
    })),
    {
      tokens: { ins: 2_000_000, outs: 1_000_000 },
      charge: { status: 'rated', split: { totalUsd: 8.5, insUsd: 2.5 } },
    },
  );
});

test('included CUA rates input, cache read, and output and ignores a stored decimal', () => {
  assertRow(
    priceGrokBotRow(row({
      model: 'grok-bot-cua',
      tokensInput: 1_000_000,
      tokensCacheRead: 1_000_000,
      tokensOutput: 1_000_000,
      tokensInputCacheWrite: 0,
      reportedCost: 9,
    })),
    {
      tokens: { ins: 2_000_000, outs: 1_000_000 },
      charge: { status: 'rated', split: { totalUsd: 1.4, insUsd: 0.2 } },
    },
  );
});

test('on-demand uses the stored decimal and card weights, including zero', () => {
  assertRow(
    priceGrokBotRow(row({
      kind: 'On-Demand',
      costRaw: '3.5',
      reportedCost: 3.5,
      tokensInput: 1_000_000,
    })),
    {
      tokens: { ins: 1_000_000, outs: 0 },
      charge: { status: 'reported', split: { totalUsd: 3.5, insUsd: 3.5 } },
    },
  );

  assertRow(
    priceGrokBotRow(row({
      kind: 'On-Demand',
      costRaw: '0',
      reportedCost: 0,
      tokensInput: 1_000_000,
    })),
    {
      tokens: { ins: 1_000_000, outs: 0 },
      charge: { status: 'reported', split: { totalUsd: 0, insUsd: 0 } },
    },
  );

  assertRow(
    priceGrokBotRow(row({
      kind: 'on_demand',
      costRaw: '',
      reportedCost: null,
      tokensInput: 1_000_000,
    })),
    {
      tokens: { ins: 1_000_000, outs: 0 },
      charge: { status: 'reported-missing' },
    },
  );

  assertRow(
    priceGrokBotRow(row({
      kind: 'On-Demand',
      costRaw: '10',
      reportedCost: 10,
      tokensInput: 1_000_000,
      tokensOutput: 1_000_000,
    })),
    {
      tokens: { ins: 1_000_000, outs: 1_000_000 },
      charge: { status: 'reported', split: { totalUsd: 10, insUsd: 2.5 } },
    },
  );
  assert.equal(grokBotOutsUsd(10, 2.5), 7.5);
});

test('on-demand cache-write tokens stay reported and keep the stored dollar on ins', () => {
  assertRow(
    priceGrokBotRow(row({
      kind: 'On-Demand',
      costRaw: '4',
      reportedCost: 4,
      tokensInputCacheWrite: 1_000_000,
    })),
    {
      tokens: { ins: 1_000_000, outs: 0 },
      charge: { status: 'reported', split: { totalUsd: 4, insUsd: 4 } },
    },
  );
});

test('cache-write tokens on an included row are partial and stay out of the known usd', () => {
  assertRow(
    priceGrokBotRow(row({
      tokensInput: 1_000_000,
      tokensInputCacheWrite: 250,
    })),
    {
      tokens: { ins: 1_000_250, outs: 0 },
      charge: {
        status: 'partial',
        split: { totalUsd: 2, insUsd: 2 },
        unpricedCacheWriteTokens: 250,
      },
    },
  );

  assertRow(
    priceGrokBotRow(row({ tokensInputCacheWrite: 80 })),
    {
      tokens: { ins: 80, outs: 0 },
      charge: {
        status: 'partial',
        split: { totalUsd: 0, insUsd: 0 },
        unpricedCacheWriteTokens: 80,
      },
    },
  );
});

test('an unknown model splits a stored dollar by token counts', () => {
  assertRow(
    priceGrokBotRow(row({
      model: 'grok-bot-custom',
      kind: 'On-Demand',
      costRaw: '10',
      reportedCost: 10,
      tokensOutput: 1_000_000,
    })),
    {
      tokens: { ins: 0, outs: 1_000_000 },
      charge: { status: 'reported', split: { totalUsd: 10, insUsd: 0 } },
    },
  );

  assertRow(
    priceGrokBotRow(row({
      model: 'grok-bot-custom',
      kind: 'On-Demand',
      costRaw: '10',
      reportedCost: 10,
      tokensInput: 1_000_000,
      tokensOutput: 1_000_000,
    })),
    {
      tokens: { ins: 1_000_000, outs: 1_000_000 },
      charge: { status: 'reported', split: { totalUsd: 10, insUsd: 5 } },
    },
  );
});

test('free and errored rows stay unbilled even when a decimal is stored', () => {
  assertRow(
    priceGrokBotRow(row({
      kind: 'Free',
      costRaw: 'Free',
      reportedCost: 4,
      tokensInput: 1_000_000,
    })),
    {
      tokens: { ins: 1_000_000, outs: 0 },
      charge: { status: 'unbilled' },
    },
  );
  assertRow(
    priceGrokBotRow(row({
      kind: 'Included',
      costRaw: 'Free',
      reportedCost: 4,
      tokensInput: 1_000_000,
    })),
    {
      tokens: { ins: 1_000_000, outs: 0 },
      charge: { status: 'unbilled' },
    },
  );
  assertRow(
    priceGrokBotRow(row({
      kind: 'Errored, No Charge',
      costRaw: 'Free',
      reportedCost: null,
    })),
    {
      tokens: { ins: 0, outs: 0 },
      charge: { status: 'unbilled' },
    },
  );
});

test('usage catalog keeps registry order then unknown members', () => {
  const catalog = grokBotUsageCatalog([
    'cursor-grok-4.7',
    'Grok-Bot-Zeta',
    'grok-bot-default',
    'grok-bot',
    'grok-bot-extra',
  ]);
  assert.deepEqual(
    catalog.map((entry) => entry.id),
    [
      'grok-bot-default',
      'grok-bot-automation',
      'grok-bot-cua',
      'grok-bot-knowledge-work',
      'grok-bot-extra',
      'grok-bot-zeta',
    ],
  );
  assert.equal(catalog.find((entry) => entry.id === 'grok-bot-default')?.priced, true);
  assert.equal(catalog.find((entry) => entry.id === 'grok-bot-knowledge-work')?.priced, true);
  assert.equal(catalog.find((entry) => entry.id === 'grok-bot-cua')?.label, 'CUA');
  assert.equal(catalog.find((entry) => entry.id === 'grok-bot-extra')?.priced, false);
});
