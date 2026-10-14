# DESIGN.md — Snapshort Design Specification (LITE)

## Visual Architecture & Foundations

- **Benchmark**: Soft Bento Dashboard (`docs/design/inspiration/reference-bento.png`)
- **Background**: `#F4F5F7`
- **Surface**: `#FFFFFF` with border `#E5E7EB` and rounded corners `rounded-2xl` (16px–20px)
- **Primary Typography**: Inter / Plus Jakarta Sans (`font-sans`)
- **Primary CTA / Focus**: `#18181B` (pill rounded-full)
- **Accent**: Emerald `#10B981` (status indicators, capture badges)
- **Contrast**: Text `#111827` on `#FFFFFF` (~16:1 ratio), Muted text `#6B7280` on `#FFFFFF` (4.6:1 ratio, AA compliant).

## State matrix (SCR-001 Primary Screen)

| State | Trigger | Visual rule |
| :--- | :--- | :--- |
| Default | Bookmarks loaded | Bento grid displaying screenshot cards with title, tags, and domain favicon |
| Loading | Initial fetch or search filter | Skeleton pulse cards matching exact card dimensions (`animate-pulse bg-gray-200`) |
| Empty | 0 bookmarks or 0 search matches | Centered illustration/icon with text "No bookmarks found" + focus quick-add input |
| Error | Backend or network failure | Alert banner with "Failed to load bookmarks" + retry button |
| Success | Bookmark added / screenshot ready | Toast banner bottom-right auto-dismiss 4s ("Bookmark captured successfully") |

## Screen coverage

| Screen ID | States implemented | Notes |
| :--- | :--- | :--- |
| SCR-001 | 5-state | Primary dashboard & bento gallery grid |
| SCR-002 | Default, Loading, Error, Success | Modal / drawer inspection & editing |

## Interaction & Pipeline Feedback

- **URL Input**: Paste URL and hit `Enter` or click "Snap URL".
- **Instant Optimistic Card**: Displays immediate card in "Capturing..." loading skeleton state while headless screenshot worker runs in background.
- **Card Click**: Opens inspection drawer (SCR-002) with full-size viewport screenshot.
- **Keyboard navigation**: `/` focuses search input, `Esc` dismisses preview drawer.
- **Delete action**: Requires confirmation before removal.

## Design Freeze

- Approved by: zen
- Approved on: 2026-10-13
- Scope frozen: Changes after this line require a CR or documented scope note.
