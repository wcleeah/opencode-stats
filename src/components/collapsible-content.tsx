'use client';

import { useState } from 'react';

interface CollapsibleContentProps {
  content: string;
  maxLines?: number;
  className?: string;
}

/**
 * Shows truncated text with a "show more" toggle when content exceeds maxLines.
 */
export function CollapsibleContent({
  content,
  maxLines = 8,
  className,
}: CollapsibleContentProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split('\n');
  const needsTruncation = lines.length > maxLines;

  if (!needsTruncation) {
    return (
      <div className={`whitespace-pre-wrap ${className ?? ''}`}>
        {content}
      </div>
    );
  }

  const truncated = lines.slice(0, maxLines).join('\n');

  return (
    <div>
      <div className={`whitespace-pre-wrap ${className ?? ''}`}>
        {expanded ? content : truncated}
        {!expanded && (
          <span className="text-muted">...</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-info hover:text-info/80 mt-1 cursor-pointer"
      >
        {expanded
          ? '\u25B2 show less'
          : `\u25BC show more (${lines.length - maxLines} more lines)`}
      </button>
    </div>
  );
}
