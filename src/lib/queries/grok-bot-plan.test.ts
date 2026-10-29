import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  grokBotPlanUsagePayload,
  parseGrokBotPlanUsage,
  type GrokBotPlanUsage,
} from '@/lib/grok-bot/plan-usage';

interface LiveResult {
  emptyCount: number;
  emptyError: string | null;
  unauthorizedStatus: number;
  unauthorizedError: string;
  wwwAuthenticate: string | null;
  wrongStatus: number;
  invalidStatus: number;
  invalidError: string;
  afterInvalidCount: number;
  tooBigStatus: number;
  createdStatus: number;
  createdKeys: string[];
  createdId: number;
  createdFlag: boolean;
  roundTrip: GrokBotPlanUsage;
  repeatStatus: number;
  repeatId: number;
  repeatCreated: boolean;
  updatedStatus: number;
  updatedId: number;
  updatedCreated: boolean;
  updatedPlan: string;
  selectedPlan: string;
  selectedWeekly: number;
  otherId: number;
  laterId: number;
  latestId: number;
  latestWeekly: number;
  missingNotice: string | null;
  missingHasSnapshot: boolean;
  junkWeekly: number;
  recentCount: number;
  columns: string[];
  payloadHasToken: boolean;
  payloadHasDeletedRoutines: boolean;
}

test('plan usage ingest stores snapshots and reads them back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grok-plan-'));
  const dbPath = join(dir, 'plan.db');
  const result = spawnSync(process.execPath, [
    '--conditions=react-server',
    '--import', 'tsx',
    'src/lib/queries/grok-bot-plan.live.ts',
  ], {
    cwd: '/workspace',
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${dbPath}`,
      GROK_BOT_INGEST_SECRET: 'test-secret',
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const line = result.stdout.trim().split('\n').filter((entry) => entry.startsWith('{')).at(-1);
  assert.ok(line, result.stdout);
  const payload = JSON.parse(line) as LiveResult;

  assert.equal(payload.emptyError, null);
  assert.equal(payload.emptyCount, 0);
  assert.equal(payload.unauthorizedStatus, 401);
  assert.equal(payload.unauthorizedError, 'Unauthorized.');
  assert.equal(payload.wwwAuthenticate, 'Bearer');
  assert.equal(payload.wrongStatus, 401);
  assert.equal(payload.invalidStatus, 400);
  assert.match(payload.invalidError, /captured_at/);
  assert.equal(payload.afterInvalidCount, 0);
  assert.equal(payload.tooBigStatus, 413);

  assert.equal(payload.createdStatus, 201);
  assert.equal(payload.createdFlag, true);
  assert.deepEqual(payload.createdKeys.sort(), [
    'capturedAt',
    'created',
    'id',
    'plan',
    'weeklyUsagePercentUsed',
  ]);

  const sample = parseGrokBotPlanUsage(JSON.parse(readFileSync(
    resolve('src/lib/grok-bot/fixtures/plan-usage-sample.json'),
    'utf8',
  )));
  assert.ok(sample.data);
  assert.deepEqual(grokBotPlanUsagePayload(payload.roundTrip), grokBotPlanUsagePayload(sample.data));

  assert.equal(payload.repeatStatus, 200);
  assert.equal(payload.repeatCreated, false);
  assert.equal(payload.repeatId, payload.createdId);
  assert.equal(payload.updatedStatus, 200);
  assert.equal(payload.updatedCreated, false);
  assert.equal(payload.updatedId, payload.createdId);
  assert.equal(payload.updatedPlan, 'Cursor Pro');
  assert.equal(payload.selectedPlan, 'Cursor Pro');
  assert.equal(payload.selectedWeekly, 30);
  assert.notEqual(payload.otherId, payload.createdId);
  assert.notEqual(payload.laterId, payload.otherId);
  assert.equal(payload.latestId, payload.laterId);
  assert.equal(payload.latestWeekly, 22);
  assert.equal(payload.recentCount, 3);
  assert.equal(payload.missingNotice, 'Plan capture not found.');
  assert.equal(payload.missingHasSnapshot, false);
  assert.equal(payload.junkWeekly, 22);
  assert.equal(payload.payloadHasToken, false);
  assert.equal(payload.payloadHasDeletedRoutines, true);
  assert.equal(payload.columns.includes('payload_json'), true);
  assert.equal(payload.columns.includes('weekly_usage_percent_used'), true);
  assert.equal(payload.columns.some((name) => name.toLowerCase().includes('token')), false);
});
