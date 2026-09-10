import { normalizeSecret } from '@/lib/mcp/secrets';

export interface McpEnvConfig {
  tavilyConfigured: boolean;
  exaConfigured: boolean;
  tavilyApiKey: string | null;
  exaServiceKey: string | null;
  exaApiKeyId: string | null;
}

export function readMcpEnvConfig(
  env: Record<string, string | undefined> = process.env,
): McpEnvConfig {
  const tavilyApiKey = normalizeSecret(env.TAVILY_API_KEY);
  const exaServiceKey =
    normalizeSecret(env.EXA_API_KEY) ?? normalizeSecret(env.EXA_SERVICE_KEY);
  const exaApiKeyId = normalizeSecret(env.EXA_API_KEY_ID);

  return {
    tavilyConfigured: tavilyApiKey !== null,
    exaConfigured: exaServiceKey !== null,
    tavilyApiKey,
    exaServiceKey,
    exaApiKeyId,
  };
}
