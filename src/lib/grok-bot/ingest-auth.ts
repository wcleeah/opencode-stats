import { createHash, timingSafeEqual } from 'node:crypto';

import { normalizeSecret } from '@/lib/mcp/secrets';

export const GROK_BOT_INGEST_SECRET_ENV = 'GROK_BOT_INGEST_SECRET';

export const GROK_BOT_PLAN_USAGE_PATH = '/api/cursor/grok/usage';

const MAX_BEARER_LENGTH = 512;

export interface GrokBotIngestAuthOk {
  ok: true;
}

export interface GrokBotIngestAuthFailure {
  ok: false;
  status: 401 | 503;
  error: string;
}

export function grokBotIngestSecret(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  return normalizeSecret(env[GROK_BOT_INGEST_SECRET_ENV]);
}

export function authorizeGrokBotIngest(
  request: Request,
  env: Readonly<Record<string, string | undefined>> = process.env,
): GrokBotIngestAuthOk | GrokBotIngestAuthFailure {
  const secret = grokBotIngestSecret(env);
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: `${GROK_BOT_INGEST_SECRET_ENV} is not set.`,
    };
  }

  const provided = bearerToken(request.headers.get('authorization'));
  if (!provided || !secretsMatch(secret, provided)) {
    return { ok: false, status: 401, error: 'Unauthorized.' };
  }
  return { ok: true };
}

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  const token = match?.[1] ?? null;
  if (!token || token.length > MAX_BEARER_LENGTH) return null;
  return token;
}

function secretsMatch(expected: string, provided: string): boolean {
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(provided).digest();
  return timingSafeEqual(a, b);
}
