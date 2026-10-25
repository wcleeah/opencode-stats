import test from 'node:test';
import assert from 'node:assert/strict';

import { grokBotUsageCatalog, priceGrokBotRow, type GrokBotPriceInput } from './rates';

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

test('included default and automation use the shared card', () => {
  const included = priceGrokBotRow(row({ tokensInput: 1_000_000 }));
  assert.deepEqual(included, { status: 'rated', usd: 2 });

  const automation = priceGrokBotRow(row({
    model: 'grok-bot-automation',
    tokensInput: 1_000_000,
  }));
  assert.deepEqual(automation, { status: 'rated', usd: 2 });
});

test('included CUA rates input, cache read, and output and ignores a stored decimal', () => {
  const charge = priceGrokBotRow(row({
    model: 'grok-bot-cua',
    tokensInput: 1_000_000,
    tokensCacheRead: 1_000_000,
    tokensOutput: 1_000_000,
    tokensInputCacheWrite: 0,
    reportedCost: 9,
  }));
  assert.deepEqual(charge, { status: 'rated', usd: 1.4 });
});

test('knowledge-work included is unpriced', () => {
  const charge = priceGrokBotRow(row({
    model: 'grok-bot-knowledge-work',
    tokensInput: 1_000_000,
  }));
  assert.deepEqual(charge, { status: 'unpriced' });
});

test('on-demand uses reported cost, including zero, and never the card', () => {
  const priced = priceGrokBotRow(row({
    kind: 'On-Demand',
    costRaw: '3.5',
    reportedCost: 3.5,
    tokensInput: 1_000_000,
  }));
  assert.deepEqual(priced, { status: 'reported', usd: 3.5 });

  const zero = priceGrokBotRow(row({
    kind: 'On-Demand',
    costRaw: '0',
    reportedCost: 0,
    tokensInput: 1_000_000,
  }));
  assert.deepEqual(zero, { status: 'reported', usd: 0 });

  const missing = priceGrokBotRow(row({
    kind: 'on_demand',
    costRaw: '',
    reportedCost: null,
    tokensInput: 1_000_000,
  }));
  assert.deepEqual(missing, { status: 'reported-missing' });
});

test('cache-write tokens above zero are partial and stay out of the known usd', () => {
  const charge = priceGrokBotRow(row({
    tokensInput: 1_000_000,
    tokensInputCacheWrite: 250,
  }));
  assert.deepEqual(charge, {
    status: 'partial',
    usd: 2,
    unknownCacheWriteTokens: 250,
  });

  const onlyWrite = priceGrokBotRow(row({ tokensInputCacheWrite: 80 }));
  assert.deepEqual(onlyWrite, {
    status: 'partial',
    usd: 0,
    unknownCacheWriteTokens: 80,
  });
});

test('free and errored rows stay unbilled even when a decimal is stored', () => {
  assert.deepEqual(
    priceGrokBotRow(row({
      kind: 'Free',
      costRaw: 'Free',
      reportedCost: 4,
      tokensInput: 1_000_000,
    })),
    { status: 'unbilled' },
  );
  assert.deepEqual(
    priceGrokBotRow(row({
      kind: 'Included',
      costRaw: 'Free',
      reportedCost: 4,
      tokensInput: 1_000_000,
    })),
    { status: 'unbilled' },
  );
  assert.deepEqual(
    priceGrokBotRow(row({
      kind: 'Errored, No Charge',
      costRaw: 'Free',
      reportedCost: null,
    })),
    { status: 'unbilled' },
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
  assert.equal(catalog.find((entry) => entry.id === 'grok-bot-knowledge-work')?.priced, false);
  assert.equal(catalog.find((entry) => entry.id === 'grok-bot-cua')?.label, 'CUA');
  assert.equal(catalog.find((entry) => entry.id === 'grok-bot-extra')?.priced, false);
});
