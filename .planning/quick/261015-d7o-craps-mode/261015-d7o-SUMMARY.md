---
quick_id: 261015-d7o
slug: craps-mode
date: 2026-10-15
status: complete
tasks: 3/3
key-files:
  created:
    - src/engine/craps.ts
    - src/state/crapsStore.ts
    - src/ui/CrapsGame.tsx
    - src/ui/CrapsTable.tsx
    - src/ui/CrapsDice.tsx
    - src/ui/crapsTrialText.ts
    - src/ui/CrapsLayout.tsx
    - src/ui/CrapsControls.tsx
    - src/ui/CrapsOddsPanel.tsx
    - src/test/crapsTestids.ts
    - src/engine/craps.test.ts
    - src/engine/craps.property.test.ts
    - src/state/crapsStore.test.ts
    - src/ui/CrapsTable.test.tsx
    - src/App.crapsMode.test.tsx
  modified:
    - src/engine/predictionScore.ts
    - src/engine/predictionScore.test.ts
    - src/App.tsx
    - src/state/gameModeStore.ts
    - src/ui/GameModeSwitcher.tsx
    - src/App.css
    - src/App.modeShell.guard.test.ts
    - src/App.controlPlacement.test.tsx
    - src/App.rouletteMode.test.tsx
    - src/state/gameModeStore.test.ts
    - src/ui/GameModeSwitcher.test.tsx
---

# Quick Task Summary — Craps as a fourth game mode

> Executed inline by the orchestrator, against the plan in 261015-d7o-PLAN.md, immediately
> after 261015-ch8 (roulette) and on the shared pieces that task built for exactly this.

**One-liner:** The switcher has a fourth segment. Pick one of seven bets on a real craps layout,
press Roll 100, and watch a hundred decisions land one at a time — the win rate settling onto
the closed form, the pushes counted where a bet can push, and underneath it all the dice-total
triangle filling in roll by roll.

## What shipped

- **Seven bets, each a closed form the tests pin three ways.** Pass line (244/495), Don't pass
  (949/1980 with the come-out 12 a push), Field (16/36, 2 double, 12 triple or double by house
  rule), Any seven (6/36 at 4:1), Any craps (4/36 at 7:1), Place 6 and Place 8 (5/11 at 7:6).
  Every win probability, push probability and expected value is an exact-value test; every
  resolution rule is exercised roll by roll with a scripted dice queue; and seeded anchors
  (500,000 decisions per bet) hold win rates within ±0.35pp, the push rate within ±0.12pp and
  the mean net within a per-bet band of the EV.
- **A decision, not a roll, is the trial.** Pass, Don't pass and the Place bets ride through a
  come-out and a point; the three single-roll bets settle at once. The dice show the last roll
  of the last revealed decision; the badge beneath them spells the decision out
  ("Point 9 · 6 · 9 — loss"); the odds panel counts decisions AND rolls.
- **The Field's 12 is the explorable house rule**, toggled from the session bar where the other
  games keep their shoe or wheel: triple (edge 2.78%) or double (5.56%). It discards a Field
  history and leaves every other bet's history alone.
- **Shared pieces, consumed not copied:** `useProgressiveReveal`, `PredictionGauge`,
  `categoryShares` for the triangle's bars, and `predictionScore` — which gained a `pushes`
  count and a `scoreTallied` entry point for bets with pushes or outcome-dependent payouts, and
  a one-decimal `formatSignedUnits` form for the 7:6 place payout.
- **The felt** is a rounded rectangle with the layout read top to bottom in three rows (place
  boxes with 6 and 8 pressable and the other four drawn inert; the Field beside the two
  propositions; Don't pass beside Pass line), two SVG dice with real pips, and Roll / Reset on
  the shared floating plate.

## Verification

- Suite **1762 passed / 86 files** (1435 / 81 after roulette: +327 tests, +5 files); `tsc -b`,
  `eslint .`, `npm run build` clean.
- Live browser (real Chromium, 1280-wide viewport, 661px felt): Pass line → Roll 100 (96 of 100
  landed at 3.2 s, 45 wins, 376 rolls, 7s at 14.6% against 16.7%), Don't pass (46 of 96,
  1 push, 47.9% against 47.9%), the dice and the decision badge tracking the latest decision,
  Roll in lilac; the re-flowed layout ends at y 280 against a plate top of y 308.

## Notable findings

1. **Five stacked bars did not fit the felt the app actually renders.** A literal top-to-bottom
   reading of the table (place row, Field, propositions, Don't pass, Pass line) measured 285px
   tall; at the 661px felt a 1280px viewport produces, the stack reached the rail and ran under
   the Roll / Reset plate. Three rows on a 12-column grid (Field 6 / propositions 3 + 3 / line
   bets 6 + 6) measure 188px and clear the plate by 28px at that width and by ~200px at the
   reference. The place-box floor dropped 56 → 48 in the same pass.
2. **`react-refresh/only-export-components` is a real gate here.** `describeTrial` started life
   as a named export of `CrapsDice.tsx` and failed lint; it now lives in `ui/crapsTrialText.ts`.
   The move itself produced one transient Vite HMR failure between two edits ("Identifier
   'describeTrial' has already been declared"), which a reload cleared — the dev-server log shows
   the invalidate-then-recover sequence.
3. **Two roulette-era pins fixed the switcher at three segments** (`App.rouletteMode.test.tsx`,
   `GameModeSwitcher.test.tsx`), plus the control-placement census at 5. All three retargeted
   with the reason cited, kept exact, as the roulette task did for the move from 2 to 3.

## Deviations

- `src/ui/crapsTrialText.ts` was not in the plan's file list — it exists only because of finding 2.
- The craps rules line reuses `.roulette-rules` (co-applied as `craps-rules` for a future hook)
  rather than duplicating the declarations — the selector-list-over-duplication convention.
