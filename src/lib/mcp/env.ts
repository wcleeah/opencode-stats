export interface McpEnvConfig {
  tavilyConfigured: boolean;
  exaConfigured: boolean;
  tavilyApiKey: string | null;
  exaServiceKey: string | null;
  exaApiKeyId: string | null;
}

function trimEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readMcpEnvConfig(
  env: Record<string, string | undefined> = process.env,
): McpEnvConfig {
  const tavilyApiKey = trimEnv(env.TAVILY_API_KEY);
  const exaServiceKey = trimEnv(env.EXA_API_KEY) ?? trimEnv(env.EXA_SERVICE_KEY);
  const exaApiKeyId = trimEnv(env.EXA_API_KEY_ID);

  return {
    tavilyConfigured: tavilyApiKey !== null,
    exaConfigured: exaServiceKey !== null,
    tavilyApiKey,
    exaServiceKey,
    exaApiKeyId,
  };
}
