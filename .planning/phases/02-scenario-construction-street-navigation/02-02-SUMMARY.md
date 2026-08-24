---
phase: 02-scenario-construction-street-navigation
plan: 02
subsystem: ui
tags: [react, zustand, vitest, testing-library, street-navigation, web-worker]

# Dependency graph
requires:
  - phase: 02-scenario-construction-street-navigation (plan 01)
    provides: "Street model, deriveConditionedState (D-02 guard), generalized ConditionedState/runTrials, generalized worker contract, error-surfacing simulationService.startSimulation/cancelSimulation"
provides:
  - "gameStore holding a full PredeterminedRunout (D-01: fixed for the life of a hand) plus a street pointer and revealedMask (always 0 until 02-03)"
  - "StreetControls and BoardDisplay components rendering the visible street/board per the UI-SPEC contract"
  - "App effect rewired to [runout, street, revealedMask, dealNonce], deriving conditioned state on every trigger with ignore-flag + cancelSimulation cleanup"
  - "Visible simulation-error alert (role=alert) closing D-14/WR-02, clearing on the next run's first streamed snapshot"
affects: [02-03-PLAN, 02-04-PLAN, 02-05-PLAN, 02-06-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Predetermined-runout-plus-pointer navigation: deal() draws all 13 cards in one drawN call; advanceStreet/rewindStreet only move a street pointer over the same runout object, never redrawing cards (D-01)"
    - "Effect error state cleared from the onProgress callback (first streamed snapshot of a new run), not synchronously in the effect body — required by the react-hooks/set-state-in-effect lint rule and still satisfies 'clears on next successful run'"

key-files:
  created:
    - src/state/gameStore.test.ts
    - src/ui/StreetControls.tsx
    - src/ui/BoardDisplay.tsx
  modified:
    - src/state/gameStore.ts
    - src/ui/HandDisplay.tsx
    - src/App.tsx
    - src/App.test.tsx

key-decisions:
  - "Cleared the App-local simulation error inside the onProgress callback (on first streamed snapshot of a new run) rather than synchronously at the top of the effect body — the project's ESLint config enforces react-hooks/set-state-in-effect, which flags unconditional setState calls in an effect body but explicitly endorses setState from a callback reacting to an external system (the worker). Behaviorally equivalent to the plan's 'disappears on the next successful run' requirement."
  - "Left the Task 1 acceptance criterion 'grep -c drawN src/state/gameStore.ts returns exactly 1' as a documented literal mismatch, not a functional gap — a named import of drawN plus its single call site are necessarily on two different lines, so the criterion as literally written is unsatisfiable without a contrived import alias. The underlying behavioral requirement ('a single up-front draw, never several independent draws') is met: drawN is called exactly once inside deal()."

requirements-completed: [NAV-01, NAV-02]

# Metrics
duration: ~20min
completed: 2026-08-24
---

# Phase 2 Plan 02: Street Navigation Vertical Slice Summary

**Predetermined-runout gameStore (deal-once, navigate-many) wired to StreetControls/BoardDisplay and a rewired App effect that recomputes odds on every street/reveal/deal trigger with ignore-flag + cancelSimulation cleanup and a visible worker-error alert.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-23T23:10:00-07:00 (approx, first baseline test run)
- **Completed:** 2026-08-23T23:20:16-07:00
- **Tasks:** 3 completed
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `gameStore` now holds a full `PredeterminedRunout` (hero + board + 3 opponents), drawn in a single up-front `drawN(createRng(), FULL_DECK, CARDS_PER_DEAL)` call at `deal()` time (D-01) — `advanceStreet`/`rewindStreet` only move a `street` pointer over the same object, verified object-identical across a full advance-to-river/rewind-to-preflop/advance-to-river round trip.
- `StreetControls` (Rewind / street label / Advance, boundary-disabled) and `BoardDisplay` (board slice by `STREET_BOARD_COUNT[street]`, or the exact `board-empty-state` copy pre-flop) exist as standalone components against the UI-SPEC testid and copy contract; `HandDisplay` migrated its hero read to `runout?.heroHole` with the `opponents`/reveal contract untouched (that lands in 02-03).
- `App`'s odds effect now depends on `[runout, street, revealedMask, dealNonce]` (all four navigation triggers, not just re-deal) and calls `deriveConditionedState` fresh on every change — Advance/Rewind now drive real conditioned recomputation instead of the Phase-1/02-01 preflop-only hardcode.
- Ignore-flag plus `cancelSimulation()` on every effect teardown closes WR-01's main-thread side: a stale run triggered by a fast Advance/Rewind/Deal sequence can no longer write a late snapshot into the odds display (integration-tested by capturing and manually firing a superseded run's `onProgress`).
- A `simulation-error` alert (`role="alert"`, exact UI-SPEC copy) now surfaces worker failures instead of freezing silently (D-14/WR-02), and clears again once the next run streams its first snapshot.
- Full suite: 67/67 passing (51 inherited from 02-01 + 7 new `gameStore.test.ts` + 9 new `App.test.tsx` street-navigation/error/cleanup tests); `npx tsc -b` and `npx eslint .` both exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Predetermined runout and street pointer in gameStore** - `1132027` (feat)
2. **Task 2: Street controls and board display wired to the visible street** - `3cc9993` (feat)
3. **Task 3: Rewire the odds effect for street changes, cleanup, and visible worker errors** - `9cdf8a3` (feat)

_No dedicated TDD RED/GREEN split commits — tests were written alongside each task's implementation and verified together before committing, consistent with 02-01's precedent for `tdd="true"` tasks without a separate fail-first gate requirement._

## Files Created/Modified

- `src/state/gameStore.ts` - Replaced `heroHole` with a full `PredeterminedRunout` field, added `street`/`revealedMask`, `advanceStreet`/`rewindStreet` delegating to `nextStreet`/`previousStreet`
- `src/state/gameStore.test.ts` - Store-only Vitest coverage (no React render): distinct 13-card draw, deal() reset semantics, street clamping both directions, runout object-identity across navigation, two-deals-differ probabilistic check
- `src/ui/StreetControls.tsx` - Rewind/street-label/Advance, `STREET_LABEL`-driven, boundary + no-hand disabling
- `src/ui/BoardDisplay.tsx` - `board-cards`/`board-empty-state` per `STREET_BOARD_COUNT[street]`
- `src/ui/HandDisplay.tsx` - Hero read migrated to `runout?.heroHole`
- `src/App.tsx` - Effect rewired to all four triggers, ignore-flag + `cancelSimulation` cleanup, App-local error state cleared from `onProgress`, JSX reordered to UI-SPEC document order (h1, error banner, Deal, StreetControls, HandDisplay, BoardDisplay, WinTieLossDisplay, OddsTable)
- `src/App.test.tsx` - Mock factory extended with `cancelSimulation`; migrated to `runout`-shaped store reset; added knownBoard-progression, D-02 remainingDeck leak guard, cancel-on-street-change/unmount, stale-snapshot rejection, and error-banner lifecycle tests

## Decisions Made

- Error-clearing moved to the `onProgress` callback (see key-decisions above) to satisfy the project's `react-hooks/set-state-in-effect` ESLint rule while preserving the plan's "disappears on the next successful run" behavior.
- Documented (not fixed) a literal mismatch in Task 1's `grep -c 'drawN'` acceptance criterion — see key-decisions above; the substantive single-call behavior is met and verified by test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `react-hooks/set-state-in-effect` ESLint error on synchronous `setErrorMessage(null)` in the effect body**
- **Found during:** Task 3 (`npx eslint .` after the initial App.tsx rewrite)
- **Issue:** The plan's action text says the effect "clears the error state" synchronously at the top of the effect body (alongside `useOddsStore.getState().reset()`). The project's ESLint config flags this exact pattern (`react-hooks/set-state-in-effect`) as an error: "Calling setState synchronously within an effect body causes cascading renders... the body of an effect should ... call setState in a callback function when external state changes" — this blocks `npx eslint .` from exiting 0, which is a Task 3 acceptance criterion.
- **Fix:** Moved the error-clearing `setErrorMessage(null)` into the `onProgress` callback (fired when the new run's first snapshot streams back), which the same lint rule explicitly endorses as the correct pattern (setState from a callback reacting to an external system, not synchronously in the effect body). Semantically equivalent to the plan's "disappears on the next successful run" requirement — the first successful streamed update is exactly when a run is confirmed alive.
- **Files modified:** src/App.tsx, src/App.test.tsx (updated the error-lifecycle test's "next run" mock to actually stream a snapshot, matching the new clear-on-progress semantics)
- **Verification:** `npx eslint .` and `npx tsc -b` both exit 0; `npx vitest run src/App.test.tsx` 13/13 passing including the error-banner appear/disappear test.
- **Committed in:** `9cdf8a3` (Task 3 commit)

**2. [Rule 1 - Bug] TypeScript control-flow narrowing failure on a closure-captured `let` in a new test**
- **Found during:** Task 3, `npx tsc -b` on the stale-snapshot rejection test
- **Issue:** `let firstOnProgress: (...) => void | null = null;` reassigned inside a `mockImplementation` callback, then read via `firstOnProgress?.(...)` in the outer test body, produced `TS2349: This expression is not callable. Type 'never' has no call signatures.` — a known TS limitation narrowing a `let` binding across a nested-closure reassignment boundary.
- **Fix:** Replaced the raw `let` with a `{ onProgress: ... | null }` ref-object, which TS narrows correctly across the closure boundary (property reads/writes on an object aren't subject to the same per-binding control-flow narrowing quirk).
- **Files modified:** src/App.test.tsx
- **Verification:** `npx tsc -b` exits 0; the stale-snapshot test passes.
- **Committed in:** `9cdf8a3` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking lint fix, 1 blocking TS narrowing fix)
**Impact on plan:** Both fixes were required for the plan's own acceptance criteria (`npx eslint .` / `npx tsc -b` exit 0) to hold; neither changes user-visible behavior described in `<behavior>` — the error-clear-on-first-snapshot semantics still satisfy "disappears on the next successful run."

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The street-navigation vertical slice (NAV-01, NAV-02 cards-half) is complete and integration-tested: Deal fixes the full runout, Advance/Rewind move a pointer over it without redrawing, and every navigation trigger produces a freshly conditioned simulation run with proper cleanup.
- D-14's WR-01 (main-thread side) and WR-02 are both closed: no stale-run writes reach the odds display, and worker failures surface a visible, accessible alert instead of freezing silently.
- `revealedMask` exists in `gameStore` and is threaded through `deriveConditionedState` already (from 02-01), but is always `0` this plan — `02-03-PLAN.md` (opponent reveal) can add a `reveal(index)` action and clickable opponent seats directly on top of this contract with no further `gameStore`/`App` effect changes needed.
- No blockers.

## Self-Check: PASSED

All 7 created/modified files verified present on disk (gameStore.ts, gameStore.test.ts,
StreetControls.tsx, BoardDisplay.tsx, HandDisplay.tsx, App.tsx, App.test.tsx). All 3 task
commits verified present in git log (`1132027`, `3cc9993`, `9cdf8a3`). Full suite 67/67 passing,
`npx tsc -b` and `npx eslint .` both exit 0.

---
*Phase: 02-scenario-construction-street-navigation*
*Completed: 2026-08-24*
