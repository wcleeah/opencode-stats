'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/format';
import { renderToolPayload } from '@/lib/tool-rendering';
import type { ToolArtifact } from '@/lib/tool-artifacts';
import { shortenPath, shortenOutputPaths } from '@/lib/tool-parsers';

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

      <div className="px-2 pb-2 text-xs max-h-64 overflow-y-auto">
        {showRaw ? (
          <pre className="whitespace-pre-wrap text-foreground/80">{raw}</pre>
        ) : (
          <ArtifactView artifact={artifact} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArtifactView: dispatch to per-type renderers
//
// FIRST PASS: lightweight text-based renderers.
// These will be replaced by dedicated components in tool-renderers/ later.
// ---------------------------------------------------------------------------

function ArtifactView({ artifact }: { artifact: ToolArtifact }) {
  switch (artifact.type) {
    case 'command':
      return <CommandView {...artifact} />;
    case 'execution-log':
      return <ExecutionLogView {...artifact} />;
    case 'file-request':
      return <FileRequestView {...artifact} />;
    case 'file-preview':
      return <FilePreviewView {...artifact} />;
    case 'directory-tree':
      return <DirectoryTreeView {...artifact} />;
    case 'diff':
      return <DiffView {...artifact} />;
    case 'patch-result':
      return <PatchResultView {...artifact} />;
    case 'search-query':
      return <SearchQueryView {...artifact} />;
    case 'search-results':
      return <SearchResultsView {...artifact} />;
    case 'todo-list':
      return <TodoListView {...artifact} />;
    case 'document':
      return <DocumentView {...artifact} />;
    case 'qa':
      return <QAView {...artifact} />;
    case 'status':
      return <StatusView {...artifact} />;
    case 'error':
      return <ErrorView {...artifact} />;
    case 'json':
      return <JSONView {...artifact} />;
    case 'raw':
      return <RawView {...artifact} />;
  }
}

// ---------------------------------------------------------------------------
// Inline renderers (first pass -- will migrate to tool-renderers/ directory)
// ---------------------------------------------------------------------------

function CommandView({ command, workdir, description, timeout }: {
  command: string;
  workdir?: string;
  description?: string;
  timeout?: number;
}) {
  return (
    <div className="space-y-1">
      {description && (
        <div className="text-muted italic"># {description}</div>
      )}
      <pre className="whitespace-pre-wrap text-foreground/90 font-mono">
        <span className="text-muted select-none">$ </span>{command}
      </pre>
      {(workdir || timeout) && (
        <div className="flex gap-3 text-muted">
          {workdir && <span>cwd: {workdir}</span>}
          {timeout && <span>timeout: {(timeout / 1000).toFixed(0)}s</span>}
        </div>
      )}
    </div>
  );
}

function ExecutionLogView({ text, variant }: {
  text: string;
  variant?: 'default' | 'error' | 'success';
}) {
  const colorClass =
    variant === 'error' ? 'text-error'
    : variant === 'success' ? 'text-success'
    : 'text-foreground/80';
  return (
    <pre className={`whitespace-pre-wrap font-mono ${colorClass}`}>
      {shortenOutputPaths(text)}
    </pre>
  );
}

function FileRequestView({ path, offset, limit }: {
  path: string;
  offset?: number;
  limit?: number;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-foreground/90">{path}</span>
      {offset != null && (
        <Badge variant="default">offset: {offset}</Badge>
      )}
      {limit != null && (
        <Badge variant="default">limit: {limit}</Badge>
      )}
    </div>
  );
}

function FilePreviewView({ path, content, truncated }: {
  path?: string;
  language?: string;
  content: string;
  truncated?: boolean;
}) {
  return (
    <div className="space-y-1">
      {path && (
        <div className="font-mono text-muted">{path}</div>
      )}
      <pre className="whitespace-pre-wrap text-foreground/80">
        {content}
      </pre>
      {truncated && (
        <div className="text-muted italic">content truncated</div>
      )}
    </div>
  );
}

function DirectoryTreeView({ path, entries }: {
  path?: string;
  entries: string[];
}) {
  return (
    <div className="space-y-1">
      {path && (
        <div className="font-mono text-muted">{path}</div>
      )}
      <pre className="whitespace-pre-wrap text-foreground/80">
        {entries.map((e) => shortenPath(e)).join('\n')}
      </pre>
      <div className="text-muted">{entries.length} entries</div>
    </div>
  );
}

function DiffView({ path, oldText, newText, patchText, replaceAll }: {
  path?: string;
  oldText?: string;
  newText?: string;
  patchText?: string;
  replaceAll?: boolean;
}) {
  return (
    <div className="space-y-1">
      {path && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted">{path}</span>
          {replaceAll && <Badge variant="warning">replace all</Badge>}
        </div>
      )}
      {patchText ? (
        <pre className="whitespace-pre-wrap text-foreground/80 font-mono">
          {patchText}
        </pre>
      ) : (
        <div className="space-y-0.5 font-mono">
          {oldText != null && (
            <>
              <div className="text-muted text-[10px]">--- old</div>
              <pre className="whitespace-pre-wrap text-error/80 bg-error/5 px-1 rounded-sm">
                {oldText}
              </pre>
            </>
          )}
          {newText != null && (
            <>
              <div className="text-muted text-[10px]">+++ new</div>
              <pre className="whitespace-pre-wrap text-success/80 bg-success/5 px-1 rounded-sm">
                {newText}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PatchResultView({ summary }: {
  summary: string;
  files?: unknown[];
  raw?: string | null;
}) {
  return (
    <pre className="whitespace-pre-wrap text-foreground/80">
      {shortenOutputPaths(summary)}
    </pre>
  );
}

function SearchQueryView({ query, include, path, repo, language, url, format: fmt, meta }: {
  query: string;
  include?: string;
  path?: string;
  repo?: string;
  language?: string[];
  url?: string;
  format?: string;
  meta?: Record<string, string>;
}) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-foreground/90">
        {url ? (
          <span className="break-all">{query}</span>
        ) : (
          query
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {include && <Badge variant="default">include: {include}</Badge>}
        {path && <Badge variant="default">path: {path}</Badge>}
        {repo && <Badge variant="default">repo: {repo}</Badge>}
        {fmt && <Badge variant="default">format: {fmt}</Badge>}
        {language && language.length > 0 && (
          <Badge variant="default">lang: {language.join(', ')}</Badge>
        )}
        {meta && Object.entries(meta).map(([k, v]) => (
          <Badge key={k} variant="default">{k}: {v}</Badge>
        ))}
      </div>
    </div>
  );
}

function SearchResultsView({ groups, cards, raw }: {
  groups?: { heading: string; matches: { line?: number; text: string }[] }[];
  cards?: { title: string; url?: string; snippet: string }[];
  raw: string;
}) {
  if (groups && groups.length > 0) {
    return (
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.heading}>
            <div className="font-mono text-muted text-[11px]">
              {shortenPath(g.heading)}
            </div>
            {g.matches.map((m) => (
              <div key={`${g.heading}:${m.line ?? ''}:${m.text.slice(0, 40)}`} className="flex gap-2 font-mono">
                {m.line != null && (
                  <span className="text-muted shrink-0 tabular-nums w-8 text-right">
                    {m.line}
                  </span>
                )}
                <span className="text-foreground/80 whitespace-pre-wrap">{m.text}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (cards && cards.length > 0) {
    return (
      <div className="space-y-2">
        {cards.map((c) => (
          <div key={`${c.title}:${c.url ?? ''}`} className="space-y-0.5">
            <div className="font-medium text-foreground/90">{c.title}</div>
            {c.url && (
              <div className="text-muted text-[11px] break-all">{c.url}</div>
            )}
            {c.snippet && (
              <div className="text-foreground/70 line-clamp-3">{c.snippet}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap text-foreground/80">
      {shortenOutputPaths(raw)}
    </pre>
  );
}

function TodoListView({ todos }: {
  todos: { content: string; status: string; priority?: string; id?: string }[];
}) {
  return (
    <div className="space-y-0.5">
      {todos.map((t, i) => {
        const icon =
          t.status === 'completed' ? '\u2611'
          : t.status === 'in_progress' ? '\u25B6'
          : t.status === 'cancelled' ? '\u2612'
          : '\u2610';
        const muted = t.status === 'completed' || t.status === 'cancelled';
        return (
          <div key={t.id ?? i} className={`flex items-start gap-1.5 ${muted ? 'text-muted' : 'text-foreground/90'}`}>
            <span className="shrink-0 w-4 text-center">{icon}</span>
            <span className={muted ? 'line-through' : ''}>{t.content}</span>
            {t.priority && (
              <Badge variant={t.priority === 'high' ? 'error' : t.priority === 'medium' ? 'warning' : 'default'}>
                {t.priority}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DocumentView({ title, url, content }: {
  title?: string;
  url?: string;
  content: string;
  format?: string;
}) {
  return (
    <div className="space-y-1">
      {title && <div className="font-medium text-foreground/90">{title}</div>}
      {url && <div className="text-muted text-[11px] break-all">{url}</div>}
      <pre className="whitespace-pre-wrap text-foreground/80">
        {shortenOutputPaths(content)}
      </pre>
    </div>
  );
}

function QAView({ questions, answers, answersText }: {
  questions?: { header: string; question: string; options: { label: string; description: string }[] }[];
  answers?: { question: string; answer: string }[];
  answersText?: string;
}) {
  return (
    <div className="space-y-2">
      {questions && questions.map((q) => (
        <div key={q.header} className="space-y-1">
          <div className="font-medium text-foreground/90">{q.header}</div>
          <div className="text-foreground/80">{q.question}</div>
          <div className="pl-2 space-y-0.5">
            {q.options.map((o) => (
              <div key={o.label} className="flex gap-1.5">
                <span className="text-muted shrink-0">&bull;</span>
                <span>
                  <span className="font-medium">{o.label}</span>
                  {o.description && (
                    <span className="text-muted"> &mdash; {o.description}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {answers && answers.map((a) => (
        <div key={a.question} className="space-y-0.5">
          <div className="text-muted">{a.question}</div>
          <div className="text-foreground/90 font-medium">{a.answer}</div>
        </div>
      ))}
      {!answers && answersText && (
        <pre className="whitespace-pre-wrap text-foreground/80">{answersText}</pre>
      )}
    </div>
  );
}

function StatusView({ message, tone }: {
  message: string;
  tone?: 'default' | 'success' | 'warning' | 'error';
}) {
  const colorClass =
    tone === 'error' ? 'text-error'
    : tone === 'success' ? 'text-success'
    : tone === 'warning' ? 'text-warning'
    : 'text-foreground/80';
  return (
    <div className={colorClass}>{message}</div>
  );
}

function ErrorView({ summary, details }: {
  tool?: string;
  summary: string;
  details?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="space-y-1">
      <div className="text-error font-medium">{summary}</div>
      {details && details !== summary && (
        <>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[10px] text-muted hover:text-foreground cursor-pointer"
          >
            {showDetails ? 'hide details' : 'show details'}
          </button>
          {showDetails && (
            <pre className="whitespace-pre-wrap text-error/70">{details}</pre>
          )}
        </>
      )}
    </div>
  );
}

function JSONView({ value }: { value: unknown }) {
  return (
    <pre className="whitespace-pre-wrap text-foreground/80 font-mono">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function RawView({ text }: { text: string }) {
  return (
    <pre className="whitespace-pre-wrap text-foreground/80">
      {shortenOutputPaths(text)}
    </pre>
  );
}
