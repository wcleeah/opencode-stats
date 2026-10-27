import test from 'node:test';
import assert from 'node:assert/strict';

import type { GrokBotProjectedCompare, GrokBotProjectedPrimary } from './cycle';
import { grokBotBucketMs } from './cycle';
import { setGrokBotPeriodName } from './period-name';
import { grokBotPeriodTitle } from './period-title';
import {
  grokBotOutsUsd,
  grokBotTokenTotal,
  priceGrokBotRow,
  type GrokBotPriceInput,
} from './rates';
import {
  alignGrokBotPeriods,
  foldGrokBotWindow,
  grokBotCompareStarts,
  type GrokBotCharts,
  type GrokBotFoldEvent,
  type GrokBotTypeLine,
  type GrokBotWindowTotals,
} from './window';

const BUCKET_MS = 60_000;

const LINES: readonly GrokBotTypeLine[] = [
  { id: 'grok-bot-default', label: 'Default' },
  { id: 'grok-bot-knowledge-work', label: 'Knowledge work' },
];

function row(overrides: Partial<GrokBotPriceInput>): GrokBotPriceInput {
  return {
    model: 'grok-bot-default',
    kind: 'Included',
    costRaw: 'Included',
    reportedCost: null,
    tokensInput: 0,
    tokensInputCacheWrite: 0,
    tokensCacheRead: 0,
    tokensOutput: 0,
    ...overrides,
  };
}

function byType(charts: GrokBotCharts): Extract<GrokBotCharts, { mode: 'by-type' }> {
  assert.equal(charts.mode, 'by-type');
  if (charts.mode !== 'by-type') throw new Error('expected by-type charts');
  return charts;
}

function insOuts(charts: GrokBotCharts): Extract<GrokBotCharts, { mode: 'ins-outs' }> {
  assert.equal(charts.mode, 'ins-outs');
  if (charts.mode !== 'ins-outs') throw new Error('expected ins-outs charts');
  return charts;
}

function sumByType(charts: Extract<GrokBotCharts, { mode: 'by-type' }>): {
  tokens: number;
  usd: number;
} {
  let tokens = 0;
  let usd = 0;
  for (const point of charts.points) {
    for (const value of point.values) {
      tokens += value.tokens;
      usd += value.usd;
    }
  }
  return { tokens, usd };
}

function sumInsOuts(charts: Extract<GrokBotCharts, { mode: 'ins-outs' }>): {
  tokens: number;
  usd: number;
} {
  let tokens = 0;
  let usd = 0;
  for (const point of charts.points) {
    tokens += point.insTokens + point.outsTokens;
    usd += point.insUsd + point.outsUsd;
  }
  return { tokens, usd };
}

test('ins outs lines match by-type totals and the window cards', () => {
  const events: readonly GrokBotFoldEvent[] = [
    {
      bucketStartMs: 0,
      usageType: 'grok-bot-default',
      priced: priceGrokBotRow(row({
        kind: 'On-Demand',
        costRaw: '10',
        reportedCost: 10,
        tokensInput: 1_000_000,
        tokensOutput: 1_000_000,
      })),
    },
    {
      bucketStartMs: 0,
      usageType: 'grok-bot-knowledge-work',
      priced: priceGrokBotRow(row({
        model: 'grok-bot-knowledge-work',
        tokensInput: 1_000_000,
        tokensInputCacheWrite: 250,
      })),
    },
    {
      bucketStartMs: 0,
      usageType: 'grok-bot-automation',
      priced: priceGrokBotRow(row({
        model: 'grok-bot-automation',
        tokensInput: 9_000_000,
        tokensOutput: 9_000_000,
      })),
    },
    {
      bucketStartMs: BUCKET_MS * 4,
      usageType: 'grok-bot-default',
      priced: priceGrokBotRow(row({
        kind: 'On-Demand',
        costRaw: '99',
        reportedCost: 99,
        tokensInput: 50,
      })),
    },
  ];
  const shared = {
    windowStartMs: 0,
    windowEndMs: BUCKET_MS * 2 - 1,
    bucketMs: BUCKET_MS,
    seriesTypes: LINES,
    events,
  };
  const typed = foldGrokBotWindow({ ...shared, mode: 'by-type' });
  const split = foldGrokBotWindow({ ...shared, mode: 'ins-outs' });
  const typedCharts = byType(typed.charts);
  const splitCharts = insOuts(split.charts);
  const cardTokens = grokBotTokenTotal(typed.totals.tokens);
  const cardUsd = typed.totals.spend.totalUsd;

  assert.deepEqual(typed.totals, split.totals);
  assert.equal(cardTokens, 3_000_250);
  assert.equal(cardUsd, 12);
  assert.deepEqual(typed.totals.tokens, { ins: 2_000_250, outs: 1_000_000 });
  assert.deepEqual(typed.totals.spend, {
    totalUsd: 12,
    insUsd: 4.5,
    unpricedCacheWriteTokens: 250,
    includesCardEstimate: true,
  });
  assert.equal(grokBotOutsUsd(cardUsd, typed.totals.spend.insUsd), 7.5);
  assert.equal(sumByType(typedCharts).tokens, cardTokens);
  assert.equal(sumByType(typedCharts).usd, cardUsd);
  assert.equal(sumInsOuts(splitCharts).tokens, cardTokens);
  assert.equal(sumInsOuts(splitCharts).usd, cardUsd);

  assert.equal(typedCharts.points.length, 2);
  assert.equal(splitCharts.points.length, 2);
  assert.deepEqual(typedCharts.lines.map((line) => line.id), [
    'grok-bot-default',
    'grok-bot-knowledge-work',
  ]);
  assert.deepEqual(typedCharts.points[0], {
    bucketStartMs: 0,
    values: [
      { tokens: 2_000_000, usd: 10 },
      { tokens: 1_000_250, usd: 2 },
    ],
  });
  assert.deepEqual(typedCharts.points[1].values, [
    { tokens: 0, usd: 0 },
    { tokens: 0, usd: 0 },
  ]);
  assert.equal(typedCharts.points[1].bucketStartMs, BUCKET_MS);
  assert.deepEqual(splitCharts.points[0], {
    bucketStartMs: 0,
    insTokens: 2_000_250,
    outsTokens: 1_000_000,
    insUsd: 4.5,
    outsUsd: 7.5,
  });
  assert.deepEqual(splitCharts.points[1], {
    bucketStartMs: BUCKET_MS,
    insTokens: 0,
    outsTokens: 0,
    insUsd: 0,
    outsUsd: 0,
  });
  assert.equal(
    typedCharts.points[0].values[0].usd + typedCharts.points[0].values[1].usd,
    splitCharts.points[0].insUsd + splitCharts.points[0].outsUsd,
  );
});

test('a reported window does not mark the spend as a card estimate', () => {
  const folded = foldGrokBotWindow({
    windowStartMs: 0,
    windowEndMs: BUCKET_MS - 1,
    bucketMs: BUCKET_MS,
    seriesTypes: [{ id: 'grok-bot-default', label: 'Default' }],
    events: [{
      bucketStartMs: 0,
      usageType: 'grok-bot-default',
      priced: priceGrokBotRow(row({
        kind: 'On-Demand',
        costRaw: '10',
        reportedCost: 10,
        tokensInput: 1_000_000,
        tokensOutput: 1_000_000,
      })),
    }],
    mode: 'ins-outs',
  });
  assert.equal(folded.totals.spend.includesCardEstimate, false);
  assert.equal(folded.totals.spend.totalUsd, 10);
  assert.equal(folded.totals.spend.insUsd, 2.5);
  assert.equal(folded.totals.spend.unpricedCacheWriteTokens, 0);
  const charts = insOuts(folded.charts);
  assert.equal(charts.points[0].insUsd + charts.points[0].outsUsd, 10);
});

test('a week fold fills 168 zero buckets', () => {
  const week = 7 * 24 * 60 * 60 * 1000;
  const folded = foldGrokBotWindow({
    windowStartMs: 0,
    windowEndMs: week - 1,
    bucketMs: grokBotBucketMs(week),
    seriesTypes: [
      { id: 'grok-bot-default', label: 'Default' },
      { id: 'grok-bot-cua', label: 'CUA' },
    ],
    events: [],
    mode: 'by-type',
  });
  const charts = byType(folded.charts);
  assert.equal(charts.points.length, 168);
  assert.equal(charts.points[0].bucketStartMs, 0);
  assert.equal(charts.points[167].bucketStartMs, 167 * 60 * 60 * 1000);
  assert.deepEqual(charts.points[0].values, [
    { tokens: 0, usd: 0 },
    { tokens: 0, usd: 0 },
  ]);
  assert.equal(grokBotTokenTotal(folded.totals.tokens), 0);
  assert.equal(folded.totals.spend.totalUsd, 0);
  assert.equal(folded.totals.spend.includesCardEstimate, false);
});

test('fold zero-fills buckets around one event', () => {
  const windowStartMs = 1_700_000_000_000;
  const expected = windowStartMs + BUCKET_MS;
  const folded = foldGrokBotWindow({
    windowStartMs,
    windowEndMs: windowStartMs + 3 * BUCKET_MS - 1,
    bucketMs: BUCKET_MS,
    seriesTypes: [{ id: 'grok-bot-default', label: 'Default' }],
    events: [{
      bucketStartMs: expected,
      usageType: 'grok-bot-default',
      priced: priceGrokBotRow(row({ tokensInput: 12 })),
    }],
    mode: 'by-type',
  });
  const charts = byType(folded.charts);
  assert.equal(charts.points.length, 3);
  assert.equal(charts.points[0].values[0].tokens, 0);
  assert.equal(charts.points[1].bucketStartMs, expected);
  assert.equal(charts.points[1].values[0].tokens, 12);
  assert.equal(charts.points[1].values[0].usd, 12 * 2 / 1_000_000);
  assert.equal(charts.points[2].values[0].tokens, 0);
  assert.equal(grokBotTokenTotal(folded.totals.tokens), 12);
});

function periodTotals(
  tokens: { ins: number; outs: number },
  spend: GrokBotWindowTotals['spend'],
): GrokBotWindowTotals {
  return { tokens, spend };
}

test('alignment uses the primary bucket and zeros a missing compared point', () => {
  const lines: readonly GrokBotTypeLine[] = [
    { id: 'grok-bot-default', label: 'Default' },
    { id: 'grok-bot-cua', label: 'CUA' },
  ];
  const primaryProjected: GrokBotProjectedPrimary = {
    role: 'primary',
    window: { startMs: 0, endMs: 1, bucketMs: 1 },
    label: 'primary label',
    shortLabel: 'Wed 14 Oct 2026',
  };
  const compareProjected: GrokBotProjectedCompare = {
    role: 'compare',
    window: { startMs: 10, endMs: 11, bucketMs: 1 },
    label: 'compare label',
    shortLabel: 'Wed 7 Oct 2026',
  };
  const olderProjected: GrokBotProjectedCompare = {
    role: 'compare',
    window: { startMs: 20, endMs: 21, bucketMs: 1 },
    label: 'older label',
    shortLabel: 'Wed 19 Aug 2026',
  };
  const primaryTotals = periodTotals(
    { ins: 3, outs: 4 },
    { totalUsd: 1, insUsd: 0.25, unpricedCacheWriteTokens: 0, includesCardEstimate: false },
  );
  const compareTotals = periodTotals(
    { ins: 8, outs: 1 },
    { totalUsd: 9, insUsd: 2, unpricedCacheWriteTokens: 5, includesCardEstimate: true },
  );
  const aligned = alignGrokBotPeriods({
    seriesTypes: lines,
    names: [],
    folds: [
      {
        projected: primaryProjected,
        folded: {
          totals: primaryTotals,
          charts: {
            mode: 'by-type',
            lines,
            points: [
              {
                bucketStartMs: 100,
                values: [{ tokens: 3, usd: 1 }, { tokens: 4, usd: 2 }],
              },
              {
                bucketStartMs: 200,
                values: [{ tokens: 0, usd: 0 }, { tokens: 0, usd: 0 }],
              },
            ],
          },
        },
      },
      {
        projected: compareProjected,
        folded: {
          totals: compareTotals,
          charts: {
            mode: 'by-type',
            lines,
            points: [{ bucketStartMs: 9_999, values: [{ tokens: 8, usd: 9 }] }],
          },
        },
      },
      {
        projected: olderProjected,
        folded: {
          totals: primaryTotals,
          charts: {
            mode: 'by-type',
            lines,
            points: [
              { bucketStartMs: 1, values: [{ tokens: 5, usd: 5 }, { tokens: 6, usd: 6 }] },
              { bucketStartMs: 2, values: [{ tokens: 7, usd: 7 }, { tokens: 0, usd: 0 }] },
              { bucketStartMs: 3, values: [{ tokens: 999, usd: 999 }, { tokens: 999, usd: 999 }] },
            ],
          },
        },
      },
    ],
  });
  assert.equal(aligned.mode, 'by-type');
  if (aligned.mode !== 'by-type') return;
  assert.equal(aligned.points.length, 2);
  assert.equal(aligned.points[0].bucketStartMs, 100);
  assert.equal(aligned.points[1].bucketStartMs, 200);
  assert.deepEqual(aligned.points[0].values, [
    [{ tokens: 3, usd: 1 }, { tokens: 8, usd: 9 }, { tokens: 5, usd: 5 }],
    [{ tokens: 4, usd: 2 }, { tokens: 0, usd: 0 }, { tokens: 6, usd: 6 }],
  ]);
  assert.deepEqual(aligned.points[1].values[0], [
    { tokens: 0, usd: 0 },
    { tokens: 0, usd: 0 },
    { tokens: 7, usd: 7 },
  ]);
  assert.equal(JSON.stringify(aligned).includes('999'), false);
  assert.deepEqual(aligned.periods[0].totals, primaryTotals);
  assert.deepEqual(aligned.periods[1].totals, compareTotals);
  assert.equal(aligned.periods[0].startMs, 0);
  assert.equal(aligned.periods[1].startMs, 10);
  assert.equal(aligned.periods[1].shortLabel, 'Wed 7 Oct 2026');
  assert.deepEqual(grokBotCompareStarts(aligned.periods), [10, 20]);
  assert.equal(grokBotPeriodTitle(1, aligned.periods), 'Period 2');
  assert.equal(Object.hasOwn(aligned.periods[0], 'name'), false);
  assert.equal(Object.hasOwn(aligned.periods[1], 'name'), false);
});

test('alignment copies outs dollars from the fold', () => {
  const primaryTotals = periodTotals(
    { ins: 1, outs: 2 },
    { totalUsd: 5.25, insUsd: 1, unpricedCacheWriteTokens: 0, includesCardEstimate: false },
  );
  const compareTotals = periodTotals(
    { ins: 0, outs: 0 },
    { totalUsd: 0, insUsd: 0, unpricedCacheWriteTokens: 0, includesCardEstimate: false },
  );
  const aligned = alignGrokBotPeriods({
    seriesTypes: [],
    names: [],
    folds: [
      {
        projected: {
          role: 'primary',
          window: { startMs: 0, endMs: 1, bucketMs: 1 },
          label: 'primary label',
          shortLabel: 'Wed 14 Oct 2026',
        },
        folded: {
          totals: primaryTotals,
          charts: {
            mode: 'ins-outs',
            points: [
              {
                bucketStartMs: 100,
                insTokens: 1,
                outsTokens: 2,
                insUsd: 1,
                outsUsd: 4.25,
              },
              {
                bucketStartMs: 200,
                insTokens: 0,
                outsTokens: 0,
                insUsd: 0,
                outsUsd: 0,
              },
            ],
          },
        },
      },
      {
        projected: {
          role: 'compare',
          window: { startMs: 0, endMs: 1, bucketMs: 1 },
          label: 'compare label',
          shortLabel: 'Wed 7 Oct 2026',
        },
        folded: {
          totals: compareTotals,
          charts: {
            mode: 'ins-outs',
            points: [{
              bucketStartMs: 9_999,
              insTokens: 5,
              outsTokens: 6,
              insUsd: 0.5,
              outsUsd: 4.25,
            }],
          },
        },
      },
    ],
  });
  assert.equal(aligned.mode, 'ins-outs');
  if (aligned.mode !== 'ins-outs') return;
  assert.deepEqual(aligned.points[0], {
    bucketStartMs: 100,
    sides: [
      { insTokens: 1, outsTokens: 2, insUsd: 1, outsUsd: 4.25 },
      { insTokens: 5, outsTokens: 6, insUsd: 0.5, outsUsd: 4.25 },
    ],
  });
  assert.deepEqual(aligned.points[1].sides[1], {
    insTokens: 0,
    outsTokens: 0,
    insUsd: 0,
    outsUsd: 0,
  });
  assert.equal(aligned.periods[0].totals, primaryTotals);
});

test('an empty primary fold keeps period totals and draws no points', () => {
  const primaryTotals = periodTotals(
    { ins: 0, outs: 0 },
    { totalUsd: 0, insUsd: 0, unpricedCacheWriteTokens: 0, includesCardEstimate: false },
  );
  const compareTotals = periodTotals(
    { ins: 4, outs: 0 },
    { totalUsd: 2, insUsd: 2, unpricedCacheWriteTokens: 0, includesCardEstimate: true },
  );
  const aligned = alignGrokBotPeriods({
    seriesTypes: [{ id: 'grok-bot-default', label: 'Default' }],
    names: [],
    folds: [
      {
        projected: {
          role: 'primary',
          window: { startMs: 0, endMs: 1, bucketMs: 1 },
          label: 'primary label',
          shortLabel: 'Wed 14 Oct 2026',
        },
        folded: {
          totals: primaryTotals,
          charts: { mode: 'by-type', lines: [], points: [] },
        },
      },
      {
        projected: {
          role: 'compare',
          window: { startMs: 0, endMs: 1, bucketMs: 1 },
          label: 'compare label',
          shortLabel: 'Wed 7 Oct 2026',
        },
        folded: {
          totals: compareTotals,
          charts: {
            mode: 'by-type',
            lines: [],
            points: [{ bucketStartMs: 50, values: [{ tokens: 4, usd: 2 }] }],
          },
        },
      },
    ],
  });
  assert.equal(aligned.mode, 'by-type');
  if (aligned.mode !== 'by-type') return;
  assert.equal(aligned.points.length, 0);
  assert.deepEqual(aligned.periods[0].totals, primaryTotals);
  assert.deepEqual(aligned.periods[1].totals, compareTotals);
  assert.equal(aligned.lines.length, 1);
});

test('an empty series list keeps the requested mode and drops events', () => {
  const events: readonly GrokBotFoldEvent[] = [{
    bucketStartMs: 0,
    usageType: 'grok-bot-default',
    priced: priceGrokBotRow(row({ tokensInput: 1_000_000 })),
  }];
  const shared = {
    windowStartMs: 0,
    windowEndMs: BUCKET_MS - 1,
    bucketMs: BUCKET_MS,
    seriesTypes: [],
    events,
  };
  const split = foldGrokBotWindow({ ...shared, mode: 'ins-outs' });
  const typed = foldGrokBotWindow({ ...shared, mode: 'by-type' });
  const splitCharts = insOuts(split.charts);
  const typedCharts = byType(typed.charts);
  assert.equal(splitCharts.points.length, 0);
  assert.equal(typedCharts.points.length, 0);
  assert.equal(typedCharts.lines.length, 0);
  assert.equal(grokBotTokenTotal(split.totals.tokens), 0);
  assert.equal(typed.totals.spend.totalUsd, 0);
  assert.equal(typed.totals.spend.includesCardEstimate, false);
});

test('align copies a shared name onto each matching start', () => {
  const first = setGrokBotPeriodName([], 0, 'Launch');
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const shared = setGrokBotPeriodName(first.names, 10, 'Launch');
  assert.equal(shared.ok, true);
  if (!shared.ok) return;
  const withHidden = setGrokBotPeriodName(shared.names, 99, 'Hidden');
  assert.equal(withHidden.ok, true);
  if (!withHidden.ok) return;
  const totals = periodTotals(
    { ins: 0, outs: 0 },
    { totalUsd: 0, insUsd: 0, unpricedCacheWriteTokens: 0, includesCardEstimate: false },
  );
  const aligned = alignGrokBotPeriods({
    seriesTypes: [],
    names: withHidden.names,
    folds: [
      {
        projected: {
          role: 'primary',
          window: { startMs: 0, endMs: 1, bucketMs: 1 },
          label: 'Wed 14 Oct 2026 11:30 to Wed 21 Oct 2026 11:29',
          shortLabel: 'Wed 14 Oct 2026',
        },
        folded: {
          totals,
          charts: { mode: 'by-type', lines: [], points: [] },
        },
      },
      {
        projected: {
          role: 'compare',
          window: { startMs: 10, endMs: 11, bucketMs: 1 },
          label: 'Wed 21 Oct 2026 11:30 to Wed 28 Oct 2026 11:29',
          shortLabel: 'Wed 21 Oct 2026',
        },
        folded: {
          totals,
          charts: { mode: 'by-type', lines: [], points: [] },
        },
      },
    ],
  });
  assert.equal(aligned.periods[0].name, 'Launch');
  assert.equal(aligned.periods[1].name, 'Launch');
  assert.equal(grokBotPeriodTitle(0, [aligned.periods[0]]), 'Launch');
  assert.equal(grokBotPeriodTitle(0, aligned.periods), 'Launch · 1');
  assert.equal(grokBotPeriodTitle(1, aligned.periods), 'Launch · 2');
  assert.equal(aligned.periods[0].name, 'Launch');
  assert.equal(aligned.periods.some((period) => period.name === 'Hidden'), false);
});
