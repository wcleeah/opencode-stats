export const dynamic = 'force-dynamic';

import {
  getSessionById,
  getSessionStats,
  getSubtaskTree,
  getSessionCostBreakdown,
} from '@/lib/queries/sessions';
import { getMessageThread, getToolCallDetailsBySession } from '@/lib/queries/messages';
import {
  formatTokens,
  formatCost,
  formatCostBreakdown,
  formatDuration,
  formatRelativeTime,
  formatDateTime,
  truncateId,
  projectName,
} from '@/lib/format';
import { aggregateCostBreakdown } from '@/lib/pricing';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { StatCard, Card } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ToolCallBlock } from '@/components/tool-call-block';
import { MarkdownContent } from '@/components/markdown-content';
import { CollapsibleContent } from '@/components/collapsible-content';
import type { SessionDetailToolCall } from '@/types';

interface SessionDetailPageProps {
  params: Promise<{ id: string }>;
}

function finishBadgeVariant(
  finish: string | null,
): 'success' | 'error' | 'warning' | 'info' | 'default' {
  switch (finish) {
    case 'end-turn':
    case 'stop':
      return 'success';
    case 'error':
      return 'error';
    case 'length':
      return 'warning';
    case 'cancel':
      return 'warning';
    case 'tool-calls':
      return 'info';
    default:
      return 'default';
  }
}

/**
 * Strip home directory prefix from absolute paths to show cleaner relative-ish paths.
 * e.g. /Users/foo/Documents/project/src/file.ts -> src/file.ts
 */
function shortenPath(path: string): string {
  // Strip common home directory patterns
  return path.replace(/^\/Users\/[^/]+\/(?:Documents\/)?[^/]+\//, '');
}

/**
 * Parse user content that contains XML-wrapped file content from OpenCode.
 * Returns structured data if it's a file attachment, null otherwise.
 */
function parseFileAttachment(
  content: string,
): { path: string; fileContent: string } | null {
  const match = content.match(
    /^<path>(.*?)<\/path>\s*<type>file<\/type>\s*<content>([\s\S]*)<\/content>$/,
  );
  if (!match) return null;
  return { path: match[1], fileContent: match[2] };
}

/**
 * Parse tool call input JSON and return readable key-value lines.
 * Each tool has different input fields -- extract the meaningful ones.
 */
function formatToolInput(tool: string, raw: string | null): string | null {
  if (!raw) return null;

  try {
    const parsed: Record<string, unknown> = JSON.parse(raw);

    switch (tool) {
      case 'bash': {
        const parts: string[] = [];
        if (parsed.command) parts.push(`$ ${parsed.command}`);
        if (parsed.workdir) parts.push(`cwd: ${shortenPath(String(parsed.workdir))}`);
        if (parsed.description) parts.push(`# ${parsed.description}`);
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'read': {
        const parts: string[] = [];
        if (parsed.filePath) parts.push(shortenPath(String(parsed.filePath)));
        if (parsed.offset != null || parsed.limit != null) {
          const range: string[] = [];
          if (parsed.offset != null) range.push(`offset: ${parsed.offset}`);
          if (parsed.limit != null) range.push(`limit: ${parsed.limit}`);
          parts.push(range.join(', '));
        }
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'edit': {
        const parts: string[] = [];
        if (parsed.filePath) parts.push(shortenPath(String(parsed.filePath)));
        if (parsed.oldString != null) {
          parts.push(`--- old`);
          parts.push(String(parsed.oldString));
          parts.push(`+++ new`);
          parts.push(String(parsed.newString ?? ''));
        }
        if (parsed.replaceAll) parts.push(`(replace all)`);
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'write': {
        const parts: string[] = [];
        if (parsed.filePath) parts.push(shortenPath(String(parsed.filePath)));
        if (parsed.content != null) parts.push(String(parsed.content));
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'glob': {
        const parts: string[] = [];
        if (parsed.pattern) parts.push(`pattern: ${parsed.pattern}`);
        if (parsed.path) parts.push(`path: ${shortenPath(String(parsed.path))}`);
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'grep': {
        const parts: string[] = [];
        if (parsed.pattern) parts.push(`pattern: ${parsed.pattern}`);
        if (parsed.include) parts.push(`include: ${parsed.include}`);
        if (parsed.path) parts.push(`path: ${shortenPath(String(parsed.path))}`);
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'task': {
        const parts: string[] = [];
        if (parsed.description) parts.push(`# ${parsed.description}`);
        if (parsed.prompt) parts.push(String(parsed.prompt));
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'webfetch': {
        const parts: string[] = [];
        if (parsed.url) parts.push(`${parsed.url}`);
        if (parsed.format) parts.push(`format: ${parsed.format}`);
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'todowrite': {
        if (Array.isArray(parsed.todos)) {
          return (parsed.todos as Array<Record<string, unknown>>)
            .map((t) => {
              const status = t.status === 'completed' ? '[x]'
                : t.status === 'in_progress' ? '[~]'
                : '[ ]';
              return `${status} ${t.content ?? t.id}`;
            })
            .join('\n');
        }
        return raw;
      }

      default: {
        // Generic: show all key-value pairs
        const entries = Object.entries(parsed);
        if (entries.length === 0) return null;
        return entries
          .map(([k, v]) => {
            const val = typeof v === 'string' ? v : JSON.stringify(v);
            return `${k}: ${val}`;
          })
          .join('\n');
      }
    }
  } catch {
    // Not JSON or parse failed -- return raw content
    return raw;
  }
}

/**
 * Shorten absolute paths in tool output content for readability.
 */
function shortenOutputPaths(content: string): string {
  return content.replace(/\/Users\/[^\s/]+\/(?:Documents\/)?[^\s/]+\//g, '');
}

/**
 * For todowrite tool, the output is just the raw JSON of what's already
 * formatted nicely in the input -- hide it to avoid redundancy.
 */
function shouldHideOutput(tool: string): boolean {
  return tool === 'todowrite';
}

export default async function SessionDetailPage({
  params,
}: SessionDetailPageProps) {
  const { id } = await params;

  const sessionResult = await getSessionById(id);
  const statsResult = await getSessionStats(id);
  const threadResult = await getMessageThread(id);
  const toolCallDetailsResult = await getToolCallDetailsBySession(id);
  const subtasksResult = await getSubtaskTree(id);
  const costBreakdownResult = await getSessionCostBreakdown(id);

  if (sessionResult.error || !sessionResult.data) {
    return (
      <div className="space-y-6">
        <Breadcrumbs crumbs={[{ label: 'session not found' }]} />
        <div className="text-error text-sm">
          {sessionResult.error ?? 'Session not found'}
        </div>
      </div>
    );
  }

  const session = sessionResult.data;
  const stats = statsResult.data;
  const thread = threadResult.data ?? [];
  const subtasks = subtasksResult.data ?? [];
  const costBreakdown = aggregateCostBreakdown(
    (costBreakdownResult.data ?? []).map((row) => ({
      reportedCost: row.reported_cost,
      modelId: row.model_id,
      tokensIn: Math.max(0, row.total_in - row.total_cache_read),
      tokensOut: row.total_out,
      tokensCacheRead: row.total_cache_read,
      tokensCacheWrite: row.total_cache_write,
    })),
  );

  // Build map: response_id -> tool calls with full details
  const toolCallsByMessage = new Map<string, SessionDetailToolCall[]>();
  for (const tc of toolCallDetailsResult.data ?? []) {
    if (!toolCallsByMessage.has(tc.response_id)) {
      toolCallsByMessage.set(tc.response_id, []);
    }
    toolCallsByMessage.get(tc.response_id)!.push(tc);
  }

  const worktree = session.project_worktree;
  const pName = worktree ? projectName(worktree) : 'unknown';

  // Group messages: filter to real user turns and their assistant responses
  const userTurns = thread.filter(
    (m) => m.synthetic === 0 && m.compaction === 0 && m.undone_at === null,
  );

  // Group by turn_id to combine multiple assistant messages per user turn
  const grouped = new Map<string, typeof thread>();
  for (const msg of thread) {
    const key = msg.turn_id;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(msg);
  }

  // Convert grouped entries to an array for indexing
  const turnEntries = Array.from(grouped.entries());

  return (
    <div className="space-y-6">
      <Breadcrumbs crumbs={[
        { label: 'projects', href: '/projects' },
        { label: pName, href: `/projects/${session.project_id}` },
        { label: session.title ?? truncateId(session.id) },
      ]} />

      <div>
        <h1 className="text-lg font-bold">
          {session.title ?? truncateId(session.id, 16)}
        </h1>
        <div className="flex items-center gap-3 text-xs text-muted mt-1">
          <span>{formatDateTime(session.created_at)}</span>
          {session.archived_at && <Badge variant="default">archived</Badge>}
          {session.version && <span>v{session.version}</span>}
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard
            label="Turns"
            value={stats.turn_count.toLocaleString()}
          />
          <StatCard
            label="Turn Wall Time"
            value={formatDuration(stats.total_turn_wall_time_ms)}
            subValue={stats.turn_count > 0
              ? `~${formatDuration(Math.round(stats.total_turn_wall_time_ms / stats.turn_count))} avg/turn`
              : undefined}
          />
          <StatCard
            label="Total Tokens"
            value={formatTokens(stats.total_tokens_in + stats.total_tokens_out)}
            subValue={
              <Tooltip
                content={
                  <span className="text-muted">
                    Input {formatTokens(stats.total_tokens_in)} · Output{' '}
                    {formatTokens(stats.total_tokens_out)}
                  </span>
                }
              >
                <span>
                  {formatTokens(stats.total_tokens_in)} in /{' '}
                  {formatTokens(stats.total_tokens_out)} out
                </span>
              </Tooltip>
            }
            accent
          />
          <StatCard
            label="Total Cost"
            value={formatCost(costBreakdown.total, costBreakdown.hasEstimated)}
            subValue={formatCostBreakdown(
              costBreakdown.reported,
              costBreakdown.estimated,
            )}
          />
          <StatCard
            label="Changes"
            value={stats.files_changed > 0
              ? `${stats.files_changed} files`
              : '--'}
            subValue={stats.files_changed > 0
              ? `+${stats.additions} / -${stats.deletions}`
              : undefined}
          />
        </div>
      )}

      {/* Subtask tree */}
      {subtasks.length > 1 && (
        <Card>
          <div className="text-xs text-muted uppercase tracking-wider mb-2">
            Subtask Tree
          </div>
          <div className="space-y-1">
            {subtasks.map((node) => (
              <div
                key={node.id}
                className="text-xs"
                style={{ paddingLeft: `${node.depth * 16}px` }}
              >
                <span className="text-grep-7">
                  {node.depth > 0 ? '|- ' : ''}
                </span>
                {node.id === id ? (
                  <span className="text-accent font-medium">
                    {node.title ?? truncateId(node.id)}
                  </span>
                ) : (
                  <a
                    href={`/sessions/${node.id}`}
                    className="text-muted hover:text-foreground transition-colors"
                  >
                    {node.title ?? truncateId(node.id)}
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Conversation thread */}
      <div>
        <div className="text-xs text-muted uppercase tracking-wider mb-3">
          Conversation ({stats?.turn_count ?? userTurns.length} turns)
        </div>
        <div className="space-y-5">
          {turnEntries.map(([umId, messages], turnIndex) => {
            const first = messages[0];
            if (!first) return null;

            const isUndone = first.undone_at !== null;
            const isSynthetic = !!first.synthetic;

            // Get all assistant responses for this user message
            const assistantMsgs = messages.filter(
              (m) => m.response_id !== null,
            );

            // Parse user content for file attachments
            const fileAttachment = first.user_content
              ? parseFileAttachment(first.user_content)
              : null;

            return (
              <div
                key={umId}
                className="border border-border rounded-sm"
              >
                {/* User message */}
                <div className="border-b border-border p-3 bg-grep-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-grep-8 tabular-nums shrink-0">
                      #{turnIndex + 1}
                    </span>
                    <span className="text-xs font-bold text-accent">
                      &gt; user
                    </span>
                    <span className="text-xs text-muted">
                      {formatRelativeTime(first.user_created_at)}
                    </span>
                    {first.turn_duration_ms != null
                      && first.turn_duration_ms > 0 && (
                      <span className="text-xs text-grep-8 tabular-nums">
                        {formatDuration(first.turn_duration_ms)}
                      </span>
                    )}
                    {isSynthetic && (
                      <Badge variant="warning">synthetic</Badge>
                    )}
                    {!!first.compaction && (
                      <Badge variant="info">compaction</Badge>
                    )}
                    {isUndone && (
                      <Badge variant="error">undone</Badge>
                    )}
                  </div>

                  {/* User content */}
                  <div
                    className={
                      isUndone ? 'line-through text-muted' : ''
                    }
                  >
                    {fileAttachment ? (
                      // Render file attachment compactly
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                          <span className="text-accent/70">file:</span>
                          <span className="text-foreground/70">
                            {shortenPath(fileAttachment.path)}
                          </span>
                        </div>
                        <CollapsibleContent
                          content={fileAttachment.fileContent}
                          maxLines={6}
                          className="text-xs text-foreground/60 font-mono"
                        />
                      </div>
                    ) : first.user_content ? (
                      <CollapsibleContent
                        content={first.user_content}
                        maxLines={isSynthetic ? 6 : 20}
                        className="text-sm text-foreground/90"
                      />
                    ) : (
                      <span className="text-muted italic text-sm">
                        [no content]
                      </span>
                    )}
                  </div>
                </div>

                {/* Assistant response(s) */}
                {assistantMsgs.map((am, responseIndex) => {
                  if (!am.response_id) return null;

                  const msgToolCalls =
                    toolCallsByMessage.get(am.response_id) ?? [];

                  // Is this the final response (stop/end-turn) vs intermediate
                  const isFinal =
                    am.finish === 'stop' || am.finish === 'end-turn';
                  const isLastResponse =
                    responseIndex === assistantMsgs.length - 1;

                  return (
                    <div
                      key={am.response_id}
                      className={`p-3 border-b border-border last:border-b-0${
                        isFinal && isLastResponse
                          ? ' bg-grep-0'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold text-info">
                          assistant
                        </span>
                        {am.model_id && (
                          <Badge variant="info">{am.model_id}</Badge>
                        )}
                        {am.finish && (
                          <Badge variant={finishBadgeVariant(am.finish)}>
                            {am.finish}
                          </Badge>
                        )}
                        {am.tokens_in != null && (
                          <span className="text-xs text-muted tabular-nums">
                            {formatTokens(am.tokens_in)} in /{' '}
                            {formatTokens(am.tokens_out ?? 0)} out
                          </span>
                        )}
                        {am.time_completed && am.response_created_at && (
                          <span className="text-xs text-muted tabular-nums">
                            {formatDuration(
                              am.time_completed - am.response_created_at,
                            )}
                          </span>
                        )}
                      </div>
                      {am.error_type && (
                        <div className="text-xs text-error mb-1">
                          {am.error_type}: {am.error_message}
                        </div>
                      )}
                      {am.response_text && (
                        <MarkdownContent
                          content={am.response_text}
                          className={`text-sm text-foreground/90 max-h-96 overflow-y-auto${
                            isUndone ? ' line-through text-muted' : ''
                          }`}
                        />
                      )}
                      {/* Inline tool calls */}
                      {msgToolCalls.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {msgToolCalls.map((tc) => (
                            <ToolCallBlock
                              key={tc.id}
                              tool={tc.tool}
                              title={tc.title}
                              status={tc.status}
                              error={tc.error}
                              durationMs={tc.duration_ms}
                              formattedInput={formatToolInput(
                                tc.tool,
                                tc.input_content,
                              )}
                              outputContent={
                                shouldHideOutput(tc.tool)
                                  ? null
                                  : tc.output_content
                                    ? shortenOutputPaths(tc.output_content)
                                    : null
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
