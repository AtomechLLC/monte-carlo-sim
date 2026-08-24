---
phase: 01-core-odds-loop
plan: 03
subsystem: engine
tags: [poker-evaluator, monte-carlo, hand-strength, vitest, react]

# Dependency graph
requires:
  - phase: 01-core-odds-loop/01-02
    provides: Streaming worker pipeline (protocol.ts, simulationApi.ts, simulation.worker.ts), oddsStore, simulationService, WinTieLossDisplay, and equity.ts's stubbed-but-final runTrials(state, trialCount, draw11) signature
provides:
  - "src/engine/evaluator.ts: evaluateHand, compareHands (sign-normalised, never -0 on ties), rawCompareForTesting, re-exported HandStrength — the ONLY module permitted to import @poker-apprentice/hand-evaluator"
  - "src/engine/equity.ts: runTrials real implementation — evaluates all 4 hands per trial, buckets hero's category, determines win/tie/lose via max-then-count-ties reduction over compareHands"
  - "src/ui/categoryLabels.ts: CATEGORY_LABELS, 10 entries High Card through Royal Flush, indexed by HandStrength"
  - "src/ui/OddsTable.tsx: live 10-row hand-category probability table (data-testid=category-table), rows derived from CATEGORY_LABELS"
  - "src/App.tsx: mounts OddsTable below WinTieLossDisplay"
affects: [01-core-odds-loop/01-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-import-site rule for third-party libraries with a load-bearing inverted convention: evaluator.ts is the only module that imports @poker-apprentice/hand-evaluator, enforced by a grep check and a dedicated raw-comparator regression test"
    - "Max-then-count-ties reduction for multi-way outcome determination — never ad-hoc pairwise greater-than chains, which get 4-way tie shapes wrong"
    - "Rows always derived from a fixed label array (CATEGORY_LABELS), never from streamed data's length, so a malformed snapshot cannot silently shrink a table"

key-files:
  created:
    - src/engine/evaluator.ts
    - src/engine/evaluator.test.ts
    - src/engine/equity.test.ts
    - src/ui/categoryLabels.ts
    - src/ui/OddsTable.tsx
  modified:
    - src/engine/equity.ts
    - src/App.tsx
    - src/App.test.tsx

key-decisions:
  - "evaluator.ts imports @poker-apprentice/hand-evaluator with a plain named import (not the plan's documented default-import-and-destructure pattern) — see Deviations. This is the load-bearing technical correction future plans must follow if they ever need to touch this import."
  - "compareHands special-cases a raw comparator result of 0 to return exactly 0, never -0, to satisfy Object.is-based test assertions (Vitest's toBe)."

patterns-established:
  - "Pattern: any wrapper around a third-party comparator with inverted-sign semantics must guard against producing -0 via negation — special-case the zero/tie branch explicitly."
  - "Pattern: expose a raw/unwrapped passthrough (rawCompareForTesting) from the single-import-site module when a regression test needs to observe the raw upstream behavior, rather than granting a second file license to import the library."

requirements-completed: [ENG-01, ENG-02, ODDS-01, ODDS-02]

# Metrics
duration: 12min
completed: 2026-08-24
---

# Phase 1 Plan 03: Real Evaluator-Backed Odds Engine and Category Table Summary

**Replaced the stubbed trial loop with a real `@poker-apprentice/hand-evaluator`-backed Monte Carlo engine (verified against the published AA-vs-3-opponents benchmark: 63.50% computed vs. 63.83% published) and added the live 10-row hand-category probability table, making every number on screen true.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-23T21:04:07-07:00 (approx., base commit)
- **Completed:** 2026-08-23T21:15:30-07:00
- **Tasks:** 3 (RED test authoring, GREEN evaluator+trial-loop, GREEN category table)
- **Files modified:** 3 created test files + 3 created implementation files + 2 modified files = 8 distinct files touched across the plan

## Accomplishments
- Wrote a comprehensive RED test suite pinning the two highest-risk correctness bugs in the project: the evaluator's inverted comparator sign and the 9-vs-10 category off-by-one (royal flush distinct from straight flush)
- Implemented `evaluator.ts`: a thin, sign-normalised wrapper around `evaluateHoldem`/`compare` that is the single import site for the third-party library
- Implemented the real `runTrials` trial loop in `equity.ts`: samples 11 cards per trial, evaluates hero + 3 opponents, buckets the hero's hand category, and determines win/tie/lose via an explicit max-then-count-ties reduction (never ad-hoc pairwise comparisons, which mishandle 4-way ties)
- Verified the implementation against a published benchmark independent of the plan's hand-constructed unit tests: AA vs. 3 random hands converges to 63.50% over 50,000 trials (published reference: 63.83%), and `categoryCounts[HighCard]` was correctly 0 for AA (pocket aces always make at least a pair)
- Built the live 10-row hand-category table (`categoryLabels.ts` + `OddsTable.tsx`) and mounted it in `App.tsx`, deriving rows from a fixed label array rather than streamed data length, so a malformed snapshot can never silently shrink the table
- All 21 tests across the full repository pass; `npm run build` and `npm run lint` both exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing tests for evaluator correctness, trial-loop correctness, and the category table (RED)** - `2cdb326` (test)
2. **Task 2: Real evaluator-backed trial loop replacing the stub (GREEN)** - `c3a9ba3` (feat)
3. **Task 3: Live 10-row hand-category probability table (GREEN)** - `d31bc80` (feat)

**Plan metadata:** committed separately after this summary (docs: complete plan)

## Files Created/Modified

**Task 1 (RED):**
- `src/engine/evaluator.test.ts` - Six cases: wheel straight, royal-vs-straight-flush distinction, straight flush stays distinct, kicker resolution, split pot, and the raw-comparator sign guard
- `src/engine/equity.test.ts` - Five cases: tally invariants, no-duplicate-card sampling (ENG-02), determinism under a fixed seed, and two rigged-outcome scenarios (hero-wins, hero-loses/all-tie)
- `src/App.test.tsx` - Extended with a category-table test: 10 rows, exact label order ending in "Royal Flush", `category-pct-0` reads `50.0%`, and the ten percentages sum to within 0.5 of 100

**Task 2 (GREEN):**
- `src/engine/evaluator.ts` - `evaluateHand`, `compareHands` (sign-normalised, `-0`-safe), `rawCompareForTesting`, re-exported `HandStrength`
- `src/engine/equity.ts` - Real `runTrials`: slices the 11-card sample into board + 3 opponent holes, evaluates all 4 hands, buckets hero's category, and determines outcomes via max-then-count-ties

**Task 3 (GREEN):**
- `src/ui/categoryLabels.ts` - `CATEGORY_LABELS`, 10 entries, `High Card` through `Royal Flush`
- `src/ui/OddsTable.tsx` - `category-table`, one row per `CATEGORY_LABELS` entry, `category-pct-${index}` cells, em-dash at zero trials
- `src/App.tsx` - Mounts `<OddsTable />` below `<WinTieLossDisplay />`

## Decisions Made
- `compareHands` explicitly special-cases a raw comparator result of `0` to return exactly `0` rather than relying on `-compare(a, b)`, which produces `-0` for ties — `-0 !== 0` under `Object.is`, which Vitest's `toBe` uses, so naive negation would have silently broken the split-pot test.
- Exposed `rawCompareForTesting` from `evaluator.ts` (the raw, un-normalised library `compare`) rather than letting the test file import the library directly, preserving the single-import-site invariant that the acceptance criteria's grep check enforces.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `evaluator.ts`'s documented default-import pattern breaks the production build**
- **Found during:** Task 3, first `npm run build` after wiring `OddsTable` into `App.tsx`
- **Issue:** The plan's `<interfaces>` block specified `import pkg from '@poker-apprentice/hand-evaluator'; const { evaluateHoldem, compare } = pkg;`, based on research verified against a raw Node scratch script. That pattern does not hold for this project's actual toolchain: Vite/Rolldown resolves the package's `module` field (a genuine ESM build with only named exports and no default export) when bundling the worker chunk for production, so the default import failed with `[MISSING_EXPORT] "default" is not exported by ".../dist/esm/index.js"`.
- **Fix:** Changed the import to a plain named import: `import { evaluateHoldem, compare } from '@poker-apprentice/hand-evaluator';`. Verified this resolves correctly in both Vitest (which also resolves dependencies through Vite's ESM-first resolver, not a raw Node loader) and the production `vite build`.
- **Files modified:** `src/engine/evaluator.ts`
- **Verification:** `npx vitest run` (21/21 pass), `npm run build` (exits 0, worker chunk emitted correctly), `npm run lint` (exits 0)
- **Committed in:** `d31bc80` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, build-breaking import pattern)
**Impact on plan:** No scope creep. The single-import-site invariant and sign-normalisation behavior the plan cared about are fully preserved — only the specific import syntax needed correcting for this toolchain. Acceptance criterion text describing "default import... does not use named ESM imports" is now factually superseded by this verified finding; the grep-based "single import site" check (which is what actually matters) still passes.

## Issues Encountered
None beyond the single auto-fixed deviation above. The plan's two highest-risk correctness bugs (comparator sign inversion, 9-vs-10 category count) were both caught and prevented exactly as the plan's tests were designed to catch them — no sign-flip or category miscounting occurred in the implementation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The odds engine is now real and verified: `src/engine/evaluator.ts` and `src/engine/equity.ts` are the final, load-bearing implementations for Hold'em hand evaluation and Monte Carlo trial execution that later phases (street navigation, opponent reveal, manual card picker) will condition against a shrinking unknown-card set — no changes to `runTrials`'s signature are anticipated.
- The category table and win/tie/lose display are both live and correctly wired to `oddsStore`; Phase 3's visual redesign can replace `OddsTable.tsx`/`WinTieLossDisplay.tsx`'s markup without touching the engine, worker, or state layers.
- Important note for any future work touching `evaluator.ts`'s import statement: use a plain named import from `@poker-apprentice/hand-evaluator`, NOT a default import — see Deviations above for why.
- No blockers or concerns for the next plan.

### Manual dev-server verification note
No browser-automation tool was available to this executor to perform a live `npm run dev` click-through. In its place, the real production code path (`runTrials` + `evaluateHand` + `compareHands`, unmocked) was exercised directly via a temporary, non-committed Vitest script against a published benchmark: AA vs. 3 random opponents converged to 63.50% win equity over 50,000 trials (published reference: 63.83%), with `categoryCounts[HighCard] === 0` as an internal-consistency sanity check (pocket aces always make at least a pair). A second check (7-2 offsuit vs. 3 random opponents) produced a plausible 13.09% win rate, confirming the numbers are neither the old stub's 100/0/0 nor implausible. This is a stronger correctness signal than a visual click-through would have provided, though a quick manual look at the rendered table's visual layout is still recommended at the phase's final checkpoint.

## Self-Check: PASSED

Verified all created files exist and all three task commits are present in git history (see below).

---
*Phase: 01-core-odds-loop*
*Completed: 2026-08-24*
