import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/index';
import crypto from 'node:crypto';

export async function GET() {
  try {
    const db = getDb();
    const folders = db.prepare(`
      SELECT f.*, COUNT(b.id) as count
      FROM folders f
      LEFT JOIN bookmarks b ON b.folder_id = f.id AND b.is_deleted = 0
      GROUP BY f.id
      ORDER BY f.created_at ASC
    `).all();
    return NextResponse.json({ folders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch folders';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parent_id } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const db = getDb();
    db.prepare(`
      INSERT INTO folders (id, name, parent_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, name.trim(), parent_id || null, now);

    return NextResponse.json({ folder: { id, name: name.trim(), parent_id: parent_id || null, created_at: now } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create folder';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
