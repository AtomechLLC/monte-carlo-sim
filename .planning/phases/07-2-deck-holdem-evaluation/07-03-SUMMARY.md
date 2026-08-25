---
phase: 07-2-deck-holdem-evaluation
plan: 03
subsystem: engine-worker-state
tags: [holdem, two-deck, category-index, hoisted-evaluator, grow-on-merge, wr-03-retirement, wr-04, guard-tests]

# Dependency graph
requires:
  - phase: 07-2-deck-holdem-evaluation
    plan: 01
    provides: evaluateHandTwoDeck / compareHandsTwoDeck / HandTwoDeck (src/engine/evaluatorTwoDeck.ts)
  - phase: 04-multi-deck-foundation
    provides: shoeWithout / cardCounts / DeckCount, deckCount-aware worker validation
provides:
  - FIVE_OF_A_KIND_INDEX and categoryCountFor(deckCount) in src/worker/protocol.ts (plan 07-06 imports these)
  - runTrials with per-batch hoisted evalFn/cmpFn selection — one loop serves both deck counts
  - grow-on-merge category totals in simulationApi's mergeBatch (11-length snapshots at deckCount 2)
  - length-tolerant oddsStore dev consistency guard (accepts 10 and 11, still reports out-of-family/sum-mismatch)
  - retired WR-03: real end-to-end 2-deck poker acceptance at the worker boundary (D-12)
  - extended shoePath guard: WR-04 .includes( prohibition, evaluateHand( call-site allowlist, library-import allowlist, oracle test-only pin
affects: [07-06 Five of a Kind row + lockedCategory routing, 07 odds-table plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hoisted per-batch function selection: deck-count branch runs once above the trial loop, never per trial (D-04)"
    - "Grow-on-merge: mergeBatch extends totals to the batch's length with zeros — the batch's own length is the only deck-count signal visible inside runner hooks"
    - "Recursive comment-stripped token allowlist sweeps in guard tests (readdirSync recursive walk)"

key-files:
  created:
    - src/engine/equityTwoDeck.test.ts
    - src/state/oddsStoreTwoDeck.test.ts
  modified:
    - src/worker/protocol.ts
    - src/engine/equity.ts
    - src/worker/simulationApi.ts
    - src/state/oddsStore.ts
    - src/worker/deckCountValidation.test.ts
    - src/engine/shoePath.guard.test.ts
    - src/ui/node-builtins.d.ts

key-decisions:
  - "FIVE_OF_A_KIND_INDEX = CATEGORY_COUNT (derived, never a second literal 10); categoryCountFor lives in protocol.ts, the value-exporting side of the protocol-to-engine import direction"
  - "compareHands as CmpFn cast documented sound: at deckCount 1 the wrapper is never invoked, so no value reaching compareHands carries strength 10 or a tiebreak"
  - "oddsStore guard widened to the {10, 11} family, never switched to 11 — shipped 10-length fixtures (App.holdemCachePoison.test.tsx) must keep passing silently"

requirements-completed: [HE2-01, HE2-02]

# Metrics
duration: 18min
completed: 2026-08-24
---

# Phase 7 Plan 03: Category-Index Spine Summary

**One hoisted evaluator/comparator selection in runTrials serves both deck counts (1-deck byte-identical, golden-pinned), the category histogram grows to 11 on merge exactly where deckCount=2 flows, WR-03 is retired by a real end-to-end 2-deck run, and WR-04 closes with includes-prohibition plus evaluator call-site allowlists with demonstrated negative controls**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-25T01:58:00Z (base `4ed9d82`, verified before any work)
- **Completed:** 2026-08-25T02:16:00Z
- **Tasks:** 3 (+1 blocking-fix commit)
- **Files modified:** 9 (2 new test files, 6 planned edits, 1 deviation — see Deviations)

## Task Commits

Each task was committed atomically (RED verified failing before GREEN implementation, one commit per task — the wave-1 single-commit-per-task convention):

1. **Task 1: Derived category-index constants and the hoisted evaluator selection in runTrials** — `566838f` (feat)
   - RED: 4 failing (missing constants; raw stock evaluator throwing from `equity.ts:79` on the duplicate hero window)
2. **Task 2: Grow-on-merge snapshots, length-tolerant odds dev guard, D-12 WR-03 retirement** — `0b2a2bf` (feat)
   - RED: 3 failing (E2E 2-deck snapshot stuck at length 10; guard firing on length-11)
3. **Task 3: WR-04 shoe-path guard extension and evaluator call-site allowlists** — `13af0a6` (test)
4. **Fix: `readdirSync` declaration in the scoped `node:fs` shim** — `9398a6f` (fix, deviation Rule 3)

## Shipped Interface (plan 07-06 imports these)

```typescript
// src/worker/protocol.ts — additive; CATEGORY_COUNT is UNCHANGED at 10
export const CATEGORY_COUNT = 10;                    // verbatim, doc comment untouched
/** The extended index Five of a Kind occupies at deckCount 2 (D-05) — derived, never a second literal. */
export const FIVE_OF_A_KIND_INDEX = CATEGORY_COUNT;
/** Histogram length for a given shoe: 10 at one deck, 11 at two (the Five of a Kind row). */
export function categoryCountFor(deckCount: DeckCount): number; // returns deckCount === 2 ? CATEGORY_COUNT + 1 : CATEGORY_COUNT
```

`DeckCount` is imported into protocol.ts with `import type` only, preserving the module's cycle-avoidance discipline.

## The D-12 Retargeted Test (WR-03 retirement evidence)

- **Old title:** "accepts an explicit deckCount of 2 at the validation boundary (WR-03 keeps the 2-deck TRIAL path off-limits)" — a proxy that proved deckCount=2 survived validation by riding the next check's `102 cards, got 101` rejection.
- **New title:** "accepts deckCount 2 END-TO-END: a real 2-deck run completes with an 11-length reconciling categoryCounts (D-12, WR-03 retired)"
- **Now asserts:** a `pokerState(2)` request with a correctly-sized 102-card `shoeWithout(2, heroHole)` remainingDeck RUNS TO COMPLETION (1000 trials, batches of 500): at least one snapshot emitted, final snapshot `done: true`, `categoryCounts` length 11, category sum === `trialsCompleted`.
- **Preserved rejection:** a new plainly-titled sibling ("still rejects a malformed 2-deck remainingDeck length with the exact frozen boundary message") pins the exact string `runSimulation: remainingDeck must have exactly 102 cards, got 101`. Retargeted, never deleted.
- **File header:** gained an `AMENDED 2026-08-24 (Phase 7 plan 07-03, D-12)` record following the `App.modeShell.guard.test.ts` amendment convention.
- **NOT touched:** the "05-REVIEW WR-03" comments in `App.tsx` and `HoldemGame.tsx` — a different WR-03 (Phase 5 REVIEW identifier collision), per 07-PATTERNS section 8.

## Negative-Control Failure Messages (Task 3, run and reverted before commit)

1. **`evaluateHand(` added to `src/state/gameStore.ts`:**
   > AssertionError: a production evaluateHand( call site appeared outside the sanctioned allowlist — at deckCount 2 its input can contain duplicate cards, which the raw stock evaluator silently mis-scores or crashes on (07-RESEARCH Pitfall 3); route it through evaluateHandTwoDeck instead: expected [ 'state/gameStore.ts' ] to deeply equal []

2. **`.includes(` added to `src/engine/shoe.ts`:**
   > AssertionError: engine/shoe.ts must never call .includes( — value membership on cards is the Set&lt;Card&gt; collapse in different clothes (D-07, WR-04); use cardCounts / count-aware logic instead: expected 'import type { Card } from \'@poker-ap…' not to contain '.includes('

Both injections were reverted (`git checkout -- <file>` on exactly those two files) and the guard re-ran green (21/21) before the Task 3 commit.

## Untouchables Confirmation

`git diff --stat 4ed9d82..HEAD` over the frozen set produces **no output** — all byte-unmodified and green:

- `src/engine/deckParity.golden.test.ts` and `src/worker/streamingParity.golden.test.ts` (both goldens)
- `src/worker/simulationApi.test.ts` (frozen contract; never parameterised with deckCount — its shoePath pin still passes)
- `src/App.holdemCachePoison.test.tsx` (its 10-length fixture passes the widened guard silently — verified by a dedicated run)
- The five frozen v1 suites: `App.test.tsx`, `App.acceptance.test.tsx`, `App.phase3.acceptance.test.tsx`, `App.modeErrorBanner.test.tsx`, `App.modeSwitchRace.test.tsx`
- `src/engine/conditioning.ts` — zero edits; `git grep deckCount` shows only the shipped default-parameter and doc lines
- `CATEGORY_LABELS` untouched (stays 10 entries); no `blackjack*` file touched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended the scoped `node:fs` type shim with `readdirSync`**
- **Found during:** Final verification after Task 3 (`npm run build` / `tsc -b` failed with TS2305: Module '"node:fs"' has no exported member 'readdirSync')
- **Issue:** the plan mandates the recursive walk via `readdirSync` with `recursive: true`, but the project deliberately removed `@types/node` from app code (IMP-02) in favour of `src/ui/node-builtins.d.ts`, which declares only the symbols the on-disk test files use — `readdirSync` was not among them
- **Fix:** added a narrow `readdirSync(path, { recursive: boolean }): string[]` declaration per the shim's own extension instruction; no Node ambient globals reintroduced; symbol count comment updated 5→6
- **Files modified:** `src/ui/node-builtins.d.ts` (outside the plan's `files_modified` list — unavoidable for the mandated implementation)
- **Commit:** `9398a6f`

### Execution notes (not deviations)

- The `runTrials` doc comment avoids the literal token `runTrialsTwoDeck` (acceptance criterion: the file must contain no such token) — the "never fork a sibling loop" rationale is recorded without naming it.
- TDD tasks were executed RED→GREEN with a single atomic commit per task, matching the plan's one-commit-message-per-task instruction and the wave-1 executor precedent.

## Verification Results

- `npx vitest run`: **57 files / 786 tests, 0 failures, 0 skipped** — vs the wave-1 baseline of 55 / 764 (**+2 files, +22 tests**; count strictly increased)
  - equityTwoDeck.test.ts +7, oddsStoreTwoDeck.test.ts +5, deckCountValidation.test.ts 15→16 (+1), shoePath.guard.test.ts 12→21 (+9)
- `npm run lint` / `npx eslint .`: clean, zero inline eslint-disable comments added
- `npm run build` (`tsc -b && vite build`): exit 0; `npx tsc --noEmit`: clean
- `git diff --stat 4ed9d82..HEAD` lists exactly the eight `files_modified` paths plus `src/ui/node-builtins.d.ts` (documented deviation) and this SUMMARY
- `src/engine/equity.ts`: `deckCount ===` appears only in the hoist above the loop (lines 87-88), never in the loop body; no second trial loop; hoist comment cites D-04
- `src/worker/simulationApi.ts`: exactly one `new Set(`, on the `VALID_BOARD_LENGTHS` line; `makeEmptyTotals` still `CATEGORY_COUNT`
- `src/state/oddsStore.ts`: `` return `${street}|${revealedMask}`; `` verbatim; no deckCount in `knowledgeKey` (D-03)
- Every commit in the range left `npx vitest run src/engine/shoePath.guard.test.ts` green

## Known Stubs

None — no placeholder values, no unwired data paths. The 11th histogram entry is live end-to-end (runTrials → mergeBatch → snapshot → oddsStore guard); the UI row that renders it is plan 07-06 scope by design.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes beyond the plan's own threat model (all `mitigate` dispositions T-07-12..T-07-17 implemented as specified; zero package installs, `npm ci` from the committed lockfile only).

## User Setup Required

None.

## Next Plan Readiness

- Plan 07-06 can import `FIVE_OF_A_KIND_INDEX` / `categoryCountFor` from `src/worker/protocol.ts` exactly as the `<interfaces>` block specified — shipped signatures match verbatim
- `lockedCategory.ts` remains on the raw evaluator by design this plan (it is in the call-site allowlist); plan 07-06 routes it through `evaluateHandTwoDeck` at deckCount 2
- The worker boundary now accepts and completes `deckCount: 2` poker runs end-to-end — UI plans can wire the toggle's conditioned state straight through

## Self-Check: PASSED

- All 9 source/test files + this SUMMARY exist on disk
- Commits `566838f`, `0b2a2bf`, `13af0a6`, `9398a6f` present on `worktree-agent-a8b1131f4ba390a23` atop base `4ed9d82`

---
*Phase: 07-2-deck-holdem-evaluation*
*Completed: 2026-08-24*
