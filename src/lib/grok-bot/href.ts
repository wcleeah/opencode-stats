export const GROK_BOT_PATH = '/cursor/grok';

export type GrokBotChartMode = 'by-type' | 'ins-outs';

export const GROK_BOT_INS_LINE = 'Ins';
export const GROK_BOT_OUTS_LINE = 'Outs';

export const GROK_BOT_MAX_COMPARE = 3;
export const GROK_BOT_MAX_COMPARE_WEEKS = 52;

declare const grokBotNegativeCycleDeltaBrand: unique symbol;

/** Integer cycle delta from -52 through -1. The primary is not a member. */
export type GrokBotNegativeCycleDelta = number & {
  readonly [grokBotNegativeCycleDeltaBrand]: true;
};

export interface GrokBotHrefParams {
  /** Whole-cycle link. Omit `startMs` and `endMs` when this is set. */
  cycle?: number;
  startMs?: number;
  endMs?: number;
  /** Undefined means all usage types. */
  usage?: string;
  page?: number;
  mode: GrokBotChartMode;
  compareDeltas?: readonly GrokBotNegativeCycleDelta[];
}

export function parseGrokBotChartMode(raw: string | undefined): GrokBotChartMode {
  return raw === 'ins-outs' ? 'ins-outs' : 'by-type';
}

function brandGrokBotCompareDelta(value: number): GrokBotNegativeCycleDelta {
  return value as GrokBotNegativeCycleDelta;
}

function normalizeGrokBotCompareDeltas(
  values: readonly number[],
): readonly GrokBotNegativeCycleDelta[] {
  const seen = new Set<number>();
  const kept: number[] = [];
  for (const value of values) {
    if (value > -1 || value < -GROK_BOT_MAX_COMPARE_WEEKS || seen.has(value)) continue;
    seen.add(value);
    kept.push(value);
  }
  kept.sort((left, right) => right - left);
  return kept.slice(0, GROK_BOT_MAX_COMPARE).map(brandGrokBotCompareDelta);
}

export function parseGrokBotCompareDeltas(
  raw: string | undefined,
): readonly GrokBotNegativeCycleDelta[] {
  if (raw === undefined) return [];
  const values: number[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!/^-?\d+$/.test(trimmed)) continue;
    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed)) continue;
    values.push(parsed);
  }
  return normalizeGrokBotCompareDeltas(values);
}

export function addGrokBotCompareDelta(
  deltas: readonly GrokBotNegativeCycleDelta[],
): readonly GrokBotNegativeCycleDelta[] | undefined {
  if (deltas.length >= GROK_BOT_MAX_COMPARE) return undefined;
  const present = new Set<number>(deltas);
  let hole = 0;
  for (let magnitude = 1; magnitude <= GROK_BOT_MAX_COMPARE_WEEKS; magnitude += 1) {
    if (!present.has(-magnitude)) {
      hole = magnitude;
      break;
    }
  }
  if (hole === 0) return undefined;
  return normalizeGrokBotCompareDeltas([...deltas, -hole]);
}

export function removeGrokBotCompareDelta(
  deltas: readonly GrokBotNegativeCycleDelta[],
  delta: GrokBotNegativeCycleDelta,
): readonly GrokBotNegativeCycleDelta[] {
  return deltas.filter((item) => item !== delta);
}

export function grokBotHref(params: GrokBotHrefParams): string {
  const search = new URLSearchParams();
  if (params.cycle !== undefined) {
    search.set('cycle', String(params.cycle));
  } else if (params.startMs !== undefined && params.endMs !== undefined) {
    search.set('start', String(params.startMs));
    search.set('end', String(params.endMs));
  }
  if (params.usage !== undefined && params.usage.trim() !== '') {
    search.set('usage', params.usage);
  }
  if (params.page !== undefined && params.page !== 1) {
    search.set('page', String(params.page));
  }
  if (params.mode === 'ins-outs') {
    search.set('view', 'ins-outs');
  }
  let query = search.toString();
  if (params.compareDeltas !== undefined && params.compareDeltas.length > 0) {
    const cmp = `cmp=${params.compareDeltas.join(',')}`;
    query = query.length > 0 ? `${query}&${cmp}` : cmp;
  }
  return query.length > 0 ? `${GROK_BOT_PATH}?${query}` : GROK_BOT_PATH;
}

function explicitSelection(
  catalogIds: readonly string[],
  usage: string | undefined,
): readonly string[] | undefined {
  if (usage === undefined || usage.trim() === '') return undefined;
  const wanted = new Set(
    usage
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0),
  );
  const picked = catalogIds.filter((id) => wanted.has(id));
  if (picked.length === 0) return undefined;
  return picked;
}

export function toggleGrokBotUsageParam(
  catalogIds: readonly string[],
  usage: string | undefined,
  id: string,
): string | undefined {
  const current = explicitSelection(catalogIds, usage) ?? catalogIds;
  const selected = new Set(current);
  if (selected.has(id)) {
    selected.delete(id);
  } else if (catalogIds.includes(id)) {
    selected.add(id);
  }
  if (selected.size === 0 || selected.size === catalogIds.length) return undefined;
  return catalogIds.filter((item) => selected.has(item)).join(',');
}
