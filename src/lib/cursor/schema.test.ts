import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@libsql/client';

const source = readFileSync(resolve('src/lib/cursor/schema.ts'), 'utf8');

function cursorSettingsCreateSql(): string {
  const start = source.indexOf('CREATE TABLE IF NOT EXISTS cursor_settings');
  const end = source.indexOf('  )`,', start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 3);
}

test('cursor settings schema defaults the grok clock to wednesday 11:30', async () => {
  assert.match(source, /grok_cycle_weekday TEXT NOT NULL DEFAULT 'wednesday'/);
  assert.match(source, /grok_cycle_hour INTEGER NOT NULL DEFAULT 11/);
  assert.match(source, /grok_cycle_minute INTEGER NOT NULL DEFAULT 30/);

  const client = createClient({ url: 'file::memory:' });
  await client.execute(cursorSettingsCreateSql());
  await client.execute(
    `INSERT INTO cursor_settings (
      id, plan_amount_usd, included_pool_usd, cursor_models_included_usd,
      billing_cycle_start_day, updated_at
    ) VALUES (1, 200, 400, 2000, 1, 0)`,
  );
  const created = await client.execute(
    `SELECT grok_cycle_weekday, grok_cycle_hour, grok_cycle_minute
     FROM cursor_settings WHERE id = 1`,
  );
  assert.equal(created.rows[0].grok_cycle_weekday, 'wednesday');
  assert.equal(Number(created.rows[0].grok_cycle_hour), 11);
  assert.equal(Number(created.rows[0].grok_cycle_minute), 30);

  const legacy = createClient({ url: 'file::memory:' });
  await legacy.execute(`
    CREATE TABLE cursor_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      plan_amount_usd REAL NOT NULL DEFAULT 200,
      included_pool_usd REAL NOT NULL DEFAULT 400,
      cursor_models_included_usd REAL NOT NULL DEFAULT 2000,
      billing_cycle_start_day INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    )
  `);
  await legacy.execute(
    `INSERT INTO cursor_settings (
      id, plan_amount_usd, included_pool_usd, cursor_models_included_usd,
      billing_cycle_start_day, updated_at
    ) VALUES (1, 200, 400, 2000, 1, 0)`,
  );
  const alters = source.match(/ALTER TABLE cursor_settings ADD COLUMN grok_cycle_[^\n`]+/g);
  assert.ok(alters);
  assert.equal(alters.length, 3);
  for (const sql of alters) {
    await legacy.execute(sql);
  }
  const migrated = await legacy.execute(
    `SELECT grok_cycle_weekday, grok_cycle_hour, grok_cycle_minute
     FROM cursor_settings WHERE id = 1`,
  );
  assert.equal(migrated.rows[0].grok_cycle_weekday, 'wednesday');
  assert.equal(Number(migrated.rows[0].grok_cycle_hour), 11);
  assert.equal(Number(migrated.rows[0].grok_cycle_minute), 30);

  try {
    await legacy.execute(alters[0]);
    assert.fail('second alter should report a duplicate column');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    assert.match(message.toLowerCase(), /duplicate column/);
  }
});
