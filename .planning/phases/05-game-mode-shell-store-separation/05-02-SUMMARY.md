---
phase: 05-game-mode-shell-store-separation
plan: 02
subsystem: testing
tags: [vitest, testing-library, zustand, motion, react]

# Dependency graph
requires:
  - phase: 05-game-mode-shell-store-separation (plan 01)
    provides: gameModeStore, GameModeSwitcher, BlackjackScene, and the mode-forked App.tsx this
      plan proves isolation against
provides:
  - src/App.modeIsolation.test.tsx — store-observable (D-06) and DOM-observable (D-04) isolation
    proof, plus D-05 no-simulation-in-blackjack and D-07 persistence/cache-hit proof
  - src/App.modeSwitchRace.test.tsx — D-08 switch-mid-deal gate-drain race under forced real
    motion, plus D-07 mid-flight cancellation proof
affects: [05-game-mode-shell-store-separation (plan 03), 06-blackjack-vertical-slice]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File-scoped vi.mock('motion/react', { useReducedMotion: () => false }) escape hatch for
       proving real animation-gate registration, isolated to its own sibling test file since
       vi.mock is file-scoped (mirrors FlipCard.test.tsx)"
    - "Seeding gameStore.runout via useGameStore.setState (bypassing deal()'s synchronous
       beginAnimation()) to let the odds effect's own render observe pendingAnimationCount===0
       simultaneously with real card mounts under real motion — reconstructs a live-run-in-flight
       + cards-in-flight race deterministically, without real-time waits or fake timers"
    - "Per-call-distinct win% mock implementation (callIndex) to distinguish a cache hit from a
       coincidentally-identical fresh simulation run"

key-files:
  created:
    - src/App.modeIsolation.test.tsx
    - src/App.modeSwitchRace.test.tsx
  modified: []

key-decisions:
  - "Task 2's 'genuinely in-flight run + cards in-flight at switch time' race is constructed by
     seeding runout via setState rather than clicking Deal: deal() synchronously arms the gate in
     the SAME tick it sets runout, which correctly prevents the odds effect from EVER starting a
     live run while any card is still mid-flight (D-11/D-12, verified empirically) — so a normal
     Deal click can never produce a live run and in-flight cards simultaneously. Bypassing that
     synchronous coupling for this one test exploits React's render-time closure capture: the
     effect's first render sees pendingAnimationCount===0 (its own hook value at THAT render),
     even though child AnimatedCard/FlipCard registrations raise the global counter moments later
     in the same passive-effects flush."
  - "The post-round-trip pendingAnimationCount assertion (switching back to Hold'em) checks
     finite-and-non-negative rather than exactly 0, then proves the drain mechanism is repeatable
     via a SECOND switch-away-to-0 — real cards genuinely re-register on the fresh remount under
     forced real motion, so demanding an immediate 0 there would require waiting on real Motion
     animation-completion timing, which this file's own top-comment (mirroring FlipCard.test.tsx)
     explicitly rules out."

requirements-completed: [BJ-01]

# Metrics
duration: ~20min
completed: 2026-08-24
---

# Phase 5 Plan 02: Isolation Proof (Store, Cache, DOM, Race) Summary

**Two new sibling test files (zero production changes) proving Plan 01's Hold'em/Blackjack mode isolation from three distinct angles — store snapshot equality, DOM-absence sweep, and a switch-mid-deal animation-gate/cancellation race — adding 34 tests to the suite (310 → 344).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-24T11:52:03-07:00 (baseline suite run, confirming Wave 1's 310/310)
- **Completed:** 2026-08-24T12:10:09-07:00 (final task commit)
- **Tasks:** 2
- **Files modified:** 2 (both created, both test-only)

## Accomplishments

- `src/App.modeIsolation.test.tsx` (33 tests) proves: `gameStore`/`pickerStore` whole-state `toEqual` equality across a Hold'em → Blackjack → Hold'em round trip (D-06); `oddsStore.settledCache`'s key set is byte-identical before, during (including after a forced rerender), and after a full Blackjack dwell, with `startSimulation`'s call count unchanged throughout (D-05/D-06); an `it.each` sweep proves every Hold'em testid from the UI-SPEC contract (plus the untestid'd Deal button) is gone from the DOM once mode is Blackjack, exercised after a real deal, an advanced street, and an opened card-picker disclosure so the absence assertions are non-vacuous (D-04); and Hold'em state (`runout`/`street`/`revealedMask`/`dealNonce`) plus the displayed win% persist across the round trip with `startSimulation`'s call count unchanged — a genuine cache hit, distinguishable from a fresh run via a per-call-distinct win% mock (D-07).
- `src/App.modeSwitchRace.test.tsx` (1 test) proves the switch-mid-deal race under a file-scoped real-motion override: a live (never-resolving) simulation run and real, gate-registered `AnimatedCard`/`FlipCard` instances are genuinely in flight simultaneously; switching to Blackjack drains `pendingAnimationCount` to exactly 0 purely via existing `useAnimationGate`/`useExitGate` unmount cleanups (no production `resetAnimations()` involved), cancels the in-flight run exactly once, and the drain is proven repeatable across a second round trip (ruling out a stranded gate, T-05-03).
- Negative control performed and documented (see below): removing the `useReducedMotion: () => false` override makes the pre-switch guard assertion fail with `expected 0 to be greater than 0` — confirming the test is not vacuous.
- Full regression bar cleared: 34 test files / 344 tests pass (Plan 01 baseline was 32/310; +2 files / +34 tests, all additive), `npm run lint` exits 0. `git diff --stat` against the Wave 1 base shows only the two new test files — zero production files, zero v1/Phase-5 acceptance suite files touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Store-snapshot isolation, cache non-write, DOM-absence sweep, and Hold'em persistence** - `60df8f8` (test)
2. **Task 2: Switch-mid-deal race — gate drains to zero and the in-flight run is cancelled** - `313e9cc` (test)

_TDD note: both tasks carry `tdd="true"` but this plan's frontmatter `type` is `execute`, and both tasks are pure test-addition tasks against ALREADY-GREEN production code from Plan 01 — there is no RED phase (the assertions passed on first run against Plan 01's existing implementation) and no GREEN-phase production commit was needed. This is itself informative: it confirms Plan 01's implementation already satisfies D-04/D-05/D-06/D-07/D-08 as specified, with no isolation bug found._

## Files Created/Modified

- `src/App.modeIsolation.test.tsx` - Store-snapshot (D-06), settledCache key-set (D-05/D-06), DOM-absence sweep (D-04), and Hold'em persistence/cache-hit (D-07) proofs. New sibling file; does not touch `App.test.tsx`/`App.acceptance.test.tsx`/`App.phase3.acceptance.test.tsx`.
- `src/App.modeSwitchRace.test.tsx` - Switch-mid-deal race proof (D-07/D-08) under a file-scoped real-motion `vi.mock('motion/react', ...)`. New sibling file, isolated because `vi.mock` is file-scoped and this is the only file in the phase requiring real motion enabled.

## Decisions Made

- Followed the plan's mandated `vi.mock('./state/simulationService', ...)` explicit-factory pattern in both files (bare automocking would instantiate a real Worker at module scope, unsupported by jsdom).
- Used the `callIndex`-driven distinct-win% mock implementation from `App.acceptance.test.tsx` in Task 1 so a cache hit is provably distinguishable from a coincidentally-identical fresh run (D-07's actual bar, not just "some number is on screen").
- Compared `oddsStore.settledCache`'s sorted key array rather than the whole `oddsStore` state object via `toEqual` — `settledCache` is a `Map` replaced copy-on-write on every write, so a whole-object/Map-identity comparison would be meaningless; the sorted key-set comparison is exactly D-06's literal bar ("no oddsStore cache key is written while in blackjack mode").
- For Task 2's race, seeded `runout` via `useGameStore.setState` instead of clicking Deal — see `key-decisions` in frontmatter for the full rationale (deal()'s synchronous `beginAnimation()` call structurally prevents a normal click from ever producing "live run + cards in flight" simultaneously; this was verified empirically with a throwaway diagnostic test before writing the real one, then confirmed again via the required negative control).
- The post-return-to-Hold'em assertion in Task 2 checks "finite and non-negative," then separately proves a second switch-away-to-0, rather than asserting an immediate 0 on return — real cards genuinely re-register on the fresh remount under forced real motion, and waiting for their real completion is exactly the real-motion-timing dependency this file's own top comment (mirroring `FlipCard.test.tsx`) rules out.

## Deviations from Plan

None — plan executed exactly as written. No test in either file went red against Plan 01's existing production code (see TDD note above); no production file was touched, and no Plan 01 fix was required.

## Negative Control (Task 2, required by `<verification>` step 4)

Performed manually, not committed:

1. Temporarily replaced `useReducedMotion: () => false` in `src/App.modeSwitchRace.test.tsx` with a no-op spread (removing the override) and re-ran `npx vitest run src/App.modeSwitchRace.test.tsx`.
2. Result: the test failed exactly as expected, at the pre-switch guard assertion:
   ```
   AssertionError: expected real card registrations to leave pendingAnimationCount > 0 before
   switching — a 0 here means the real-motion mock stopped taking effect and this test has gone
   vacuous: expected 0 to be greater than 0
   ```
3. Restored the override (diffed byte-identical against a pre-mutation backup) and re-ran both new test files plus the full suite to confirm a clean pass (34 files / 344 tests).

Conclusion: the guard is non-vacuous — it fails loudly if real-motion registration ever silently regresses.

## Issues Encountered

- **Structural discovery while building Task 2 (not a bug, a verified architectural property):** under real motion, the odds effect's `pendingAnimationCount > 0` gate (checked FIRST, per `App.tsx`'s own D-11/D-12 comment) means a normal "click Deal" flow can NEVER produce a live simulation run while any dealt card is still animating — `deal()` synchronously arms the gate in the same tick it sets `runout`, so the effect's very first render after a real Deal click always observes a non-zero count already. This was confirmed empirically with a throwaway diagnostic test (not committed) before designing Task 2's real approach: seeding `runout` via `useGameStore.setState` (bypassing `deal()`'s synchronous arm) lets the effect's own render see `pendingAnimationCount === 0` at the exact moment `runout` becomes non-null, while the cascading real card registrations that follow (in the same passive-effects flush) still raise the global counter moments later — reconstructing the exact "live run in flight, cards in flight" race D-08 describes, deterministically, without waiting on real Motion animation-completion timing (explicitly out of scope per this file's own top comment) or resorting to fake timers (explicitly disallowed by the plan). This is documented in the test file's own top-of-file comment for future maintainers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01's isolation guarantees (D-04 DOM-absence, D-05 no-simulation-in-blackjack, D-06 store/cache non-mutation, D-07 persistence-with-cache-hit, D-08 gate-drain-on-mid-deal-switch) are now all test-verified from three distinct angles, satisfying ROADMAP success criteria 3 and 4 ("verified by a store-isolation test", "cleanly cancels any in-flight worker run").
- No blockers for Plan 03 (regression-bar gate + browser acceptance checkpoint). `npx vitest run` reports 34 files / 344 tests passing (Plan 01 baseline 32/310 + this plan's 2 new files / 34 new tests, all additive) and `npm run lint` exits 0.
- Phase 6 (Blackjack vertical slice) can proceed with confidence that the mode-fork shell genuinely isolates Hold'em state — no leakage was found in either store, cache, DOM, or animation-gate dimensions.

---
*Phase: 05-game-mode-shell-store-separation*
*Completed: 2026-08-24*

## Self-Check: PASSED

Both created files confirmed present on disk (`src/App.modeIsolation.test.tsx`,
`src/App.modeSwitchRace.test.tsx`). Both task commits (`60df8f8`, `313e9cc`) confirmed present
in `git log`.
