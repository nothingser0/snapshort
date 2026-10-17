import { getDb } from './index';
import type { BookmarkWithTags, Tag } from './schema';
import { getBookmarkById } from './queries';

export interface UpdateBookmarkInput {
  title?: string;
  url?: string;
  description?: string | null;
  tag_names?: string[];
  folder_id?: string | null;
}

export function updateBookmark(id: string, input: UpdateBookmarkInput): BookmarkWithTags | null {
  const db = getDb();
  const existing = getBookmarkById(id);
  if (!existing) return null;

  const now = Date.now();
  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (input.title !== undefined) {
    updates.push('title = ?');
    params.push(input.title.trim());
  }

  if (input.url !== undefined && input.url.trim() !== existing.url) {
    const cleanUrl = input.url.trim();
    updates.push('url = ?');
    params.push(cleanUrl);
  }

  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description ? input.description.trim() : null);
  }

  if (input.folder_id !== undefined) {
    updates.push('folder_id = ?');
    params.push(input.folder_id || null);
  }

  params.push(id);

  const insertTag = db.prepare(`
    INSERT INTO tags (id, name, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET name=excluded.name
    RETURNING id, name, color, created_at
  `);

  const linkTag = db.prepare(`
    INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id)
    VALUES (?, ?)
  `);

  const runTx = db.transaction(() => {
    if (updates.length > 1) {
      db.prepare(`UPDATE bookmarks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    if (input.tag_names !== undefined) {
      // Clear existing tag links for this bookmark
      db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(id);

      for (const rawName of input.tag_names) {
        const tagName = rawName.trim().toLowerCase().replace(/^#/, '');
        if (!tagName) continue;
        const tagRow = insertTag.get(crypto.randomUUID(), tagName, now) as Tag;
        linkTag.run(id, tagRow.id);
      }
    }
  });

  runTx();
  return getBookmarkById(id);
}
