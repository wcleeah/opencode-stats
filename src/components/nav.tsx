import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/', label: 'dashboard' },
  { href: '/projects', label: 'projects' },
  { href: '/tools', label: 'tools' },
  { href: '/models', label: 'models' },
] as const;

export function Nav() {
  return (
    <header className="border-b border-border bg-grep-0">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-bold text-accent hover:text-accent/80 transition-colors"
        >
          &gt;_ opencode-stats
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
      </div>
    </header>
  );
}
