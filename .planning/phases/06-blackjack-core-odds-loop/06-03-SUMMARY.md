---
phase: 06-blackjack-core-odds-loop
plan: 03
subsystem: worker-transport
tags: [typescript, vitest, comlink, web-worker, monte-carlo, blackjack]
status: complete

# Dependency graph
requires:
  - phase: 06-blackjack-core-odds-loop
    plan: 01
    provides: "blackjackProtocol.ts wire types (BlackjackProgressSnapshot, BlackjackSimulationApi, DEALER_BUCKET_COUNT) and blackjackEquity.ts (BlackjackConditionedState, runBlackjackTrials, makeEmptyBlackjackTotals, BLACKJACK_TRIAL_CARD_BUDGET) — consumed UNMODIFIED"
  - phase: 04-multiset-deck-streaming-foundation
    provides: "createStreamingRunner (consumed UNMODIFIED — D-08 config, never a fork), shoe primitives (cardCounts/shoeWithout/shoeSize)"
provides:
  - src/worker/blackjackSimulationApi.ts — createBlackjackSimulationApi + validateBlackjackConditionedState (the blackjack streaming config on the shared runner)
  - src/worker/simulation.worker.ts — namespaced Comlink.expose({ poker, blackjack }) + WorkerApi type
  - src/state/workerClient.ts — getApi/getWorker/onWorkerFailure (LAZY cached Worker/Comlink singleton, T-06-49)
  - src/state/simulationService.ts — startSimulation/cancelSimulation over getApi().poker.* (public surface unchanged)
  - src/state/blackjackSimulationService.ts — startBlackjackSimulation/cancelBlackjackSimulation over getApi().blackjack.*
  - "WR-02 closed: deckCount shape validation (reject 0, >2, non-integers, non-numbers) on BOTH game APIs (D-09)"
affects: [06-04, 06-06, 06-07, 06-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy cached worker singleton: zero workers at import, exactly one after the first start*/cancel* call, synchronous check-and-assign (StrictMode-safe) — getApi() called inside each service function body, never cached into a module-scope const"
    - "Namespaced Comlink surface: one worker, two game APIs via path-accumulating proxy; WorkerApi namespaces carry a TYPE-LEVEL `& Comlink.ProxyMarked` so nested Remote calls type-check"
    - "onWorkerFailure fan-out registry: the client only fans a hard crash to every registered service; each service owns its exactly-once null-before-invoke discipline"
    - "deckCount shape validation is value-based, never type-based: `DeckCount = 1 | 2` provides no protection at a Comlink boundary"

key-files:
  created:
    - src/worker/blackjackSimulationApi.ts
    - src/worker/blackjackSimulationApi.test.ts
    - src/worker/deckCountValidation.test.ts
    - src/state/workerClient.ts
    - src/state/blackjackSimulationService.ts
    - src/state/blackjackSimulationService.test.ts
  modified:
    - src/worker/simulationApi.ts
    - src/worker/simulation.worker.ts
    - src/state/simulationService.ts
    - src/state/simulationService.test.ts

key-decisions:
  - "WorkerApi namespaces are typed `SimulationApi & Comlink.ProxyMarked` — type-level only (no runtime marker exists or is needed; path accumulation handles traversal). Without it Comlink's Remote<T> maps non-function properties to Promise<T> and every nested call site fails tsc -b with TS2339."
  - "Poker deckCount=2 acceptance is asserted at the VALIDATION boundary, not by running trials: WR-03 (STATE.md Blockers) forbids passing deckCount:2 into the Hold'em trial path until Phase 7's duplicate-aware evaluator exists. The test proves 2 passes the shape check by tripping the NEXT check (remainingDeck length from shoeSize(2))."
  - "Blackjack's deckCount is REQUIRED at the boundary (absent rejected with 'got undefined'), unlike poker's absent-means-1 — mirroring 06-01's compile-time decision at the runtime boundary."
  - "cancelSimulation/cancelBlackjackSimulation also construct the worker on first call (they call getApi()) — matches the plan's 'first start*/cancel* call' contract."

patterns-established:
  - "Transport modules are side-effect-free on import; the only Worker construction in src/ lives inside workerClient's ensureWorker() function body"
  - "Each game service keeps its own generation counters, its own module-lifetime Comlink.proxy filtering on its own currentRequestId, and its own onWorkerFailure registration"

requirements-completed: [BJ-02, BJ-03, BJ-04]

# Metrics
duration: 13min
completed: 2026-08-24
---

# Phase 6 Plan 03: Namespaced Worker Surface, Blackjack Runner Config & WR-02 Validation Summary

**Blackjack streams from the same worker as Hold'em via a `createStreamingRunner` config behind a namespaced `{ poker, blackjack }` Comlink surface, the Worker is now constructed lazily on first call (zero workers at import — the wave-4 second-import-path defence), and WR-02 is closed with value-based deckCount shape validation on both game APIs — with both golden drift detectors green and byte-untouched.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-08-24T22:01:25Z (baseline suite run in fresh worktree, after npm ci)
- **Completed:** 2026-08-24T22:13:54Z (final gate)
- **Tasks:** 3 (all RED→GREEN, one atomic commit each)
- **Files modified:** 10 (6 created, 4 modified)

## Accomplishments

- **WR-02 closed (D-09):** both `validateConditionedState` (poker) and `validateBlackjackConditionedState` reject a present-but-invalid `deckCount` (0, 3, 1.5, string `'2'`) with `runSimulation: deckCount must be 1 or 2, got X`, placed before any arithmetic consumes the value. Absent still means 1 on the poker path (asserted — this is what keeps the golden fixtures, which omit `deckCount`, valid); absent is REJECTED on the blackjack path (required field).
- **Blackjack rides the shared runner as a config, never a fork (D-08):** `createBlackjackSimulationApi` calls `createStreamingRunner<BlackjackConditionedState, BlackjackTrialBatchResult, BlackjackProgressSnapshot>` exactly once, with zero loops of its own; `streamingRunner.ts` is untouched. The WR-01 object-identity supersession fix is re-asserted behaviorally (same-requestId supersession test), not assumed.
- **The under-sized-pool boundary check (D-11, T-06-13):** `remainingDeck.length >= BLACKJACK_TRIAL_CARD_BUDGET` fails loudly at the validate hook instead of letting `createDrawer`'s partial Fisher-Yates corrupt or throw deep in the hot loop (06-RESEARCH Pitfall D) — the check 06-01 deliberately deferred here (T-06-06 transfer landed).
- **Snapshots are provably defensive copies:** the test sabotages every received snapshot (`dealerOutcomeCounts[0] += 1000`, both outcome objects mutated) and the later snapshots still reconcile exactly to `trialsCompleted`; consecutive snapshots are distinct object identities.
- **Lazy transport (T-06-49):** importing `workerClient`, `simulationService`, and `blackjackSimulationService` constructs ZERO workers (asserted); the first `start*`/`cancel*` call from either service constructs exactly one (asserted, including two synchronous concurrent first calls — the StrictMode shape); a dozen mixed calls across both services still show one construction.
- **Hard-crash path intact for BOTH games (T-06-16):** a real `ErrorEvent`/`MessageEvent` dispatched on the fake worker routes into both services' `onError` exactly once each; a second event reports nothing further; a finished run's `onError` is never resurrected (stale-closure guard mirrored for blackjack).
- **Poker path externally unchanged (D-08):** `simulationService` exports exactly `startSimulation`/`cancelSimulation`; both golden files green and byte-untouched; the only pre-existing test edited is `simulationService.test.ts`, mechanically (see below).
- Full gate: **45 test files / 494 tests, 0 failures, 0 skipped** (baseline 42 / 459 → **+3 files / +35 tests**, all additive); `npx tsc --noEmit` clean; `npx eslint .` clean; `npm run build` exit 0 (proves the `?worker` import and the namespaced wrap type resolve).

## Golden-Gate Confirmation (D-08)

- `npx vitest run src/worker/streamingParity.golden.test.ts src/engine/deckParity.golden.test.ts` — **8/8 green** after every task.
- `git diff --name-only` across all three commits lists NEITHER golden file, nor `src/worker/streamingRunner.ts`, `src/worker/protocol.ts`, or `src/worker/simulationApi.test.ts` — all frozen files byte-untouched.

## Blackjack API Test Parameters (recorded per plan output spec)

- **`maxTrials: 8000`, `batchSize: 2000`, `seed: 20260824`** for the streaming/reconciliation/defensive-copy/determinism tests (constants `MAX_TRIALS`/`SEED` at the top of `blackjackSimulationApi.test.ts`). Cancel/supersession tests use `maxTrials: 50_000_000` unseeded, mirroring `simulationApi.test.ts`'s shape.

## Enumerated Mechanical Edits to Pre-existing Tests (T-06-14)

`src/state/simulationService.test.ts` is the ONLY pre-existing test file edited. Two edits, both mechanical — no assertion was relaxed, deleted, or skipped:

1. **Comlink mock wrap shape (namespaced):**
   ```diff
   -  wrap: () => ({ runSimulation, cancel }),
   +  wrap: () => ({
   +    poker: { runSimulation, cancel },
   +    blackjack: { runSimulation: vi.fn(), cancel: vi.fn() },
   +  }),
   ```
   Justification: the transport's wire shape changed (worker now exposes `{ poker, blackjack }`), not the assertion's bar — the same `runSimulation`/`cancel` spies drive the same three crash-routing assertions, now reached via `.poker`.
2. **Worker-construction-count comment (import-time → first-call-time):** the `beforeEach` comment's phrase "module-scope singleton constructed once at import time" became "module-cached singleton constructed once on the FIRST service call (lazy, 06-03)". Comment-only; each test in that file calls `startSimulation` before touching `workers[0]`, so the construction-timing change required no assertion edits there. (The zero-at-import / one-at-first-call assertions live in the new `blackjackSimulationService.test.ts`.)

## Task Commits

Each task was committed atomically (RED verified failing, GREEN verified passing in-session before each commit):

1. **Task 1: WR-02 deckCount shape validation on both game APIs (D-09)** — `fa3dc1f` (feat)
2. **Task 2: createBlackjackSimulationApi — a config, not a fork** — `0de1880` (feat)
3. **Task 3: Namespaced worker surface and the three-file main-thread transport** — `7db513d` (feat)

## Files Created/Modified

- `src/worker/simulationApi.ts` — deckCount shape check added after the `?? 1` line (unchanged), before `shoeSize(deckCount)`
- `src/worker/deckCountValidation.test.ts` — both APIs' deckCount cases (0 / 3 / 1.5 / `'2'` / absent / 1 / 2) + the validate-before-assign supersession pin
- `src/worker/blackjackSimulationApi.ts` — validate hook + runner config (contains `createStreamingRunner<` exactly once, `BLACKJACK_TRIAL_CARD_BUDGET` length check, `cardCounts(` overlap budget)
- `src/worker/blackjackSimulationApi.test.ts` — streaming, reconciliation, defensive copies, seeded determinism, cancel, WR-01 same-requestId supersession, validation rejections incl. the 2-deck sibling-copy acceptance
- `src/worker/simulation.worker.ts` — `Comlink.expose({ poker, blackjack })` + `WorkerApi` type (Pattern 4 comment)
- `src/state/workerClient.ts` — lazy cached singleton (`ensureWorker()` owns the only `new SimWorker()`/`Comlink.wrap(` in src/), crash-listener attachment at first construction, `onWorkerFailure` registry
- `src/state/simulationService.ts` — slimmed to poker generation state; `getApi().poker.*` called inside function bodies; releaseProxy DEVIATION comment carried across
- `src/state/blackjackSimulationService.ts` — the blackjack mirror with its own counters/proxy/registration
- `src/state/simulationService.test.ts` — the two mechanical edits enumerated above
- `src/state/blackjackSimulationService.test.ts` — lazy-construction regression detector + dual crash routing + generation filtering

## Decisions Made

- `WorkerApi` namespaces typed `& Comlink.ProxyMarked` (type-level only) — see key-decisions; recorded in a comment in `simulation.worker.ts` citing the TS2339 failure mode.
- Poker deckCount=2 acceptance asserted at the validation boundary per WR-03 — see Deviations.
- Per the plan's audit record: no second cancellation call site on mode switch was added (planner decision, unchanged); the three-file transport split was followed as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Poker deckCount=2 acceptance test ran the WR-03-forbidden 2-deck Hold'em trial path**
- **Found during:** Task 2 (first full `src/worker` suite run; the test had passed by luck in Task 1's run)
- **Issue:** the Task 1 version of "accepts an explicit deckCount of 2" ran a real 1000-trial simulation over a 102-card shoe. WR-03 (STATE.md Blockers): "nothing may pass deckCount:2 into the HOLD'EM trial path until Phase 7's duplicate-aware evaluator exists (evaluator crashes on duplicates)" — the evaluator threw `TypeError: C is not iterable` in `describeHand` when a trial sampled duplicate card values into one evaluated hand. The crash is duplicate-collision-dependent, so the unseeded test was flaky (green in Task 1's run, red in Task 2's).
- **Fix:** acceptance is now asserted at the VALIDATION boundary: a deliberately short 101-card 2-deck remainingDeck sails past the deckCount shape check and trips the next check (`remainingDeck must have exactly 102 cards`), proving 2 is accepted as a value while never entering the trial loop. The blackjack deckCount=2 case runs a real simulation (no evaluator involvement, D-08). Rationale recorded in the test comment.
- **Files modified:** `src/worker/deckCountValidation.test.ts`
- **Commit:** `0de1880` (the flaky version briefly existed in `fa3dc1f`)

**2. [Rule 3 - Blocking] The plan's plain `WorkerApi` interface sketch does not type-check under `tsc -b`**
- **Found during:** Task 3 (`npm run build`; `npx vitest run` and `npx tsc --noEmit` both pass without catching it)
- **Issue:** Comlink's `Remote<T>` maps non-function, non-ProxyMarked properties to `Promise<T>`, so `getApi().poker.runSimulation(...)` failed with TS2339 ("Property 'runSimulation' does not exist on type 'Promise<SimulationApi>'") despite being runtime-correct (Pattern 4's verified path accumulation).
- **Fix:** `WorkerApi` types its namespaces as `SimulationApi & Comlink.ProxyMarked` / `BlackjackSimulationApi & Comlink.ProxyMarked` — a type-level-only intersection (no runtime marker exists or is needed). Zero runtime change; golden files stayed green; build exits 0.
- **Files modified:** `src/worker/simulation.worker.ts`
- **Commit:** `7db513d` (fixed before the task commit — the broken version never landed)

## Issues Encountered

None beyond the two deviations above. No auth gates, no package installs (zero, per T-06-SC — `npm ci` from the committed lockfile only).

## User Setup Required

None.

## Next Phase Readiness

- Plan 06-07's `BlackjackGame` odds effect can call `startBlackjackSimulation`/`cancelBlackjackSimulation` exactly as the plan's interface contract specifies; the wave-4 second import path (`App -> BlackjackGame -> blackjackSimulationService -> workerClient`) is safe against the five frozen v1 jsdom suites because the transport is side-effect-free on import (asserted by the zero-workers-after-import test).
- 06-08's Task 1 enumeration of permitted `simulationService.test.ts` edits is satisfied: exactly the namespaced-mock-shape change plus the import-time → first-call-time comment; nothing else.
- The seven files that mock `./state/simulationService` (App.test, App.acceptance, App.phase3.acceptance, App.modeErrorBanner, App.modeSwitchRace, App.modeSwitch, App.modeIsolation) are untouched and green.

## Known Stubs

None — all functions fully implemented and wired; no placeholder values, no TODO/FIXME markers. (`getWorker()` currently has no production caller — it is part of the plan's specified `workerClient` contract for downstream plans, not a stub.)

## Threat Flags

None — no new security-relevant surface beyond the plan's threat model. T-06-12/13/14/15/16/17 and T-06-49 mitigations are all implemented as asserted tests; T-06-SC held (zero installs).

## Self-Check: PASSED

- All 6 created files and 4 modified files verified present on disk.
- All 3 task commits (`fa3dc1f`, `0de1880`, `7db513d`) verified in `git log` atop base `a79c80f`.
- Full suite 45 files / 494 tests green, 0 skipped (baseline 42 / 459); `npx tsc --noEmit` clean; `npx eslint .` clean; `npm run build` exit 0.
- `git diff --name-only a79c80f..HEAD` lists exactly the 10 plan files; both golden files, `streamingRunner.ts`, `protocol.ts`, and `simulationApi.test.ts` byte-untouched; working tree clean.
