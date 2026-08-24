---
phase: 04-multiset-deck-streaming-foundation
plan: 02
subsystem: engine
tags: [multiset, deck, shoe, fast-check, property-testing, vitest]

# Dependency graph
requires:
  - phase: 04-multiset-deck-streaming-foundation
    plan: 01
    provides: Golden parity tests (deckParity.golden.test.ts, streamingParity.golden.test.ts) pinning v1 deckCount=1 behavior before any refactor lands
provides:
  - "src/engine/shoe.ts: the multiset shoe primitive — DeckCount union, buildShoe, shoeSize, cardCounts, count-aware shoeWithout"
  - "src/engine/shoe.test.ts: exact-value tests plus the deckCount=1 v1-parity property (with a duplicate-indices variant) and the count-based multiset-closure property"
  - "The single shared cardCounts occurrence-budget primitive that plans 04-03/04-04/04-05 (conditioning's remainingDeck, the worker's overlap budget, the streamingRunner extraction) will import instead of re-deriving Map-based counting logic"
affects: [04-03-conditioning-deckcount, 04-04-worker-overlap-count-aware, 04-05-streaming-runner-extraction, 04-06-guard-and-property-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Count-aware occurrence-budget subtraction: build a Map<Card, number> budget from the excluded array via cardCounts, then walk the source pool ONCE in order, decrementing budget entries instead of filtering by Set membership or .includes() — this is the multiset replacement for v1's value-based Set exclusion"
    - "Property-proven v1 parity: shoeWithout(1, x) is asserted array-identical (membership AND order) to the untouched v1 deckWithout(x) via fast-check, for both unique and duplicate-value excluded sets, rather than merely eyeballed"
    - "Count-based (not Set-based) multiset closure assertion: shoe ∪ excluded reconstructs exactly deckCount copies of every card value, read out of a Map — never asserted via new Set(...).size, which would be false at deckCount=2"

key-files:
  created:
    - src/engine/shoe.ts
    - src/engine/shoe.test.ts
  modified: []

key-decisions:
  - "buildShoe(2) ordering is CONCATENATED (all 52, then all 52 again), not interleaved — stated explicitly in the shoe.ts JSDoc because this order is an input to seeded shuffling downstream and must be a stated contract, not an accidental implementation detail future refactors could silently change"
  - "shoeWithout walks buildShoe(deckCount) in array order (not via a rebuild-from-counts approach) specifically because walking in order is what makes shoeWithout(1, x) reproduce deckWithout(x)'s exact output including ordering — verified by the D-08 parity property, not just by matching lengths"
  - "Two JSDoc-prose edits were required after initial drafting: the words 'ALL_CARDS' and 'includes(' and 'new Set' appeared inside explanatory comments (describing what the module deliberately avoids), which tripped the plan's literal grep-based acceptance criteria designed to catch actual code usage. Reworded the prose to preserve the same explanation without using those literal substrings — no logic change, purely a comment-wording adjustment to satisfy the plan's own verification greps."

patterns-established:
  - "Decision-ID-tagged JSDoc on every export (D-01/D-02/D-03), naming the DECK-01 contract in words on shoeWithout specifically"
  - "Additive-only module discipline: FULL_DECK/deckWithout in cards.ts left byte-unmodified; shoe.ts is a new sibling module, not a rewrite"

requirements-completed: [DECK-01]

# Metrics
duration: 4min
completed: 2026-08-24
---

# Phase 4 Plan 02: The Shoe Multiset Primitive Summary

**New additive `src/engine/shoe.ts` module — count-aware `buildShoe`/`shoeWithout` over `Map<Card, number>` occurrence budgets, proven byte-identical to v1's `deckWithout` at deckCount=1 by property test and proven to preserve both physical copies of a card at deckCount=2 by exact-value test.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-24T17:14:06Z (first commit)
- **Completed:** 2026-08-24T17:17:39Z (last commit)
- **Tasks:** 2
- **Files modified:** 2 (both new, both additive)

## Accomplishments
- `src/engine/shoe.ts` exports exactly the target contract: `DeckCount = 1 | 2`, `buildShoe`, `shoeSize`, `cardCounts`, `shoeWithout` — no `Set`, no `.includes()`, no re-import of `ALL_CARDS` anywhere in the file.
- Proved the DECK-01 headline case by exact-value test: `shoeWithout(2, ['As'])` has length 103 and contains `'As'` exactly once — excluding one physical copy from a 2-deck shoe leaves the sibling copy drawable.
- Proved v1 parity by property test (not just a handful of hand-picked cases): `shoeWithout(1, x)` is array-identical (membership AND order) to the untouched `deckWithout(x)` for arbitrary excluded sets, including a duplicate-indices variant proving parity holds even when a caller passes the same card index twice.
- Proved multiset closure by count, not by `Set.size`: for `deckCount` in `{1, 2}` and an excluded set clamped so no card is requested more than `deckCount` times, `shoeWithout(deckCount, excluded)` plus `excluded` always reconstructs exactly `deckCount` copies of every one of the 52 `FULL_DECK` values, and `shoeWithout(...).length === shoeSize(deckCount) - excluded.length`.
- `src/engine/cards.ts`, `src/engine/conditioning.ts`, `src/engine/equity.ts`, and `src/engine/equity.property.test.ts` are all byte-unchanged (`git diff --exit-code` on all four exits 0).
- Full suite grew from 224 (216 pre-existing + 8 goldens from plan 04-01) to 243 passing tests, zero failures, zero skips. Both 04-01 golden files re-run and still green (8/8).
- `npx tsc -b` and `npx eslint .` both exit 0 with no suppressions.

## Task Commits

Each task was committed atomically as a TDD RED/GREEN pair:

1. **Task 1: The shoe module — count-aware buildShoe/shoeWithout with exact-value tests**
   - RED: `c79d68d` (test) — 16 failing tests written first, module did not exist
   - GREEN: `3c363a6` (feat) — `shoe.ts` implemented, all 16 tests pass
2. **Task 2: Property-prove v1 parity at 1 deck and multiset closure at 2 decks** - `9b20514` (test) — 3 new `test.prop` properties added to the same file, 19 tests total

## Files Created/Modified
- `src/engine/shoe.ts` - `DeckCount`, `buildShoe`, `shoeSize`, `cardCounts`, `shoeWithout`; every export carries a decision-ID-tagged JSDoc block (D-01/D-02/D-03)
- `src/engine/shoe.test.ts` - 19 tests: 16 exact-value cases (construction, sizing, counting, count-aware subtraction including the DECK-01 headline case) plus 3 `test.prop` properties (v1-parity unique-indices, v1-parity duplicate-indices, multiset closure)

## Decisions Made
- `buildShoe(2)`'s ordering is concatenated, not interleaved — documented in the JSDoc as a stated contract because it feeds seeded shuffling.
- `shoeWithout` walks the shoe once in order rather than rebuilding from counts, which is what makes it reproduce `deckWithout`'s exact ordering at deckCount=1 (verified by the parity property, not assumed).
- Reworded two JSDoc comments during Task 1 after discovering the plan's own literal-grep acceptance criteria (`grep -c "includes("`, `grep -c "ALL_CARDS"`, `grep -c "new Set"`) matched prose describing what the code *avoids*, not just actual usage. No logic changed; only comment wording, to make the file satisfy its own verification greps without losing the explanatory intent.

## Deviations from Plan

None affecting behavior or scope. One minor self-correction during execution:

### Auto-fixed Issues

**1. [Rule 3 - Blocking] JSDoc prose tripped the plan's own literal-string acceptance-criteria greps**
- **Found during:** Task 1 verification (running the plan's own `grep -c` acceptance checks against the freshly written `shoe.ts`)
- **Issue:** Explanatory JSDoc comments describing what the module deliberately does NOT do (e.g., "never re-imports `ALL_CARDS`", "never filters with `excluded.includes(...)`", referencing "new Set" in a follow-up test comment) contained the literal substrings the plan's acceptance criteria grep for as evidence of *actual* forbidden usage, producing false-positive non-zero counts.
- **Fix:** Reworded the prose to describe the same avoided patterns without using the literal token strings (e.g., "pulling a second 52-card source directly from the evaluator types package" instead of naming `ALL_CARDS`; "scanning `excluded` per candidate" instead of writing `.includes(...)`; "dedup-then-measure-length idiom" instead of writing `new Set(...).size`).
- **Files modified:** `src/engine/shoe.ts`, `src/engine/shoe.test.ts`
- **Verification:** Re-ran `grep -c "new Set"`, `grep -c "includes("`, `grep -c "ALL_CARDS"` against both files — all return 0; re-ran `npx vitest run src/engine/shoe.test.ts`, `npx tsc -b`, `npx eslint .` — all still pass/exit 0 after the wording change.
- **Committed in:** `3c363a6` (Task 1 GREEN commit), `9b20514` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, comment-wording only)
**Impact on plan:** No behavior or scope change. Purely a documentation-wording fix so the module's own explanatory comments don't accidentally satisfy the letter of a verification grep while violating its spirit (or vice versa).

## Issues Encountered

None beyond the comment-wording item above. `npm ci` was required first since the worktree started with no `node_modules` (per plan's stated fresh-worktree environment note); it completed cleanly (249 packages, 0 vulnerabilities). Pre-change baseline (`npm test`) was confirmed green at 224/224 before Task 1 began.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/engine/shoe.ts` now exists as the single load-bearing count-aware multiset primitive. Plan 04-03 (conditioning `deckCount` threading) can call `shoeWithout`/`cardCounts` directly for `remainingDeck` derivation instead of hand-rolling a second `Map`-based exclusion.
- Plan 04-04 (worker overlap count-awareness) and plan 04-05 (streamingRunner extraction) both have `cardCounts` available as the shared counting primitive named in this plan's objective.
- `deckWithout`/`FULL_DECK` in `cards.ts` remain untouched and still serve any existing single-deck caller — no migration was required or attempted this plan (that is explicitly out of scope, deferred to 04-03).
- No blockers. Full suite 243/243, both 04-01 goldens still green (8/8), `tsc -b` and `eslint .` both clean, zero production files outside `src/engine/shoe.ts`/`src/engine/shoe.test.ts` touched.

---
*Phase: 04-multiset-deck-streaming-foundation*
*Completed: 2026-08-24*

## Self-Check: PASSED

- FOUND: `src/engine/shoe.ts`
- FOUND: `src/engine/shoe.test.ts`
- FOUND: commit `c79d68d` (test(04-02): add failing tests for count-aware shoe module)
- FOUND: commit `3c363a6` (feat(04-02): implement count-aware buildShoe / shoeWithout)
- FOUND: commit `9b20514` (test(04-02): property-prove v1 parity and multiset closure)
