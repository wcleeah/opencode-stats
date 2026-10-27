'use client';

import { cn } from '@/lib/utils';

import { PendingAnchor } from '@/components/pending-anchor';

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
  const linkClass = 'px-2 py-1 text-muted hover:text-foreground transition-colors';

  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)}>
      {page > 1 ? (
        <PendingAnchor href={pageUrl(page - 1)} history="push" className={linkClass}>
          &lt; prev
        </PendingAnchor>
      ) : (
        <span className="px-2 py-1 text-subtle">&lt; prev</span>
      )}

      {start > 1 && (
        <>
          <PendingAnchor href={pageUrl(1)} history="push" className={linkClass}>
            1
          </PendingAnchor>
          {start > 2 && <span className="px-1 text-subtle">...</span>}
        </>
      )}

      {pages.map((p) => (
        <PendingAnchor
          key={p}
          href={pageUrl(p)}
          history="push"
          className={cn(
            'px-2 py-1 transition-colors',
            p === page
              ? 'text-foreground font-bold'
              : 'text-muted hover:text-foreground',
          )}
        >
          {p}
        </PendingAnchor>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-subtle">...</span>}
          <PendingAnchor href={pageUrl(totalPages)} history="push" className={linkClass}>
            {totalPages}
          </PendingAnchor>
        </>
      )}

      {page < totalPages ? (
        <PendingAnchor href={pageUrl(page + 1)} history="push" className={linkClass}>
          next &gt;
        </PendingAnchor>
      ) : (
        <span className="px-2 py-1 text-subtle">next &gt;</span>
      )}
    </nav>
  );
}
