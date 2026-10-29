import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { POST } from '@/app/api/cursor/grok/usage/route';
import { queryAll, queryOne } from '@/lib/db';
import { getGrokBotPlanView } from '@/lib/queries/grok-bot-plan';
import type { GrokBotPlanUsage } from '@/lib/grok-bot/plan-usage';

const SECRET = process.env.GROK_BOT_INGEST_SECRET ?? '';
const RAW = readFileSync(
  resolve('src/lib/grok-bot/fixtures/plan-usage-sample.json'),
  'utf8',
);

interface MutableSample {
  captured_at: string;
  source: string;
  plan: string;
  weekly_usage_percent_used: number;
  reports: unknown[];
}

interface PostResult {
  status: number;
  payload: Record<string, unknown>;
  wwwAuthenticate: string | null;
}

async function post(
  body: string,
  authorization: string | null,
): Promise<PostResult> {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (authorization !== null) headers.set('authorization', authorization);
  const response = await POST(new Request('http://localhost/api/cursor/grok/usage', {
    method: 'POST',
    headers,
    body,
  }));
  const payload = await response.json() as Record<string, unknown>;
  return {
    status: response.status,
    payload,
    wwwAuthenticate: response.headers.get('www-authenticate'),
  };
}

function saved(result: PostResult): {
  id: number;
  created: boolean;
  plan: string;
  weeklyUsagePercentUsed: number;
  keys: string[];
} {
  const data = result.payload.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`missing data: ${JSON.stringify(result.payload)}`);
  }
  const record = data as Record<string, unknown>;
  return {
    id: Number(record.id),
    created: record.created === true,
    plan: String(record.plan),
    weeklyUsagePercentUsed: Number(record.weeklyUsagePercentUsed),
    keys: Object.keys(record),
  };
}

async function main(): Promise<void> {
  const sample = JSON.parse(RAW) as MutableSample;
  const empty = await getGrokBotPlanView({});
  const unauthorized = await post(RAW, null);
  const wrong = await post(RAW, 'Bearer wrong-secret');
  const invalid = await post(JSON.stringify({ schema_version: 1 }), `Bearer ${SECRET}`);
  const afterInvalid = await getGrokBotPlanView({});
  const tooBig = await post(
    `{"schema_version":1${' '.repeat(600 * 1024)}}`,
    `Bearer ${SECRET}`,
  );
  const created = await post(RAW, `Bearer ${SECRET}`);
  const createdData = saved(created);
  const roundTripView = await getGrokBotPlanView({});
  const roundTrip = roundTripView.data?.snapshot?.usage ?? null;

  const repeat = await post(RAW, `bearer ${SECRET}`);
  const repeatData = saved(repeat);

  const updatedSample = structuredClone(sample);
  updatedSample.plan = 'Cursor Pro';
  updatedSample.weekly_usage_percent_used = 30;
  const updated = await post(JSON.stringify(updatedSample), `Bearer ${SECRET}`);
  const updatedData = saved(updated);

  const other = structuredClone(sample);
  other.source = 'grok_bot_other_snapshot';
  other.reports = [];
  const otherResult = saved(await post(JSON.stringify(other), `Bearer ${SECRET}`));

  const later = structuredClone(sample);
  later.captured_at = '2026-10-30T03:00:00+08:00';
  later.weekly_usage_percent_used = 22;
  later.reports = [];
  const laterResult = saved(await post(JSON.stringify(later), `Bearer ${SECRET}`));

  const latest = await getGrokBotPlanView({});
  const selected = await getGrokBotPlanView({ capture: String(createdData.id) });
  const missing = await getGrokBotPlanView({ capture: '999999' });
  const junk = await getGrokBotPlanView({ capture: 'nope' });

  const columnsResult = await queryAll<{ name: string }>(
    'PRAGMA table_info(grok_bot_plan_snapshots)',
  );
  const stored = await queryOne<{ payload_json: string }>(
    'SELECT payload_json FROM grok_bot_plan_snapshots WHERE id = ?',
    [createdData.id],
  );
  const payloadJson = stored.data?.payload_json ?? '';

  console.log(JSON.stringify({
    emptyCount: empty.data?.recent.length ?? -1,
    emptyError: empty.error,
    unauthorizedStatus: unauthorized.status,
    unauthorizedError: unauthorized.payload.error ?? null,
    wwwAuthenticate: unauthorized.wwwAuthenticate,
    wrongStatus: wrong.status,
    invalidStatus: invalid.status,
    invalidError: invalid.payload.error ?? null,
    afterInvalidCount: afterInvalid.data?.recent.length ?? -1,
    tooBigStatus: tooBig.status,
    createdStatus: created.status,
    createdKeys: createdData.keys,
    createdId: createdData.id,
    createdFlag: createdData.created,
    roundTrip,
    repeatStatus: repeat.status,
    repeatId: repeatData.id,
    repeatCreated: repeatData.created,
    updatedStatus: updated.status,
    updatedId: updatedData.id,
    updatedCreated: updatedData.created,
    updatedPlan: updatedData.plan,
    selectedPlan: selected.data?.snapshot?.usage.plan ?? null,
    selectedWeekly: selected.data?.snapshot?.usage.weeklyUsagePercentUsed ?? null,
    otherId: otherResult.id,
    laterId: laterResult.id,
    latestId: latest.data?.selectedId ?? null,
    latestWeekly: latest.data?.snapshot?.usage.weeklyUsagePercentUsed ?? null,
    missingNotice: missing.data?.notice ?? null,
    missingHasSnapshot: missing.data?.snapshot !== null && missing.data?.snapshot !== undefined,
    junkWeekly: junk.data?.snapshot?.usage.weeklyUsagePercentUsed ?? null,
    recentCount: latest.data?.recent.length ?? -1,
    columns: (columnsResult.data ?? []).map((row) => row.name),
    payloadHasToken: payloadJson.toLowerCase().includes('token'),
    payloadHasDeletedRoutines: payloadJson.includes('Deleted routines'),
  } satisfies {
    roundTrip: GrokBotPlanUsage | null;
    [key: string]: unknown;
  }));
}

function isDirectRun(): boolean {
  const entry = process.argv[1] ?? '';
  return entry.endsWith('grok-bot-plan.live.ts');
}

if (isDirectRun()) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
