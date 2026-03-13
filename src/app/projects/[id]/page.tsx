export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getProjectById, getProjectCostBreakdowns } from '@/lib/queries/projects';
import { getSessionsByProject, getSessionCostBreakdown } from '@/lib/queries/sessions';
import {
  formatTokens,
  formatRelativeTime,
  formatDuration,
  projectName,
  truncateId,
  formatCost,
  formatCostBreakdown,
} from '@/lib/format';
import { aggregateCostBreakdown } from '@/lib/pricing';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { StatCard } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const projectResult = await getProjectById(id);
  const sessionsResult = await getSessionsByProject(id, page, 20);
  const projectCostResult = await getProjectCostBreakdowns([id]);
  const projectCostRows = projectCostResult.data ?? [];

  const sessionCostResults = sessionsResult.data
    ? await Promise.all(
      sessionsResult.data.data.map(async (session) => ({
        sessionId: session.id,
        result: await getSessionCostBreakdown(session.id),
      })),
    )
    : [];

  if (projectResult.error || !projectResult.data) {
    return (
      <div className="space-y-6">
        <Breadcrumbs crumbs={[
          { label: 'projects', href: '/projects' },
          { label: 'not found' },
        ]} />
        <div className="text-error text-sm">
          {projectResult.error ?? 'Project not found'}
        </div>
      </div>
    );
  }

  const project = projectResult.data;
  const sessions = sessionsResult.data;
  const name = projectName(project.worktree);
  const projectCost = aggregateCostBreakdown(
    projectCostRows.map((row) => ({
      reportedCost: row.reported_cost,
      modelId: row.model_id,
      tokensIn: Math.max(0, row.total_in - row.total_cache_read),
      tokensOut: row.total_out,
      tokensCacheRead: row.total_cache_read,
      tokensCacheWrite: row.total_cache_write,
    })),
  );

  const sessionCostMap = new Map<string, ReturnType<typeof aggregateCostBreakdown>>();
  for (const entry of sessionCostResults) {
    const rows = entry.result.data ?? [];
    const breakdown = aggregateCostBreakdown(
      rows.map((row) => ({
        reportedCost: row.reported_cost,
        modelId: row.model_id,
        tokensIn: Math.max(0, row.total_in - row.total_cache_read),
        tokensOut: row.total_out,
        tokensCacheRead: row.total_cache_read,
        tokensCacheWrite: row.total_cache_write,
      })),
    );
    sessionCostMap.set(entry.sessionId, breakdown);
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs crumbs={[
        { label: 'projects', href: '/projects' },
        { label: name },
      ]} />

      <div>
        <h1 className="text-lg font-bold">{name}</h1>
        <div className="text-xs text-muted mt-1">{project.worktree}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Sessions" value={project.session_count.toLocaleString()} />
        <StatCard
          label="Total Tokens"
          value={formatTokens(project.total_tokens_in + project.total_tokens_out)}
          subValue={
            <Tooltip
              content={
                <span className="text-muted">
                      Input {formatTokens(project.total_tokens_in)} · Output{' '}
                      {formatTokens(project.total_tokens_out)}
                    </span>
                  }
            >
              <span>
                  {formatTokens(project.total_tokens_in)} in / {formatTokens(project.total_tokens_out)} out
                </span>
              </Tooltip>
          }
          accent
        />
        <StatCard
          label="Total Cost"
          value={formatCost(projectCost.total, projectCost.hasEstimated)}
          subValue={formatCostBreakdown(projectCost.reported, projectCost.estimated)}
        />
        <StatCard
          label="Active Time"
          value={formatDuration(project.total_active_time_ms)}
          subValue={project.session_count > 0
            ? `~${formatDuration(Math.round(project.total_active_time_ms / project.session_count))} avg/session`
            : undefined}
        />
        <StatCard
          label="Last Active"
          value={project.last_activity ? formatRelativeTime(project.last_activity) : '--'}
        />
      </div>

      {sessions && sessions.data.length > 0 && (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-muted uppercase tracking-wider">
              Sessions
            </h2>
            <span className="text-xs text-muted">
              {sessions.total} total
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Session</TableCell>
                <TableCell header align="right">Turns</TableCell>
                <TableCell header align="right">Active Time</TableCell>
                <TableCell header align="right">Tokens</TableCell>
                <TableCell header align="right">Changes</TableCell>
                <TableCell header align="right">Total Cost (est)</TableCell>
                <TableCell header align="right">Updated</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.data.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <Link
                      href={`/sessions/${session.id}`}
                      className="text-foreground hover:text-accent transition-colors font-medium"
                    >
                      {session.title ?? truncateId(session.id)}
                    </Link>
                    {session.archived_at && (
                      <Badge variant="default" className="ml-2">
                        archived
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {session.turn_count}
                  </TableCell>
                  <TableCell align="right">
                    {session.total_active_time_ms > 0 ? (
                      <span className="tabular-nums text-muted">
                        {formatDuration(session.total_active_time_ms)}
                      </span>
                    ) : (
                      <span className="text-grep-5">--</span>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip
                      content={
                        <span className="text-muted">
                           Input {formatTokens(session.total_tokens_in)} · Output{' '}
                           {formatTokens(session.total_tokens_out)}
                         </span>
                       }
                    >
                      <span className="tabular-nums text-muted">
                        {formatTokens(session.total_tokens_in + session.total_tokens_out)}
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    {session.files_changed > 0 ? (
                      <span>
                        <span className="text-success">
                          +{session.additions}
                        </span>
                        {' / '}
                        <span className="text-error">
                          -{session.deletions}
                        </span>
                        <span className="text-muted ml-1">
                          ({session.files_changed}f)
                        </span>
                      </span>
                    ) : (
                      <span className="text-grep-5">--</span>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <span className="text-muted">
                      {formatCost(
                        sessionCostMap.get(session.id)?.total ?? 0,
                        sessionCostMap.get(session.id)?.hasEstimated ?? false,
                      )}
                    </span>
                  </TableCell>
                  <TableCell align="right" className="text-muted">
                    {formatRelativeTime(session.updated_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            page={sessions.page}
            totalPages={sessions.totalPages}
            baseUrl={`/projects/${id}`}
          />
        </>
      )}
    </div>
  );
}
