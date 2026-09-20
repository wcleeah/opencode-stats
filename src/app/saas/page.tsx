export const dynamic = 'force-dynamic';

import { formatBurnRatio } from '@/lib/mcp/metrics';
import { formatCost, formatDuration, formatPercent } from '@/lib/format';
import { getMcpDashboard } from '@/lib/queries/mcp';

import { Card, StatCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PoolMeter } from '@/components/mcp/pool-meter';
import { McpRefreshButton } from '@/components/mcp/refresh-button';
import { McpSettingsForm } from '@/components/mcp/settings-form';
import { McpHistoryChart } from '@/components/mcp/history-chart';
import { McpLinks } from '@/components/mcp/links';

function formatCredits(value: number): string {
  return value.toLocaleString();
}

export default async function McpDashboardPage() {
  const result = await getMcpDashboard();
  if (result.error || !result.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="px-4 text-center">
          <div className="mb-2 text-sm text-error">Failed to load SaaS dashboard</div>
          <div className="text-xs text-muted">{result.error}</div>
        </div>
      </div>
    );
  }

  const d = result.data;
  const snapshot = d.snapshot;
  const tavilyPct = d.tavily?.usedPct ?? 0;

  const tavilyEndpoints = snapshot
    ? [
        { name: 'Search', credits: snapshot.tavily_search_usage },
        { name: 'Extract', credits: snapshot.tavily_extract_usage },
        { name: 'Crawl', credits: snapshot.tavily_crawl_usage },
        { name: 'Map', credits: snapshot.tavily_map_usage },
        { name: 'Research', credits: snapshot.tavily_research_usage },
      ].filter((row) => row.credits !== null)
    : [];

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold">SaaS Stats</h1>

      <Card>
        <McpLinks links={d.links} />
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Tavily
            </h2>
            <div className="text-xs text-muted">
              {d.monthLabel} UTC · {d.daysUntilReset}d until reset ·{' '}
              {(d.elapsedRatio * 100).toFixed(0)}% of month elapsed
            </div>
          </div>
          <McpRefreshButton
            lastFetchedAt={d.lastFetchedAt}
            nextRefreshAt={d.nextRefreshAt}
          />
        </div>

        {!d.tavilyConfigured && (
          <Card className="space-y-2">
            <div className="text-sm text-foreground">Configure Tavily</div>
            <p className="max-w-2xl text-xs text-muted">
              Set Railway (or local) environment variables, then refresh.
              Keys stay in process env — they are never written to Turso.
            </p>
            <p className="text-xs text-muted">
              <code className="text-foreground">TAVILY_API_KEY</code> — remaining credits
            </p>
          </Card>
        )}

        {d.tavilyConfigured && snapshot?.tavily_error && (
          <Card className="space-y-2">
            <div className="text-sm text-foreground">Tavily fetch error</div>
            <p className="max-w-3xl text-xs text-error">{snapshot.tavily_error}</p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard
            label="Remaining"
            value={
              d.tavily?.unlimited
                ? 'Unlimited'
                : d.tavily?.remaining !== null && d.tavily?.remaining !== undefined
                  ? formatCredits(d.tavily.remaining)
                  : '—'
            }
            subValue={
              d.tavily
                ? `${formatCredits(d.tavily.used)} / ${
                    d.tavily.limit === null ? '∞' : formatCredits(d.tavily.limit)
                  } · ${d.tavily.plan ?? 'unknown plan'}`
                : snapshot?.tavily_error ?? 'Not fetched'
            }
            accent
          />
          <StatCard
            label="Burn"
            value={formatBurnRatio(d.tavily?.burnRatio ?? null)}
            subValue={
              d.tavily?.paygoActive
                ? `PAYGO ${formatCredits(d.tavily.paygoUsage)} · ${formatCost(d.tavily.estimatedPaygoUsd, true)}`
                : 'vs month elapsed'
            }
          />
          <StatCard
            label="Reset"
            value={`${d.daysUntilReset}d`}
            subValue="1st of next UTC month"
          />
        </div>

        <PoolMeter
          label="Plan credits"
          usedLabel={
            d.tavily
              ? d.tavily.unlimited
                ? `${formatCredits(d.tavily.used)} · unlimited`
                : `${formatCredits(d.tavily.used)} / ${formatCredits(d.tavily.limit ?? 0)}`
              : 'No data'
          }
          percent={tavilyPct}
          warn={Boolean(d.tavily?.warn)}
          detail={
            d.tavily?.exhausted
              ? 'Free credits used up — enable PAYGO or wait for reset.'
              : d.tavily?.warn
                ? `At or above the ${d.settings.tavily_warn_pct}% warning.`
                : snapshot?.tavily_error && !d.tavily
                  ? snapshot.tavily_error
                  : `${(d.elapsedRatio * 100).toFixed(0)}% of month elapsed`
          }
        />

        <div className="flex flex-wrap gap-2">
          {d.tavily?.exhausted && <Badge variant="error">Exhausted</Badge>}
          {d.tavily?.paygoActive && <Badge variant="warning">PAYGO</Badge>}
          {d.tavily?.warn && !d.tavily.exhausted && (
            <Badge variant="warning">Low</Badge>
          )}
          {d.tavily && !d.tavily.warn && (
            <Badge variant="success">OK</Badge>
          )}
        </div>

        <Card>
          <div className="mb-3 text-xs uppercase tracking-wider text-muted">
            Credits (snapshot)
          </div>
          <McpHistoryChart data={d.history} />
        </Card>

        {tavilyEndpoints.length > 0 && snapshot?.tavily_ok === 1 && (
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-muted">
              By endpoint
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Endpoint</TableCell>
                  <TableCell header align="right">Credits</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tavilyEndpoints.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                    <TableCell align="right">
                      {formatCredits(row.credits ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 text-xs uppercase tracking-wider text-muted">
              Warning settings
            </div>
            <McpSettingsForm settings={d.settings} />
          </Card>
          <Card className="space-y-2">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted">
              Status
            </div>
            <div className="text-xs text-foreground">
              {d.tavilyConfigured ? (
                snapshot?.tavily_ok ? (
                  <span className="text-success">live</span>
                ) : (
                  <span className="text-error">{snapshot?.tavily_error ?? 'error'}</span>
                )
              ) : (
                <span className="text-muted">key missing</span>
              )}
            </div>
            <p className="pt-2 text-[10px] text-muted">
              Tavily /usage is limited to 10 requests / 10 minutes, so this section
              caches snapshots for 6 minutes. History only grows when the dashboard
              is opened.
            </p>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              OpenCode tool calls
            </h2>
            <div className="text-xs text-muted">
              {d.localToolSource === 'daily'
                ? 'This month in OpenCode'
                : d.localToolSource === 'all_time'
                  ? 'All-time OpenCode rollup (no daily rows)'
                  : 'No matching tool rows'}
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums font-mono">
            {d.localTools.reduce((sum, row) => sum + row.call_count, 0).toLocaleString()}
          </div>
        </div>

        {d.localTools.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Tool</TableCell>
                <TableCell header>Provider</TableCell>
                <TableCell header align="right">Calls</TableCell>
                <TableCell header align="right">Errors</TableCell>
                <TableCell header align="right">Avg</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.localTools.map((row) => (
                <TableRow key={row.tool}>
                  <TableCell className="font-medium text-foreground">{row.tool}</TableCell>
                  <TableCell>
                    <Badge variant={row.provider === 'exa' ? 'info' : 'default'}>
                      {row.provider}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">{row.call_count.toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {row.error_count.toLocaleString()} ({formatPercent(row.error_rate)})
                  </TableCell>
                  <TableCell align="right">{formatDuration(row.avg_duration_ms)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-muted">
            No local <code className="text-foreground">exa_*</code> or{' '}
            <code className="text-foreground">tavily_*</code> tool rows in this window.
          </p>
        )}
      </section>
    </div>
  );
}
