import { type GrokBotUsageTypeOption } from '@/lib/grok-bot/catalog';
import { isGrokBotModel, normalizeGrokBotModelId } from '@/lib/grok-bot/membership';

export const GROK_BOT_PATH = '/cursor/grok';

export type GrokBotChartMode = 'by-type' | 'ins-outs';

export const GROK_BOT_INS_LINE = 'Ins';
export const GROK_BOT_OUTS_LINE = 'Outs';

export interface GrokBotHrefParams {
  /** Whole-cycle link. Omit `startMs` and `endMs` when this is set. */
  cycle?: number;
  startMs?: number;
  endMs?: number;
  /** Undefined means all usage types. */
  usage?: string;
  page?: number;
  mode: GrokBotChartMode;
  compareStarts?: readonly number[];
  focusStartMs?: number;
  primaryStartMs?: number;
}

export function parseGrokBotChartMode(raw: string | undefined): GrokBotChartMode {
  return raw === 'ins-outs' ? 'ins-outs' : 'by-type';
}

function parseSafeInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

export function parseGrokBotCompareStarts(
  raw: string | undefined,
  primaryStartMs: number,
): readonly number[] {
  if (raw === undefined) return [];
  const seen = new Set<number>();
  const kept: number[] = [];
  for (const part of raw.split(',')) {
    const parsed = parseSafeInteger(part);
    if (parsed === null || parsed < 0 || parsed === primaryStartMs || seen.has(parsed)) continue;
    seen.add(parsed);
    kept.push(parsed);
  }
  return kept;
}

export function parseGrokBotFocusStart(
  raw: string | undefined,
  periodStarts: readonly number[],
): number {
  const fallback = periodStarts[0] ?? 0;
  if (raw === undefined) return fallback;
  const parsed = parseSafeInteger(raw);
  if (parsed === null) return fallback;
  return periodStarts.includes(parsed) ? parsed : fallback;
}

export function removeGrokBotCompareStart(
  starts: readonly number[],
  startMs: number,
): readonly number[] {
  return starts.filter((item) => item !== startMs);
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
  if (
    params.focusStartMs !== undefined
    && params.focusStartMs !== params.primaryStartMs
  ) {
    search.set('focus', String(params.focusStartMs));
  }
  let query = search.toString();
  if (params.compareStarts !== undefined && params.compareStarts.length > 0) {
    const cmp = `cmp=${params.compareStarts.join(',')}`;
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

export function selectUsage(
  catalog: readonly GrokBotUsageTypeOption[],
  usage: string | undefined,
): { ids: readonly string[]; param: string | undefined } {
  const ids = catalog.map((entry) => entry.id);
  if (usage === undefined || usage.trim() === '') {
    return { ids, param: undefined };
  }
  const wanted = new Set(
    usage
      .split(',')
      .map((part) => normalizeGrokBotModelId(part))
      .filter((part) => isGrokBotModel(part)),
  );
  const picked = ids.filter((id) => wanted.has(id));
  if (picked.length === 0 || picked.length === ids.length) {
    return { ids, param: undefined };
  }
  return { ids: picked, param: picked.join(',') };
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
