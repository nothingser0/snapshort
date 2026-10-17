import { NextRequest, NextResponse } from 'next/server';
import { incrementBookmarkClicks, getBookmarkById } from '@/db/queries';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    incrementBookmarkClicks(id);
    const updated = getBookmarkById(id);
    return NextResponse.json({ bookmark: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record click';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
