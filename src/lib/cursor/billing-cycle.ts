/**
 * Billing-cycle date helpers for Cursor dashboard navigation.
 *
 * Cycle boundaries use Asia/Hong_Kong at 16:00 (no DST; UTC+8).
 * Example: start day 1 → cycle runs Aug 1 16:00 HKT – Sep 1 16:00 HKT (exclusive end).
 */

/** IANA timezone for Cursor billing-cycle cutoffs. */
export const BILLING_CYCLE_TIMEZONE = 'Asia/Hong_Kong';

/** Local hour (0–23) in {@link BILLING_CYCLE_TIMEZONE} when a new cycle starts. */
export const BILLING_CYCLE_CUTOFF_HOUR = 16;

/** HKT is always UTC+8 (no daylight saving). */
const HKT_UTC_OFFSET_HOURS = 8;

export interface BillingCycleBounds {
  /** Inclusive cycle start (HKT cutoff instant) */
  start: Date;
  /** Inclusive cycle end (1ms before next HKT cutoff) */
  end: Date;
  /** Epoch ms for query filters (inclusive) */
  startMs: number;
  /** Epoch ms for query filters (inclusive) */
  endMs: number;
  /** YYYY-MM-DD of cycle start calendar day in HKT */
  from: string;
  /** YYYY-MM-DD of last calendar day that overlaps the cycle in HKT */
  to: string;
  label: string;
}

interface HktParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
}

function clampStartDay(day: number): number {
  return Math.min(28, Math.max(1, Math.round(day)));
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Instant when a billing cycle starts: `year-month-day` at 16:00 HKT.
 * `month` is 1–12.
 */
export function cycleCutoffUtcMs(year: number, month: number, day: number): number {
  const safeDay = clampStartDay(day);
  return Date.UTC(
    year,
    month - 1,
    safeDay,
    BILLING_CYCLE_CUTOFF_HOUR - HKT_UTC_OFFSET_HOURS,
    0,
    0,
    0,
  );
}

/** Calendar parts for `date` in Asia/Hong_Kong. */
export function getHktParts(date: Date): HktParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: BILLING_CYCLE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const raw = parts.find((p) => p.type === type)?.value;
    return Number(raw);
  };
  let hour = read('hour');
  // Some engines emit "24" for midnight; normalize.
  if (hour === 24) hour = 0;
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
  };
}

function addCalendarMonths(
  year: number,
  month: number,
  day: number,
  months: number,
): { year: number; month: number; day: number } {
  const safeDay = clampStartDay(day);
  // Anchor at noon UTC to avoid DST edge cases when shifting months.
  const shifted = new Date(Date.UTC(year, month - 1 + months, safeDay, 12, 0, 0, 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: safeDay,
  };
}

function formatCycleLabel(from: string, to: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  };
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function boundsFromCutoffStart(
  startYear: number,
  startMonth: number,
  startDay: number,
): BillingCycleBounds {
  const startMs = cycleCutoffUtcMs(startYear, startMonth, startDay);
  const next = addCalendarMonths(startYear, startMonth, startDay, 1);
  const nextStartMs = cycleCutoffUtcMs(next.year, next.month, next.day);
  const endMs = nextStartMs - 1;

  // Last HKT calendar day that overlaps the cycle is the day of next cutoff
  // (usage before 16:00 HKT that day still belongs to this cycle).
  const to = formatYmd(next.year, next.month, next.day);
  const from = formatYmd(startYear, startMonth, startDay);

  return {
    start: new Date(startMs),
    end: new Date(endMs),
    startMs,
    endMs,
    from,
    to,
    label: formatCycleLabel(from, to),
  };
}

/**
 * Resolve the billing cycle that contains `anchor` (defaults to now).
 * Offset shifts whole cycles: -1 previous, +1 next.
 *
 * Cutoff is 16:00 Asia/Hong_Kong on the configured start day.
 */
export function getBillingCycleBounds(
  billingCycleStartDay: number,
  anchor: Date = new Date(),
  offset: number = 0,
): BillingCycleBounds {
  const startDay = clampStartDay(billingCycleStartDay);
  const hkt = getHktParts(anchor);
  const thisMonthCutoffMs = cycleCutoffUtcMs(hkt.year, hkt.month, startDay);

  let startYear: number;
  let startMonth: number;
  if (anchor.getTime() >= thisMonthCutoffMs) {
    startYear = hkt.year;
    startMonth = hkt.month;
  } else {
    const prev = addCalendarMonths(hkt.year, hkt.month, startDay, -1);
    startYear = prev.year;
    startMonth = prev.month;
  }

  if (offset !== 0) {
    const shifted = addCalendarMonths(startYear, startMonth, startDay, offset);
    startYear = shifted.year;
    startMonth = shifted.month;
  }

  return boundsFromCutoffStart(startYear, startMonth, startDay);
}

/**
 * Infer which cycle offset a from/to pair matches, relative to "this cycle".
 * Returns null when the range is not an exact billing-cycle window.
 */
export function matchBillingCycleOffset(
  billingCycleStartDay: number,
  from: string | undefined,
  to: string | undefined,
  now: Date = new Date(),
): number | null {
  if (!from || !to) return null;

  // Search a small window of cycles around now.
  for (let offset = -24; offset <= 24; offset += 1) {
    const cycle = getBillingCycleBounds(billingCycleStartDay, now, offset);
    if (cycle.from === from && cycle.to === to) {
      return offset;
    }
  }
  return null;
}

export function billingCycleElapsedRatio(
  now: Date,
  billingCycleStartDay: number,
): number {
  const cycle = getBillingCycleBounds(billingCycleStartDay, now, 0);
  const totalMs = cycle.endMs - cycle.startMs;
  if (totalMs <= 0) return 0;
  const elapsedMs = Math.min(
    Math.max(now.getTime() - cycle.startMs, 0),
    totalMs,
  );
  return elapsedMs / totalMs;
}

/**
 * Resolve which billing cycle a dashboard date range maps to.
 * Prefers an exact from/to cycle match; otherwise the cycle containing `from`,
 * then today's cycle.
 */
export function resolveSelectedCycle(
  billingCycleStartDay: number,
  from?: string,
  to?: string,
  now: Date = new Date(),
): BillingCycleBounds {
  const offset = matchBillingCycleOffset(billingCycleStartDay, from, to, now);
  if (offset !== null) {
    return getBillingCycleBounds(billingCycleStartDay, now, offset);
  }

  if (from) {
    // Midday HKT on the from date so we land inside that calendar day's cycle.
    const anchorMs = cycleCutoffUtcMs(
      Number(from.slice(0, 4)),
      Number(from.slice(5, 7)),
      Number(from.slice(8, 10)),
    );
    const anchor = new Date(anchorMs + 60_000);
    if (!Number.isNaN(anchor.getTime())) {
      return getBillingCycleBounds(billingCycleStartDay, anchor, 0);
    }
  }

  return getBillingCycleBounds(billingCycleStartDay, now, 0);
}
