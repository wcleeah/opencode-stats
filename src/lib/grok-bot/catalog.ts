import { isGrokBotModel, normalizeGrokBotModelId } from '@/lib/grok-bot/membership';

export interface GrokBotUsageTypeOption {
  id: string;
  label: string;
  priced: boolean;
}

export const GROK_BOT_KNOWN_USAGE = [
  { id: 'grok-bot-default', label: 'Default' },
  { id: 'grok-bot-automation', label: 'Automation' },
  { id: 'grok-bot-cua', label: 'CUA' },
  { id: 'grok-bot-knowledge-work', label: 'Knowledge work' },
] as const;

export type GrokBotKnownUsageId = (typeof GROK_BOT_KNOWN_USAGE)[number]['id'];

export function grokBotUsageCatalog(
  extraModelIds: readonly string[],
): readonly GrokBotUsageTypeOption[] {
  const known: GrokBotUsageTypeOption[] = GROK_BOT_KNOWN_USAGE.map((type) => ({
    id: type.id,
    label: type.label,
    priced: true,
  }));
  const knownIds = new Set<string>(known.map((type) => type.id));
  const extras = new Set<string>();
  for (const modelId of extraModelIds) {
    const id = normalizeGrokBotModelId(modelId);
    if (!isGrokBotModel(id) || knownIds.has(id)) continue;
    extras.add(id);
  }
  const extraOptions = [...extras]
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, label: id, priced: false }));
  return [...known, ...extraOptions];
}
