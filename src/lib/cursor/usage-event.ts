export type CursorProduct = 'cursor' | 'grok-bot';

export interface CursorUsageEvent {
  eventAt: number;
  cloudAgentId: string | null;
  automationId: string | null;
  kind: string;
  model: string;
  product: CursorProduct | null;
  maxMode: boolean;
  tokensInputCacheWrite: number;
  tokensInput: number;
  tokensCacheRead: number;
  tokensOutput: number;
  tokensTotal: number;
  costRaw: string;
  reportedCost: number | null;
  eventHash: string;
}
