import type { JSX } from 'react';

import { formatCost, formatTokens } from '@/lib/format';
import { grokBotOutsUsd, grokBotTokenTotal } from '@/lib/grok-bot/rates';
import type { GrokBotPeriod, GrokBotPeriodList, GrokBotWindowTotals } from '@/lib/grok-bot/window';

import { StatCard } from '@/components/ui/card';

function formatBalancedUsd(
  totalUsd: number,
  insUsd: number,
  estimated: boolean,
): { readonly total: string; readonly ins: string; readonly outs: string } {
  const outsUsd = grokBotOutsUsd(totalUsd, insUsd);
  const sameCents = [totalUsd, insUsd, outsUsd].every((value) => (
    value === 0 || Math.abs(value) >= 0.01
  ));
  if (!sameCents) {
    return {
      total: formatCost(totalUsd, estimated),
      ins: formatCost(insUsd, estimated),
      outs: formatCost(outsUsd, estimated),
    };
  }
  const totalCents = Math.round(totalUsd * 100);
  let insCents = Math.round(insUsd * 100);
  let outsCents = totalCents - insCents;
  if (outsCents < 0) {
    outsCents = 0;
    insCents = totalCents;
  }
  return {
    total: formatCost(totalCents / 100, estimated),
    ins: formatCost(insCents / 100, estimated),
    outs: formatCost(outsCents / 100, estimated),
  };
}

function spendLine(totals: GrokBotWindowTotals): { readonly total: string; readonly detail: string } {
  const spend = formatBalancedUsd(
    totals.spend.totalUsd,
    totals.spend.insUsd,
    totals.spend.includesCardEstimate,
  );
  const parts = [`ins ${spend.ins}`, `outs ${spend.outs}`];
  if (totals.spend.unpricedCacheWriteTokens > 0) parts.push('cache write unpriced');
  return { total: spend.total, detail: parts.join(' · ') };
}

function periodKey(period: GrokBotPeriod): string {
  return period.role === 'compare' ? String(period.delta) : 'primary';
}

function SpendRows({ periods }: { readonly periods: GrokBotPeriodList }): JSX.Element {
  return (
    <div className="space-y-3 font-normal">
      {periods.map((period) => {
        const spend = spendLine(period.totals);
        return (
          <div key={periodKey(period)}>
            <div className="text-xs font-normal normal-case tracking-normal text-muted">
              {period.shortLabel}
            </div>
            <div className="font-bold">{spend.total}</div>
            <div className="text-xs font-normal text-muted">{spend.detail}</div>
          </div>
        );
      })}
    </div>
  );
}

function TokenRows({ periods }: { readonly periods: GrokBotPeriodList }): JSX.Element {
  return (
    <div className="space-y-3 font-normal">
      {periods.map((period) => (
        <div key={periodKey(period)}>
          <div className="text-xs font-normal normal-case tracking-normal text-muted">
            {period.shortLabel}
          </div>
          <div className="font-bold">{formatTokens(grokBotTokenTotal(period.totals.tokens))}</div>
          <div className="text-xs font-normal text-muted">
            {`ins ${formatTokens(period.totals.tokens.ins)} · outs ${formatTokens(period.totals.tokens.outs)}`}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GrokBotWindowStats(props: {
  readonly periods: GrokBotPeriodList;
}): JSX.Element {
  const { periods } = props;
  if (periods.length === 1) {
    const spend = spendLine(periods[0].totals);
    const totals = periods[0].totals;
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Total Spending (estimated)"
          value={spend.total}
          subValue={spend.detail}
        />
        <StatCard
          label="Total tokens"
          value={formatTokens(grokBotTokenTotal(totals.tokens))}
          subValue={`ins ${formatTokens(totals.tokens.ins)} · outs ${formatTokens(totals.tokens.outs)}`}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StatCard label="Total Spending (estimated)" value={<SpendRows periods={periods} />} />
      <StatCard label="Total tokens" value={<TokenRows periods={periods} />} />
    </div>
  );
}
