export const GROK_BOT_WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type GrokBotWeekday = (typeof GROK_BOT_WEEKDAYS)[number];

export const GROK_BOT_CYCLE_TIME_ZONE = 'Asia/Hong_Kong' as const;

export interface GrokBotCycleClock {
  weekday: GrokBotWeekday;
  /** 0 through 23 in `timeZone`. */
  hour: number;
  /** 0 through 59 in `timeZone`. */
  minute: number;
  timeZone: typeof GROK_BOT_CYCLE_TIME_ZONE;
}

export const DEFAULT_GROK_BOT_CYCLE: GrokBotCycleClock = {
  weekday: 'wednesday',
  hour: 11,
  minute: 30,
  timeZone: GROK_BOT_CYCLE_TIME_ZONE,
};

export interface GrokBotCycleBounds {
  /** Inclusive. An event at this instant belongs to this cycle. */
  startMs: number;
  /** Inclusive. One millisecond before the next cycle start. */
  endMs: number;
  label: string;
}

export interface GrokBotWallTime {
  year: number;
  /** 1 through 12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: GrokBotWeekday;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_SPAN_MS = 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const SQL_COLUMN = /^[A-Za-z_]+$/;

function isWeekday(value: string): value is GrokBotWeekday {
  return (GROK_BOT_WEEKDAYS as readonly string[]).includes(value);
}

function parseUnit(value: unknown, max: number): number | null {
  if (typeof value === 'bigint') {
    if (value < BigInt(0) || value > BigInt(max)) return null;
    return Number(value);
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || value > max) return null;
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed > max) return null;
    return parsed;
  }
  return null;
}

export function parseGrokBotCycleClock(input: {
  weekday: unknown;
  hour: unknown;
  minute: unknown;
}): GrokBotCycleClock | null {
  if (typeof input.weekday !== 'string') return null;
  const weekday = input.weekday.trim().toLowerCase();
  if (!isWeekday(weekday)) return null;
  const hour = parseUnit(input.hour, 23);
  const minute = parseUnit(input.minute, 59);
  if (hour === null || minute === null) return null;
  return {
    weekday,
    hour,
    minute,
    timeZone: GROK_BOT_CYCLE_TIME_ZONE,
  };
}

function formatterFor(
  timeZone: typeof GROK_BOT_CYCLE_TIME_ZONE,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  });
}

interface ZonedParts extends GrokBotWallTime {
  second: number;
}

function readZonedParts(
  utcMs: number,
  timeZone: typeof GROK_BOT_CYCLE_TIME_ZONE,
): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(utcMs));
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  let hour = Number(values.hour);
  if (hour === 24) hour = 0;
  const weekday = (values.weekday ?? '').toLowerCase();
  if (!isWeekday(weekday)) {
    throw new Error(`Unexpected weekday from ${timeZone}: ${weekday}`);
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour,
    minute: Number(values.minute),
    second: Number(values.second),
    weekday,
  };
}

function zoneOffsetMs(
  utcMs: number,
  timeZone: typeof GROK_BOT_CYCLE_TIME_ZONE,
): number {
  const parts = readZonedParts(utcMs, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - utcMs;
}

export function grokBotWallTimeToUtcMs(
  wall: Pick<GrokBotWallTime, 'year' | 'month' | 'day' | 'hour' | 'minute'>,
  timeZone: typeof GROK_BOT_CYCLE_TIME_ZONE,
): number {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0, 0);
  const corrected = guess - zoneOffsetMs(guess, timeZone);
  return guess - zoneOffsetMs(corrected, timeZone);
}

export function grokBotWallTimeFromUtcMs(
  utcMs: number,
  timeZone: typeof GROK_BOT_CYCLE_TIME_ZONE,
): GrokBotWallTime {
  const parts = readZonedParts(utcMs, timeZone);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    weekday: parts.weekday,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatGrokBotWallInput(utcMs: number): string {
  const wall = grokBotWallTimeFromUtcMs(utcMs, GROK_BOT_CYCLE_TIME_ZONE);
  return `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}T${pad2(wall.hour)}:${pad2(wall.minute)}`;
}

export function parseGrokBotWallInput(
  value: string,
): Pick<GrokBotWallTime, 'year' | 'month' | 'day' | 'hour' | 'minute'> | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return {
    year: Number(match[1]),
    month,
    day,
    hour,
    minute,
  };
}

function weekdayAbbrev(weekday: GrokBotWeekday): string {
  return weekday.charAt(0).toUpperCase() + weekday.slice(1, 3);
}

export function formatGrokBotWallDate(wall: GrokBotWallTime): string {
  const month = MONTHS[wall.month - 1] ?? '';
  return `${weekdayAbbrev(wall.weekday)} ${wall.day} ${month} ${wall.year}`;
}

export function formatGrokBotWallTime(wall: GrokBotWallTime): string {
  return `${formatGrokBotWallDate(wall)} ${pad2(wall.hour)}:${pad2(wall.minute)}`;
}

function shiftCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0) + days * DAY_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function calendarDaysBetween(
  from: { year: number; month: number; day: number },
  to: { year: number; month: number; day: number },
): number {
  const start = Date.UTC(from.year, from.month - 1, from.day, 12, 0, 0, 0);
  const end = Date.UTC(to.year, to.month - 1, to.day, 12, 0, 0, 0);
  return Math.round((end - start) / DAY_MS);
}

function clockInstant(
  date: { year: number; month: number; day: number },
  clock: GrokBotCycleClock,
): number {
  return grokBotWallTimeToUtcMs(
    { ...date, hour: clock.hour, minute: clock.minute },
    clock.timeZone,
  );
}

export function grokBotCycleBounds(
  clock: GrokBotCycleClock,
  anchor: Date = new Date(),
  offset: number = 0,
): GrokBotCycleBounds {
  const anchorWall = grokBotWallTimeFromUtcMs(anchor.getTime(), clock.timeZone);
  const daysBack = (
    GROK_BOT_WEEKDAYS.indexOf(anchorWall.weekday)
    - GROK_BOT_WEEKDAYS.indexOf(clock.weekday)
    + 7
  ) % 7;
  let date = shiftCalendarDays(anchorWall.year, anchorWall.month, anchorWall.day, -daysBack);
  let startMs = clockInstant(date, clock);
  if (anchor.getTime() < startMs) {
    date = shiftCalendarDays(date.year, date.month, date.day, -7);
    startMs = clockInstant(date, clock);
  }
  if (offset !== 0) {
    date = shiftCalendarDays(date.year, date.month, date.day, offset * 7);
    startMs = clockInstant(date, clock);
  }
  const nextDate = shiftCalendarDays(date.year, date.month, date.day, 7);
  const endMs = clockInstant(nextDate, clock) - 1;
  return {
    startMs,
    endMs,
    label: rangeLabel(startMs, endMs, clock.timeZone),
  };
}

export function grokBotPresentCycleLabel(
  clock: GrokBotCycleClock,
  now: Date,
): string {
  return grokBotCycleBounds(clock, now, 0).label;
}

export function grokBotNeighborCycleLabels(
  clock: GrokBotCycleClock,
  now: Date,
  viewedOffset: number,
): { readonly previous: string; readonly next: string } {
  return {
    previous: grokBotCycleBounds(clock, now, viewedOffset - 1).label,
    next: grokBotCycleBounds(clock, now, viewedOffset + 1).label,
  };
}

function rangeLabel(
  startMs: number,
  endMs: number,
  timeZone: typeof GROK_BOT_CYCLE_TIME_ZONE,
): string {
  const start = formatGrokBotWallTime(grokBotWallTimeFromUtcMs(startMs, timeZone));
  const end = formatGrokBotWallTime(grokBotWallTimeFromUtcMs(endMs, timeZone));
  return `${start} to ${end}`;
}

function shortLabelFor(
  utcMs: number,
  timeZone: typeof GROK_BOT_CYCLE_TIME_ZONE,
): string {
  return formatGrokBotWallDate(grokBotWallTimeFromUtcMs(utcMs, timeZone));
}

export interface GrokBotProjectedPrimary {
  readonly role: 'primary';
  readonly window: { readonly startMs: number; readonly endMs: number; readonly bucketMs: number };
  readonly label: string;
  readonly shortLabel: string;
}

export interface GrokBotProjectedCompare {
  readonly role: 'compare';
  readonly window: { readonly startMs: number; readonly endMs: number; readonly bucketMs: number };
  readonly label: string;
  readonly shortLabel: string;
}

export type GrokBotProjectedList = readonly [
  GrokBotProjectedPrimary,
  ...GrokBotProjectedCompare[],
];

export function projectGrokBotPeriods(input: {
  readonly clock: GrokBotCycleClock;
  readonly primary: GrokBotResolvedWindow;
  readonly compareStarts: readonly number[];
}): GrokBotProjectedList {
  const span = input.primary.window.endMs - input.primary.window.startMs;
  const bucketMs = input.primary.window.bucketMs;
  const primaryLabel = input.primary.mode.kind === 'cycle'
    ? input.primary.cycle.label
    : rangeLabel(input.primary.window.startMs, input.primary.window.endMs, input.clock.timeZone);
  const primary: GrokBotProjectedPrimary = {
    role: 'primary',
    window: input.primary.window,
    label: primaryLabel,
    shortLabel: shortLabelFor(input.primary.window.startMs, input.clock.timeZone),
  };
  const compared = input.compareStarts.map((startMs): GrokBotProjectedCompare => {
    const endMs = startMs + span;
    return {
      role: 'compare',
      window: { startMs, endMs, bucketMs },
      label: rangeLabel(startMs, endMs, input.clock.timeZone),
      shortLabel: shortLabelFor(startMs, input.clock.timeZone),
    };
  });
  return [primary, ...compared];
}

export function focusedBucketWallMs(
  primaryBucketStartMs: number,
  primaryStartMs: number,
  focusStartMs: number,
): number {
  return focusStartMs + (primaryBucketStartMs - primaryStartMs);
}

export function grokBotBucketTickLabel(
  utcMs: number,
  spanMs: number,
  timeZone: typeof GROK_BOT_CYCLE_TIME_ZONE,
): string {
  const wall = grokBotWallTimeFromUtcMs(utcMs, timeZone);
  const hh = pad2(wall.hour);
  const mm = pad2(wall.minute);
  if (spanMs <= SIX_HOURS_MS) return `${hh}:${mm}`;
  if (spanMs <= FORTY_EIGHT_HOURS_MS) return `${wall.day} ${hh}:${mm}`;
  return `${weekdayAbbrev(wall.weekday)} ${wall.day} ${hh}:${mm}`;
}

export function grokBotDayTickIndexes(
  pointCount: number,
  bucketMs: number,
  spanMs: number,
): readonly number[] | null {
  if (spanMs <= FORTY_EIGHT_HOURS_MS || pointCount <= 0 || bucketMs <= 0) return null;
  const step = Math.max(1, Math.round(DAY_MS / bucketMs));
  const indexes: number[] = [];
  for (let index = 0; index < pointCount; index += step) indexes.push(index);
  const last = pointCount - 1;
  if (indexes[indexes.length - 1] !== last) indexes.push(last);
  return indexes;
}

export type GrokBotWindowMode =
  | { kind: 'cycle'; offset: number }
  | { kind: 'range'; startMs: number; endMs: number };

export interface GrokBotResolvedWindow {
  mode: GrokBotWindowMode;
  window: { startMs: number; endMs: number; bucketMs: number };
  cycle: GrokBotCycleBounds & { offset: number };
}

function parseIntegerParam(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

function windowForCycle(
  clock: GrokBotCycleClock,
  now: Date,
  offset: number,
): GrokBotResolvedWindow {
  const bounds = grokBotCycleBounds(clock, now, offset);
  const span = bounds.endMs - bounds.startMs + 1;
  return {
    mode: { kind: 'cycle', offset },
    window: {
      startMs: bounds.startMs,
      endMs: bounds.endMs,
      bucketMs: grokBotBucketMs(span),
    },
    cycle: { ...bounds, offset },
  };
}

function cycleContaining(
  clock: GrokBotCycleClock,
  now: Date,
  instantMs: number,
): GrokBotCycleBounds & { offset: number } {
  const bounds = grokBotCycleBounds(clock, new Date(instantMs), 0);
  const nowBounds = grokBotCycleBounds(clock, now, 0);
  const from = grokBotWallTimeFromUtcMs(nowBounds.startMs, clock.timeZone);
  const to = grokBotWallTimeFromUtcMs(bounds.startMs, clock.timeZone);
  return {
    ...bounds,
    offset: calendarDaysBetween(from, to) / 7,
  };
}

export function resolveGrokBotWindow(input: {
  clock: GrokBotCycleClock;
  now: Date;
  cycle?: string;
  start?: string;
  end?: string;
}): GrokBotResolvedWindow {
  const cycleOffset = parseIntegerParam(input.cycle);
  if (cycleOffset !== null) {
    return windowForCycle(input.clock, input.now, cycleOffset);
  }

  const start = parseIntegerParam(input.start);
  const end = parseIntegerParam(input.end);
  if (start === null || end === null) {
    return windowForCycle(input.clock, input.now, 0);
  }

  const clipped = clipGrokBotWindow(start, end);
  const span = clipped.endMs - clipped.startMs + 1;
  return {
    mode: { kind: 'range', startMs: clipped.startMs, endMs: clipped.endMs },
    window: {
      startMs: clipped.startMs,
      endMs: clipped.endMs,
      bucketMs: grokBotBucketMs(span),
    },
    cycle: cycleContaining(input.clock, input.now, clipped.startMs),
  };
}

function inclusiveMinuteEndMs(minuteStartMs: number): number {
  return minuteStartMs + MINUTE_MS - 1;
}

export function clipGrokBotWindow(
  startMs: number,
  endMs: number,
): { readonly startMs: number; readonly endMs: number } {
  let start = startMs;
  let end = endMs;
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  const span = end - start + 1;
  if (span > WEEK_MS) {
    end = start + WEEK_MS - 1;
  } else if (span < MIN_SPAN_MS) {
    end = start + MIN_SPAN_MS - 1;
  }
  return { startMs: start, endMs: end };
}

export type GrokDraftClipReason = 'swapped' | 'max-span' | 'min-span';

export type GrokDraftRange =
  | {
      readonly ok: true;
      readonly startMs: number;
      readonly endMs: number;
      readonly reasons: readonly GrokDraftClipReason[];
    }
  | { readonly ok: false; readonly reason: 'incomplete' | 'invalid' };

export function parseGrokDraftRange(
  startValue: string,
  endValue: string,
): GrokDraftRange {
  if (startValue === '' || endValue === '') return { ok: false, reason: 'incomplete' };
  const startWall = parseGrokBotWallInput(startValue);
  const endWall = parseGrokBotWallInput(endValue);
  if (startWall === null || endWall === null) return { ok: false, reason: 'invalid' };
  let startMs = grokBotWallTimeToUtcMs(startWall, GROK_BOT_CYCLE_TIME_ZONE);
  let endMs = inclusiveMinuteEndMs(
    grokBotWallTimeToUtcMs(endWall, GROK_BOT_CYCLE_TIME_ZONE),
  );
  const reasons: GrokDraftClipReason[] = [];
  if (endMs < startMs) {
    reasons.push('swapped');
    const swap = startMs;
    startMs = endMs;
    endMs = swap;
  }
  const before = endMs - startMs;
  const clipped = clipGrokBotWindow(startMs, endMs);
  const after = clipped.endMs - clipped.startMs;
  if (after < before) reasons.push('max-span');
  else if (after > before) reasons.push('min-span');
  return {
    ok: true,
    startMs: clipped.startMs,
    endMs: clipped.endMs,
    reasons,
  };
}

const DRAFT_HINTS: Record<GrokDraftClipReason, string> = {
  swapped: 'Apply swaps the two times.',
  'max-span': 'Apply keeps the first 7 days.',
  'min-span': 'Apply keeps at least one minute.',
};

export function grokBotDraftHint(range: GrokDraftRange): string | null {
  if (!range.ok || range.reasons.length === 0) return null;
  return range.reasons.map((reason) => DRAFT_HINTS[reason]).join(' ');
}

export function grokBotBucketMs(spanMs: number): number {
  if (spanMs <= SIX_HOURS_MS) return MINUTE_MS;
  if (spanMs <= FORTY_EIGHT_HOURS_MS) return FIFTEEN_MINUTES_MS;
  return HOUR_MS;
}

export function grokBotBucketStartSql(column: string = 'event_at'): string {
  if (!SQL_COLUMN.test(column)) {
    throw new Error(`Unsafe SQL column: ${column}`);
  }
  // CAST keeps SQLite on integer division when the driver binds JS numbers as reals.
  return `(CAST(? AS INTEGER) + ((CAST(${column} AS INTEGER) - CAST(? AS INTEGER)) / CAST(? AS INTEGER)) * CAST(? AS INTEGER))`;
}
