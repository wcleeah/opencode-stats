import { normalizeSecret } from '@/lib/mcp/secrets';

export interface McpEnvConfig {
  tavilyConfigured: boolean;
  tavilyApiKey: string | null;
}

export function readMcpEnvConfig(
  env: Record<string, string | undefined> = process.env,
): McpEnvConfig {
  const tavilyApiKey = normalizeSecret(env.TAVILY_API_KEY);

  return {
    tavilyConfigured: tavilyApiKey !== null,
    tavilyApiKey,
  };
}
