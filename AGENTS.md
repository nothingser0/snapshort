# Snapshort — Agent Directives

## Project

- **Name**: Snapshort
- **What it is**: Single-user visual bookmark manager. Saves a link, renders it with headless
  Chromium, stores a WebP preview, and presents the collection as a card grid.
- **Stack**: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · SQLite
  (better-sqlite3) · Playwright Chromium
- **Scale**: Small, local-only. No auth, no external services, no cloud storage.

## Non-negotiables

1. **SSRF guard first.** Every URL is validated before Playwright navigates. Never weaken
   `src/lib/ssrf.ts` or move the check after navigation.
2. **Cap concurrency at 2 browser contexts** (`p-limit` in `src/lib/capture.ts`). Higher caps
   spike memory and stall the app.
3. **One SQLite file** `snapshort.db` in WAL mode, schema created on first connection.
   Migrations are additive statements in `src/db/index.ts` wrapped in `runMigration`.
4. **Colour carries meaning.** Emerald = primary action, success and recovery. Red =
   destructive. Amber = in progress. Everything else is zinc. Do not introduce decorative
   hues (no per-tag rainbow, no coloured card variants).
5. **Do not fade content on view switches.** Selection changes are instant; only hover and
   press states animate. See `docs/DESIGN.md` for the full motion table and the reasoning.
6. **The app fits 1920×1080 with no page scrollbar.** Six uniform cards per page.

## Before changing visual code

Read `docs/DESIGN.md`. It documents the token table, the uniform grid rule, the shared input
shape, the motion timings, and the two animation approaches that were tried and removed
because they caused a light flicker on every menu switch.

## Verification

```bash
pnpm exec tsc --noEmit     # types
pnpm lint                  # eslint, includes the React Compiler rules
bun scripts/seed.ts        # optional: sample data; deletes existing rows first
```

Run the app and exercise the changed path — types and lint do not prove the UI works.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
