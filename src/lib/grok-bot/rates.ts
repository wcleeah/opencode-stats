import { isUnbilledCursorEvent } from '@/lib/cursor/csv';

import type {
  GrokBotCharge,
  GrokBotPartition,
  GrokBotPricedRow,
  GrokBotTokenSides,
} from '@/lib/grok-bot/charge';
import {
  GROK_BOT_KNOWN_USAGE,
  type GrokBotKnownUsageId,
} from '@/lib/grok-bot/catalog';
import { normalizeGrokBotModelId } from '@/lib/grok-bot/membership';

interface GrokBotTokenRates {
  inputPerMillion: number;
  cacheReadPerMillion: number;
  outputPerMillion: number;
}

export interface GrokBotPriceInput {
  model: string;
  kind: string;
  costRaw: string;
  reportedCost: number | null;
  tokensInput: number;
  tokensInputCacheWrite: number;
  tokensCacheRead: number;
  tokensOutput: number;
}

const STANDARD_RATES: GrokBotTokenRates = {
  inputPerMillion: 2,
  cacheReadPerMillion: 0.5,
  outputPerMillion: 6,
};

const CUA_RATES: GrokBotTokenRates = {
  inputPerMillion: 0.18,
  cacheReadPerMillion: 0.02,
  outputPerMillion: 1.2,
};

const RATES: { [Id in GrokBotKnownUsageId]: GrokBotTokenRates } = {
  'grok-bot-default': STANDARD_RATES,
  'grok-bot-automation': STANDARD_RATES,
  'grok-bot-cua': CUA_RATES,
  'grok-bot-knowledge-work': STANDARD_RATES,
};

function isKnownUsageId(id: string): id is GrokBotKnownUsageId {
  return GROK_BOT_KNOWN_USAGE.some((entry) => entry.id === id);
}

function normalizeKind(kind: string): string {
  return kind.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function ratesFor(model: string): GrokBotTokenRates | null {
  const id = normalizeGrokBotModelId(model);
  if (!isKnownUsageId(id)) return null;
  return RATES[id];
}

function tokenSides(row: GrokBotPriceInput): GrokBotTokenSides {
  return {
    ins: row.tokensInput + row.tokensInputCacheWrite + row.tokensCacheRead,
    outs: row.tokensOutput,
  };
}

function storedPartition(row: GrokBotPriceInput, usd: number): GrokBotPartition {
  const rates = ratesFor(row.model);
  const insWeight = rates
    ? row.tokensInput * rates.inputPerMillion
      + row.tokensCacheRead * rates.cacheReadPerMillion
    : row.tokensInput + row.tokensInputCacheWrite + row.tokensCacheRead;
  const outsWeight = rates
    ? row.tokensOutput * rates.outputPerMillion
    : row.tokensOutput;
  let insUsd: number;
  if (outsWeight > 0 && insWeight <= 0) insUsd = 0;
  else if (outsWeight <= 0) insUsd = usd;
  else insUsd = usd * insWeight / (insWeight + outsWeight);
  return { totalUsd: usd, insUsd };
}

function chargeFromCard(row: GrokBotPriceInput, rates: GrokBotTokenRates): GrokBotCharge {
  const insUsd = (
    row.tokensInput * rates.inputPerMillion
    + row.tokensCacheRead * rates.cacheReadPerMillion
  ) / 1_000_000;
  const outsUsd = (row.tokensOutput * rates.outputPerMillion) / 1_000_000;
  const split: GrokBotPartition = { totalUsd: insUsd + outsUsd, insUsd };
  if (row.tokensInputCacheWrite > 0) {
    return {
      status: 'partial',
      split,
      unpricedCacheWriteTokens: row.tokensInputCacheWrite,
    };
  }
  return { status: 'rated', split };
}

export function priceGrokBotRow(row: GrokBotPriceInput): GrokBotPricedRow {
  const tokens = tokenSides(row);
  if (isUnbilledCursorEvent(row.kind, row.costRaw)) {
    return { tokens, charge: { status: 'unbilled' } };
  }

  const kind = normalizeKind(row.kind);
  if (kind === 'on-demand') {
    if (row.reportedCost === null) {
      return { tokens, charge: { status: 'reported-missing' } };
    }
    return {
      tokens,
      charge: { status: 'reported', split: storedPartition(row, row.reportedCost) },
    };
  }
  if (kind === 'included') {
    const rates = ratesFor(row.model);
    if (!rates) return { tokens, charge: { status: 'unpriced' } };
    return { tokens, charge: chargeFromCard(row, rates) };
  }
  if (row.reportedCost !== null) {
    return {
      tokens,
      charge: { status: 'reported', split: storedPartition(row, row.reportedCost) },
    };
  }
  return { tokens, charge: { status: 'unpriced' } };
}
