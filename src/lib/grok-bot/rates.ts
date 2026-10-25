import { isUnbilledCursorEvent } from '@/lib/cursor/csv';

import { isGrokBotModel, normalizeGrokBotModelId } from '@/lib/grok-bot/membership';

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

export interface GrokBotTokenSides {
  readonly ins: number;
  readonly outs: number;
}

export interface GrokBotPartition {
  readonly totalUsd: number;
  readonly insUsd: number;
}

export type GrokBotCharge =
  | { readonly status: 'unbilled' }
  | { readonly status: 'reported-missing' }
  | { readonly status: 'unpriced' }
  | { readonly status: 'reported'; readonly split: GrokBotPartition }
  | { readonly status: 'rated'; readonly split: GrokBotPartition }
  | {
      readonly status: 'partial';
      readonly split: GrokBotPartition;
      readonly unpricedCacheWriteTokens: number;
    };

export interface GrokBotPricedRow {
  readonly tokens: GrokBotTokenSides;
  readonly charge: GrokBotCharge;
}

export interface GrokBotUsageTypeOption {
  id: string;
  label: string;
  priced: boolean;
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

const USAGE_TYPES: readonly {
  id: string;
  label: string;
  rates: GrokBotTokenRates | null;
}[] = [
  { id: 'grok-bot-default', label: 'Default', rates: STANDARD_RATES },
  { id: 'grok-bot-automation', label: 'Automation', rates: STANDARD_RATES },
  { id: 'grok-bot-cua', label: 'CUA', rates: CUA_RATES },
  { id: 'grok-bot-knowledge-work', label: 'Knowledge work', rates: STANDARD_RATES },
];

function normalizeKind(kind: string): string {
  return kind.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function ratesFor(model: string): GrokBotTokenRates | null {
  const id = normalizeGrokBotModelId(model);
  for (const type of USAGE_TYPES) {
    if (type.id === id) return type.rates;
  }
  return null;
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

export function grokBotTokenTotal(tokens: GrokBotTokenSides): number {
  return tokens.ins + tokens.outs;
}

export function grokBotOutsUsd(totalUsd: number, insUsd: number): number {
  return totalUsd - insUsd;
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

export function grokBotUsageCatalog(
  extraModelIds: readonly string[],
): readonly GrokBotUsageTypeOption[] {
  const known: GrokBotUsageTypeOption[] = USAGE_TYPES.map((type) => ({
    id: type.id,
    label: type.label,
    priced: type.rates !== null,
  }));
  const knownIds = new Set(known.map((type) => type.id));
  const extras = new Set<string>();
  for (const modelId of extraModelIds) {
    const id = normalizeGrokBotModelId(modelId);
    if (!isGrokBotModel(id) || knownIds.has(id)) continue;
    extras.add(id);
  }
  const extraOptions = [...extras]
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, label: id, priced: false }));
  return [...known, ...extraOptions];
}
