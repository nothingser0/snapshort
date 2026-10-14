import { getDb } from './index';
import type { Bookmark, Tag, BookmarkWithTags } from './schema';
import crypto from 'node:crypto';

export interface CreateBookmarkInput {
  url: string;
  title?: string;
  description?: string | null;
  favicon_url?: string | null;
  tag_names?: string[];
}

export interface BookmarkFilterOptions {
  query?: string;
  tag?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url.trim().toLowerCase()).digest('hex');
}

export function createBookmark(input: CreateBookmarkInput): BookmarkWithTags {
  const db = getDb();
  const id = crypto.randomUUID();
  const cleanUrl = input.url.trim();
  const url_hash = hashUrl(cleanUrl);
  const now = Date.now();

  // Check if bookmark already exists
  const existing = db.prepare('SELECT id FROM bookmarks WHERE url_hash = ?').get(url_hash) as { id: string } | undefined;
  if (existing) {
    const full = getBookmarkById(existing.id);
    if (full) return full;
  }

  const formatFallbackTitle = (rawUrl: string): string => {
    try {
      const host = new URL(rawUrl).hostname.replace(/^www\./, '');
      return host.charAt(0).toUpperCase() + host.slice(1);
    } catch {
      return rawUrl;
    }
  };
  const title = input.title?.trim() || formatFallbackTitle(cleanUrl);

  const insertBookmark = db.prepare(`
    INSERT INTO bookmarks (
      id, url, url_hash, title, description, favicon_url,
      capture_status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      'pending', ?, ?
    )
  `);

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
    insertBookmark.run(
      id,
      cleanUrl,
      url_hash,
      title,
      input.description || null,
      input.favicon_url || null,
      now,
      now
    );

    const tags: Tag[] = [];
    if (input.tag_names && input.tag_names.length > 0) {
      for (const rawName of input.tag_names) {
        const tagName = rawName.trim().toLowerCase();
        if (!tagName) continue;

        const tagRow = insertTag.get(crypto.randomUUID(), tagName, now) as Tag;
        linkTag.run(id, tagRow.id);
        tags.push(tagRow);
      }
    }

    return {
      id,
      url: cleanUrl,
      url_hash,
      title,
      description: input.description || null,
      favicon_url: input.favicon_url || null,
      screenshot_path: null,
      capture_status: 'pending' as const,
      capture_error: null,
      created_at: now,
      updated_at: now,
      tags,
    };
  });

  return runTx();
}

export function getBookmarks(options: BookmarkFilterOptions = {}): BookmarkWithTags[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.status) {
    conditions.push('b.capture_status = ?');
    params.push(options.status);
  }

  if (options.query) {
    conditions.push('(b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ?)');
    const wildcard = `%${options.query.trim()}%`;
    params.push(wildcard, wildcard, wildcard);
  }

  if (options.tag) {
    conditions.push(`
      b.id IN (
        SELECT bt.bookmark_id FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE t.name = ?
      )
    `);
    params.push(options.tag.trim().toLowerCase());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
  const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

  const query = `
    SELECT
      b.*,
      COALESCE(
        json_group_array(
          CASE WHEN t.id IS NOT NULL THEN
            json_object('id', t.id, 'name', t.name, 'color', t.color, 'created_at', t.created_at)
          ELSE NULL END
        ),
        '[]'
      ) as tags_json
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    LEFT JOIN tags t ON t.id = bt.tag_id
    ${whereClause}
    GROUP BY b.id
    ORDER BY b.is_pinned DESC, b.created_at DESC
    ${limitClause} ${offsetClause}
  `;

  const rows = db.prepare(query).all(...params) as (Bookmark & { tags_json: string })[];

  return rows.map((row) => {
    let tags: Tag[] = [];
    try {
      const parsed = JSON.parse(row.tags_json);
      tags = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      tags = [];
    }
    const { tags_json: _, ...bookmark } = row;
    return {
      ...bookmark,
      tags,
    };
  });
}

export function getBookmarkById(id: string): BookmarkWithTags | null {
  const db = getDb();
  const query = `
    SELECT
      b.*,
      COALESCE(
        json_group_array(
          CASE WHEN t.id IS NOT NULL THEN
            json_object('id', t.id, 'name', t.name, 'color', t.color, 'created_at', t.created_at)
          ELSE NULL END
        ),
        '[]'
      ) as tags_json
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    LEFT JOIN tags t ON t.id = bt.tag_id
    WHERE b.id = ?
    GROUP BY b.id
  `;

  const row = db.prepare(query).get(id) as (Bookmark & { tags_json: string }) | undefined;
  if (!row) return null;

  let tags: Tag[] = [];
  try {
    const parsed = JSON.parse(row.tags_json);
    tags = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    tags = [];
  }

  const { tags_json: _, ...bookmark } = row;
  return {
    ...bookmark,
    tags,
  };
}

export function updateBookmarkStatus(
  id: string,
  status: Bookmark['capture_status'],
  screenshotPath?: string | null,
  error?: string | null,
  title?: string | null,
  faviconUrl?: string | null,
  description?: string | null
): void {
  const db = getDb();
  const now = Date.now();

  const updates: string[] = ['capture_status = ?', 'updated_at = ?'];
  const params: unknown[] = [status, now];

  if (screenshotPath !== undefined) {
    updates.push('screenshot_path = ?');
    params.push(screenshotPath);
  }
  if (error !== undefined) {
    updates.push('capture_error = ?');
    params.push(error);
  }
  if (title !== undefined && title !== null) {
    updates.push('title = ?');
    params.push(title);
  }
  if (faviconUrl !== undefined) {
    updates.push('favicon_url = ?');
    params.push(faviconUrl);
  }
  if (description !== undefined && description !== null) {
    updates.push('description = ?');
    params.push(description);
  }

  params.push(id);
  db.prepare(`UPDATE bookmarks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
}

export function togglePinBookmark(id: string): boolean {
  const db = getDb();
  const existing = db.prepare('SELECT is_pinned FROM bookmarks WHERE id = ?').get(id) as { is_pinned?: number } | undefined;
  if (!existing) return false;

  const newPinned = existing.is_pinned === 1 ? 0 : 1;
  // If setting to 1, unpin all others so only 1 featured item is pinned
  if (newPinned === 1) {
    db.prepare('UPDATE bookmarks SET is_pinned = 0').run();
  }
  db.prepare('UPDATE bookmarks SET is_pinned = ? WHERE id = ?').run(newPinned, id);
  return true;
}

export function deleteBookmark(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  return res.changes > 0;
}

export function getAllTags(): Tag[] {
  const db = getDb();
  return db.prepare('SELECT * FROM tags ORDER BY name ASC').all() as Tag[];
}
