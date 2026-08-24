---
phase: 01-core-odds-loop
plan: 02
subsystem: infra
tags: [comlink, web-worker, zustand, vitest, streaming, monte-carlo]

# Dependency graph
requires:
  - phase: 01-core-odds-loop/01-01
    provides: FULL_DECK, OPPONENT_COUNT, CARDS_PER_TRIAL, deckWithout (src/engine/cards.ts); createRng, drawN, createDrawer (src/engine/rng.ts); useGameStore with heroHole/dealNonce/deal (src/state/gameStore.ts)
provides:
  - "src/worker/protocol.ts: shared main-thread/worker contract (ProgressSnapshot, SimulationOptions, SimulationApi, CATEGORY_COUNT=10, DEFAULT_BATCH_SIZE, DEFAULT_PROGRESS_INTERVAL_MS, DEFAULT_MAX_TRIALS)"
  - "src/worker/simulationApi.ts: pure, Comlink-free, Node-testable chunked trial loop with throttled progress and generation-tagged cancellation/supersession"
  - "src/worker/simulation.worker.ts: Comlink.expose entry point, zero trial-loop logic"
  - "src/engine/equity.ts: runTrials with its FINAL signature (ConditionedState, trialCount, draw11) -> TrialBatchResult, deliberately stubbed pending plan 01-03's real evaluator"
  - "src/state/oddsStore.ts: Zustand store for derived simulation output (categoryCounts, outcomes, trialsCompleted, done, reset, applySnapshot)"
  - "src/state/simulationService.ts: module-scope Comlink-wrapped worker singleton, startSimulation() with requestId-based staleness filtering"
  - "src/ui/WinTieLossDisplay.tsx: live trial counter and win/tie/lose percentage display"
  - "App.tsx wiring: useEffect on [heroHole, dealNonce] resets oddsStore and starts a fresh simulation run per deal"
affects: [01-core-odds-loop/01-03, 01-core-odds-loop/01-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Worker logic split into a pure, Comlink-free simulationApi.ts (Node-testable with no Worker/jsdom) and a three-line simulation.worker.ts that only calls Comlink.expose"
    - "Generation-tagged requestId cancellation enforced on BOTH sides: worker bails without emitting when superseded, main-thread service filters any snapshot whose requestId doesn't match the latest before it reaches the store"
    - "Worker instantiated once at module scope (not inside a useEffect) to avoid React 19 StrictMode double-invocation leaking a second worker thread"
    - "Component tests mock the simulation service with an explicit vi.mock factory (not bare automocking) — automocking would still execute the real module's top-level `new Worker()` call, which jsdom doesn't support"
    - "Stub-first vertical slice: runTrials is deliberately fake (constant HighCard/win tally) so the streaming/cancellation/UI plumbing is provable independently of poker-math correctness, which lands in plan 01-03"

key-files:
  created:
    - src/worker/protocol.ts
    - src/worker/simulationApi.ts
    - src/worker/simulation.worker.ts
    - src/worker/simulationApi.test.ts
    - src/engine/equity.ts
    - src/state/oddsStore.ts
    - src/state/simulationService.ts
    - src/ui/WinTieLossDisplay.tsx
  modified:
    - src/App.tsx
    - src/App.test.tsx

key-decisions:
  - "Percentage display format uses a trailing '%' sign (e.g. '60.0%') and an em-dash '—' at zero trials, since the plan text specified the numeric precision but not the exact string shape"
  - "vi.mock('./state/simulationService') needed an explicit factory instead of bare automocking, because Vitest's automock still imports the real module to introspect its export shape, which would execute the module-scope `new SimWorker()` call and crash under jsdom (no Worker global)"

patterns-established:
  - "Pattern: throttling lives in the worker (simulationApi.ts), never on the main thread — batches are clipped to land exactly on maxTrials and progress emission is time-gated by progressIntervalMs"
  - "Pattern: every emitted ProgressSnapshot carries a defensive copy of categoryCounts/outcomes, never the mutable running totals array"

requirements-completed: [ENG-03, ODDS-03]

# Metrics
duration: 8min
completed: 2026-08-24
---

# Phase 1 Plan 02: Streaming Simulation Pipeline Summary

**Full Comlink-wrapped Web Worker streaming pipeline (Deal -> worker -> throttled progress -> Zustand -> live trial counter and win/tie/lose percentages) built and proven end-to-end against a deliberately stubbed trial loop, so plan 01-03's evaluator swap is isolated from plumbing risk.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-23T20:52:48-07:00 (approx., base commit)
- **Completed:** 2026-08-23T21:00:47-07:00
- **Tasks:** 2 (RED test authoring, GREEN implementation)
- **Files modified:** 2 created test files (Task 1) + 8 created/modified files (Task 2) = 9 distinct files touched across the plan

## Accomplishments
- Wrote failing Node-environment tests (`simulationApi.test.ts`) that fully specify streaming, requestId tagging, cancellation, and supersession against a pure, Comlink-free API — no Worker or jsdom involved
- Extended `App.test.tsx` with a mocked simulation service asserting the live trial counter and win/tie/lose percentage rendering, plus requestId escalation on re-deal
- Implemented the shared worker protocol (`protocol.ts`) with the corrected 10-category `HandStrength` count (Royal Flush distinct from Straight Flush)
- Implemented `simulationApi.ts`'s chunked trial loop: batches clipped to land exactly on `maxTrials`, throttled progress emission, and generation-tagged cancellation/supersession enforced by checking `requestId !== currentRequestId` both before and after each batch
- Implemented `simulation.worker.ts` as a pure `Comlink.expose` entry point with zero trial-loop logic
- Stubbed `runTrials` in `equity.ts` per plan spec — every trial calls `draw11()` (exercising the real sampling path) but tallies a constant `HighCard`/win outcome, clearly commented as a plan 01-03 placeholder
- Implemented `oddsStore.ts` (Zustand, derived state) and `simulationService.ts` (module-scope Comlink-wrapped worker singleton with staleness filtering on both sides of the boundary)
- Implemented `WinTieLossDisplay.tsx` and wired `App.tsx`'s `useEffect` on `[heroHole, dealNonce]` to reset odds and start a fresh run on every deal
- Verified via `npm run dev`: dev server starts cleanly with no console/runtime errors; production `npm run build` emits a separate `simulation.worker-*.js` chunk as expected from the Vite `?worker` import

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing tests for the streaming pipeline (RED)** - `bc8f127` (test)
2. **Task 2: Streaming worker pipeline with a stubbed trial loop (GREEN)** - `c6cf9fd` (feat)

**Plan metadata:** committed separately after this summary (docs: complete plan)

## Files Created/Modified

**Task 1 (RED):**
- `src/worker/simulationApi.test.ts` - Node-environment tests (`// @vitest-environment node`) driving `createSimulationApi` directly: streaming (>=2 snapshots, non-decreasing trialsCompleted, final done at maxTrials), requestId tagging, cancellation (no further snapshots + promise settles), and supersession (older requestId stops emitting once a newer run starts)
- `src/App.test.tsx` - Extended with a mocked `startSimulation` asserting `trial-counter`/`win-pct`/`tie-pct`/`lose-pct` testids and requestId escalation on re-deal; original Deal happy-path assertions preserved unchanged

**Task 2 (GREEN):**
- `src/worker/protocol.ts` - `CATEGORY_COUNT=10`, `DEFAULT_BATCH_SIZE=4000`, `DEFAULT_PROGRESS_INTERVAL_MS=100`, `DEFAULT_MAX_TRIALS=200000`, `ProgressSnapshot`, `SimulationOptions`, `SimulationApi`
- `src/engine/equity.ts` - `ConditionedState`, `TrialBatchResult`, stubbed `runTrials` (final signature, fake tallies)
- `src/worker/simulationApi.ts` - `createSimulationApi(options?)`: chunked batching, throttled emission, generation-tagged cancel/supersede, entry-point validation (heroHole length, remainingDeck length)
- `src/worker/simulation.worker.ts` - `Comlink.expose(createSimulationApi())`, re-exports the `SimulationApi` type
- `src/state/oddsStore.ts` - Zustand store: `categoryCounts`, `outcomes`, `trialsCompleted`, `done`, `reset()`, `applySnapshot()`
- `src/state/simulationService.ts` - Module-scope `Comlink.wrap`-ped worker singleton, `startSimulation()` with requestId staleness filtering
- `src/ui/WinTieLossDisplay.tsx` - `trial-counter`, `win-pct`, `tie-pct`, `lose-pct` testids; renders `—` at zero trials
- `src/App.tsx` - Mounts `WinTieLossDisplay`, wires the deal->simulation `useEffect`

## Decisions Made
- Percentage strings render with a trailing `%` (e.g. `60.0%`) and `—` at zero trials — the plan specified one-decimal precision but not the exact string shape, so this was chosen for readability and is exercised exactly by the App test's assertions.
- `vi.mock('./state/simulationService', () => ({ startSimulation: vi.fn() }))` uses an explicit factory rather than bare `vi.mock('./state/simulationService')` — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `vi.mock` automocking executed the real module and crashed under jsdom**
- **Found during:** Task 2, first full test run after wiring `App.tsx`
- **Issue:** The plan's Task 1 instruction was `vi.mock('./state/simulationService')` (bare, no factory). Vitest's automocking still imports the real module to introspect its export shapes before replacing them with mocks — this executed `simulationService.ts`'s module-scope `new SimWorker()` call, which threw `ReferenceError: Worker is not defined` because jsdom has no Worker implementation.
- **Fix:** Replaced the bare automock with an explicit factory: `vi.mock('./state/simulationService', () => ({ startSimulation: vi.fn() }))`. This never imports the real module, matching the test's stated intent (UI wiring only, not the worker boundary).
- **Files modified:** `src/App.test.tsx`
- **Verification:** `npx vitest run` — all 8 tests across both suites pass; `npm run build` and `npm run lint` exit 0.
- **Committed in:** `c6cf9fd` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking issue, test infrastructure)
**Impact on plan:** No scope creep — a one-line test-setup correction required to make the plan's own stated intent (never instantiate a real Worker in the jsdom component test) actually hold.

## Issues Encountered
None beyond the single auto-fixed deviation above. The plan's documented risks (10 vs. 9 hand categories, worker-vs-main-thread throttling placement, StrictMode double-worker-instantiation, stale-snapshot overwrite) were all pre-empted correctly by following the plan's `<action>` instructions exactly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full streaming pipeline (worker, protocol, stores, UI) is in place and proven correct independently of poker math — plan 01-03 can now swap `runTrials`' stub body for the real `@poker-apprentice/hand-evaluator`-backed loop without touching any other file in this plan's `files_modified` list, per the plan's explicit design intent.
- `runTrials`'s signature (`ConditionedState`, `trialCount`, `draw11`) is final and unchanged — plan 01-03 should implement inside the existing function body only.
- No blockers or concerns for the next plan.

### Manual dev-server verification note
`npm run dev` was started and confirmed to serve the app with no console/startup errors, and `npm run build` confirmed the worker is correctly split into its own chunk (`dist/assets/simulation.worker-*.js`). A live-browser click-through of the Deal button (visually confirming the counter climbs to 200,000 and percentages render) was not performed in this session because no browser-automation tool was available to this executor; this exact behavior is covered end-to-end by `simulationApi.test.ts` (which drives the identical `createSimulationApi` implementation used inside the real worker, proving streaming/cancellation/supersession without mocks) and by `App.test.tsx` (which proves the UI renders `trial-counter`/`win-pct`/`tie-pct`/`lose-pct` correctly from streamed snapshots). Recommend a quick manual click-through at the next available checkpoint (plan 01-04's phase acceptance checkpoint) as a final visual sanity check.

## Self-Check: PASSED

Verified all created files exist and both commits are present in git history (see below).

---
*Phase: 01-core-odds-loop*
*Completed: 2026-08-24*
