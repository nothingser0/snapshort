import { NextRequest, NextResponse } from 'next/server';
import { 
  toggleFavoriteBookmark, 
  toggleArchiveBookmark, 
  moveToTrashBookmark,
  getBookmarkById 
} from '@/db/queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action } = await request.json();

    if (action === 'favorite') {
      toggleFavoriteBookmark(id);
    } else if (action === 'archive') {
      toggleArchiveBookmark(id);
    } else if (action === 'trash' || action === 'restore') {
      moveToTrashBookmark(id);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updated = getBookmarkById(id);
    return NextResponse.json({ bookmark: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
