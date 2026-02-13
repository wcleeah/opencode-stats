interface DateRangeInput {
  from?: string;
  to?: string;
}

interface DateRangeResult {
  from?: string;
  to?: string;
  startMs?: number;
  endMs?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateString(value: string, endOfDay: boolean): number | undefined {
  if (!DATE_RE.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function parseDateRange(params: DateRangeInput): DateRangeResult {
  const rawFrom = params.from?.trim() || undefined;
  const rawTo = params.to?.trim() || undefined;
  const startMs = rawFrom ? parseDateString(rawFrom, false) : undefined;
  const endMs = rawTo ? parseDateString(rawTo, true) : undefined;

  const from = startMs !== undefined ? rawFrom : undefined;
  const to = endMs !== undefined ? rawTo : undefined;

  if (startMs !== undefined && endMs !== undefined && startMs > endMs) {
    return {
      from: to,
      to: from,
      startMs: endMs,
      endMs: startMs,
    };
  }

  return {
    from,
    to,
    startMs,
    endMs,
  };
}
