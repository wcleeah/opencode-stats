import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CURSOR_AGENTS_API_URL,
  DEFAULT_CURSOR_AGENT_REPO_URL,
  UPDATE_PRICING_AGENT_NAME,
  UPDATE_PRICING_PROMPT,
  buildUpdatePricingAgentBody,
  launchPricingAgent,
  normalizeGithubRepoUrl,
  parseCreateAgentResponse,
  readCursorAgentEnv,
} from './agent';

test('normalizeGithubRepoUrl accepts github https urls and strips .git', () => {
  assert.equal(
    normalizeGithubRepoUrl('https://github.com/wcleeah/opencode-stats'),
    'https://github.com/wcleeah/opencode-stats',
  );
  assert.equal(
    normalizeGithubRepoUrl('github.com/wcleeah/opencode-stats.git'),
    'https://github.com/wcleeah/opencode-stats',
  );
});

test('normalizeGithubRepoUrl rejects non-github and credentialed urls', () => {
  assert.equal(normalizeGithubRepoUrl(''), null);
  assert.equal(normalizeGithubRepoUrl('https://gitlab.com/acme/repo'), null);
  assert.equal(normalizeGithubRepoUrl('https://user:pass@github.com/acme/repo'), null);
  assert.equal(normalizeGithubRepoUrl('http://github.com/acme/repo'), null);
});

test('readCursorAgentEnv requires CURSOR_API_KEY and defaults the repo', () => {
  const missing = readCursorAgentEnv({});
  assert.equal(missing.configured, false);
  assert.equal(missing.apiKey, null);
  assert.equal(missing.repoUrl, DEFAULT_CURSOR_AGENT_REPO_URL);
  assert.equal(missing.startingRef, 'main');

  const ready = readCursorAgentEnv({
    CURSOR_API_KEY: 'Bearer  sk-test ',
    CURSOR_AGENT_REPO_URL: 'github.com/acme/stats.git',
    CURSOR_AGENT_STARTING_REF: 'develop',
  });
  assert.equal(ready.configured, true);
  assert.equal(ready.apiKey, 'sk-test');
  assert.equal(ready.repoUrl, 'https://github.com/acme/stats');
  assert.equal(ready.startingRef, 'develop');
});

test('parseCreateAgentResponse reads nested agent and run ids', () => {
  const parsed = parseCreateAgentResponse({
    agent: {
      id: 'bc-abc',
      url: 'https://cursor.com/agents/bc-abc',
    },
    run: { id: 'run-1' },
  });
  assert.deepEqual(parsed, {
    agentId: 'bc-abc',
    agentUrl: 'https://cursor.com/agents/bc-abc',
    runId: 'run-1',
  });
});

test('parseCreateAgentResponse synthesizes agent url when omitted', () => {
  const parsed = parseCreateAgentResponse({ id: 'bc-xyz' });
  assert.deepEqual(parsed, {
    agentId: 'bc-xyz',
    agentUrl: 'https://cursor.com/agents/bc-xyz',
    runId: null,
  });
});

test('launchPricingAgent refuses to call Cursor without an API key', async () => {
  const calls: unknown[] = [];
  const result = await launchPricingAgent(readCursorAgentEnv({}), async (...args) => {
    calls.push(args);
    return new Response('{}', { status: 200 });
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 503);
  assert.match(result.error, /CURSOR_API_KEY/);
  assert.equal(calls.length, 0);
});

test('launchPricingAgent posts the pricing prompt and returns the agent url', async () => {
  const env = readCursorAgentEnv({
    CURSOR_API_KEY: 'sk-live',
    CURSOR_AGENT_REPO_URL: 'https://github.com/wcleeah/opencode-stats',
  });
  const expectedBody = buildUpdatePricingAgentBody(env);
  assert.equal(expectedBody.name, UPDATE_PRICING_AGENT_NAME);
  assert.equal(expectedBody.prompt.text, UPDATE_PRICING_PROMPT);
  assert.equal(expectedBody.autoCreatePR, true);

  const result = await launchPricingAgent(env, async (url, init) => {
    assert.equal(url, CURSOR_AGENTS_API_URL);
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Authorization'), 'Bearer sk-live');
    assert.equal(init?.body, JSON.stringify(expectedBody));
    return Response.json({
      agent: {
        id: 'bc-019',
        url: 'https://cursor.com/agents/bc-019',
      },
      run: { id: 'run-019' },
    });
  });

  assert.deepEqual(result, {
    ok: true,
    agent: {
      agentId: 'bc-019',
      agentUrl: 'https://cursor.com/agents/bc-019',
      runId: 'run-019',
    },
  });
});

test('launchPricingAgent surfaces Cursor API errors', async () => {
  const env = readCursorAgentEnv({ CURSOR_API_KEY: 'sk-bad' });
  const result = await launchPricingAgent(env, async () =>
    Response.json({ error: { message: 'Invalid API key' } }, { status: 401 }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 401);
  assert.equal(result.error, 'Invalid API key');
});
