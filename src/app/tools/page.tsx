export const dynamic = 'force-dynamic';

import { getToolUsage } from '@/lib/queries/analytics';
import {
  formatDuration,
  formatBytes,
  formatPercent,
} from '@/lib/format';
import { Card, StatCard } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ToolChart } from '@/components/tool-chart';

export default async function ToolsPage() {
  const tools = await getToolUsage();

  if (tools.error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="text-error text-sm mb-2">Failed to load tool usage</div>
          <div className="text-muted text-xs">{tools.error}</div>
        </div>
      </div>
    );
  }

  const data = tools.data ?? [];

  const totalCalls = data.reduce((sum, t) => sum + t.call_count, 0);
  const totalErrors = data.reduce((sum, t) => sum + t.error_count, 0);
  const overallErrorRate = totalCalls > 0 ? (100 * totalErrors) / totalCalls : 0;
  const avgDuration =
    totalCalls > 0
      ? data.reduce((sum, t) => sum + t.avg_duration_ms * t.call_count, 0) / totalCalls
      : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Tools</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Unique Tools" value={data.length.toLocaleString()} />
        <StatCard
          label="Total Calls"
          value={totalCalls.toLocaleString()}
          accent
        />
        <StatCard
          label="Error Rate"
          value={formatPercent(overallErrorRate)}
          subValue={`${totalErrors.toLocaleString()} errors`}
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(avgDuration)}
        />
      </div>

      {/* Tool usage bar chart */}
      {data.length > 0 && (
        <Card>
          <div className="mb-3 text-xs text-muted uppercase tracking-wider">
            Tool Call Distribution
          </div>
          <ToolChart data={data} />
        </Card>
      )}

      {/* Tool usage table */}
      {data.length > 0 && (
        <div>
          <div className="mb-2 text-xs text-muted uppercase tracking-wider">
            All Tools
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Tool</TableCell>
                <TableCell header align="right">Calls</TableCell>
                <TableCell header align="right">Errors</TableCell>
                <TableCell header align="right">Error Rate</TableCell>
                <TableCell header align="right">Avg Duration</TableCell>
                <TableCell header align="right">Max Duration</TableCell>
                <TableCell header align="right">Input</TableCell>
                <TableCell header align="right">Output</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((tool) => (
                <TableRow key={tool.tool}>
                  <TableCell className="text-foreground font-medium">
                    {tool.tool}
                  </TableCell>
                  <TableCell align="right">
                    {tool.call_count.toLocaleString()}
                  </TableCell>
                  <TableCell align="right">
                    {tool.error_count > 0 ? (
                      <Badge variant="error">{tool.error_count}</Badge>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <span
                      className={
                        tool.error_rate > 10
                          ? 'text-error'
                          : tool.error_rate > 5
                            ? 'text-warning'
                            : 'text-muted'
                      }
                    >
                      {formatPercent(tool.error_rate)}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    {formatDuration(tool.avg_duration_ms)}
                  </TableCell>
                  <TableCell align="right">
                    {formatDuration(tool.max_duration_ms)}
                  </TableCell>
                  <TableCell align="right">
                    {formatBytes(tool.total_input_bytes)}
                  </TableCell>
                  <TableCell align="right">
                    {formatBytes(tool.total_output_bytes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data.length === 0 && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-muted text-sm">No tool usage data available</div>
        </div>
      )}
    </div>
  );
}
