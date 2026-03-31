export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getProjects, getProjectCostBreakdowns } from '@/lib/queries/projects';
import { formatTokens, formatRelativeTime, formatDuration, projectName, formatCost } from '@/lib/format';
import { aggregateCostBreakdown } from '@/lib/pricing';
import { Breadcrumbs } from '@/components/breadcrumbs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Tooltip } from '@/components/ui/tooltip';

interface ProjectsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await getProjects(page, 20);

  if (result.error) {
    return (
      <div className="space-y-6">
        <Breadcrumbs crumbs={[{ label: 'projects' }]} />
        <div className="text-error text-sm">{result.error}</div>
      </div>
    );
  }

  const projects = result.data;
  if (!projects || projects.data.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumbs crumbs={[{ label: 'projects' }]} />
        <div className="text-muted text-sm">No projects found</div>
      </div>
    );
  }

  const costBreakdownsResult = await getProjectCostBreakdowns(
    projects.data.map((project) => project.id),
  );

  const costBreakdowns = new Map<string, ReturnType<typeof aggregateCostBreakdown>>();
  const grouped: Record<string, Array<{
    reportedCost: number;
    modelId: string;
    tokensIn: number;
    tokensOut: number;
    tokensCacheRead: number;
    tokensCacheWrite: number;
  }>> = {};

  for (const row of costBreakdownsResult.data ?? []) {
    if (!grouped[row.project_id]) grouped[row.project_id] = [];
    const uncachedIn = Math.max(0, row.total_in - row.total_cache_read);
    grouped[row.project_id].push({
      reportedCost: row.reported_cost,
      modelId: row.model_id,
      tokensIn: uncachedIn,
      tokensOut: row.total_out,
      tokensCacheRead: row.total_cache_read,
      tokensCacheWrite: row.total_cache_write,
    });
  }

  for (const project of projects.data) {
    const rows = grouped[project.id] ?? [];
    const breakdown = aggregateCostBreakdown(rows);
    costBreakdowns.set(project.id, breakdown);
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs crumbs={[{ label: 'projects' }]} />

      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold">Projects</h1>
        <span className="text-xs text-muted">
          {projects.total} total
        </span>
      </div>

      <Table>
        <TableHeader>
            <TableRow>
              <TableCell header>Project</TableCell>
              <TableCell header align="right">Sessions</TableCell>
              <TableCell header align="right">Active Time</TableCell>
              <TableCell header align="right">Tokens</TableCell>
              <TableCell header align="right">Total Cost (est)</TableCell>
              <TableCell header align="right">Last Active</TableCell>
            </TableRow>
        </TableHeader>
        <TableBody>
          {projects.data.map((project) => (
            <TableRow key={project.id}>
              <TableCell>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-foreground hover:text-accent transition-colors font-medium"
                >
                  {projectName(project.worktree)}
                </Link>
                <div className="text-xs text-muted mt-0.5 truncate max-w-xs">
                  {project.worktree}
                </div>
              </TableCell>
              <TableCell align="right">
                {project.session_count}
              </TableCell>
              <TableCell align="right">
                {project.total_turn_wall_time_ms > 0 ? (
                  <span className="tabular-nums text-muted">
                    {formatDuration(project.total_turn_wall_time_ms)}
                  </span>
                ) : (
                  <span className="text-grep-5">--</span>
                )}
              </TableCell>
              <TableCell align="right">
                <Tooltip
                  content={
                    <span className="text-muted">
                      Input {formatTokens(project.total_tokens_in)} · Output{' '}
                      {formatTokens(project.total_tokens_out)}
                    </span>
                  }
                >
                <span className="tabular-nums">
                    {formatTokens(project.total_tokens_in + project.total_tokens_out)}
                </span>
              </Tooltip>
              </TableCell>
              <TableCell align="right">
                <span className="text-muted">
                  {formatCost(
                    costBreakdowns.get(project.id)?.total ?? 0,
                    costBreakdowns.get(project.id)?.hasEstimated ?? false,
                  )}
                </span>
              </TableCell>
              <TableCell align="right" className="text-muted">
                {project.last_activity ? formatRelativeTime(project.last_activity) : '--'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination
        page={projects.page}
        totalPages={projects.totalPages}
        baseUrl="/projects"
      />
    </div>
  );
}
