# Snapshort

A visual bookmark manager. Paste a link, and a headless browser captures a screenshot of the
page so your bookmarks are recognised by how they look instead of by title alone.

Built as a single-user local app: one Next.js process, one SQLite file, no accounts, no cloud.

---

## Features

**Capture**
- Playwright (headless Chromium) renders each saved page and stores a compressed WebP preview.
- Waits for real assets — page `load`, a bounded quiet-network window, every `<img>` to settle,
  and `document.fonts.ready` — so previews are not captured half-rendered.
- Title, meta description and favicon are extracted during the same visit.
- SSRF guard rejects local, private and link-local addresses before navigating.
- Concurrency capped at two browser contexts to keep memory flat.

**Organise**
- Five views: All Bookmarks, Favorites, Recent, Archive, Trash.
- Collections with one level of subcollections. A parent collection lists its own bookmarks
  plus everything in its subcollections; a subcollection lists only its own.
- Tags with usage counts, monochrome pills to keep colour meaningful for status only.
- Drag a card onto a collection to file it; drag onto the floating target to remove it
  from the collection you are currently viewing.
- Sort collections and tags A–Z (default) or by most used.

**Read and edit**
- Click a card to open a full editor: title, collection, URL, description and tags are
  editable in place, with the captured preview beside them.
- Changes save automatically when the editor closes; unchanged fields are not written.
- Search across title, URL and description; filter by tag or collection.
- Bookmarklet: drag the button in the sidebar to your bookmarks bar, then click it on any
  page to save that page here.

**Interface**
- Uniform 3×2 grid of six equal cards per page, no page scrolling.
- Keyboard: `/` focuses search, `N` focuses the paste field, `Esc` cancels dialogs.

---

## Requirements

- Node.js 20+ (developed on 22)
- pnpm 11+
- A Chromium build for Playwright (`pnpm exec playwright install chromium`)

## Getting started

```bash
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open http://localhost:3000. The database file and its schema are created on first request.

Optional: load sample data (this **deletes** existing rows first).

```bash
bun scripts/seed.ts
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint over `src` |
| `pnpm exec tsc --noEmit` | Type check |
| `bun scripts/seed.ts` | Reset the database with sample bookmarks, collections and tags |

---

## Architecture

```
src/
  app/
    page.tsx              single client page: state, data fetching, handlers
    layout.tsx            fonts, metadata, favicon bundle
    globals.css           Tailwind entry plus scrollbar and theme tokens
    api/
      bookmarks/          list + create (POST triggers background capture)
      bookmarks/[id]/     read, update (PATCH), permanent delete
      bookmarks/[id]/action     favorite / archive / trash / restore
      bookmarks/[id]/click      increments the visit counter
      bookmarks/[id]/retry      re-runs capture
      folders/            collections and subcollections
  components/
    Sidebar.tsx           views, collections, tag cloud, bookmarklet
    Header.tsx            search, paste-link and tag inputs
    BentoGrid.tsx         card grid, card renderer, pagination
    PreviewDrawer.tsx     editor with inline preview
    FlipList.tsx          animates list reordering (FLIP)
  db/
    index.ts              connection, pragmas, migrations
    schema.ts             table definitions and row types
    queries.ts            reads and status writes
    update.ts             bookmark updates, including tag linking
  lib/
    capture.ts            capture queue, status writes, boot recovery
    captureProviders.ts   Chromium renderer and external screenshot API
    config.ts             environment configuration
    captureStatus.ts      how a stored status is rendered
    ssrf.ts               URL safety validation
    usePresence.ts        mount/unmount transition helper
```

### Data model

```
folders ──< folders            (self-referencing parent_id, one level of nesting)
folders ──< bookmarks          (folder_id, ON DELETE SET NULL)
bookmarks ──< bookmark_tags ──< tags
```

- `bookmarks` carries the flags `is_favorite`, `is_archived`, `is_deleted` and the
  `click_count` visit counter.
- `url_hash` is unique, so saving the same link twice returns `409`.
- SQLite runs in WAL mode with foreign keys enabled.

### Capture pipeline

1. `POST /api/bookmarks` validates the URL (scheme, DNS, SSRF ranges) and inserts the row as
   `pending`.
2. Capture is queued in the background and the request returns immediately, so saving feels
   instant. The queue holds at most `CAPTURE_CONCURRENCY` jobs; duplicates of a bookmark already
   in flight are ignored.
3. The worker renders the page, waits for assets, writes the image and updates the row to
   `ready` — or `failed` with the error message. **Every path settles the row**: a failed
   browser launch or a network error from the screenshot API is recorded as `failed` rather
   than escaping and leaving the card spinning.
4. The grid shows "Queued..." for `pending`, a spinner for `capturing`, the screenshot for
   `ready`, and a retry button for `failed`. While any row is unsettled the client refetches
   every two seconds, so a capture that finishes in the background appears without a manual
   refresh.
5. On the first query of a new process, rows left at `pending`/`capturing` by a previous
   process are queued again — nothing advances them otherwise, and they would render as
   spinners forever.

Renderers sit behind one interface and are tried in the order given by `CAPTURE_PROVIDER`,
which accepts a comma-separated chain — `local,thum,sb` renders locally, falls back to a keyless
service when that fails, then to a keyed one:

| Slot | Renderer | Cost | Metadata |
|---|---|---|---|
| `local` | Chromium on this machine | ~280MB disk, 150-250MB RAM per page | Title, description and favicon read from the page |
| `thum` | thum.io (no key) | A request per capture | Image only |
| `sb` | screenshotbase (free key) | A request per capture | Image only |

A chain containing `local` is capped at two concurrent captures; API-only chains honour
`CAPTURE_CONCURRENCY`. When a capture comes back with an image but no metadata, `pageMetadata.ts`
reads the page's own `<title>`, `og:description` and first paragraph over plain HTTP — that costs
no API quota and works for every slot.

The SSRF guard runs before either renderer touches the URL. With `api`, the URL is sent to a
third party — that is a privacy decision, so it is opt-in and never a default. See
`.env.example` for every setting and provider URL templates.

Captured images are served by `src/app/screenshots/[file]/route.ts`, not from `public/`:
`next start` serves `public/` as a build-time snapshot, so a file written after the build —
which is every capture — would return 404.

### Screenshots and the database

Both are generated at runtime and are **not** tracked in git:

- `snapshort.db` (plus `-wal` and `-shm`) — local data.
- `public/screenshots/*.webp` — captured previews.

Deleting either is safe; they are rebuilt as you use the app.

---

## Responsive behaviour

The breakpoint is `lg` (1024px). Above it the app is the fixed desktop board; below it the
layout switches to a phone layout.

| | Desktop (≥1024px) | Mobile (<1024px) |
|---|---|---|
| Navigation | Sidebar always visible | Off-canvas drawer behind a hamburger; closed only on request (tap the scrim, `Esc`, or the browser Back gesture) — picking an item leaves it open so subcollections stay visible |
| Cards | Uniform 3×2 board, 6 per page | Single column, vertical scroll, no pagination |
| Card actions | Revealed on hover | Always visible, 44px targets |
| Bookmarklet | Shown in the sidebar footer | Hidden (needs a desktop bookmarks bar) |
| Collection actions | Revealed on hover | Always visible, tightly grouped (add subcollection, rename, delete) |
| Add a link | Inline paste field + tag field, always visible | Dark `+` button beside the search field opens a bottom sheet with both fields stacked, and it closes after saving |
| Pagination | Footer with page controls | Hidden |
| Collection / tag lists | Capped height with their own scroll; the column scrolls | Take the leftover height and scroll internally; the drawer itself never scrolls |
| Editor | Centered panel, preview beside the fields | Full-screen sheet, single column |
| Filing into a collection | Drag a card onto a collection | Editor's Collection field (HTML5 drag does not fire on touch) |

Touch-specific rules are expressed with Tailwind's `pointer-coarse:` variant, so pointer
devices keep the denser desktop styling. Text inputs step up to 16px on touch because iOS
Safari zooms the page when focusing anything smaller and does not zoom back.

---

## Conventions

- **Colour carries meaning.** Emerald marks the primary action and recovery, red marks
  destructive actions, amber marks in-progress state. Everything else is zinc.
- **Selection changes are instant.** Rows and pills do not cross-fade when the active item
  changes; only hover and press states animate. Fading a dark selection pill out while the
  next fades in reads as a flicker.
- **Content does not fade on view switches.** Refetches swap the cards in one commit.
- **Toasts appear top-centre of the content column**, below the header. On desktop the column
  starts after the 256px sidebar, so the toast is offset by half that width to line up with the
  cards rather than the window.
- **Form controls are filled, never outlined.** One shared `FIELD_CLASS` (`src/lib/ui.ts`) keeps
  the header, the add sheet, the sidebar and the editor identical; the fill deepens on focus.
- **Fields are 12px at every breakpoint**, matching the list rows and tag pills around them. The
  sidebar's inline name fields also copy the row's box, so rename mode does not jump the list.
- **Inputs share one shape**: `rounded-lg`, `px-3 py-2`, `border-zinc-200`, 12px medium text
  (16px on touch, see above).
- UI copy is English.

## Notes and limitations

- Collection nesting is one level deep; subcollections cannot hold further subcollections.
- Archive and Trash rows are excluded from collection and tag counts, so counts always match
  the list you get when you click them.
- The bookmarklet points at `http://localhost:3000`. Change the URL in
  `BOOKMARKLET_CODE` (`src/components/Sidebar.tsx`) when hosting elsewhere.
- Pages that never stop making network requests are captured with whatever has loaded, after
  a bounded wait, rather than failing.
- Cards are only draggable on pointer devices; `draggable` is disabled on touch where the
  gesture does not exist.
