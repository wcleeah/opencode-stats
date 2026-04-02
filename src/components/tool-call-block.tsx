'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/format';
import { renderToolPayload } from '@/lib/tool-rendering';
import { ArtifactView } from '@/components/tool-renderers/artifact-view';
import type { ToolArtifact } from '@/lib/tool-artifacts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ToolCallBlockProps {
  tool: string;
  title: string | null;
  status: string;
  error: string | null;
  durationMs: number | null;
  /** Raw input payload from the database */
  inputRaw: string | null;
  /** Raw output payload from the database */
  outputRaw: string | null;
  defaultExpanded?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolCallBlock({
  tool,
  title,
  status,
  error,
  durationMs,
  inputRaw,
  outputRaw,
  defaultExpanded = false,
}: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || !!error);

  // Resolve artifacts once via the registry
  const inputResult = useMemo(
    () => renderToolPayload({ tool, side: 'input', raw: inputRaw }),
    [tool, inputRaw],
  );
  const outputResult = useMemo(
    () => renderToolPayload({ tool, side: 'output', raw: outputRaw, otherRaw: inputRaw }),
    [tool, outputRaw, inputRaw],
  );

  const showInput = inputResult.artifact !== null;
  const showOutput = !outputResult.hide && outputResult.artifact !== null;

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

          {/* Input */}
          {showInput && (
            <ToolSection label="input" artifact={inputResult.artifact!} raw={inputRaw} />
          )}

          {/* Output */}
          {showOutput && (
            <ToolSection label="output" artifact={outputResult.artifact!} raw={outputRaw} isLast />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolSection: renders a single artifact with a raw toggle
// ---------------------------------------------------------------------------

function ToolSection({
  label,
  artifact,
  raw,
  isLast,
}: {
  label: string;
  artifact: ToolArtifact;
  raw: string | null;
  isLast?: boolean;
}) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className={isLast ? '' : 'border-b border-border/50'}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] text-muted uppercase tracking-wider">
          {label}
        </span>
        {raw && (
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="text-[10px] text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            {showRaw ? 'rich' : 'raw'}
          </button>
        )}
      </div>

      <div className="px-2 pb-2 text-xs">
        {showRaw ? (
          <pre className="whitespace-pre-wrap text-foreground/80 max-h-64 overflow-y-auto">
            {raw}
          </pre>
        ) : (
          <ArtifactView artifact={artifact} />
        )}
      </div>
    </div>
  );
}
