'use client';

import { highlight } from 'sugar-high';

interface CodeHighlightProps {
  code: string;
  /** Optional — sugar-high does language-agnostic highlighting */
  language?: string;
  className?: string;
}

/**
 * Lightweight syntax highlighting using sugar-high (~1KB).
 * Renders highlighted HTML with CSS class tokens that we style via Tailwind.
 */
export function CodeHighlight({ code, className }: CodeHighlightProps) {
  const html = highlight(code);
  return (
    <pre
      className={`whitespace-pre-wrap font-mono text-foreground/80 ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
