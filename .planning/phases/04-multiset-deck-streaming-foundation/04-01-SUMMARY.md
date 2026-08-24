---
phase: 04-multiset-deck-streaming-foundation
plan: 01
subsystem: testing
tags: [vitest, golden-test, regression-baseline, monte-carlo, pure-rand]

# Dependency graph
requires:
  - phase: 01-core-odds-loop
    provides: Deterministic seeded RNG (createRng/createDrawer over pure-rand) and the runTrials Monte Carlo loop that this golden pins
  - phase: 02-scenario-construction-street-navigation
    provides: deriveConditionedState (the D-02 sole-reader conditioning function) whose remainingDeck ordering this golden pins
provides:
  - "src/engine/deckParity.golden.test.ts: literal remainingDeck ordering (preflop/flop/river-with-two-reveals) plus seeded 5000-trial categoryCounts/outcomes tallies for preflop and flop, captured from today's shipped deckCount=1 engine code"
  - "src/worker/streamingParity.golden.test.ts: literal final-snapshot categoryCounts/outcomes/trialsCompleted plus the exact emitted-snapshot-count and trialsCompleted sequence, captured from today's shipped createSimulationApi pipeline, for preflop and flop"
  - "A pre-refactor drift detector that plans 04-02..04-05 (the multiset/shoe and streamingRunner extraction work) must keep green at deckCount=1"
affects: [04-02-shoe-multiset, 04-03-conditioning-deckcount, 04-04-worker-overlap-count-aware, 04-05-streaming-runner-extraction, 04-06-guard-and-property-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden parity test: hardcode literal expected values transcribed from a real run of currently-shipped code (never hand-computed), tagged with the originating decision ID and the literal token GOLDEN in a top-of-file comment stating re-recording is forbidden"
    - "Record-then-transcribe procedure: write an obviously-wrong placeholder assertion, run the test, read the actual/received value from the failure diff, paste it in as the literal, re-run twice to confirm seed-stability before committing"

key-files:
  created:
    - src/engine/deckParity.golden.test.ts
    - src/worker/streamingParity.golden.test.ts
  modified: []

key-decisions:
  - "Golden-first ordering (D-08): these two files exist and are green against the pre-refactor code BEFORE any shoe.ts/conditioning/streamingRunner change lands in plans 04-02 through 04-05"
  - "Worker golden test constructs its own preflopState/runout fixtures identically to simulationApi.test.ts rather than importing from it, preserving simulationApi.test.ts as a byte-unchanged frozen contract under D-07"
  - "Ordering goldens use a joined space-separated string (not an array literal) so both membership AND order are pinned in one compact, diffable literal"

patterns-established:
  - "GOLDEN-tagged top-of-file block comment: states in plain words that a red test means the refactor is wrong, never that the recorded literal is wrong, and that re-recording erases the drift-detection gate this plan exists to create"

requirements-completed: [DECK-01, DECK-03]

# Metrics
duration: 8min
completed: 2026-08-24
---

# Phase 4 Plan 01: V1 Parity Golden Baseline Summary

**Seeded, literal-valued golden regression tests pinning today's shipped deckCount=1 engine and worker-streaming behavior — zero production code, two additive test files, both green against current master.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-24T17:01:49Z
- **Completed:** 2026-08-24T17:09:57Z
- **Tasks:** 2
- **Files modified:** 2 (both new, both additive)

## Accomplishments
- Pinned the exact pre-refactor `remainingDeck` ordering for three knowledge states (preflop/50 cards, flop/47 cards, river-with-opponents-0-and-2-revealed/41 cards) as literal space-joined strings — any reordering introduced by the count-aware `shoeWithout` rewrite will now fail a named test instead of silently changing odds.
- Pinned exact seeded (`createRng(20260824)`, 5000 trials) `categoryCounts`/`outcomes` tallies for the engine-layer `runTrials` loop at preflop and flop.
- Pinned the exact seeded (`seed: 20260824`, `maxTrials: 20000`, `batchSize: 5000`, `progressIntervalMs: 0`) final-snapshot `categoryCounts`/`outcomes`/`trialsCompleted`/`done`/`requestId` from the worker-layer `createSimulationApi` streaming pipeline for preflop and flop, plus the exact emitted-snapshot count (4) and `trialsCompleted` sequence (`[5000, 10000, 15000, 20000]`) — this pins chunking and done semantics, not just final tallies, which is what the D-06 streamingRunner extraction (plan 04-05) must reproduce.
- Confirmed both new files are seed-stable: each ran twice consecutively with identical pass counts.
- Confirmed the full suite grew from 216 to 224 passing tests (216 + 5 engine goldens + 3 worker goldens) with zero pre-existing test modified.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin the engine-layer v1 golden** - `19fbaa0` (test)
2. **Task 2: Pin the worker-layer v1 golden** - `b0e5361` (test)

_Note: this is a pure golden-recording plan — every commit is a `test(...)` commit; there is no corresponding `feat`/`fix` since no production code changed._

## Files Created/Modified
- `src/engine/deckParity.golden.test.ts` - 5 tests: 3 pin `deriveConditionedState`'s exact `remainingDeck` card ordering (preflop/flop/river-with-2-reveals); 2 pin `runTrials`' exact seeded 5000-trial `categoryCounts`/`outcomes` (preflop/flop)
- `src/worker/streamingParity.golden.test.ts` - 3 tests: 2 pin `createSimulationApi`'s exact final-snapshot tallies (preflop/flop); 1 pins the exact emitted-snapshot count and `trialsCompleted` sequence for the preflop run

## Pinned Golden Literals

For a future reader diffing against these without re-running the suite:

**Engine layer (`src/engine/deckParity.golden.test.ts`), fixture: 13-disjoint-slice `runout` from `conditioning.test.ts`:**

| Case | remainingDeck length | Ordering literal (first/last few) |
|------|----------------------|-------------------------------------|
| preflop, `revealedMask=0` | 50 | `2h 2s 3c 3d ... Ac Ad Ah As` |
| flop, `revealedMask=0` | 47 | `3d 3h 3s 4c ... Ac Ad Ah As` |
| river, `revealedMask=0b101` | 41 | `4d 4h 5d 5h ... Ac Ad Ah As` |

Seed `20260824`, 5000 trials each:

| Case | categoryCounts (index 0=HighCard..9=RoyalFlush) | outcomes |
|------|--------------------------------------------------|----------|
| preflop | `[0, 1861, 1960, 550, 60, 84, 440, 45, 0, 0]` | `{win: 1079, tie: 39, lose: 3882}` |
| flop | `[0, 0, 0, 0, 0, 0, 0, 5000, 0, 0]` (guaranteed quads: hero 2c/2d + board 2h/2s) | `{win: 4996, tie: 0, lose: 4}` |

**Worker layer (`src/worker/streamingParity.golden.test.ts`), `seed: 20260824`, `maxTrials: 20000`, `batchSize: 5000`, `progressIntervalMs: 0`:**

| Case | Final categoryCounts | Final outcomes | trialsCompleted | done | Snapshot count / sequence |
|------|------------------------|-----------------|------------------|------|-----------------------------|
| preflop | `[0, 7230, 7949, 2252, 247, 383, 1775, 162, 2, 0]` | `{win: 4369, tie: 170, lose: 15461}` | 20000 | true | 4 snapshots, `[5000, 10000, 15000, 20000]` |
| flop | `[0, 0, 0, 0, 0, 0, 0, 20000, 0, 0]` | `{win: 19983, tie: 0, lose: 17}` | 20000 | true | (final-snapshot only, not asserted on emission shape) |

## Decisions Made
- Used `ConditionedState` (imported from `./equity`) as the explicit type annotation for the engine golden's local `state` variable rather than an inline structural type cast — `deriveConditionedState`'s return shape matches `ConditionedState` structurally, so no cast is needed, keeping the file's types clean and passing `tsc -b` with zero suppressions.
- Both files construct their own copies of the shared 13-slice `runout` fixture (and, for the worker file, the `preflopState`/`heroHole` fixtures) rather than importing them from `conditioning.test.ts` / `simulationApi.test.ts` — per D-07/D-10, `simulationApi.test.ts` in particular must stay byte-unchanged and export nothing new for the rest of the phase.

## Deviations from Plan

None - plan executed exactly as written. Both golden files follow the plan's specified record-then-transcribe procedure (placeholder → run → read `received` → paste literal → re-run green → re-run again to confirm stability) with no auto-fixes, no architectural questions, and no scope changes.

## Issues Encountered

None. `npm ci` succeeded cleanly in the fresh worktree; the pre-existing 216-test suite was confirmed green before any change; both new golden files were stable (identical pass/fail results) across two consecutive runs each; `npx tsc -b` and `npx eslint .` both exited 0 after both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 04-02 through 04-05 (shoe multiset, conditioning deckCount threading, worker overlap count-awareness, streamingRunner extraction) now have a falsifiable, seed-stable regression gate: any of those refactors that changes `remainingDeck` ordering, sampling order, or streaming emission timing at `deckCount=1` will fail one of these 8 golden assertions.
- Plan 04-06's guard test (per the threat model's T-04-01 mitigation) should assert these two golden files were not rewritten mid-phase — no action needed from this plan beyond leaving the files as committed.
- No blockers. Full suite is 224/224 (216 pre-existing + 8 new goldens), `tsc -b` and `eslint .` both clean, zero production files touched.

---
*Phase: 04-multiset-deck-streaming-foundation*
*Completed: 2026-08-24*

## Self-Check: PASSED

- FOUND: `src/engine/deckParity.golden.test.ts`
- FOUND: `src/worker/streamingParity.golden.test.ts`
- FOUND: commit `19fbaa0` (test(04-01): pin engine-layer v1 golden parity baseline)
- FOUND: commit `b0e5361` (test(04-01): pin worker-layer v1 golden parity baseline)
