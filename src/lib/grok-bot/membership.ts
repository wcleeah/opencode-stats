export const GROK_BOT_MODEL_PREFIX = 'grok-bot-';

const SQL_COLUMN = /^[A-Za-z_]+$/;

export function normalizeGrokBotModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

export function isGrokBotModel(modelId: string): boolean {
  return normalizeGrokBotModelId(modelId).startsWith(GROK_BOT_MODEL_PREFIX);
}

/** Hyphens are literal in LIKE, and this prefix has no underscore, so it needs no escape. */
export function grokBotModelSql(column: string = 'model'): string {
  if (!SQL_COLUMN.test(column)) {
    throw new Error(`Unsafe SQL column: ${column}`);
  }
  return `lower(${column}) LIKE '${GROK_BOT_MODEL_PREFIX}%'`;
}
