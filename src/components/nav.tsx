import Link from 'next/link';
import { cookies } from 'next/headers';

import { ThemeToggle } from '@/components/theme-toggle';
import { SourceToggle } from '@/components/source-toggle';
import { parseStatsSource, STATS_SOURCE_COOKIE } from '@/lib/source-mode';

const OPENCODE_NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/time', label: 'Time' },
  { href: '/tools', label: 'Tools' },
  { href: '/models', label: 'Models' },
] as const;

const CURSOR_NAV = [
  { href: '/cursor', label: 'Dashboard' },
  { href: '/cursor/upload', label: 'Upload' },
] as const;

export async function Nav() {
  const cookieStore = await cookies();
  const source = parseStatsSource(cookieStore.get(STATS_SOURCE_COOKIE)?.value);
  const items = source === 'cursor' ? CURSOR_NAV : OPENCODE_NAV;
  const brandHref = source === 'cursor' ? '/cursor' : '/';
  const brandLabel = source === 'cursor' ? 'Cursor Stats' : 'OpenCode Stats';

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[120rem] flex-wrap items-center gap-3 px-4 py-3 sm:gap-6">
        <Link
          href={brandHref}
          className="text-sm font-semibold text-foreground hover:text-muted transition-colors"
        >
          {brandLabel}
        </Link>
        <nav className="flex flex-wrap items-center gap-3 sm:gap-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
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
