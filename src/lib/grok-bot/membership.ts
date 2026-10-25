/** Trailing hyphen keeps `grok-4.7` and `cursor-grok-4.7` on the agent board. */
export const GROK_BOT_MODEL_PREFIX = 'grok-bot-';

const SQL_COLUMN = /^[A-Za-z_]+$/;

export function normalizeGrokBotModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

/** True for `grok-bot-default` and `Grok-Bot-CUA`. False for `grok-4.7` and `grok-bot`. */
export function isGrokBotModel(modelId: string): boolean {
  return normalizeGrokBotModelId(modelId).startsWith(GROK_BOT_MODEL_PREFIX);
}

/**
 * SQL membership test for a trusted column name.
 * Hyphens are literal in LIKE, and this prefix has no underscore, so it needs no escape.
 */
export function grokBotModelSql(column: string = 'model'): string {
  if (!SQL_COLUMN.test(column)) {
    throw new Error(`Unsafe SQL column: ${column}`);
  }
  return `lower(${column}) LIKE '${GROK_BOT_MODEL_PREFIX}%'`;
}
