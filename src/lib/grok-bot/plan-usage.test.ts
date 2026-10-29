import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  formatOnDemand,
  formatSharePct,
  grokBotPlanCaptureHref,
  grokBotPlanUsagePayload,
  parseGrokBotPlanCapture,
  parseGrokBotPlanUsage,
  presentGrokBotPlanUsage,
  shareBarWidth,
  type GrokBotPlanUsage,
  type PresentedShareRow,
} from '@/lib/grok-bot/plan-usage';

function loadSample(): unknown {
  return JSON.parse(readFileSync(
    resolve('src/lib/grok-bot/fixtures/plan-usage-sample.json'),
    'utf8',
  )) as unknown;
}

function requireUsage(input: unknown): GrokBotPlanUsage {
  const parsed = parseGrokBotPlanUsage(input);
  assert.equal(parsed.error, null);
  assert.ok(parsed.data);
  return parsed.data;
}

function fail(input: unknown, pattern: RegExp): void {
  const parsed = parseGrokBotPlanUsage(input);
  assert.equal(parsed.data, null);
  assert.match(parsed.error ?? '', pattern);
}

function minimal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    captured_at: '2026-10-30T00:50:00+08:00',
    source: 'grok_bot_check_subscription_usage',
    plan: 'Cursor Ultra',
    weekly_usage_percent_used: 21.6,
    reset_at: {
      timezone: 'Asia/Hong_Kong',
      label: 'Wednesday, Nov 4 at 11:01',
      iso_approx: '2026-11-04T11:01:00+08:00',
    },
    on_demand: { monthly_limit: null, amount: null },
    reports: [],
    ...overrides,
  };
}

function rowNamed(rows: readonly PresentedShareRow[], title: string): PresentedShareRow {
  const found = rows.find((row) => row.title === title);
  assert.ok(found, title);
  return found;
}

function collectKeys(value: unknown, found: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, found);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      found.push(key);
      collectKeys(child, found);
    }
  }
}

test('sample plan usage round-trips and renders share percents', () => {
  const sample = loadSample();
  const usage = requireUsage(sample);
  assert.deepEqual(grokBotPlanUsagePayload(usage), sample);

  const presented = presentGrokBotPlanUsage(usage);
  assert.equal(presented.plan, 'Cursor Ultra');
  assert.equal(presented.source, 'grok_bot_check_subscription_usage');
  assert.equal(presented.capturedAt, '2026-10-30T00:50:00+08:00');
  assert.equal(presented.weeklyLabel, '21.6%');
  assert.equal(presented.weeklyWarn, false);
  assert.equal(presented.resetLabel, 'Wednesday, Nov 4 at 11:01');
  assert.equal(presented.resetDetail, 'Asia/Hong_Kong · 2026-11-04T11:01:00+08:00');
  assert.equal(presented.onDemandValue, '—');
  assert.equal(presented.onDemandDetail, 'Amount / monthly limit');

  assert.equal(presented.reports.length, 3);
  assert.equal(
    presented.reports.some((report) => report.title === 'Deleted routines'),
    false,
  );
  assert.equal(
    presented.reports.some((report) => report.breakdownLabel.includes('deleted')),
    false,
  );

  const bots = presented.reports[0];
  assert.equal(bots.breakdownLabel, 'bot / routine');
  assert.equal(bots.title, 'Oct 28 – Oct 29, UTC');
  const meovv = rowNamed(bots.rows, 'Meovv · cool girl');
  assert.equal(meovv.shareLabel, '39%');
  assert.equal(meovv.barPct, 39);
  assert.equal(rowNamed(meovv.children, 'Deleted routines').shareLabel, '18%');
  assert.equal(rowNamed(meovv.children, 'Not from a routine').shareLabel, '17%');
  const paused = rowNamed(meovv.children, 'meovv-search');
  assert.equal(paused.paused, true);
  assert.equal(paused.shareLabel, '2%');

  const egg = rowNamed(bots.rows, 'dr eggbot');
  const health = rowNamed(egg.children, 'transcript-healthcheck');
  assert.equal(health.shareLabel, '0.5%');
  assert.equal(health.barPct, 2);
  assert.equal(health.note, '<1%');
  assert.equal(health.cadence, '≈ 7 / week');
  assert.ok(bots.rows.some(
    (row) => row.title === "Deleted bots, group chats and other people's bots",
  ));

  const activity = presented.reports[1];
  assert.equal(activity.breakdownLabel, 'activity / bot');
  const chats = rowNamed(activity.rows, 'Chats with the user');
  assert.equal(chats.detail, 'chats');
  assert.equal(chats.shareLabel, '47%');
  assert.equal(rowNamed(activity.rows, 'Bot-to-Bot').children.length, 0);

  const days = presented.reports[2];
  assert.equal(days.breakdownLabel, 'day / bot');
  const thursday = rowNamed(days.rows, 'Thu, Oct 22');
  assert.equal(thursday.detail, '2026-10-22');
  const tiny = days.rows.find((row) => row.detail === '2026-10-27');
  assert.ok(tiny);
  assert.equal(tiny.shareLabel, '0.5%');
  assert.equal(tiny.note, '<1%');
  assert.equal(tiny.barPct, 2);

  const keys: string[] = [];
  collectKeys(presented, keys);
  assert.equal(keys.includes('tokens'), false);
  assert.equal(keys.includes('tokensTotal'), false);
});

test('share bars keep the posted percent instead of rescaling children', () => {
  const usage = requireUsage(minimal({
    reports: [{
      period: 'this_week',
      period_label: 'Oct 28 – Oct 29, UTC',
      breakdown: ['bot', 'routine'],
      rows: [{
        bot: 'Bus',
        share_pct: 10,
        children: [{ routine: 'Not from a routine', share_pct: 40 }],
      }],
    }],
  }));
  const presented = presentGrokBotPlanUsage(usage);
  const bus = presented.reports[0].rows[0];
  assert.equal(bus.shareLabel, '10%');
  assert.equal(bus.barPct, 10);
  assert.equal(bus.children[0].shareLabel, '40%');
  assert.equal(bus.children[0].barPct, 40);
});

test('extra scalars and on-demand numbers are kept', () => {
  const usage = requireUsage(minimal({
    weekly_usage_percent_used: 80,
    on_demand: { monthly_limit: 50, amount: 0 },
    reports: [{
      period: 'this_week',
      period_label: 'This week',
      breakdown: ['bot'],
      rows: [{ bot: 'Water', share_pct: 3, paused: false, region: 'hk' }],
    }],
  }));
  const presented = presentGrokBotPlanUsage(usage);
  assert.equal(presented.weeklyWarn, true);
  assert.equal(presented.onDemandValue, '0 / 50');
  const water = presented.reports[0].rows[0];
  assert.equal(water.paused, false);
  assert.deepEqual(water.extras, [{ key: 'region', value: 'hk' }]);
});

test('plan usage parser rejects malformed snapshots', () => {
  fail(null, /object/);
  fail(minimal({ schema_version: 2 }), /schema_version/);
  fail(minimal({ tokens: 1 }), /tokens/);
  fail({ schema_version: 1 }, /captured_at/);
  fail(minimal({ captured_at: 'Wednesday' }), /ISO-8601/);
  fail(minimal({ weekly_usage_percent_used: 100.1 }), /between 0 and 100/);
  fail(minimal({ on_demand: { monthly_limit: null, amount: '12' } }), /amount/);
  const tooMany = Array.from({ length: 801 }, (_, index) => ({
    bot: `bot-${index}`,
    share_pct: 1,
  }));
  fail(minimal({
    reports: [{
      period: 'this_week',
      period_label: 'This week',
      breakdown: ['bot'],
      rows: tooMany,
    }],
  }), /share-row limit/);

  function nest(remaining: number): Record<string, unknown> {
    const node: Record<string, unknown> = { label: `n${remaining}`, share_pct: 1 };
    if (remaining > 0) node.children = [nest(remaining - 1)];
    return node;
  }
  fail(minimal({
    reports: [{
      period: 'this_week',
      period_label: 'This week',
      breakdown: ['bot'],
      rows: [{ bot: 'root', share_pct: 1, children: [nest(8)] }],
    }],
  }), /nested too deeply/);
});

test('share and capture helpers format the posted numbers', () => {
  assert.equal(formatSharePct(39), '39%');
  assert.equal(formatSharePct(21.6), '21.6%');
  assert.equal(formatSharePct(0.5), '0.5%');
  assert.equal(formatOnDemand(null, null), '—');
  assert.equal(formatOnDemand(null, 12.5), '12.5 / —');
  assert.equal(shareBarWidth(0), 0);
  assert.equal(shareBarWidth(0.5), 2);
  assert.equal(shareBarWidth(39), 39);
  assert.equal(parseGrokBotPlanCapture(undefined), null);
  assert.equal(parseGrokBotPlanCapture('nope'), null);
  assert.equal(parseGrokBotPlanCapture('0'), null);
  assert.equal(parseGrokBotPlanCapture('4'), 4);
  assert.equal(
    grokBotPlanCaptureHref('/cursor/grok?cycle=-1&usage=grok-bot-default', 4),
    '/cursor/grok?cycle=-1&usage=grok-bot-default&capture=4',
  );
  assert.equal(
    grokBotPlanCaptureHref('/cursor/grok?capture=1', 2),
    '/cursor/grok?capture=2',
  );
});
