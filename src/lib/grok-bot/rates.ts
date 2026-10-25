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

export type GrokBotCharge =
  | { status: 'unbilled' }
  | { status: 'reported'; usd: number }
  | { status: 'reported-missing' }
  | { status: 'rated'; usd: number }
  | { status: 'partial'; usd: number; unknownCacheWriteTokens: number }
  | { status: 'unpriced' };

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

function chargeFromCard(row: GrokBotPriceInput, rates: GrokBotTokenRates): GrokBotCharge {
  const usd = (
    row.tokensInput * rates.inputPerMillion
    + row.tokensCacheRead * rates.cacheReadPerMillion
    + row.tokensOutput * rates.outputPerMillion
  ) / 1_000_000;
  if (row.tokensInputCacheWrite > 0) {
    return {
      status: 'partial',
      usd,
      unknownCacheWriteTokens: row.tokensInputCacheWrite,
    };
  }
  return { status: 'rated', usd };
}

export function priceGrokBotRow(row: GrokBotPriceInput): GrokBotCharge {
  if (isUnbilledCursorEvent(row.kind, row.costRaw)) {
    return { status: 'unbilled' };
  }

  const kind = normalizeKind(row.kind);
  if (kind === 'on-demand') {
    if (row.reportedCost === null) return { status: 'reported-missing' };
    return { status: 'reported', usd: row.reportedCost };
  }
  if (kind === 'included') {
    const rates = ratesFor(row.model);
    if (!rates) return { status: 'unpriced' };
    return chargeFromCard(row, rates);
  }
  if (row.reportedCost !== null) {
    return { status: 'reported', usd: row.reportedCost };
  }
  return { status: 'unpriced' };
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
