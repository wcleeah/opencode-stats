import { NextResponse } from 'next/server';

import { refreshMcpSnapshot } from '@/lib/queries/mcp';

export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  try {
    const result = await refreshMcpSnapshot({ force: true });
    if (result.error && !result.data) {
      return NextResponse.json(
        { error: 'Failed to refresh MCP usage.', details: result.error },
        { status: 500 },
      );
    }
    return NextResponse.json({
      data: result.data,
      skipped: result.skipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api.mcp.refresh]', message);
    return NextResponse.json(
      { error: 'Unexpected refresh failure.', details: message },
      { status: 500 },
    );
  }
}
