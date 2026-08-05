/**
 * Billing-cycle date helpers for Cursor dashboard navigation.
 */

export interface BillingCycleBounds {
  /** Inclusive cycle start (local midnight) */
  start: Date;
  /** Inclusive cycle end (local end of day before next cycle) */
  end: Date;
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
  label: string;
}

function clampStartDay(day: number): number {
  return Math.min(28, Math.max(1, Math.round(day)));
}

function formatDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function endOfDay(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    23,
    59,
    59,
    999,
  );
}

function addMonthsKeepingDay(value: Date, months: number, startDay: number): Date {
  const day = clampStartDay(startDay);
  return new Date(value.getFullYear(), value.getMonth() + months, day, 0, 0, 0, 0);
}

function formatCycleLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

/**
 * Resolve the billing cycle that contains `anchor` (defaults to now).
 * Offset shifts whole cycles: -1 previous, +1 next.
 */
export function getBillingCycleBounds(
  billingCycleStartDay: number,
  anchor: Date = new Date(),
  offset: number = 0,
): BillingCycleBounds {
  const startDay = clampStartDay(billingCycleStartDay);
  const day = anchor.getDate();

  let cycleStart: Date;
  if (day >= startDay) {
    cycleStart = new Date(anchor.getFullYear(), anchor.getMonth(), startDay, 0, 0, 0, 0);
  } else {
    cycleStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1, startDay, 0, 0, 0, 0);
  }

  if (offset !== 0) {
    cycleStart = addMonthsKeepingDay(cycleStart, offset, startDay);
  }

  const nextStart = addMonthsKeepingDay(cycleStart, 1, startDay);
  const cycleEnd = endOfDay(new Date(nextStart.getTime() - 1));
  const start = startOfDay(cycleStart);

  return {
    start,
    end: cycleEnd,
    from: formatDate(start),
    to: formatDate(cycleEnd),
    label: formatCycleLabel(start, cycleEnd),
  };
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
  const totalMs = cycle.end.getTime() - cycle.start.getTime();
  if (totalMs <= 0) return 0;
  const elapsedMs = Math.min(
    Math.max(now.getTime() - cycle.start.getTime(), 0),
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
    const anchor = new Date(`${from}T12:00:00`);
    if (!Number.isNaN(anchor.getTime())) {
      return getBillingCycleBounds(billingCycleStartDay, anchor, 0);
    }
  }

  return getBillingCycleBounds(billingCycleStartDay, now, 0);
}
