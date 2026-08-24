---
phase: 04-multiset-deck-streaming-foundation
plan: 03
subsystem: engine
tags: [multiset, deck, conditioning, fast-check, property-testing, vitest]

# Dependency graph
requires:
  - phase: 04-multiset-deck-streaming-foundation
    plan: 02
    provides: "src/engine/shoe.ts — DeckCount, buildShoe, shoeSize, cardCounts, shoeWithout"
provides:
  - "src/engine/equity.ts: ConditionedState.deckCount?: DeckCount (OPTIONAL, absent means 1)"
  - "src/engine/conditioning.ts: deriveConditionedState(runout, street, revealedMask, deckCount = 1) deriving remainingDeck through the shared shoeWithout helper, with the D-02 sole-reader guarantee extended (not replaced)"
  - "src/engine/multisetSampling.property.test.ts: additive 2-deck closure-by-count property, 2-deck remainingDeck-length formula, DECK-03 without-replacement guard at both deck counts, and a compact deck-count-differs-measurably property"
affects: [04-04-worker-overlap-count-aware, 04-05-streaming-runner-extraction, 04-06-guard-and-property-tests, phase-6-blackjack-engine, phase-7-duplicate-aware-evaluation, phase-8-deck-toggle-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "deriveConditionedState's known-card collection order: hero hole (2), then knownBoard (in street order), then each non-null revealed opponent hole in opponent-index order — this exact order feeds shoeWithout and is what reproduces v1's pinned remainingDeck ordering byte-for-byte at deckCount=1"
    - "Count-shaped property assertions (cardCounts) as the mandatory 2-deck sibling of any 1-deck Set.size/new Set(...).size invariant — never generalize the original assertion in place (D-10, PITFALLS Pitfall 12)"
    - "Property tests that need duplicate-card-tolerant sampling must drive createDrawer directly and never route through the trial-batch executor (runTrials), which crashes on any duplicate rank+suit co-occurrence (PITFALLS Pitfall 7, empirically confirmed) — duplicate-aware evaluation is out of scope until Phase 7"

key-files:
  created:
    - src/engine/multisetSampling.property.test.ts
  modified:
    - src/engine/equity.ts
    - src/engine/conditioning.ts

key-decisions:
  - "ConditionedState.deckCount is OPTIONAL (deckCount?: DeckCount), not required — this is the plan's <critical_constraint>. tsc -b type-checks test files under tsconfig.app.json's include: [\"src\"], and eight existing test files (including the D-07-frozen src/worker/simulationApi.test.ts) build ConditionedState object literals with no deckCount key. A required field would fail the build and violate the D-07 freeze in the same stroke. Every consumer must read it as `state.deckCount ?? 1`; unknownCardsPerTrial/runTrials were left completely untouched since neither needs to read deckCount at all — both already operate correctly on a flat Card[] pool with duplicates."
  - "deriveConditionedState's known-card collection order (hero hole, then knownBoard, then revealed opponent holes in index order) was chosen to exactly match the prior new Set([...]) insertion order, and the goldens (deckParity.golden.test.ts, streamingParity.golden.test.ts) plus conditioning.test.ts's exact remainingDeck-length/ordering assertions passed on the FIRST run after the rewrite — no reordering was needed."
  - "Two JSDoc/comment-wording adjustments were required in the new property-test file after it tripped its own plan-mandated acceptance-criteria greps (grep -c \"runTrials\" == 0, grep -c \"new Set\" == 0): explanatory prose describing what the file deliberately avoids (routing through the trial-batch runner, the 1-deck new Set(...).size property in conditioning.test.ts) contained the literal forbidden substrings. Reworded without changing any test logic — same pattern already documented in plan 04-02's SUMMARY as a recurring class of false positive against this plan-authoring style."

patterns-established:
  - "Decision-ID-tagged JSDoc extension (not replacement) when a load-bearing invariant comment needs a new clause: conditioning.ts's D-02 sole-reader comment gained one D-04 sentence, every prior sentence preserved verbatim"

requirements-completed: [DECK-01, DECK-03]

# Metrics
duration: 6min
completed: 2026-08-24
---

# Phase 4 Plan 03: Conditioning DeckCount Threading Summary

**`deriveConditionedState` now threads an optional, defaulted `deckCount` parameter and derives `remainingDeck` through the shared count-aware `shoeWithout` helper instead of a hand-rolled `Set<Card>` filter — reproducing v1's exact 1-deck ordering on the first try, with `ConditionedState.deckCount` declared OPTIONAL so all eight pre-existing three-argument call sites (including the D-07-frozen `simulationApi.test.ts`) keep compiling unchanged.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-24T10:22:00-07:00 (baseline `npm ci` + full-suite run)
- **Completed:** 2026-08-24T10:28:17-07:00 (last commit)
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 new)

## Accomplishments
- `src/engine/equity.ts`'s `ConditionedState` gains exactly one new field, `deckCount?: DeckCount` (OPTIONAL per the plan's `<critical_constraint>`), tagged D-04, with a one-line doc-comment stating "absent means 1." `unknownCardsPerTrial`/`runTrials` are byte-untouched (`git diff --numstat` reports 3 added / 0 removed lines total for the file).
- `src/engine/conditioning.ts`'s `deriveConditionedState` takes a fourth, defaulted `deckCount: DeckCount = 1` parameter, collects known cards into a plain `Card[]` (hero hole, then `knownBoard`, then revealed opponent holes in index order), and derives `remainingDeck` via `shoeWithout(deckCount, knownCards)` — the last value-based `Set<Card>` in the conditioning path is gone (`grep -c "new Set"` returns 0), `FULL_DECK` is no longer imported here (`grep -c "FULL_DECK"` returns 0), and the D-02 sole-reader doc-comment was extended (not replaced) with a new D-04 sentence explaining the count-aware derivation.
- The rewrite reproduced v1's exact pinned `remainingDeck` ordering and lengths on the FIRST run: both 04-01 goldens (`deckParity.golden.test.ts`, `streamingParity.golden.test.ts`) and all of `conditioning.test.ts` passed immediately, with no reordering of the known-card collection needed.
- New additive `src/engine/multisetSampling.property.test.ts` (4 `test.prop` properties, 129 lines) proves: (A) 2-deck conditioning closure by COUNT — every `FULL_DECK` value appears exactly twice across known+remaining at `deckCount=2`, the count-shaped sibling of `conditioning.test.ts`'s untouched 1-deck `Set.size` property; (B) the 2-deck `remainingDeck.length` formula (`shoeSize(2) - 2 - knownBoard.length - 2 * revealedCount`); (C) the DECK-03 without-replacement guard at BOTH deck counts, driving `createDrawer` directly over 200 captured samples per case and asserting no card's sample-count plus known-count ever exceeds `deckCount`; (D) a compact, non-statistical proof that `deckCount` measurably changes the pool (`remainingDeck` grows by exactly 52, a hero card goes from 0 copies at 1 deck to 1 copy at 2 decks).
- End-to-end 2-deck verification via a direct script confirmed `remainingDeck.length === 102` and the hero's own hole card appears exactly once in a preflop, no-reveals, `deckCount: 2` state.
- Full suite grew from 243 (post-04-02 baseline) to 247 passing tests, zero failures, zero skips. `npx tsc -b` and `npx eslint .` both exit 0 with no suppressions.
- `equity.property.test.ts` is byte-identical (`git diff --exit-code` exits 0); its "(c) exactly 13 unique cards" 1-deck property is untouched and still present verbatim.

## Task Commits

1. **Task 1: Thread deckCount through ConditionedState and route conditioning through shoeWithout** - `9403344` (feat)
2. **Task 2: Additive multiset and DECK-03 without-replacement property tests** - `8aa5902` (test)

## Files Created/Modified
- `src/engine/equity.ts` - `ConditionedState` gains `deckCount?: DeckCount` (D-04, optional, type-only import from `./shoe`)
- `src/engine/conditioning.ts` - `deriveConditionedState` gains a defaulted `deckCount: DeckCount = 1` fourth parameter; `remainingDeck` now derived via `shoeWithout(deckCount, knownCards)` instead of `new Set` + `FULL_DECK.filter`; D-02 doc-comment extended with a D-04 sentence; returns `deckCount` in the result object
- `src/engine/multisetSampling.property.test.ts` - 4 additive `test.prop` properties proving 2-deck closure-by-count, the 2-deck remaining-deck formula, the DECK-03 per-value copy budget at both deck counts, and that deck count measurably changes the pool

## Decisions Made
- `ConditionedState.deckCount` is declared OPTIONAL, not required, per the plan's explicit `<critical_constraint>` — this is what keeps `tsc -b` (which type-checks test files) passing against eight pre-existing three-argument `deriveConditionedState`/three-key `ConditionedState` call sites, including the byte-frozen `src/worker/simulationApi.test.ts` (D-07).
- The known-card collection order in `deriveConditionedState` (hero hole → knownBoard → revealed opponent holes in index order) was chosen deliberately to match the removed `Set`'s insertion order, and this choice was validated correct on the first golden/conditioning-test run — no trial-and-error reordering was required.
- Property C ("DECK-03 without-replacement guard") drives `createDrawer` directly rather than `runTrials`, per the plan's explicit CRITICAL instruction — `runTrials` calls `evaluateHand`/`evaluateHoldem`, which throws on any duplicate rank+suit co-occurrence at `deckCount=2` (PITFALLS.md Pitfall 7, empirically confirmed in that research). Duplicate-aware evaluation is deliberately out of scope until Phase 7.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] New property-test file's own explanatory comments tripped its own plan-mandated acceptance-criteria greps**
- **Found during:** Task 2 verification (running the plan's own `grep -c "runTrials"` and `grep -c "new Set"` acceptance checks against the freshly written `multisetSampling.property.test.ts`)
- **Issue:** Explanatory comments describing what the file deliberately avoids ("do NOT route this through `runTrials`", "the sibling of `conditioning.test.ts`'s line-111 `new Set(allCards).size` property") contained the literal substrings the acceptance criteria grep for as evidence of *actual* forbidden usage — producing false-positive non-zero counts (`runTrials`: 3, `new Set`: 1) even though no test logic anywhere in the file used either pattern.
- **Fix:** Reworded the prose to describe the same avoided patterns without the literal token strings (e.g., "the shared Monte Carlo trial-batch runner (equity.ts's batch executor)" instead of naming `runTrials`; "dedup-then-measure-length property" instead of writing `new Set(...).size`) — no test logic changed.
- **Files modified:** `src/engine/multisetSampling.property.test.ts`
- **Verification:** Re-ran `grep -c "runTrials"` and `grep -c "new Set"` — both return 0; re-ran `npx vitest run src/engine/multisetSampling.property.test.ts`, `npx tsc -b`, `npx eslint .` — all pass/exit 0 after the wording change, all 4 properties still passing.
- **Committed in:** `8aa5902` (Task 2 commit — the wording was corrected before the single commit for this task was made, so no separate fix-up commit was needed)

---

**Total deviations:** 1 auto-fixed (1 blocking, comment-wording only)
**Impact on plan:** No behavior or scope change. Purely a documentation-wording fix, matching the exact same class of false-positive already documented in plan 04-02's SUMMARY — a recurring, known characteristic of this plan-authoring style's literal-grep acceptance criteria, not a code defect.

## Issues Encountered

One minor discrepancy in the plan's own literal acceptance criteria (not a code issue): the plan states `grep -c "shoeWithout" src/engine/conditioning.ts` should return 1, but the correct, idiomatic implementation necessarily produces 2 matching lines — the named import (`import { shoeWithout, type DeckCount } from './shoe';`) and the single call site (`const remainingDeck = shoeWithout(deckCount, knownCards);`). Both are legitimate, non-duplicated uses of the one shared helper (DECK-01's actual requirement — "the last value-based `Set<Card>` is gone, replaced by the one shared count-aware helper" — is satisfied: `new Set` count is 0, `shoeWithout` is called exactly once). Rewriting the import as a namespace import purely to force the grep count to 1 would have deviated from this codebase's established named-import convention (every other file, including `shoe.test.ts` and `shoe.ts` itself, uses named imports) for no functional benefit. Left as-is; documented here rather than silently "fixed" against the letter of an evidently miscalibrated grep.

`npm ci` was required first since the worktree started with no `node_modules` (per the plan's stated fresh-worktree environment note); completed cleanly (249 packages, 0 vulnerabilities). Pre-change baseline (`npm test` / `npx vitest run`) was confirmed green at 243/243 before Task 1 began.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ConditionedState.deckCount` and `deriveConditionedState`'s fourth parameter are now available for plan 04-04 (worker overlap count-awareness) and plan 04-05 (streaming runner extraction) to consume — both can read `state.deckCount ?? 1` at their own validation/entry points without any further change to `equity.ts`/`conditioning.ts`.
- `src/engine/multisetSampling.property.test.ts` establishes the reusable pattern (count-shaped property assertions via `cardCounts`, direct `createDrawer` sampling to avoid the evaluator's duplicate-card crash) that plan 04-06's guard/property-test work can extend.
- No blockers. Full suite 247/247, both 04-01 goldens still green, `conditioning.test.ts` still green unmodified, `tsc -b` and `eslint .` both clean, zero production files outside `src/engine/equity.ts`/`src/engine/conditioning.ts` touched, and the new test file is purely additive.

---
*Phase: 04-multiset-deck-streaming-foundation*
*Completed: 2026-08-24*

## Self-Check: PASSED

- FOUND: `src/engine/equity.ts`
- FOUND: `src/engine/conditioning.ts`
- FOUND: `src/engine/multisetSampling.property.test.ts`
- FOUND: commit `9403344` (feat(04-03): thread deckCount through ConditionedState and conditioning)
- FOUND: commit `8aa5902` (test(04-03): add 2-deck multiset closure and DECK-03 without-replacement guard)
