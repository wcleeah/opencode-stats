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
import type { ToolCallDetail } from '@/types';

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
 * Parse tool call input JSON and return readable key-value lines.
 * Each tool has different input fields — extract the meaningful ones.
 */
function formatToolInput(tool: string, raw: string | null): string | null {
  if (!raw) return null;

  try {
    const parsed: Record<string, unknown> = JSON.parse(raw);

    switch (tool) {
      case 'bash': {
        const parts: string[] = [];
        if (parsed.command) parts.push(`$ ${parsed.command}`);
        if (parsed.workdir) parts.push(`cwd: ${parsed.workdir}`);
        if (parsed.description) parts.push(`# ${parsed.description}`);
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'read': {
        const parts: string[] = [];
        if (parsed.filePath) parts.push(`${parsed.filePath}`);
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
        if (parsed.filePath) parts.push(`${parsed.filePath}`);
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
        if (parsed.filePath) parts.push(`${parsed.filePath}`);
        if (parsed.content != null) parts.push(String(parsed.content));
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'glob': {
        const parts: string[] = [];
        if (parsed.pattern) parts.push(`pattern: ${parsed.pattern}`);
        if (parsed.path) parts.push(`path: ${parsed.path}`);
        return parts.length > 0 ? parts.join('\n') : raw;
      }

      case 'grep': {
        const parts: string[] = [];
        if (parsed.pattern) parts.push(`pattern: ${parsed.pattern}`);
        if (parsed.include) parts.push(`include: ${parsed.include}`);
        if (parsed.path) parts.push(`path: ${parsed.path}`);
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
    // Not JSON or parse failed — return raw content
    return raw;
  }
}

function ToolCallBlock({ tc }: { tc: ToolCallDetail }) {
  const formattedInput = formatToolInput(tc.tool, tc.input_content);

  return (
    <div className="border border-border/50 rounded-sm overflow-hidden">
      {/* Tool call header */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-grep-1 border-b border-border/50">
        <Badge variant={tc.status === 'error' ? 'error' : 'success'}>
          {tc.tool}
        </Badge>
        {tc.title && (
          <span className="text-xs text-grep-9 truncate flex-1">
            {tc.title}
          </span>
        )}
        {tc.duration_ms != null && (
          <span className="text-xs text-grep-7 tabular-nums shrink-0">
            {formatDuration(tc.duration_ms)}
          </span>
        )}
      </div>

      {/* Error */}
      {tc.error && (
        <div className="px-2 py-1.5 text-xs text-error bg-error/5 border-b border-border/50">
          {tc.error}
        </div>
      )}

      {/* Input content */}
      {formattedInput && (
        <div className="border-b border-border/50">
          <div className="px-2 py-1 text-[10px] text-grep-5 uppercase tracking-wider">
            input
          </div>
          <div className="px-2 pb-2 text-xs whitespace-pre-wrap text-grep-9 max-h-64 overflow-y-auto">
            {formattedInput}
          </div>
        </div>
      )}

      {/* Output content */}
      {tc.output_content && (
        <div>
          <div className="px-2 py-1 text-[10px] text-grep-5 uppercase tracking-wider">
            output
          </div>
          <div className="px-2 pb-2 text-xs whitespace-pre-wrap text-grep-9 max-h-64 overflow-y-auto">
            {tc.output_content}
          </div>
        </div>
      )}
    </div>
  );
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

  // Build map: assistant_message_id -> tool calls with full details
  const toolCallsByMessage = new Map<string, ToolCallDetail[]>();
  for (const tc of toolCallDetailsResult.data ?? []) {
    if (!toolCallsByMessage.has(tc.assistant_message_id)) {
      toolCallsByMessage.set(tc.assistant_message_id, []);
    }
    toolCallsByMessage.get(tc.assistant_message_id)!.push(tc);
  }

  const worktree = session.project_worktree;
  const pName = worktree ? projectName(worktree) : 'unknown';

  // Group messages: filter to real user turns and their assistant responses
  const userTurns = thread.filter(
    (m) => m.synthetic === 0 && m.compaction === 0 && m.undone_at === null,
  );

  // Group by user_message_id to combine multiple assistant messages per user turn
  const grouped = new Map<string, typeof thread>();
  for (const msg of thread) {
    const key = msg.user_message_id;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(msg);
  }

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
                  {formatTokens(stats.total_tokens_in)} in / {formatTokens(stats.total_tokens_out)} out
                </span>
              </Tooltip>
            }
            accent
          />
          <StatCard
            label="Total Cost"
            value={formatCost(costBreakdown.total, costBreakdown.hasEstimated)}
            subValue={formatCostBreakdown(costBreakdown.reported, costBreakdown.estimated)}
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
                <span className="text-grep-5">
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
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([umId, messages]) => {
            const first = messages[0];
            if (!first) return null;

            // Skip synthetic/compacted/undone messages
            if (first.synthetic || first.compaction || first.undone_at) {
              return null;
            }

            // Get all assistant responses for this user message
            const assistantMsgs = messages.filter(
              (m) => m.assistant_message_id !== null,
            );

            return (
              <div key={umId} className="border border-border rounded-sm">
                {/* User message */}
                <div className="border-b border-border p-3 bg-grep-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-accent">
                      &gt; user
                    </span>
                    <span className="text-xs text-grep-7">
                      {formatRelativeTime(first.user_created_at)}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">
                    {first.user_content ?? (
                      <span className="text-grep-5 italic">
                        [no content]
                      </span>
                    )}
                  </div>
                </div>

                {/* Assistant response(s) */}
                {assistantMsgs.map((am) => {
                  if (!am.assistant_message_id) return null;

                  const msgToolCalls =
                    toolCallsByMessage.get(am.assistant_message_id) ?? [];

                  return (
                    <div
                      key={am.assistant_message_id}
                      className="p-3 border-b border-border last:border-b-0"
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
                          <span className="text-xs text-grep-7">
                            {formatTokens(am.tokens_in)} in /{' '}
                            {formatTokens(am.tokens_out ?? 0)} out
                          </span>
                        )}
                        {am.completed_at && am.assistant_created_at && (
                          <span className="text-xs text-grep-7">
                            {formatDuration(
                              am.completed_at - am.assistant_created_at,
                            )}
                          </span>
                        )}
                      </div>
                      {am.error_type && (
                        <div className="text-xs text-error mb-1">
                          {am.error_type}: {am.error_message}
                        </div>
                      )}
                      {am.assistant_text && (
                        <div className="text-sm whitespace-pre-wrap text-grep-11 max-h-96 overflow-y-auto">
                          {am.assistant_text}
                        </div>
                      )}
                      {/* Inline tool calls */}
                      {msgToolCalls.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msgToolCalls.map((tc) => (
                            <ToolCallBlock key={tc.id} tc={tc} />
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
