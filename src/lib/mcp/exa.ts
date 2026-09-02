import { EXA_ADMIN_API_BASE } from '@/lib/mcp/constants';
import { asNumber, asRecord, asString } from '@/lib/mcp/parse';

export interface ExaCostBreakdown {
  priceId: string | null;
  priceName: string;
  quantity: number;
  amountUsd: number;
}

export interface ExaUsage {
  apiKeyId: string;
  apiKeyName: string | null;
  totalCostUsd: number;
  breakdown: ExaCostBreakdown[];
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ExaApiKeyMeta {
  id: string;
  name: string | null;
  budgetCents: number | null;
  isOverBudget: boolean | null;
}

function parseBreakdownItem(value: unknown): ExaCostBreakdown | null {
  const row = asRecord(value);
  if (!row) return null;
  const priceName = asString(row.price_name) ?? asString(row.priceName) ?? 'Unknown';
  return {
    priceId: asString(row.price_id) ?? asString(row.priceId),
    priceName,
    quantity: asNumber(row.quantity) ?? 0,
    amountUsd: asNumber(row.amount_usd) ?? asNumber(row.amountUsd) ?? 0,
  };
}

export function parseExaUsage(payload: unknown): ExaUsage | { error: string } {
  const root = asRecord(payload);
  if (!root) {
    return { error: 'Exa usage response was not an object.' };
  }
  if (asString(root.error)) {
    return { error: asString(root.error) ?? 'Exa usage error.' };
  }

  const period = asRecord(root.period);
  const breakdownRaw = root.cost_breakdown ?? root.costBreakdown;
  const breakdown = Array.isArray(breakdownRaw)
    ? breakdownRaw.map(parseBreakdownItem).filter((row): row is ExaCostBreakdown => row !== null)
    : [];

  const total =
    asNumber(root.total_cost_usd) ?? asNumber(root.totalCostUsd) ?? 0;
  const apiKeyId =
    asString(root.api_key_id) ?? asString(root.apiKeyId) ?? asString(root.id);
  if (!apiKeyId) {
    return { error: 'Exa usage response missing api_key_id.' };
  }

  return {
    apiKeyId,
    apiKeyName: asString(root.api_key_name) ?? asString(root.apiKeyName),
    totalCostUsd: total,
    breakdown,
    periodStart: period ? asString(period.start) : null,
    periodEnd: period ? asString(period.end) : null,
  };
}

function parseApiKeyMeta(value: unknown): ExaApiKeyMeta | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  const budget = asNumber(row.budgetCents) ?? asNumber(row.budget_cents);
  const over = row.isOverBudget ?? row.is_over_budget;
  return {
    id,
    name: asString(row.name),
    budgetCents: budget,
    isOverBudget: typeof over === 'boolean' ? over : null,
  };
}

export function parseExaBreakdownJson(json: string | null): ExaCostBreakdown[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is ExaCostBreakdown => {
      if (!row || typeof row !== 'object') return false;
      const rec = row as Record<string, unknown>;
      return typeof rec.priceName === 'string' && typeof rec.amountUsd === 'number';
    });
  } catch {
    return [];
  }
}

export function parseExaApiKeyList(payload: unknown): ExaApiKeyMeta[] | { error: string } {
  const root = asRecord(payload);
  if (!root) {
    return { error: 'Exa API key list was not an object.' };
  }
  if (asString(root.error)) {
    return { error: asString(root.error) ?? 'Exa API key list error.' };
  }

  const fromArray = root.apiKeys ?? root.api_keys;
  if (Array.isArray(fromArray)) {
    return fromArray.map(parseApiKeyMeta).filter((row): row is ExaApiKeyMeta => row !== null);
  }

  const single = parseApiKeyMeta(root.apiKey ?? root.api_key);
  if (single) return [single];

  return { error: 'Exa API key list missing apiKeys.' };
}

export async function resolveExaApiKeyId(params: {
  serviceKey: string;
  configuredId: string | null;
  fetchFn?: typeof fetch;
}): Promise<{ data: ExaApiKeyMeta | null; error: string | null }> {
  const fetchFn = params.fetchFn ?? fetch;
  if (params.configuredId) {
    return {
      data: {
        id: params.configuredId,
        name: null,
        budgetCents: null,
        isOverBudget: null,
      },
      error: null,
    };
  }

  try {
    const response = await fetchFn(`${EXA_ADMIN_API_BASE}/api-keys`, {
      method: 'GET',
      headers: { 'x-api-key': params.serviceKey },
      cache: 'no-store',
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const root = asRecord(payload);
      const message =
        (root ? asString(root.error) : null) ??
        `Exa list API keys returned HTTP ${response.status}`;
      return { data: null, error: message };
    }
    const parsed = parseExaApiKeyList(payload);
    if ('error' in parsed) {
      return { data: null, error: parsed.error };
    }
    if (parsed.length === 0) {
      return { data: null, error: 'No Exa API keys found for this service key.' };
    }
    return { data: parsed[0], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[resolveExaApiKeyId]', message);
    return { data: null, error: message };
  }
}

export async function fetchExaUsage(params: {
  serviceKey: string;
  apiKeyId: string;
  startIso: string;
  endIso: string;
  fetchFn?: typeof fetch;
}): Promise<{ data: ExaUsage | null; error: string | null }> {
  const fetchFn = params.fetchFn ?? fetch;
  try {
    const url = new URL(`${EXA_ADMIN_API_BASE}/api-keys/${params.apiKeyId}/usage`);
    url.searchParams.set('start_date', params.startIso);
    url.searchParams.set('end_date', params.endIso);

    const response = await fetchFn(url.toString(), {
      method: 'GET',
      headers: { 'x-api-key': params.serviceKey },
      cache: 'no-store',
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const root = asRecord(payload);
      const message =
        (root ? asString(root.error) : null) ??
        `Exa usage returned HTTP ${response.status}`;
      return { data: null, error: message };
    }
    const parsed = parseExaUsage(payload);
    if ('error' in parsed) {
      return { data: null, error: parsed.error };
    }
    return { data: parsed, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fetchExaUsage]', message);
    return { data: null, error: message };
  }
}
