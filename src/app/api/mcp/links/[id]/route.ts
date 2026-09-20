import { NextResponse } from 'next/server';

import { parseMcpLinkInput } from '@/lib/mcp/links';
import { deleteMcpLink, getMcpLink, updateMcpLink } from '@/lib/queries/mcp';

export const runtime = 'nodejs';

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (id === null) {
      return NextResponse.json({ error: 'Invalid link id.' }, { status: 400 });
    }

    const body: unknown = await request.json();
    const parsed = parseMcpLinkInput(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const existing = await getMcpLink(id);
    if (existing.error) {
      return NextResponse.json(
        { error: 'Failed to load link.', details: existing.error },
        { status: 500 },
      );
    }
    if (!existing.data) {
      return NextResponse.json({ error: 'Link not found.' }, { status: 404 });
    }

    const result = await updateMcpLink({
      id,
      name: parsed.name,
      url: parsed.url,
      sortOrder: parsed.sortOrder ?? existing.data.sort_order,
    });
    if (result.error || !result.data) {
      const status = result.error === 'Link not found.' ? 404 : 500;
      return NextResponse.json(
        { error: result.error ?? 'Failed to update link.' },
        { status },
      );
    }
    return NextResponse.json({ data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api.mcp.links.id]', message);
    return NextResponse.json(
      { error: 'Unexpected link update failure.', details: message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (id === null) {
      return NextResponse.json({ error: 'Invalid link id.' }, { status: 400 });
    }

    const result = await deleteMcpLink(id);
    if (result.error || !result.data) {
      const status = result.error === 'Link not found.' ? 404 : 500;
      return NextResponse.json(
        { error: result.error ?? 'Failed to delete link.' },
        { status },
      );
    }
    return NextResponse.json({ data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api.mcp.links.id]', message);
    return NextResponse.json(
      { error: 'Unexpected link delete failure.', details: message },
      { status: 500 },
    );
  }
}
