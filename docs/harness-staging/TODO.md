# Snapshort Development Task List

> Rule: One task executed per turn. Verify before reporting. Human reviews and marks `[x]`.

## Phase 1: Foundation & Database Layer
- [ ] **M06-01**: Scaffold Next.js 15 application with Tailwind CSS and install dependencies (`better-sqlite3`, `playwright`, `lucide-react`, `p-limit`).
  - *Verify*: `pnpm build` succeeds with zero type/lint errors.
- [ ] **M06-02**: Implement SQLite database connection and migration schema (`src/db/schema.ts`, `src/db/index.ts`).
  - *Verify*: Run test script initializing DB and creating tables in WAL mode.
- [ ] **M06-03**: Implement data access repository (`src/db/queries.ts`) with CRUD for bookmarks and tags.
  - *Verify*: Vitest / Node test script exercising insert, query, filter, and delete.

## Phase 2: Screenshot Engine & API Layer
- [ ] **M06-04**: Implement SSRF guard and URL safety validator (`src/lib/ssrf.ts`).
  - *Verify*: Test suite rejecting `127.0.0.1`, `localhost`, `10.0.0.1`, `169.254.169.254` and allowing valid public domains.
- [ ] **M06-05**: Implement headless capture worker (`src/lib/capture.ts`) with Playwright, timeout handling, thumbnail compression, and status updates.
  - *Verify*: Test script capturing sample URL and saving webp/png into `public/screenshots/`.
- [ ] **M06-06**: Implement Next.js API route endpoints (`/api/bookmarks`, `/api/bookmarks/[id]`, `/api/bookmarks/[id]/retry`).
  - *Verify*: Curl / HTTP tests verifying list, create + background capture trigger, and delete.

## Phase 3: Bento Grid UI & Search Experience
- [ ] **M06-07**: Implement Bento Layout shell, header quick-add bar, and sidebar (`src/components/Sidebar.tsx`, `src/components/Header.tsx`, `src/app/layout.tsx`).
  - *Verify*: Browser test confirming soft background `#F4F5F7`, responsive navbar, and active sidebar.
- [ ] **M06-08**: Implement Bookmark Card component with visual thumbnail, status pills, and empty/error states (`src/components/BookmarkCard.tsx`, `src/components/BentoGrid.tsx`).
  - *Verify*: Visual test checking card rendering matching benchmark aesthetics.
- [ ] **M06-09**: Implement instant search, tag filtering, and preview inspection modal/drawer (`src/components/PreviewDrawer.tsx`, search state).
  - *Verify*: Test typing query filters list in real-time and clicking card opens drawer.
- [ ] **M06-10**: End-to-end smoke verification: add URL -> screenshot capture generated -> visual preview rendered in Bento grid -> search verified.
  - *Verify*: Full end-to-end smoke test script proving acceptance criteria.
