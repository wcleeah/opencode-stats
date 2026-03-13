export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getTimeStats, getDailyTimeUsage, getProjectTimeBreakdown } from '@/lib/queries/time';
import { formatDuration, formatRelativeTime, projectName } from '@/lib/format';
import { parseDateRange } from '@/lib/date-range';

import { Card, StatCard } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DateRangeControls } from '@/components/date-range-controls';
import { TimeChart } from '@/components/time-chart';

interface TimePageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function TimePage({ searchParams }: TimePageProps) {
  const params = await searchParams;
  const range = parseDateRange({ from: params.from, to: params.to });

  const statsResult = await getTimeStats(range.startMs, range.endMs);
  const dailyResult = await getDailyTimeUsage(range.startMs, range.endMs);
  const projectsResult = await getProjectTimeBreakdown(range.startMs, range.endMs);

  if (statsResult.error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="text-error text-sm mb-2">
            Failed to load time stats
          </div>
          <div className="text-muted text-xs">{statsResult.error}</div>
        </div>
      </div>
    );
  }

  const s = statsResult.data;
  if (!s) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted text-sm">No data available</div>
      </div>
    );
  }

  const dailyData = dailyResult.data ?? [];
  const projects = projectsResult.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs crumbs={[{ label: 'time' }]} />
        <DateRangeControls from={range.from} to={range.to} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total Active Time"
          value={formatDuration(s.total_active_time_ms)}
          subValue={s.total_turns > 0
            ? `~${formatDuration(Math.round(s.total_active_time_ms / s.total_turns))} avg/turn`
            : undefined}
          accent
        />
        <StatCard
          label="Turns"
          value={s.total_turns.toLocaleString()}
          subValue="user messages"
        />
        <StatCard
          label="Avg Turn Duration"
          value={formatDuration(s.avg_turn_duration_ms)}
        />
        <StatCard
          label="Longest Turn"
          value={formatDuration(s.max_turn_duration_ms)}
        />
        <StatCard
          label="Avg Response Time"
          value={formatDuration(s.avg_response_time_ms)}
          subValue="per assistant message"
        />
        <StatCard
          label="Total Responses"
          value={s.total_responses.toLocaleString()}
        />
      </div>

      {/* Daily time trend chart */}
      <Card>
        <div className="mb-3 text-xs text-muted uppercase tracking-wider">
          Daily Time Usage
        </div>
        <TimeChart data={dailyData} />
      </Card>

      {/* Project time breakdown */}
      {projects.length > 0 && (
        <div>
          <div className="mb-2 text-xs text-muted uppercase tracking-wider">
            Time by Project
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Project</TableCell>
                <TableCell header align="right">Active Time</TableCell>
                <TableCell header align="right">Turns</TableCell>
                <TableCell header align="right">Avg/Turn</TableCell>
                <TableCell header align="right">Avg Response</TableCell>
                <TableCell header align="right">Last Active</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.project_id}>
                  <TableCell>
                    <Link
                      href={`/projects/${project.project_id}`}
                      className="text-foreground hover:text-accent transition-colors font-medium"
                    >
                      {projectName(project.worktree)}
                    </Link>
                    <div className="text-xs text-muted mt-0.5 truncate max-w-xs">
                      {project.worktree}
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <span className="tabular-nums font-medium text-accent">
                      {formatDuration(project.total_active_time_ms)}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    {project.turn_count.toLocaleString()}
                  </TableCell>
                  <TableCell align="right">
                    <span className="tabular-nums text-muted">
                      {project.avg_turn_duration_ms > 0
                        ? formatDuration(project.avg_turn_duration_ms)
                        : '--'}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="tabular-nums text-muted">
                      {project.avg_response_time_ms > 0
                        ? formatDuration(project.avg_response_time_ms)
                        : '--'}
                    </span>
                  </TableCell>
                  <TableCell align="right" className="text-muted">
                    {project.last_activity ? formatRelativeTime(project.last_activity) : '--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
