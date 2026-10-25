import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('settings PUT requires the grok clock and keeps a saved clock', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grok-settings-'));
  const dbPath = join(dir, 'settings.db');
  const runner = join(dir, 'run.ts');
  writeFileSync(runner, `
    import { GET, PUT } from '/workspace/src/app/api/cursor/settings/route.ts';

    async function put(body: unknown): Promise<{ status: number; payload: Record<string, unknown> }> {
      const response = await PUT(new Request('http://localhost/api/cursor/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }));
      const payload = await response.json() as Record<string, unknown>;
      return { status: response.status, payload };
    }

    async function readClock(): Promise<Record<string, unknown>> {
      const response = await GET();
      const payload = await response.json() as { data: Record<string, unknown> };
      return payload.data;
    }

    const base = {
      planAmountUsd: 200,
      includedPoolUsd: 400,
      cursorModelsIncludedUsd: 2000,
      billingCycleStartDay: 1,
    };

    async function main(): Promise<void> {
    const fresh = await readClock();
    const missing = await put(base);
    const afterMissing = await readClock();
    const saved = await put({
      ...base,
      grokCycleWeekday: 'thursday',
      grokCycleHour: 9,
      grokCycleMinute: 15,
    });
    const again = await put({
      ...base,
      grokCycleWeekday: 'thursday',
      grokCycleHour: 9,
      grokCycleMinute: 15,
    });
    const omitted = await put(base);
    const afterOmit = await readClock();
    const savedData = saved.payload.data as Record<string, unknown>;
    const againData = again.payload.data as Record<string, unknown>;

    console.log(JSON.stringify({
      freshWeekday: fresh.grok_cycle_weekday,
      freshHour: fresh.grok_cycle_hour,
      freshMinute: fresh.grok_cycle_minute,
      missingStatus: missing.status,
      missingError: missing.payload.error,
      afterMissingWeekday: afterMissing.grok_cycle_weekday,
      savedStatus: saved.status,
      weekday: savedData.grok_cycle_weekday,
      hour: savedData.grok_cycle_hour,
      minute: savedData.grok_cycle_minute,
      againStatus: again.status,
      againWeekday: againData.grok_cycle_weekday,
      omittedStatus: omitted.status,
      afterOmitWeekday: afterOmit.grok_cycle_weekday,
      afterOmitHour: afterOmit.grok_cycle_hour,
      afterOmitMinute: afterOmit.grok_cycle_minute,
    }));
    }

    main().catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
  `);

  const result = spawnSync(process.execPath, [
    '--conditions=react-server',
    '--import', 'tsx',
    runner,
  ], {
    cwd: '/workspace',
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${dbPath}`,
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const line = result.stdout.trim().split('\n').filter((entry) => entry.startsWith('{')).at(-1);
  assert.ok(line, result.stdout);
  const payload = JSON.parse(line) as {
    freshWeekday: string;
    freshHour: number;
    freshMinute: number;
    missingStatus: number;
    missingError: string;
    afterMissingWeekday: string;
    savedStatus: number;
    weekday: string;
    hour: number;
    minute: number;
    againStatus: number;
    againWeekday: string;
    omittedStatus: number;
    afterOmitWeekday: string;
    afterOmitHour: number;
    afterOmitMinute: number;
  };
  assert.equal(payload.freshWeekday, 'wednesday');
  assert.equal(payload.freshHour, 11);
  assert.equal(payload.freshMinute, 30);
  assert.equal(payload.missingStatus, 400);
  assert.equal(payload.missingError, 'Invalid grok cycle clock.');
  assert.equal(payload.afterMissingWeekday, 'wednesday');
  assert.equal(payload.savedStatus, 200);
  assert.equal(payload.weekday, 'thursday');
  assert.equal(payload.hour, 9);
  assert.equal(payload.minute, 15);
  assert.equal(payload.againStatus, 200);
  assert.equal(payload.againWeekday, 'thursday');
  assert.equal(payload.omittedStatus, 400);
  assert.equal(payload.afterOmitWeekday, 'thursday');
  assert.equal(payload.afterOmitHour, 9);
  assert.equal(payload.afterOmitMinute, 15);
});
