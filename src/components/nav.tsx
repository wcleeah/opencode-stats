import Link from 'next/link';

import { ThemeToggle } from '@/components/theme-toggle';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/time', label: 'Time' },
  { href: '/tools', label: 'Tools' },
  { href: '/models', label: 'Models' },
] as const;

export function Nav() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[120rem] items-center gap-6 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold text-foreground hover:text-muted transition-colors"
        >
          OpenCode Stats
        </Link>
        <nav className="flex items-center gap-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
