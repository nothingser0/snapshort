# SITEMAP.md — Snapshort (LITE)

## Screen inventory

| Screen ID | Route | Purpose | States needed |
| :--- | :--- | :--- | :--- |
| SCR-001 | `/` | Main Visual Dashboard & Bookmark Grid | 5-state (Default, Loading, Empty, Error, Success) |
| SCR-002 | `/?preview=:id` (Modal/Drawer) | Quick Visual Inspection Drawer & Metadata Edit | Default, Loading, Error, Success |

*Rule: Small MVP single-page bento dashboard. Core workflow lives on SCR-001 with inspection/edit drawer on SCR-002.*

## Navigation

- **Desktop**: Left fixed sidebar (Logo, All Bookmarks, Collections/Tags, Quick Capture shortcut) + Top search & quick-add input bar.
- **Mobile**: Responsive top bar with search toggle + floating action button (FAB) for "+ Add URL".

## Screen details

### SCR-001 — Main Visual Bookmark Dashboard
- **Entry points**: Direct navigation to `/`.
- **Primary action**: Paste URL to save and trigger screenshot capture; browse visual preview cards; filter/search by keywords or tags.
- **Data shown**:
  - Filter header: Search input, tag filter pills, total count.
  - Quick-add bar: URL input field + "Snap URL" button.
  - Bento Grid: Cards with screenshot thumbnail, page title, domain favicon, URL, tags, captured timestamp, status pill (pending / ready / failed).
- **Empty state**: "No bookmarks saved yet. Paste your first URL to generate an instant visual preview!" with CTA button focusing input.
- **Error state**: "Unable to load bookmarks. Retry" button with error toast notification.

### SCR-002 — Bookmark Detail & Preview Drawer (Modal)
- **Entry points**: Click bookmark card on SCR-001.
- **Primary action**: Inspect high-res preview screenshot, open destination URL, edit title/tags, or re-trigger capture.
- **Data shown**: Full high-res viewport screenshot, full URL, editable title, tag list, capture logs/status, "Visit Site" link.
- **Empty/Error state**: Fallback placeholder graphic if screenshot failed + "Retry Capture" button.
