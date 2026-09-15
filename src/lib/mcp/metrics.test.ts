import test from 'node:test';
import assert from 'node:assert/strict';

import { getUtcCalendarMonth, utcDayKey } from './calendar';
import {
  fetchExaUsage,
  parseExaApiKeyList,
  parseExaBreakdownJson,
  parseExaUsage,
} from './exa';
import { lastSnapshotPerUtcDay } from './history';
import {
  computeExaMetrics,
  computeTavilyMetrics,
  formatBurnRatio,
  isExaToolName,
  isMcpProviderTool,
  isTavilyToolName,
  mcpToolProvider,
} from './metrics';
import { fetchTavilyUsage, parseTavilyUsage } from './tavily';
import { readMcpEnvConfig } from './env';
import type { McpUsageSnapshot } from '@/types/mcp';

test('getUtcCalendarMonth uses UTC month bounds', () => {
  const month = getUtcCalendarMonth(new Date('2026-09-15T12:00:00Z'));
  assert.equal(month.key, '2026-09');
  assert.equal(month.startMs, Date.UTC(2026, 8, 1));
  assert.equal(month.nextResetMs, Date.UTC(2026, 9, 1));
  assert.equal(month.daysInMonth, 30);
  assert.ok(month.elapsedRatio > 0.4 && month.elapsedRatio < 0.6);
  assert.equal(utcDayKey(Date.UTC(2026, 8, 2, 23, 59)), '2026-09-02');
});

test('computeTavilyMetrics remaining credits and exhaustion', () => {
  const mid = computeTavilyMetrics({
    plan: 'Researcher',
    planUsage: 400,
    planLimit: 1000,
    paygoUsage: 0,
    paygoLimit: null,
    elapsedRatio: 0.5,
    warnPct: 80,
  });
  assert.equal(mid.remaining, 600);
  assert.equal(mid.usedPct, 40);
  assert.equal(mid.exhausted, false);
  assert.equal(mid.warn, false);
  assert.equal(mid.burnRatio, 0.8);

  const low = computeTavilyMetrics({
    plan: 'Researcher',
    planUsage: 900,
    planLimit: 1000,
    paygoUsage: 0,
    paygoLimit: null,
    elapsedRatio: 0.5,
    warnPct: 80,
  });
  assert.equal(low.warn, true);
  assert.equal(low.exhausted, false);

  const out = computeTavilyMetrics({
    plan: 'Researcher',
    planUsage: 1000,
    planLimit: 1000,
    paygoUsage: 25,
    paygoLimit: 100,
    elapsedRatio: 0.8,
    warnPct: 80,
  });
  assert.equal(out.remaining, 0);
  assert.equal(out.exhausted, true);
  assert.equal(out.paygoActive, true);
  assert.equal(out.estimatedPaygoUsd, 0.2);
});

test('computeTavilyMetrics treats null limit as unlimited', () => {
  const metrics = computeTavilyMetrics({
    plan: 'Enterprise',
    planUsage: 12,
    planLimit: null,
    paygoUsage: 0,
    paygoLimit: null,
    elapsedRatio: 0.2,
    warnPct: 80,
  });
  assert.equal(metrics.unlimited, true);
  assert.equal(metrics.remaining, null);
  assert.equal(metrics.usedPct, null);
  assert.equal(metrics.exhausted, false);
  assert.equal(metrics.warn, false);
});

test('computeExaMetrics estimates remaining from allotment', () => {
  const metrics = computeExaMetrics({
    usedUsd: 7.5,
    allotmentUsd: 10,
    purchasedExtraUsd: 5,
    elapsedRatio: 0.5,
    warnRemainingUsd: 2,
  });
  assert.equal(metrics.poolUsd, 15);
  assert.equal(metrics.remainingUsd, 7.5);
  assert.equal(metrics.estimated, true);
  assert.equal(metrics.warn, false);
  assert.equal(metrics.exhausted, false);

  const low = computeExaMetrics({
    usedUsd: 9.5,
    allotmentUsd: 10,
    purchasedExtraUsd: 0,
    elapsedRatio: 0.4,
    warnRemainingUsd: 2,
  });
  assert.equal(low.remainingUsd, 0.5);
  assert.equal(low.warn, true);
  assert.equal(low.exhausted, false);

  const over = computeExaMetrics({
    usedUsd: 12,
    allotmentUsd: 10,
    purchasedExtraUsd: 0,
    elapsedRatio: 1,
    warnRemainingUsd: 2,
  });
  assert.equal(over.remainingUsd, -2);
  assert.equal(over.exhausted, true);
  assert.equal(over.usedPct, 100);
});

test('formatBurnRatio', () => {
  assert.equal(formatBurnRatio(null), '—');
  assert.equal(formatBurnRatio(0), '0.0×');
  assert.equal(formatBurnRatio(1.25), '1.3×');
});

test('MCP tool name matching does not hit example', () => {
  assert.equal(isExaToolName('exa_web_search_exa'), true);
  assert.equal(isExaToolName('exa_crawling_exa'), true);
  assert.equal(isExaToolName('example_tool'), false);
  assert.equal(isTavilyToolName('tavily_search'), true);
  assert.equal(isTavilyToolName('mcp_tavily_extract'), true);
  assert.equal(isTavilyToolName('websearch'), false);
  assert.equal(isMcpProviderTool('exa_get_code_context_exa'), true);
  assert.equal(mcpToolProvider('tavily_search'), 'tavily');
});

test('parseTavilyUsage reads plan remaining fields', () => {
  const parsed = parseTavilyUsage({
    key: { usage: 150, limit: 1000, search_usage: 100 },
    account: {
      current_plan: 'Researcher',
      plan_usage: 400,
      plan_limit: 1000,
      paygo_usage: 0,
      paygo_limit: null,
      search_usage: 350,
      extract_usage: 50,
      crawl_usage: 0,
      map_usage: 0,
      research_usage: 0,
    },
  });
  assert.ok(!('error' in parsed));
  if ('error' in parsed) return;
  assert.equal(parsed.plan, 'Researcher');
  assert.equal(parsed.planUsage, 400);
  assert.equal(parsed.planLimit, 1000);
  assert.equal(parsed.paygoLimit, null);
  assert.equal(parsed.searchUsage, 350);
  assert.equal(parsed.keyUsage, 150);
});

test('parseTavilyUsage surfaces API errors', () => {
  const parsed = parseTavilyUsage({
    detail: { error: 'Unauthorized: missing or invalid API key.' },
  });
  assert.ok('error' in parsed);
});

test('parseExaUsage and key list', () => {
  const usage = parseExaUsage({
    api_key_id: '550e8400-e29b-41d4-a716-446655440000',
    api_key_name: 'MCP',
    total_cost_usd: 4.2,
    cost_breakdown: [
      { price_id: 'search', price_name: 'Neural Search', quantity: 100, amount_usd: 3 },
      { price_id: 'contents', price_name: 'Content Retrieval', quantity: 20, amount_usd: 1.2 },
    ],
    period: { start: '2026-09-01T00:00:00Z', end: '2026-09-15T00:00:00Z' },
  });
  assert.ok(!('error' in usage));
  if ('error' in usage) return;
  assert.equal(usage.totalCostUsd, 4.2);
  assert.equal(usage.breakdown.length, 2);
  assert.equal(usage.breakdown[0].priceName, 'Neural Search');

  const keys = parseExaApiKeyList({
    apiKeys: [{ id: 'abc', name: 'prod', budgetCents: 500, isOverBudget: false }],
  });
  assert.ok(!('error' in keys));
  if ('error' in keys) return;
  assert.equal(keys[0].id, 'abc');
  assert.equal(keys[0].budgetCents, 500);
});

test('parseExaBreakdownJson and lastSnapshotPerUtcDay', () => {
  const breakdown = parseExaBreakdownJson(
    JSON.stringify([{ priceName: 'Search', quantity: 1, amountUsd: 0.007 }]),
  );
  assert.equal(breakdown[0].amountUsd, 0.007);

  const empty: McpUsageSnapshot = {
    id: 1,
    fetched_at: Date.UTC(2026, 8, 2, 10),
    cycle_month: '2026-09',
    tavily_ok: 1,
    tavily_error: null,
    tavily_plan: 'Researcher',
    tavily_plan_usage: 10,
    tavily_plan_limit: 1000,
    tavily_paygo_usage: 0,
    tavily_paygo_limit: null,
    tavily_search_usage: 10,
    tavily_extract_usage: 0,
    tavily_crawl_usage: 0,
    tavily_map_usage: 0,
    tavily_research_usage: 0,
    tavily_key_usage: 10,
    tavily_key_limit: null,
    exa_ok: 1,
    exa_error: null,
    exa_api_key_id: 'k',
    exa_api_key_name: null,
    exa_total_cost_usd: 1,
    exa_breakdown_json: null,
  };
  const later: McpUsageSnapshot = {
    ...empty,
    id: 2,
    fetched_at: Date.UTC(2026, 8, 2, 18),
    tavily_plan_usage: 40,
    exa_total_cost_usd: 2.5,
  };
  const nextDay: McpUsageSnapshot = {
    ...empty,
    id: 3,
    fetched_at: Date.UTC(2026, 8, 3, 1),
    tavily_plan_usage: 41,
    exa_total_cost_usd: 2.6,
  };
  const points = lastSnapshotPerUtcDay([empty, later, nextDay]);
  assert.equal(points.length, 2);
  assert.equal(points[0].day, '2026-09-02');
  assert.equal(points[0].tavily_plan_usage, 40);
  assert.equal(points[1].day, '2026-09-03');
});

test('fetchTavilyUsage sends bearer auth', async () => {
  const calls: string[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    calls.push(String(input));
    assert.equal(
      (init?.headers as { Authorization?: string }).Authorization,
      'Bearer tvly-test',
    );
    return new Response(
      JSON.stringify({
        account: { current_plan: 'Researcher', plan_usage: 1, plan_limit: 1000 },
        key: { usage: 1, limit: null },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  const result = await fetchTavilyUsage('tvly-test', fetchFn);
  assert.equal(result.error, null);
  assert.equal(result.data?.planUsage, 1);
  assert.equal(calls[0], 'https://api.tavily.com/usage');
});

test('fetchExaUsage encodes date range', async () => {
  const result = await fetchExaUsage({
    serviceKey: 'exa-test',
    apiKeyId: 'key-1',
    startIso: '2026-09-01T00:00:00.000Z',
    endIso: '2026-09-15T00:00:00.000Z',
    fetchFn: async (input, init) => {
      const url = String(input);
      assert.match(url, /api-keys\/key-1\/usage/);
      assert.match(url, /start_date=2026-09-01/);
      assert.equal((init?.headers as { 'x-api-key'?: string })['x-api-key'], 'exa-test');
      return new Response(
        JSON.stringify({
          api_key_id: 'key-1',
          total_cost_usd: 1.5,
          cost_breakdown: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });
  assert.equal(result.error, null);
  assert.equal(result.data?.totalCostUsd, 1.5);
});

test('readMcpEnvConfig accepts EXA_API_KEY or EXA_SERVICE_KEY', () => {
  const a = readMcpEnvConfig({
    TAVILY_API_KEY: ' tvly-x ',
    EXA_API_KEY: 'exa-secret',
    EXA_API_KEY_ID: 'uuid',
  });
  assert.equal(a.tavilyConfigured, true);
  assert.equal(a.exaConfigured, true);
  assert.equal(a.tavilyApiKey, 'tvly-x');
  assert.equal(a.exaApiKeyId, 'uuid');

  const b = readMcpEnvConfig({
    EXA_SERVICE_KEY: 'svc',
  });
  assert.equal(b.exaConfigured, true);
  assert.equal(b.exaServiceKey, 'svc');
  assert.equal(b.tavilyConfigured, false);

  const quoted = readMcpEnvConfig({
    EXA_API_KEY: '"Bearer exa-quoted"',
    TAVILY_API_KEY: "'tvly-quoted'",
  });
  assert.equal(quoted.exaServiceKey, 'exa-quoted');
  assert.equal(quoted.tavilyApiKey, 'tvly-quoted');
});
