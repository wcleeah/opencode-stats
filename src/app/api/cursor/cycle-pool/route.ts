import { NextResponse } from 'next/server';

import {
  getCursorCyclePool,
  getCursorSettings,
  resolveCursorModelsPoolUsd,
  upsertCursorCyclePool,
} from '@/lib/queries/cursor';

export const runtime = 'nodejs';

const CYCLE_START_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseCycleStart(value: string | null): string | null {
  if (!value || !CYCLE_START_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return value;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const cycleStart = parseCycleStart(url.searchParams.get('cycleStart'));
  if (!cycleStart) {
    return NextResponse.json(
      { error: 'Query cycleStart (YYYY-MM-DD) is required.' },
      { status: 400 },
    );
  }

  const settings = await getCursorSettings();
  if (settings.error || !settings.data) {
    return NextResponse.json(
      { error: 'Failed to load settings.', details: settings.error ?? undefined },
      { status: 500 },
    );
  }

  const resolved = await resolveCursorModelsPoolUsd({
    cycleStart,
    defaultUsd: settings.data.cursor_models_included_usd,
  });
  if (resolved.error || !resolved.data) {
    return NextResponse.json(
      { error: 'Failed to resolve cycle pool.', details: resolved.error ?? undefined },
      { status: 500 },
    );
  }

  const override = await getCursorCyclePool(cycleStart);

  return NextResponse.json({
    data: {
      cycleStart,
      cursorModelsIncludedUsd: resolved.data.amountUsd,
      fromCycleOverride: resolved.data.fromCycleOverride,
      defaultUsd: settings.data.cursor_models_included_usd,
      override: override.data,
    },
  });
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const record = body as Record<string, unknown>;
    const cycleStart = parseCycleStart(
      typeof record.cycleStart === 'string' ? record.cycleStart : null,
    );
    const amount = Number(record.cursorModelsIncludedUsd);

    if (!cycleStart || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        {
          error:
            'Invalid body. Expect cycleStart (YYYY-MM-DD) and cursorModelsIncludedUsd >= 0.',
        },
        { status: 400 },
      );
    }

    const result = await upsertCursorCyclePool({
      cycleStart,
      cursorModelsIncludedUsd: amount,
    });

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: 'Failed to save cycle pool.', details: result.error ?? undefined },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api.cursor.cycle-pool]', message);
    return NextResponse.json(
      { error: 'Unexpected cycle pool update failure.', details: message },
      { status: 500 },
    );
  }
}
