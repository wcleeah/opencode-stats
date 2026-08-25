import test from 'node:test';
import assert from 'node:assert/strict';

import type { CursorCsvEvent } from './csv';

import {
  CURSOR_EVENT_PARAM_COUNT,
  CURSOR_IMPORT_ROWS_PER_STATEMENT,
  CURSOR_IMPORT_STATEMENTS_PER_BATCH,
  buildCursorEventInsertBatches,
  buildCursorEventInsertStatement,
  cursorEventArgs,
  cursorImportHttpCallCount,
} from './insert';

function event(index: number): CursorCsvEvent {
  return {
    eventAt: 1_700_000_000_000 + index,
    cloudAgentId: index % 2 === 0 ? `agent-${index}` : null,
    automationId: null,
    kind: 'Included',
    model: 'cursor-grok-4.5-high',
    maxMode: false,
    tokensInputCacheWrite: index,
    tokensInput: index + 1,
    tokensCacheRead: index + 2,
    tokensOutput: index + 3,
    tokensTotal: index + 10,
    costRaw: 'Included',
    reportedCost: null,
    eventHash: `hash-${index}`,
  };
}

test('cursorEventArgs emits 16 bindings in column order', () => {
  const args = cursorEventArgs(event(3), 9, 42);
  assert.equal(args.length, CURSOR_EVENT_PARAM_COUNT);
  assert.equal(args[0], 'hash-3');
  assert.equal(args[1], 1_700_000_000_003);
  assert.equal(args[2], null);
  assert.equal(args[14], 9);
  assert.equal(args[15], 42);
});

test('buildCursorEventInsertStatement uses one VALUES tuple per row', () => {
  const stmt = buildCursorEventInsertStatement([event(0), event(1)], 1, 2);
  assert.equal(typeof stmt.sql, 'string');
  assert.match(
    stmt.sql,
    /VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\), \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)$/,
  );
  assert.ok(Array.isArray(stmt.args));
  assert.equal(stmt.args.length, 32);
  assert.equal(stmt.args[0], 'hash-0');
  assert.equal(stmt.args[16], 'hash-1');
});

test('buildCursorEventInsertBatches packs 2000 rows into one HTTP batch', () => {
  const rowsPerHttp =
    CURSOR_IMPORT_ROWS_PER_STATEMENT * CURSOR_IMPORT_STATEMENTS_PER_BATCH;
  assert.equal(rowsPerHttp, 2000);

  const events = Array.from({ length: 2001 }, (_, i) => event(i));
  const batches = buildCursorEventInsertBatches(events, 1, 2);

  assert.equal(batches.length, 2);
  assert.equal(batches[0]?.length, CURSOR_IMPORT_STATEMENTS_PER_BATCH);
  assert.equal(batches[1]?.length, 1);
  assert.equal(cursorImportHttpCallCount(50_000), 25);
  assert.equal(cursorImportHttpCallCount(2000), 1);
  assert.ok(cursorImportHttpCallCount(50_000) < 50);
});
