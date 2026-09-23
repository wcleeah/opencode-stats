import test from 'node:test';
import assert from 'node:assert/strict';

import { parseStatsSource, sourceBrandLabel, sourceHome } from './source-mode';

test('parseStatsSource recognizes saas and legacy mcp', () => {
  assert.equal(parseStatsSource('saas'), 'saas');
  assert.equal(parseStatsSource('mcp'), 'saas');
  assert.equal(parseStatsSource('cursor'), 'cursor');
  assert.equal(parseStatsSource('opencode'), 'opencode');
  assert.equal(parseStatsSource(undefined), 'saas');
  assert.equal(parseStatsSource(null), 'saas');
  assert.equal(sourceHome('saas'), '/saas');
  assert.equal(sourceHome('opencode'), '/opencode');
  assert.equal(sourceHome('cursor'), '/cursor');
  assert.equal(sourceBrandLabel('saas'), 'SaaS Stats');
});
