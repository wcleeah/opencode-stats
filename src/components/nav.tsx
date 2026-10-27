import { cookies } from 'next/headers';

import {
  parseStatsSource,
  sourceBrandLabel,
  sourceHome,
  STATS_SOURCE_COOKIE,
} from '@/lib/source-mode';

import { PendingAnchor } from '@/components/pending-anchor';
import { SourceToggle } from '@/components/source-toggle';
import { ThemeToggle } from '@/components/theme-toggle';

const CURSOR_NAV = [
  { href: '/cursor', label: 'Agent Usage' },
  { href: '/cursor/grok', label: 'Grokbot Usage' },
  { href: '/cursor/upload', label: 'Upload' },
] as const;

const SAAS_NAV = [
  { href: '/saas', label: 'Dashboard' },
] as const;

export async function Nav() {
  const cookieStore = await cookies();
  const source = parseStatsSource(cookieStore.get(STATS_SOURCE_COOKIE)?.value);
  const items = source === 'cursor' ? CURSOR_NAV : SAAS_NAV;

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[120rem] flex-wrap items-center gap-3 px-4 py-3 sm:gap-6">
        <PendingAnchor
          href={sourceHome(source)}
          history="push"
          className="text-sm font-semibold text-foreground hover:text-muted transition-colors"
        >
          {sourceBrandLabel(source)}
        </PendingAnchor>
        <nav className="flex flex-wrap items-center gap-3 sm:gap-4">
          {items.map((item) => (
            <PendingAnchor
              key={item.href}
              href={item.href}
              history="push"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              {item.label}
            </PendingAnchor>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SourceToggle source={source} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
