# Design Notes

Why the interface looks the way it does. Read this before changing visual code.

## Foundations

| Token | Value | Used for |
|---|---|---|
| Canvas | `#F8F9FA` | Sidebar background |
| Surface | `#FFFFFF` with `border-zinc-200` | Cards, panels, chips |
| Field | `zinc-100`, no border; `zinc-200` while focused | Every form control |
| Ink | `zinc-900` | Headings, primary button background |
| Body text | `zinc-600` | Sidebar rows, input values |
| Muted | `zinc-400` | Placeholders, labels, metadata |
| Accent | emerald `#10B981` | Primary action, recovery, success |
| Danger | red `#DC2626` | Destructive actions |
| Pending | amber `#F59E0B` | Work in progress |

Typography is Plus Jakarta Sans throughout. UI copy is English.

## Colour carries meaning, nothing else does

This is the rule the rest of the design follows from.

- **Emerald** is the primary action (`Save Link`), a successful outcome, and recovery
  actions (visit a site, restore from trash, save a collection name).
- **Red** is reserved for destructive actions (delete, move to trash) and failed captures.
- **Amber** means work in progress (capture running).
- **Everything else is zinc.** Tags are monochrome pills; so are cards, chips and buttons.

A prior version hashed tag names into seven pastel hues. It was removed because the colours
carried no information: `#dev` was green and `#tools` blue purely by accident, and those hues
competed with the emerald and amber badges that *do* mean something.

## Responsive

The breakpoint is `lg` (1024px): at and above it the design is the fixed desktop board, below
it a phone layout.

- The sidebar becomes an off-canvas drawer with a scrim; it is `fixed` on mobile and returns
  to the normal flow at `lg` with `lg:static` plus `lg:translate-x-0`, so the CSS is the source
  of truth and no JS branch decides the layout.
- **Selecting an item does not close the drawer.** A collection that holds subcollections would
  otherwise hide them the instant you tapped it, so dismissing is explicit: tapping the scrim,
  `Esc`, or the browser Back gesture. There is no close icon — a phone user reaches for Back or
  taps the empty space. Opening the drawer pushes a history entry (and closing removes it) so
  Back closes the drawer instead of leaving the app. Opening a collection also scrolls its list
  into view on touch, after the height transition finishes.
- Cards drop to one column and scroll vertically. The 3×2 row template is applied only at `lg`
  (`lg:[grid-template-rows:repeat(2,minmax(0,1fr))]`); on smaller screens the card sizes itself
  and the screenshot area uses `aspect-[16/10]` instead of filling a fixed row.
- Pagination is a desktop affordance — six cards per page makes no sense on a phone, so the
  footer is `hidden lg:flex` and the phone list shows everything.
- The editor becomes a full-screen sheet: `rounded-none`, no outer padding, `h-full`, and a
  single column.
- **The drawer is exactly the viewport height and never scrolls.** The collection and tag lists
  take the leftover space (`flex-1 min-h-0`) and scroll internally, so the brand, the five views
  and the tag cloud never push each other out of view. Desktop is unchanged: the whole column
  scrolls and both lists keep their `max-h-40` cap.
- **Sections are capped at `max-h-fit`,** not `flex-1`. Growing them to share the leftover
  height reserved half of it even for an empty list, which left a large dead gap between
  "No collections yet" and Tags Cloud. `fit-content` lets a short section collapse to its own
  content while a long one still takes its share of the height and scrolls internally.
- The bookmarklet block is `hidden lg:block`: it needs a desktop bookmarks bar, so on a phone it
  is dead weight. Adding a link there goes through the `+` sheet.
- Sections of the drawer column are `shrink-0`: as flex items with `min-h-0` they were squeezed
  below their content height, which silently clipped subcollection rows.
- Adding a bookmark opens a **bottom sheet** on phones, behind a dark `+` button beside the
  search field. Two fields plus a submit button cannot share one line at 320px without each
  becoming unusably narrow, so the sheet stacks them full width and slides up over a scrim.
  It is the same `<form>` as the desktop inline row — only its positioning and direction change
  at `lg` — so there is one source of truth for the fields and the submit handler. The reveal animates — the row's height runs
  `0fr` → `1fr` while its content fades, the same technique as subcollections — and the
  collapsed fields are `inert` so they never take focus. On desktop the row is always
  visible and the wrapper is a plain block.

### Touch

Touch is detected with Tailwind's `pointer-coarse:` variant rather than a JS branch, so the
rules sit next to the styling they modify:

- **Hidden-until-hover is never allowed on touch.** Card actions, the favourite star and the
  collection row actions are all `pointer-coarse:opacity-100` (or `pointer-coarse:flex`). A
  control that only exists on hover does not exist at all on a phone.
- **Every interactive element is at least 44px on touch** via `pointer-coarse:min-h-11` /
  `min-w-11`. The desktop layout keeps its dense 20px icon buttons.
- **Every form control is 12px on every breakpoint.** iOS Safari would prefer 16px inputs, since
  it zooms the page when a smaller field takes focus, but a 16px field sitting between 12px list
  rows reads as a different component — most obviously in the sidebar, where "Collection name…"
  towered over the collections it belongs to. Matching the rows wins; pinch-zoom is one gesture
  away if the page zooms on focus.
- **A field's box matches what it replaces.** The sidebar's inline name fields use the row's own
  `px-3 py-1.5` and `pointer-coarse:min-h-11`, so entering and leaving rename mode does not jump
  the list: a row and its editing field are both 28px on desktop and 44px on touch.
- **Nothing renders below 11px on touch.** The desktop scale goes down to 9px for tag pills and
  metadata, which is unreadable on a phone, so those step up one or two sizes under
  `pointer-coarse:` — card tag pills 9→12px, card description 11→13px, counts and chips 10→11px,
  section labels 11→12px.
- **Drag-and-drop is disabled** (`draggable={!coarsePointer}`) because HTML5 drag events never
  fire for touch. Filing a bookmark into a collection goes through the editor's Collection
  field instead, which is one tap and works everywhere.

## Geometry

- Cards are a **uniform 3×2 grid**: six equal cards per page, no hero card, no asymmetric
  mosaic. Earlier revisions varied card sizes per page; uniform sizing is easier to scan and
  stops the eye from hunting for a pattern that is not meaningful.
- Every page holds exactly six items, so paging never changes the grid's shape.
- The footer row has a fixed height whether or not pagination controls are present, so
  switching views never shifts the cards.
- Corner radius is small and consistent: `rounded-lg` for controls, `rounded-2xl` for cards
  and panels.
- The whole app fits a 1920×1080 viewport with no page scrollbar.

## Inputs

One surface everywhere, published as `FIELD_CLASS` in `src/lib/ui.ts` and imported by every
control — sidebar new-collection and rename, header search, paste-link, tag, the editor's five
fields and the collection selector:

```
bg-zinc-100 rounded-lg  (no border)
text-zinc-600 placeholder:text-zinc-400
focus:outline-none focus:bg-zinc-200 transition-colors
```

**Fields are filled, never outlined.** With an outline the border doubles as the focus cue, so
the field you are typing in grows a second, darker border and stops looking like the field
beside it — in the add sheet that reads as two different components stacked on top of each
other. Deepening the fill on focus keeps every control identical at rest. Only padding is
per-field: leading icons use `pl-8`, a trailing chevron `pr-8`, the touch height is
`pointer-coarse:min-h-11` (or `h-11` in the header). Typed text is `text-xs` (12px) at every
breakpoint — the same size as the list rows and tag pills the fields sit beside.

## Motion

Motion exists to explain a state change, never to decorate.

| Event | Motion | Duration |
|---|---|---|
| Modal / drawer opens | Backdrop fades, panel scales 94%→100% and rises 12px | 300ms, expo-out |
| Modal / drawer closes | Reverse | 150ms |
| Toast | Slides down 12px and fades in, centred on the content column below the header | 200ms |
| Subcollection expand | Height `0fr`→`1fr` | 200ms |
| Collection / tag reorder | Items slide to their new positions (FLIP) | 220ms |
| Card hover | Rises 2px, shadow deepens | 200ms |
| Screenshot hover | Scales to 1.04 | 400ms |
| Button press | Scales to 0.95 | 150ms |

**Selection changes are instant.** Pills and rows switch state with no transition. A
cross-fade would show two dark pills at once while the old one fades out and the new one
fades in, which reads as a flicker. Only hover and press animate.

**Content does not fade on view switches.** Cards swap in a single commit. Per-card fades and
refetch dimming were both tried and removed: each made the grid flash light on every menu
change, because a card starting at `opacity: 0` reveals the white page behind it.

Entry animations need the element to be painted once in its hidden state first. `usePresence`
does that with two animation frames plus a forced reflow; without it the element is created
already active and no transition runs at all.

## States

| State | Treatment |
|---|---|
| First load | Skeleton cards mirroring the real card anatomy (screenshot area, title, description, tag pills, footer) |
| Empty | Snapshort logo, "No Bookmarks Found", one line of guidance |
| Queued | Spinner with "Queued..." — the capture is waiting for a free slot |
| Capturing | Spinner with "Capturing preview..." in the screenshot area |
| Failed capture | Globe icon, "Offline", retry available from the card and the editor |
| Capture off | Globe icon, "No preview"; no retry affordance |
| Trash | Cards keep all actions; delete becomes permanent after confirmation |

## Editor panel

The panel shows the screenshot and the editable fields only — title, collection, URL,
description, tags. Metadata that already appears elsewhere (domain, saved date, capture
status) is not repeated. Below the preview sit the two things found nowhere else: a
`Copy URL` action and the visit count.

The description field grows to fill the column, so the form always matches the height of the
preview and the panel has no dead space.

## Accessibility

- Focus is visible through the field fill deepening to `zinc-200`; every interactive element is
  a real `button`, `a`, `input`, `select` or `textarea`.
- Buttons replace the browser's default focus outline with a 2px `zinc-900/25` ring
  (`focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25`). The UA outline
  hugs a rounded button exactly, so it reads as an unintended border — most visibly after
  `Esc`, which the browser classifies as a keyboard interaction and therefore promotes the
  focused element to `:focus-visible`.
- Destructive actions always pass through an in-app confirmation dialog. `Esc` cancels it.
- Card action icons are hidden until hover, but also revealed by `group-focus-within`, so they
  remain reachable by keyboard.
- Body text meets WCAG AA contrast against its surface.
