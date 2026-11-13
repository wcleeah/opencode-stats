import type { CursorProduct } from '@/lib/cursor/usage-event';

export const GROK_BOT_HYPHEN_PREFIX = 'grok-bot-';

/** Only synthetic slug allowed for Product=grok-bot + empty Model. */
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

/**
 * Dashboard family. product='grok-bot' wins; product='cursor' never grok;
 * product=null falls back to isGrokBotModel(model).
 */
export function isGrokBotDashboardEvent(
  product: CursorProduct | null,
  model: string,
): boolean {
  if (product === 'grok-bot') return true;
  if (product === 'cursor') return false;
  return isGrokBotModel(model);
}

/**
 * SQL twin of isGrokBotDashboardEvent. Queries must use this, not a local LIKE.
 */
export function grokBotDashboardSql(): string {
  return `(COALESCE(product, '') = 'grok-bot' OR (product IS NULL AND lower(model) LIKE '${GROK_BOT_HYPHEN_PREFIX}%'))`;
}
