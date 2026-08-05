import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { hashCursorEvent, parseCursorUsageCsv } from './csv';

const SAMPLE_CSV = `Date,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost
"2026-08-05T06:44:42.863Z","bc-019fc2ca-4ef7-7e58-86dd-610781f37064","","Included","cursor-grok-4.5-high-fast","No","9541","117382","1383578","13232","1523733","Included"
"2026-08-03T03:33:46.127Z","","","Errored, No Charge","cursor-grok-4.5-high","No","","","","","","Free"
`;

test('parseCursorUsageCsv parses included and errored rows', () => {
  const result = parseCursorUsageCsv(SAMPLE_CSV);
  assert.equal(result.errors.length, 0);
  assert.equal(result.events.length, 2);

  const [included, errored] = result.events;
  assert.equal(included.model, 'cursor-grok-4.5-high-fast');
  assert.equal(included.cloudAgentId, 'bc-019fc2ca-4ef7-7e58-86dd-610781f37064');
  assert.equal(included.tokensInput, 117382);
  assert.equal(included.tokensInputCacheWrite, 9541);
  assert.equal(included.reportedCost, null);
  assert.equal(included.maxMode, false);

  assert.equal(errored.kind, 'Errored, No Charge');
  assert.equal(errored.cloudAgentId, null);
  assert.equal(errored.tokensTotal, 0);
  assert.equal(errored.costRaw, 'Free');
});

test('parseCursorUsageCsv rejects missing headers', () => {
  const result = parseCursorUsageCsv('Date,Model\n"2026-08-05T00:00:00.000Z","x"');
  assert.equal(result.events.length, 0);
  assert.match(result.errors[0] ?? '', /Missing required columns/);
});

test('hashCursorEvent is stable for identical rows', () => {
  const a = hashCursorEvent({
    eventAtIso: '2026-08-05T06:44:42.863Z',
    cloudAgentId: 'bc-1',
    automationId: '',
    kind: 'Included',
    model: 'cursor-grok-4.5-high-fast',
    maxMode: 'No',
    tokensInputCacheWrite: '1',
    tokensInput: '2',
    tokensCacheRead: '3',
    tokensOutput: '4',
    tokensTotal: '10',
    costRaw: 'Included',
  });
  const b = hashCursorEvent({
    eventAtIso: '2026-08-05T06:44:42.863Z',
    cloudAgentId: 'bc-1',
    automationId: '',
    kind: 'Included',
    model: 'cursor-grok-4.5-high-fast',
    maxMode: 'No',
    tokensInputCacheWrite: '1',
    tokensInput: '2',
    tokensCacheRead: '3',
    tokensOutput: '4',
    tokensTotal: '10',
    costRaw: 'Included',
  });
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test('parseCursorUsageCsv handles attached sample export', () => {
  const path = resolve(
    '/home/ubuntu/.cursor/projects/workspace/uploads/usage-events-2026-08-05_6b1c.csv',
  );
  let csv: string;
  try {
    csv = readFileSync(path, 'utf8');
  } catch {
    // Sample may be absent outside the agent environment.
    return;
  }

  const result = parseCursorUsageCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.ok(result.events.length >= 500);
  assert.ok(result.minEventAt !== null);
  assert.ok(result.maxEventAt !== null);
  assert.ok((result.maxEventAt ?? 0) >= (result.minEventAt ?? 0));
});
