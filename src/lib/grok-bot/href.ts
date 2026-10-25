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
}

export function parseGrokBotChartMode(raw: string | undefined): GrokBotChartMode {
  return raw === 'ins-outs' ? 'ins-outs' : 'by-type';
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
  const query = search.toString();
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
