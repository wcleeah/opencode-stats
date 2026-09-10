import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXA_ADMIN_API_BASE, EXA_SEARCH_API_URL } from '@/lib/mcp/constants';
import {
  EXA_INVALID_KEY_HINT,
  EXA_SEARCH_KEY_HINT,
  classifyExaUnauthorized,
  fetchExaUsage,
  resolveExaApiKeyId,
} from '@/lib/mcp/exa';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('fetchExaUsage retries Authorization Bearer after x-api-key 401', async () => {
  const calls: Array<{ url: string; apiKey?: string; authorization?: string }> = [];
  const result = await fetchExaUsage({
    serviceKey: 'exa-test',
    apiKeyId: 'key-1',
    startIso: '2026-09-01T00:00:00.000Z',
    endIso: '2026-09-15T00:00:00.000Z',
    fetchFn: async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        apiKey: headers.get('x-api-key') ?? undefined,
        authorization: headers.get('authorization') ?? undefined,
      });
      if (headers.get('x-api-key')) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      return jsonResponse({ api_key_id: 'key-1', total_cost_usd: 2.25, cost_breakdown: [] }, 200);
    },
  });

  assert.equal(result.error, null);
  assert.equal(result.data?.totalCostUsd, 2.25);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].apiKey, 'exa-test');
  assert.equal(calls[1].authorization, 'Bearer exa-test');
});

test('resolveExaApiKeyId explains search keys rejected by Team Management', async () => {
  const result = await resolveExaApiKeyId({
    serviceKey: 'search-key',
    configuredId: null,
    fetchFn: async (input, init) => {
      const url = String(input);
      if (url.startsWith(EXA_ADMIN_API_BASE)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      if (url === EXA_SEARCH_API_URL) {
        assert.equal(init?.method, 'POST');
        return jsonResponse({ error: 'Missing query' }, 400);
      }
      throw new Error(`unexpected url ${url}`);
    },
  });

  assert.equal(result.data, null);
  assert.equal(result.error, EXA_SEARCH_KEY_HINT);
});

test('classifyExaUnauthorized treats search 401 as an invalid key', async () => {
  const message = await classifyExaUnauthorized({
    serviceKey: 'bad-key',
    fetchFn: async () => jsonResponse({ error: 'Unauthorized' }, 401),
  });
  assert.equal(message, EXA_INVALID_KEY_HINT);
});
