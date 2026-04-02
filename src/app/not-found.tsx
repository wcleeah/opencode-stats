import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="text-4xl font-bold text-subtle mb-2">404</div>
        <div className="text-sm text-muted mb-4">Page not found</div>
        <Link
          href="/"
          className="rounded-sm border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-alt transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
