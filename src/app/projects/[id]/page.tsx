import Link from 'next/link';

import { getProjectById } from '@/lib/queries/projects';
import { getSessionsByProject } from '@/lib/queries/sessions';
import {
  formatTokens,
  formatRelativeTime,
  formatDiff,
  projectName,
  truncateId,
} from '@/lib/format';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { StatCard } from '@/components/ui/card';
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

  const projectResult = getProjectById(id);
  const sessionsResult = getSessionsByProject(id, page, 20);

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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sessions" value={project.session_count.toLocaleString()} />
        <StatCard
          label="Tokens In"
          value={formatTokens(project.total_tokens_in)}
        />
        <StatCard
          label="Tokens Out"
          value={formatTokens(project.total_tokens_out)}
          accent
        />
        <StatCard
          label="Last Active"
          value={formatRelativeTime(project.last_activity)}
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
                <TableCell header align="right">Tokens</TableCell>
                <TableCell header align="right">Changes</TableCell>
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
                    <span className="text-muted">
                      {formatTokens(session.total_tokens_in + session.total_tokens_out)}
                    </span>
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
