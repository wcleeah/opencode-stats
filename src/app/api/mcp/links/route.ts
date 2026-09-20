import { NextResponse } from 'next/server';

import { parseMcpLinkInput } from '@/lib/mcp/links';
import { createMcpLink, listMcpLinks } from '@/lib/queries/mcp';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const result = await listMcpLinks();
  if (result.error || !result.data) {
    return NextResponse.json(
      { error: 'Failed to load links.', details: result.error ?? undefined },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: result.data });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const parsed = parseMcpLinkInput(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await createMcpLink({
      name: parsed.name,
      url: parsed.url,
      sortOrder: parsed.sortOrder,
    });
    if (result.error || !result.data) {
      return NextResponse.json(
        { error: 'Failed to create link.', details: result.error ?? undefined },
        { status: 500 },
      );
    }
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api.mcp.links]', message);
    return NextResponse.json(
      { error: 'Unexpected link create failure.', details: message },
      { status: 500 },
    );
  }
}
