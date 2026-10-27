import 'server-only';

import { queryAll } from '@/lib/db';
import { ensureCursorSchema } from '@/lib/cursor/schema';
import type { GrokBotLedger, GrokBotLedgerEvent } from '@/lib/grok-bot/board';
import type { GrokBotCycleClock } from '@/lib/grok-bot/cycle';
import { grokBotModelSql, normalizeGrokBotModelId } from '@/lib/grok-bot/membership';
import { priceGrokBotRow, type GrokBotPriceInput } from '@/lib/grok-bot/rates';

interface SqlEventRow {
  id: number | bigint;
  event_at: number | bigint;
  model: string;
  kind: string;
  cost_raw: string;
  reported_cost: number | bigint | null;
  tokens_input: number | bigint;
  tokens_input_cache_write: number | bigint;
  tokens_cache_read: number | bigint;
  tokens_output: number | bigint;
  tokens_total: number | bigint;
}

function asNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function asNullableNumber(value: number | bigint | null): number | null {
  if (value === null) return null;
  return asNumber(value);
}

export async function loadGrokBotLedger(
  clock: GrokBotCycleClock,
  now: Date,
): Promise<{ data: GrokBotLedger | null; error: string | null }> {
  const schema = await ensureCursorSchema();
  if (schema.error) return { data: null, error: schema.error };

  const result = await queryAll<SqlEventRow>(
    `SELECT id, event_at, model, kind, cost_raw, reported_cost,
            tokens_input, tokens_input_cache_write, tokens_cache_read,
            tokens_output, tokens_total
     FROM cursor_usage_events
     WHERE ${grokBotModelSql('model')}
     ORDER BY event_at ASC, id ASC`,
  );
  if (result.error || !result.data) {
    return { data: null, error: result.error ?? 'Failed to load Grokbot rows.' };
  }

  const events: GrokBotLedgerEvent[] = result.data.map((row) => {
    const pricedInput: GrokBotPriceInput = {
      model: row.model,
      kind: row.kind,
      costRaw: row.cost_raw,
      reportedCost: asNullableNumber(row.reported_cost),
      tokensInput: asNumber(row.tokens_input),
      tokensInputCacheWrite: asNumber(row.tokens_input_cache_write),
      tokensCacheRead: asNumber(row.tokens_cache_read),
      tokensOutput: asNumber(row.tokens_output),
    };
    return {
      id: asNumber(row.id),
      eventAt: asNumber(row.event_at),
      usageType: normalizeGrokBotModelId(row.model),
      kind: row.kind,
      tokensInput: pricedInput.tokensInput,
      tokensCacheWrite: pricedInput.tokensInputCacheWrite,
      tokensCacheRead: pricedInput.tokensCacheRead,
      tokensOutput: pricedInput.tokensOutput,
      tokensTotal: asNumber(row.tokens_total),
      priced: priceGrokBotRow(pricedInput),
    };
  });
  return { data: { clock, loadedAtMs: now.getTime(), events }, error: null };
}
