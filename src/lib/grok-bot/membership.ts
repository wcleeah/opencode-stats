import type { CursorProduct } from '@/lib/cursor/usage-event';

export const GROK_BOT_HYPHEN_PREFIX = 'grok-bot-';

export const GROK_BOT_DEFAULT_MODEL = 'grok-bot-default';

const SQL_COLUMN = /^[A-Za-z_]+$/;

export function normalizeGrokBotModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

export function isGrokBotModel(modelId: string): boolean {
  return normalizeGrokBotModelId(modelId).startsWith(GROK_BOT_HYPHEN_PREFIX);
}

/** Hyphens are literal in LIKE, and this prefix has no underscore, so it needs no escape. */
export function grokBotModelSql(column: string = 'model'): string {
  if (!SQL_COLUMN.test(column)) {
    throw new Error(`Unsafe SQL column: ${column}`);
  }
  return `lower(${column}) LIKE '${GROK_BOT_HYPHEN_PREFIX}%'`;
}

export function isGrokBotDashboardEvent(
  product: CursorProduct | null,
  model: string,
): boolean {
  if (product === 'grok-bot') return true;
  if (product === 'cursor') return false;
  return isGrokBotModel(model);
}

export function grokBotDashboardSql(): string {
  // COALESCE keeps NULL product from making `product = 'grok-bot'` UNKNOWN,
  // which would drop legacy cursor rows from `NOT (grokBotDashboardSql())`.
  return `(COALESCE(product, '') = 'grok-bot' OR (product IS NULL AND lower(model) LIKE '${GROK_BOT_HYPHEN_PREFIX}%'))`;
}
