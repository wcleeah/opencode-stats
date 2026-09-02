import { TAVILY_USAGE_URL } from '@/lib/mcp/constants';
import { asInt, asRecord, asString } from '@/lib/mcp/parse';

export interface TavilyUsage {
  plan: string | null;
  planUsage: number;
  planLimit: number | null;
  paygoUsage: number;
  paygoLimit: number | null;
  searchUsage: number;
  extractUsage: number;
  crawlUsage: number;
  mapUsage: number;
  researchUsage: number;
  keyUsage: number;
  keyLimit: number | null;
}

function intOrZero(value: unknown): number {
  return asInt(value) ?? 0;
}

function readLimit(record: Record<string, unknown> | null, key: string): number | null {
  if (!record) return null;
  const value = record[key];
  if (value === undefined || value === null) return null;
  return asInt(value);
}

/**
 * Parse GET https://api.tavily.com/usage.
 * `limit` / `plan_limit` are JSON null when unlimited.
 */
export function parseTavilyUsage(payload: unknown): TavilyUsage | { error: string } {
  const root = asRecord(payload);
  if (!root) {
    return { error: 'Tavily usage response was not an object.' };
  }

  const account = asRecord(root.account);
  const key = asRecord(root.key);

  if (!account && !key) {
    const detail = asRecord(root.detail);
    const nested = detail ? asString(detail.error) : null;
    const err = asString(root.error) ?? nested;
    return { error: err ?? 'Tavily usage response missing account and key.' };
  }

  return {
    plan: account ? asString(account.current_plan) : null,
    planUsage: account ? intOrZero(account.plan_usage) : 0,
    planLimit: readLimit(account, 'plan_limit'),
    paygoUsage: account ? intOrZero(account.paygo_usage) : 0,
    paygoLimit: readLimit(account, 'paygo_limit'),
    searchUsage: intOrZero(account?.search_usage ?? key?.search_usage),
    extractUsage: intOrZero(account?.extract_usage ?? key?.extract_usage),
    crawlUsage: intOrZero(account?.crawl_usage ?? key?.crawl_usage),
    mapUsage: intOrZero(account?.map_usage ?? key?.map_usage),
    researchUsage: intOrZero(account?.research_usage ?? key?.research_usage),
    keyUsage: key ? intOrZero(key.usage) : 0,
    keyLimit: readLimit(key, 'limit'),
  };
}

export async function fetchTavilyUsage(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ data: TavilyUsage | null; error: string | null }> {
  try {
    const response = await fetchFn(TAVILY_USAGE_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const root = asRecord(payload);
      const detail = root ? asRecord(root.detail) : null;
      const message =
        (detail ? asString(detail.error) : null) ??
        (root ? asString(root.error) : null) ??
        `Tavily /usage returned HTTP ${response.status}`;
      return { data: null, error: message };
    }
    const parsed = parseTavilyUsage(payload);
    if ('error' in parsed) {
      return { data: null, error: parsed.error };
    }
    return { data: parsed, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fetchTavilyUsage]', message);
    return { data: null, error: message };
  }
}
