import { normalizeSecret } from '@/lib/mcp/secrets';

export const CURSOR_AGENTS_API_URL = 'https://api.cursor.com/v1/agents';

export const DEFAULT_CURSOR_AGENT_REPO_URL = 'https://github.com/wcleeah/opencode-stats';
export const DEFAULT_CURSOR_AGENT_STARTING_REF = 'main';

export const UPDATE_PRICING_AGENT_NAME = 'Update Cursor pricing map';

export const UPDATE_PRICING_PROMPT = [
  'Update cursor pricing map.',
  '',
  'Read CURSOR-PRICING.md before editing src/lib/cursor/pricing.ts.',
  'Sync list rates, aliases, usage pools, and dated cutoffs with the current',
  'Cursor Models & Pricing docs: https://cursor.com/docs/models-and-pricing',
  '',
  'Follow the CURSOR-PRICING.md checklist. Keep historical rates with sourced',
  'UTC-midnight cutoffs. Do not mix Fast vs standard rates. Update',
  'SAMPLE_CSV_MODELS and tests. Open a PR when done.',
].join('\n');

export interface CursorAgentEnv {
  apiKey: string | null;
  repoUrl: string;
  startingRef: string;
  configured: boolean;
}

export interface LaunchedCursorAgent {
  agentId: string;
  agentUrl: string;
  runId: string | null;
}

export type LaunchPricingAgentResult =
  | { ok: true; agent: LaunchedCursorAgent }
  | { ok: false; error: string; status: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeGithubRepoUrl(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let href = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    href = `https://${href}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.hostname !== 'github.com') return null;

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!owner || !repo) return null;

  return `https://github.com/${owner}/${repo}`;
}

export function readCursorAgentEnv(
  env: Record<string, string | undefined> = process.env,
): CursorAgentEnv {
  const apiKey = normalizeSecret(env.CURSOR_API_KEY);
  const repoUrl =
    normalizeGithubRepoUrl(env.CURSOR_AGENT_REPO_URL) ?? DEFAULT_CURSOR_AGENT_REPO_URL;
  const startingRef = env.CURSOR_AGENT_STARTING_REF?.trim() || DEFAULT_CURSOR_AGENT_STARTING_REF;

  return {
    apiKey,
    repoUrl,
    startingRef,
    configured: apiKey !== null,
  };
}

export function cursorAgentUrl(agentId: string): string {
  return `https://cursor.com/agents/${agentId}`;
}

function extractCursorApiError(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }

  if (isRecord(payload.error)) {
    const nested = payload.error;
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nested.message.trim();
    }
    if (typeof nested.code === 'string' && nested.code.trim()) {
      return nested.code.trim();
    }
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  return fallback;
}

export function parseCreateAgentResponse(
  payload: unknown,
): LaunchedCursorAgent | { error: string } {
  if (!isRecord(payload)) {
    return { error: 'Cursor API returned a non-object response.' };
  }

  const agent = isRecord(payload.agent) ? payload.agent : payload;
  const id = typeof agent.id === 'string' ? agent.id.trim() : '';
  if (!id) {
    return { error: 'Cursor API response is missing agent.id.' };
  }

  const url =
    typeof agent.url === 'string' && agent.url.trim()
      ? agent.url.trim()
      : cursorAgentUrl(id);

  const run = isRecord(payload.run) ? payload.run : null;
  const runId =
    run && typeof run.id === 'string' && run.id.trim() ? run.id.trim() : null;

  return { agentId: id, agentUrl: url, runId };
}

export function buildUpdatePricingAgentBody(env: CursorAgentEnv): {
  prompt: { text: string };
  name: string;
  repos: Array<{ url: string; startingRef: string }>;
  autoCreatePR: true;
} {
  return {
    prompt: { text: UPDATE_PRICING_PROMPT },
    name: UPDATE_PRICING_AGENT_NAME,
    repos: [{ url: env.repoUrl, startingRef: env.startingRef }],
    autoCreatePR: true,
  };
}

export async function launchPricingAgent(
  env: CursorAgentEnv = readCursorAgentEnv(),
  fetcher: typeof fetch = fetch,
): Promise<LaunchPricingAgentResult> {
  if (!env.configured || !env.apiKey) {
    return {
      ok: false,
      status: 503,
      error:
        'CURSOR_API_KEY is not set. Add a Cursor API key from Dashboard → API Keys.',
    };
  }

  let response: Response;
  try {
    response = await fetcher(CURSOR_AGENTS_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildUpdatePricingAgentBody(env)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cursor.launchPricingAgent] network', message);
    return { ok: false, status: 502, error: `Failed to reach Cursor API: ${message}` };
  }

  let payload: unknown = null;
  const raw = await response.text();
  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = { error: raw.slice(0, 300) };
    }
  }

  if (!response.ok) {
    const error = extractCursorApiError(
      payload,
      `Cursor API returned HTTP ${response.status}.`,
    );
    console.error('[cursor.launchPricingAgent]', response.status, error);
    return { ok: false, status: response.status >= 400 ? response.status : 502, error };
  }

  const parsed = parseCreateAgentResponse(payload);
  if ('error' in parsed) {
    return { ok: false, status: 502, error: parsed.error };
  }

  return { ok: true, agent: parsed };
}
