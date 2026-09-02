import { NextResponse } from 'next/server';

import { getMcpSettings, updateMcpSettings } from '@/lib/queries/mcp';

export const runtime = 'nodejs';

function parseNonNegative(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parsePercent(value: unknown): number | null {
  const n = parseNonNegative(value);
  if (n === null) return null;
  if (n < 1 || n > 100) return null;
  return n;
}

export async function GET(): Promise<NextResponse> {
  const result = await getMcpSettings();
  if (result.error || !result.data) {
    return NextResponse.json(
      { error: 'Failed to load MCP settings.', details: result.error ?? undefined },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: result.data });
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const record = body as Record<string, unknown>;
    const exaAllotmentUsd = parseNonNegative(record.exaAllotmentUsd);
    const exaPurchasedExtraUsd = parseNonNegative(record.exaPurchasedExtraUsd);
    const tavilyWarnPct = parsePercent(record.tavilyWarnPct);
    const exaWarnUsd = parseNonNegative(record.exaWarnUsd);

    if (
      exaAllotmentUsd === null ||
      exaPurchasedExtraUsd === null ||
      tavilyWarnPct === null ||
      exaWarnUsd === null
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid settings. Expect exaAllotmentUsd >= 0, exaPurchasedExtraUsd >= 0, ' +
            'tavilyWarnPct between 1 and 100, exaWarnUsd >= 0.',
        },
        { status: 400 },
      );
    }

    const result = await updateMcpSettings({
      exaAllotmentUsd,
      exaPurchasedExtraUsd,
      tavilyWarnPct,
      exaWarnUsd,
    });

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: 'Failed to update settings.', details: result.error ?? undefined },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api.mcp.settings]', message);
    return NextResponse.json(
      { error: 'Unexpected settings update failure.', details: message },
      { status: 500 },
    );
  }
}
