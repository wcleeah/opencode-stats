export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getProjects } from '@/lib/queries/projects';
import { formatTokens, formatRelativeTime, projectName } from '@/lib/format';
import { Breadcrumbs } from '@/components/breadcrumbs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';

interface ProjectsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = getProjects(page, 20);

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
            <TableCell header align="right">Tokens In</TableCell>
            <TableCell header align="right">Tokens Out</TableCell>
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
                {formatTokens(project.total_tokens_in)}
              </TableCell>
              <TableCell align="right">
                {formatTokens(project.total_tokens_out)}
              </TableCell>
              <TableCell align="right" className="text-muted">
                {formatRelativeTime(project.last_activity)}
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
