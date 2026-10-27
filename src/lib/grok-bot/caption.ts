export function grokBotPeriodCaption(
  period: { readonly shortLabel: string; readonly label: string },
  periods: readonly { readonly shortLabel: string }[],
): string {
  const shared = periods.filter((item) => item.shortLabel === period.shortLabel).length > 1;
  if (!shared) return period.shortLabel;
  const splitAt = period.label.indexOf(' to ');
  return splitAt === -1 ? period.label : period.label.slice(0, splitAt);
}
