'use client';

import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { sourceHome, STATS_SOURCE_COOKIE, type StatsSource } from '@/lib/source-mode';

interface SourceToggleProps {
  source: StatsSource;
}

const OPTIONS: Array<{ id: StatsSource; label: string }> = [
  { id: 'opencode', label: 'OpenCode' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'mcp', label: 'MCP' },
];

function setSourceCookie(source: StatsSource): void {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${STATS_SOURCE_COOKIE}=${source}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function SourceToggle({ source }: SourceToggleProps) {
  const router = useRouter();

  function switchTo(next: StatsSource): void {
    if (next === source) return;
    setSourceCookie(next);
    router.push(sourceHome(next));
    router.refresh();
  }

  return (
    <div
      className="inline-flex items-center rounded-md border border-border p-0.5"
      role="group"
      aria-label="Stats source"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => switchTo(option.id)}
          className={cn(
            'rounded px-2 py-1 text-[10px] uppercase tracking-wide transition-colors',
            source === option.id
              ? 'bg-foreground text-background'
              : 'text-muted hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
