---
quick_id: 260825-vis3
slug: probability-bars
date: 2026-08-25
status: complete
tasks: complete
key-files:
  created:
    - src/ui/categoryShares.ts
    - src/ui/categoryShares.test.ts
    - src/ui/OddsTable.shareBars.test.tsx
    - src/ui/shareBars.guard.test.ts
  modified:
    - src/ui/OddsTable.tsx
    - src/ui/OddsPanel.tsx
    - src/App.css
    - src/ui/OddsTable.categoryIconCell.test.tsx
    - src/test/holdemTestids.ts
---

# Quick Task Summary — Probability bars + visible convergence (visual step iii)

> Authored by the orchestrator: the executing subagent was blocked by the harness from writing
> any file whose name contains "summary", so its report is transcribed here.

**One-liner:** The category distribution now reads as a shape, and convergence is something you
watch settle — without a single displayed digit ever being animated.

## What shipped

Column order is `[example hand] · Hand Category · Share · Probability · Locked In`. Each row
renders `.category-bar` (track) holding `.category-bar__fill`
(`data-testid="category-bar-{index}"`).

- **Relative-to-max widths.** A real Hold'em distribution runs ~17% down to ~0.003%; scaled
  against 100% that is one stub and nine invisible slivers. Scaled against the largest category,
  the column reads as the distribution's shape.
- **Convergence = one `transition: width 320ms ease-out`, and nothing else.** `formatPct` is
  called byte-identically to before, so no digit is ever tweened. This was a deliberate
  constraint: frozen v1 suites assert exact percentage textContent, and animating digits would
  have made them flaky.
- **Settled cue.** `OddsPanel` gains `odds-panel--settled` when `done && !pending &&
  trialsCompleted > 0` — all three terms derived from state the store already owned, no new
  field. The cue is a single brass hairline under the trial count, drawn with `box-shadow` so it
  cannot nudge the stats row. The `!pending` term is load-bearing: mid-animation every value is
  an em dash, and "these are final" under a row of dashes would be a lie.
- **Gate discipline (TBL-04).** `categoryShares()` zeroes every share under *exactly*
  `formatPct`'s em-dash condition, so the two columns cannot disagree. Asserted as an
  implication, not a coincidence.

## Verification

- Suite **1017 passed / 70 files** (939 baseline + 78); `tsc -b`, `eslint`, `npm run build` clean.
- **All seven guards mutation-tested** (mutation applied, suite run, reverted): deleting the
  transition, deleting the reduced-motion block, dropping the leader's accent, scaling by
  `trialsCompleted` instead of max, removing the pending short-circuit, letting `settled` ignore
  the gate, and removing `aria-hidden` — each caught, by 1 to 12 tests.
- Live browser (orchestrator, real Chromium): 10 bars render with One Pair leading at 100% and
  High Card at 42.6%; `transition: width 0.32s` present; at 200,000 trials the panel gains
  `odds-panel--settled` and the hairline paints `rgba(201,162,39,0.5) 0 1px 0`.

## Notable findings

1. **Vitest scans the whole file for the `@vitest-environment` pragma, not just the leading
   docblock.** A comment merely *mentioning* the pragma silently ran 34 rendering tests with no
   DOM. A warning is now written into that file.
2. **`ruleFor()`'s "split on `}`" idiom cannot distinguish a responsive override from a
   duplicated rule block.** A brace-matching `withoutMediaBlocks()` disambiguates; media queries
   are asserted separately.
3. Source-level pins live in a new node-environment `shareBars.guard.test.ts` rather than the
   jsdom suite, because `tsconfig.app.json` deliberately withholds Node ambient types from
   browser code (IMP-02) — matching the `engine/shoePath.guard.test.ts` convention.
4. `color-mix()` enters the codebase for the first time (once, for the track tint, keeping it a
   derivative of `--border` rather than a near-duplicate hex). Verified present and un-mangled
   in the production bundle.
5. The icon-cell guard's header assertion was strengthened rather than renumbered: a bare
   `toHaveLength` is exactly what would let a future column land in the wrong place silently.

## Deviations

1. SUMMARY.md written by the orchestrator (harness restriction, above).
2. `category-bar-0` registered in `HOLDEM_ONLY_TESTIDS`, which extends both DOM-absence sweeps
   for free — an improvement on `category-example-0`, which was never registered.
