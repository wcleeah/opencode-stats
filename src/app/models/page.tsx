export const dynamic = 'force-dynamic';

import {
  getModelUsage,
  getCacheEfficiency,
  getDailyErrorRate,
} from '@/lib/queries/analytics';
import { estimateCost } from '@/lib/pricing';
import { formatTokens, formatCost, formatPercent } from '@/lib/format';
import { Card, StatCard } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { CacheChart } from '@/components/cache-chart';
import { ErrorRateChart } from '@/components/error-rate-chart';

export default async function ModelsPage() {
  const models = await getModelUsage();
  const cache = await getCacheEfficiency();
  const errors = await getDailyErrorRate();

  if (models.error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="text-error text-sm mb-2">Failed to load model data</div>
          <div className="text-muted text-xs">{models.error}</div>
        </div>
      </div>
    );
  }

  const data = models.data ?? [];

  const totalResponses = data.reduce((sum, m) => sum + m.response_count, 0);
  const totalIn = data.reduce((sum, m) => sum + m.total_in, 0);
  const totalOut = data.reduce((sum, m) => sum + m.total_out, 0);
  const totalReasoning = data.reduce((sum, m) => sum + m.total_reasoning, 0);
  const overallCacheHit =
    totalIn > 0
      ? data.reduce((sum, m) => sum + (m.cache_hit_pct / 100) * m.total_in, 0) /
        totalIn *
        100
      : 0;

  // Compute estimated costs per model
  const modelEstimates = data.map((m) => ({
    ...m,
    est: estimateCost({
      reportedCost: m.total_cost,
      modelId: m.model_id,
      tokensIn: m.total_in,
      tokensOut: m.total_out,
      tokensCacheRead: m.total_cache_read,
      tokensCacheWrite: m.total_cache_write,
    }),
  }));

  const totalEstCost = modelEstimates.reduce((sum, m) => sum + m.est.cost, 0);
  const anyEstimated = modelEstimates.some((m) => m.est.estimated);

  return (
    <div className="space-y-6">
      <Breadcrumbs crumbs={[{ label: 'models' }]} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Models" value={data.length.toLocaleString()} />
        <StatCard
          label="Total Responses"
          value={totalResponses.toLocaleString()}
        />
        <StatCard
          label="Total Tokens"
          value={formatTokens(totalIn + totalOut)}
          subValue={`${formatTokens(totalIn)} in / ${formatTokens(totalOut)} out`}
          accent
        />
        <StatCard
          label="Cache Hit Rate"
          value={formatPercent(overallCacheHit)}
        />
        <StatCard
          label="Est. Cost"
          value={formatCost(totalEstCost, anyEstimated)}
          subValue={anyEstimated ? 'includes estimates' : undefined}
        />
        {totalReasoning > 0 && (
          <StatCard
            label="Reasoning Tokens"
            value={formatTokens(totalReasoning)}
            subValue={`${formatPercent((totalReasoning / (totalIn + totalOut + totalReasoning)) * 100)} of all tokens`}
          />
        )}
      </div>

      {/* Model comparison table */}
      {data.length > 0 && (
        <div>
          <div className="mb-2 text-xs text-muted uppercase tracking-wider">
            Model Comparison
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Model</TableCell>
                <TableCell header>Provider</TableCell>
                <TableCell header align="right">Responses</TableCell>
                <TableCell header align="right">Tokens In</TableCell>
                <TableCell header align="right">Tokens Out</TableCell>
                <TableCell header align="right">Reasoning</TableCell>
                <TableCell header align="right">Avg In</TableCell>
                <TableCell header align="right">Avg Out</TableCell>
                <TableCell header align="right">Cache Hit</TableCell>
                <TableCell header align="right">Est. Cost</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelEstimates.map((model) => {
                const pct =
                  totalResponses > 0
                    ? (model.response_count / totalResponses) * 100
                    : 0;

                return (
                  <TableRow key={`${model.model_id}-${model.provider_id}`}>
                    <TableCell className="text-foreground font-medium">
                      {model.model_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{model.provider_id}</Badge>
                    </TableCell>
                    <TableCell align="right">
                      <span className="tabular-nums">
                        {model.response_count.toLocaleString()}
                      </span>
                      <span className="text-muted ml-1 text-[10px]">
                        ({pct.toFixed(1)}%)
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      {formatTokens(model.total_in)}
                    </TableCell>
                    <TableCell align="right">
                      {formatTokens(model.total_out)}
                    </TableCell>
                    <TableCell align="right">
                      {model.total_reasoning > 0
                        ? formatTokens(model.total_reasoning)
                        : <span className="text-muted">--</span>}
                    </TableCell>
                    <TableCell align="right">
                      {formatTokens(model.avg_in)}
                    </TableCell>
                    <TableCell align="right">
                      {formatTokens(model.avg_out)}
                    </TableCell>
                    <TableCell align="right">
                      <span
                        className={
                          model.cache_hit_pct >= 50
                            ? 'text-success'
                            : model.cache_hit_pct >= 20
                              ? 'text-warning'
                              : 'text-muted'
                        }
                      >
                        {formatPercent(model.cache_hit_pct)}
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <span className={model.est.estimated ? 'text-muted' : ''}>
                        {formatCost(model.est.cost, model.est.estimated)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cache efficiency over time */}
        <Card>
          <div className="mb-3 text-xs text-muted uppercase tracking-wider">
            Cache Hit Rate Over Time
          </div>
          <CacheChart data={cache.data ?? []} />
        </Card>

        {/* Error rate over time */}
        <Card>
          <div className="mb-3 text-xs text-muted uppercase tracking-wider">
            Error Rate Over Time
          </div>
          <ErrorRateChart data={errors.data ?? []} />
        </Card>
      </div>

      {data.length === 0 && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-muted text-sm">No model usage data available</div>
        </div>
      )}
    </div>
  );
}
