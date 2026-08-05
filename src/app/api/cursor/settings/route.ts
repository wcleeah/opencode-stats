import { NextResponse } from 'next/server';

import { getCursorSettings, updateCursorSettings } from '@/lib/queries/cursor';

export const runtime = 'nodejs';

function parsePositiveNumber(value: unknown, field: string): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  if (field === 'billingCycleStartDay') {
    const day = Math.round(n);
    if (day < 1 || day > 28) return null;
    return day;
  }
  return n;
}

export async function GET(): Promise<NextResponse> {
  const result = await getCursorSettings();
  if (result.error || !result.data) {
    return NextResponse.json(
      { error: 'Failed to load Cursor settings.', details: result.error ?? undefined },
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
    const planAmountUsd = parsePositiveNumber(record.planAmountUsd, 'planAmountUsd');
    const includedPoolUsd = parsePositiveNumber(
      record.includedPoolUsd,
      'includedPoolUsd',
    );
    const cursorModelsIncludedUsd = parsePositiveNumber(
      record.cursorModelsIncludedUsd,
      'cursorModelsIncludedUsd',
    );
    const billingCycleStartDay = parsePositiveNumber(
      record.billingCycleStartDay,
      'billingCycleStartDay',
    );

    if (
      planAmountUsd === null ||
      includedPoolUsd === null ||
      cursorModelsIncludedUsd === null ||
      billingCycleStartDay === null
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid settings. Expect planAmountUsd >= 0, includedPoolUsd >= 0, ' +
            'cursorModelsIncludedUsd >= 0, billingCycleStartDay between 1 and 28.',
        },
        { status: 400 },
      );
    }

    const result = await updateCursorSettings({
      planAmountUsd,
      includedPoolUsd,
      cursorModelsIncludedUsd,
      billingCycleStartDay,
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
    console.error('[api.cursor.settings]', message);
    return NextResponse.json(
      { error: 'Unexpected settings update failure.', details: message },
      { status: 500 },
    );
  }
}
