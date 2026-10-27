import test from 'node:test';
import assert from 'node:assert/strict';

import { setGrokBotPeriodName, type GrokBotPeriodName } from './period-name';
import { grokBotPeriodTitle } from './period-title';

function periodName(text: string): GrokBotPeriodName {
  const edited = setGrokBotPeriodName([], 1, text);
  assert.equal(edited.ok, true);
  if (!edited.ok) throw new Error('expected a name');
  const name = edited.names[0]?.name;
  assert.equal(typeof name, 'string');
  if (name === undefined) throw new Error('expected a name');
  return name;
}

test('an unnamed index 0 is Period and a later unnamed period is numbered', () => {
  const periods = [{}, {}];
  assert.equal(grokBotPeriodTitle(0, periods), 'Period');
  assert.equal(grokBotPeriodTitle(1, periods), 'Period 2');
});

test('a stored name stays that name', () => {
  const name = periodName('Launch');
  assert.equal(grokBotPeriodTitle(0, [{ name }]), 'Launch');
});

test('two stored names that match gain the period number', () => {
  const name = periodName('Launch');
  const periods = [{ name }, { name }];
  assert.equal(grokBotPeriodTitle(0, periods), 'Launch · 1');
  assert.equal(grokBotPeriodTitle(1, periods), 'Launch · 2');
});

test('a stored name that matches another period fallback gains the same suffix', () => {
  const name = periodName('Period');
  const periods = [{}, { name }];
  assert.equal(grokBotPeriodTitle(0, periods), 'Period · 1');
  assert.equal(grokBotPeriodTitle(1, periods), 'Period · 2');

  const fallback = periodName('Period 2');
  const mixed = [{ name: fallback }, {}];
  assert.equal(grokBotPeriodTitle(0, mixed), 'Period 2 · 1');
  assert.equal(grokBotPeriodTitle(1, mixed), 'Period 2 · 2');
});

test('only the periods that share a base gain a suffix', () => {
  const name = periodName('Launch');
  const periods = [{ name }, {}, { name }];
  assert.equal(grokBotPeriodTitle(0, periods), 'Launch · 1');
  assert.equal(grokBotPeriodTitle(1, periods), 'Period 2');
  assert.equal(grokBotPeriodTitle(2, periods), 'Launch · 3');
});
