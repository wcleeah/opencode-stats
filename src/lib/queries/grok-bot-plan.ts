import 'server-only';

import { execute, queryAll, queryOne } from '@/lib/db';
import { ensureGrokBotPlanSchema } from '@/lib/grok-bot/plan-schema';
import {
  grokBotPlanUsagePayload,
  parseGrokBotPlanCapture,
  parseGrokBotPlanUsage,
  type GrokBotPlanSnapshotSummary,
  type GrokBotPlanUsage,
  type GrokBotPlanView,
} from '@/lib/grok-bot/plan-usage';

const RECENT_LIMIT = 8;

export interface SavedGrokBotPlanUsage {
  id: number;
  created: boolean;
  capturedAt: string;
  plan: string;
  weeklyUsagePercentUsed: number;
}

export interface GrokBotPlanQueryResult {
  data: GrokBotPlanView | null;
  error: string | null;
}

interface SummaryRow {
  id: number | bigint;
  captured_at: string;
  captured_at_ms: number | bigint;
  plan: string;
  weekly_usage_percent_used: number | bigint;
}

interface PayloadRow {
  id: number | bigint;
  received_at: number | bigint;
  payload_json: string;
}

interface IdRow {
  id: number | bigint;
}

export async function saveGrokBotPlanUsage(
  usage: GrokBotPlanUsage,
  receivedAt: number = Date.now(),
): Promise<{ data: SavedGrokBotPlanUsage | null; error: string | null }> {
  return writeGrokBotPlanUsage(usage, receivedAt, 0);
}

export async function getGrokBotPlanView(
  query: { capture?: string },
): Promise<GrokBotPlanQueryResult> {
  const schema = await ensureGrokBotPlanSchema();
  if (schema.error) return { data: null, error: schema.error };

  const recentResult = await queryAll<SummaryRow>(
    `SELECT id, captured_at, captured_at_ms, plan, weekly_usage_percent_used
     FROM grok_bot_plan_snapshots
     ORDER BY captured_at_ms DESC, id DESC
     LIMIT ?`,
    [RECENT_LIMIT],
  );
  if (recentResult.error || !recentResult.data) {
    return { data: null, error: recentResult.error ?? 'Failed to load plan usage.' };
  }

  const recent = recentResult.data.map(mapSummary);
  const latestId = recent[0]?.id ?? null;
  const requested = parseGrokBotPlanCapture(query.capture);
  const selectedId = requested ?? latestId;

  if (selectedId === null) {
    return {
      data: { snapshot: null, recent, selectedId: null, latestId: null, notice: null },
      error: null,
    };
  }

  const rowResult = await queryOne<PayloadRow>(
    `SELECT id, received_at, payload_json
     FROM grok_bot_plan_snapshots
     WHERE id = ?`,
    [selectedId],
  );
  if (rowResult.error) return { data: null, error: rowResult.error };
  if (!rowResult.data) {
    return {
      data: {
        snapshot: null,
        recent,
        selectedId: null,
        latestId,
        notice: 'Plan capture not found.',
      },
      error: null,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rowResult.data.payload_json) as unknown;
  } catch {
    return { data: null, error: 'Stored plan usage is not valid JSON.' };
  }
  const parsed = parseGrokBotPlanUsage(parsedJson);
  if (!parsed.data) {
    return { data: null, error: parsed.error ?? 'Stored plan usage is invalid.' };
  }

  const chips = recent.some((item) => item.id === selectedId)
    ? recent
    : [
        {
          id: selectedId,
          capturedAt: parsed.data.capturedAt,
          capturedAtMs: parsed.data.capturedAtMs,
          plan: parsed.data.plan,
          weeklyUsagePercentUsed: parsed.data.weeklyUsagePercentUsed,
        },
        ...recent,
      ].sort(byRecent);

  return {
    data: {
      snapshot: {
        id: selectedId,
        receivedAt: asNumber(rowResult.data.received_at),
        usage: parsed.data,
      },
      recent: chips,
      selectedId,
      latestId,
      notice: null,
    },
    error: null,
  };
}

async function writeGrokBotPlanUsage(
  usage: GrokBotPlanUsage,
  receivedAt: number,
  attempt: number,
): Promise<{ data: SavedGrokBotPlanUsage | null; error: string | null }> {
  const schema = await ensureGrokBotPlanSchema();
  if (schema.error) return { data: null, error: schema.error };

  const payload = JSON.stringify(grokBotPlanUsagePayload(usage));
  const existing = await queryOne<IdRow>(
    `SELECT id FROM grok_bot_plan_snapshots WHERE source = ? AND captured_at = ?`,
    [usage.source, usage.capturedAt],
  );
  if (existing.error) return { data: null, error: existing.error };

  if (existing.data) {
    const id = asNumber(existing.data.id);
    const updated = await execute(
      `UPDATE grok_bot_plan_snapshots SET
        schema_version = ?,
        captured_at_ms = ?,
        plan = ?,
        weekly_usage_percent_used = ?,
        reset_timezone = ?,
        reset_label = ?,
        reset_iso_approx = ?,
        on_demand_monthly_limit = ?,
        on_demand_amount = ?,
        payload_json = ?,
        received_at = ?
       WHERE id = ?`,
      [
        usage.schemaVersion,
        usage.capturedAtMs,
        usage.plan,
        usage.weeklyUsagePercentUsed,
        usage.resetAt.timezone,
        usage.resetAt.label,
        usage.resetAt.isoApprox,
        usage.onDemand.monthlyLimit,
        usage.onDemand.amount,
        payload,
        receivedAt,
        id,
      ],
    );
    if (updated.error) return { data: null, error: updated.error };
    return { data: ack(id, false, usage), error: null };
  }

  const inserted = await execute(
    `INSERT INTO grok_bot_plan_snapshots (
      schema_version, captured_at, captured_at_ms, source, plan,
      weekly_usage_percent_used, reset_timezone, reset_label, reset_iso_approx,
      on_demand_monthly_limit, on_demand_amount, payload_json, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usage.schemaVersion,
      usage.capturedAt,
      usage.capturedAtMs,
      usage.source,
      usage.plan,
      usage.weeklyUsagePercentUsed,
      usage.resetAt.timezone,
      usage.resetAt.label,
      usage.resetAt.isoApprox,
      usage.onDemand.monthlyLimit,
      usage.onDemand.amount,
      payload,
      receivedAt,
    ],
  );
  if (inserted.error) {
    if (attempt === 0 && isUniqueViolation(inserted.error)) {
      return writeGrokBotPlanUsage(usage, receivedAt, 1);
    }
    return { data: null, error: inserted.error };
  }
  const id = Number(inserted.data?.lastInsertRowid);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { data: null, error: 'Plan usage was stored without an id.' };
  }
  return { data: ack(id, true, usage), error: null };
}

function ack(id: number, created: boolean, usage: GrokBotPlanUsage): SavedGrokBotPlanUsage {
  return {
    id,
    created,
    capturedAt: usage.capturedAt,
    plan: usage.plan,
    weeklyUsagePercentUsed: usage.weeklyUsagePercentUsed,
  };
}

function mapSummary(row: SummaryRow): GrokBotPlanSnapshotSummary {
  return {
    id: asNumber(row.id),
    capturedAt: row.captured_at,
    capturedAtMs: asNumber(row.captured_at_ms),
    plan: row.plan,
    weeklyUsagePercentUsed: asNumber(row.weekly_usage_percent_used),
  };
}

function byRecent(left: GrokBotPlanSnapshotSummary, right: GrokBotPlanSnapshotSummary): number {
  return right.capturedAtMs - left.capturedAtMs || right.id - left.id;
}

function asNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function isUniqueViolation(error: string): boolean {
  return error.toLowerCase().includes('unique');
}
