import { grokBotModelSql } from '@/lib/grok-bot/membership';

/** Cursor does not bill these rows against usage pools. */
export const UNBILLED_PREDICATE =
  `(lower(kind) LIKE '%error%' OR lower(ifnull(cost_raw, '')) = 'free' OR lower(kind) = 'free')`;

const BILLABLE_PREDICATE = `NOT ${UNBILLED_PREDICATE}`;

export const CURSOR_EVENT_AGGREGATES = [
  'global',
  'daily',
  'model',
  'agent',
  'eventCost',
  'dailyModel',
] as const;

export type CursorEventAggregate = (typeof CURSOR_EVENT_AGGREGATES)[number];

function rangeWhere(
  column: string,
  startMs?: number,
  endMs?: number,
): { clause: string; args: number[] } {
  const conditions: string[] = [];
  const args: number[] = [];

  if (startMs !== undefined) {
    conditions.push(`${column} >= ?`);
    args.push(startMs);
  }
  if (endMs !== undefined) {
    conditions.push(`${column} <= ?`);
    args.push(endMs);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    args,
  };
}

function andWhere(
  range: { clause: string; args: number[] },
  extraSql: string,
): { clause: string; args: number[] } {
  if (range.clause) {
    return { clause: `${range.clause} AND ${extraSql}`, args: range.args };
  }
  return { clause: `WHERE ${extraSql}`, args: [] };
}

/** Time range plus the negated grok-bot membership test. This is the only exclusion. */
export function cursorEventWhere(
  startMs?: number,
  endMs?: number,
): { clause: string; args: number[] } {
  return andWhere(
    rangeWhere('event_at', startMs, endMs),
    `NOT (${grokBotModelSql('model')})`,
  );
}

/** WHERE text each agent-board aggregate runs. Global stats skip the billable predicate. */
export function cursorAggregateWhere(
  aggregate: CursorEventAggregate,
  startMs?: number,
  endMs?: number,
): { clause: string; args: number[] } {
  const events = cursorEventWhere(startMs, endMs);
  if (aggregate === 'global') return events;
  const billable = andWhere(events, BILLABLE_PREDICATE);
  if (aggregate === 'agent') {
    return {
      clause: `${billable.clause} AND cloud_agent_id IS NOT NULL AND cloud_agent_id != ''`,
      args: billable.args,
    };
  }
  return billable;
}
