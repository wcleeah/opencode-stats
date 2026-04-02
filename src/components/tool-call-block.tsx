'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/format';

interface ToolCallBlockProps {
  tool: string;
  title: string | null;
  status: string;
  error: string | null;
  durationMs: number | null;
  formattedInput: string | null;
  outputContent: string | null;
  defaultExpanded?: boolean;
}

export function ToolCallBlock({
  tool,
  title,
  status,
  error,
  durationMs,
  formattedInput,
  outputContent,
  defaultExpanded = false,
}: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || !!error);

  return (
    <div className="border border-border/50 rounded-sm overflow-hidden">
      {/* Tool call header -- clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-2 py-1.5 bg-surface-alt border-b border-border/50 w-full text-left cursor-pointer hover:bg-surface transition-colors"
      >
        <span className="text-muted text-xs shrink-0 w-4">
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
        <Badge variant={status === 'error' ? 'error' : 'success'}>
          {tool}
        </Badge>
        {title && (
          <span className="text-xs text-muted truncate flex-1">
            {title}
          </span>
        )}
        {durationMs != null && (
          <span className="text-xs text-muted tabular-nums shrink-0">
            {formatDuration(durationMs)}
          </span>
        )}
      </button>

      {expanded && (
        <>
          {/* Error */}
          {error && (
            <div className="px-2 py-1.5 text-xs text-error bg-error/5 border-b border-border/50">
              {error}
            </div>
          )}

          {/* Input content */}
          {formattedInput && (
            <div className="border-b border-border/50">
              <div className="px-2 py-1 text-[10px] text-muted uppercase tracking-wider">
                input
              </div>
              <div className="px-2 pb-2 text-xs whitespace-pre-wrap text-foreground/80 max-h-64 overflow-y-auto">
                {formattedInput}
              </div>
            </div>
          )}

          {/* Output content */}
          {outputContent && (
            <div>
              <div className="px-2 py-1 text-[10px] text-muted uppercase tracking-wider">
                output
              </div>
              <div className="px-2 pb-2 text-xs whitespace-pre-wrap text-foreground/80 max-h-64 overflow-y-auto">
                {outputContent}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
