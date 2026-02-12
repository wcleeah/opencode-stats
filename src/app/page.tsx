import { getGlobalStats } from '@/lib/queries/stats';
import { getDailyTokenUsage, getModelUsage } from '@/lib/queries/analytics';
import { formatTokens, formatCost } from '@/lib/format';
import { StatCard } from '@/components/ui/card';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TokenChart } from '@/components/token-chart';
import { Breadcrumbs } from '@/components/breadcrumbs';

export default async function Home() {
  const stats = getGlobalStats();
  const dailyTokens = getDailyTokenUsage();
  const models = getModelUsage();

  if (stats.error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="text-error text-sm mb-2">
            Failed to load dashboard
          </div>
          <div className="text-muted text-xs">{stats.error}</div>
        </div>
      </div>
    );
  }

  const s = stats.data;
  if (!s) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted text-sm">No data available</div>
      </div>
    );
  }

  const totalTokens = s.total_tokens_in + s.total_tokens_out;

  return (
    <div className="space-y-6">
      <Breadcrumbs crumbs={[{ label: 'dashboard' }]} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Projects"
          value={s.total_projects.toLocaleString()}
        />
        <StatCard
          label="Sessions"
          value={s.total_sessions.toLocaleString()}
        />
        <StatCard
          label="Turns"
          value={s.total_turns.toLocaleString()}
          subValue="user messages"
        />
        <StatCard
          label="Total Tokens"
          value={formatTokens(totalTokens)}
          subValue={`${formatTokens(s.total_tokens_in)} in / ${formatTokens(s.total_tokens_out)} out`}
          accent
        />
        <StatCard
          label="Tool Calls"
          value={s.total_tool_calls.toLocaleString()}
        />
        <StatCard
          label="Models Used"
          value={s.models_used.toLocaleString()}
        />
        <StatCard
          label="Cost"
          value={formatCost(s.total_cost)}
          subValue={s.total_cost === 0 ? 'estimated N/A' : undefined}
        />
      </div>

      {/* Daily token usage chart */}
      <Card>
        <div className="mb-3 text-xs text-muted uppercase tracking-wider">
          Daily Token Usage
        </div>
        <TokenChart data={dailyTokens.data ?? []} />
      </Card>

      {/* Model usage table */}
      {models.data && models.data.length > 0 && (
        <div>
          <div className="mb-2 text-xs text-muted uppercase tracking-wider">
            Model Usage
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Model</TableCell>
                <TableCell header>Provider</TableCell>
                <TableCell header align="right">Responses</TableCell>
                <TableCell header align="right">Tokens In</TableCell>
                <TableCell header align="right">Tokens Out</TableCell>
                <TableCell header align="right">Cache Hit</TableCell>
                <TableCell header align="right">Cost</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.data.map((model) => (
                <TableRow key={`${model.model_id}-${model.provider_id}`}>
                  <TableCell className="text-foreground font-medium">
                    {model.model_id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{model.provider_id}</Badge>
                  </TableCell>
                  <TableCell align="right">
                    {model.response_count.toLocaleString()}
                  </TableCell>
                  <TableCell align="right">
                    {formatTokens(model.total_in)}
                  </TableCell>
                  <TableCell align="right">
                    {formatTokens(model.total_out)}
                  </TableCell>
                  <TableCell align="right">
                    {model.cache_hit_pct}%
                  </TableCell>
                  <TableCell align="right">
                    {formatCost(model.total_cost)}
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
