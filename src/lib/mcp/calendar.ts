export interface CalendarMonthWindow {
  /** YYYY-MM in UTC */
  key: string;
  label: string;
  startMs: number;
  /** Inclusive end of the last UTC millisecond in the month */
  endMs: number;
  nextResetMs: number;
  elapsedRatio: number;
  daysUntilReset: number;
  daysInMonth: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * UTC calendar month. Tavily credits reset on the 1st; Exa free-tier top-up
 * is also monthly. Railway/Node servers have no user TZ, so UTC is the
 * honest cycle boundary.
 */
export function getUtcCalendarMonth(now: Date = new Date()): CalendarMonthWindow {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startMs = Date.UTC(year, month, 1);
  const nextResetMs = Date.UTC(year, month + 1, 1);
  const endMs = nextResetMs - 1;
  const spanMs = nextResetMs - startMs;
  const elapsedMs = Math.min(spanMs, Math.max(0, now.getTime() - startMs));
  const remainingMs = Math.max(0, nextResetMs - now.getTime());
  const daysInMonth = Math.round(spanMs / 86_400_000);

  return {
    key: `${year}-${pad2(month + 1)}`,
    label: `${MONTH_NAMES[month]} ${year}`,
    startMs,
    endMs,
    nextResetMs,
    elapsedRatio: spanMs > 0 ? elapsedMs / spanMs : 0,
    daysUntilReset: Math.ceil(remainingMs / 86_400_000),
    daysInMonth,
  };
}

export function utcDayKey(epochMs: number): string {
  const date = new Date(epochMs);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}
