export interface GrokBotTokenSides {
  readonly ins: number;
  readonly outs: number;
}

export interface GrokBotPartition {
  readonly totalUsd: number;
  readonly insUsd: number;
}

export type GrokBotCharge =
  | { readonly status: 'unbilled' }
  | { readonly status: 'reported-missing' }
  | { readonly status: 'unpriced' }
  | { readonly status: 'reported'; readonly split: GrokBotPartition }
  | { readonly status: 'rated'; readonly split: GrokBotPartition }
  | {
      readonly status: 'partial';
      readonly split: GrokBotPartition;
      readonly unpricedCacheWriteTokens: number;
    };

export interface GrokBotPricedRow {
  readonly tokens: GrokBotTokenSides;
  readonly charge: GrokBotCharge;
}

export function grokBotTokenTotal(tokens: GrokBotTokenSides): number {
  return tokens.ins + tokens.outs;
}

export function grokBotOutsUsd(totalUsd: number, insUsd: number): number {
  return totalUsd - insUsd;
}
