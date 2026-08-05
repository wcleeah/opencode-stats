import { NextResponse } from 'next/server';

import { parseCursorUsageCsv } from '@/lib/cursor/csv';
import { importCursorEvents } from '@/lib/queries/cursor';

export const runtime = 'nodejs';

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing CSV file. Use form field "file".' },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only .csv files are supported.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'CSV exceeds the 20MB upload limit.' },
        { status: 400 },
      );
    }

    const text = await file.text();
    const parsed = parseCursorUsageCsv(text);

    if (parsed.events.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid usage rows found in CSV.',
          details: parsed.errors.slice(0, 10).join('; ') || undefined,
        },
        { status: 400 },
      );
    }

    const result = await importCursorEvents({
      filename: file.name,
      events: parsed.events,
      parseErrors: parsed.errors,
      minEventAt: parsed.minEventAt,
      maxEventAt: parsed.maxEventAt,
    });

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: 'Failed to import CSV into database.', details: result.error ?? undefined },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: result.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api.cursor.upload]', message);
    return NextResponse.json(
      { error: 'Unexpected upload failure.', details: message },
      { status: 500 },
    );
  }
}
