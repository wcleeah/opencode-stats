import type { GrokBotChartMode } from '@/lib/grok-bot/href';
import {
  grokBotOutsUsd,
  grokBotTokenTotal,
  type GrokBotCharge,
  type GrokBotPricedRow,
  type GrokBotTokenSides,
} from '@/lib/grok-bot/rates';

export interface GrokBotSpendParts {
  readonly totalUsd: number;
  readonly insUsd: number;
  readonly unpricedCacheWriteTokens: number;
  /** True when any folded dollar came from a card (`rated` or `partial`). */
  readonly includesCardEstimate: boolean;
}

export interface GrokBotWindowTotals {
  readonly tokens: GrokBotTokenSides;
  readonly spend: GrokBotSpendParts;
}

export interface GrokBotTypeLine {
  readonly id: string;
  readonly label: string;
}

export interface GrokBotByTypePoint {
  readonly bucketStartMs: number;
  readonly values: readonly { readonly tokens: number; readonly usd: number }[];
}

export interface GrokBotInsOutsPoint {
  readonly bucketStartMs: number;
  readonly insTokens: number;
  readonly outsTokens: number;
  readonly insUsd: number;
  readonly outsUsd: number;
}

export type GrokBotCharts =
  | {
      readonly mode: 'by-type';
      readonly lines: readonly GrokBotTypeLine[];
      readonly points: readonly GrokBotByTypePoint[];
    }
  | {
      readonly mode: 'ins-outs';
      readonly points: readonly GrokBotInsOutsPoint[];
    };

export interface GrokBotFoldEvent {
  readonly bucketStartMs: number;
  readonly usageType: string;
  readonly priced: GrokBotPricedRow;
}

interface Cell {
  insTokens: number;
  outsTokens: number;
  totalUsd: number;
  insUsd: number;
  unpricedCacheWriteTokens: number;
}

interface FoldResult {
  readonly totals: GrokBotWindowTotals;
  readonly charts: GrokBotCharts;
}

const ZERO_CELL: Cell = {
  insTokens: 0,
  outsTokens: 0,
  totalUsd: 0,
  insUsd: 0,
  unpricedCacheWriteTokens: 0,
};

function emptyTotals(): GrokBotWindowTotals {
  return {
    tokens: { ins: 0, outs: 0 },
    spend: {
      totalUsd: 0,
      insUsd: 0,
      unpricedCacheWriteTokens: 0,
      includesCardEstimate: false,
    },
  };
}

function emptyCharts(
  mode: GrokBotChartMode,
  seriesTypes: readonly GrokBotTypeLine[],
): GrokBotCharts {
  if (mode === 'by-type') {
    return { mode: 'by-type', lines: seriesTypes, points: [] };
  }
  return { mode: 'ins-outs', points: [] };
}

function addCharge(cell: Cell, charge: GrokBotCharge): boolean {
  switch (charge.status) {
    case 'reported':
      cell.totalUsd += charge.split.totalUsd;
      cell.insUsd += charge.split.insUsd;
      return false;
    case 'rated':
      cell.totalUsd += charge.split.totalUsd;
      cell.insUsd += charge.split.insUsd;
      return true;
    case 'partial':
      cell.totalUsd += charge.split.totalUsd;
      cell.insUsd += charge.split.insUsd;
      cell.unpricedCacheWriteTokens += charge.unpricedCacheWriteTokens;
      return true;
    case 'unbilled':
    case 'reported-missing':
    case 'unpriced':
      return false;
  }
}

export function foldGrokBotWindow(input: {
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly bucketMs: number;
  readonly seriesTypes: readonly GrokBotTypeLine[];
  readonly events: readonly GrokBotFoldEvent[];
  readonly mode: GrokBotChartMode;
}): FoldResult {
  if (
    input.seriesTypes.length === 0
    || input.bucketMs <= 0
    || input.windowEndMs < input.windowStartMs
  ) {
    return {
      totals: emptyTotals(),
      charts: emptyCharts(input.mode, input.seriesTypes),
    };
  }

  const typeIds = new Set(input.seriesTypes.map((line) => line.id));
  const cells = new Map<string, Cell>();
  let includesCardEstimate = false;

  function isEmittedBucket(bucketStartMs: number): boolean {
    if (bucketStartMs < input.windowStartMs || bucketStartMs > input.windowEndMs) return false;
    return (bucketStartMs - input.windowStartMs) % input.bucketMs === 0;
  }

  for (const event of input.events) {
    if (!typeIds.has(event.usageType) || !isEmittedBucket(event.bucketStartMs)) continue;
    const key = `${event.bucketStartMs}:${event.usageType}`;
    const existing = cells.get(key);
    const cell = existing ?? {
      insTokens: 0,
      outsTokens: 0,
      totalUsd: 0,
      insUsd: 0,
      unpricedCacheWriteTokens: 0,
    };
    if (!existing) cells.set(key, cell);
    cell.insTokens += event.priced.tokens.ins;
    cell.outsTokens += event.priced.tokens.outs;
    if (addCharge(cell, event.priced.charge)) includesCardEstimate = true;
  }

  const byTypePoints: GrokBotByTypePoint[] = [];
  const insOutsPoints: GrokBotInsOutsPoint[] = [];
  let ins = 0;
  let outs = 0;
  let totalUsd = 0;
  let insUsd = 0;
  let unpricedCacheWriteTokens = 0;

  for (
    let bucket = input.windowStartMs;
    bucket <= input.windowEndMs;
    bucket += input.bucketMs
  ) {
    const values: { tokens: number; usd: number }[] = [];
    let bucketInsTokens = 0;
    let bucketOutsTokens = 0;
    let bucketTotalUsd = 0;
    let bucketInsUsd = 0;
    for (const line of input.seriesTypes) {
      const cell = cells.get(`${bucket}:${line.id}`) ?? ZERO_CELL;
      ins += cell.insTokens;
      outs += cell.outsTokens;
      totalUsd += cell.totalUsd;
      insUsd += cell.insUsd;
      unpricedCacheWriteTokens += cell.unpricedCacheWriteTokens;
      bucketInsTokens += cell.insTokens;
      bucketOutsTokens += cell.outsTokens;
      bucketTotalUsd += cell.totalUsd;
      bucketInsUsd += cell.insUsd;
      if (input.mode === 'by-type') {
        values.push({
          tokens: grokBotTokenTotal({ ins: cell.insTokens, outs: cell.outsTokens }),
          usd: cell.totalUsd,
        });
      }
    }
    if (input.mode === 'by-type') {
      byTypePoints.push({ bucketStartMs: bucket, values });
    } else {
      insOutsPoints.push({
        bucketStartMs: bucket,
        insTokens: bucketInsTokens,
        outsTokens: bucketOutsTokens,
        insUsd: bucketInsUsd,
        outsUsd: grokBotOutsUsd(bucketTotalUsd, bucketInsUsd),
      });
    }
  }

  const totals: GrokBotWindowTotals = {
    tokens: { ins, outs },
    spend: {
      totalUsd,
      insUsd,
      unpricedCacheWriteTokens,
      includesCardEstimate,
    },
  };
  const charts: GrokBotCharts = input.mode === 'by-type'
    ? { mode: 'by-type', lines: input.seriesTypes, points: byTypePoints }
    : { mode: 'ins-outs', points: insOutsPoints };
  return { totals, charts };
}
