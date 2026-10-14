# Snapshort — Local Operations & Runbook

## 1. Quickstart

```bash
# Install dependencies
pnpm install

# Run database setup & Playwright Chromium
pnpm exec playwright install chromium

# Launch development server
pnpm dev
# App running at http://localhost:3000
```

## 2. Production Build

```bash
pnpm build
pnpm start
```

## 3. Architecture & Data Paths
- **SQLite Database**: `snapshort.db` (WAL mode enabled, auto-created at startup).
- **Screenshots Directory**: `public/screenshots/` (PNG screenshots named `[bookmarkId].png`).
- **SSRF Guard**: Enforced before Playwright launch in `src/lib/ssrf.ts`.
- **Concurrency**: Managed by `p-limit` in `src/lib/capture.ts` (max 2 parallel headless contexts).
