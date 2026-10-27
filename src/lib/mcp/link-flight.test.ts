import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  mcpLinkFlightBusy,
  mcpLinkFlightFail,
  mcpLinkFlightMatches,
  mcpLinkFlightOnPending,
  mcpLinkFlightRefresh,
  mcpLinkFlightStart,
  mcpLinkFlightTimeout,
  type McpLinkFlight,
} from './link-flight';

const up: McpLinkFlight = { kind: 'up', id: 4 };
const down: McpLinkFlight = { kind: 'down', id: 4 };
const add: McpLinkFlight = { kind: 'add' };

test('the clicked link action keeps its working label through the refresh', () => {
  const request = mcpLinkFlightStart(up);
  assert.equal(mcpLinkFlightMatches(request, up), true);
  assert.equal(mcpLinkFlightMatches(request, down), false);
  assert.equal(mcpLinkFlightBusy(request, false), true);

  const refresh = mcpLinkFlightRefresh(request);
  assert.equal(mcpLinkFlightMatches(refresh, up), true);
  const waiting = mcpLinkFlightOnPending(refresh, false);
  assert.equal(mcpLinkFlightMatches(waiting, up), true);

  const seen = mcpLinkFlightOnPending(waiting, true);
  assert.equal(mcpLinkFlightMatches(seen, up), true);
  assert.equal(mcpLinkFlightOnPending(seen, true), seen);

  const done = mcpLinkFlightOnPending(seen, false);
  assert.equal(done.status, 'idle');
  assert.equal(mcpLinkFlightMatches(done, up), false);
  assert.equal(mcpLinkFlightBusy(done, false), false);
});

test('a failed link action drops the working label immediately', () => {
  const request = mcpLinkFlightStart(add);
  const failed = mcpLinkFlightFail(request);
  assert.equal(failed.status, 'idle');
  assert.equal(mcpLinkFlightMatches(failed, add), false);
});

test('a refresh that never reports pending still ends on the hold timeout', () => {
  const refresh = mcpLinkFlightRefresh(mcpLinkFlightStart({ kind: 'delete', id: 9 }));
  const stuck = mcpLinkFlightOnPending(refresh, false);
  assert.equal(mcpLinkFlightMatches(stuck, { kind: 'delete', id: 9 }), true);
  assert.equal(mcpLinkFlightTimeout(stuck).status, 'idle');
  const request = mcpLinkFlightStart(add);
  assert.equal(mcpLinkFlightTimeout(request), request);
});
