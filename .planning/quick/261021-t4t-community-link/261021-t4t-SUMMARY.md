---
quick_id: 261021-t4t
slug: community-link
date: 2026-10-22
status: complete
tasks: 1/1
key-files:
  created:
    - src/ui/CommunityLink.tsx
    - src/ui/CommunityLink.test.tsx
  modified:
    - src/App.tsx
    - src/App.css
    - src/index.css
---

# Quick Task Summary — Funsmith Club link in the top-right corner

> Executed inline by the orchestrator, against 261021-t4t-PLAN.md.

**One-liner:** The Discord mark and "Funsmith Club" sit in the page's top-right corner on every
screen, open https://funsmith.club in a new tab, and never push anything down.

## What shipped

- `ui/CommunityLink.tsx`, rendered from the shell beside the wordmark so all four modes show
  it. Pinned against `#root` (now `position: relative`) at 16px from the top and right edge of
  the centred page column.
- The mark is the Simple Icons Discord glyph, inline and filled with `currentColor` — link and
  glyph brighten together on hover and focus, and no new colour enters the palette. The link
  carries the accessible name "Funsmith Club on Discord" (label-in-name holds) and the glyph is
  decorative.
- Below the 1024px column breakpoint the label hides and the mark stays in the corner alone;
  the wordmark takes 56px of side padding so the two cannot collide when the title wraps.

## Verification

- Suite **1770 passed / 87 files** (+8 tests, +1 file); `tsc -b`, `eslint .`, `npm run build`
  clean.
- Live browser: at 1280 wide the link sits 16px from the top and right, 44px tall, beside the
  centred wordmark; at the 935px pane it is the 36px icon alone, 17px in from the right, clear
  of the wordmark's text (714 vs 867), with the title and the session bar at exactly the
  positions they had before the link existed (16 and 174).

## Notable findings

1. **Name-from-content through an SVG `<title>` computed to an empty accessible name** in both
   jsdom and the browser's own accessibility tree. The link now names itself with `aria-label`
   and the glyph is `aria-hidden`.
2. **The first draft dropped the link into the flow under the title at narrow widths**, which
   pushed the page down — the user asked for the corner at every width. The responsive form now
   drops the words, not the placement, and the test pins that no rule ever makes it static.
