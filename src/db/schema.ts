export interface Bookmark {
  id: string;
  url: string;
  url_hash: string;
  title: string;
  description: string | null;
  favicon_url: string | null;
  screenshot_path: string | null;
  capture_status: 'pending' | 'capturing' | 'ready' | 'failed';
  capture_error: string | null;
  is_pinned?: number;
  created_at: number;
  updated_at: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: number;
}

export interface BookmarkTag {
  bookmark_id: string;
  tag_id: string;
}

export interface BookmarkWithTags extends Bookmark {
  tags: Tag[];
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    url_hash TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    favicon_url TEXT,
    screenshot_path TEXT,
    capture_status TEXT NOT NULL DEFAULT 'pending',
    capture_error TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#10B981',
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_capture_status ON bookmarks(capture_status);
CREATE INDEX IF NOT EXISTS idx_bookmarks_url_hash ON bookmarks(url_hash);
`;
