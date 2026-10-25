import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { GrokBotWindowStats } from './window-stats';

test('spending card marks a card estimate and names unpriced cache writes', () => {
  const html = renderToStaticMarkup(createElement(GrokBotWindowStats, {
    totals: {
      tokens: { ins: 2_000_000, outs: 500 },
      spend: {
        totalUsd: 2,
        insUsd: 2,
        unpricedCacheWriteTokens: 250,
        includesCardEstimate: true,
      },
    },
  }));
  assert.match(html, /Total Spending \(estimated\)/);
  assert.match(html, /~\$2\.00/);
  assert.match(html, /ins ~\$2\.00 · outs ~\$0\.00 · cache write unpriced/);
  assert.match(html, /Total tokens/);
  assert.match(html, /ins 2\.00M · outs 500/);
});

test('rounded spending lines still add to the rounded total', () => {
  const html = renderToStaticMarkup(createElement(GrokBotWindowStats, {
    totals: {
      tokens: { ins: 1, outs: 1 },
      spend: {
        totalUsd: 929.57840484,
        insUsd: 848.66404044,
        unpricedCacheWriteTokens: 0,
        includesCardEstimate: true,
      },
    },
  }));
  assert.match(html, /~\$929\.58/);
  assert.match(html, /ins ~\$848\.66 · outs ~\$80\.92/);
  assert.equal(html.includes('~$80.91'), false);
});

test('a stored on-demand window prints spending without a tilde', () => {
  const html = renderToStaticMarkup(createElement(GrokBotWindowStats, {
    totals: {
      tokens: { ins: 1_000_000, outs: 1_000_000 },
      spend: {
        totalUsd: 10,
        insUsd: 2.5,
        unpricedCacheWriteTokens: 0,
        includesCardEstimate: false,
      },
    },
  }));
  assert.equal(html.includes('~'), false);
  assert.equal(html.includes('cache write unpriced'), false);
  assert.match(html, /\$10\.00/);
  assert.match(html, /ins \$2\.50 · outs \$7\.50/);
  assert.match(html, /ins 1\.00M · outs 1\.00M/);
});
