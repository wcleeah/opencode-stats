export function isUnbilledCursorEvent(kind: string, costRaw: string): boolean {
  const kindText = kind.trim().toLowerCase();
  const costText = costRaw.trim().toLowerCase();
  return kindText.includes('error') || kindText === 'free' || costText === 'free';
}
