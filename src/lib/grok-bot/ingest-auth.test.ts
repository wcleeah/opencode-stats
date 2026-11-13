import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  GROK_BOT_INGEST_SECRET_ENV,
  GROK_BOT_PLAN_USAGE_PATH,
  authorizeGrokBotIngest,
} from '@/lib/grok-bot/ingest-auth';

function request(authorization: string | null): Request {
  const headers = new Headers();
  if (authorization !== null) headers.set('authorization', authorization);
  return new Request(`http://localhost${GROK_BOT_PLAN_USAGE_PATH}`, { headers });
}

test('plan usage route is the documented bearer path', () => {
  assert.equal(GROK_BOT_PLAN_USAGE_PATH, '/api/cursor/grok/usage');
  assert.equal(
    existsSync(resolve('src/app/api/cursor/grok/usage/route.ts')),
    true,
  );
});

test('ingest auth requires the env secret and a matching bearer token', () => {
  const missing = authorizeGrokBotIngest(request(null), {});
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.status, 503);
    assert.match(missing.error, new RegExp(GROK_BOT_INGEST_SECRET_ENV));
  }

  const env = { [GROK_BOT_INGEST_SECRET_ENV]: ' "Bearer test-secret" ' };
  const absent = authorizeGrokBotIngest(request(null), env);
  assert.equal(absent.ok, false);
  if (!absent.ok) assert.equal(absent.status, 401);

  const wrong = authorizeGrokBotIngest(request('Bearer other-secret'), env);
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.equal(wrong.error, 'Unauthorized.');

  const extra = authorizeGrokBotIngest(request('Bearer test-secret extra'), env);
  assert.equal(extra.ok, false);

  const ok = authorizeGrokBotIngest(request('bearer test-secret'), env);
  assert.equal(ok.ok, true);
});
