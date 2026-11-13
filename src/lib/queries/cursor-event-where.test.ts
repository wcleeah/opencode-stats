import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@libsql/client';

import { getCursorPricing, getCursorUsagePool } from '@/lib/cursor/pricing';
import { grokBotDashboardSql } from '@/lib/grok-bot/membership';

import {
  CURSOR_EVENT_AGGREGATES,
  cursorAggregateWhere,
  cursorEventWhere,
} from './cursor-event-where';

const AGGREGATE_FUNCTIONS = [
  'getCursorGlobalStats',
  'getCursorDailyUsage',
  'getCursorModelUsage',
  'getCursorAgentUsage',
  'getCursorEventCostRows',
  'getCursorDailyModelUsage',
] as const;

test('cursor pricing does not list grok bot models', () => {
  const source = readFileSync(resolve('src/lib/cursor/pricing.ts'), 'utf8');
  assert.equal(source.includes('grok-bot'), false);
  assert.equal(getCursorPricing('grok-bot-default'), null);
  assert.equal(getCursorUsagePool('grok-bot-default'), 'cursor');
});

test('each cursor aggregate where clause uses grokBotDashboardSql', () => {
  const source = readFileSync(resolve('src/lib/queries/cursor.ts'), 'utf8');
  const fragment = grokBotDashboardSql();
  assert.equal(CURSOR_EVENT_AGGREGATES.length, AGGREGATE_FUNCTIONS.length);

  for (const name of AGGREGATE_FUNCTIONS) {
    const start = source.indexOf(`export async function ${name}`);
    assert.ok(start >= 0, name);
    const next = source.indexOf('\nexport async function ', start + 1);
    const body = source.slice(start, next === -1 ? undefined : next);
    assert.match(body, /cursorAggregateWhere\(/, name);
  }

  for (const aggregate of CURSOR_EVENT_AGGREGATES) {
    const where = cursorAggregateWhere(aggregate, 0, 5_000);
    assert.equal(where.clause.includes(fragment), true, aggregate);
    assert.equal(where.clause.includes(`NOT (${fragment})`), true, aggregate);
    assert.deepEqual(where.args, [0, 5_000]);
  }

  const open = cursorEventWhere();
  assert.equal(open.clause.includes(`NOT (${fragment})`), true);
  assert.deepEqual(open.args, []);
});

test('cursor aggregate sql returns only the cursor model', async () => {
  const client = createClient({ url: 'file::memory:' });
  await client.execute(`
    CREATE TABLE cursor_usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_at INTEGER NOT NULL,
      cloud_agent_id TEXT,
      kind TEXT NOT NULL,
      model TEXT NOT NULL,
      product TEXT,
      tokens_total INTEGER NOT NULL,
      cost_raw TEXT NOT NULL
    )
  `);
  await client.execute(`
    INSERT INTO cursor_usage_events
      (event_at, cloud_agent_id, kind, model, product, tokens_total, cost_raw)
    VALUES
      (1000, 'agent-1', 'Included', 'grok-bot-default', NULL, 10, 'Included'),
      (1500, 'agent-1', 'included', 'grok-bot-default', 'cursor', 5, 'Included'),
      (2000, 'agent-1', 'Included', 'cursor-grok-4.7', NULL, 7, 'Included')
  `);

  for (const aggregate of CURSOR_EVENT_AGGREGATES) {
    const where = cursorAggregateWhere(aggregate, 0, 5_000);
    const result = await client.execute({
      sql: `SELECT model, product, COALESCE(SUM(tokens_total), 0) AS tokens_total
            FROM cursor_usage_events
            ${where.clause}
            GROUP BY model, product
            ORDER BY model`,
      args: where.args,
    });
    assert.deepEqual(
      result.rows.map((row) => ({
        model: row.model,
        product: row.product ?? null,
        tokens_total: Number(row.tokens_total),
      })),
      [
        { model: 'cursor-grok-4.7', product: null, tokens_total: 7 },
        { model: 'grok-bot-default', product: 'cursor', tokens_total: 5 },
      ],
      aggregate,
    );
  }
});
