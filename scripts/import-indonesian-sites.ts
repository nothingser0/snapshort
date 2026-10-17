/**
 * Imports a curated set of Indonesian sites into a two-level collection tree.
 *
 * Run once against the app's database:
 *
 *   bun scripts/import-indonesian-sites.ts
 *
 * The tree is `Category → Subcategory → bookmark`, which is the deepest nesting the schema
 * supports (`folders.parent_id` is one level). Bookmarks are inserted as `pending` so the
 * running app captures them on its next pass; nothing is fetched by this script.
 */
import { getDb } from '../src/db/index';
import { hashUrl } from '../src/db/queries';
import crypto from 'node:crypto';

interface Subcategory {
  name: string;
  sites: Array<{ domain: string; title?: string; note?: string }>;
}

interface Category {
  name: string;
  subcategories: Subcategory[];
}

const TREE: Category[] = [
  {
    name: 'News',
    subcategories: [
      {
        name: 'General',
        sites: [
          { domain: 'detik.com', title: 'detikcom' },
          { domain: 'kompas.com', title: 'Kompas.com' },
          { domain: 'cnnindonesia.com', title: 'CNN Indonesia' },
          { domain: 'tempo.co', title: 'Tempo.co' },
          { domain: 'liputan6.com', title: 'Liputan6.com' },
          { domain: 'kumparan.com', title: 'Kumparan' },
          { domain: 'tribunnews.com', title: 'Tribunnews.com' },
        ],
      },
      {
        name: 'Business',
        sites: [
          { domain: 'cnbcindonesia.com', title: 'CNBC Indonesia' },
          { domain: 'bisnis.com', title: 'Bisnis.com' },
          { domain: 'kontan.co.id', title: 'Kontan' },
        ],
      },
    ],
  },
  {
    name: 'Finance',
    subcategories: [
      {
        name: 'Banking',
        sites: [
          { domain: 'bca.co.id', title: 'Bank BCA' },
          { domain: 'bankmandiri.co.id', title: 'Bank Mandiri' },
          { domain: 'bri.co.id', title: 'Bank BRI' },
          { domain: 'bni.co.id', title: 'Bank BNI' },
        ],
      },
      {
        name: 'Digital Wallets',
        sites: [
          { domain: 'dana.id', title: 'DANA' },
          { domain: 'ovo.id', title: 'OVO' },
          { domain: 'gopay.co.id', title: 'GoPay' },
        ],
      },
      {
        name: 'Investing Apps',
        sites: [
          { domain: 'bibit.id', title: 'Bibit' },
          { domain: 'ajaib.co.id', title: 'Ajaib' },
          { domain: 'stockbit.com', title: 'Stockbit' },
        ],
      },
      {
        name: 'Markets & Regulators',
        sites: [
          { domain: 'idx.co.id', title: 'Indonesia Stock Exchange', note: 'Stock Exchange' },
          { domain: 'ojk.go.id', title: 'OJK', note: 'Financial Services Authority' },
        ],
      },
    ],
  },
  {
    name: 'Shopping',
    subcategories: [
      {
        name: 'Marketplaces',
        sites: [
          { domain: 'tokopedia.com', title: 'Tokopedia' },
          { domain: 'shopee.co.id', title: 'Shopee Indonesia' },
          { domain: 'lazada.co.id', title: 'Lazada Indonesia' },
          { domain: 'bukalapak.com', title: 'Bukalapak' },
          { domain: 'blibli.com', title: 'Blibli' },
        ],
      },
      {
        name: 'Books',
        sites: [{ domain: 'gramedia.com', title: 'Gramedia' }],
      },
    ],
  },
  {
    name: 'Travel & Transportation',
    subcategories: [
      {
        name: 'Flights & Hotels',
        sites: [
          { domain: 'traveloka.com', title: 'Traveloka' },
          { domain: 'tiket.com', title: 'tiket.com' },
          { domain: 'pegipegi.com', title: 'Pegipegi' },
        ],
      },
      {
        name: 'Trains',
        sites: [{ domain: 'kai.id', title: 'KAI — Kereta Api Indonesia' }],
      },
      {
        name: 'Ride-hailing',
        sites: [
          { domain: 'gojek.com', title: 'Gojek' },
          { domain: 'grab.com', title: 'Grab Indonesia', note: 'grab.com/id' },
        ],
      },
    ],
  },
  {
    name: 'Entertainment & Social',
    subcategories: [
      {
        name: 'Video & Streaming',
        sites: [
          { domain: 'vidio.com', title: 'Vidio' },
          { domain: 'youtube.com', title: 'YouTube' },
        ],
      },
      {
        name: 'Celebrity & Lifestyle',
        sites: [{ domain: 'kapanlagi.com', title: 'KapanLagi.com' }],
      },
      {
        name: 'Forums & Community',
        sites: [{ domain: 'kaskus.co.id', title: 'Kaskus' }],
      },
    ],
  },
  {
    name: 'Education',
    subcategories: [
      {
        name: 'Online Learning',
        sites: [
          { domain: 'ruangguru.com', title: 'Ruangguru' },
          { domain: 'zenius.net', title: 'Zenius' },
        ],
      },
      {
        name: 'Official',
        sites: [
          {
            domain: 'kemdikbud.go.id',
            title: 'Kemendikbudristek',
            note: 'Ministry of Education',
          },
        ],
      },
    ],
  },
  {
    name: 'Careers',
    subcategories: [
      {
        name: 'Job Boards',
        sites: [
          { domain: 'jobstreet.co.id', title: 'JobStreet Indonesia' },
          { domain: 'glints.com', title: 'Glints' },
          { domain: 'kalibrr.com', title: 'Kalibrr' },
        ],
      },
      {
        name: 'Professional Networking',
        sites: [{ domain: 'linkedin.com', title: 'LinkedIn' }],
      },
    ],
  },
  {
    name: 'Health',
    subcategories: [
      {
        name: 'Telemedicine & Health Info',
        sites: [
          { domain: 'halodoc.com', title: 'Halodoc' },
          { domain: 'alodokter.com', title: 'Alodokter' },
        ],
      },
      {
        name: 'Insurance',
        sites: [{ domain: 'bpjs-kesehatan.go.id', title: 'BPJS Kesehatan' }],
      },
    ],
  },
  {
    name: 'Government & Public Services',
    subcategories: [
      {
        name: 'General Citizen Services',
        sites: [
          { domain: 'indonesia.go.id', title: 'Indonesia.go.id' },
          {
            domain: 'dukcapil.kemendagri.go.id',
            title: 'Dukcapil',
            note: 'civil registry',
          },
        ],
      },
      {
        name: 'Taxes',
        sites: [{ domain: 'pajak.go.id', title: 'Direktorat Jenderal Pajak' }],
      },
      {
        name: 'Weather & Earthquakes',
        sites: [{ domain: 'bmkg.go.id', title: 'BMKG' }],
      },
      {
        name: 'Utilities',
        sites: [{ domain: 'pln.co.id', title: 'PLN', note: 'electricity' }],
      },
    ],
  },
];

const db = getDb();
const now = Date.now();

const findFolder = db.prepare(
  'SELECT id FROM folders WHERE name = ? AND parent_id IS ? LIMIT 1',
);
const insertFolder = db.prepare(
  'INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)',
);
const findBookmark = db.prepare('SELECT id FROM bookmarks WHERE url_hash = ? LIMIT 1');
const insertBookmark = db.prepare(`
  INSERT INTO bookmarks (
    id, url, url_hash, title, description, favicon_url,
    capture_status, folder_id, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
`);
const moveBookmark = db.prepare(
  'UPDATE bookmarks SET folder_id = ?, updated_at = ? WHERE id = ?',
);

/** Idempotent: re-running updates the tree instead of duplicating it. */
function folderId(name: string, parentId: string | null): string {
  const existing = findFolder.get(name, parentId) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  insertFolder.run(id, name, parentId, now);
  return id;
}

let createdBookmarks = 0;
let movedBookmarks = 0;

const run = db.transaction(() => {
  for (const category of TREE) {
    const categoryId = folderId(category.name, null);

    for (const subcategory of category.subcategories) {
      const subcategoryId = folderId(subcategory.name, categoryId);

      for (const site of subcategory.sites) {
        const url = `https://${site.domain}`;
        const urlHash = hashUrl(url);
        // A note in the source ("grab.com/id", "civil registry") is context, not part of the
        // URL, so it goes into the description where the card can show it.
        const description = site.note ? site.note : null;
        const favicon = `https://www.google.com/s2/favicons?domain=${site.domain}&sz=64`;

        const existing = findBookmark.get(urlHash) as { id: string } | undefined;
        if (existing) {
          moveBookmark.run(subcategoryId, now, existing.id);
          movedBookmarks += 1;
          continue;
        }

        insertBookmark.run(
          crypto.randomUUID(),
          url,
          urlHash,
          site.title || site.domain,
          description,
          favicon,
          subcategoryId,
          now,
          now,
        );
        createdBookmarks += 1;
      }
    }
  }
});

run();

const totals = db
  .prepare(
    `SELECT
       (SELECT COUNT(*) FROM folders) AS folders,
       (SELECT COUNT(*) FROM folders WHERE parent_id IS NOT NULL) AS subfolders,
       (SELECT COUNT(*) FROM bookmarks) AS bookmarks`,
  )
  .get() as { folders: number; subfolders: number; bookmarks: number };

console.log(
  `imported ${createdBookmarks} new bookmark(s), moved ${movedBookmarks} existing one(s)`,
);
console.log(
  `tree now holds ${totals.folders} folders (${totals.subfolders} subfolders) and ${totals.bookmarks} bookmarks`,
);
