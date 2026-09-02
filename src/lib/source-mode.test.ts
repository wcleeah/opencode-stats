import test from 'node:test';
import assert from 'node:assert/strict';

import { parseStatsSource, sourceBrandLabel, sourceHome } from './source-mode';

test('parseStatsSource recognizes mcp', () => {
  assert.equal(parseStatsSource('mcp'), 'mcp');
  assert.equal(parseStatsSource('cursor'), 'cursor');
  assert.equal(parseStatsSource('opencode'), 'opencode');
  assert.equal(parseStatsSource(undefined), 'opencode');
  assert.equal(sourceHome('mcp'), '/mcp');
  assert.equal(sourceBrandLabel('mcp'), 'MCP Credits');
});
