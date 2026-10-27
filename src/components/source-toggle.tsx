'use client';

import { sourceHome, STATS_SOURCE_COOKIE, type StatsSource } from '@/lib/source-mode';
import { cn } from '@/lib/utils';

import { PendingAnchor } from '@/components/pending-anchor';

interface SourceToggleProps {
  source: StatsSource;
}

const OPTIONS: Array<{ id: StatsSource; label: string }> = [
  { id: 'cursor', label: 'Cursor' },
  { id: 'saas', label: 'SaaS' },
];

function setSourceCookie(source: StatsSource): void {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${STATS_SOURCE_COOKIE}=${source}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function SourceToggle({ source }: SourceToggleProps) {
  return (
    <div
      className="inline-flex items-center rounded-md border border-border p-0.5"
      role="group"
      aria-label="Stats source"
    >
      {OPTIONS.map((option) => {
        const selected = source === option.id;
        const className = cn(
          'rounded px-2 py-1 text-[10px] uppercase tracking-wide transition-colors',
          selected
            ? 'bg-foreground text-background'
            : 'text-muted hover:text-foreground',
        );
        if (selected) {
          return (
            <button key={option.id} type="button" className={className}>
              {option.label}
            </button>
          );
        }
        return (
          <PendingAnchor
            key={option.id}
            href={sourceHome(option.id)}
            history="push"
            className={className}
            onClick={() => setSourceCookie(option.id)}
          >
            {option.label}
          </PendingAnchor>
        );
      })}
    </div>
  );
}
