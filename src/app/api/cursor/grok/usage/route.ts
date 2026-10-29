import { NextResponse } from 'next/server';

import { authorizeGrokBotIngest } from '@/lib/grok-bot/ingest-auth';
import { parseGrokBotPlanUsage } from '@/lib/grok-bot/plan-usage';
import { saveGrokBotPlanUsage } from '@/lib/queries/grok-bot-plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 512 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const auth = authorizeGrokBotIngest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      {
        status: auth.status,
        headers: auth.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined,
      },
    );
  }

  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0) {
      return NextResponse.json({ error: 'Invalid Content-Length.' }, { status: 400 });
    }
    if (length > MAX_BYTES) {
      return NextResponse.json(
        { error: 'JSON body exceeds the 512KB limit.' },
        { status: 413 },
      );
    }
  }

  try {
    const text = await request.text();
    if (text.length > MAX_BYTES) {
      return NextResponse.json(
        { error: 'JSON body exceeds the 512KB limit.' },
        { status: 413 },
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const parsed = parseGrokBotPlanUsage(body);
    if (!parsed.data) {
      return NextResponse.json(
        { error: parsed.error ?? 'Invalid plan usage.' },
        { status: 400 },
      );
    }

    const saved = await saveGrokBotPlanUsage(parsed.data);
    if (!saved.data) {
      return NextResponse.json(
        { error: 'Failed to store plan usage.', details: saved.error ?? undefined },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: saved.data },
      { status: saved.data.created ? 201 : 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api.cursor.grok.usage]', message);
    return NextResponse.json(
      { error: 'Unexpected plan usage failure.', details: message },
      { status: 500 },
    );
  }
}
