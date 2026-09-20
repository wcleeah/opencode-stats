import { TAVILY_PAYGO_USD_PER_CREDIT } from '@/lib/mcp/constants';

export interface TavilyPoolMetrics {
  plan: string | null;
  used: number;
  limit: number | null;
  remaining: number | null;
  usedPct: number | null;
  unlimited: boolean;
  exhausted: boolean;
  paygoUsage: number;
  paygoLimit: number | null;
  paygoActive: boolean;
  estimatedPaygoUsd: number;
  burnRatio: number | null;
  warn: boolean;
}

export function computeTavilyMetrics(params: {
  plan: string | null;
  planUsage: number;
  planLimit: number | null;
  paygoUsage: number;
  paygoLimit: number | null;
  elapsedRatio: number;
  warnPct: number;
}): TavilyPoolMetrics {
  const planLimit = params.planLimit;
  const unlimited = planLimit === null;
  const remaining = planLimit === null
    ? null
    : Math.max(0, planLimit - params.planUsage);
  const usedPct =
    planLimit === null || planLimit <= 0
      ? null
      : Math.min(100, (params.planUsage / planLimit) * 100);
  const exhausted = remaining !== null && remaining <= 0;
  const usedFraction = usedPct === null ? 0 : usedPct / 100;
  const burnRatio =
    params.elapsedRatio <= 0 ? null : usedFraction / params.elapsedRatio;

  return {
    plan: params.plan,
    used: params.planUsage,
    limit: params.planLimit,
    remaining,
    usedPct,
    unlimited,
    exhausted,
    paygoUsage: params.paygoUsage,
    paygoLimit: params.paygoLimit,
    paygoActive: params.paygoUsage > 0,
    estimatedPaygoUsd: params.paygoUsage * TAVILY_PAYGO_USD_PER_CREDIT,
    burnRatio,
    warn:
      exhausted ||
      (usedPct !== null && usedPct >= params.warnPct),
  };
}

export function formatBurnRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value === 0) return '0.0×';
  return `${value.toFixed(1)}×`;
}

export function isExaToolName(tool: string): boolean {
  const t = tool.toLowerCase();
  return (
    t === 'exa' ||
    t.startsWith('exa_') ||
    t.startsWith('exa-') ||
    t.endsWith('_exa') ||
    t.includes('_exa_')
  );
}

export function isTavilyToolName(tool: string): boolean {
  const t = tool.toLowerCase();
  return (
    t === 'tavily' ||
    t.startsWith('tavily_') ||
    t.startsWith('tavily-') ||
    t.includes('_tavily')
  );
}

export function isMcpProviderTool(tool: string): boolean {
  return isExaToolName(tool) || isTavilyToolName(tool);
}

export function mcpToolProvider(tool: string): 'exa' | 'tavily' | null {
  if (isExaToolName(tool)) return 'exa';
  if (isTavilyToolName(tool)) return 'tavily';
  return null;
}
