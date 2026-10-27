import test from 'node:test';
import assert from 'node:assert/strict';

import { grokBotPeriodCaption } from './caption';
import { setGrokBotPeriodName, type GrokBotPeriodName } from './period-name';

function periodName(text: string): GrokBotPeriodName {
  const edited = setGrokBotPeriodName([], 1, text);
  assert.equal(edited.ok, true);
  if (!edited.ok) throw new Error('expected a name');
  const name = edited.names[0]?.name;
  assert.equal(typeof name, 'string');
  if (name === undefined) throw new Error('expected a name');
  return name;
}

test('an unnamed period with a unique date returns the short date', () => {
  const period = {
    shortLabel: 'Wed 14 Oct 2026',
    label: 'Wed 14 Oct 2026 11:30 to Wed 21 Oct 2026 11:29',
  };
  assert.equal(grokBotPeriodCaption(period, [period]), 'Wed 14 Oct 2026');
});

test('two unnamed periods that share a date return the start clock', () => {
  const morning = {
    shortLabel: 'Wed 14 Oct 2026',
    label: 'Wed 14 Oct 2026 11:30 to Wed 21 Oct 2026 11:29',
  };
  const afternoon = {
    shortLabel: 'Wed 14 Oct 2026',
    label: 'Wed 14 Oct 2026 15:00 to Wed 21 Oct 2026 14:59',
  };
  const periods = [morning, afternoon];
  assert.equal(grokBotPeriodCaption(morning, periods), 'Wed 14 Oct 2026 11:30');
  assert.equal(grokBotPeriodCaption(afternoon, periods), 'Wed 14 Oct 2026 15:00');
});

test('a named period returns the stored name', () => {
  const name = periodName('Launch');
  const period = {
    shortLabel: 'Wed 14 Oct 2026',
    label: 'Wed 14 Oct 2026 11:30 to Wed 21 Oct 2026 11:29',
    name,
  };
  assert.equal(grokBotPeriodCaption(period, [period]), 'Launch');
  assert.equal(period.name, 'Launch');
});

test('two periods with the same name show the name plus the clock', () => {
  const name = periodName('Launch');
  const first = {
    shortLabel: 'Wed 14 Oct 2026',
    label: 'Wed 14 Oct 2026 11:30 to Wed 21 Oct 2026 11:29',
    name,
  };
  const second = {
    shortLabel: 'Wed 21 Oct 2026',
    label: 'Wed 21 Oct 2026 11:30 to Wed 28 Oct 2026 11:29',
    name,
  };
  const periods = [first, second];
  assert.equal(grokBotPeriodCaption(first, periods), 'Launch · Wed 14 Oct 2026 11:30');
  assert.equal(grokBotPeriodCaption(second, periods), 'Launch · Wed 21 Oct 2026 11:30');
  assert.equal(first.name, 'Launch');
  assert.equal(second.name, 'Launch');
});

test('a resolved string that is already the start clock does not gain a suffix', () => {
  const clock = 'Wed 14 Oct 2026 11:30';
  const name = periodName(clock);
  const first = {
    shortLabel: 'Wed 14 Oct 2026',
    label: `${clock} to Wed 21 Oct 2026 11:29`,
    name,
  };
  const second = {
    shortLabel: 'Wed 21 Oct 2026',
    label: 'Wed 21 Oct 2026 11:30 to Wed 28 Oct 2026 11:29',
    name,
  };
  const periods = [first, second];
  assert.equal(grokBotPeriodCaption(first, periods), clock);
  assert.equal(grokBotPeriodCaption(second, periods), `${clock} · Wed 21 Oct 2026 11:30`);
  assert.equal(first.name, clock);
  assert.equal(second.name, clock);
});
