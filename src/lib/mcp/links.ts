export const MCP_LINK_NAME_MAX = 80;
export const MCP_LINK_URL_MAX = 2048;

export interface ParsedMcpLinkInput {
  name: string;
  url: string;
  sortOrder: number | null;
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MCP_LINK_URL_MAX) return null;

  const withProtocol = HAS_SCHEME.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (!parsed.hostname) return null;
  if (parsed.href.length > MCP_LINK_URL_MAX) return null;
  return parsed.href;
}

export function parseMcpLinkName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > MCP_LINK_NAME_MAX) return null;
  return name;
}

export function parseMcpLinkInput(body: unknown): ParsedMcpLinkInput | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid JSON body.' };
  }

  const record = body as Record<string, unknown>;
  const name = parseMcpLinkName(record.name);
  if (name === null) {
    return {
      error: `Name is required and must be 1–${MCP_LINK_NAME_MAX} characters.`,
    };
  }

  if (typeof record.url !== 'string') {
    return { error: 'URL is required.' };
  }
  const url = normalizeHttpUrl(record.url);
  if (url === null) {
    return { error: 'URL must be a valid http or https address.' };
  }

  let sortOrder: number | null = null;
  if (record.sortOrder !== undefined && record.sortOrder !== null) {
    const n = typeof record.sortOrder === 'number'
      ? record.sortOrder
      : Number(record.sortOrder);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      return { error: 'sortOrder must be an integer >= 0.' };
    }
    sortOrder = n;
  }

  return { name, url, sortOrder };
}
