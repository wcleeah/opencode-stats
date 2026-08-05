'use client';

import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { STATS_SOURCE_COOKIE, type StatsSource } from '@/lib/source-mode';

interface SourceToggleProps {
  source: StatsSource;
}

function setSourceCookie(source: StatsSource): void {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${STATS_SOURCE_COOKIE}=${source}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function SourceToggle({ source }: SourceToggleProps) {
  const router = useRouter();

  function switchTo(next: StatsSource): void {
    if (next === source) return;
    setSourceCookie(next);
    router.push(next === 'cursor' ? '/cursor' : '/');
    router.refresh();
  }

  return (
    <div
      className="inline-flex items-center rounded-md border border-border p-0.5"
      role="group"
      aria-label="Stats source"
    >
      <button
        type="button"
        onClick={() => switchTo('opencode')}
        className={cn(
          'rounded px-2 py-1 text-[10px] uppercase tracking-wide transition-colors',
          source === 'opencode'
            ? 'bg-foreground text-background'
            : 'text-muted hover:text-foreground',
        )}
      >
        OpenCode
      </button>
      <button
        type="button"
        onClick={() => switchTo('cursor')}
        className={cn(
          'rounded px-2 py-1 text-[10px] uppercase tracking-wide transition-colors',
          source === 'cursor'
            ? 'bg-foreground text-background'
            : 'text-muted hover:text-foreground',
        )}
      >
        Cursor
      </button>
    </div>
  );
}
