import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeSecret } from '@/lib/mcp/secrets';

test('normalizeSecret trims, unwraps quotes, and strips Bearer', () => {
  assert.equal(normalizeSecret(undefined), null);
  assert.equal(normalizeSecret(''), null);
  assert.equal(normalizeSecret('   '), null);
  assert.equal(normalizeSecret('  abc  '), 'abc');
  assert.equal(normalizeSecret('"exa-secret"'), 'exa-secret');
  assert.equal(normalizeSecret("'exa-secret'"), 'exa-secret');
  assert.equal(normalizeSecret('Bearer exa-secret'), 'exa-secret');
  assert.equal(normalizeSecret('bearer  exa-secret'), 'exa-secret');
  assert.equal(normalizeSecret('"Bearer exa-secret"'), 'exa-secret');
});
