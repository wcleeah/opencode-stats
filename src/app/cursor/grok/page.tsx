export const dynamic = 'force-dynamic';

import Link from 'next/link';

import {
  grokBotLensFromSearch,
  type GrokBotSearchRaw,
} from '@/lib/grok-bot/board';
import { parseGrokBotCycleClock } from '@/lib/grok-bot/cycle';
import { getCursorSettings } from '@/lib/queries/cursor';
import { loadGrokBotLedger } from '@/lib/queries/grok-bot';

import { GrokBotScreen } from '@/components/grok-bot/grok-bot-screen';

interface GrokPageProps {
  searchParams: Promise<GrokBotSearchRaw>;
}

function GrokHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-bold">Grokbot Usage</h1>
      <Link
        href="/cursor/upload"
        className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt"
      >
        Upload CSV
      </Link>
    </div>
  );
}

export default async function GrokbotUsagePage({ searchParams }: GrokPageProps) {
  const params = await searchParams;
  const settingsResult = await getCursorSettings();
  if (settingsResult.error || !settingsResult.data) {
    return (
      <div className="space-y-6">
        <GrokHeader />
        <p className="text-sm text-error">
          {settingsResult.error ?? 'Failed to load Grokbot usage.'}
        </p>
      </div>
    );
  }

  const settings = settingsResult.data;
  const clock = parseGrokBotCycleClock({
    weekday: settings.grok_cycle_weekday,
    hour: settings.grok_cycle_hour,
    minute: settings.grok_cycle_minute,
  });
  if (!clock) {
    return (
      <div className="space-y-6">
        <GrokHeader />
        <p className="text-sm text-error">Invalid grok cycle clock.</p>
      </div>
    );
  }

  const loaded = await loadGrokBotLedger(clock, new Date());
  if (loaded.error || !loaded.data) {
    return (
      <div className="space-y-6">
        <GrokHeader />
        <p className="text-sm text-error">
          {loaded.error ?? 'Failed to load Grokbot usage.'}
        </p>
      </div>
    );
  }

  return (
    <GrokBotScreen
      ledger={loaded.data}
      initialLens={grokBotLensFromSearch(loaded.data, params)}
    />
  );
}
