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

function formatCredits(value: number): string {
  return value.toLocaleString();
}

export default async function McpDashboardPage() {
  const result = await getMcpDashboard();
  if (result.error || !result.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="px-4 text-center">
          <div className="mb-2 text-sm text-error">Failed to load MCP dashboard</div>
          <div className="text-xs text-muted">{result.error}</div>
        </div>
      </div>
    );
  }

  const d = result.data;
  const snapshot = d.snapshot;
  const tavilyPct = d.tavily?.usedPct ?? 0;
  const exaPct = d.exa?.usedPct ?? 0;

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-bold">MCP Credits</h1>
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

      {(!d.tavilyConfigured || !d.exaConfigured) && (
        <Card className="space-y-2">
          <div className="text-sm text-foreground">Configure provider keys</div>
          <p className="max-w-2xl text-xs text-muted">
            Set Railway (or local) environment variables, then refresh.
            Keys stay in process env — they are never written to Turso.
          </p>
          <ul className="space-y-1 text-xs text-muted">
            {!d.tavilyConfigured && (
              <li>
                <code className="text-foreground">TAVILY_API_KEY</code> — Tavily
                remaining credits
              </li>
            )}
            {!d.exaConfigured && (
              <li>
                <code className="text-foreground">EXA_API_KEY</code> — Exa Team
                Management service key from dashboard.exa.ai → API Keys → Service
                keys (not the search API Keys tab). Optional{' '}
                <code className="text-foreground">EXA_API_KEY_ID</code> if you have
                several keys.
              </li>
            )}
          </ul>
        </Card>
      )}

      {((d.tavilyConfigured && snapshot?.tavily_error) ||
        (d.exaConfigured && snapshot?.exa_error)) && (
        <Card className="space-y-2">
          <div className="text-sm text-foreground">Provider fetch errors</div>
          {d.tavilyConfigured && snapshot?.tavily_error && (
            <p className="max-w-3xl text-xs text-error">{snapshot.tavily_error}</p>
          )}
          {d.exaConfigured && snapshot?.exa_error && (
            <p className="max-w-3xl text-xs text-error">{snapshot.exa_error}</p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Tavily remaining"
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
          label="Exa remaining"
          value={d.exa ? formatCost(Math.max(0, d.exa.remainingUsd), true) : '—'}
          subValue={
            d.exa
              ? `${formatCost(d.exa.usedUsd)} used / ${formatCost(d.exa.poolUsd)} pool`
              : snapshot?.exa_error ?? 'Not fetched'
          }
          accent
        />
        <StatCard
          label="Tavily burn"
          value={formatBurnRatio(d.tavily?.burnRatio ?? null)}
          subValue={
            d.tavily?.paygoActive
              ? `PAYGO ${formatCredits(d.tavily.paygoUsage)} · ${formatCost(d.tavily.estimatedPaygoUsd, true)}`
              : 'vs month elapsed'
          }
        />
        <StatCard
          label="Exa burn"
          value={formatBurnRatio(d.exa?.burnRatio ?? null)}
          subValue="est. vs month elapsed"
        />
        <StatCard
          label="Reset"
          value={`${d.daysUntilReset}d`}
          subValue="1st of next UTC month"
        />
        <StatCard
          label="Local MCP calls"
          value={d.localTools.reduce((sum, row) => sum + row.call_count, 0).toLocaleString()}
          subValue={
            d.localToolSource === 'daily'
              ? 'this month in OpenCode'
              : d.localToolSource === 'all_time'
                ? 'all-time OpenCode rollup'
                : 'no matching tool rows'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <PoolMeter
          label="Tavily plan credits"
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
        <PoolMeter
          label="Exa vs allotment (estimated)"
          usedLabel={
            d.exa
              ? `${formatCost(d.exa.usedUsd)} / ${formatCost(d.exa.poolUsd)}`
              : 'No data'
          }
          percent={exaPct}
          warn={Boolean(d.exa?.warn)}
          detail={
            d.exa?.exhausted
              ? 'Estimated remaining is $0 — top up or wait for the monthly $10.'
              : d.exa
                ? `Exa does not publish remaining balance. Pool = allotment + extra.`
                : snapshot?.exa_error ?? 'Set EXA_API_KEY to fetch spend.'
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {d.tavily?.exhausted && <Badge variant="error">Tavily exhausted</Badge>}
        {d.tavily?.paygoActive && <Badge variant="warning">Tavily PAYGO</Badge>}
        {d.tavily?.warn && !d.tavily.exhausted && (
          <Badge variant="warning">Tavily low</Badge>
        )}
        {d.exa?.exhausted && <Badge variant="error">Exa allotment used</Badge>}
        {d.exa?.warn && !d.exa.exhausted && <Badge variant="warning">Exa low</Badge>}
        {d.tavily && !d.tavily.warn && (
          <Badge variant="success">Tavily OK</Badge>
        )}
        {d.exa && !d.exa.warn && <Badge variant="info">Exa est. OK</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-xs uppercase tracking-wider text-muted">
            Tavily credits (snapshot)
          </div>
          <McpHistoryChart data={d.history} metric="tavily" />
        </Card>
        <Card>
          <div className="mb-3 text-xs uppercase tracking-wider text-muted">
            Exa used USD (snapshot)
          </div>
          <McpHistoryChart data={d.history} metric="exa" />
        </Card>
      </div>

      {tavilyEndpoints.length > 0 && snapshot?.tavily_ok === 1 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-muted">
            Tavily by endpoint
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

      {d.exaBreakdown.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-muted">
            Exa cost breakdown
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell header>Price</TableCell>
                <TableCell header align="right">Quantity</TableCell>
                <TableCell header align="right">USD</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.exaBreakdown.map((row) => (
                <TableRow key={row.priceId ?? row.priceName}>
                  <TableCell className="font-medium text-foreground">
                    {row.priceName}
                  </TableCell>
                  <TableCell align="right">{row.quantity.toLocaleString()}</TableCell>
                  <TableCell align="right">{formatCost(row.amountUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {d.localTools.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-muted">
            OpenCode MCP tool calls
            {d.localToolSource === 'all_time' ? ' · all-time (no daily rollup)' : ''}
          </div>
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
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-xs uppercase tracking-wider text-muted">
            Allotment settings
          </div>
          <McpSettingsForm settings={d.settings} />
        </Card>
        <Card className="space-y-2">
          <div className="mb-3 text-xs uppercase tracking-wider text-muted">
            Provider status
          </div>
          <div className="text-xs text-foreground">
            Tavily:{' '}
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
          <div className="text-xs text-foreground">
            Exa:{' '}
            {d.exaConfigured ? (
              snapshot?.exa_ok ? (
                <span className="text-success">
                  live{snapshot.exa_api_key_name ? ` · ${snapshot.exa_api_key_name}` : ''}
                </span>
              ) : (
                <span className="text-error">{snapshot?.exa_error ?? 'error'}</span>
              )
            ) : (
              <span className="text-muted">key missing</span>
            )}
          </div>
          <p className="pt-2 text-[10px] text-muted">
            Tavily /usage is limited to 10 requests / 10 minutes, so this page caches
            snapshots for 6 minutes. History only grows when the dashboard is opened.
          </p>
        </Card>
      </div>
    </div>
  );
}
