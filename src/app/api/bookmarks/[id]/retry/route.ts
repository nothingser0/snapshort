import { NextRequest, NextResponse } from 'next/server';
import { getBookmarkById } from '@/db/queries';
import { captureScreenshot } from '@/lib/capture';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookmark = getBookmarkById(id);
    if (!bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    // Trigger capture in background
    void captureScreenshot(bookmark.id, bookmark.url);

    return NextResponse.json({ message: 'Capture retry initiated', bookmarkId: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retry capture';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
