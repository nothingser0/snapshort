# Design Reference Notes — Small Path (LITE)

## Selected Benchmark ("paling OK")

- **Reference file**: `docs/design/inspiration/reference-bento.png`
- **Benchmark**: Mindscope Bento-Grid Dashboard (Modern Soft Bento Layout)
- **Why this one**: High visual density, distinct card modules, soft rounded corners, light low-fatigue background, clear sidebar + header split ideal for bookmark gallery and quick preview inspection.
- **Source**: User provided reference design image (`reference-bento.png`)

## Extracted palette

- **Primary**: `#18181B` (Dark pill / high-contrast focus)
- **Accent**: `#10B981` (Soft mint/emerald highlights `#D1FAE5` surface) / `#F59E0B` (Warm amber accents)
- **Neutrals**: bg `#F4F5F7` / surface `#FFFFFF` / border `#E5E7EB` / muted text `#6B7280` / text `#111827`
- **Semantic**: success `#059669` / error `#EF4444` / warning `#F59E0B`

## Extracted rules (keep it short)

- **Typography**: Inter / Plus Jakarta Sans, body 14px, headings 18px–24px semibold
- **Spacing base**: 8px grid (8px, 16px, 24px)
- **Radius**: buttons 24px (pill) or 12px, cards 16px–24px (rounded-2xl)
- **Shadows**: subtle `0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)`
- **Layout**: Collapsible left sidebar (navigation, collections, tags), top header (search bar, quick action button), bento/masonry grid for bookmark cards with visual screenshot previews.

## Logo alignment

- **Logo core hex**: `#10B981` (Snapshort camera shutter emerald)
- **Harmonization**: Soft neutral background with crisp high-contrast cards and emerald action triggers.

## Anti-patterns (from benchmark comparison)

- No harsh borders or pure black `#000000` text.
- Maintain contrast ≥ 4.5:1 on muted text against card backgrounds.
- Avoid cluttered cards: thumbnail screenshot must dominate the top 60% of each bookmark card, metadata stays clean below.
