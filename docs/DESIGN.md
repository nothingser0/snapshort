# Design Notes

Why the interface looks the way it does. Read this before changing visual code.

## Foundations

| Token | Value | Used for |
|---|---|---|
| Canvas | `#F8F9FA` | Sidebar background |
| Surface | `#FFFFFF` with `border-zinc-200` | Cards, inputs, panels |
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

One shape everywhere — sidebar new-collection, header search, paste-link, tag, and all editor
fields:

```
rounded-lg  px-3 py-2  border border-zinc-200
text-xs font-medium text-zinc-600 placeholder:text-zinc-400
focus:border-zinc-300 focus:outline-none
```

Typed text is `zinc-600` (matching sidebar rows); placeholders are one step lighter at
`zinc-400`. Inputs with a leading icon use `pl-8`; a trailing icon (select chevron) uses `pr-8`.

## Motion

Motion exists to explain a state change, never to decorate.

| Event | Motion | Duration |
|---|---|---|
| Modal / drawer opens | Backdrop fades, panel scales 94%→100% and rises 12px | 300ms, expo-out |
| Modal / drawer closes | Reverse | 150ms |
| Toast | Slides up 12px and fades in | 200ms |
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
| Capturing | Spinner with "Capturing preview..." in the screenshot area |
| Failed capture | Globe icon, "Offline", retry available from the card and the editor |
| Trash | Cards keep all actions; delete becomes permanent after confirmation |

## Editor panel

The panel shows the screenshot and the editable fields only — title, collection, URL,
description, tags. Metadata that already appears elsewhere (domain, saved date, capture
status) is not repeated. Below the preview sit the two things found nowhere else: a
`Copy URL` action and the visit count.

The description field grows to fill the column, so the form always matches the height of the
preview and the panel has no dead space.

## Accessibility

- Focus is visible through the input border colour change; every interactive element is a
  real `button`, `a`, `input`, `select` or `textarea`.
- Destructive actions always pass through an in-app confirmation dialog. `Esc` cancels it.
- Card action icons are hidden until hover, but also revealed by `group-focus-within`, so they
  remain reachable by keyboard.
- Body text meets WCAG AA contrast against its surface.
