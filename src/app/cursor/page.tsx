export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { parseDateRange } from '@/lib/date-range';
import {
  estimateCursorCost,
  getCursorUsagePool,
  hasCursorPricing,
} from '@/lib/cursor/pricing';
import {
  computeCursorValueMetrics,
  formatMultiplier,
} from '@/lib/cursor/value';
import {
  formatCost,
  formatDateTime,
  formatTokens,
  truncateId,
} from '@/lib/format';
import {
  getCursorAgentUsage,
  getCursorDailyModelUsage,
  getCursorDailyUsage,
  getCursorGlobalStats,
  getCursorModelUsage,
  getCursorSettings,
  listCursorImports,
} from '@/lib/queries/cursor';

import { Card, StatCard } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DateRangeControls } from '@/components/date-range-controls';
import { BillingCycleControls } from '@/components/cursor/billing-cycle-controls';
import { CursorTokenChart } from '@/components/cursor/token-chart';
import { CursorCostChart } from '@/components/cursor/cost-chart';
import { CursorSettingsForm } from '@/components/cursor/settings-form';

interface CursorPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function CursorDashboardPage({ searchParams }: CursorPageProps) {
  const params = await searchParams;
  const range = parseDateRange({ from: params.from, to: params.to });

  const [
    settingsResult,
    statsResult,
    dailyResult,
    modelsResult,
    agentsResult,
    dailyModelResult,
    importsResult,
  ] = await Promise.all([
    getCursorSettings(),
    getCursorGlobalStats(range.startMs, range.endMs),
    getCursorDailyUsage(range.startMs, range.endMs),
    getCursorModelUsage(range.startMs, range.endMs),
    getCursorAgentUsage(range.startMs, range.endMs),
    getCursorDailyModelUsage(range.startMs, range.endMs),
    listCursorImports(5),
  ]);

  if (settingsResult.error || statsResult.error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center px-4">
          <div className="text-error text-sm mb-2">Failed to load Cursor dashboard</div>
          <div className="text-muted text-xs">
            {settingsResult.error ?? statsResult.error}
          </div>
        </div>
      </div>
    );
  }

  const settings = settingsResult.data!;
  const stats = statsResult.data;
  const daily = dailyResult.data ?? [];
  const models = modelsResult.data ?? [];
  const agents = agentsResult.data ?? [];
  const dailyModels = dailyModelResult.data ?? [];
  const imports = importsResult.data ?? [];

  if (!stats || stats.event_count === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold">Cursor Dashboard</h1>
          <Link
            href="/cursor/upload"
            className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt"
          >
            Upload CSV
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          <BillingCycleControls
            billingCycleStartDay={settings.billing_cycle_start_day}
            from={range.from}
            to={range.to}
          />
          <DateRangeControls from={range.from} to={range.to} />
        </div>
        <Card className="space-y-3">
          <div className="text-sm text-foreground">No Cursor usage imported yet</div>
          <p className="text-xs text-muted max-w-xl">
            Export usage from Cursor (CSV), then upload it here. Events are merged and
            deduplicated across uploads.
          </p>
        </Card>
        <Card>
          <div className="mb-3 text-xs text-muted uppercase tracking-wider">
            Plan settings
          </div>
          <CursorSettingsForm settings={settings} />
        </Card>
      </div>
    );
  }

  const modelCosts = models.map((model) => {
    const est = estimateCursorCost({
      reportedCost: null,
      modelId: model.model,
      tokensInput: model.tokens_input,
      tokensInputCacheWrite: model.tokens_input_cache_write,
      tokensCacheRead: model.tokens_cache_read,
      tokensOutput: model.tokens_output,
    });
    return {
      ...model,
      estimatedCost: est.cost,
      knownPricing: est.knownPricing,
      pool: getCursorUsagePool(model.model),
    };
  });

  const totalEstimatedCost = modelCosts.reduce((sum, row) => sum + row.estimatedCost, 0);
  const cursorPoolUsd = modelCosts
    .filter((row) => row.pool === 'cursor')
    .reduce((sum, row) => sum + row.estimatedCost, 0);
  const otherPoolUsd = modelCosts
    .filter((row) => row.pool === 'other')
    .reduce((sum, row) => sum + row.estimatedCost, 0);
  const unknownPricingCount = modelCosts.filter((row) => !row.knownPricing).length;
  const cursorEventCount = modelCosts
    .filter((row) => row.pool === 'cursor')
    .reduce((sum, row) => sum + row.event_count, 0);
  const otherEventCount = modelCosts
    .filter((row) => row.pool === 'other')
    .reduce((sum, row) => sum + row.event_count, 0);

  const dailyCostMap = new Map<string, number>();
  for (const row of dailyModels) {
    const est = estimateCursorCost({
      reportedCost: row.reported_cost > 0 ? row.reported_cost : null,
      modelId: row.model,
      tokensInput: row.tokens_input,
      tokensInputCacheWrite: row.tokens_input_cache_write,
      tokensCacheRead: row.tokens_cache_read,
      tokensOutput: row.tokens_output,
    });
    dailyCostMap.set(row.day, (dailyCostMap.get(row.day) ?? 0) + est.cost);
  }
  const dailyCosts = daily.map((d) => ({
    day: d.day,
    estimated_cost: dailyCostMap.get(d.day) ?? 0,
  }));

  // Agents mix models; allocate est. cost by token share of the selected range.
  const totalTokensForAgents = Math.max(1, stats.tokens_total);
  const agentCostsScaled = agents.map((agent) => ({
    ...agent,
    estimatedCost: (agent.tokens_total / totalTokensForAgents) * totalEstimatedCost,
  }));

  const value = computeCursorValueMetrics({
    cursorPoolUsd,
    otherPoolUsd,
    totalTokens: stats.tokens_total,
    planAmountUsd: settings.plan_amount_usd,
    includedPoolUsd: settings.included_pool_usd,
    billingCycleStartDay: settings.billing_cycle_start_day,
  });

  const cloudShare = stats.event_count > 0
    ? (stats.cloud_agent_count / stats.event_count) * 100
    : 0;

  const otherIncludedPct = settings.included_pool_usd > 0
    ? Math.min(100, (value.otherPoolUsd / settings.included_pool_usd) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-bold">Cursor Dashboard</h1>
          <div className="text-xs text-muted">
            Plan ${settings.plan_amount_usd}/mo · Other Models ≥$
            {settings.included_pool_usd} · cycle day {settings.billing_cycle_start_day}
          </div>
        </div>
        <Link
          href="/cursor/upload"
          className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt"
        >
          Upload CSV
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <BillingCycleControls
          billingCycleStartDay={settings.billing_cycle_start_day}
          from={range.from}
          to={range.to}
        />
        <DateRangeControls from={range.from} to={range.to} />
      </div>

      {/* Value strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Cursor Models"
          value={formatCost(value.cursorPoolUsd, true)}
          subValue={`${cursorEventCount.toLocaleString()} events · Grok / Composer`}
          accent
        />
        <StatCard
          label="Other Models"
          value={formatCost(value.otherPoolUsd, true)}
          subValue={`${otherEventCount.toLocaleString()} events · third-party`}
          accent
        />
        <StatCard
          label="Other vs included"
          value={formatMultiplier(value.otherVsIncluded)}
          subValue={
            value.exceededIncluded
              ? `${formatCost(value.otherPoolUsd, true)} / ≥$${settings.included_pool_usd} · over`
              : `${formatCost(value.otherPoolUsd, true)} / ≥$${settings.included_pool_usd}`
          }
        />
        <StatCard
          label="Value vs plan"
          value={formatMultiplier(value.valueVsPlan)}
          subValue={`${formatCost(value.estimatedCost, true)} total / $${settings.plan_amount_usd}`}
        />
        <StatCard
          label="$ / 1M tokens (plan)"
          value={formatCost(value.dollarsPerMillionTokens)}
          subValue={`est ${formatCost(value.estimatedCostPerMillionTokens, true)} / 1M`}
        />
        <StatCard
          label="Cycle burn"
          value={formatMultiplier(value.burnRatio)}
          subValue={`pro-rata ${formatCost(value.expectedProRataCost)} · ${(value.cycleElapsedRatio * 100).toFixed(0)}% elapsed`}
        />
      </div>

      {/* Dual pool meters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-xs text-muted uppercase tracking-wider">
              Cursor Models pool
            </div>
            <div className="text-xs tabular-nums text-foreground">
              {formatCost(value.cursorPoolUsd, true)}
              {unknownPricingCount > 0 ? ' · some rates missing' : ''}
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-surface-alt">
            <div
              className="h-full bg-foreground/70 transition-all"
              style={{
                width: `${
                  value.estimatedCost > 0
                    ? Math.max(2, (value.cursorPoolUsd / value.estimatedCost) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="mt-2 text-xs text-muted">
            Generous included usage · share of total est.{' '}
            {value.estimatedCost > 0
              ? `${((value.cursorPoolUsd / value.estimatedCost) * 100).toFixed(0)}%`
              : '0%'}
          </div>
        </Card>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-xs text-muted uppercase tracking-wider">
              Other Models vs included floor
            </div>
            <div className="text-xs tabular-nums text-foreground">
              {formatCost(value.otherPoolUsd, true)} · ≥${settings.included_pool_usd}
              {value.exceededIncluded ? ' · exceeded' : ''}
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-surface-alt">
            <div
              className={
                value.exceededIncluded
                  ? 'h-full bg-warning transition-all'
                  : 'h-full bg-foreground/70 transition-all'
              }
              style={{
                width: `${Math.min(
                  100,
                  Math.max(otherIncludedPct, value.otherPoolUsd > 0 ? 2 : 0),
                )}%`,
              }}
            />
          </div>
          <div className="mt-2 text-xs text-muted">
            Events: {stats.event_count.toLocaleString()} · {stats.charged_count} included ·{' '}
            {stats.errored_count} errored/free
          </div>
        </Card>
      </div>

      {/* Token strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total tokens"
          value={formatTokens(stats.tokens_total)}
          subValue={`${formatTokens(stats.tokens_input)} in · ${formatTokens(stats.tokens_output)} out`}
          accent
        />
        <StatCard
          label="Cache read"
          value={formatTokens(stats.tokens_cache_read)}
          subValue={`write ${formatTokens(stats.tokens_input_cache_write)}`}
        />
        <StatCard
          label="Cloud vs IDE"
          value={`${cloudShare.toFixed(0)}% cloud`}
          subValue={`${stats.cloud_agent_count} cloud · ${stats.ide_count} IDE`}
        />
        <StatCard
          label="Models"
          value={stats.model_count.toLocaleString()}
          subValue={
            stats.min_event_at && stats.max_event_at
              ? `${formatDateTime(stats.min_event_at)} → ${formatDateTime(stats.max_event_at)}`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-xs text-muted uppercase tracking-wider">
            Daily tokens
          </div>
          <CursorTokenChart data={daily} />
        </Card>
        <Card>
          <div className="mb-3 text-xs text-muted uppercase tracking-wider">
            Daily est. cost
          </div>
          <CursorCostChart data={dailyCosts} />
        </Card>
      </div>

      {/* Model table */}
      <div>
        <div className="mb-2 text-xs text-muted uppercase tracking-wider">
          Model usage
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell header>Model</TableCell>
              <TableCell header>Pool</TableCell>
              <TableCell header align="right">Events</TableCell>
              <TableCell header align="right">Tokens</TableCell>
              <TableCell header align="right">In / Out</TableCell>
              <TableCell header align="right">Est. cost</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modelCosts.map((model) => (
              <TableRow key={model.model}>
                <TableCell className="font-medium text-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all">{model.model}</span>
                    {!hasCursorPricing(model.model) && (
                      <Badge variant="warning">no rate</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={model.pool === 'cursor' ? 'info' : 'default'}>
                    {model.pool === 'cursor' ? 'Cursor' : 'Other'}
                  </Badge>
                </TableCell>
                <TableCell align="right">{model.event_count.toLocaleString()}</TableCell>
                <TableCell align="right">{formatTokens(model.tokens_total)}</TableCell>
                <TableCell align="right">
                  {formatTokens(model.tokens_input + model.tokens_input_cache_write)} /{' '}
                  {formatTokens(model.tokens_output)}
                </TableCell>
                <TableCell align="right">
                  {formatCost(model.estimatedCost, true)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Top agents */}
      {agentCostsScaled.length > 0 && (
        <div>
          <div className="mb-2 text-xs text-muted uppercase tracking-wider">
            Top cloud agents
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Agent</TableCell>
                <TableCell header align="right">Events</TableCell>
                <TableCell header align="right">Tokens</TableCell>
                <TableCell header align="right">Est. cost</TableCell>
                <TableCell header align="right">Last seen</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentCostsScaled.map((agent) => (
                <TableRow key={agent.cloud_agent_id}>
                  <TableCell className="font-mono text-xs text-foreground">
                    <span className="sm:hidden">{truncateId(agent.cloud_agent_id, 12)}</span>
                    <span className="hidden sm:inline break-all">{agent.cloud_agent_id}</span>
                  </TableCell>
                  <TableCell align="right">{agent.event_count.toLocaleString()}</TableCell>
                  <TableCell align="right">{formatTokens(agent.tokens_total)}</TableCell>
                  <TableCell align="right">
                    {formatCost(agent.estimatedCost, true)}
                  </TableCell>
                  <TableCell align="right" className="text-muted text-xs">
                    {formatDateTime(agent.last_event_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-xs text-muted uppercase tracking-wider">
            Plan settings
          </div>
          <CursorSettingsForm settings={settings} />
        </Card>
        <Card>
          <div className="mb-3 text-xs text-muted uppercase tracking-wider">
            Recent imports
          </div>
          {imports.length === 0 ? (
            <div className="text-xs text-muted">No imports yet</div>
          ) : (
            <ul className="space-y-2">
              {imports.map((item) => (
                <li key={item.id} className="text-xs">
                  <div className="text-foreground break-all">{item.filename}</div>
                  <div className="text-muted">
                    {formatDateTime(item.imported_at)} · +{item.inserted_count} / skip{' '}
                    {item.skipped_count}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
