import { getDb } from '../src/db/index';
import crypto from 'node:crypto';

const db = getDb();

// 1. Clean existing dummy data
db.exec('DELETE FROM bookmark_tags');
db.exec('DELETE FROM bookmarks');
db.exec('DELETE FROM tags');
db.exec('DELETE FROM folders');

const now = Date.now();

// 2. Insert Folders (Root & Subfolders)
const fDesignId = crypto.randomUUID();
const fDevId = crypto.randomUUID();
const fReadingId = crypto.randomUUID();
const fSubFrontendId = crypto.randomUUID();

db.prepare('INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)').run(
  fDesignId, 'Design Inspiration', null, now - 10000
);
db.prepare('INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)').run(
  fDevId, 'Engineering', null, now - 9000
);
db.prepare('INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)').run(
  fReadingId, 'Articles & Reads', null, now - 8000
);
db.prepare('INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)').run(
  fSubFrontendId, 'Frontend UI', fDevId, now - 7000
);

// 3. Insert Tags with distinct colors
const tagsData = [
  { id: crypto.randomUUID(), name: 'design', color: '#9333EA' },
  { id: crypto.randomUUID(), name: 'dev', color: '#2563EB' },
  { id: crypto.randomUUID(), name: 'ai', color: '#059669' },
  { id: crypto.randomUUID(), name: 'reading', color: '#D97706' },
  { id: crypto.randomUUID(), name: 'tools', color: '#0891B2' },
  { id: crypto.randomUUID(), name: 'portfolio', color: '#E11D48' },
];

for (const t of tagsData) {
  db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(t.id, t.name, t.color, now);
}

// 4. Insert Realistic Rich Bookmarks
const sampleBookmarks = [
  {
    url: 'https://github.com',
    title: 'GitHub — Build and Ship Software Faster',
    description: 'The complete developer platform to build, scale, and deliver secure software using AI-powered automation.',
    favicon: 'https://github.com/favicon.ico',
    is_favorite: 1,
    is_archived: 0,
    is_deleted: 0,
    folder_id: fSubFrontendId,
    click_count: 14,
    tags: ['dev', 'tools'],
  },
  {
    url: 'https://linear.app',
    title: 'Linear — Purpose-Built Product Management',
    description: 'A better way to build products. Meet the new standard for modern software development, issues, and sprint planning.',
    favicon: 'https://linear.app/favicon.ico',
    is_favorite: 1,
    is_archived: 0,
    is_deleted: 0,
    folder_id: fDesignId,
    click_count: 22,
    tags: ['design', 'tools'],
  },
  {
    url: 'https://news.ycombinator.com',
    title: 'Hacker News — Tech News & Discussions',
    description: 'A social news website focusing on computer science, entrepreneurship, and intellectual curiosities.',
    favicon: 'https://news.ycombinator.com/favicon.ico',
    is_favorite: 1,
    is_archived: 0,
    is_deleted: 0,
    folder_id: fReadingId,
    click_count: 35,
    tags: ['reading', 'dev'],
  },
  {
    url: 'https://anthropic.com',
    title: 'Anthropic — AI Research and Safety',
    description: 'Anthropic is an AI safety and research company that builds reliable, interpretable, and steerable AI systems like Claude.',
    favicon: 'https://anthropic.com/favicon.ico',
    is_favorite: 0,
    is_archived: 0,
    is_deleted: 0,
    folder_id: fDevId,
    click_count: 9,
    tags: ['ai', 'tools'],
  },
  {
    url: 'https://dribbble.com',
    title: 'Dribbble — Discover the World’s Top Designers',
    description: 'Explore design portfolios, visual branding inspiration, typography experiments, and user interface concepts.',
    favicon: 'https://dribbble.com/favicon.ico',
    is_favorite: 1,
    is_archived: 0,
    is_deleted: 0,
    folder_id: fDesignId,
    click_count: 18,
    tags: ['design', 'portfolio'],
  },
  {
    url: 'https://react.dev',
    title: 'React — The Library for Web and Native Interfaces',
    description: 'React lets you build user interfaces out of individual pieces called components. Written and maintained by Meta.',
    favicon: 'https://react.dev/favicon.ico',
    is_favorite: 0,
    is_archived: 0,
    is_deleted: 0,
    folder_id: fSubFrontendId,
    click_count: 11,
    tags: ['dev'],
  },
  {
    url: 'https://medium.com',
    title: 'Medium — Where Good Ideas Find You',
    description: 'Read and share stories that matter, written by expert voices, thinkers, engineers, and independent journalists.',
    favicon: 'https://medium.com/favicon.ico',
    is_favorite: 0,
    is_archived: 1, // In Archive
    is_deleted: 0,
    folder_id: fReadingId,
    click_count: 5,
    tags: ['reading'],
  },
  {
    url: 'https://old-obsolete-link.com',
    title: 'Old Broken Article — Obsolete Cache',
    description: 'Legacy web page archived before domain expiration and link rot occurred.',
    favicon: null,
    is_favorite: 0,
    is_archived: 0,
    is_deleted: 1, // In Trash
    folder_id: null,
    click_count: 1,
    tags: ['tools'],
  },
];

for (const b of sampleBookmarks) {
  const bId = crypto.randomUUID();
  const hash = crypto.createHash('sha256').update(b.url.toLowerCase()).digest('hex');

  db.prepare(`
    INSERT INTO bookmarks (
      id, url, url_hash, title, description, favicon_url,
      capture_status, is_favorite, is_archived, is_deleted,
      folder_id, click_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bId,
    b.url,
    hash,
    b.title,
    b.description,
    b.favicon,
    b.is_favorite,
    b.is_archived,
    b.is_deleted,
    b.folder_id,
    b.click_count,
    now - Math.floor(Math.random() * 86400000 * 5),
    now
  );

  for (const tName of b.tags) {
    const tRow = tagsData.find(x => x.name === tName);
    if (tRow) {
      db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)').run(bId, tRow.id);
    }
  }
}

console.log('Database successfully seeded with realistic dummy bookmarks, folders, and tags!');
