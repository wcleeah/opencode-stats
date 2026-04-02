'use client';

/**
 * Artifact renderers — one component per ToolArtifact variant.
 *
 * Each renderer is a focused, self-contained component. The ArtifactView
 * dispatcher at the bottom switches on artifact.type.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { MarkdownContent } from '@/components/markdown-content';
import { CodeHighlight } from '@/components/tool-renderers/code-highlight';
import { shortenPath, shortenOutputPaths } from '@/lib/tool-parsers';
import type { ToolArtifact } from '@/lib/tool-artifacts';

// ---------------------------------------------------------------------------
// Shared: expandable content wrapper
// ---------------------------------------------------------------------------

const COLLAPSED_LINES = 20;

function ExpandableContent({
  text,
  className,
  render,
}: {
  text: string;
  className?: string;
  /** Custom render function. If omitted, renders as <pre>. */
  render?: (content: string) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  const needsCollapse = lines.length > COLLAPSED_LINES;
  const visibleText = needsCollapse && !expanded
    ? lines.slice(0, COLLAPSED_LINES).join('\n')
    : text;

  return (
    <div>
      {render ? render(visibleText) : (
        <pre className={`whitespace-pre-wrap ${className ?? ''}`}>
          {visibleText}
        </pre>
      )}
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-info hover:text-info/80 mt-1 cursor-pointer"
        >
          {expanded
            ? '\u25B2 collapse'
            : `\u25BC ${lines.length - COLLAPSED_LINES} more lines`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommandView — bash / shell commands
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
      <ExpandableContent
        text={command}
        render={(text) => (
          <pre className="whitespace-pre-wrap text-foreground/90 font-mono">
            <span className="text-muted select-none">$ </span>{text}
          </pre>
        )}
      />
      {(workdir || timeout) && (
        <div className="flex gap-3 text-muted">
          {workdir && <span>cwd: {workdir}</span>}
          {timeout && <span>timeout: {(timeout / 1000).toFixed(0)}s</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExecutionLogView — bash output, playwriter output
// ---------------------------------------------------------------------------

function ExecutionLogView({ text, variant }: {
  text: string;
  variant?: 'default' | 'error' | 'success';
}) {
  const colorClass =
    variant === 'error' ? 'text-error'
    : variant === 'success' ? 'text-success'
    : 'text-foreground/80';
  return (
    <ExpandableContent
      text={shortenOutputPaths(text)}
      className={`font-mono ${colorClass}`}
    />
  );
}

// ---------------------------------------------------------------------------
// FileRequestView — read/list input
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FilePreviewView — read output, write input, playwriter code
// ---------------------------------------------------------------------------

function FilePreviewView({ path, language, content, truncated }: {
  path?: string;
  language?: string;
  content: string;
  truncated?: boolean;
}) {
  const useHighlight = !!language;

  return (
    <div className="space-y-1">
      {path && (
        <div className="font-mono text-muted">{path}</div>
      )}
      {useHighlight ? (
        <ExpandableContent
          text={content}
          render={(text) => <CodeHighlight code={text} language={language} />}
        />
      ) : (
        <ExpandableContent
          text={content}
          className="text-foreground/80"
        />
      )}
      {truncated && (
        <div className="text-muted italic">content truncated</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DirectoryTreeView — glob/list output, read directory output
// ---------------------------------------------------------------------------

function DirectoryTreeView({ path, entries }: {
  path?: string;
  entries: string[];
}) {
  const shortened = entries.map((e) => shortenPath(e));
  return (
    <div className="space-y-1">
      {path && (
        <div className="font-mono text-muted">{path}</div>
      )}
      <ExpandableContent
        text={shortened.join('\n')}
        className="text-foreground/80"
      />
      <div className="text-muted">{entries.length} entries</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffView — edit input, apply_patch input
// ---------------------------------------------------------------------------

/**
 * Classify a line from a unified diff or patch.
 *   +  added
 *   -  removed
 *   @@ hunk header
 *   *** patch header
 *   everything else: context
 */
function diffLineType(line: string): 'add' | 'remove' | 'hunk' | 'header' | 'context' {
  if (line.startsWith('+++') || line.startsWith('---')) return 'header';
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'remove';
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('***')) return 'header';
  return 'context';
}

const DIFF_LINE_STYLES: Record<string, string> = {
  add: 'text-success/90 bg-success/5',
  remove: 'text-error/90 bg-error/5',
  hunk: 'text-info/70 bg-info/5',
  header: 'text-muted font-semibold',
  context: 'text-foreground/60',
};

/** Renders unified diff text with per-line coloring. */
function DiffLines({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
      {lines.map((line, lineNum) => {
        const type = diffLineType(line);
        return (
          <div key={lineNum} className={`px-1 -mx-1 ${DIFF_LINE_STYLES[type]}`}>
            {line || '\u00A0'}
          </div>
        );
      })}
    </pre>
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
        <ExpandableContent
          text={patchText}
          render={(text) => <DiffLines text={text} />}
        />
      ) : (
        <div className="space-y-0.5 font-mono">
          {oldText != null && (
            <>
              <div className="text-muted text-[10px]">--- old</div>
              <ExpandableContent
                text={oldText}
                className="text-error/80 bg-error/5 px-1 rounded-sm"
              />
            </>
          )}
          {newText != null && (
            <>
              <div className="text-muted text-[10px]">+++ new</div>
              <ExpandableContent
                text={newText}
                className="text-success/80 bg-success/5 px-1 rounded-sm"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PatchResultView — edit/apply_patch output
// ---------------------------------------------------------------------------

function PatchResultView({ summary }: {
  summary: string;
  files?: unknown[];
  raw?: string | null;
}) {
  return (
    <ExpandableContent
      text={shortenOutputPaths(summary)}
      className="text-foreground/80"
    />
  );
}

// ---------------------------------------------------------------------------
// SearchQueryView — grep/glob/search input
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SearchResultsView — grep/search output
// ---------------------------------------------------------------------------

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
            {g.matches.map((m, mi) => (
              <div key={mi} className="flex gap-2 font-mono">
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
        {cards.map((c, ci) => (
          <div key={ci} className="space-y-0.5">
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
    <ExpandableContent
      text={shortenOutputPaths(raw)}
      className="text-foreground/80"
    />
  );
}

// ---------------------------------------------------------------------------
// TodoListView — todowrite/todoread
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DocumentView — webfetch/task/context7 output
// ---------------------------------------------------------------------------

function DocumentView({ title, url, content, format }: {
  title?: string;
  url?: string;
  content: string;
  format?: string;
}) {
  const isMarkdown = format === 'markdown' || (!format && content.includes('#'));
  const processedContent = shortenOutputPaths(content);

  return (
    <div className="space-y-1">
      {title && <div className="font-medium text-foreground/90">{title}</div>}
      {url && <div className="text-muted text-[11px] break-all">{url}</div>}
      {isMarkdown ? (
        <ExpandableContent
          text={processedContent}
          render={(text) => (
            <MarkdownContent
              content={text}
              className="text-xs text-foreground/80"
            />
          )}
        />
      ) : (
        <ExpandableContent
          text={processedContent}
          className="text-foreground/80"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QAView — question tool
// ---------------------------------------------------------------------------

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
        <ExpandableContent
          text={answersText}
          className="text-foreground/80"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusView — simple status messages
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ErrorView — error details with expandable trace
// ---------------------------------------------------------------------------

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
            <ExpandableContent
              text={details}
              className="text-error/70"
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSONView — generic structured data
// ---------------------------------------------------------------------------

function JSONView({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <ExpandableContent
      text={text}
      render={(t) => <CodeHighlight code={t} language="json" />}
    />
  );
}

// ---------------------------------------------------------------------------
// RawView — fallback plain text
// ---------------------------------------------------------------------------

function RawView({ text }: { text: string }) {
  return (
    <ExpandableContent
      text={shortenOutputPaths(text)}
      className="text-foreground/80"
    />
  );
}

// ---------------------------------------------------------------------------
// ArtifactView: dispatcher
// ---------------------------------------------------------------------------

export function ArtifactView({ artifact }: { artifact: ToolArtifact }) {
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
