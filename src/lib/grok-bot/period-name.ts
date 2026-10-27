declare const grokBotPeriodNameBrand: unique symbol;

/** Trimmed text, 1 to GROK_BOT_PERIOD_NAME_MAX UTF-16 code units, no controls, no DEL. */
export type GrokBotPeriodName = string & {
  readonly [grokBotPeriodNameBrand]: 'GrokBotPeriodName';
};

export const GROK_BOT_PERIOD_NAME_MAX = 64;

export interface GrokBotPeriodNameBinding {
  readonly startMs: number;
  readonly name: GrokBotPeriodName;
}

/**
 * One binding per start. Absence of a start means the period is unnamed.
 * Order is not significant.
 */
export type GrokBotPeriodNames = readonly GrokBotPeriodNameBinding[];

export type GrokBotPeriodNameEdit =
  | { readonly ok: true; readonly names: GrokBotPeriodNames }
  | { readonly ok: false; readonly reason: 'too-long' | 'unsupported' };

type NameDecision =
  | { readonly kind: 'name'; readonly name: GrokBotPeriodName }
  | { readonly kind: 'clear' }
  | { readonly kind: 'reject'; readonly reason: 'too-long' | 'unsupported' };

function acceptGrokBotPeriodName(raw: string): NameDecision {
  const trimmed = raw.trim();
  if (trimmed === '') return { kind: 'clear' };
  if (trimmed.length > GROK_BOT_PERIOD_NAME_MAX) {
    return { kind: 'reject', reason: 'too-long' };
  }
  for (let index = 0; index < trimmed.length; index += 1) {
    const code = trimmed.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) {
      return { kind: 'reject', reason: 'unsupported' };
    }
  }
  return { kind: 'name', name: trimmed as GrokBotPeriodName };
}

function isSafeStart(startMs: number): boolean {
  return Number.isSafeInteger(startMs) && startMs >= 0;
}

export function parseGrokBotPeriodNames(
  raw: string | undefined,
  visibleStarts: readonly number[],
): GrokBotPeriodNames {
  if (raw === undefined || raw.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const visible = new Set(visibleStarts);
  const seen = new Set<number>();
  const kept: GrokBotPeriodNameBinding[] = [];
  for (const item of parsed) {
    if (!Array.isArray(item) || item.length !== 2) continue;
    const startMs: unknown = item[0];
    const text: unknown = item[1];
    if (typeof startMs !== 'number' || typeof text !== 'string') continue;
    if (!isSafeStart(startMs) || !visible.has(startMs) || seen.has(startMs)) continue;
    const decision = acceptGrokBotPeriodName(text);
    if (decision.kind !== 'name') continue;
    seen.add(startMs);
    kept.push({ startMs, name: decision.name });
  }
  kept.sort((left, right) => left.startMs - right.startMs);
  return kept;
}

export function serializeGrokBotPeriodNames(
  names: GrokBotPeriodNames,
): string | undefined {
  const seen = new Set<number>();
  const kept: GrokBotPeriodNameBinding[] = [];
  for (const item of names) {
    if (!isSafeStart(item.startMs) || seen.has(item.startMs)) continue;
    seen.add(item.startMs);
    kept.push(item);
  }
  if (kept.length === 0) return undefined;
  kept.sort((left, right) => left.startMs - right.startMs);
  return JSON.stringify(kept.map((item) => [item.startMs, item.name]));
}

export function grokBotPeriodNames(
  periods: readonly {
    readonly startMs: number;
    readonly name?: GrokBotPeriodName;
  }[],
): GrokBotPeriodNames {
  const seen = new Set<number>();
  const kept: GrokBotPeriodNameBinding[] = [];
  for (const period of periods) {
    if (period.name === undefined || seen.has(period.startMs)) continue;
    seen.add(period.startMs);
    kept.push({ startMs: period.startMs, name: period.name });
  }
  return kept;
}

export function setGrokBotPeriodName(
  names: GrokBotPeriodNames,
  startMs: number,
  raw: '',
): { readonly ok: true; readonly names: GrokBotPeriodNames };
export function setGrokBotPeriodName(
  names: GrokBotPeriodNames,
  startMs: number,
  raw: string,
): GrokBotPeriodNameEdit;
export function setGrokBotPeriodName(
  names: GrokBotPeriodNames,
  startMs: number,
  raw: string,
): GrokBotPeriodNameEdit {
  const decision = acceptGrokBotPeriodName(raw);
  if (decision.kind === 'reject') return { ok: false, reason: decision.reason };
  if (decision.kind === 'clear') {
    if (!names.some((item) => item.startMs === startMs)) return { ok: true, names };
    return {
      ok: true,
      names: names.filter((item) => item.startMs !== startMs),
    };
  }
  const current = names.find((item) => item.startMs === startMs);
  if (current?.name === decision.name) return { ok: true, names };
  let replaced = false;
  const next: GrokBotPeriodNameBinding[] = [];
  for (const item of names) {
    if (item.startMs !== startMs) {
      next.push(item);
      continue;
    }
    if (replaced) continue;
    next.push({ startMs, name: decision.name });
    replaced = true;
  }
  if (!replaced) next.push({ startMs, name: decision.name });
  return { ok: true, names: next };
}

export function moveGrokBotPeriodName(
  names: GrokBotPeriodNames,
  fromStartMs: number,
  toStartMs: number,
): GrokBotPeriodNames {
  if (fromStartMs === toStartMs) return names;
  const source = names.find((item) => item.startMs === fromStartMs);
  // An unnamed brush must not wipe a name already stored on the destination.
  if (source === undefined) return names;
  const next = names.filter(
    (item) => item.startMs !== fromStartMs && item.startMs !== toStartMs,
  );
  return [...next, { startMs: toStartMs, name: source.name }];
}
