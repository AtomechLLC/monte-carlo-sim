---
phase: 03-casino-table-ui-animation
plan: 02
subsystem: ui
tags: [react, css, absolute-positioning, accessibility, disclosure-pattern]

# Dependency graph
requires:
  - phase: 03-casino-table-ui-animation (plan 01)
    provides: PlayingCard/CardBack card-code-to-art bridge, card-slot width tokens, vendored SVG deck
provides:
  - TableScene/Seat/OddsPanel components — the felt oval composition root, hero/opponent seat
    markup (extracted from HandDisplay), and the off-felt odds dock
  - Recomposed App.tsx: control bar (Deal/Set Up Scenario/StreetControls), scenario disclosure,
    table-row (TableScene + OddsPanel siblings)
  - Felt palette, z-index scale (--z-felt..--z-in-flight), oval/seat/community/deck absolute
    positioning CSS, dashed placeholder treatment (UI-SPEC A8)
affects: [03-03 (deal/flip/reveal animation choreography — will apply --z-in-flight and animate
  within the seat/community/deck geometry established here)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seat.tsx: discriminated-union props (variant: 'hero' | 'opponent') for one component
      covering both seat kinds, with the opponent branch's testid/disabled/aria-label/title
      contract preserved byte-for-byte from Phase 1-2"
    - "HandDisplay/BoardDisplay return Fragments/single root divs (no extra wrapper), so their
      seat/community elements land as direct children of .felt for CSS absolute positioning"
    - "Disclosure pattern: aria-expanded + aria-controls on a toggle button, collapsed-by-default
      local useState, conditionally-rendered content wrapped in a div carrying the controlled id"
    - "CSS: position:absolute + percentage top/left/transform anchored to a position:relative
      ancestor (.felt), never CSS Grid, per RESEARCH Pattern 1"

key-files:
  created:
    - src/ui/Seat.tsx
    - src/ui/Seat.test.tsx
    - src/ui/TableScene.tsx
    - src/ui/TableScene.test.tsx
    - src/ui/OddsPanel.tsx
  modified:
    - src/ui/HandDisplay.tsx
    - src/ui/BoardDisplay.tsx
    - src/App.tsx
    - src/App.test.tsx
    - src/App.acceptance.test.tsx
    - src/App.css
    - src/index.css

key-decisions:
  - "HandDisplay/BoardDisplay drop their generic wrapping <div> (Fragment for HandDisplay,
    .community-area div directly as BoardDisplay's root) so seat-hero/opponents/community-area/
    deck-origin all land as direct children of TableScene's .felt div — required for the
    Table Geometry CSS's percentage-based absolute positioning to anchor correctly"
  - "Hero pre-deal placeholders use a CSS :empty selector on the existing empty .card-slot--hero
    span rather than a new DOM element — the span already renders unconditionally, so no
    markup change was needed, only a dashed-box style for the empty state"
  - "Community pre-deal/pre-street placeholders ARE explicit sibling divs (not :empty, since
    board-cards only ever contains visible-card children) — BoardDisplay renders
    BOARD_SIZE - visibleBoard.length placeholder divs after board-cards/board-empty-state"
  - "Deal button (no existing testid) gets its 44px hit area via a `.control-bar > button`
    structural selector rather than adding a new testid to DealButton.tsx, which is outside
    this plan's files_modified scope"
  - "Set Up Scenario's aria-controls id lives on an App-owned wrapper div around <CardPicker />,
    not inside CardPicker.tsx itself — keeps CardPicker's internals/testid untouched per the
    plan's explicit constraint"

patterns-established:
  - "Felt-scene CSS section in App.css: layout classes (.felt, .seat*, .community-area,
    .deck-origin, .seat-label, .card-placeholder, .visually-hidden, .control-bar, .table-row)
    coexist with the existing testid-scoped-selector convention where a testid isn't natural
    for pure-layout geometry"
  - "z-index scale (--z-felt=0, --z-deck=1, --z-seat=2, --z-seat-label=3, --z-in-flight=50)
    declared once in index.css :root, applied progressively as layers are built; --z-in-flight
    is declared now but deliberately unused until 03-03's animation work"

requirements-completed: [TBL-01]

# Metrics
duration: ~16min
completed: 2026-08-24
---

# Phase 3 Plan 02: Casino Table Composition Summary

**Felt oval table scene (TableScene/Seat/OddsPanel) replacing the flat Phase 1-2 stack, with a Set Up Scenario disclosure, an off-felt odds dock, and full absolute-positioning CSS geometry — 150/150 tests green (129 baseline + 21 new), zero regressions, one justified test adjustment.**

## Performance

- **Duration:** ~16 min
- **Completed:** 2026-08-24
- **Tasks:** 3 completed (all `type="auto"`, Task 1 was TDD)
- **Files modified/created:** 12 (5 new: Seat.tsx/.test.tsx, TableScene.tsx/.test.tsx, OddsPanel.tsx; 7 modified: HandDisplay.tsx, BoardDisplay.tsx, App.tsx, App.test.tsx, App.acceptance.test.tsx, App.css, index.css)

## Accomplishments

- Extracted the opponent-seat markup into `Seat.tsx` (hero + opponent variants via a discriminated union prop), preserving the Phase 1-2 `data-testid`/`disabled`/`onClick`/`aria-label`/`title` contract byte-for-byte — `HandDisplay` becomes the pure seat-data source, mapping `OPPONENT_COUNT` into `<Seat variant="opponent">` plus one `<Seat variant="hero">`
- `BoardDisplay` now wraps its existing branch in a `.community-area` container, visually hides the `<h2>Board</h2>` landmark heading, and appends `BOARD_SIZE - visibleBoard.length` dashed placeholder siblings so the community row always shows 5 slots (UI-SPEC A8)
- `TableScene` is a pure layout shell (no store reads) composing `HandDisplay` + `BoardDisplay` + a 3-`CardBack` `deck-origin` stack inside the `table-scene`/`.felt` root
- Recomposed `App.tsx`: a `control-bar` (Deal, the new "Set Up Scenario" disclosure toggle, StreetControls), the conditionally-rendered `CardPicker`, and a `table-row` housing `TableScene` + the new `OddsPanel` as siblings (D-05 — odds never nested inside the felt) — the odds-gating `useEffect` is verified byte-for-byte untouched via `git diff`
- Full felt-scene CSS: oval geometry (`position:absolute` + percentages anchored to `.felt`, never grid, per RESEARCH Pattern 1), seat/community/deck placement, seat-label badges, dashed placeholder boxes, a 2px-staggered deck-origin stack, the `.visually-hidden` utility, and a z-index scale (`--z-felt`/`--z-deck`/`--z-seat`/`--z-seat-label`/`--z-in-flight`, the last reserved for 03-03)
- Retired the scaffold `h1` (56px/weight 500) for the Display role (32px/600/1.2, UI-SPEC A6) — after this change, `font-weight: 500` appears nowhere in `index.css` or `App.css`

## Task Commits

1. **Task 1: Seat and TableScene — the felt composition with every testid preserved** - `4c43f6b` (feat, TDD)
2. **Task 2: Recompose App — control bar, Set Up Scenario disclosure, off-felt odds panel** - `e18b7f1` (feat)
3. **Task 3: Felt palette, oval geometry, seat placement and z-index tokens** - `47c7f5f` (feat)

## Files Created/Modified

- `src/ui/Seat.tsx` - Hero + opponent seat variants; opponent branch is a verbatim extraction of the prior `HandDisplay` button markup
- `src/ui/Seat.test.tsx` - 9 tests: hero-hole child counts, opponent disabled/enabled states, revealed aria-label, decorative alt, aria-hidden badge placement, no-leak assertion (T-03-06)
- `src/ui/TableScene.tsx` - Felt root composing `HandDisplay` + `BoardDisplay` + deck-origin, zero store reads
- `src/ui/TableScene.test.tsx` - 8 tests: child counts before/after deal, deck-origin aria-hidden/empty text, revealed seat aria-label via fabricated runout, badge aria-hidden split, flop board-cards + placeholder counts
- `src/ui/OddsPanel.tsx` - Wraps `WinTieLossDisplay` + `OddsTable` unchanged, docked outside the felt
- `src/ui/HandDisplay.tsx` - Now the seat data source: maps `OPPONENT_COUNT` + hero into `<Seat>` instances
- `src/ui/BoardDisplay.tsx` - `.community-area` wrapper, visually-hidden `<h2>`, dashed placeholder siblings
- `src/App.tsx` - Control bar, Set Up Scenario disclosure (`useState` + `aria-expanded`/`aria-controls`), `table-row` with `TableScene`/`OddsPanel`; `useEffect` untouched
- `src/App.test.tsx` - 4 new tests: disclosure default/toggle state, stable button label, A7 empty-state copy, odds-panel/table-scene sibling separation
- `src/App.acceptance.test.tsx` - One adjusted test (documented below); opens the disclosure before its first `picker-slot-hero-0` click
- `src/App.css` - New felt-scene CSS section (oval, seat/community/deck placement, badges, placeholders, deck stack, control-bar/table-row, z-index assignment)
- `src/index.css` - Felt/rail/badge color tokens, z-index scale, Display-role `h1`, weight-500 retirement

## Decisions Made

- `HandDisplay` returns a Fragment (no wrapping `<div>`) and `BoardDisplay`'s root IS the `.community-area` div — both changes were needed so `seat-hero`/`opponents`/`community-area`/`deck-origin` land as direct children of `.felt`, matching the plan's `target_dom` and letting the Table Geometry CSS's percentage-based absolute positioning anchor correctly against a single positioned ancestor.
- Hero pre-deal placeholders reuse the existing empty `.card-slot--hero` span via a `:empty` CSS selector rather than adding new placeholder markup — the span already renders unconditionally in both `Seat.tsx`'s hero branch, so no DOM change was needed.
- Community placeholders are explicit sibling `<div>`s (not `:empty`-driven) because `board-cards` only ever contains visible-card children — `BoardDisplay` renders `BOARD_SIZE - visibleBoard.length` placeholder divs as siblings of `board-cards`/`board-empty-state`, never inside `board-cards` (preserves the existing acceptance-test assumption that `board-cards`' child count equals the visible card count).
- `DealButton` has no existing testid and is outside this plan's `files_modified` list, so its 44px hit area comes from a `.control-bar > button` structural selector (also covers the new Set Up Scenario button) rather than adding a testid to `DealButton.tsx`.
- The Set Up Scenario disclosure's `aria-controls` id lives on an App-owned wrapper `<div id="card-picker">` around the conditionally-rendered `<CardPicker />`, not inside `CardPicker.tsx` — keeps `CardPicker`'s internals and its own `data-testid="card-picker"` completely untouched, per the plan's explicit constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded a `TableScene.tsx` doc comment that was tripping its own acceptance-criteria grep**
- **Found during:** Task 1, running the acceptance-criteria check `grep -c "STREET_BOARD_COUNT" src/ui/TableScene.tsx` (must be 0)
- **Issue:** A doc comment explaining why `TableScene` reads no store state itself literally contained the substring `STREET_BOARD_COUNT` as an illustrative example, so the grep guard (designed to catch a real visibility-logic duplication regression) matched the comment instead.
- **Fix:** Reworded the comment to describe the same rationale ("per-street card-count logic") without the literal disallowed substring.
- **Files modified:** `src/ui/TableScene.tsx`
- **Verification:** `grep -c "STREET_BOARD_COUNT" src/ui/TableScene.tsx` now returns `0`; no functional code change.
- **Committed in:** `4c43f6b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (comment rewording only, no functional change).
**Impact on plan:** None on scope. Necessary to satisfy the plan's own stated acceptance criteria.

## Issues Encountered

- **No browser/screenshot tool available in this executor context:** Task 3's acceptance criteria call for a manual `npm run dev` visual check at 1440px and 1024px widths. This environment has no computer-use or browser MCP tool available to the executor, so the visual check was performed as a best-effort structural verification instead: (1) the dev server was started and confirmed to serve the app without errors, (2) the production build was inspected directly — `dist/assets/index-*.css` was grepped to confirm the `.felt` rule (oval geometry, radial-gradient, box-shadow rail, absolute positioning) compiled correctly into the bundle, and (3) the full component test suite (which asserts DOM structure, class names, and child counts for every felt-scene element) passed. A human visual pass at both breakpoints is recommended before this phase is considered visually verified, though no structural or CSS-authoring issue was found.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `--z-in-flight` is declared in `index.css` but intentionally unused — plan 03-03 (deal/flip/reveal animation choreography) applies it to cards mid-animation.
- `.seat-hero`/`.seat-opponent-{0,1,2}`/`.community-area`/`.deck-origin` all have their final percentage-based positions locked in; 03-03's Motion choreography can animate cards INTO these positions without needing further geometry changes.
- The `pendingAnimationCount` gate (D-11/D-12, TBL-04) is NOT yet implemented — `useEffect`'s odds-gating logic in `App.tsx` is unchanged from Phase 2 and still has no animation dependency. This is explicitly out of scope for 03-02 and is 03-03's responsibility.
- `motion` is still not installed — correctly deferred to 03-03 per the phase's threat model (`T-03-SC`).
- `index.html`'s `<title>scaffold-tmp</title>` (D-14 cosmetic debt) remains unchanged — confirmed not in this plan's `files_modified` list; still deferred to a later 03-xx plan.

## Self-Check: PASSED

All created files verified present on disk (`src/ui/Seat.tsx`, `src/ui/Seat.test.tsx`, `src/ui/TableScene.tsx`, `src/ui/TableScene.test.tsx`, `src/ui/OddsPanel.tsx`). All three task commit hashes (`4c43f6b`, `e18b7f1`, `47c7f5f`) verified present in `git log`. Full suite: 150/150 tests passing, `tsc -b` clean, `eslint .` clean, `npm run build` succeeds.

---
*Phase: 03-casino-table-ui-animation*
*Completed: 2026-08-24*
