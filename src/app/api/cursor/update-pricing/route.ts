import { NextResponse } from 'next/server';

import { launchPricingAgent, readCursorAgentEnv } from '@/lib/cursor/agent';

export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  try {
    const result = await launchPricingAgent(readCursorAgentEnv());
    if (!result.ok) {
      const status = result.status === 401 || result.status === 403
        ? result.status
        : result.status === 503
          ? 503
          : 502;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ data: result.agent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api.cursor.update-pricing]', message);
    return NextResponse.json(
      { error: 'Unexpected pricing-agent launch failure.', details: message },
      { status: 500 },
    );
  }
}
