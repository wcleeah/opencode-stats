import type { GrokBotPeriodName } from '@/lib/grok-bot/period-name';

interface CaptionPeriod {
  readonly shortLabel: string;
  readonly label: string;
  readonly name?: GrokBotPeriodName;
}

function startHalf(label: string): string {
  const splitAt = label.indexOf(' to ');
  return splitAt === -1 ? label : label.slice(0, splitAt);
}

function dateCaption(
  period: { readonly shortLabel: string; readonly label: string },
  periods: readonly { readonly shortLabel: string }[],
): string {
  const shared = periods.filter((item) => item.shortLabel === period.shortLabel).length > 1;
  if (!shared) return period.shortLabel;
  return startHalf(period.label);
}

function resolvedCaption(
  period: CaptionPeriod,
  periods: readonly CaptionPeriod[],
): string {
  if (period.name !== undefined) return period.name;
  return dateCaption(period, periods);
}

export function grokBotPeriodCaption(
  period: CaptionPeriod,
  periods: readonly CaptionPeriod[],
): string {
  const mine = resolvedCaption(period, periods);
  const collided = periods.filter((item) => resolvedCaption(item, periods) === mine).length > 1;
  if (!collided) return mine;
  const clock = startHalf(period.label);
  if (mine === clock) return mine;
  return `${mine} · ${clock}`;
}
