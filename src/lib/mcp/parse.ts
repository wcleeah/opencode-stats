export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function asInt(value: unknown): number | null {
  const n = asNumber(value);
  if (n === null) return null;
  return Math.round(n);
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
