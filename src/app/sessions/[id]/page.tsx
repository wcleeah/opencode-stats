export const dynamic = 'force-dynamic';

import { getSessionById, getSessionStats, getSubtaskTree } from '@/lib/queries/sessions';
import { getMessageThread, getToolCallsForSession } from '@/lib/queries/messages';
import {
  formatTokens,
  formatCost,
  formatDuration,
  formatRelativeTime,
  formatDateTime,
  truncateId,
  projectName,
} from '@/lib/format';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { StatCard, Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export default async function SessionDetailPage({
  params,
}: SessionDetailPageProps) {
  const { id } = await params;

  const sessionResult = await getSessionById(id);
  const statsResult = await getSessionStats(id);
  const threadResult = await getMessageThread(id);
  const toolCallsResult = await getToolCallsForSession(id);
  const subtasksResult = await getSubtaskTree(id);

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
  const toolCalls = toolCallsResult.data ?? [];
  const subtasks = subtasksResult.data ?? [];

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
            label="Tokens In"
            value={formatTokens(stats.total_tokens_in)}
          />
          <StatCard
            label="Tokens Out"
            value={formatTokens(stats.total_tokens_out)}
            accent
          />
          <StatCard
            label="Cost"
            value={formatCost(stats.total_cost)}
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
          Conversation ({userTurns.length} turns)
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
            // The final response is the last non-tool-calls one
            const finalResponse = assistantMsgs.find(
              (m) => m.finish !== 'tool-calls',
            ) ?? assistantMsgs[assistantMsgs.length - 1];

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
                            {formatTokens(am.tokens_in)} in / {formatTokens(am.tokens_out ?? 0)} out
                          </span>
                        )}
                        {am.completed_at && am.assistant_created_at && (
                          <span className="text-xs text-grep-7">
                            {formatDuration(am.completed_at - am.assistant_created_at)}
                          </span>
                        )}
                      </div>
                      {am.error_type && (
                        <div className="text-xs text-error mb-1">
                          {am.error_type}: {am.error_message}
                        </div>
                      )}
                      {am.assistant_text ? (
                        <div className="text-sm whitespace-pre-wrap text-grep-11 max-h-96 overflow-y-auto">
                          {am.assistant_text}
                        </div>
                      ) : (
                        am.finish === 'tool-calls' && (
                          <span className="text-xs text-grep-5 italic">
                            [tool calls...]
                          </span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tool calls timeline */}
      {toolCalls.length > 0 && (
        <div>
          <div className="text-xs text-muted uppercase tracking-wider mb-3">
            Tool Calls ({toolCalls.length})
          </div>
          <div className="space-y-1">
            {toolCalls.map((tc) => (
              <div
                key={tc.id}
                className="flex items-center gap-3 text-xs py-1 border-b border-border/50 last:border-b-0"
              >
                <Badge
                  variant={tc.status === 'error' ? 'error' : 'success'}
                >
                  {tc.tool}
                </Badge>
                <span className="text-grep-11 truncate flex-1">
                  {tc.title ?? truncateId(tc.id)}
                </span>
                {tc.duration_ms != null && (
                  <span className="text-grep-7 tabular-nums">
                    {formatDuration(tc.duration_ms)}
                  </span>
                )}
                {tc.error && (
                  <span className="text-error truncate max-w-xs">
                    {tc.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
