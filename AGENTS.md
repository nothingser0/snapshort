# Snapshort - Project Agents & Execution Directives

## Project Overview
- **Name**: Snapshort
- **Description**: Intelligent visual bookmark manager with automated headless screenshot preview.
- **Stack**: Next.js 15 (App Router), SQLite (better-sqlite3), Playwright Chromium, Tailwind CSS.
- **Scale**: Small / Portfolio Fast-Track

## Operational Directives
1. **SSRF Guard**: Strict check against local/private network ranges before navigating Playwright.
2. **Concurrency Limiter**: Max 2 concurrent browser contexts to prevent memory spikes.
3. **Database**: Single SQLite file `snapshort.db` with WAL mode enabled.
4. **Development Flow**: Execute 1 task at a time, run its verification command, report evidence, and wait for human confirmation.
