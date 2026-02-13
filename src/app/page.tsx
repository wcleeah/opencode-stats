export const dynamic = 'force-dynamic';

import { getGlobalStats } from '@/lib/queries/stats';
import { getDailyTokenUsage, getModelUsage } from '@/lib/queries/analytics';
import { estimateCost, aggregateCostBreakdown } from '@/lib/pricing';
import { formatTokens, formatCost, formatCostBreakdown, formatPercent, formatDuration } from '@/lib/format';
import { parseDateRange } from '@/lib/date-range';

import { Card, StatCard } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
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
import { DateRangeControls } from '@/components/date-range-controls';

interface HomePageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const range = parseDateRange({ from: params.from, to: params.to });
  const stats = await getGlobalStats(range.startMs, range.endMs);
  const dailyTokens = await getDailyTokenUsage(range.startMs, range.endMs);
  const models = await getModelUsage(range.startMs, range.endMs);

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

  const totalUncachedIn = Math.max(0, s.total_tokens_in - s.total_tokens_cache_read);
  const totalTokens = s.total_tokens_in + s.total_tokens_out;

  // Compute estimated total cost from per-model data
  const modelData = models.data ?? [];
  const totalCost = aggregateCostBreakdown(
    modelData.map((m) => ({
      reportedCost: m.total_cost,
      modelId: m.model_id,
      tokensIn: Math.max(0, m.total_in - m.total_cache_read),
      tokensOut: m.total_out,
      tokensCacheRead: m.total_cache_read,
      tokensCacheWrite: m.total_cache_write,
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs crumbs={[{ label: 'dashboard' }]} />
        <DateRangeControls from={range.from} to={range.to} />
      </div>

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
          subValue={
            <Tooltip
              content={
                <span className="text-muted">
                  Uncached {formatTokens(totalUncachedIn)}
                  {' '}· Cached {formatTokens(s.total_tokens_cache_read)}
                </span>
              }
            >
              <span>
                {formatTokens(s.total_tokens_in)} in / {formatTokens(s.total_tokens_out)} out
              </span>
            </Tooltip>
          }
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
          label="Total Cost"
          value={formatCost(totalCost.total, totalCost.hasEstimated)}
          subValue={formatCostBreakdown(totalCost.reported, totalCost.estimated)}
        />
        <StatCard
          label="Active Time"
          value={formatDuration(s.total_active_time_ms)}
          subValue={s.total_turns > 0
            ? `~${formatDuration(Math.round(s.total_active_time_ms / s.total_turns))} avg/turn`
            : undefined}
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
                <TableCell header align="right">Reported Cost</TableCell>
                <TableCell header align="right">Total Cost</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelData.map((model) => {
                const est = estimateCost({
                  reportedCost: model.total_cost,
                  modelId: model.model_id,
                  tokensIn: Math.max(0, model.total_in - model.total_cache_read),
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
                      <Tooltip
                        content={
                          <span className="text-muted">
                            Uncached {formatTokens(Math.max(0, model.total_in - model.total_cache_read))}
                            {' '}· Cached {formatTokens(model.total_cache_read)}
                          </span>
                        }
                      >
                        <span className="tabular-nums">
                          {formatTokens(model.total_in)}
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      {formatTokens(model.total_out)}
                    </TableCell>
                    <TableCell align="right">
                      {formatPercent(model.cache_hit_pct)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCost(model.total_cost)}
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
