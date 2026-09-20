import test from 'node:test';
import assert from 'node:assert/strict';

import { getUtcCalendarMonth, utcDayKey } from './calendar';
import { lastSnapshotPerUtcDay } from './history';
import {
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

test('lastSnapshotPerUtcDay keeps the last poll of each UTC day', () => {
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
  };
  const later: McpUsageSnapshot = {
    ...empty,
    id: 2,
    fetched_at: Date.UTC(2026, 8, 2, 18),
    tavily_plan_usage: 40,
  };
  const nextDay: McpUsageSnapshot = {
    ...empty,
    id: 3,
    fetched_at: Date.UTC(2026, 8, 3, 1),
    tavily_plan_usage: 41,
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

test('readMcpEnvConfig reads Tavily and ignores Exa keys', () => {
  const a = readMcpEnvConfig({
    TAVILY_API_KEY: ' tvly-x ',
    EXA_API_KEY: 'exa-secret',
  });
  assert.equal(a.tavilyConfigured, true);
  assert.equal(a.tavilyApiKey, 'tvly-x');
  assert.equal('exaConfigured' in a, false);

  const b = readMcpEnvConfig({
    EXA_SERVICE_KEY: 'svc',
  });
  assert.equal(b.tavilyConfigured, false);

  const quoted = readMcpEnvConfig({
    TAVILY_API_KEY: "'tvly-quoted'",
  });
  assert.equal(quoted.tavilyApiKey, 'tvly-quoted');
});
