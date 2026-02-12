export const dynamic = 'force-dynamic';

import { getGlobalStats } from '@/lib/queries/stats';
import { getDailyTokenUsage, getModelUsage } from '@/lib/queries/analytics';
import { estimateCost } from '@/lib/pricing';
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

  // Compute estimated total cost from per-model data
  const modelData = models.data ?? [];
  let totalEstimatedCost = 0;
  let anyEstimated = false;
  for (const m of modelData) {
    const est = estimateCost({
      reportedCost: m.total_cost,
      modelId: m.model_id,
      tokensIn: m.total_in,
      tokensOut: m.total_out,
      tokensCacheRead: m.total_cache_read,
      tokensCacheWrite: m.total_cache_write,
    });
    totalEstimatedCost += est.cost;
    if (est.estimated) anyEstimated = true;
  }

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
          label="Est. Cost"
          value={formatCost(totalEstimatedCost, anyEstimated)}
          subValue={anyEstimated ? 'includes estimates' : undefined}
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
      {modelData.length > 0 && (
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
                <TableCell header align="right">Est. Cost</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelData.map((model) => {
                const est = estimateCost({
                  reportedCost: model.total_cost,
                  modelId: model.model_id,
                  tokensIn: model.total_in,
                  tokensOut: model.total_out,
                  tokensCacheRead: model.total_cache_read,
                  tokensCacheWrite: model.total_cache_write,
                });

                return (
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
                      <span className={est.estimated ? 'text-muted' : ''}>
                        {formatCost(est.cost, est.estimated)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
