import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GROK_BOT_DEFAULT_MODEL } from '@/lib/grok-bot/membership';

import { hashCursorEvent, parseCursorUsageCsv } from './csv';
import { isUnbilledCursorEvent } from './unbilled';

const SAMPLE_CSV = `Date,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost
"2026-08-05T06:44:42.863Z","bc-019fc2ca-4ef7-7e58-86dd-610781f37064","","Included","cursor-grok-4.5-high-fast","No","9541","117382","1383578","13232","1523733","Included"
"2026-08-03T03:33:46.127Z","","","Errored, No Charge","cursor-grok-4.5-high","No","","","","","","Free"
`;

const BILLING_SAMPLE_CSV = `Billing Item ID,Event Time,Product,Charge Category,Usage Type,Principal Type,Principal ID,Usage,Pricing Currency,Pricing Contracted,Model,User Email
a1111111-1111-4111-8111-111111111111,2026-11-12T08:19:00.070Z,grok-bot,usage,included,user,user_test,"{""cache-write-text-tokens"":""0"",""cached-prompt-text-tokens"":""100"",""completion-text-tokens"":""20"",""prompt-text-tokens"":""30""}",USD,0.0000000000,,ignored@example.com
b2222222-2222-4222-8222-222222222222,2026-11-12T08:57:33.060Z,cursor,usage,included,user,user_test,"{""cache-write-text-tokens"":""0"",""cached-prompt-text-tokens"":""47104"",""completion-text-tokens"":""2022"",""prompt-text-tokens"":""9038""}",USD,0.0000000000,cursor-grok-4.6-xhigh,ignored@example.com
c3333333-3333-4333-8333-333333333333,2026-11-12T09:00:00.000Z,grok-bot,usage,included,user,user_test,{},USD,0.0000000000,,ignored@example.com
`;

test('parseCursorUsageCsv parses included and errored rows', () => {
  const result = parseCursorUsageCsv(SAMPLE_CSV);
  assert.equal(result.errors.length, 0);
  assert.equal(result.events.length, 2);

  const [included, errored] = result.events;
  assert.equal(included.model, 'cursor-grok-4.5-high-fast');
  assert.equal(included.product, null);
  assert.equal(included.cloudAgentId, 'bc-019fc2ca-4ef7-7e58-86dd-610781f37064');
  assert.equal(included.tokensInput, 117382);
  assert.equal(included.tokensInputCacheWrite, 9541);
  assert.equal(included.tokensTotal, 1_523_733);
  assert.equal(included.reportedCost, null);
  assert.equal(included.maxMode, false);

  assert.equal(errored.kind, 'Errored, No Charge');
  assert.equal(errored.cloudAgentId, null);
  assert.equal(errored.tokensTotal, 0);
  assert.equal(errored.costRaw, 'Free');
  assert.equal(errored.product, null);
});

test('legacy SAMPLE_CSV hashes match hashCursorEvent', () => {
  const result = parseCursorUsageCsv(SAMPLE_CSV);
  const included = result.events[0];
  assert.ok(included);
  const expected = hashCursorEvent({
    eventAtIso: '2026-08-05T06:44:42.863Z',
    cloudAgentId: 'bc-019fc2ca-4ef7-7e58-86dd-610781f37064',
    automationId: '',
    kind: 'Included',
    model: 'cursor-grok-4.5-high-fast',
    maxMode: 'No',
    tokensInputCacheWrite: '9541',
    tokensInput: '117382',
    tokensCacheRead: '1383578',
    tokensOutput: '13232',
    tokensTotal: '1523733',
    costRaw: 'Included',
  });
  assert.equal(included.eventHash, expected);
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

test('isUnbilledCursorEvent treats errored and free rows as unbilled', () => {
  assert.equal(isUnbilledCursorEvent('Included', 'Included'), false);
  assert.equal(isUnbilledCursorEvent('Errored, No Charge', 'Free'), true);
  assert.equal(isUnbilledCursorEvent('free', '0.71'), true);
  assert.equal(isUnbilledCursorEvent('Included', 'Free'), true);
});

test('parseCursorUsageCsv stores component sum when Total Tokens disagrees', () => {
  const csv = `Date,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost
"2026-08-05T06:44:42.863Z","","","Included","composer-2.5","No","10","20","30","40","999","Included"
`;
  const result = parseCursorUsageCsv(csv);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]?.tokensTotal, 100);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0] ?? '', /component sum 100/);
});

test('parseCursorUsageCsv parses billing-items unified export rows', () => {
  const result = parseCursorUsageCsv(BILLING_SAMPLE_CSV);
  assert.equal(result.errors.length, 0);
  assert.equal(result.events.length, 3);

  const grok = result.events[0];
  assert.equal(grok.product, 'grok-bot');
  assert.equal(grok.model, GROK_BOT_DEFAULT_MODEL);
  assert.equal(grok.kind, 'included');
  assert.equal(grok.costRaw, 'Included');
  assert.equal(grok.reportedCost, null);
  assert.equal(grok.tokensInput, 30);
  assert.equal(grok.tokensCacheRead, 100);
  assert.equal(grok.tokensOutput, 20);
  assert.equal(grok.tokensTotal, 150);
  assert.equal(
    grok.eventHash,
    createHash('sha256').update('billing-item-id\0a1111111-1111-4111-8111-111111111111').digest('hex'),
  );

  const cursor = result.events[1];
  assert.equal(cursor.product, 'cursor');
  assert.equal(cursor.model, 'cursor-grok-4.6-xhigh');
  assert.equal(cursor.kind, 'included');
  assert.equal(cursor.costRaw, 'Included');
  assert.equal(cursor.reportedCost, null);
  assert.equal(cursor.tokensTotal, 58_164);

  const emptyUsage = result.events[2];
  assert.equal(emptyUsage.product, 'grok-bot');
  assert.equal(emptyUsage.model, GROK_BOT_DEFAULT_MODEL);
  assert.equal(emptyUsage.tokensTotal, 0);
  assert.equal(emptyUsage.tokensInput, 0);

  const reparsed = parseCursorUsageCsv(BILLING_SAMPLE_CSV);
  assert.deepEqual(
    reparsed.events.map((e) => e.eventHash),
    result.events.map((e) => e.eventHash),
  );
});

test('parseCursorUsageCsv handles attached sample export', () => {
  const path = resolve(
    '/home/ubuntu/.cursor/projects/workspace/uploads/usage-events-2026-08-05_6b1c.csv',
  );
  let csv: string;
  try {
    csv = readFileSync(path, 'utf8');
  } catch {
    return;
  }

  const result = parseCursorUsageCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.ok(result.events.length >= 500);
  assert.ok(result.minEventAt !== null);
  assert.ok(result.maxEventAt !== null);
  assert.ok((result.maxEventAt ?? 0) >= (result.minEventAt ?? 0));
});

test('parseCursorUsageCsv parses local personal-unified-usage export', () => {
  const path = '/Users/leewingcheung/Downloads/personal-unified-usage-2026-11-12.csv';
  let csv: string;
  try {
    csv = readFileSync(path, 'utf8');
  } catch {
    return;
  }

  const result = parseCursorUsageCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.events.length, 37653);
  assert.ok(result.events.some((e) => e.product === 'grok-bot'));
  assert.ok(result.events.some((e) => e.product === 'cursor'));
  assert.ok(result.minEventAt !== null && Number.isFinite(result.minEventAt));
  assert.ok(result.maxEventAt !== null && Number.isFinite(result.maxEventAt));
});
