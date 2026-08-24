---
phase: 06-blackjack-core-odds-loop
plan: 05
subsystem: ui
tags: [typescript, react, motion, vitest, blackjack, animation-gate, css]
status: complete

# Dependency graph
requires:
  - phase: 06-blackjack-core-odds-loop
    plan: 02
    provides: "blackjackHandValue rules engine (handTotal/isNatural), blackjackConditioning types (PredeterminedBlackjackRound, BlackjackOutcome)"
  - phase: 06-blackjack-core-odds-loop
    plan: 04
    provides: "useBlackjackStore round lifecycle with balanced gate accounting, blackjackRestorePending + ackBlackjackRestore on gameModeStore"
  - phase: 03-casino-table-ui-animation
    provides: "PlayingCard/CardBack/FlipCard/AnimatedCard presentation stack, useAnimationGate, tableGeometry dealOriginOffset, felt CSS"
provides:
  - src/ui/BlackjackTable.tsx — felt composition root with the CR-02-safe prevRef gate release over (roundNonce, playerHand.length, roundPhase, revealedHole)
  - src/ui/BlackjackDealerArea.tsx — upcard, hole FlipCard inside the blackjack-hole-reveal button, playout draws, A11 dealer total badge
  - src/ui/BlackjackPlayerArea.tsx — growing hand row with casino-order deal indices, A11 player total badge
  - src/ui/BlackjackOutcomeBanner.tsx — eight-path locked-copy banner, role=status, gated on resolved AND gate-clear
  - src/ui/AnimatedCard.tsx — restore-mount flag read generalized to the active mode (one selector line)
  - src/App.css + src/index.css — the COMPLETE Phase 6 CSS contract (felt geometry, banner, odds cluster for 06-06, controls for 06-07, --z-outcome token)
affects: [06-06, 06-07, 06-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CR-02-safe release copied from the FIXED TableScene: prevRef over four tracked deps, early return when all unchanged, no cleanup function — mount/StrictMode/switch-back release zero units, every real action releases exactly one"
    - "Natural-deal hole choreography: FlipCard mounts already face-up on a resolution-at-deal (mountedFaceUp suppresses the flip, no flip unit armed), commented at the call site so a future reader does not 'fix' it into a gate-double-counting two-step"
    - "Explicit numeric deal indices instead of the Hold'em dealIndex() helper: casino order 0/1/2/3, playout draw i at 5 + i * 2.5 (A12 pacing through AnimatedCard's existing 0.08s * dealIndex arithmetic, zero shared-constant changes)"
    - "One CSS owner per phase: 06-06/06-07 emit class names defined here and write no CSS; deck toggle EXTENDS the game-mode-switcher selectors rather than duplicating declarations (A4)"

key-files:
  created:
    - src/ui/BlackjackTable.tsx
    - src/ui/BlackjackDealerArea.tsx
    - src/ui/BlackjackPlayerArea.tsx
    - src/ui/BlackjackOutcomeBanner.tsx
    - src/ui/BlackjackTable.test.tsx
  modified:
    - src/ui/AnimatedCard.tsx
    - src/App.css
    - src/index.css

key-decisions:
  - "Dealer/player area files were created as minimal shells (idle placeholders + badges) in Task 2 so the composition root compiles, then completed in Task 3 — one extra intermediate state, no scope change (both files are in the plan's files_modified)"
  - "BlackjackOutcomeBanner carries x:'-50%' in its Motion initial/animate: Motion's animated y writes an inline transform that would clobber the stylesheet's translateX(-50%) centring; carrying x composes both"
  - "Banner path derivation reads round.dealerHole for OUTCOME display only — the banner exists only when resolved, and every resolution path sets revealedHole in the same commit, so the D-02 hidden-hole boundary is never crossed (documented in the component header)"

patterns-established:
  - "Blackjack card keys: player-{slot}-{roundNonce}, dealer-up-{roundNonce}, dealer-hole-{roundNonce}, dealer-playout-{i}-{roundNonce} — role + slot + nonce, never card identity"
  - "Blackjack badges are NOT aria-hidden (deliberate divergence from Seat.tsx's opponent badge, commented in both areas): the Dealer/You context and live A11 totals are not duplicated elsewhere"

requirements-completed: [BJ-02, BJ-05, BJ-06]

# Metrics
duration: 18min
completed: 2026-08-24
---

# Phase 6 Plan 05: Blackjack Felt Composition Summary

**The full Blackjack felt — CR-02-safe composition root, dealer/player areas with a provably-DOM-absent hidden hole and one-way reveal, the eight-path locked-copy outcome banner, and the phase's complete CSS contract (including every class plans 06-06/06-07 will emit) — pinned by 28 new tests.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-24T22:19:13Z (base-commit verification `d2bb22c` + npm ci in fresh worktree)
- **Completed:** 2026-08-24T22:37Z (final gate)
- **Tasks:** 4 (Tasks 1-3 RED→GREEN verified in-session before each commit)
- **Files modified:** 8 (5 created, 3 modified)

## Release-Effect Tracked-Dep Tuple (recorded per the plan's output spec)

`prevRef` tracks **`{ roundNonce, playerHandLength, roundPhase, revealedHole }`** — the exact tuple 06-04's arm-count invariant test scripted. Mapping to every `beginAnimation()` call site in `blackjackStore`:

| Store action | Arms | Tracked dep(s) changed in the same set() tick | Releases |
|---|---|---|---|
| `deal()` | 1, unconditionally (incl. natural-resolved deals) | `roundNonce` always; usually also hand length/phase/hole | exactly 1 |
| `hit()` (non-bust) | 1, guarded on player-turn | `playerHand.length` | exactly 1 |
| `hit()` (bust) | 1 | `playerHand.length` AND `roundPhase` AND `revealedHole` — one commit, still ONE release (pinned by the two-armed-units test) | exactly 1 |
| `stand()` | 1, guarded | `roundPhase` AND `revealedHole` | exactly 1 |
| `revealHole()` | 1, guarded on player-turn && !revealedHole | `revealedHole` | exactly 1 |
| `setDeckCount()` | never arms | changes no tracked dep | 0 |

No cleanup function on the effect (a compensating cleanup would drift +1 on every later real transition); mount, StrictMode double-invoke, and mode switch-back re-mount all release zero (each pinned by a test that pre-arms stand-in units and asserts they survive).

## Playout dealIndex Arithmetic (recorded per the plan's output spec)

`AnimatedCard` computes `delay = 0.08 * dealIndex` (the shared, untouched constant). Values passed:
- Initial deal, casino order: player-0 = **0**, dealer upcard = **1**, player-1 = **2**, dealer hole = **3**.
- Hit card: `playerHand.length - 1`, which at mount equals its own slot index (implemented as slot; only ever mounts as the newest card).
- Playout draw i: **`5 + i * 2.5`** → 0.08 x 5 = 400 ms (the hole-flip offset), 0.08 x 2.5 = 200 ms between successive draws — exactly A12, with zero changes to Hold'em's timing constants. Constants named `PLAYOUT_BASE_DEAL_INDEX` / `PLAYOUT_DRAW_STRIDE` with the arithmetic comment at the definition.

## CSS Class Contract Defined for Plans 06-06 / 06-07 (diff your emitted markup against this list)

**Felt/scene (this plan's own markup):** `.bj-dealer-area`, `.bj-player-area`, `.bj-hand-row` (4px gap, no wrap, `> :nth-child(n+7)` negative-margin overlap), `.bj-card-placeholder`, `[data-testid='blackjack-outcome-banner']` (badge tokens, radius 12, 16px/24px padding, `--z-outcome`), `.bj-outcome-heading`, `.bj-outcome-body`, `[data-testid='blackjack-hole-reveal']` (+ `:disabled` cursor-only, A9).

**Odds cluster (plan 06-06 emits, writes no CSS):** `[data-testid='blackjack-odds-panel']` (24px padding, column, 16px gap), `.bj-odds-group` (column, 16px gap), `.bj-odds-group__caption` (16/600, left, 4px bottom margin), `.bj-odds-group__subtitle` (14/400 block), `.bj-ev-tiles` (row, 8px gap), `.bj-ev-tile` (1px `--border`, radius 6, 16px padding, 4px gap), `.bj-ev-tile__label` (14/400/1.4), `.bj-ev-tile__value` (20/600/1.2, tabular-nums), `.bj-ev-tile__sub` (14/400/1.4). Reused as-is: `.odds-stats`, `.odds-stat`, `.odds-stat__label`, `.odds-stat__value`, `.odds-panel--pending`.

**Controls (plan 06-07 emits, writes no CSS):** `[data-testid='blackjack-deck-toggle']` and `[data-testid^='blackjack-deck-toggle-']` join the game-mode-switcher segmented rules (wrapper border/radius, segment sizing/typography, `blackjack-deck-toggle-1` divider border, `[aria-pressed='true']` fill/weight); disabled-dimming list extended with `blackjack-hit-button`, `blackjack-stand-button`, `blackjack-deck-toggle-1`; `[data-testid='blackjack-deal-button']`/`-hit-`/`-stand-` get the 44px hit area + Body typography, testid-scoped so nesting is free.

**New token:** `--z-outcome: 4` in `src/index.css` (the file's ONLY new custom property), between `--z-seat-label: 3` and `--z-in-flight: 50`.

**Retired:** the Phase 5 `[data-testid='blackjack-scene']` flex-centering/margin-block and `[data-testid='blackjack-empty-state']` on-felt rules, with an in-place comment naming 06-07 as the plan that removes the placeholder component.

## Hold'em Untouched Confirmation

`git diff d2bb22c..HEAD --name-only` lists exactly the plan's 8 files. No `src/state/`, `src/engine/`, `src/worker/` file changed; `Seat.tsx`, `FlipCard.tsx`, `TableScene.tsx`, `tableGeometry.ts` untouched. The only shipped Hold'em UI edit is `AnimatedCard.tsx`'s single selector line (+ its comment): `state.mode === 'holdem' ? state.holdemRestorePending : state.blackjackRestorePending` — one `useGameModeStore(` call referencing both flags; capture-once useState, gate-idle backstop, transitions and JSX byte-identical. The five shipped suites (`TableScene.remount`, `TableScene`, `Seat`, `FlipCard`, `App.modeSwitchRace`) pass with zero edits. In App.css, no declaration of `.felt`, `.seat`, `.seat-label`, `.card-slot--hero:empty`, `.table-row`, `.odds-stats`, `.odds-stat__*`, or `category-table__*` changed (only comment lines mention them); zero `--accent` and zero `--destructive` in every Phase 6 addition.

## Task Commits

1. **Task 1: Mode-select AnimatedCard's restore-mount flag** — `c972ae1` (feat) — 5 shipped suites pass untouched
2. **Task 2: Composition root, CR-02-safe gate release, outcome banner** — `c3dd128` (feat) — 18 tests
3. **Task 3: Dealer and player areas, one-way hole reveal** — `62e288f` (feat) — +10 tests (28 total in the file)
4. **Task 4: All Phase 6 CSS** — `0635f5a` (style)

## Files Created/Modified

- `src/ui/BlackjackTable.tsx` — `const prevRef = useRef(` + four-dep early return, no cleanup; scene children: dealer area, banner, player area, `blackjack-deck-origin` (3 backs, aria-hidden)
- `src/ui/BlackjackDealerArea.tsx` — contains `revealedHole ? round.dealerHole : undefined` leak guard; reveal-button four-state matrix; natural-deal mountedFaceUp comment at the FlipCard call site; imports `dealOriginOffset` only (never `dealIndex`)
- `src/ui/BlackjackPlayerArea.tsx` — hero-width cards, casino-order indices, A11 total badge
- `src/ui/BlackjackOutcomeBanner.tsx` — `role="status"`, eight locked strings in one `OUTCOME_COPY` table, no `role="alert"`, no `--destructive`
- `src/ui/BlackjackTable.test.tsx` — 28 tests: gate theft (mount/StrictMode/hit-into-bust two-deps-one-commit), DOM-leak (alt text AND asset filename), reveal matrix + double-click, total-badge visibility, natural-deal first-render face + balanced gate, eight banner copy paths transcribed from the UI-SPEC
- `src/ui/AnimatedCard.tsx` — one selector line + comment sentence
- `src/App.css` / `src/index.css` — the Phase 6 block + surgical selector-list extensions + `--z-outcome`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Area components created as minimal shells in Task 2**
- **Found during:** Task 2 (the composition root's JSX references `<BlackjackDealerArea />`/`<BlackjackPlayerArea />`, and Task 2's behavior block covers idle placeholders + badges, but both files are Task 3's)
- **Fix:** Created both files in Task 2 with idle placeholders + badges only; Task 3 replaced them with the full card presentation. No file outside the plan's `files_modified` was touched.
- **Commits:** `c3dd128` (shells), `62e288f` (full)

**2. [Rule 1 - Bug] Motion transform would clobber the banner's CSS centring**
- **Found during:** Task 4 (writing the `translateX(-50%)` rule against a motion.div that animates `y`)
- **Issue:** Motion writes a single inline `transform` while animating, overriding the stylesheet's `translateX(-50%)` — the banner would render off-centre-left in real browsers (invisible to jsdom).
- **Fix:** `x: '-50%'` added to the banner's Motion `initial`/`animate` so both transforms compose; noted in the CSS rule's comment.
- **Files modified:** `src/ui/BlackjackOutcomeBanner.tsx`
- **Commit:** `0635f5a`

**3. [Skipped step] Task 4's `npm run dev` visual check not performed**
- The orchestrator's locked execution rules forbid running the dev server in this worktree. Real-motion/visual verification of the felt layout is assigned to plan 06-08's browser checkpoint by the plan's own executor notes; jsdom coverage here proves gate accounting and DOM structure only.

## Issues Encountered

- A CSS comment containing the sequence `.odds-stat*/` terminated the block comment early and failed `npm run build` (lightningcss minify syntax error); reworded in-task before the Task 4 commit.
- `Parameters<typeof useBlackjackStore.setState>[0]` resolves to zustand's replace-overload (full state required); the banner test's case table is typed `Partial<ReturnType<typeof useBlackjackStore.getState>>` instead.
- No auth gates, zero package installs (T-06-SC: `npm ci` from the committed lockfile only).

## User Setup Required

None.

## Next Plan Readiness

- Plan 06-06 renders `blackjack-odds-panel` markup against the class list above — every class already has a rule; `.odds-stats`/`.odds-stat*` reuse is styled by the shipped rules.
- Plan 06-07 renders the control bar (Deal/Hit/Stand/deck toggle) and the game root against the extended segmented-control and dimming rules; it retires `BlackjackScene.tsx` (whose Phase 5 CSS is already retired here) and mounts `<BlackjackTable />`.
- The banner never renders mid-flight: 06-07's game root needs no extra gating around it.

## Known Stubs

None in this plan's files — no TODO/FIXME, no placeholder copy, no unwired data. (The pre-existing Phase 5 `BlackjackScene.tsx` placeholder is still mounted this wave by design; plan 06-07 retires it.)

## Threat Flags

None — no new network, auth, file-access, or schema surface. T-06-24/25/26/27/28/29 mitigations all landed as tests or source-shape facts recorded above; T-06-SC honored.

## Self-Check: PASSED

- All 5 created files and 3 modified files present on disk with committed content.
- All 4 task commits (`c972ae1`, `c3dd128`, `62e288f`, `0635f5a`) verified in `git log` atop base `d2bb22c`.
- Full suite 48 files / 573 tests green, 0 skipped (baseline 47 / 545; +1 file, +28 tests, all additive — no pre-existing test modified); `npx tsc --noEmit` exit 0; `npx eslint .` exit 0; `npm run build` exit 0.
- Working tree clean; no untracked files; no file deletions in any commit.
