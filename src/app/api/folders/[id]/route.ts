import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/index';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, parent_id } = body;

    const db = getDb();
    const updates: string[] = [];
    const sqlParams: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      sqlParams.push(name.trim());
    }
    if (parent_id !== undefined) {
      updates.push('parent_id = ?');
      sqlParams.push(parent_id);
    }

    if (updates.length > 0) {
      sqlParams.push(id);
      db.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ?`).run(...sqlParams);
    }

    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
    return NextResponse.json({ folder });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update folder';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    // Cascade delete subfolders and clear folder_id on bookmarks
    db.prepare('DELETE FROM folders WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete folder';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
