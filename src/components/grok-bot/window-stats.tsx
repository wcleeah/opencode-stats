import type { JSX } from 'react';

import { formatCost, formatTokens } from '@/lib/format';
import { grokBotOutsUsd, grokBotTokenTotal } from '@/lib/grok-bot/rates';
import type { GrokBotWindowTotals } from '@/lib/grok-bot/window';

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

export function GrokBotWindowStats({
  totals,
}: {
  readonly totals: GrokBotWindowTotals;
}): JSX.Element {
  const estimated = totals.spend.includesCardEstimate;
  const spend = formatBalancedUsd(
    totals.spend.totalUsd,
    totals.spend.insUsd,
    estimated,
  );
  const spendParts = [
    `ins ${spend.ins}`,
    `outs ${spend.outs}`,
  ];
  if (totals.spend.unpricedCacheWriteTokens > 0) {
    spendParts.push('cache write unpriced');
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StatCard
        label="Total Spending (estimated)"
        value={spend.total}
        subValue={spendParts.join(' · ')}
      />
      <StatCard
        label="Total tokens"
        value={formatTokens(grokBotTokenTotal(totals.tokens))}
        subValue={`ins ${formatTokens(totals.tokens.ins)} · outs ${formatTokens(totals.tokens.outs)}`}
      />
    </div>
  );
}
