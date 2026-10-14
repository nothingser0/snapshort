# PROJECT_LITE.md (Fast-Track Unified Specification)

> Lean unified specification document for **Snapshort** (Small-Scale Portfolio).

---

## 1. Project Metadata & Elevator Pitch
- **Project Name**: Snapshort
- **Project Type**: Solo Portfolio
- **Client / Sponsor**: Self-Initiated / Independent Developer
- **Delivery Model**: Solo Portfolio Web Application
- **Monetization**: Free & Open-Source / Self-Funded
- **Client Single PIC**: Self (Sole Decision Maker: zen)
- **Solo Developer**: zen
- **Target Release**: 2026-10-27 (2 Weeks)
- **Elevator Pitch**: *For researchers and developers who hoard browser tabs and links, Snapshort provides an automated visual bookmark manager that silently renders a headless preview screenshot and extracts metadata so you can scan your collection at a glance without opening every tab.*

---

## 2. Lean Scope Boundaries (In-Scope vs Out-of-Scope)

### Features to Build (In-Scope MVP - 4 Core Features)
1. **F-01: Quick URL Ingestion**: Input bar with automatic URL validation, title extraction, and initial tag assignment.
2. **F-02: Automated Screenshot Pipeline**: Headless Chromium capture worker with SSRF protection, configurable timeout (15s), local thumbnail storage, and error fallback states.
3. **F-03: Visual Bento Grid Gallery**: Bento-box cards rendering high-contrast thumbnails, domain favicons, tags, and reading status.
4. **F-04: Instant Search & Filter**: Real-time client-side search by title, domain, URL, and tag filters.

### Officially EXCLUDED / Deferred Features (Out-of-Scope)
1. No multi-user authentication or public link sharing (single-user personal vault).
2. No full text article scraping or readability parser (visual preview only).
3. No browser extension in MVP (web UI quick-add only).
4. No external S3/Cloudinary storage dependency (local disk storage for screenshots).

---

## 2.1 Riskiest Assumption Test (RAT) & Validation Razor

| ID | Core Hypothesis | Test Method (<1 Day) | Pass Threshold | Outcome / Evidence |
|:---|:----------------|:---------------------|:---------------|:-------------------|
| **ASM-01** | Playwright Chromium can reliably capture modern web pages locally in < 8s without memory leaks | Script benchmark against 10 sample URLs | ≥ 9/10 successful captures | ✅ Validated |
| **ASM-02** | SQLite + local filesystem screenshot storage can handle 1,000 links smoothly | Storage benchmark with 1,000 entries | Zero lag, < 50ms read latency | ✅ Validated |

---

## 3. Commercial Commitments & Self-Runway

- **Commercial Status**: WAIVED / SELF-FUNDED
- **Self-Budget / Hosting Cost**: Rp 0 / month (Local runtime / self-hosted node server)
- **Single PIC**: Sole Developer (zen)

---

## 4. Brand Identity, UI Design Tokens & Screen Prompts

### 4.1 Minimal Brand & Logo Brief
- **Brand Name / Wordmark**: Snapshort
- **Brand Vibe Keywords**: Tactile, Crisp, Visual, Fast
- **Primary Accent Color**: `#10B981` (Emerald / Mint)
- **Neutral Foundation**: Background `#F4F5F7`, Surface `#FFFFFF`, Border `#E5E7EB`, Text `#111827`
- **Logo Asset Path**: `public/logo.svg`

### 4.2 Visual Inspiration & Moodboard Reference
- **Reference**: `docs/design/inspiration/reference-bento.png` (Mindscope Soft Bento Dashboard)
- **Notes & Typography**: Inter / Plus Jakarta Sans. Documented in `docs/design/inspiration/notes.md`.

### 4.3 Screen Prompts & Layout Architecture
- **Navigation Map**: Documented in `docs/specs/LITE_SITEMAP.md` (SCR-001 Bento Dashboard, SCR-002 Preview Drawer).

### 4.4 Design Freeze & Anti-Slop Sign-Off
- **Mobile Input Ergonomics**: All form inputs are ≥ 16px (`text-base`).
- **Touch Targets**: All buttons meet ≥ 44px × 44px.
- **Contrast Ratio**: Text contrast ≥ 4.5:1 against canvas background (WCAG 2.2 AA).
- **Design Freeze Status**: FROZEN / APPROVED (by zen, 2026-10-13).

---

## 5. Lean Technical Blueprint

- **Selected Tech Stack**: Next.js 15 + SQLite (better-sqlite3) + Playwright Chromium + Tailwind CSS

Stack Decision LOCKED: Next.js
Stack-Locked-by: zen

### Tech Stack Discovery Answers (8 — human input, gate-enforced)

- Q1 Team Expertise: TypeScript / React / Next.js
- Q2 Database Experience: SQLite via better-sqlite3 (zero latency, single-file storage)
- Q3 Deployment Topology: Single-node instance / Local self-hosted / VPS
- Q4 Expected Scale (Year 1): 1,000–5,000 bookmarks personal collection
- Q5 Data Model Characteristics: Relational (bookmarks, tags, bookmark_tags)
- Q6 DevOps Complexity Tolerance: Zero-DevOps (single command `pnpm dev`, zero docker/external DB)
- Q7 Critical Feature Priority: Reliable background screenshot worker + SSRF safety + fluid bento gallery
- Q8 Compliance Requirements: None (portfolio / personal tool)

## Framework Versions (Pinned):
- Next.js: 15.2.x
- React: 19.x
- better-sqlite3: 11.8.x
- playwright: 1.50.x
- tailwindcss: 4.x or 3.4.x
- lucide-react: 1.16.x

- **Database Schema (Core Tables)**:
```sql
CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    url_hash TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    favicon_url TEXT,
    screenshot_path TEXT,
    capture_status TEXT NOT NULL DEFAULT 'pending', -- pending, capturing, ready, failed
    capture_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#10B981',
    created_at INTEGER NOT NULL
);

CREATE TABLE bookmark_tags (
    bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX idx_bookmarks_capture_status ON bookmarks(capture_status);
CREATE INDEX idx_bookmarks_url_hash ON bookmarks(url_hash);
```

### Security Blueprint (STEP 5 — all four required; gate-checked)

- **Data at rest**: Local SQLite database stored on filesystem, screenshots isolated in dedicated public media directory.
- **Password hashing**: N/A (single-tenant local tool with no external auth).
- **Web hardening**: OWASP Top 10 mitigations — Strict SSRF filter on URL capture endpoint (prohibits `127.0.0.1`, `localhost`, `0.0.0.0`, private ranges `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, AWS metadata `169.254.169.254`). Sanitized input, HTML entity encoding on previews.
- **Rate limiting**: Concurrency limiter (`p-limit` concurrency = 2) to prevent headless browser resource exhaustion.
- **Personal data**: N/A (no personal data).

### Module 04 Handoff Strategy (STEP 5 — gate-checked; parsed by M06 STEP 0)

**Compatibility Level**: Level 1

**Conversion Plan**: 1. Build Next.js 15 layout matching `docs/specs/DESIGN.md` bento token palette → 2. Implement SQLite repository layer (`src/db/`) → 3. Implement capture engine with SSRF guard (`src/lib/capture.ts`) → 4. Implement Bento UI with optimistic state and search.
**Estimated Conversion Time**: 2 days

### Core API Routes (STEP 4)

- `GET /api/bookmarks` — List bookmarks with filtering, search query, and tags.
- `POST /api/bookmarks` — Save bookmark and enqueue/trigger background capture.
- `GET /api/bookmarks/:id` — Detail view for drawer.
- `DELETE /api/bookmarks/:id` — Delete bookmark and cleanup screenshot file.
- `POST /api/bookmarks/:id/retry` — Re-trigger failed capture.

---

## 6. Technical Sign-Off & Summary Agreement of the Parties

**Approved by**: zen
**Approved on**: 2026-10-13
**Validated by Solo Developer**: zen (Date: 2026-10-13)
