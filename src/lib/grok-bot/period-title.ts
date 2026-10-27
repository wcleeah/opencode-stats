import type { GrokBotPeriodName } from '@/lib/grok-bot/period-name';

export interface GrokPeriodTitleSource {
  readonly name?: GrokBotPeriodName;
}

function periodBase(index: number, period: GrokPeriodTitleSource | undefined): string {
  if (period?.name !== undefined) return period.name;
  if (index === 0) return 'Period';
  return `Period ${index + 1}`;
}

export function grokBotPeriodTitle(
  index: number,
  periods: readonly GrokPeriodTitleSource[],
): string {
  const bases = periods.map((period, periodIndex) => periodBase(periodIndex, period));
  const mine = bases[index] ?? periodBase(index, undefined);
  let shared = 0;
  for (const base of bases) {
    if (base === mine) shared += 1;
  }
  if (shared < 2) return mine;
  return `${mine} · ${index + 1}`;
}
