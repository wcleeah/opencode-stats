import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeHttpUrl, parseMcpLinkInput } from './links';

test('normalizeHttpUrl accepts http(s) and fills https', () => {
  assert.equal(normalizeHttpUrl('https://dashboard.exa.ai/'), 'https://dashboard.exa.ai/');
  assert.equal(normalizeHttpUrl('  dashboard.exa.ai  '), 'https://dashboard.exa.ai/');
  assert.equal(normalizeHttpUrl('http://example.com/path?q=1'), 'http://example.com/path?q=1');
});

test('normalizeHttpUrl rejects non-http schemes and credentials', () => {
  assert.equal(normalizeHttpUrl(''), null);
  assert.equal(normalizeHttpUrl('javascript:alert(1)'), null);
  assert.equal(normalizeHttpUrl('ftp://files.example.com'), null);
  assert.equal(normalizeHttpUrl('https://user:pass@example.com'), null);
});

test('parseMcpLinkInput validates name and url', () => {
  const ok = parseMcpLinkInput({ name: ' Exa ', url: 'dashboard.exa.ai' });
  assert.deepEqual(ok, {
    name: 'Exa',
    url: 'https://dashboard.exa.ai/',
    sortOrder: null,
  });

  const missingName = parseMcpLinkInput({ url: 'https://tavily.com' });
  assert.ok('error' in missingName);

  const badUrl = parseMcpLinkInput({ name: 'Nope', url: 'not a url' });
  assert.ok('error' in badUrl);

  const withOrder = parseMcpLinkInput({
    name: 'Tavily',
    url: 'https://app.tavily.com',
    sortOrder: 2,
  });
  assert.ok(!('error' in withOrder));
  if ('error' in withOrder) return;
  assert.equal(withOrder.sortOrder, 2);
});
