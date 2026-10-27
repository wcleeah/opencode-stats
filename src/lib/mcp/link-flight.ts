export const MCP_LINK_FLIGHT_HOLD_MS = 8_000;

export type McpLinkFlight =
  | { readonly kind: 'add' }
  | { readonly kind: 'save' | 'up' | 'down' | 'delete'; readonly id: number };

export type McpLinkFlightPhase =
  | { readonly status: 'idle' }
  | { readonly status: 'request'; readonly flight: McpLinkFlight }
  | { readonly status: 'refresh'; readonly flight: McpLinkFlight; readonly sawPending: boolean };

export function mcpLinkFlightStart(flight: McpLinkFlight): McpLinkFlightPhase {
  return { status: 'request', flight };
}

export function mcpLinkFlightFail(phase: McpLinkFlightPhase): McpLinkFlightPhase {
  if (phase.status === 'idle') return phase;
  return { status: 'idle' };
}

export function mcpLinkFlightRefresh(phase: McpLinkFlightPhase): McpLinkFlightPhase {
  if (phase.status !== 'request') return phase;
  return { status: 'refresh', flight: phase.flight, sawPending: false };
}

export function mcpLinkFlightOnPending(
  phase: McpLinkFlightPhase,
  pending: boolean,
): McpLinkFlightPhase {
  if (phase.status !== 'refresh') return phase;
  if (pending) {
    if (phase.sawPending) return phase;
    return { status: 'refresh', flight: phase.flight, sawPending: true };
  }
  if (!phase.sawPending) return phase;
  return { status: 'idle' };
}

export function mcpLinkFlightTimeout(phase: McpLinkFlightPhase): McpLinkFlightPhase {
  if (phase.status !== 'refresh') return phase;
  return { status: 'idle' };
}

export function mcpLinkFlightMatches(
  phase: McpLinkFlightPhase,
  flight: McpLinkFlight,
): boolean {
  if (phase.status === 'idle') return false;
  return sameFlight(phase.flight, flight);
}

export function mcpLinkFlightBusy(phase: McpLinkFlightPhase, pending: boolean): boolean {
  return phase.status !== 'idle' || pending;
}

function sameFlight(left: McpLinkFlight, right: McpLinkFlight): boolean {
  if (left.kind === 'add' || right.kind === 'add') return left.kind === right.kind;
  return left.kind === right.kind && left.id === right.id;
}
