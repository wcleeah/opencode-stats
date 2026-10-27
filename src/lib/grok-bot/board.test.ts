import assert from 'node:assert/strict';
import test from 'node:test';

import { OrderedGrokBotEvents, type GrokBotLedgerEvent } from '@/lib/grok-bot/board';

function event(id: number, eventAt: number): GrokBotLedgerEvent {
  return {
    id,
    eventAt,
    usageType: 'grok-bot-default',
    kind: 'Included',
    tokensInput: 0,
    tokensCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 0,
    tokensTotal: 0,
    priced: { tokens: { ins: 0, outs: 0 }, charge: { status: 'unbilled' } },
  };
}

test('OrderedGrokBotEvents.from sorts by event time, then id', () => {
  const ordered = OrderedGrokBotEvents.from([
    event(2, 30),
    event(9, 10),
    event(4, 30),
    event(1, 10),
  ]);
  assert.deepEqual(
    ordered.slice(0, ordered.length).map((item) => item.id),
    [1, 9, 2, 4],
  );
});
