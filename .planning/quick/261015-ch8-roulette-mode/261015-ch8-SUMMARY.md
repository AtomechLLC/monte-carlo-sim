---
quick_id: 261015-ch8
slug: roulette-mode
date: 2026-10-15
status: complete
tasks: 3/3
key-files:
  created:
    - src/engine/roulette.ts
    - src/engine/predictionScore.ts
    - src/state/rouletteStore.ts
    - src/ui/useProgressiveReveal.ts
    - src/ui/PredictionGauge.tsx
    - src/ui/RouletteGame.tsx
    - src/ui/RouletteTable.tsx
    - src/ui/RouletteWheel.tsx
    - src/ui/RouletteLayout.tsx
    - src/ui/RouletteControls.tsx
    - src/ui/RouletteOddsPanel.tsx
    - src/test/rouletteTestids.ts
    - src/engine/roulette.test.ts
    - src/engine/roulette.property.test.ts
    - src/engine/predictionScore.test.ts
    - src/state/rouletteStore.test.ts
    - src/ui/useProgressiveReveal.test.tsx
    - src/ui/RouletteTable.test.tsx
    - src/App.rouletteMode.test.tsx
  modified:
    - src/App.tsx
    - src/state/gameModeStore.ts
    - src/ui/GameModeSwitcher.tsx
    - src/index.css
    - src/App.css
    - src/App.modeShell.guard.test.ts
    - src/App.controlPlacement.test.tsx
    - src/state/gameModeStore.test.ts
    - src/ui/GameModeSwitcher.test.tsx
---

# Quick Task Summary — Roulette as a third game mode

> Executed inline by the orchestrator (the same arrangement the two previous quick summaries
> record), against the plan in 261015-ch8-PLAN.md.

**One-liner:** The switcher has a third segment. Pick a colour and/or a pocket on a real layout,
press Spin 100, and watch the batch land spin by spin — the hit count climbing, the hit rate
settling onto the true probability, the net at one unit a spin going where the house edge says it
will.

## What shipped

- **Two wheels, toggled from the session bar.** Single zero (37 pockets, edge 2.70%) and double
  zero (38, edge 5.26%), where the other games keep their deck count. The felt prints the
  consequence: `DOUBLE ZERO · 38 POCKETS · HOUSE EDGE 5.26%`. Switching discards the history (it
  was spun on a different wheel) and drops a `00` pick on the way back to single zero.
- **The felt is a rounded rectangle** (the Blackjack half-moon precedent — shape says which
  game), with an SVG wheel at the left drawn in the real clockwise pocket order, the classic
  3 × 12 layout with its zero column to the right, the three colour bets beneath, and Spin /
  Reset on the shared floating plate at bottom-left. The hub prints the last revealed pocket at
  the Display size and the ball sits in it.
- **The batch lands progressively.** `spin()` appends 100 results synchronously; a shared
  `useProgressiveReveal` hook walks a `revealed` cursor one spin per 24 ms. Under
  `prefers-reduced-motion` the whole batch lands at once, which is also what keeps every jsdom
  assertion synchronous. Leaving the mode mid-batch clears the pending step; coming back resumes.
- **Scoring is over the history, not baked into it**: changing the prediction re-scores the same
  spins. A colour and a number are scored as two independent cards, each with hit rate (hero),
  true odds, hits, expected hits, net units at one unit a spin, and a gauge whose fill chases an
  ivory mark at the true probability. A "Where the ball landed" table and a newest-first marquee
  of up to 100 dots show the whole distribution.
- **Shared pieces for craps (next):** `engine/predictionScore.ts` (hits, trials, probability,
  payout → observed, expected, net), `ui/useProgressiveReveal.ts`, `ui/PredictionGauge.tsx` —
  all pinned by the mode-shell guard to name no game and import no store.
- **The restore flags generalised**: `holdemRestorePending` / `blackjackRestorePending` now mark
  any switch INTO that game, so a roulette → Hold'em switch restores the table instantly instead
  of replaying the deal. The Phase 5/6 transitions are pinned unchanged.

## Verification

- Suite **1435 passed / 81 files** (1150 / 74 at baseline `a63606f`: +285 tests, +7 files);
  `tsc -b`, `eslint .`, `npm run build` clean.
- Seeded anchors: 2,000,000 spins per wheel, every pocket within ±0.06pp of its closed form
  (~5σ) and every colour within ±0.2pp; the per-pocket band is tight enough to catch a sampler
  using the wrong wheel size (a 0.07pp gap), and the distinct-pocket count catches it outright.
- Property suite: every target on either wheel has EV exactly `−(house edge)`; red + black +
  green hits account for every spin; every spin is a pocket of its wheel.
- Live browser (real Chromium at 1280 and 1600 wide): mode switch, idle copy, Red → Spin 100
  (16 spins revealed at 0.7 s, 84 at 3.2 s, 48.8% vs 48.6% at 84), 17 beside Red on double zero
  (6 of 96 → +120 units at 35:1), wheel toggle clearing the history and moving every true-odds
  figure, Spin carrying the lilac next-action glow; console clean throughout.

## Notable findings

1. **Motion's `useReducedMotion` reads the media query once per module and caches it**, so a
   per-test `matchMedia` swap changes nothing. The full-motion arm of the reveal-hook test mocks
   the hook at the module boundary instead (`vi.hoisted` + partial `vi.mock('motion/react')`).
2. **A timeout chain needs one `act` per step under fake timers**: each step re-runs the effect
   that arms the next timer, and one `act` flushes exactly one effect pass. The test's `tick()`
   helper steps per act — the honest model of what the browser does between frames.
3. **A pixel-sized grid overflowed the felt at the widths it actually renders.** The felt yields
   to the odds panel, so at a 1280px viewport it is 721px, not 1040 — the 596px grid plus the
   wheel ran under the panel. The layout is now fluid (66% of the felt, fractional tracks); the
   44px hit floor holds on the row and is met on the column from ~890px of felt upward.
4. **The marquee's max-content width starved the felt.** With `flex: 0 1 auto`, a flex item's
   basis is its max-content, and a hundred wrapped dots still contribute one line (~1500px) to
   it: the panel grew 496 → 690px as the history filled, the felt shrank to ~320px. A
   `max-width` on the roulette panel clamps the basis; the comment in App.css records the
   measurements.
5. **The control-placement census did its job**: its session-bar button count went 4 → 5 when
   the switcher gained a segment. Retargeted with the reason cited, kept exact.

## Deviations

- The spins run on the main thread, by design (PLAN decision 2): 100 integer draws, no worker,
  no streaming, no cache — the first game in the app without a simulation service. `pure-rand`
  is still the only RNG.
- `App.controlPlacement.test.tsx` was on the plan's do-not-touch list; the one count that
  encodes the switcher's segment count had to move with the switcher (finding 5).
