import type { JSX } from 'react';

import { formatCost, formatTokens } from '@/lib/format';
import { grokBotOutsUsd, grokBotTokenTotal } from '@/lib/grok-bot/rates';
import {
  grokBotPeriodCaption,
  type GrokBotPeriod,
  type GrokBotPeriodList,
  type GrokBotWindowTotals,
} from '@/lib/grok-bot/window';

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
  return String(period.startMs);
}

function PeriodLabel(props: {
  readonly period: GrokBotPeriod;
  readonly periods: GrokBotPeriodList;
  readonly focusStartMs?: number;
}): JSX.Element {
  const focused = props.focusStartMs === props.period.startMs;
  return (
    <div
      className={
        focused
          ? 'text-xs font-medium normal-case tracking-normal text-foreground'
          : 'text-xs font-normal normal-case tracking-normal text-muted'
      }
    >
      {grokBotPeriodCaption(props.period, props.periods)}
    </div>
  );
}

function SpendRows(props: {
  readonly periods: GrokBotPeriodList;
  readonly focusStartMs?: number;
}): JSX.Element {
  return (
    <div className="space-y-3 font-normal">
      {props.periods.map((period) => {
        const spend = spendLine(period.totals);
        return (
          <div key={periodKey(period)}>
            <PeriodLabel
              period={period}
              periods={props.periods}
              focusStartMs={props.focusStartMs}
            />
            <div className="font-bold">{spend.total}</div>
            <div className="text-xs font-normal text-muted">{spend.detail}</div>
          </div>
        );
      })}
    </div>
  );
}

function TokenRows(props: {
  readonly periods: GrokBotPeriodList;
  readonly focusStartMs?: number;
}): JSX.Element {
  return (
    <div className="space-y-3 font-normal">
      {props.periods.map((period) => (
        <div key={periodKey(period)}>
          <PeriodLabel
            period={period}
            periods={props.periods}
            focusStartMs={props.focusStartMs}
          />
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
  readonly focusStartMs?: number;
}): JSX.Element {
  const { periods, focusStartMs } = props;
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
      <StatCard
        label="Total Spending (estimated)"
        value={<SpendRows periods={periods} focusStartMs={focusStartMs} />}
      />
      <StatCard
        label="Total tokens"
        value={<TokenRows periods={periods} focusStartMs={focusStartMs} />}
      />
    </div>
  );
}
