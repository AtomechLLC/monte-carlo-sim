---
phase: 06-blackjack-core-odds-loop
plan: 01
subsystem: engine
tags: [typescript, vitest, fast-check, pure-rand, monte-carlo, blackjack]
status: complete

# Dependency graph
requires:
  - phase: 04-multiset-deck-streaming-foundation
    provides: "shoeWithout/buildShoe/cardCounts count-aware shoe primitives and createRng/createDrawer/drawN seeded sampling — consumed UNMODIFIED"
provides:
  - src/engine/blackjackHandValue.ts — handTotal / isNatural / playDealerHand / classifyDealerOutcome / compareToDealer (D-03/D-03a/D-04)
  - src/engine/blackjackConditioning.ts — deriveBlackjackConditionedState / liveShoeLedger / resolveNaturals (the dual-exclusion-set sole readers, D-01/D-02)
  - src/engine/blackjackEquity.ts — BlackjackConditionedState, BLACKJACK_TRIAL_CARD_BUDGET=12, runBlackjackTrials (one draw per trial, disjoint cursor prefixes)
  - src/worker/blackjackProtocol.ts — DEALER_BUCKET_ORDER / DEALER_BUCKET_COUNT / BUCKET_INDEX, BlackjackProgressSnapshot, BlackjackSimulationApi (the wire types both wave-2 plans consume)
affects: [06-02, 06-03, 06-04, 06-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-exclusion-set rule: odds pool keeps the hidden hole card; live ledger always spends it — two sole-reader functions, never a third ad-hoc exclusion list"
    - "One drawUnknown() per trial servicing four stats from disjoint cursor prefixes (common random numbers, variance reduction not bias)"
    - "Trial loop delegates dealer playout to playDealerHand via a drawNext closure over the shared cursor — one S17 implementation, one set of vectors"
    - "Module-scope Card->value Map built once from ALL_CARDS via getRank; getRank never called inside trial-loop functions"
    - "Statistical anchors: same-seed two-arm comparison, SE-derived bands with the arithmetic stated in comments, negative control demonstrated red before commit"

key-files:
  created:
    - src/engine/blackjackHandValue.ts
    - src/engine/blackjackHandValue.test.ts
    - src/worker/blackjackProtocol.ts
    - src/engine/blackjackEquity.ts
    - src/engine/blackjackEquity.property.test.ts
    - src/engine/blackjackDealerOutcome.test.ts
    - src/engine/blackjackConditioning.ts
    - src/engine/blackjackConditioning.test.ts
    - src/engine/blackjackNaturalFrequency.test.ts
  modified: []

key-decisions:
  - "Option A locked in code: hypothetical dealer naturals are sampled, never reject-sampled away — keeps numbers comparable to the published upcard literature; Option B named in the trial-loop comment as a deferred rigor enhancement requiring its own decision record"
  - "deckCount is REQUIRED on BlackjackConditionedState and both conditioning readers (no `= 1` default) so a forgotten deck-toggle wire-through fails to compile"
  - "DEALER_BUCKET_COUNT and BUCKET_INDEX are both derived from the DEALER_BUCKET_ORDER tuple (satisfies-checked), so the three can never drift apart"
  - "The dealer-outcome sanity fixture is a rank-neutral 2-card hand in a 2-deck shoe — a rank-concentrated fixture measurably perturbs the upcard ranking through legitimate conditioning (see Deviations)"
  - "T-06-06 stays transferred: the remainingDeck.length >= BLACKJACK_TRIAL_CARD_BUDGET defensive check is deliberately NOT in runBlackjackTrials — it belongs in plan 06-03's worker validate hook"

patterns-established:
  - "Blackjack engine modules cite D-NN tags and PITFALLS Pitfalls inline at the code they justify, mirroring shoe.ts's doc-comment style"
  - "Every 'what remains in the shoe' read in the blackjack path goes through exactly one of the two conditioning sole readers"

requirements-completed: [BJ-03, BJ-04, BJ-07]

# Metrics
duration: 25min
completed: 2026-08-24
---

# Phase 6 Plan 01: Blackjack Rules Engine & Monte Carlo Trial Loop Summary

**The complete blackjack rules engine (soft-total demotion loop, 2-card natural guard, S17 playout, dealer-natural comparison priority), the dual-exclusion-set conditioning readers, and a one-draw-per-trial Monte Carlo loop servicing all four displayed stats — pinned by 53 new tests including a 2,000,000-deal-per-arm D-12 anchor whose band deterministically excludes a with-replacement sampler.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-24T21:35Z (npm ci in fresh worktree)
- **Completed:** 2026-08-24T21:55Z (final verification)
- **Tasks:** 4 (all RED→GREEN where tdd="true")
- **Files modified:** 9 (9 created, 0 modified — purely additive)

## Accomplishments

- All three PITFALLS traps are pinned by exact-value vectors: `[6h,6c,Ad]` is hard 13 and `[Ah,Ac,Ad,8c]` is soft 21 (Pitfall 2's demotion loop), `[Ah,6c]` stands under S17 while `[6c,Td,Ah]` stands as a demoted hard 17 (Pitfall 3), and a three-card 21 is never a natural (Pitfall 4).
- `compareToDealer`'s dealer-natural branch (06-RESEARCH Pitfall F) is asserted both directly and through the trial loop: a hypothetical 2-card dealer 21 lands in the `natural` bucket and beats a player 21 as a loss, never a push.
- The dual-exclusion-set rule exists as two separately-documented sole readers whose difference is asserted, not described: the hidden hole card is provably IN the odds pool and provably ABSENT from the live ledger, and the two pools provably coincide only once the hole is revealed (at both deck counts).
- One `drawUnknown()` per trial services the 7-bucket dealer distribution, bust-if-hit, Stand and Hit outcomes from disjoint cursor prefixes — proven by a counting wrapper, a scripted overlap trap, and count-aware 2-deck sampling properties; every tally reconciles to `trialsCompleted` under property testing.
- The trial loop's dealer playout IS `playDealerHand` (drawNext closure over the shared cursor, zero `while` loops of its own) — a scripted multi-ace demotion chain tallies exactly the bucket `playDealerHand` itself produces.
- Seeded dealer-outcome sanity at 200,000 trials/upcard: bust ranking measured 5s=43.21% / 6s=43.06% (top two), ten-values 21.10%, 9s=23.15%, As=11.55% (bottom), overall 28.4% inside the 25-32% band.
- Full regression bar cleared: 42 test files / 440 tests pass, 0 skipped (baseline 37 / 388; +5 files / +52 tests, all additive, no pre-existing test modified), `npx tsc --noEmit` clean, `npx eslint .` clean, `npm run build` exits 0.

## D-12 Anchor Record (BJ-07)

- **N = 2,000,000 deals per arm, seed 20260824 (same seed both arms).**
- **Measured:** 1-deck **4.8525%** (closed form 64/1326 = 4.8265%, deviation +0.0260pp, inside the ±0.06pp band); 2-deck **4.7885%** (closed form 256/5356 = 4.7797%, deviation +0.0088pp, inside band). Direction: 4.8525% > 4.7885% — strict, as asserted.
- **Negative control (run and reverted before commit):** replacing the without-replacement `drawN` with two independent uniform picks made BOTH arms converge on the identical **4.7365%** — the infinite-deck signature. The 1-deck **BAND** assertion went red (deviation 0.0900pp > 0.06pp), which is the required primary detector; the direction assertion would also have failed (arms exactly equal, not strictly ordered). The control code was reverted; `grep` confirms no `uniformInt`/negative-control residue in the committed file.

## Task Commits

Each task was committed atomically (RED and GREEN verified in-session before each commit):

1. **Task 1: Hand values, naturals, S17 playout, dealer-natural comparison** — `5318c8b` (feat)
2. **Task 2: Trial loop, fixed card budget, streaming wire types** — `bbae8c0` (feat)
3. **Task 3: Dual-exclusion-set readers and deal-time natural resolution** — `0563836` (feat)
4. **Task 4: D-12 natural-frequency anchor** — `d297960` (test)

## Files Created/Modified

- `src/engine/blackjackHandValue.ts` — rules engine (contains the literal `while (total > 21 && softAces > 0)`)
- `src/engine/blackjackHandValue.test.ts` — 30 exact-value vectors from the 06-RESEARCH tables
- `src/worker/blackjackProtocol.ts` — fixed 7-bucket order + snapshot/API wire types (type-only imports back into the engine; DEFAULT_* constants deliberately NOT relocated)
- `src/engine/blackjackEquity.ts` — conditioned state, 12-card budget, `runBlackjackTrials`
- `src/engine/blackjackEquity.property.test.ts` — 5 properties + 3 scripted single-trial behaviors
- `src/engine/blackjackDealerOutcome.test.ts` — seeded bust-ranking/band sanity sweep
- `src/engine/blackjackConditioning.ts` — the two sole readers + `resolveNaturals` (contains `shoeWithout(` exactly twice, zero `new Set(`)
- `src/engine/blackjackConditioning.test.ts` — 12 fixture tests incl. the 2-deck sibling-copy case
- `src/engine/blackjackNaturalFrequency.test.ts` — the D-12 anchor

## Decisions Made

- Option A (no rejection sampling of hypothetical dealer naturals) locked in the trial-loop comment, per the plan's audit record.
- `unknownCardsPerTrial` keeps the frozen `(state)` parameter with a documented `void state;` read — the interface contract downstream plans compile against is preserved while staying lint-clean with no inline disables.
- Dealer-outcome sanity fixture: rank-neutral `['2h','3d']` at 2 decks (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dealer-outcome sanity fixture perturbed the ranking it was asserting**
- **Found during:** Task 2 (first run of `blackjackDealerOutcome.test.ts`)
- **Issue:** The initial fixture (player `['7h','7c']` at 1 deck) removes half of all sevens, and 7 is the instant-17 hole for a T upcard / instant-16 for a 9 — legitimate conditioning that inverted the 4-vs-6 and 9-vs-T rankings (measured 5s=42.19 / 4s=41.84 / 6s=41.26; Ts=22.46 > 9s=22.27). The engine was correct; the fixture made the structural assertion unmeasurable.
- **Fix:** Rank-neutral player hand `['2h','3d']` in a 2-deck shoe (perturbation ~10x smaller than the asserted 1-2pp gaps); the plan explicitly allows either deck count for this structural check. Fixture rationale recorded in the test comment.
- **Files modified:** `src/engine/blackjackDealerOutcome.test.ts`
- **Commit:** `bbae8c0` (fix folded into the task commit — the buggy fixture never landed)

### Deliberate divergences from the 06-RESEARCH sketch (recorded per the plan's output spec)

- **`playerNow` hoisted out of the trial loop:** the research sketch computed the Stand-path player total inside each trial; it is invariant across trials, so it is computed once before the loop. Pure micro-optimization, identical semantics.
- **`unknownCardsPerTrial` keeps its parameter:** the research sketch showed a zero-parameter function; the plan's frozen interface declares `(state: BlackjackConditionedState)`. Implemented with the parameter plus a `void state;` read for lint cleanliness.
- **`DEALER_BUCKET_COUNT` derived, not literal:** declared as `DEALER_BUCKET_ORDER.length` (literal type 7 via the `as const` tuple) instead of a second hand-written `7`, with `satisfies readonly DealerBucket[]` proving the tuple covers the union.
- **`handTotal` never calls `getRank`:** the research sketch called `getRank` per card inside `handTotal`; per the plan's action (module-scope `Map<Card, number>` + ace set built once from `ALL_CARDS`), rank resolution happens once at module load.

## Issues Encountered

None beyond the fixture issue above. No auth gates, no package installs (zero, per T-06-SC — `npm ci` from the committed lockfile only).

## User Setup Required

None.

## Next Phase Readiness

- Both wave-2 plans can compile against `blackjackProtocol.ts` (`DEALER_BUCKET_ORDER`, `BUCKET_INDEX`, `BlackjackProgressSnapshot`, `BlackjackSimulationApi`) and `blackjackEquity.ts` (`BlackjackConditionedState`, `runBlackjackTrials`, `makeEmptyBlackjackTotals`, `BLACKJACK_TRIAL_CARD_BUDGET`).
- **Handoff to 06-03 (recorded so it cannot fall between plans, T-06-06):** the `remainingDeck.length >= BLACKJACK_TRIAL_CARD_BUDGET` defensive check and the WR-02/D-09 `deckCount` shape validation belong in `createBlackjackSimulationApi`'s `validate` hook — they are deliberately absent from `runBlackjackTrials`.
- No shipped Hold'em file was touched (`git diff --stat` vs. base `7b9ca13` lists exactly the 9 plan files); golden/parity suites ran green untouched in the full-suite gate.

## Known Stubs

None — all functions are fully implemented and wired; no placeholder values, no TODO/FIXME markers.

## Threat Flags

None — no new security-relevant surface beyond the plan's threat model (no network, no auth, no file access, no schema changes; T-06-01..05 mitigations implemented as asserted tests, T-06-06 transferred to 06-03 as recorded above).

## Self-Check: PASSED

- All 9 created source/test files verified present on disk.
- All 4 task commits (`5318c8b`, `bbae8c0`, `0563836`, `d297960`) verified in `git log` atop base `7b9ca13`.
- Full suite 42 files / 440 tests green, 0 skipped; `npx tsc --noEmit` clean; `npx eslint .` clean; `npm run build` exit 0.
- `git diff --stat 7b9ca13..HEAD` lists exactly the 9 plan files; working tree clean; no untracked files.
