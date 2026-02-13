import type { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}

export function Tooltip({ children, content, className }: TooltipProps) {
  return (
    <span className={`relative inline-flex group ${className ?? ''}`}>
      <span className="cursor-help outline-none" tabIndex={0}>
        {children}
      </span>
      <span
        className={
          'pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 ' +
          'whitespace-nowrap rounded-sm border border-border bg-grep-1 px-2 py-1 text-[11px] ' +
          'text-foreground shadow-sm group-hover:block group-focus-within:block'
        }
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
