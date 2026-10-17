import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { SCHEMA_SQL } from './schema';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'snapshort.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new Database(DB_PATH);
  
  // Performance and integrity pragmas
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  // Initialize schema
  dbInstance.exec(SCHEMA_SQL);
  
  // Dynamic column migrations
  const runMigration = (sql: string) => {
    try {
      dbInstance?.exec(sql);
    } catch {
      // Ignore if column or index already exists
    }
  };

  runMigration('ALTER TABLE bookmarks ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0');
  runMigration('ALTER TABLE bookmarks ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0');
  runMigration('ALTER TABLE bookmarks ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0');
  runMigration('ALTER TABLE bookmarks ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0');
  runMigration('ALTER TABLE bookmarks ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL');
  runMigration('CREATE INDEX IF NOT EXISTS idx_bookmarks_click_count ON bookmarks(click_count DESC)');
  runMigration('CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder_id)');

  // Obsolete column: the pinned feature was replaced by favorites. Existing
  // database files still carry it, so drop it to match the schema.
  runMigration('ALTER TABLE bookmarks DROP COLUMN is_pinned');

  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
