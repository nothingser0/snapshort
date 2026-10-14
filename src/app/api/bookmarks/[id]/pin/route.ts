import { NextRequest, NextResponse } from 'next/server';
import { togglePinBookmark, getBookmarkById } from '@/db/queries';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = togglePinBookmark(id);
    if (!ok) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }
    const updated = getBookmarkById(id);
    return NextResponse.json({ bookmark: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to toggle pin';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
