# Phase 7: 2-Deck Hold'em Evaluation Layer - Research

**Researched:** 2026-08-25
**Domain:** Duplicate-aware 7-card Hold'em evaluation over a 104-card (2-deck) shoe — gate design, scoring algorithm, comparison semantics, Five of a Kind statistics, trial-hot-path integration, and every guard/golden/worker surface Phase 7 touches
**Confidence:** HIGH for the evaluation algorithm (validated against a brute-force oracle on 300,000 windows this session, 0 mismatches), HIGH for all probability anchors (exact combinatorics, independently cross-checked against a 2M-window Monte Carlo run), HIGH for integration surfaces (direct source reading of every touched file), MEDIUM-HIGH for the two explicitly-flagged working conventions (Assumptions A1/A2)

## Summary

The headline empirical finding of this research **corrects the milestone-level PITFALLS.md Pitfall 7 claim**. Direct spike runs against the installed `@poker-apprentice/hand-evaluator@4.3.0` show that `evaluateHoldem` does NOT throw on "ANY duplicate rank+suit co-occurrence." Its real behavior on duplicate inputs splits three ways: (1) most duplicate shapes (a pair of identical cards, split dups, board dups, multiple distinct dup pairs, dup-completed quads/boats) return results — and, remarkably, *correct* results under multiset rank semantics, because the no-flush lookup path only sees rank multiplicities; (2) rank-count ≥ 5 inputs are undefined behavior — five *aces* throw `TypeError: C is not iterable` while five *deuces* silently return **High Card** (worse than crashing); (3) inputs where a duplicated value sits inside a 5+-physical-card suit are silently corrupted whenever that suit has fewer than 5 *distinct* ranks — returning `StraightFlush` with malformed 0/1/3/4-card hand arrays. None of this changes the locked design (D-04's gate routes every duplicate-containing window away from the raw stock evaluator — correct, since the "working" cases are out-of-contract accidents a library update could change), but it precisely defines what the custom branch must actually compute and proves that "no crash" is not an acceptance signal — silent garbage is the dominant failure mode.

The primary deliverable (D-06) is fully specified and **validated in this session**: a stamped-array duplicate gate (O(7), zero-allocation, ~104ns), a Five-of-a-Kind branch (rank count ≥ 5, category index 10), a **suit-remap proxy** for all other duplicate windows (each duplicate copy is replaced by the same rank in an unused suit, producing a legal input whose stock evaluation is *provably identical* to the true multiset evaluation — a pigeonhole argument over the 7-card window makes phantom flushes impossible), and a small custom flush scorer for the one zone where no legal proxy exists (a duplicated value inside a 5+-card suit). The naive dedupe projection (candidate (a) in the phase brief) is **disqualified with a concrete counterexample**: deduping `[Ah Ah Jc 9s 7h 5d 2c]` loses the physical pair of aces and mis-scores a One Pair hand as High Card. The full candidate algorithm was implemented in scratch code and checked against a brute-force best-5-of-C(7,5) oracle: 0 mismatches over 200,000 random duplicate windows, with the oracle itself validated against the stock evaluator on 100,000 clean windows (0 mismatches) and the "adding a copy never weakens a hand" property confirmed over 100,000 trials.

Statistics and performance are nailed down with exact arithmetic: 19.39% of uniform 7-card windows from a 104-card shoe contain a duplicate (closed form, confirmed empirically); the Five of a Kind rate is 1.579×10⁻⁴ marginally and 1.120×10⁻³ conditioned on holding both copies of one value — the latter is the recommended seeded anchor (E[count] ≈ 224 at 200k trials, tight enough for a ±3σ assertion). Blended 2-deck evaluation cost is ≈ +10% per evaluation versus the 1-deck path (micro-benchmarked against the installed package); the 1-deck path pays zero (the gate is behind a `deckCount === 2` branch hoisted out of the trial loop), and the 100ms-throttled streaming cadence is unaffected.

**Primary recommendation:** Build `evaluateHandTwoDeck`/`compareHandsTwoDeck` in a new wrapper module exactly per the decision tree in "The Duplicate-Aware Evaluation Algorithm" below — gate → Five of a Kind → suit-remap proxy → (flush zone only) max(custom flush score, proxy rank hand) — and integrate via evaluator-function hoisting in `runTrials`, with `lockedInCategory` routed through the same wrapper (it is a second, main-thread stock-evaluator call site that would otherwise receive duplicate inputs at 2 decks).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mode entry & lifecycle**
- **D-01:** 2-deck Hold'em is entered via a HOLD'EM-LOCAL deck toggle in Hold'em's control bar, mirroring blackjack's segmented control verbatim (Phase 6 A4 pattern: same wrapper/active-state/aria-pressed, labels "1 deck" / "2 decks", zero accent). Phase 8 unifies/absorbs both local toggles into the cross-game control — build this one to be absorbable (same component conventions), not bespoke.
- **D-02:** Unlike blackjack's same-cards re-run (BJ-07 findability), the Hold'em toggle TRIGGERS A FRESH DEAL when clicked with a hand on the table (and simply sets deckCount when idle). Rationale: Hold'em's whole runout is predetermined at deal from a deckCount-sized shoe (Phase 2 D-02 discipline) — switching shoes mid-hand would invalidate the predetermined runout and every settled cache entry. `deal()` already clears the cache; the CR-02 dealNonce generation guard (06-REVIEW fix) already protects the stream. Same-cards cross-deck comparison is NOT an HE2 requirement.
- **D-03:** The Hold'em odds cache key gains no deckCount dimension — toggle → fresh deal → cache cleared makes the key unambiguous within a hand. The planner MUST add a guard test pinning that a deck toggle always passes through `deal()`'s cache clear (no path may reuse a 1-deck settled entry in 2-deck mode).

**Evaluation layer (the correctness-critical core)**
- **D-04:** Duplicate handling is a WRAPPER around the stock evaluator, not a replacement: a cheap duplicate-detection gate runs on every 7-card evaluation input in 2-deck mode; duplicate-free hands delegate to `evaluateHoldem` unchanged (the 1-deck path NEVER pays the gate — deckCount=1 trials must remain byte-identical to v1.0, golden-protected). The gate must catch EVERY duplicate co-occurrence shape, not just rank-count ≥5 (STATE research note).
- **D-05:** Ranking convention locked (STATE flag, working convention): Five of a Kind ranks ABOVE Royal Flush. It renders as its own category-table row ONLY in 2-deck mode (1-deck mode's table is unchanged — guard-pinned).
- **D-06:** The duplicate-aware evaluation path's exact algorithm (how to score a duplicate-containing 7-card hand, comparison semantics between two duplicate-containing hands, kicker/tie rules with duplicate ranks, integration point in the trial hot path at 200k-trial throughput) is the PHASE RESEARCHER'S primary deliverable — do not improvise it at planning time. Requirements on the result: total order consistent with the stock comparator on duplicate-free hands; deterministic; property-testable (e.g., "adding a copy of a card never weakens a hand"); fast enough that 2-deck trials stay in the same performance envelope as 1-deck (worker streaming cadence unchanged).
- **D-07:** WR-04 folds in here: strengthen the shoe-path guard against `.includes()`-style value-membership regressions and add behavioral 2-deck CardPicker tests (both copies pickable, third copy blocked — DECK-04's remaining-copy state exercised in real UI tests).

**UI (copy cue + table)**
- **D-08:** HE2-03 copy cue: a small corner badge on the SECOND visible copy of any duplicated card on the felt (board + revealed holes + hero hole), visible only in 2-deck mode, using existing badge tokens (no new accent). Exact treatment (glyph, corner, size) is the UI researcher's call within tokens; it must survive card animations (badge rides the card, not the slot) and be screen-reader-labelled.
- **D-09:** Five of a Kind row: appears above Royal Flush at the TOP of the category table in 2-deck mode, same row conventions (label + formatPct + locked-in ✓ eligibility). The 1-deck table renders zero trace of it (no hidden row, no colspan artifacts) — DOM-absence pinned both ways, mirroring the Phase 5 isolation discipline.
- **D-10:** All new testids lowercase-hyphenated, `holdem-` prefix for Hold'em-scoped additions (e.g., `holdem-deck-toggle`, `holdem-deck-toggle-1/-2`, `category-five-of-a-kind`, copy-cue testid per UI spec); copy conforms to the block-list.

**Guards & non-negotiables**
- **D-11:** D-08-class protection carried forward: at deckCount=1, Hold'em's external behavior is byte-identical — both golden files, the five frozen v1 suites, and `simulationApi.test.ts` stay untouched and green. Blackjack files are NOT touched this phase (its local toggle, stores, engine all frozen).
- **D-12:** WR-03 RETIRES this phase: after the duplicate-aware layer ships, deckCount:2 into the Hold'em trial path becomes legal. The retirement is explicit — remove/retarget the WR-03 compliance comments and extend the worker validation so poker deckCount=2 is accepted end-to-end (the 06-03 acceptance test that pinned the `102 cards, got 101` rejection gets retargeted to the new legal path, never deleted).
- **D-13:** Property tests are mandatory for the evaluation layer: seeded statistical anchor for Five of a Kind frequency (researcher supplies the closed-form/reference value + tolerance), duplicate-hand comparison properties, and the "gate catches every duplicate shape" exhaustive/property sweep.

### Claude's Discretion
- Evaluation-wrapper module decomposition, copy-cue exact visual treatment within tokens, category-table row-injection mechanism, whether the Hold'em toggle lives beside the Deal button or the switcher, test file organization.

### Deferred Ideas (OUT OF SCOPE)
- Cross-game toggle component (Phase 8), deck counts beyond 2 (v2.x), deck-count delta callout UI (v2.x), visual excellence pass (VISUAL-EXCELLENCE-PLAN.md, pending insertion decision), blackjack picker (v2.x).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HE2-01 | User can enable a 2-deck Hold'em variant; dealing, the picker, street navigation, and opponent reveal all work over the 104-card shoe | Integration Map below: `gameStore` gains `deckCount` + `setDeckCount` (D-02 fresh-deal semantics); `deal()` swaps `deckWithout(picked)` → `shoeWithout(deckCount, picked)` (proven byte-identical at deckCount=1 by Phase 4's parity property + goldens); `deriveConditionedState` call sites pass `deckCount`; CardPicker's pinned `const deckCount: DeckCount = 1` becomes a live read AND is passed to `setPick` (closing WR-01 early — see Integration Map §7) |
| HE2-02 | Hands containing duplicate cards evaluate correctly via a duplicate-aware evaluation layer — any duplicate co-occurrence is detected BEFORE delegating to the stock evaluator (which crashes on duplicates), and Five of a Kind ranks above Royal Flush with its own category-table row in 2-deck mode | "The Duplicate-Aware Evaluation Algorithm" section: complete validated algorithm, gate spec, comparison semantics, category-index mapping (Five of a Kind = index 10), plus the empirical characterization proving silent-garbage (not just crash) is the failure mode being prevented |
| HE2-03 | Two copies of the same card are visually legible on the felt (a copy cue), so a duplicate never reads as a rendering bug | Integration Map §9: badge rides `PlayingCard` inside the `AnimatedCard` wrapper (positional keys `${slot}-${dealNonce}` are duplicate-safe, verified); second-copy determination via a deterministic canonical scan order over visible cards |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Zero new runtime dependencies** — locked for v2.0 (STATE.md Decisions); this phase is pure hand-written TypeScript over the installed stack. Confirmed feasible: the entire duplicate branch needs only the already-installed `@poker-apprentice/hand-evaluator` (called on legal proxy inputs) plus small custom scoring code.
- **`src/engine/evaluator.ts` is the ONLY module permitted to import `@poker-apprentice/hand-evaluator` directly** (its own header comment). The new wrapper module must import `evaluateHand`/`compareHands` from `evaluator.ts`, never the library — or the planner may deliberately extend the allowance to the new wrapper module with a same-commit guard amendment. Recommendation: route through `evaluator.ts`'s existing exports (they are sufficient — see algorithm spec), keeping the import invariant untouched.
- **Web Worker + Comlink for all Monte Carlo trials**; no trials on the main thread. The wrapper runs inside the existing worker via `runTrials` — no new worker surface.
- **No `Math.random()` in simulation paths** — unchanged; this phase adds no new RNG call sites (the gate/proxy are deterministic).
- **DOM + SVG + Motion only** for the copy cue and toggle — reuse existing badge tokens (D-08) and the Phase 6 segmented-control pattern (D-01).
- **TypeScript 6.x line** — no new tooling.
- **GSD workflow enforcement** — all file changes flow through planned execution, not ad-hoc edits.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Duplicate gate + duplicate-aware evaluation | Browser / Client (Web Worker) | Main thread (one call site) | Hot path is `runTrials` inside the worker; `lockedInCategory` (OddsTable's ✓ column) is a second, main-thread consumer of the same wrapper |
| Deck-count state + toggle → fresh-deal lifecycle | Browser / Client (Zustand `gameStore` + `HoldemGame`) | — | Hold'em-local per D-01; mirrors blackjack's D-10 precedent ("local deck count lives in the game's own store") |
| Five of a Kind odds-table row | Browser / Client (React `OddsTable`) | — | Conditional 11th row driven by the extended category index; 1-deck DOM unchanged |
| Copy-cue badge | Browser / Client (React `PlayingCard`/felt components) | — | Pure render-time derivation from visible-card state; rides the card inside `AnimatedCard` |
| Worker validation retarget (deckCount=2 end-to-end) | Browser / Client (Web Worker `simulationApi`) | — | Validation formula already deckCount-aware (verified); only the WR-03 test pins retarget |

No CDN/SSR/database tier is implicated (client-only app, unchanged).

## Standard Stack

### Core

**No new libraries.** Every dependency is already installed and in use:

| Library | Version | Purpose | Why Standard (this phase) |
|---------|---------|---------|---------------------------|
| `@poker-apprentice/hand-evaluator` | 4.3.0 (installed) | Stock evaluation of duplicate-free windows AND of legal suit-remap proxies | The wrapper delegates to it for every window except the two custom zones; empirically characterized this session (see next section) |
| `@poker-apprentice/types` | installed | `Card`/`Rank`/`Suit`/`ALL_CARDS`/`HandStrength`, `getRank` | Card index tables for the stamped gate build from `ALL_CARDS` once at module load |
| `zustand` | ^5.0.15 | `gameStore.deckCount` | Same store, one new field + action |
| `@fast-check/vitest` | ^0.4.1 | D-13 property suites | Established pattern (`equity.property.test.ts`, `multisetSampling.property.test.ts`) |
| `pure-rand` via `createRng` | ^8.4.2 | Seeded anchors | Unchanged |

**Installation:** None — zero new packages this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (locked: "Zero new runtime dependencies for v2.0"). The Package Legitimacy Gate protocol does not apply — skip it. If a future plan discovers a genuine need for a new package, re-run the gate then.

## Empirical Behavior of the Stock Evaluator on Duplicate Inputs

`[VERIFIED: spike scripts run this session against the installed node_modules/@poker-apprentice/hand-evaluator@4.3.0 dist/cjs build]`

This section **supersedes the PITFALLS.md Pitfall 7 note** ("ANY duplicate rank+suit co-occurrence throws `TypeError: C is not iterable`") and CONTEXT.md's restatement of it. That claim is wrong in a way that matters: the dominant duplicate failure mode is *silent wrong answers*, not crashes.

### Full characterization table

| # | Input shape (7-card window) | Example | Stock `evaluateHoldem` result | Verdict |
|---|------------------------------|---------|-------------------------------|---------|
| C1-C3 | Clean controls (quads / pair / royal on board) | — | strength 7 / 1 / 9, correct hands | ✅ correct (baseline) |
| A1 | Duplicate pair inside hole | `[Ah Ah]` + clean board | `OnePair [Ah Ah Jc 9s 7h]` | ⚠️ "correct" by accident |
| B1 | Duplicate split hole/board | `Ah` in hole + `Ah` on board | `OnePair [Ah Ah Jc 9s 7s]` | ⚠️ "correct" by accident |
| C4 | Duplicate inside board only | board `Kd Kd` | `OnePair [Kd Kd Ah Jc 9s]` | ⚠️ "correct" by accident |
| D1 | Two distinct dup pairs | `Ah Ah` + `Kd Kd` | `TwoPair [Ah Ah Kd Kd Jc]` | ⚠️ "correct" by accident |
| J1/K1 | Dup completes quads / full house | `Ah Ad Ac + Ah` / `Ah Ah As + 9s 9c` | `Quads` / `FullHouse` | ⚠️ "correct" by accident |
| G1 | Dup irrelevant to best-5 | `2c 2c` hole + royal board | `RoyalFlush` | ⚠️ "correct" by accident |
| E1 | Five ACES (rank count 5) | `As Ah Ad Ac + As` | **`TypeError: C is not iterable`** | ❌ crash |
| E2 | Six aces (rank count 6) | `As As Ah Ah Ad Ad` | **`TypeError: C is not iterable`** | ❌ crash |
| — | Five DEUCES (rank count 5) | `2s 2s 2h 2h 2d` | **`HighCard [9d 7c 2s 2s 2h]`** — silent nonsense | ❌ **silent garbage** |
| F1 | Dup in a 5-physical-card suit, <5 distinct ranks | `Ah Ah 2h 3h 4h` hearts | **`StraightFlush hand=[Ah]`** — 1-card hand array | ❌ **silent garbage** |
| — | Same, 3 distinct | `Ah Ah Kh Kh Qh` | `StraightFlush hand=[Ah Kh Qh]` | ❌ silent garbage |
| — | Same + real quads present | `9h 9h 9s 9d 2h 3h 4h` | `StraightFlush hand=[]` (empty!) | ❌ silent garbage |
| — | 6-physical suit, 4 distinct | `Ah Ah Kh Kh Qh Jh` | `StraightFlush hand=[Ah Kh Qh Jh]` | ❌ silent garbage |
| — | Dup in 5+/6+/7-physical suit, ≥5 distinct ranks | `Ah Ah Kh Qh Jh 9h 2c` / royal variants | `Flush [Ah Ah Kh Qh Jh]` / `RoyalFlush` | ⚠️ "correct" by accident (returns the multiset flush) |

**Why the pattern:** the library's no-flush path hashes *rank multiplicities* (quinary hash) — a window with duplicate values but all rank counts ≤ 4 produces the same rank-count vector as some legal 1-deck hand, so the lookup lands on a correct answer. Rank count ≥ 5 has no table entry — undefined behavior (throw or garbage depending on where the hash lands, empirically rank-dependent: aces throw, deuces return High Card). The flush path triggers on *physical* suit counts but indexes tables by the suit's rank bitset — ≥5 physical with <5 distinct ranks produces malformed lookups (garbage `StraightFlush` with short hand arrays).

**Consequences (all locked-design-compatible, but they sharpen the plan):**
1. D-04's gate remains mandatory — the "correct by accident" cases are out-of-contract behavior of undocumented internals; a patch release could change them. The gate routes **every** duplicate window away from raw stock input.
2. **Acceptance tests must assert correct VALUES, not just "no crash."** A gate that only intercepted rank-count ≥ 5 would pass every smoke test while silently mis-scoring every dup-flush window.
3. `compare` from the library operates on plain `{strength, hand}` objects (verified: stripping to those two fields still compares; a dup-derived pair of aces compares `0` against a clean pair with equal kickers). The wrapper must nonetheless **never feed a duplicate-containing hand array into library `compare`** — the custom comparator below handles those cases without it.
4. The library exports a `DuplicateCardError` class but `evaluateHoldem` never uses it (only the unused `equity`/`simulate` engine path does) — no library-side validation can be enabled as an alternative.

## The Duplicate-Aware Evaluation Algorithm (D-06 primary deliverable)

### Semantics being implemented (the specification)

For a 5-7 card window drawn from a 2-deck shoe, evaluated as the best 5-card physical hand:

1. **Rank categories count physical cards.** Two copies of `Ah` are a real pair of aces; `Ah Ah As` is trips; `Ah Ah Ad As` is quads; `Ah Ah Ad Ad Ac` is Five of a Kind. (Matches the "physical card identity" philosophy of DECK-01 and, incidentally, what the stock evaluator's rank path computes.)
2. **Five of a Kind** (≥5 cards of one rank) is a new top category, above Royal Flush (D-05). Tiebreak: rank only; two Five-of-a-Kinds of the same rank tie (a 5-card hand has no kicker slot). Same-rank collisions between players are legal at 2 decks (8 copies of each rank exist; e.g., board holds 3 aces, two players each hold 2).
3. **A flush is any 5 physical cards of one suit** — including two identical cards (`Ah Ah 2h 3h 4h` is an ace-high flush). Within the flush category, hands compare by their 5 ranks sorted descending, as a multiset, lexicographically — the natural extension of standard flush-kicker comparison, which it reduces to exactly on clean hands. So flush `(A,A,4,3,2)` beats flush `(A,K,Q,J,9)`. *(Working convention — see Assumptions A1.)*
4. **Straights and straight flushes require 5 distinct consecutive ranks** — a duplicate copy never extends a straight. A straight flush needs 5 distinct consecutive ranks within one suit; the wheel (`A-2-3-4-5`) stays the lowest straight/SF, and A-K-Q-J-T suited stays Royal Flush.
5. **Every other category and kicker rule** is standard poker over the rank multiset (grouped by multiplicity desc, then rank desc).
6. **Total order:** category index first (0-10 with Five of a Kind = 10), then within-category tiebreaks as above — provably identical to the stock comparator on duplicate-free hands (validated, Leg 1 below).

### Duplicate co-occurrence shapes and impossibility bounds

The shoe holds exactly `deckCount` copies of each of the 52 values (`buildShoe` concatenates `FULL_DECK` twice; DECK-03 draws without replacement), so within any evaluation window:

| Shape | Possible at 2 decks? | Proof / bound |
|-------|----------------------|---------------|
| A value appearing 2× (pair of identical cards) | Yes — the basic dup shape; both copies necessarily share rank AND suit | By definition of "duplicate value" |
| A value appearing 3× ("triple-identical") | **Impossible** | The 104-card shoe contains exactly 2 copies of each value; without-replacement drawing cannot exceed the multiplicity |
| 1, 2, or 3 distinct duplicated values in a 7-window | Yes (3 dup pairs = 6 cards + 1 single) | 4 dup pairs would need 8 cards > 7 |
| Rank count 5, 6, or 7 for one rank | Yes (8 copies of each rank exist; e.g., 7 aces = `As As Ah Ah Ad Ad Ac`) | Window size caps at 7 |
| Rank count ≥ 5 for TWO ranks in one window | **Impossible** | 5 + 5 = 10 > 7 — so Five of a Kind detection per window is unique and the 13 per-rank events are disjoint (used in the closed forms below) |
| Two suits each with ≥5 physical cards | **Impossible** | 5 + 5 = 10 > 7 — at most one flush suit per window |
| A duplicated value in a different suit than its twin | **Impossible** | Identical value ⇒ identical suit — this is why the "flush zone" trigger below is well-defined |

The gate is value-equality based (any value with count ≥ 2), so it catches every shape above by construction; D-13's "gate catches every duplicate shape" sweep enumerates these shapes as explicit test vectors (dup-in-hole, dup-split, dup-in-board, two/three distinct pairs, rank counts 5/6/7, dup-completing-flush, dup-irrelevant).

### Candidate designs evaluated

| Candidate | Verdict | Why |
|-----------|---------|-----|
| **(a) Dedupe projection** — drop duplicate copies, evaluate the ≤6 distinct cards through the stock evaluator (plus a 5oak pre-check) | ❌ **DISQUALIFIED** | Loses physical pairs: dedupe of `[Ah Ah Jc 9s 7h 5d 2c]` = 6 distinct cards → stock says High Card, but the true hand is One Pair of aces (two physical copies — empirically confirmed as the correct multiset semantics, table row A1). Also breaks "adding a copy never weakens" (added copies become invisible). Any projection that *removes* cards changes rank multiplicities and is unsalvageable. |
| **(b) Full custom 7-card detector for the duplicate branch** | ⚠️ Workable but rejected as primary | Requires hand-rolling every category + kicker rule (wheel straights, grouped tiebreaks, best-5-of-7) — exactly the "Don't Hand-Roll" hazard class. Retained in *test code only*, as the brute-force oracle (21 subsets × simple 5-card scorer), where slow-and-simple is a virtue. |
| **(c) Suit-remap proxy (synthetic-card substitution), plus two small custom zones** | ✅ **RECOMMENDED** | Preserves rank multiplicities exactly (substitute same-rank-unused-suit, never remove), so the stock evaluator computes all rank-category results and kickers for us; custom code shrinks to 5oak detection (trivial) and one-suit flush scoring (small). Validated exact — see below. |

### The decision tree (production algorithm)

```
evaluateHandTwoDeck(holeCards, communityCards):          // window W = hole ∪ community, 5-7 cards
  ── ONE O(|W|) pass: rankCounts[13], suitCounts[4], duplicate values (stamped-array), dup-suit set
  1. no duplicate value          → return evaluateHand(holeCards, communityCards)   // stock, unchanged
  2. some rank r has count ≥ 5   → return { strength: 10, hand: five copies of r, tiebreak: [r] }
  3. build PROXY: for each duplicate COPY, substitute the same rank in an unused suit,
     choosing the free suit with the lowest current proxy-suit count (see proof below);
     positions (hole vs community) preserved
  4. stockProxyHand = evaluateHand(proxyHole, proxyCommunity)                       // legal input
  5. no suit s has suitCounts[s] ≥ 5 with a duplicated value in s
                                 → return stockProxyHand                            // EXACT (proven)
  6. FLUSH ZONE (dup value inside the unique ≥5-physical suit s):
       custom = scoreFlushSuit(cards of s):
                  distinct ranks of s contain a straight → RoyalFlush (A-high) or StraightFlush(high)
                  else → Flush with tiebreak = top-5 of s's physical rank multiset, desc
       return compareHandsTwoDeck(custom, stockProxyHand) > 0 ? custom : stockProxyHand
```

**Why step 5 is exact (proof sketch, validated empirically):**
- Rank multiplicities are preserved by construction → every rank-only category and kicker is identical.
- The true window has a flush only if some suit has ≥5 physical cards. In step 5's precondition, either (i) no suit has ≥5 — and the proxy cannot *create* one: forcing a substitution into a suit already holding 4 cards would require the duplicate's rank to be present in 3 other suits (rank count 4) *and* the target suit to hold 4 — 4 + 4 = 8 > 7-card window, impossible (pigeonhole); the lowest-count-free-suit choice makes this constructive; or (ii) a ≥5 suit exists but contains no duplicate — the substitution never touches it (targets are suits *lacking* the dup's rank with count ≤ 3; a ≥5 suit is excluded automatically), so the proxy's flush options equal the true hand's exactly.
- A free suit always exists: a rank with count k ≤ 4 occupying d distinct suits needs k − d substitutions into its 4 − d free suits, and k ≤ 4 ⟹ k − d ≤ 4 − d.
- **Defense-in-depth:** assert in the proxy builder that (in the step-5 branch) no proxy suit reaches 5 that wasn't already ≥5-clean in the original; throw loudly if violated. The property suite hammers this.

**Why step 6 needs the custom scorer:** when the duplicated value sits inside the ≥5 suit, no legal proxy preserves flush semantics — substituting the copy out of the suit either destroys the flush (5-physical case: `Ah Ah 2h 3h 4h` → 4 hearts → the true ace-high flush vanishes) or weakens its tiebreak (6-physical case: true multiset flush `(A,A,K,Q,J)` vs proxy's distinct flush `(A,K,Q,J,9)`). The custom scorer reads only that one suit's ≤7 cards; the `max(custom, stockProxyHand)` covers the cases where a rank-path hand (e.g., quads `9h 9h 9s 9d` alongside 5 physical hearts) legitimately beats the flush. The proxy's own flush component (when the suit retains ≥5 distinct ranks) is always dominated by `custom`, so `max` is exact.

### Result shape and comparison semantics

```typescript
// New wrapper module (suggested: src/engine/evaluatorTwoDeck.ts — decomposition is Claude's Discretion)
export const FIVE_OF_A_KIND = 10 as const;                 // extends HandStrength (0-9) upward
export type ExtendedStrength = HandStrength | typeof FIVE_OF_A_KIND;

export interface HandTwoDeck {
  /** 0-10; categoryCounts[strength] indexing keeps working — index 10 is the new row. */
  strength: ExtendedStrength;
  /** Best-5 card list. For the proxy path this may contain a SYNTHETIC card (the remapped
   *  suit) — display-only surface, currently consumed by nothing; never feed it back into
   *  physical-card accounting, and never into the library's compare (custom-scored hands
   *  are compared via `tiebreak` below, stock-path hands are already legal). */
  hand: Card[];
  /** Present ONLY on custom-scored hands (Five of a Kind, dup-flush): within-category
   *  tiebreak vector, rank indices descending. Absent ⇒ stock-comparable. */
  tiebreak?: number[];
}
```

`compareHandsTwoDeck(a, b)` — a total order, same +1/0/−1 convention as `compareHands`:

1. `a.strength !== b.strength` → numeric comparison (`HandStrength` is ascending-by-strength; index 10 tops it — this is precisely where "Five of a Kind above Royal Flush" is enforced). Consistent with the stock comparator, which also orders by strength across categories.
2. Equal strength, **both stock-shaped** (no `tiebreak`) → delegate to the existing `compareHands` (library) — clean-vs-clean and proxy-vs-proxy comparisons stay byte-consistent with v1 semantics.
3. Equal strength, **either side custom**:
   - Five of a Kind vs Five of a Kind → compare `tiebreak[0]` (rank; equal ⇒ tie, no kicker — pagat.com convention "between fives of a kind, the higher beats the lower").
   - Dup-flush cases can only carry strength 5 (Flush), 8 (StraightFlush), or 9 (RoyalFlush):
     - Flush vs Flush → lexicographic on the 5-rank descending vectors; a stock-side vector is derived from its `hand` array (5 ranks desc — identical to the library's flush-kicker order, so mixing is consistent).
     - SF vs SF → compare straight-high rank, derived defensively via a wheel-aware `straightHigh()` over the 5 cards (do not trust the library's hand-array ordering).
     - Royal vs Royal → tie.

**Kicker/tie rules with duplicate ranks** fall out of the design with no special cases: rank-category hands (pair/two-pair/trips/quads/boat/straight/high-card) are *always* stock-shaped (the proxy preserved their multiplicities), so their kicker comparisons — including kickers that are themselves duplicated ranks — ride the library's standard grouped ordering; a dup-derived pair of aces ties a clean pair of aces with equal kickers (empirically confirmed, row A1 + compare probe).

### Validation evidence (this session)

`[VERIFIED: scratch implementation of the exact algorithm above + brute-force oracle, run against the installed evaluator]`

| Leg | What | Result |
|-----|------|--------|
| 1 | Brute-force oracle (best of C(7,5)=21 subsets, simple 5-card multiset scorer implementing the semantics spec) vs **stock evaluator** on 100,000 **clean** windows | **0 mismatches** — the oracle's semantics coincide with standard poker on legal inputs |
| 2 | **Candidate algorithm** (gate → 5oak → proxy → flush-zone max) vs oracle on 200,000 **duplicate** windows | **0 mismatches** on full (category, tiebreak-vector) tuples |
| 3 | Monotonicity: best-5 of a 6-card window vs best-5 after adding a second copy of one of its cards, 100,000 trials | **0 violations** of "adding a copy never weakens a hand" |

Category histogram over the 200k duplicate windows (oracle): OnePair 56,108 · TwoPair 68,152 · Trips 28,943 · Straight 3,183 · Flush 15,395 · FullHouse 23,082 · Quads 4,942 · SF 14 · Royal 1 · FiveOfAKind 180 · **HighCard 0** — a duplicate-containing window can never be High Card (it always contains at least the identical pair). This is a free, sharp property test: *"any window the gate flags evaluates to at least One Pair."*

### The gate (hot-path spec)

Stamped-array duplicate detection — O(n), zero allocation per call, no clearing:

```typescript
// Module scope (worker-safe: single-threaded; Vitest isolates are separate processes)
const CARD_INDEX: ReadonlyMap<Card, number> = new Map(ALL_CARDS.map((c, i) => [c, i]));
const stamps = new Int32Array(52);
let generation = 0;

function findDuplicates(cards: readonly Card[]): /* dup info or null */ {
  generation++;
  for (const card of cards) {
    const idx = CARD_INDEX.get(card)!;
    if (stamps[idx] === generation) { /* duplicate found */ }
    stamps[idx] = generation;
  }
}
```

The same pass accumulates `rankCounts`/`suitCounts` (via precomputed `RANK_OF`/`SUIT_OF` index tables) so steps 2/5/6 need no second scan. Measured cost: **~104 ns per 7-card window** (vs ~2,156 ns for one `evaluateHoldem` call) — see Performance.

**Hot-path integration (`runTrials`):** hoist the function selection OUT of the per-trial loop —

```typescript
const deckCount = state.deckCount ?? 1;
const evalFn = deckCount === 2 ? evaluateHandTwoDeck : evaluateHand;   // hoisted, once per batch
const cmpFn  = deckCount === 2 ? compareHandsTwoDeck : compareHands;
const categoryCounts = new Array(categoryCountFor(deckCount)).fill(0); // 10 or 11
```

At deckCount=1 the selected functions are the identical v1 functions and the array is the identical length — external behavior byte-identical (D-04/D-11), pinned by the existing goldens. The 1-deck path never executes the gate.

## Five of a Kind Probability Anchors (D-13)

All closed forms derived independently this session (BigInt-exact arithmetic) and cross-checked against a 2,000,000-window Monte Carlo run with an independent RNG (mulberry32). `[VERIFIED: both computations this session]`

### Marginal: uniform 7-card window from the 104-card shoe

Per-rank events "≥5 of rank r in the window" are disjoint (5+5 > 7), so:

```
P(five of a kind) = 13 × [C(8,5)·C(96,2) + C(8,6)·C(96,1) + C(8,7)] / C(104,7)
                  = 13 × [56·4560 + 28·96 + 8] / 21,243,342,120
                  = 3,354,728 / 21,243,342,120
                  = 1.5792 × 10⁻⁴  ≈ 0.01579%          (Monte Carlo check: 323/2M = 0.01615% ✓ within noise)
```

### Conditional anchors (what a `runTrials`-shaped test actually measures)

`categoryCounts` semantics are per-hero-hand: hero's fixed hole + 5 board cards drawn (as the prefix of the 11-card trial draw) from the 102-card conditioned pool — marginally a uniform 5-subset of 102 (exchangeability; any prefix of a uniform without-replacement sample is itself uniform).

**Anchor A (recommended primary) — hero holds BOTH copies of one value, e.g. `[Ah, Ah]`** (pool: 6 aces, 8 of each other rank, C(102,5) = 83,291,670 boards):

```
P = [C(6,3)·C(96,2) + C(6,4)·C(96,1) + C(6,5)]/C(102,5)  +  12·C(8,5)/C(102,5)
  = [91,200 + 1,440 + 6]/83,291,670 + 672/83,291,670
  = 93,318 / 83,291,670 = 1.1204 × 10⁻³  ≈ 0.11204%
```

**Anchor B — hero holds two distinct-rank cards, e.g. `[As, Kd]`** (pool: 7 aces, 7 kings, 8 others):

```
P = 2·[C(7,4)·C(95,1) + C(7,5)]/C(102,5) + 11·C(8,5)/C(102,5)
  = [2·3,346 + 616]/83,291,670 = 7,308/83,291,670 = 8.774 × 10⁻⁵ ≈ 0.008774%
```

### Tolerance table (SE arithmetic shown — the D-12 lesson)

Binomial SE = √(N·p·(1−p)) on the count. For **Anchor A** (p = 1.1204×10⁻³):

| N trials | E[count] | SE | 3σ count band | As percentage |
|----------|----------|----|---------------|---------------|
| 50,000 | 56.0 | 7.48 | [34, 78] | 0.1120% ± 0.0449pp |
| 100,000 | 112.0 | 10.58 | [80, 144] | 0.1120% ± 0.0317pp |
| **200,000** | **224.1** | **14.96** | **[179, 269]** | **0.1120% ± 0.0224pp** |

For the **marginal** anchor (p = 1.5792×10⁻⁴): N=200,000 → E[count] = 31.6, SE = 5.62, 3σ band [15, 48].

**Recommended test design:** seed `createRng`, condition on hero `[Ah, Ah]` preflop (deckCount=2, no reveals), run 200k trials, assert `categoryCounts[10]` ∈ [179, 269] (3σ) — and, mirroring Phase 6's D-12 companion assertion, additionally assert `categoryCounts[10] > 0` at Anchor-B-style states and `=== 0` for every deckCount=1 run (the impossible-at-1-deck guard). A seeded run is deterministic, so the realized count is fixed — the 3σ band is what keeps the assertion valid if draw-consumption order legitimately changes in a future refactor (forcing a conscious re-derivation rather than a silent retune). Anchor A is preferred over B because E[count] ≈ 224 gives ±20% relative width at 3σ versus B's ±96% at the same N; hero `[Ah, Ah]` also exercises the picker's both-copies path (D-07) in the same fixture.

**Secondary distribution sanity (cheap, same run):** dup-branch share — at deckCount=2 preflop, the fraction of trials whose hero window contains any duplicate ≈ 19.4% marginally (see Performance) — but note this is *conditional on the hero hole*, so assert only a generous band (e.g., 10-35%) or skip; the Five of a Kind anchor is the load-bearing statistic.

## Ranking Convention: Five of a Kind Above Royal Flush (upgrading the STATE.md flag)

The STATE.md blocker records the convention as "single-sourced from a community forum thread." This research found two substantially better sources:

- **Pagat.com (John McLeod's card-games rules reference), "Ranking of Poker Hands":** "When playing with wild cards, **five of a kind becomes the highest type of hand, beating a royal flush**" and "Between fives of a kind, the higher beats the lower, five aces being highest of all." `[CITED: pagat.com/poker/rules/ranking.html, fetched this session]`
- **Bicycle Cards (The United States Playing Card Company), "Basics of Poker":** "Five of a Kind – This is the **highest possible hand** and can occur only in games where at least one card is wild…" `[CITED: bicyclecards.com/how-to-play/basics-of-poker, fetched this session]`

Both are wild-card contexts — no published rulebook covers two-physical-deck Hold'em (it isn't a casino game) — but the "highest possible hand, above royal flush; ties broken by rank" convention transfers directly and is now corroborated by a recognized rules reference and the USPC's official rules page, not just a forum. **D-05's convention is affirmed; the planner may mark the STATE.md flag resolved** (cite both sources in the commit).

One nuance worth recording: pagat notes that in *wild-card* play the convention **prohibits** duplicate-card hands (no "double ace flush" — a wild card may not duplicate a card you hold). That prohibition is a wild-card-assignment rule, not a physical-deck rule: in this app two identical `Ah` are physically real cards, so the dup-flush (`A,A,4,3,2` hearts) is a real hand that must rank somewhere. The multiset tiebreak (spec §3 above) is this project's working convention for it — see Assumption A1.

## Performance (D-06 envelope check)

`[VERIFIED: micro-benchmark + 2M-window frequency measurement, this session, Node on this machine — treat absolute ns as machine-relative; the ratios are the deliverable]`

**Branch frequencies** (uniform 7-card windows from the 104-shoe; closed-form dup rate: 1 − C(52,7)·2⁷/C(104,7) = **19.389%**, empirical 19.334% ✓):

| Branch | Share of all evaluations | Cost per evaluation |
|--------|--------------------------|---------------------|
| Clean → gate + stock delegate | 80.61% | 2,156 ns (stock) + 104 ns (gate) |
| Duplicate → gate + proxy build + stock on proxy | 17.74% | 2,852 ns measured end-to-end |
| Flush zone → above + one-suit custom scorer + max | 1.58% | ≈ 3,000 ns (custom scorer is a ≤7-card scan; second stock eval NOT needed — the proxy eval in step 4 is reused) |
| Five of a Kind → gate only, no stock call | 0.0158% | ≈ 150 ns |

**Blended 2-deck cost ≈ 2,380 ns/eval vs 2,156 ns clean baseline → ≈ +10% per evaluation.** The 1-deck path pays exactly 0 (hoisted function selection; no gate). Per full 200k-trial run at 4 evaluations/trial: ≈ 1.9s of evaluation compute vs ≈ 1.75s at 1-deck — same envelope. The streaming cadence is time-throttled (`progressIntervalMs` = 100ms) and batch-yielded (4,000 trials ≈ 40ms of evaluation per batch), so a 10% batch-time increase shifts convergence speed marginally and cannot affect emission cadence, cancellation latency, or the trial-counter feel. **No batch-size or cadence retuning is needed.**

(Reference note: the library README's "~18M evals/sec" figure describes its low-level rank-path benchmark, not the `evaluateHoldem` wrapper with per-call object allocation that this codebase — in v1 too — actually calls. The ~0.46M/s wrapper throughput above IS the existing v1 baseline, not a regression.)

## Architecture Patterns

### Integration Map (every touched surface, verified by direct source reading)

1. **New wrapper module** (`src/engine/evaluatorTwoDeck.ts` or similar — decomposition is Claude's Discretion): `evaluateHandTwoDeck`, `compareHandsTwoDeck`, `FIVE_OF_A_KIND`, gate internals. Imports `evaluateHand`/`compareHands` from `./evaluator` — **`evaluator.ts` stays the only direct library importer** (its header invariant untouched).
2. **`src/engine/equity.ts` (`runTrials`)**: hoisted `evalFn`/`cmpFn` selection + `categoryCounts` sized `categoryCountFor(deckCount)` (10 or 11). The tally line `categoryCounts[hero.strength]++` works unchanged (index 10 = Five of a Kind). Win/tie/lose reduction unchanged, just via `cmpFn`.
3. **`src/worker/protocol.ts` / `simulationApi.ts`**: `CATEGORY_COUNT` stays 10 (1-deck meaning unchanged); add `FIVE_OF_A_KIND_INDEX = 10` / `categoryCountFor(deckCount)`. `createSimulationApi`'s hooks lack `conditioned` access in `makeEmptyTotals`/`toSnapshot` (verified against `streamingRunner.ts`'s config signature) — recommended mechanism: **grow-on-merge** — `mergeBatch` extends `totals.categoryCounts` with zeros up to `batch.categoryCounts.length` before folding, and `toSnapshot` copies whatever length totals carry. At 1-deck the batch is length 10 → no growth → snapshots byte-identical (golden-pinned). Validation function already accepts deckCount=2 with correct expected-length and per-value-budget overlap arithmetic (verified — Phase 4/6 did this work); **no validation changes needed**, only the D-12 test retargets.
4. **`src/state/oddsStore.ts` dev guard** (`checkSnapshotConsistency`): hard-checks `categoryCounts.length !== CATEGORY_COUNT` — would console.error on every 2-deck snapshot. Must accept length 10 or 11 (report-only code, but a falsely-firing guard is noise that trains people to ignore it). The `categorySum === trialsCompleted` check still holds at length 11. Cache key gains no deckCount dimension (D-03); `deal()`'s existing `clearCache()` plus the D-02 toggle-→-fresh-deal rule make keys unambiguous — the planner MUST add the D-03 guard test (toggle always passes through `deal()`).
5. **`src/state/gameStore.ts`**: new `deckCount: DeckCount` field + `setDeckCount` action implementing D-02 (runout on table → fresh `deal()`; idle → plain set). `deal()` swaps `deckWithout(picked)` → `shoeWithout(deckCount, picked)` — byte-identical at deckCount=1 (Phase 4's parity property + `deckParity.golden.test.ts` pin exactly this equivalence, including ordering). `CARDS_PER_DEAL` (13) unchanged.
6. **`src/engine/conditioning.ts`**: NO changes — `deriveConditionedState` already takes `deckCount: DeckCount = 1` and routes through `shoeWithout` (verified). Call sites gain the argument: `HoldemGame`'s odds effect and `OddsTable`'s `lockedIndex` memo.
7. **`src/ui/CardPicker.tsx` + `src/state/pickerStore.ts` (D-07, WR-01):** `CardPicker`'s pinned `const deckCount: DeckCount = 1` (its own comment documents the requirement) becomes a live read of the Hold'em deckCount AND must be passed as `setPick`'s third argument — the store's `setPick(slot, card, deckCount = 1)` and `remainingCopies` are already count-aware (verified). **This closes WR-01 early, this phase, with tests** (CONTEXT explicitly permits and asks to note it). Behavioral tests: both copies pickable into two slots, third pick blocked, `(used)` label appears only after the second copy at deckCount=2, and the deckCount=1 behavior byte-identical. Note the picker reads Hold'em's deckCount — at 2 decks the pick pool must honor it *at deal time* too (picks with two copies of a value flow into `deal()`'s `shoeWithout(2, picked)` correctly).
8. **`src/ui/OddsTable.tsx` + `categoryLabels.ts` (D-05/D-09):** current table maps `CATEGORY_LABELS` (10 entries, index-ascending: High Card is the FIRST DOM row, Royal Flush the LAST). 2-deck mode needs an 11-row source including `Five of a Kind`; 1-deck renders the existing 10 rows with zero trace (DOM-absence pinned both ways). Row-injection mechanism is Claude's Discretion; **see Open Question 1 on D-09's "at the TOP" wording vs the table's established ascending order.** `lockedInCategory` must route through `evaluateHandTwoDeck` when deckCount=2 — it is a **main-thread stock-evaluator call site** that receives visible hero+board cards, which at 2 decks can contain duplicates (verified: it calls `evaluateHand` directly today; window sizes 5-7 cards, and the wrapper handles 5/6-card windows — the proxy/pigeonhole proofs only get easier below 7 cards). Its extended return (10) makes the ✓ column work on the new row for free.
9. **Copy cue (HE2-03/D-08):** felt keys are positional (`${slot}-${dealNonce}` in `Seat.tsx`/`BoardDisplay.tsx`, `animationKey` documented as "never card identity" in `AnimatedCard.tsx` — verified), so duplicates cannot collide in React keys; **preserve positional keying, never introduce value-based keys.** The badge is render-time content passed into `PlayingCard` (inside the `AnimatedCard` wrapper → it rides every fly-in/flip/restore automatically, including the restore-mount `initial={false}` path). Second-copy determination: derive from a **deterministic canonical scan order** over currently-visible cards — recommended: hero holes, then board in street order, then revealed opponents by seat index; badge the second encounter of any value. This is computable from `(runout, street, revealedMask)` alone (no new state); note `revealedMask` records the reveal *set*, not reveal *chronology*, so seat order — not reveal order — is the deterministic tiebreak when two opponents hold the copies. Screen-reader label + testid per D-10; visible only at deckCount=2.
10. **`src/ui/HoldemGame.tsx` (D-01/D-02):** deck toggle mirroring blackjack's segmented control; odds effect's `deriveConditionedState` call gains `deckCount`; effect dependency array gains `deckCount`? — NOT needed if D-02 holds (any deckCount change with a hand on the table triggers `deal()` → `dealNonce` change re-runs the effect; idle changes have `runout === null` → effect early-returns) — but adding it is harmless belt-and-braces; planner's call, document either way.
11. **Guard retargets (same-commit discipline, 06-07 precedent):**
    - `App.modeShell.guard.test.ts` "zero occurrences of deckCount" sweep currently covers `['App.tsx', 'state/gameModeStore.ts', 'ui/GameModeSwitcher.tsx', 'ui/HoldemGame.tsx']` with WR-03 as its stated rationale (verified, lines 226-243). **`HoldemGame.tsx` must be REMOVED from the list** (it now legitimately owns the toggle wire — the exact retarget move the file itself performed for BlackjackScene in 06-07); the three cross-game shell files stay deckCount-free forever (Hold'em's deckCount lives in `gameStore`, mirroring blackjack's D-10).
    - `deckCountValidation.test.ts`'s "accepts an explicit deckCount of 2 at the validation boundary (WR-03 keeps the 2-deck TRIAL path off-limits)" test: **retarget to a real end-to-end 2-deck run** (assert a completed run with an 11-length categoryCounts snapshot and sane sums) — never deleted (D-12).
    - `shoePath.guard.test.ts` (D-07/WR-04): add `.includes(`-prohibition assertions for the shoe-path files (`shoe.ts`, `conditioning.ts`, `pickerStore.ts`, `CardPicker.tsx` — currently zero occurrences, verified by grep, so no allowlist needed) plus the new wrapper module and any other file Phase 7 adds to the shoe path.
    - WR-03 compliance comments in source (grep hits: `App.modeShell.guard.test.ts`, `deckCountValidation.test.ts`) get retargeted/retired in the same commits as their code changes.
12. **Untouchables (D-11):** the five frozen v1 suites, both goldens (`deckParity.golden.test.ts`, `streamingParity.golden.test.ts`), `simulationApi.test.ts` (frozen contract — new tests go in new sibling files, per the `deckCountValidation.test.ts` precedent), and every `blackjack*` file. New 2-deck invariants are ADDITIVE siblings: e.g., a 2-deck version of `equity.property.test.ts`'s pinned "(c) 13 unique cards" property becomes "13 physical cards with per-value count ≤ deckCount," and `conditioning.test.ts`'s pinned "52-card reconstitution" gets a 104-card per-value-≤2 sibling.

### Pattern: wrapper-in-path, not parallel path

Phase 6's `blackjackEquity.ts` precedent (a parallel engine file for a parallel game) does NOT apply here — D-04 locks a wrapper *inside* the existing Hold'em trial path. The 2-deck variant is the same game, same `runTrials`, same protocol shapes; only the evaluator/comparator pair and one array length vary by `deckCount`. Resist any temptation to fork `runTrials` into a `runTrialsTwoDeck` sibling — hoisted function selection keeps one loop, one set of win/tie semantics, and the goldens as the 1-deck safety net.

### Anti-Patterns to Avoid

- **Gate-by-rank-count-only** (checking only `rankCount ≥ 5`): passes every smoke test, silently mis-scores ~17.7% of duplicate windows through out-of-contract stock behavior and ~1.6% through the garbage flush path. The gate is value-equality based, full stop (D-04's own text anticipates this).
- **Dedupe-then-delegate**: disqualified above — loses physical pairs.
- **Feeding duplicate-containing hand arrays to library `compare`**: works by accident today (verified for one shape); out of contract. Custom-scored hands carry `tiebreak` and never reach the library comparator.
- **Value-based React keys for felt cards or picker buttons**: positional keys are load-bearing at 2 decks (PITFALLS Pitfall 9/14; current code verified clean — keep it that way).
- **Widening `CATEGORY_COUNT` itself to 11**: silently changes 1-deck snapshot length (breaks goldens + the oddsStore dev guard + the `CATEGORY_LABELS` exhaustiveness convention). The 11th index exists only where `deckCount === 2` flows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rank-category scoring + kickers for duplicate windows | A custom 7-card category detector in production | Suit-remap proxy → stock `evaluateHand` | The proxy is exact (proven + validated); a custom detector re-solves wheel straights/kicker ordering/best-5-of-7 — the classic hand-rolling trap. The custom detector lives ONLY in test code as the oracle |
| Duplicate detection | Per-call `Set`/`Map` allocation, O(n²) pairwise scans | Stamped `Int32Array(52)` + generation counter | Zero-allocation, O(7); also the shoe-path guard (D-07) prohibits value-`Set` patterns in this path |
| Multiset shoe exclusion | Any new exclusion helper | `shoeWithout(deckCount, excluded)` unchanged | Already count-aware and golden-pinned |
| Streaming/cancellation/supersession | Any runner change | `createStreamingRunner` unchanged | Config-level growth (mergeBatch) suffices; the runner never learns about categories |
| Flush detection inside the custom zone | A general flush evaluator | One-suit scan: distinct-rank straight check (wheel-aware) + top-5 multiset | The zone is a single suit's ≤7 cards; `straightHigh` is 13 booleans and a loop |

**Key insight:** the production duplicate branch is ~100 lines because the stock evaluator does all rank-category work on the proxy; the only genuinely new *scoring* logic is "five of a kind" (one comparison) and "score one suit's cards as a flush/SF" (a dozen lines). The heavyweight artifact is the TEST oracle — and that is intentional, disposable-quality code.

## Common Pitfalls

### Pitfall 1: Treating "no crash" as the acceptance signal
**What goes wrong:** the stock evaluator returns plausible-looking results for most duplicate shapes, so an under-built gate looks done. **How to avoid:** every acceptance/property test asserts *values* against the oracle/known vectors, never mere non-throwing. **Warning sign:** a test suite for this phase with no exact-value duplicate vectors.

### Pitfall 2: The oddsStore dev guard fires on every 2-deck snapshot
**What:** `checkSnapshotConsistency` pins `categoryCounts.length === CATEGORY_COUNT` (10). **Avoid:** make it accept `categoryCountFor` lengths in the same plan that grows the snapshot. **Warning sign:** dev-console `[oddsStore consistency guard]` spam in 2-deck mode.

### Pitfall 3: `lockedInCategory` left on the raw evaluator
**What:** the ✓-column helper calls `evaluateHand` on visible cards on the MAIN THREAD; at 2 decks a visible dup (hero `Ah Ah`, or a board dup at the river) hits the exact stock misbehavior the worker gate prevents — garbage or crash in the UI layer. **Avoid:** route through `evaluateHandTwoDeck` when deckCount=2 (Integration Map §8). **Warning sign:** any remaining `evaluateHand(` call site whose input can be 2-deck-conditioned.

### Pitfall 4: The modeShell guard blocks the toggle
**What:** `App.modeShell.guard.test.ts` currently fails on any `deckCount` token in `HoldemGame.tsx`. **Avoid:** retarget the file list in the SAME commit that adds the toggle, with the retarget rationale documented in-test (06-07 precedent). **Warning sign:** a red guard "fixed" by weakening the shell files' coverage instead of removing only `HoldemGame.tsx`.

### Pitfall 5: Proxy hand-array leakage into physical accounting
**What:** the proxy path's `hand` may contain a synthetic card (e.g., `As` substituted for the second `Ah`). Nothing consumes `Hand.hand` today (verified: `strength` only), but a future display/debug feature reading it would show a card nobody holds. **Avoid:** document the field as display-only-and-possibly-synthetic on `HandTwoDeck` (done in the spec above); optionally remap back for cosmetics — but then that array must NEVER reach library `compare`. **Warning sign:** `HandTwoDeck.hand` used in any exclusion/pool computation.

### Pitfall 6: Growing totals in the wrong hook
**What:** `makeEmptyTotals`/`toSnapshot` can't see `conditioned` (runner config signature, verified) — sizing the totals at 11 unconditionally changes 1-deck snapshot length (golden break). **Avoid:** grow-on-merge in `mergeBatch` (Integration Map §3). **Warning sign:** `streamingParity.golden.test.ts` red, or `simulationApi.test.ts` touched.

### Pitfall 7: Copy-cue badge migrating between copies
**What:** an ad-hoc "second copy" rule (e.g., insertion order into a Set during render) can flip which card wears the badge across re-renders/rewinds, reading as flicker. **Avoid:** the canonical scan order (§9) — pure function of `(runout, street, revealedMask)`; rewind/advance recomputes deterministically. **Warning sign:** badge position depends on render order or component mount order.

### Pitfall 8: New property tests weakening pinned v1 invariants
**What:** the "13 unique cards" property and "52-card reconstitution" titles are literally pinned by `shoePath.guard.test.ts`. **Avoid:** additive sibling tests only (Integration Map §12). **Warning sign:** any diff line in a pinned file.

## Code Examples

The complete validated algorithm pseudocode, gate implementation, `HandTwoDeck` shape, and `compareHandsTwoDeck` spec are in "The Duplicate-Aware Evaluation Algorithm" above (the section is written to be lifted into plans verbatim). One additional shape — the D-02 toggle action:

```typescript
// gameStore.ts — D-01/D-02 (illustrative)
setDeckCount: (deckCount: DeckCount) => {
  if (get().deckCount === deckCount) return;      // no-op click, never arms anything
  set({ deckCount });
  if (get().runout !== null) {
    get().deal();  // fresh deal: clears cache (D-03), bumps dealNonce (CR-02 stream guard)
  }
},
```

And the D-13 gate-shape sweep skeleton (test-side):

```typescript
// Every duplicate co-occurrence shape from the impossibility table, as explicit vectors:
const GATE_SHAPES: [string, Card[], Card[]][] = [
  ['dup pair in hole',            ['Ah','Ah'], ['2c','5d','7h','9s','Jc']],
  ['dup split hole/board',        ['Ah','2c'], ['Ah','5d','7s','9s','Jc']],
  ['dup inside board',            ['Ah','2c'], ['Kd','Kd','7s','9s','Jc']],
  ['two distinct dup pairs',      ['Ah','Ah'], ['Kd','Kd','7s','9s','Jc']],
  ['three dup pairs',             ['Ah','Ah'], ['Kd','Kd','Qs','Qs','Jc']],
  ['rank count 5 (crash zone)',   ['As','Ah'], ['Ad','Ac','As','7d','9c']],
  ['rank count 6',                ['As','As'], ['Ah','Ah','Ad','Ad','9c']],
  ['rank count 7',                ['As','As'], ['Ah','Ah','Ad','Ad','Ac']],
  ['dup completing a flush',      ['Ah','Ah'], ['2h','3h','4h','9c','9d']],
  ['dup irrelevant to best-5',    ['2c','2c'], ['Ah','Kh','Qh','Jh','Th']],
];
// assert: gate flags every one; evaluateHandTwoDeck returns the oracle's tuple for every one;
// and property: fc-generated dup windows are never HighCard and never reach the raw evaluator.
```

## State of the Art

No library-version or ecosystem shift applies — this is custom engine work over the installed stack. The one relevant "current knowledge" note: no published poker library handles multi-deck duplicate evaluation (2-deck Hold'em is not a real casino game), so there is no off-the-shelf alternative to the validated custom design — reconfirmed by the absence of any duplicate-tolerant evaluation mode in the installed library's exports (verified export list this session).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | **Dup-flush tiebreak working convention:** a flush containing two identical cards compares by its 5-rank *multiset* lexicographically (so `A,A,4,3,2` beats `A,K,Q,J,9`). No published rulebook covers this (wild-card conventions *prohibit* duplicate hands outright — pagat's "double ace flush" note); the multiset order is the natural extension (reduces exactly to stock kicker order on clean hands; monotone; and — coincidentally — what the stock evaluator itself returns in its accidentally-working dup-flush cases). Alternative (score dup-flushes by distinct ranks only) rejected: contradicts the physical-card philosophy and demotes real physical flushes like `Ah Ah 2h 3h 4h` to One Pair. `[ASSUMED — a defined working convention, same treatment class as D-05's flag]` | Algorithm spec §3 | A user or reviewer expecting different dup-flush ordering; affects ~1.6% of duplicate windows' tiebreaks (never their category). Cheap to flag in the plan as a documented convention; the oracle and property tests pin whichever convention ships |
| A2 | The 2-deck category table's Five of a Kind row placement should follow the table's *established ascending-strength DOM order* (i.e., rendered adjacent to Royal Flush at the strongest end — the row AFTER Royal Flush in DOM), despite D-09's literal wording "at the TOP of the category table," which contradicts the shipped table's order (verified: High Card is the first DOM row, Royal Flush the last). `[ASSUMED — resolution of an internal contradiction in a locked decision's wording]` | Integration Map §8, Open Question 1 | If "top" was truly meant (first DOM row, above High Card), the row breaks the table's monotone strength ordering; if adjacency-to-Royal-Flush at the strength end was meant (recommended), DOM position differs from the literal words. One-line planner/operator confirmation resolves it; either way 1-deck DOM is unchanged |
| A3 | The seeded Anchor-A test's 3σ band remains valid across refactors because the trial-draw consumption order is stable (board = first 5 of the 11-card draw, verified in `runTrials`); a future reordering forces re-derivation, which the band-not-exact-count assertion style makes explicit rather than silent. `[ASSUMED: standard practice, mirrors Phase 6's D-12 anchor design]` | Anchors | A draw-order refactor moves the realized seeded count within (almost surely) the band; if outside, the test correctly demands a conscious look rather than a silent retune |

## Open Questions (RESOLVED)

> **Status (2026-08-25):** Both questions below were resolved in 07-CONTEXT.md's "Post-research resolutions" before planning: Q1 (row placement vs shipped ascending order) → D-09 amended (Five of a Kind renders as the LAST DOM row, strength end); Q2 (deckCount home) → D-14 (gameStore, blackjack D-10 precedent). Retained verbatim below for the audit trail.

1. **D-09 row placement wording ("above Royal Flush at the TOP of the category table") vs the shipped table's ascending order** — see Assumption A2. What we know: the current `OddsTable` renders High Card first (top) through Royal Flush last (bottom); "Five of a Kind above Royal Flush" is a *ranking* statement (D-05, affirmed by sources) while "at the TOP" is a *layout* statement that matches a descending table this app doesn't have. Recommendation: render the row adjacent to Royal Flush at the strength end of the table (last DOM row), preserving the table's monotone order and the 1-deck DOM byte-identically; the planner should record this as the D-09 interpretation (or flip the whole table to descending in BOTH modes — rejected: gratuitous 1-deck DOM churn against D-11's spirit).
2. **Where the Hold'em deckCount field lives** — recommended `gameStore` (mirrors blackjack's D-10 "local deck count lives in the game's own store" + keeps the modeShell guard's shell-files-stay-clean sweep intact). Claude's Discretion; the guard retarget in Integration Map §11 assumes this placement.

## Environment Availability

Skipped — this phase introduces no new external tools, services, runtimes, or CLI dependencies (zero new packages; all verification in this session ran against the already-installed toolchain).

## Validation Architecture

Skipped — `.planning/config.json` sets `workflow.nyquist_validation: false` (explicitly disabled).

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled). Same conclusion as Phases 4-6: client-only, offline, no auth/persistence/network; all new inputs (deck toggle clicks, picker clicks) are closed-union UI actions.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3/V4/V6 | No | No auth, sessions, roles, or crypto anywhere in this app |
| V5 Input Validation | Yes (narrow) | Worker-boundary deckCount shape validation already ships (WR-02, verified in `simulationApi.ts`); this phase's only new validation surface is the proxy builder's defense-in-depth assertion (throws loudly on an impossible substitution state rather than silently mis-scoring) — internal-bug defense, same framing as `validateConditionedState` |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/duplicate-containing input reaching the raw stock evaluator (internal bug, not adversarial) | Tampering (internal) | The gate itself + a regression test asserting no production path calls `evaluateHand` with duplicate values + the proxy builder's loud assertion |

## Sources

### Primary (HIGH confidence — direct source/package inspection and empirical verification this session)
- **Empirical spike matrix** against installed `node_modules/@poker-apprentice/hand-evaluator@4.3.0` (dist/cjs): 15 duplicate-shape probes + 12 flush-zone/rank-5 probes + result-object/`compare` mechanics probes — the basis of the characterization table (scratch scripts, removed after use, not committed)
- **Algorithm validation run**: candidate implementation + brute-force oracle, 100k clean windows (oracle ≡ stock: 0 mismatches), 200k duplicate windows (candidate ≡ oracle: 0 mismatches), 100k monotonicity trials (0 violations)
- **Exact combinatorics** (BigInt arithmetic) + independent 2M-window Monte Carlo cross-check (mulberry32) for all probabilities and branch frequencies
- **Micro-benchmark** against the installed package (Node, this machine): stock eval ~2,156 ns, gate ~104 ns, dup branch ~2,852 ns
- Direct reading of this repository's shipped source: `src/engine/{evaluator,equity,cards,shoe,conditioning,rng,blackjackEquity}.ts`, `src/worker/{protocol,simulationApi,streamingRunner,deckCountValidation.test}.ts`, `src/state/{gameStore,oddsStore,pickerStore,gameModeStore}.ts`, `src/ui/{OddsTable,categoryLabels,lockedCategory,HoldemGame,CardPicker,AnimatedCard,Seat,BoardDisplay}.tsx/.ts`, `src/App.modeShell.guard.test.ts`, `src/engine/shoePath.guard.test.ts`
- `.planning/phases/07-2-deck-holdem-evaluation/07-CONTEXT.md` (D-01..D-13), `.planning/ROADMAP.md` Phase 7, `.planning/REQUIREMENTS.md` HE2-01..03, `.planning/research/{PITFALLS,ARCHITECTURE}.md`, `.planning/STATE.md` (WR-01/WR-03/WR-04, convention flag), `.planning/phases/06-blackjack-core-odds-loop/06-RESEARCH.md`, `.planning/config.json`

### Secondary (MEDIUM-HIGH confidence)
- [Pagat.com — Ranking of Poker Hands](https://www.pagat.com/poker/rules/ranking.html) — "five of a kind becomes the highest type of hand, beating a royal flush"; five-of-a-kind rank tiebreak; wild-card no-duplicate note (fetched this session)
- [Bicycle Cards — Basics of Poker](https://bicyclecards.com/how-to-play/basics-of-poker) — "Five of a Kind – This is the highest possible hand…" (fetched this session)

### Tertiary (LOW confidence)
- WebSearch corroboration of the five-of-a-kind convention across community sources (twoplustwo, poker.org, Quora) — consistent with the two citations above; not load-bearing

## Metadata

**Confidence breakdown:**
- Evaluation algorithm (D-06 deliverable): HIGH — implemented and validated against a brute-force oracle this session, 0 mismatches over 300k windows across three legs, with the oracle itself cross-validated against the stock evaluator
- Stock-evaluator characterization: HIGH — direct empirical probes against the installed package; supersedes the prior PITFALLS.md claim with reproduced evidence
- Probability anchors: HIGH — exact closed forms with derivations shown, independently Monte Carlo cross-checked
- Performance: HIGH for ratios (measured against the installed package), MEDIUM for absolute ns (machine/runtime dependent — but only ratios are load-bearing)
- Integration surfaces: HIGH — every touched file read directly; every guard/golden interaction enumerated with line-level verification
- Working conventions: MEDIUM (A1 dup-flush tiebreak, A2 row placement) — flagged for one-line confirmation, with recommendations

**Research date:** 2026-08-25
**Valid until:** Lifetime of this phase (no external dependency drift possible — zero new packages; re-research only if `@poker-apprentice/hand-evaluator` is upgraded, which would require re-running the characterization spike, or if CONTEXT.md's locked decisions change)
