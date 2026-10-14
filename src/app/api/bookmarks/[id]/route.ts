import { NextRequest, NextResponse } from 'next/server';
import { getBookmarkById, deleteBookmark } from '@/db/queries';
import { updateBookmark } from '@/db/update';
import path from 'node:path';
import fs from 'node:fs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookmark = getBookmarkById(id);
    if (!bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }
    return NextResponse.json({ bookmark });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch bookmark';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = updateBookmark(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }
    return NextResponse.json({ bookmark: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update bookmark';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookmark = getBookmarkById(id);
    if (!bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    if (bookmark.screenshot_path) {
      const filePath = path.join(process.cwd(), 'public', bookmark.screenshot_path.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore unlink error
        }
      }
    }

    deleteBookmark(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete bookmark';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
