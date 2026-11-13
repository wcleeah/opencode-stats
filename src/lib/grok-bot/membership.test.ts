import test from 'node:test';
import assert from 'node:assert/strict';

import { createClient } from '@libsql/client';

import {
  GROK_BOT_DEFAULT_MODEL,
  GROK_BOT_HYPHEN_PREFIX,
  grokBotDashboardSql,
  grokBotModelSql,
  isGrokBotDashboardEvent,
  isGrokBotModel,
  normalizeGrokBotModelId,
} from './membership';

test('isGrokBotModel requires the grok-bot- prefix', () => {
  assert.equal(isGrokBotModel('grok-bot-default'), true);
  assert.equal(isGrokBotModel('Grok-Bot-CUA'), true);
  assert.equal(isGrokBotModel('grok-4.7'), false);
  assert.equal(isGrokBotModel('cursor-grok-4.7'), false);
  assert.equal(isGrokBotModel('grok-bot'), false);
  assert.equal(normalizeGrokBotModelId('Grok-Bot-CUA'), 'grok-bot-cua');
});

test('grokBotModelSql uses the shared prefix and rejects unsafe columns', () => {
  assert.equal(
    grokBotModelSql('model'),
    `lower(model) LIKE '${GROK_BOT_HYPHEN_PREFIX}%'`,
  );
  assert.throws(() => grokBotModelSql('model;drop'), /Unsafe SQL column/);
});

test('membership sql keeps Grok-Bot-CUA and drops grok-4.7 and grok-bot', async () => {
  const client = createClient({ url: 'file::memory:' });
  await client.execute(`
    CREATE TABLE cursor_usage_events (
      model TEXT NOT NULL
    )
  `);
  await client.execute(`
    INSERT INTO cursor_usage_events (model) VALUES
      ('Grok-Bot-CUA'),
      ('grok-4.7'),
      ('grok-bot'),
      ('cursor-grok-4.7')
  `);
  const result = await client.execute(
    `SELECT model FROM cursor_usage_events WHERE ${grokBotModelSql('model')} ORDER BY model`,
  );
  assert.deepEqual(
    result.rows.map((row) => row.model),
    ['Grok-Bot-CUA'],
  );
});

const DASHBOARD_CASES = [
  { product: null, model: GROK_BOT_DEFAULT_MODEL, grok: true },
  { product: null, model: 'cursor-grok-4.6-xhigh', grok: false },
  { product: 'cursor' as const, model: GROK_BOT_DEFAULT_MODEL, grok: false },
  { product: 'grok-bot' as const, model: GROK_BOT_DEFAULT_MODEL, grok: true },
] as const;

test('isGrokBotDashboardEvent agrees with product-first rules', () => {
  for (const row of DASHBOARD_CASES) {
    assert.equal(
      isGrokBotDashboardEvent(row.product, row.model),
      row.grok,
      `${String(row.product)}+${row.model}`,
    );
  }
});

test('grokBotDashboardSql agrees with isGrokBotDashboardEvent on representative rows', async () => {
  const client = createClient({ url: 'file::memory:' });
  await client.execute(`
    CREATE TABLE cursor_usage_events (
      product TEXT,
      model TEXT NOT NULL
    )
  `);
  for (const row of DASHBOARD_CASES) {
    await client.execute({
      sql: `INSERT INTO cursor_usage_events (product, model) VALUES (?, ?)`,
      args: [row.product, row.model],
    });
  }

  const result = await client.execute(
    `SELECT product, model FROM cursor_usage_events WHERE ${grokBotDashboardSql()} ORDER BY model`,
  );
  const grokRows = result.rows.map((r) => ({
    product: r.product ?? null,
    model: r.model,
  }));
  assert.equal(grokRows.length, 2);
  for (const row of grokRows) {
    assert.equal(isGrokBotDashboardEvent(row.product as typeof DASHBOARD_CASES[number]['product'], String(row.model)), true);
  }
});
