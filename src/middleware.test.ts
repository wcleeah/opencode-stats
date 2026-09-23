import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { middleware } from './middleware';
import { STATS_SOURCE_COOKIE } from './lib/source-mode';

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

function locationPath(response: Response): string {
  const location = response.headers.get('location');
  assert.ok(location, 'expected Location header');
  return new URL(location).pathname;
}

test('middleware redirects / to /saas and sets the saas cookie', () => {
  const response = middleware(request('/'));
  assert.equal(response.status, 307);
  assert.equal(locationPath(response), '/saas');
  assert.equal(response.cookies.get(STATS_SOURCE_COOKIE)?.value, 'saas');
});

test('middleware keeps /saas on the saas source', () => {
  const response = middleware(request('/saas'));
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get(STATS_SOURCE_COOKIE)?.value, 'saas');
});

test('middleware stamps opencode on /opencode', () => {
  const response = middleware(request('/opencode'));
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get(STATS_SOURCE_COOKIE)?.value, 'opencode');
});

test('middleware still aliases /mcp to /saas', () => {
  const response = middleware(request('/mcp'));
  assert.equal(response.status, 307);
  assert.equal(locationPath(response), '/saas');
  assert.equal(response.cookies.get(STATS_SOURCE_COOKIE)?.value, 'saas');
});
