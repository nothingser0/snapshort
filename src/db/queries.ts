import { getDb } from './index';
import { config } from '../lib/config';
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
  view?: 'all' | 'favorites' | 'recent' | 'archive' | 'trash';
  folderId?: string | null;
  sortBy?: 'most_used' | 'recent' | 'alphabetical';
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
  // With capture off there is nothing to wait for, so the row is born settled.
  const initialCaptureStatus: Bookmark['capture_status'] = config.captureEnabled
    ? 'pending'
    : 'disabled';

  const insertBookmark = db.prepare(`
    INSERT INTO bookmarks (
      id, url, url_hash, title, description, favicon_url,
      capture_status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?
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
      initialCaptureStatus,
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
      capture_status: initialCaptureStatus,
      capture_error: null,
      created_at: now,
      updated_at: now,
      tags,
    };
  });

  return runTx();
}

/** Shapes a joined row into a bookmark, parsing the aggregated tags JSON. */
function mapBookmarkRow(row: Bookmark & { tags_json: string }): BookmarkWithTags {
  let tags: Tag[] = [];
  try {
    const parsed: unknown = JSON.parse(row.tags_json);
    tags = Array.isArray(parsed) ? (parsed.filter(Boolean) as Tag[]) : [];
  } catch {
    tags = [];
  }
  const { tags_json: _tagsJson, ...bookmark } = row;
  void _tagsJson;
  return { ...bookmark, tags };
}

export function getBookmarks(options: BookmarkFilterOptions = {}): BookmarkWithTags[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  let orderByClause = 'ORDER BY b.click_count DESC, b.created_at DESC';
  if (options.sortBy === 'recent') {
    orderByClause = 'ORDER BY b.created_at DESC';
  } else if (options.sortBy === 'alphabetical') {
    orderByClause = 'ORDER BY b.title COLLATE NOCASE ASC';
  } else if (options.sortBy === 'most_used') {
    orderByClause = 'ORDER BY b.click_count DESC, b.created_at DESC';
  }

  // Main Views: all, favorites, recent, archive, trash
  if (options.view === 'trash') {
    conditions.push('b.is_deleted = 1');
  } else {
    conditions.push('b.is_deleted = 0'); // Default: exclude trash

    if (options.view === 'archive') {
      conditions.push('b.is_archived = 1');
    } else {
      conditions.push('b.is_archived = 0'); // Default: exclude archived
      if (options.view === 'favorites') {
        conditions.push('b.is_favorite = 1');
      }
    }
  }

  if (options.folderId !== undefined) {
    // A collection view shows its own bookmarks plus every subcollection's
    conditions.push(
      '(b.folder_id = ? OR b.folder_id IN (SELECT id FROM folders WHERE parent_id = ?))'
    );
    params.push(options.folderId, options.folderId);
  }

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
    ${orderByClause}
    ${limitClause} ${offsetClause}
  `;

  const rows = db.prepare(query).all(...params) as (Bookmark & { tags_json: string })[];

  return rows.map(mapBookmarkRow);
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

  return mapBookmarkRow(row);
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

export function toggleFavoriteBookmark(id: string): boolean {
  const db = getDb();
  const existing = db.prepare('SELECT is_favorite FROM bookmarks WHERE id = ?').get(id) as { is_favorite?: number } | undefined;
  if (!existing) return false;
  const newFav = existing.is_favorite === 1 ? 0 : 1;
  db.prepare('UPDATE bookmarks SET is_favorite = ? WHERE id = ?').run(newFav, id);
  return true;
}

export function toggleArchiveBookmark(id: string): boolean {
  const db = getDb();
  const existing = db.prepare('SELECT is_archived FROM bookmarks WHERE id = ?').get(id) as { is_archived?: number } | undefined;
  if (!existing) return false;
  const newArch = existing.is_archived === 1 ? 0 : 1;
  db.prepare('UPDATE bookmarks SET is_archived = ? WHERE id = ?').run(newArch, id);
  return true;
}

export function moveToTrashBookmark(id: string): boolean {
  const db = getDb();
  const existing = db.prepare('SELECT is_deleted FROM bookmarks WHERE id = ?').get(id) as { is_deleted?: number } | undefined;
  if (!existing) return false;
  const newDel = existing.is_deleted === 1 ? 0 : 1; // Toggle trash / restore
  db.prepare('UPDATE bookmarks SET is_deleted = ? WHERE id = ?').run(newDel, id);
  return true;
}

export function incrementBookmarkClicks(id: string): void {
  const db = getDb();
  db.prepare('UPDATE bookmarks SET click_count = COALESCE(click_count, 0) + 1 WHERE id = ?').run(id);
}

export function getViewCounts() {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(CASE WHEN is_deleted = 0 AND is_archived = 0 THEN 1 END) as all_count,
      COUNT(CASE WHEN is_deleted = 0 AND is_archived = 0 AND is_favorite = 1 THEN 1 END) as favorites_count,
      COUNT(CASE WHEN is_deleted = 0 AND is_archived = 1 THEN 1 END) as archive_count,
      COUNT(CASE WHEN is_deleted = 1 THEN 1 END) as trash_count,
      COUNT(CASE WHEN is_deleted = 0 AND is_archived = 0 AND capture_status = 'ready' THEN 1 END) as ready_count
    FROM bookmarks
  `).get() as { all_count: number; favorites_count: number; archive_count: number; trash_count: number; ready_count: number };
  return row;
}

export function deleteBookmark(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  return res.changes > 0;
}

export function getAllTags(): Tag[] {
  const db = getDb();
  return db.prepare(`
    SELECT t.id, t.name, t.color, t.created_at, COUNT(b.id) as count
    FROM tags t
    LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
    LEFT JOIN bookmarks b ON b.id = bt.bookmark_id AND b.is_deleted = 0 AND b.is_archived = 0
    GROUP BY t.id
    ORDER BY t.name COLLATE NOCASE ASC
  `).all() as (Tag & { count: number })[];
}

export function getAllFolders() {
  const db = getDb();
  return db.prepare(`
    SELECT f.*, COUNT(b.id) as count
    FROM folders f
    LEFT JOIN bookmarks b ON (b.folder_id = f.id OR b.folder_id IN (SELECT id FROM folders WHERE parent_id = f.id)) AND b.is_deleted = 0 AND b.is_archived = 0
    GROUP BY f.id
    ORDER BY f.name COLLATE NOCASE ASC
  `).all();
}
/**
 * Captures that no process is working on any more.
 *
 * `capturing` is only ever set by a running process, and `pending` rows are only picked up at
 * the moment they are created. Both therefore describe work that is lost after a restart, and
 * a row in either state renders as a spinner that never resolves.
 */
/**
 * Every bookmark whose capture has not settled yet.
 *
 * This is what the queue drains. It covers rows created by a script or an import (which never
 * passed through the API and so were never queued), rows interrupted by a restart, and rows
 * whose capture was lost. The queue re-reads it on each pass, so nothing can be forgotten.
 */
export function getUnsettledCaptures(): Array<{ id: string; url: string }> {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, url FROM bookmarks
       WHERE capture_status IN ('pending', 'capturing')
       ORDER BY created_at ASC`,
    )
    .all() as Array<{ id: string; url: string }>;
}

export function getStalledCaptures(olderThanMs: number): Array<{ id: string; url: string }> {
  const db = getDb();
  const cutoff = Date.now() - olderThanMs;
  return db
    .prepare(
      `SELECT id, url FROM bookmarks
       WHERE capture_status IN ('pending', 'capturing')
         AND updated_at < ?
       ORDER BY created_at ASC`,
    )
    .all(cutoff) as Array<{ id: string; url: string }>;
}

/**
 * Marks interrupted work as failed instead of requeueing it.
 *
 * Used when capture is switched off: the rows would otherwise stay `pending` forever, and a
 * card that says "Capturing preview..." on a server that will never capture anything is a lie.
 */
export function failStalledCaptures(reason: string): number {
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE bookmarks
       SET capture_status = 'failed', capture_error = ?, updated_at = ?
       WHERE capture_status IN ('pending', 'capturing')`,
    )
    .run(reason, Date.now());
  return result.changes;
}
