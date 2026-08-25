---
phase: 07-2-deck-holdem-evaluation
plan: 01
subsystem: engine
tags: [holdem, evaluator, two-deck, duplicate-gate, five-of-a-kind, suit-remap-proxy, fast-check, statistical-anchor]

# Dependency graph
requires:
  - phase: 04-multi-deck-foundation
    provides: buildShoe/shoeWithout/cardCounts (count-aware multiset primitives), DeckCount type
  - phase: 01-core-odds-loop
    provides: evaluator.ts (stock evaluateHand/compareHands wrapper, sole library importer), rng.ts (seeded createRng/createDrawer)
provides:
  - evaluateHandTwoDeck / compareHandsTwoDeck / FIVE_OF_A_KIND / ExtendedStrength / HandTwoDeck (src/engine/evaluatorTwoDeck.ts)
  - Test-only brute-force oracle oracleScore (src/engine/twoDeckOracle.ts)
  - D-13 property suite (oracle parity, candidate equivalence, monotonicity, gate totality, comparator totality)
  - D-13 seeded Five of a Kind frequency anchors (conditional + marginal) with 1-deck parity companion
affects: [07-03 equity/worker hoist, 07-06 lockedCategory routing, 07 odds-table Five of a Kind row, shoePath guard extension]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stamped Int32Array(52) + generation counter for zero-allocation duplicate detection (no per-call Set/Map)"
    - "Suit-remap proxy: preserve rank multiplicities, substitute dup copies into lowest-count free suits, full-window counts before choosing"
    - "Custom-scored hands carry tiebreak?: number[]; absent tiebreak means stock-shaped and stock-comparable"
    - "Independent test-only oracle as arbiter, validated against the stock evaluator on clean inputs first"

key-files:
  created:
    - src/engine/evaluatorTwoDeck.ts
    - src/engine/evaluatorTwoDeck.test.ts
    - src/engine/twoDeckOracle.ts
    - src/engine/evaluatorTwoDeck.property.test.ts
    - src/engine/fiveOfAKindFrequency.test.ts
  modified: []

key-decisions:
  - "Proxy builder pre-counts ALL keep-cards before choosing any substitution suit (full-window counts, not prefix counts) — prefix-only counts could steer a substitution into a suit that later keep-cards fill to 5, a phantom flush"
  - "Assumption A1 shipped as the working convention: dup-flush tiebreak is the 5-rank multiset descending, pinned by explicit vectors and the oracle"
  - "Oracle emits per-category canonical tiebreaks ([rank] for 5oak, [high] for straights/SFs, multiset-desc for flushes/high card, grouped count-desc/rank-desc for rank categories); the property suite derives the identical form from stock-shaped candidate hands"

patterns-established:
  - "Generation-stamp trick clears counting buffers without per-call zeroing (rankCounts/suitCounts stamped alongside the card stamps)"
  - "Statistical anchor style carried from Phase 6: closed form + SE arithmetic + 3-sigma count band + STANDING RULE forbidding band-widening"

requirements-completed: [HE2-02]

# Metrics
duration: 15min
completed: 2026-08-24
---

# Phase 7 Plan 01: Duplicate-Aware Evaluation Module + Oracle + Anchors Summary

**Duplicate-aware 2-deck Hold'em evaluation shipped as a gate → Five-of-a-Kind → suit-remap-proxy → flush-zone decision tree, pinned by an independently-written brute-force oracle (20,000 dup windows, full-tuple equality) and two seeded 200k-trial Five of a Kind anchors (232 in [179,269]; 35 in [15,48])**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-25T01:41:00Z
- **Completed:** 2026-08-25T01:55:56Z
- **Tasks:** 3
- **Files modified:** 5 (all new)

## Accomplishments

- Every duplicate co-occurrence shape from 07-RESEARCH's impossibility table is caught by a zero-allocation value-equality gate (stamped `Int32Array(52)` + generation counter with overflow wrap) and routed away from the raw stock evaluator
- Five of a Kind exists as strength 10 above Royal Flush; five deuces — the stock evaluator's silent-High-Card garbage case — asserts strength 10 explicitly (D-16)
- The suit-remap proxy preserves rank multiplicities exactly; the flush zone's one-suit scorer + `max(custom, proxy)` handles the only region where no legal proxy exists
- Candidate ≡ oracle on the full (category, tiebreak) tuple over 20,000 generated duplicate windows; the oracle itself validated against the stock evaluator on 25,000 clean windows (0 mismatches on both legs)
- Both D-13 statistical anchors landed comfortably inside their 3-sigma bands on the first run — no reseeding, no band motion

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate, Five-of-a-Kind branch, suit-remap proxy, flush scorer, extended comparator** - `cc5657b` (feat) — RED (36 failing vectors) → GREEN in one commit per the plan's single-commit-per-task rule
2. **Task 2: Brute-force oracle + D-13 property suite** - `630078f` (test) — RED (missing oracle module) → GREEN
3. **Task 3: Seeded Five-of-a-Kind frequency anchors** - `f40567f` (test)

## Shipped Interface (plans 07-03 and 07-06 are written against this)

```typescript
// src/engine/evaluatorTwoDeck.ts
export const FIVE_OF_A_KIND = 10;
export type ExtendedStrength = HandStrength | 10;

export interface HandTwoDeck {
  strength: ExtendedStrength;
  hand: Card[];            // proxy path MAY contain a synthetic (suit-remapped) card — display-only
  tiebreak?: number[];     // present ONLY on custom-scored hands (5oak, dup-flush zone)
}

export function evaluateHandTwoDeck(holeCards: [Card, Card], communityCards: Card[]): HandTwoDeck;
export function compareHandsTwoDeck(a: HandTwoDeck, b: HandTwoDeck): number; // +1/0/-1, never -0
export function findDuplicatesForTesting(cards: readonly Card[]): boolean;   // test-only
export function setGenerationForTesting(value: number): void;                // test-only

// src/engine/twoDeckOracle.ts — TEST-ONLY
export interface OracleResult { strength: number; tiebreak: number[] }
export function oracleScore(cards: readonly Card[]): OracleResult;
```

Window sizes 2-7 are handled (5- and 6-card `lockedInCategory` shapes explicitly tested; the proxy/pigeonhole arguments only get easier below 7 cards).

## Statistical Anchors (final N, seed, measured counts)

| Anchor | N | Seed | Closed form | E[count] | 3σ band | **Measured** |
|--------|---|------|-------------|----------|---------|--------------|
| Conditional (hero `[Ah,Ah]`, 5-card boards from the 102-card conditioned pool) | 200,000 | 20260824 | 93318 / 83291670 = 1.1204e-3 | 224.1 | [179, 269] | **232** |
| Marginal (uniform 7-of-104 windows) | 200,000 | 20260824 | 3,354,728 / 21,243,342,120 = 1.5792e-4 | 31.6 | [15, 48] | **35** |
| Companion (20,000 clean 1-deck windows) | 20,000 | 20260824 | — | 0 | exact | **0** Five of a Kind, **0** strength mismatches vs `evaluateHand` |

## Heavy Property Sweeps (case counts and wall time)

| Sweep | Cases | Wall time (this machine, solo run) | Timeout |
|-------|-------|-----------------------------------|---------|
| Leg 1: oracle ≡ stock on clean windows | 25,000 (250/run × 100 fc runs) | 920 ms | 30,000 ms |
| Leg 2: candidate ≡ oracle full tuples on dup windows | 20,000 (200/run × 100 fc runs, ~19.4% rejection acceptance) | 1,713 ms | 30,000 ms |
| Leg 3: monotonicity (copy never weakens) | ≤20,000 (rare all-doubled windows skipped) | 1,425 ms | 30,000 ms |

## Files Created/Modified

- `src/engine/evaluatorTwoDeck.ts` - The gate, Five-of-a-Kind branch, suit-remap proxy, one-suit flush scorer, extended comparator (562 lines)
- `src/engine/evaluatorTwoDeck.test.ts` - 36 value-asserting vectors: GATE_SHAPES sweep, generation wrap, clean parity, 5oak, comparator ordering, proxy rank preservation, dup-flush zone, straight non-extension, window sizes, sign convention
- `src/engine/twoDeckOracle.ts` - TEST-ONLY brute-force best-of-C(n,5) multiset scorer, zero imports from either production evaluator module
- `src/engine/evaluatorTwoDeck.property.test.ts` - 7 properties (Legs 1-3, never-HighCard, gate totality vs `cardCounts` recount, comparator totality, clean-window no-tiebreak)
- `src/engine/fiveOfAKindFrequency.test.ts` - Both seeded anchors with closed forms/SE arithmetic in provenance comments + the 1-deck companion sweep

## Decisions Made

- **Full-window proxy counts (implementation detail beyond the research pseudocode):** the proxy builder classifies and counts ALL keep-cards before choosing any substitution suit. Choosing from prefix-only counts could pick a suit that later keep-cards fill to 5 — a manufactured phantom flush. This is an implementation-order clarification of 07-RESEARCH's "lowest current proxy suit count" wording, not a semantic change; the step-5 defense assertion and the oracle sweep both pin it.
- **Comparator tie checks via sum arithmetic in the totality property** (`ab + ba === 0` plus per-value `Object.is(v, -0)` checks) to keep the never-`-0` discipline testable without false positives.
- Everything else followed 07-RESEARCH's decision tree exactly — no deviations from the algorithm spec.

## Deviations from Plan

None - plan executed exactly as written. (The plan's TDD tasks were executed RED→GREEN with a single atomic commit per task, per the execution rules given to this executor.)

## Issues Encountered

- Vitest's configured reporter swallows `console.log` from passing tests, so the anchors' measured counts were captured via temporary scratch-file instrumentation (added, run, removed before commit — the committed test file contains only the band assertions).

## Verification Results

- `npx vitest run src/engine`: 17 files / 179 tests, 0 failures, 0 skipped
- `npx vitest run` (full suite): **55 files / 743 tests** vs the 52 / 697 baseline (+3 files, +46 tests); no pre-existing test file modified (`git diff --stat 343018a..HEAD` lists exactly the five `files_modified` paths)
- `npx tsc --noEmit`: clean; `npx eslint .`: clean; `npm run build`: clean
- `git grep -n "hand-evaluator" -- src/engine/evaluatorTwoDeck.ts src/engine/twoDeckOracle.ts`: no matches — `evaluator.ts` remains the only direct library importer
- `evaluatorTwoDeck.ts` contains `Int32Array(52)` and none of: `new Set(`, `Set<Card>`, `.includes(`, `twoDeckOracle`, the TS keyword `enum` (not even as a substring) — ready for plan 07-03's `shoePath.guard.test.ts` extension on arrival

## Known Stubs

None — no placeholder values, no unwired data paths. The `HandTwoDeck.hand` synthetic-card possibility on the proxy path is documented as display-only by design (07-RESEARCH Pitfall 5), not a stub.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 07-03 (equity/worker hoist) and 07-06 (lockedCategory routing) can consume `evaluateHandTwoDeck`/`compareHandsTwoDeck`/`FIVE_OF_A_KIND` exactly as specified in the plan's `<interfaces>` block — shipped signatures match verbatim
- The module's prohibition-token cleanliness means `shoePath.guard.test.ts` can add it to `noSetFiles` and an `.includes(`-prohibition list with zero allowlisting
- The 07-03 end-to-end assertion (11-length snapshot, index-10 tallies) can lean on the anchors here rather than re-paying 200k trials

## Self-Check: PASSED

- All 5 source/test files + this SUMMARY exist on disk
- Commits `cc5657b`, `630078f`, `f40567f` present on `worktree-agent-a67ca7f88f5e2b241`

---
*Phase: 07-2-deck-holdem-evaluation*
*Completed: 2026-08-24*
