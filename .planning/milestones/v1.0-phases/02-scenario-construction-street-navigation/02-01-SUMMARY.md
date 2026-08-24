---
phase: 02-scenario-construction-street-navigation
plan: 01
subsystem: engine
tags: [monte-carlo, poker, comlink, web-worker, typescript, vitest, fast-check]

# Dependency graph
requires:
  - phase: 01-core-odds-loop
    provides: engine (cards/rng/evaluator/equity), worker pipeline (protocol/simulationApi/simulation.worker), stores (gameStore/oddsStore), simulationService, minimal UI
provides:
  - "Street model (Street, STREET_ORDER, STREET_BOARD_COUNT, STREET_LABEL, nextStreet/previousStreet)"
  - "deriveConditionedState: the single D-02 visibility-derived conditioning function (only reader of a raw predetermined runout)"
  - "Generalized ConditionedState/runTrials/unknownCardsPerTrial supporting any 0-5 known board / 0-3 revealed opponent partition"
  - "Generalized worker contract: SimulationApi.runSimulation(conditioned, requestId, onProgress) with dynamic validation, overlap check, and per-invocation run-token supersession"
  - "Error-surfacing, single-persistent-proxy simulationService.startSimulation(conditioned, onProgress, onError) + cancelSimulation()"
affects: [02-02-PLAN, 02-03-PLAN, 02-04-PLAN, 02-05-PLAN, 02-06-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-02 leak guard: exactly one function (deriveConditionedState) is permitted to read a PredeterminedRunout's board/opponentHoles fields for simulation input; every other module derives conditioned state from it"
    - "Per-invocation run-token (object identity) for worker supersession, not requestId equality — closes WR-01 even under a re-entrant call with the same requestId"
    - "Single persistent Comlink proxy at module scope (not per-call) to eliminate MessageChannel/port leak surface by construction, instead of a create-then-release cycle"
requirements-completed: [NAV-01, NAV-03, DEAL-03]

key-files:
  created:
    - src/engine/streets.ts
    - src/engine/conditioning.ts
    - src/engine/conditioning.test.ts
  modified:
    - src/engine/equity.ts
    - src/engine/cards.ts
    - src/engine/equity.test.ts
    - src/engine/equity.property.test.ts
    - src/engine/benchmark.test.ts
    - src/worker/protocol.ts
    - src/worker/simulationApi.ts
    - src/worker/simulationApi.test.ts
    - src/state/simulationService.ts
    - src/App.tsx
    - src/App.test.tsx

key-decisions:
  - "Single module-scope Comlink proxy for the simulation progress channel (not a fresh Comlink.proxy() per startSimulation() call) — the plan's specified per-call create+finally-release pattern does not compile/work against Comlink's actual API (confirmed via source + README); this design closes the leak surface at its root instead."
  - "App.tsx/App.test.tsx updated (outside this task's declared files) to the new startSimulation(conditioned, onProgress, onError) contract — required for the build/existing tests to pass; preserves exact Phase 1 preflop-only behavior, no new UI capability added."

patterns-established:
  - "Contract-first phase split: this plan generalizes the simulation pipeline's data contract with zero new user-visible capability, so downstream street-nav/reveal/picker plans (02-02..02-05) build on a stable, already-tested ConditionedState/runTrials/worker surface."

# Metrics
duration: 25min
completed: 2026-08-23
---

# Phase 2 Plan 01: Generalized Simulation Contract (Variable Knowledge Partition) Summary

**Generalized ConditionedState/runTrials/worker contract from a fixed preflop-only shape to any 0-5 known-board / 0-3 revealed-opponent partition, locking the D-02 "never peek at hidden cards" rule into a single guardrail function (`deriveConditionedState`).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-23T22:47:00Z (approx, first baseline test run)
- **Completed:** 2026-08-23T23:05:04Z
- **Tasks:** 3 completed
- **Files modified:** 14 (3 created, 11 modified)

## Accomplishments

- `src/engine/streets.ts` + `src/engine/conditioning.ts` land the street model and the single function (`deriveConditionedState`) permitted to read a predetermined runout's `board`/`opponentHoles` for simulation input — enforced by a grep-checked invariant (only `conditioning.ts`/`conditioning.test.ts` reference those fields anywhere in `src/`).
- `ConditionedState`/`runTrials`/`unknownCardsPerTrial` in `equity.ts` now support any knowledge partition from fully-unknown (11 unknown cards/trial, Phase 1's original shape) to fully-determined (0 unknown cards, a single deterministic outcome repeated every trial) — the max-then-count-ties reduction over `compareHands` was preserved byte-for-byte.
- The worker (`simulationApi.ts`) replaced its static `remainingDeck.length !== 50` guard (which rejected every non-preflop request — Pitfall 2) with a dynamic formula plus a known-card/remaining-deck overlap check, and replaced requestId-based supersession with a per-invocation run-token (object identity) that correctly stops a stale loop even when re-entered with the identical requestId (WR-01 regression guard, tested).
- `simulationService.ts` now surfaces worker failures via an explicit `onError` callback and allocates its own service-owned `requestId` generation counter (D-13), keeping `gameStore.dealNonce` as the sole hand-identity counter.
- Phase 1's ENG-04 accuracy benchmark (AA vs. 3 opponents brackets the verified 63.83% equity) passes unchanged — no expected values or seeds were touched during the migration.

## Task Commits

Each task was committed atomically:

1. **Task 1: Street model and the single visibility-derived conditioning function** - `8f96b2e` (feat)
2. **Task 2: Generalize the trial loop to a variable known/unknown split** - `becdb62` (feat)
3. **Task 3: Generalized worker contract, dynamic validation, run token, and error-surfacing service** - `40d69e8` (feat)

_No TDD-style RED/GREEN split commits — tests were written alongside each task's implementation and verified together before committing (plan does not mark tasks with a dedicated fail-first gate beyond `tdd="true"`'s general test-coverage expectation)._

## Files Created/Modified

- `src/engine/streets.ts` - Street type, STREET_ORDER, STREET_BOARD_COUNT, STREET_LABEL, nextStreet/previousStreet
- `src/engine/conditioning.ts` - PredeterminedRunout, isOpponentRevealed, deriveConditionedState (the D-02 guardrail)
- `src/engine/conditioning.test.ts` - Deterministic + fast-check property coverage for all 32 (street, reveal-mask) partitions
- `src/engine/equity.ts` - ConditionedState gains knownBoard/knownOpponentHoles; adds unknownCardsPerTrial; runTrials reconstructs board + opponent holes per trial
- `src/engine/cards.ts` - Removed CARDS_PER_TRIAL; added BOARD_SIZE, HOLE_CARDS_PER_PLAYER, CARDS_PER_DEAL
- `src/engine/equity.test.ts` - Migrated to full ConditionedState literals; added fully-determined-state and rigged-board-reconstruction coverage
- `src/engine/equity.property.test.ts` - Migrated; added a 13-distinct-cards cross-partition property driven through deriveConditionedState
- `src/engine/benchmark.test.ts` - Migrated call sites only (imports/ConditionedState literals/drawer sizing) — no expected values or seeds changed
- `src/worker/protocol.ts` - SimulationApi.runSimulation takes a single ConditionedState (type-only import to avoid a runtime cycle)
- `src/worker/simulationApi.ts` - Dynamic remaining-deck validation + overlap check; per-invocation currentRunToken supersession
- `src/worker/simulationApi.test.ts` - Migrated to the object signature; added validation-branch tests, flop happy-path test, same-requestId re-entry regression guard
- `src/state/simulationService.ts` - startSimulation(conditioned, onProgress, onError); single persistent Comlink proxy; service-owned requestId counter
- `src/App.tsx` - Adapted to the new startSimulation contract, preserving Phase 1's preflop-only behavior
- `src/App.test.tsx` - Adapted mocks/assertions to the new contract (requestId no longer a caller-visible argument)

## Decisions Made

- Kept `deriveConditionedState`'s return type inferred (no explicit `ConditionedState` type annotation) in Task 1, since `equity.ts`'s `ConditionedState` interface wasn't generalized until Task 2 — avoids an excess-property-check failure at the Task 1 commit boundary while keeping each task's own verify step green.
- Single persistent Comlink proxy at module scope for the simulation progress channel, replacing the plan's specified per-call `Comlink.proxy()` + `finally { proxy[Comlink.releaseProxy]() }` pattern (see Deviations — that pattern doesn't compile against Comlink's real API).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Comlink.releaseProxy` is not callable on the object the plan named**
- **Found during:** Task 3 (`simulationService.ts`)
- **Issue:** The plan's action text specifies `calls proxyCallback[Comlink.releaseProxy]() in the finally` where `proxyCallback = Comlink.proxy(callback)`. Direct inspection of `comlink`'s shipped source (`node_modules/comlink/dist/esm/comlink.mjs`: `function proxy(obj) { return Object.assign(obj, { [proxyMarker]: true }); }`) and its README ("Every proxy created by Comlink [via `wrap()`] has the `[releaseProxy]()` method") confirms `Comlink.proxy()` returns the SAME local callback, merely marked — it never gains a `[releaseProxy]` method. That method only exists on a `Remote<T>` obtained from `Comlink.wrap()`. `tsc` independently confirmed this (TS7053: property does not exist on the marked type).
- **Fix:** Created exactly one Comlink proxy for the whole module's lifetime (mirroring the existing `api`/`worker` singleton), routed via the existing requestId filter to the current caller's `onProgress`. This means no per-call `MessageChannel`/port is ever created, closing the T-02-04/IN-08 leak surface by construction rather than by a broken release call. Full rationale is documented inline in `simulationService.ts`.
- **Files modified:** src/state/simulationService.ts
- **Verification:** `npx tsc -b` and `npx eslint .` both exit 0; existing worker/App test suites unaffected (simulationService itself has no direct unit test — it requires the real Worker/Comlink wiring, exactly as in Phase 1).
- **Committed in:** `40d69e8` (Task 3 commit)

**2. [Rule 3 - Blocking] App.tsx / App.test.tsx broke against the generalized startSimulation contract**
- **Found during:** Task 3, after `npx tsc -b` on the full repo
- **Issue:** `App.tsx` called the pre-generalization `startSimulation(heroHole, remainingDeck, requestId, onProgress)`, and `App.test.tsx` mocked/asserted against that same signature (including asserting on a caller-visible `requestId` argument). Neither file is in this task's `<files>` list, but the interface change is a direct, unavoidable consequence of Task 3's own contract generalization — leaving them unfixed would leave the whole repo non-compiling and the existing Phase 1 end-to-end test suite failing.
- **Fix:** Updated `App.tsx` to construct a preflop-shaped `ConditionedState` (`knownBoard: []`, `knownOpponentHoles: [null, null, null]`) and call `startSimulation(conditioned, onProgress, onError)`, exactly preserving Phase 1's existing behavior. Updated `App.test.tsx`'s mocks to the new 2-callback signature; the "second Deal call gets a higher requestId" test was rewritten to assert `startSimulation` is called twice (requestId is no longer a caller-visible argument — it's now allocated internally by `simulationService`, D-13).
- **Files modified:** src/App.tsx, src/App.test.tsx
- **Verification:** `npx vitest run` (51/51 passing), `npx tsc -b` and `npx eslint .` both exit 0.
- **Committed in:** `40d69e8` (Task 3 commit)

**3. [Sequencing note, not a fix] Task 2 commit is transiently repo-wide `tsc -b`-red**
- **Found during:** Task 2 (`equity.ts`/`cards.ts` generalization)
- **Issue:** Extending `ConditionedState` and removing `CARDS_PER_TRIAL` breaks `src/worker/simulationApi.ts`, which is explicitly Task 3's file (not in Task 2's `<files>` list). Task 2's own `<verify>` block scopes to `npx vitest run src/engine/` only (which passes cleanly); the plan's Task 2 acceptance-criteria bullet listing `npx tsc -b exits 0` cannot hold at that exact commit boundary given the two-task interface split.
- **Resolution:** Documented in the Task 2 commit message; Task 3 (committed immediately after, same session) restores full-repo `tsc -b`/`eslint .` to green, matching the plan's overall `<verification>` section, which is scoped to the whole plan rather than each individual task.
- **Committed in:** `becdb62` (documented), resolved by `40d69e8`

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking build fix) + 1 documented sequencing note (not a fix — resolved by design one commit later)
**Impact on plan:** Both auto-fixes were necessary for correctness (Rule 1) and buildability (Rule 3). No scope creep — App.tsx/App.test.tsx changes preserve exactly Phase 1's existing behavior; no street-nav/reveal/picker UI was added (that remains 02-02 through 02-05's scope).

## Issues Encountered

- Initial rigged-board-reconstruction test in `equity.test.ts` (Task 2) picked opponent hole cards (`9c9d`/`Tc,Td`/`Jc,Jd`) that accidentally let one opponent extend the board's straight to a higher one via their own 9, breaking the intended 4-way tie. Fixed by choosing opponent pairs (K, Q, J) far enough from the straight's rank range that none of them can extend it — verified by rerunning the test to a clean pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full 32-partition (street x reveal-mask) simulation contract is proven correct end-to-end: `deriveConditionedState` -> `runTrials` -> a streamed `ProgressSnapshot`, with dynamic worker validation and D-02 leak-guard tests in place.
- `02-02-PLAN.md` (street navigation UI, the first user-visible slice of this feature) can now build directly on `deriveConditionedState`, `ConditionedState`, and the generalized `simulationService.startSimulation(conditioned, onProgress, onError)` contract without further engine/worker changes.
- No blockers. One thing to carry forward: `App.tsx` currently hardcodes the preflop-only `ConditionedState` shape (no board/opponent tracking yet in `gameStore`) — this is expected and intentionally left for `02-02-PLAN.md`, which introduces the full predetermined runout and street/reveal state.

## Self-Check: PASSED

All 14 created/modified files verified present on disk (streets.ts, conditioning.ts,
conditioning.test.ts, equity.ts, cards.ts, equity.test.ts, equity.property.test.ts,
benchmark.test.ts, protocol.ts, simulationApi.ts, simulationApi.test.ts, simulationService.ts,
App.tsx, App.test.tsx). All 3 task commits verified present in git log (`8f96b2e`, `becdb62`,
`40d69e8`).

---
*Phase: 02-scenario-construction-street-navigation*
*Completed: 2026-08-23*
