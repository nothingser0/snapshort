import { NextRequest, NextResponse } from 'next/server';
import { getBookmarkById } from '@/db/queries';
import { captureScreenshot } from '@/lib/capture';
import { config } from '@/lib/config';

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

    // Retrying cannot work when this deployment has capture turned off; say why instead of
    // accepting the request and leaving the card spinning.
    if (!config.captureEnabled) {
      return NextResponse.json(
        { error: 'Screenshot capture is disabled on this server' },
        { status: 409 },
      );
    }

    // Trigger capture in background
    void captureScreenshot(bookmark.id, bookmark.url);

    return NextResponse.json({ message: 'Capture retry initiated', bookmarkId: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retry capture';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
