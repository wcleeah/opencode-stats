import type { JSX } from 'react';

import { formatCost, formatTokens } from '@/lib/format';
import { grokBotOutsUsd, grokBotTokenTotal } from '@/lib/grok-bot/rates';
import type { GrokBotWindowTotals } from '@/lib/grok-bot/window';

import { StatCard } from '@/components/ui/card';

export function GrokBotWindowStats({
  totals,
}: {
  readonly totals: GrokBotWindowTotals;
}): JSX.Element {
  const estimated = totals.spend.includesCardEstimate;
  const outsUsd = grokBotOutsUsd(totals.spend.totalUsd, totals.spend.insUsd);
  const spendParts = [
    `ins ${formatCost(totals.spend.insUsd, estimated)}`,
    `outs ${formatCost(outsUsd, estimated)}`,
  ];
  if (totals.spend.unpricedCacheWriteTokens > 0) {
    spendParts.push('cache write unpriced');
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StatCard
        label="Total Spending (estimated)"
        value={formatCost(totals.spend.totalUsd, estimated)}
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
