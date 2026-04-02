'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  baseUrl: string;
  className?: string;
}

export function Pagination({ page, totalPages, baseUrl, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const separator = baseUrl.includes('?') ? '&' : '?';

  function pageUrl(p: number): string {
    return `${baseUrl}${separator}page=${p}`;
  }

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)}>
      {page > 1 ? (
        <Link
          href={pageUrl(page - 1)}
          className="px-2 py-1 text-muted hover:text-foreground transition-colors"
        >
          &lt; prev
        </Link>
      ) : (
        <span className="px-2 py-1 text-subtle">&lt; prev</span>
      )}

      {start > 1 && (
        <>
          <Link
            href={pageUrl(1)}
            className="px-2 py-1 text-muted hover:text-foreground transition-colors"
          >
            1
          </Link>
          {start > 2 && <span className="px-1 text-subtle">...</span>}
        </>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={pageUrl(p)}
          className={cn(
            'px-2 py-1 transition-colors',
            p === page
              ? 'text-foreground font-bold'
              : 'text-muted hover:text-foreground',
          )}
        >
          {p}
        </Link>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-subtle">...</span>}
          <Link
            href={pageUrl(totalPages)}
            className="px-2 py-1 text-muted hover:text-foreground transition-colors"
          >
            {totalPages}
          </Link>
        </>
      )}

      {page < totalPages ? (
        <Link
          href={pageUrl(page + 1)}
          className="px-2 py-1 text-muted hover:text-foreground transition-colors"
        >
          next &gt;
        </Link>
      ) : (
        <span className="px-2 py-1 text-subtle">next &gt;</span>
      )}
    </nav>
  );
}
