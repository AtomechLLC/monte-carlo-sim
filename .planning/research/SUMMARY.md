# Project Research Summary

**Project:** Monte Carlo Poker Simulator — v2.0 Milestone (Blackjack & Multi-Deck)
**Domain:** Browser-based, client-side Monte Carlo casino-game simulator — adding a second game (Blackjack) and a first-class deck-count variable to a shipped v1.0 Texas Hold'em odds explorer
**Researched:** 2026-08-24
**Confidence:** HIGH

## Executive Summary

This milestone adds Blackjack as a second game and makes deck count (1 vs. 2 decks) a first-class, explorable probability variable across both games, layered entirely on the already-shipped v1.0 stack and architecture. All four research files converge on a single bottom line: **no new dependencies are needed** — Blackjack's rules are a small, closed-form state machine best hand-rolled (no maintained, fit-for-purpose npm package exists; every candidate is either stale, GPL-licensed, wrong product shape, or `slopcheck`-flagged as suspicious), and 2-deck Hold'em needs only a thin custom wrapper around the already-locked `@poker-apprentice/hand-evaluator`, not a new evaluator. The real work is architectural and correctness-focused: generalizing the deck model from "52 unique cards" (`Set`-based) to "N×52 physical cards with legitimate duplicates" (count/identity-based), splitting game-specific state and worker protocol from the currently Hold'em-shaped `gameStore`/`oddsStore`/`simulationApi`, and building genuinely new engine logic (dealer fixed-drawing-rule playout, hard/soft totals) that has no v1 analog.

The recommended approach is **foundation-first, Blackjack-before-2-deck-poker**: fix the multiset-deck primitive once (a physical-card-identity type replacing bare-string `Set` membership) since nearly every other pitfall in this milestone is a downstream consequence of that one data-model gap; generalize the worker's streaming protocol into a reusable pattern before writing any new trial-loop code; cleanly separate Blackjack's state/store/UI from Hold'em's rather than widening existing fields ("mode leakage"); build Blackjack as a full vertical slice to battle-test the multiset-deck plumbing under real, non-error-path conditions; and only then tackle the 2-deck Hold'em evaluator, the single highest-complexity item in the milestone, since it benefits from deck-count plumbing already being proven.

The key risk is correctness, not scale, and one important finding required reconciling two research passes that used different methods. STACK.md, working from reading the evaluator's lookup-table source, concluded the danger case was specifically "5+ of one rank" (out-of-range hash index → silent wrong classification). PITFALLS.md then ran a live spike test against the actual installed `evaluateHoldem` entry point this codebase calls, and found it throws `TypeError: C is not iterable` on **any** duplicate rank+suit co-occurrence — not just five-of-a-kind — before ever reaching the comparison logic. **The empirical result governs**: it is a direct test of the real call path, superseding the source-reading inference about a code path that may not be what `evaluateHoldem` actually executes for ordinary duplicates. Both findings agree on the fix, which is now broader than STACK.md's original framing: a mandatory duplicate-detection pre-check must gate **every** call to the existing evaluator in 2-deck mode — not just when a rank count reaches 5 — routing duplicate-free hands to the fast existing path and any duplicate-containing hand (common in a 104-card shoe, not a rare edge case) to a hand-rolled comparator that also handles the new Five-of-a-Kind category. This changes the sizing of the 2-deck evaluator phase: the custom path is exercised far more often than "rare 5-of-a-kind edge case" implied, so it needs full-loop correctness and performance treatment, not edge-case treatment.

## Key Findings

### Recommended Stack

Zero new runtime dependencies. The entire v1.0 stack (React 19.2.8, Vite, TypeScript 6.0.3, Zustand, Motion, Comlink, `pure-rand`, `@poker-apprentice/hand-evaluator` 4.3.0, vendored SVG cards) is reused unchanged. Blackjack's rules engine, the multi-deck poker evaluation layer, and the multi-deck shoe/shuffle model are all hand-written TypeScript modules — every Blackjack npm candidate investigated (`blackjack-strategy`, `blackjack-simulator`, `engine-blackjack` [GPL-2.0], `@blackjacktrainer/blackjack-simulator` [wrong shape: bankroll/card-counting, not per-hand odds], `miaoda-game-blackjack-rules`/`miaoda-game-deck-core` [`slopcheck`-flagged, no linked repo, anomalous downloads for a 27-day-old package]) was rejected with evidence, not by default.

**Core technologies (all locked, unchanged):**
- Comlink 4.4.2 — same worker-RPC streaming pattern serves Blackjack and 2-deck Hold'em; game-agnostic
- `pure-rand` 8.4.2 — a shoe is just a longer array to shuffle; no new RNG concern at any deck count
- Zustand 5.0.15 — new store slices (`gameModeStore`, `blackjackStore`) via existing composition patterns, no new library
- `@poker-apprentice/hand-evaluator` 4.3.0 — its low-level `evaluate`/`compare`/`rankN` primitives (already what v1 uses) are reusable via a thin wrapper for 2-deck Hold'em; its high-level `equity`/`odds` functions must never be called in 2-deck mode (they throw `DuplicateCardError` by design)
- React 19 / Motion / DOM+SVG cards — reused verbatim for Blackjack's table (fewer on-screen cards than poker, so the v1 rendering-approach conclusion holds even more strongly)

### Expected Features

The Blackjack feature should synthesize the *inputs and numbers* of strategy-calculator tooling (Wizard of Odds, Best in Slot) with the *descriptive, non-prescriptive* stance this project already established for poker's anti-GTO position — explicitly not the card-counting-drill/quiz genre, which is a different interaction loop entirely. No betting/bankroll/chips concept is needed even for EV: EV is a per-decision, per-unit-wagered ratio, computed directly from win/push/lose probabilities and a fixed payout assumption (blackjack pays 3:2).

**Must have (table stakes, v2.0 launch):**
- Deck-aware shoe model generalized to 1 or 2 decks, shared by both games — foundational, nothing else works without it
- Blackjack: random deal + manual picker, bust-if-hit probability, dealer final-outcome distribution by up-card (Monte Carlo dealer playout), win/push/lose + per-unit EV for Stand/Hit, dealer hole-card reveal (reuses the existing opponent-reveal pattern), natural-blackjack frequency, deck-count toggle
- Hold'em 2-deck mode: custom evaluation layer supporting duplicate cards, a new Five of a Kind category (ranked between Royal Flush and Straight Flush), and a visual origin cue distinguishing duplicate-looking cards on the felt (trust/legibility, not a probability requirement)

**Should have (differentiators):**
- Monte Carlo convergence display for Blackjack odds even though exact enumeration is computationally trivial — keeps the app's "watch probability resolve" pedagogy consistent across both games rather than making Blackjack feel bolted-on
- Dealer hole-card reveal framed as a live "insurance question" without implementing insurance as an actual wager
- Explicit before/after deck-count comparison callout — the real deltas (natural-BJ frequency 4.83%→4.78%, dealer bust-rate shifts) are small enough that a bare toggle risks going unnoticed

**Defer (v2.x / v3+):**
- Double Down (v2.x fast-follow, cheap extension), Split (v2.x/v3, genuinely new two-hand state model — no existing analog), Surrender EV (low priority)
- Non-graded running/true-count readout — bundle with the already-deferred EDU-01/02/03 annotation layer
- Full basic-strategy chart, card-counting drill/quiz trainer, side bets, exposed casino rule-variant settings (S17/H17, DAS, etc.) — all explicit anti-features, conflicting with the established descriptive-not-prescriptive stance or the no-betting constraint

### Architecture Approach

Based on direct reading of the shipped v1 codebase: the existing `gameStore`/`oddsStore`/`simulationApi`/`pickerStore`/`TableScene` are all, in practice, Hold'em-shaped rather than generically "the game's" state, so the correct pattern is to extract the *generic mechanics* (streaming/cancellation, settled-cache-by-knowledge-key, animation gate) into shared factories/helpers while giving each game its own typed store, snapshot shape, and UI composition root on top of them. The only genuinely new cross-cutting store is a tiny `gameModeStore` (`mode`, `deckCount`). One worker continues to host both games as two namespaced Comlink APIs — a second worker thread would double lifecycle bookkeeping for no benefit since only one game simulates at a time.

**Major components:**
1. **Multiset deck primitive** (`cards.ts`, `conditioning.ts`) — a physical-card-identity model (e.g., `{id, value}`) replacing bare-string `Set` membership everywhere a card is tracked as known/used/remaining; this is the single most load-bearing change, since drawing (`rng.ts`) already works correctly with duplicates and needs no change at all
2. **Generic streaming runner** (`streamingRunner.ts`, extracted from `simulationApi.ts`) — the batch/cancellation/run-token/throttled-emission machinery, parameterized so both Hold'em and Blackjack trial loops ride the same proven engine
3. **Per-game state/UI split** (`blackjackStore.ts` mirroring `gameStore`'s D-01/D-02 predetermine-then-reveal discipline; `blackjackOddsStore.ts` built on an extracted `oddsCacheStore` factory; separate `BlackjackTable`/`BlackjackOddsPanel` UI built from shared primitives like `PlayingCard`/`AnimatedCard`/`formatPct`) — never widen Hold'em's fields to also carry Blackjack semantics
4. **2-deck evaluation seam** (`duplicateEvaluator.ts`) — detect ANY duplicate value first; delegate unchanged to the existing evaluator when none exist (majority case, zero behavior change); otherwise route to a hand-rolled comparator handling ordinary duplicate-rank comparison and the new Five-of-a-Kind category

### Critical Pitfalls

1. **With-replacement sampling silently erases the entire deck-count effect** — Blackjack's shoe must draw without replacement from an explicit shrinking pool (`52 * deckCount` minus dealt/known cards), exactly like Hold'em's `createDrawer`/`drawN`; verify with a regression test asserting 1-deck vs. 2-deck odds *differ* for a fixed scenario, not just that each "looks plausible."
2. **Bare-string `Card` identity collapses under every existing `Set`/`Map`-based dedup helper** — the foundational multi-deck bug. A 2-deck shoe needs physical-card identity, not value identity; must land before any other multi-deck work (Blackjack shoe, 2-deck picker, or evaluator changes), since most other pitfalls are downstream of this one gap.
3. **The evaluator crashes (not "ranks wrong") on duplicate cards, empirically confirmed** — `evaluateHoldem` throws `TypeError: C is not iterable` on any duplicate rank+suit co-occurrence, not just five-of-a-kind (see Executive Summary reconciliation). Never call it on a 2-deck-conditioned hand without a pre-check gate.
4. **Mode leakage** — retrofitting Blackjack's state onto `gameStore`'s Hold'em-shaped fields (`street`, `revealedMask`) forces every consumer into game-dependent runtime branching. Build a separate `blackjackStore` and a separate effect/screen instead of widening the existing one.
5. **Soft-total (Ace) valuation and S17/H17 rules checked only once or only against the hard total** — must recompute soft/hard status from scratch after every card added (initial deal AND every hit), and the dealer's hit/stand decision must explicitly branch on softness under H17, not just compare the hard total to 17.

## Implications for Roadmap

Based on combined research — ARCHITECTURE.md's explicit recommended build order, FEATURES.md's dependency graph (deck-aware shoe model is the single most load-bearing new state), and PITFALLS.md's phase-to-pitfall mapping all converge on the same sequencing — suggested phase structure:

### Phase 1: Multiset Deck Foundation
**Rationale:** PITFALLS.md's Pitfall 6 (bare-string identity collapse) is explicitly flagged as foundational — it must land before ANY other multi-deck work, since Pitfalls 1, 8, 9, 13, and 14 are all downstream consequences of this one data-model gap. ARCHITECTURE.md's build order independently places it first. No new dependency is needed; `pure-rand`'s draw functions already work correctly with duplicates.
**Delivers:** A physical-card-identity type; `buildDeck(deckCount)`; count-based `deckWithout` replacing the Set-based version; `conditioning.ts`'s `remainingDeck` derivation routed through the same helper; count-based (not boolean) dup-block in `pickerStore`/`CardPicker`. Property-tested regression invariant first ("`deckCount=1` output is byte-identical to today's behavior"), then multiset invariants.
**Addresses:** Deck-aware shoe model (FEATURES.md's single most load-bearing item, spanning both games).
**Avoids:** Critical Pitfall 6 (identity collapse), sets up prevention for Pitfall 1 (with-replacement shortcut) and Pitfall 12 (test-suite coupling — this phase's tests must be additive, never a loosening of existing assertions).

### Phase 2: Worker Protocol Generalization
**Rationale:** ARCHITECTURE.md's build order places this second, as a pure, test-verifiable refactor before any new game logic complicates the picture — both new game paths (Blackjack, 2-deck Hold'em) ride on the same streaming machinery, and refactoring it first with the existing `simulationApi.test.ts` as a safety net de-risks the extraction.
**Delivers:** `streamingRunner.ts` (generic batch/cancellation/run-token/throttled-emission engine); `simulationApi.ts` refactored to a thin config on top of it with zero observed behavior change at `deckCount=1`; `workerClient.ts` extracted from `simulationService.ts` as a shared singleton.
**Uses:** Comlink (unchanged), the existing run-token supersession pattern.
**Implements:** ARCHITECTURE.md's "one worker, two namespaced Comlink APIs" pattern (Anti-Pattern 3 explicitly warns against two worker threads for two games that never run concurrently).

### Phase 3: Game-Mode Shell & Store Separation
**Rationale:** PITFALLS.md's Pitfalls 10 (mode leakage) and 11 (shared-cache collision) must be decided architecturally before either game's UI is built — untangling shared fields after both games are already built against them is HIGH recovery cost per PITFALLS.md's Recovery Strategies table. ARCHITECTURE.md places this third, verifying Hold'em's existing acceptance tests still pass unchanged under the new shell before touching Blackjack logic.
**Delivers:** `gameModeStore.ts` (`mode`, `deckCount`); `App.tsx` split into `HoldemGame.tsx` (existing effect/JSX moved verbatim) + a `BlackjackGame.tsx` placeholder + `GameModeSwitcher`; `oddsCacheStore` factory extracted from `oddsStore.ts`; `simulationService.ts` split into `workerClient.ts` + per-game wrappers.
**Avoids:** Critical Pitfall 10 (mode leakage) and 11 (cache collision) — enforced by giving each game its own store/snapshot type from the start, not optional fields on a shared shape.

### Phase 4: Blackjack Core Odds Loop (vertical slice)
**Rationale:** ARCHITECTURE.md sequences the larger, more novel body of work here — Blackjack becomes the first real consumer that exercises the multiset-deck primitive under normal, non-error-path conditions, catching bugs before the highest-risk 2-deck poker work begins. FEATURES.md's MVP definition and prioritization matrix both mark this cluster P1.
**Delivers:** `blackjackHandValue.ts` (hard/soft totals recomputed after every card, bust detection); `blackjackEquity.ts` (dealer fixed-drawing-rule playout — genuinely new logic with no poker analog — plus the trial loop); `blackjackConditioning.ts` (sole reader of the predetermined dealer hole card/hit sequence, mirroring `deriveConditionedState`'s D-01/D-02 discipline); `blackjackStore.ts`, `blackjackSimulationApi.ts` (on the Phase 2 runner), `blackjackOddsStore.ts` (on the Phase 3 cache factory); minimal `BlackjackTable`/`BlackjackOddsPanel` UI; bust-if-hit probability, dealer outcome distribution, win/push/lose + explicitly payout-weighted EV (3:2 natural, decided and documented, not silently flat 1:1), dealer hole-card reveal, natural-frequency readout, deck-count toggle for Blackjack.
**Addresses:** FEATURES.md's full Blackjack P1 list.
**Avoids:** Critical Pitfalls 1 (with-replacement shortcut), 2 (soft-total re-check), 3 (S17/H17 on hard total only), 4 (natural-vs-any-21, unweighted EV), 5 (peeking at the predetermined dealer hole card/future hits).

### Phase 5: 2-Deck Hold'em Evaluation Layer
**Rationale:** Both FEATURES.md and ARCHITECTURE.md independently flag this as the single highest-complexity item in the milestone's poker-side scope; ARCHITECTURE.md sequences it after Blackjack specifically so the multiset-deck plumbing is already battle-tested by a real, working consumer before the highest correctness-risk work begins.
**Delivers:** `duplicateEvaluator.ts` implementing the reconciled seam — detect ANY duplicate rank+suit value in the 7-card window first (not just rank-count ≥5, per the Executive Summary reconciliation); delegate unchanged to the existing evaluator when none exist; otherwise hand-roll comparison including the new Five-of-a-Kind category (ranked above Royal Flush); extended `CATEGORY_COUNT`/`categoryLabels.ts`/`OddsTable` for an 11th conditional row; `equity.ts`/`gameStore.deal()` wired to `deckCount`; count-based (not boolean) picker updates for 2-deck Hold'em slots; a visual per-deck origin marker for duplicate cards on the felt.
**Addresses:** Hold'em 2-deck mode's full FEATURES.md P1 list (custom evaluation layer, Five of a Kind category, duplicate-card visual cue).
**Avoids:** Critical Pitfall 7 (evaluator crash — using the reconciled, broader duplicate-gate rule), Pitfall 8 (static validation formula rewritten to a per-value budget check, not a zero-overlap assertion), Pitfalls 9/13 (picker React-key/count-based UX), Pitfall 14 (indistinguishable felt duplicates).

### Phase 6: Cross-Game Deck-Count Toggle UI
**Rationale:** ARCHITECTURE.md sequences this last, once both consumers (Blackjack, 2-deck Hold'em) already correctly respond to `deckCount` independently — the toggle's job is purely to surface an already-correct engine parameter, not to gate correctness of either game.
**Delivers:** A single shared `deckCount` control surfaced in both games' control bars, reading/writing `gameModeStore`; applies the existing "picks persist, take effect on next deal" discipline already established for `pickerStore` rather than inventing new mid-hand-mutation rules.
**Addresses:** The explicit v2.0 milestone target: "deck-count toggle spanning both games."

### Phase Ordering Rationale

- **Foundation-before-features, again:** exactly like v1's "engine before pixels," this milestone's research converges on "identity model before shoe-consuming features" — Pitfall 6 (bare-string collapse) is the root cause of the majority of other pitfalls, so it is sequenced first regardless of which game's feature work is nominally "bigger."
- **Blackjack-before-2-deck-poker is deliberate, not arbitrary:** the 2-deck poker evaluator is the single highest-risk item in the milestone; sequencing Blackjack first means the multiset-deck plumbing gets proven against a real, working, non-error-path consumer before the highest-stakes work begins.
- **Store/mode separation (Phase 3) is decided architecturally before any UI, not discovered mid-build:** PITFALLS.md's Recovery Strategies table rates untangling mode leakage after the fact as HIGH cost — this is the kind of decision that must be made once, correctly, up front.
- **The deck-count toggle is deliberately last:** every other phase must make its own game correct at both `deckCount=1` and `=2` internally; the toggle only ever swaps which shoe size an already-correct engine is fed, so it adds no correctness risk to build last.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (2-Deck Hold'em Evaluation Layer):** Highest-complexity, highest-correctness-risk item in the milestone per both FEATURES.md and ARCHITECTURE.md. The reconciled duplicate-detection scope (gate on ANY duplicate, not just five-of-a-kind) needs to be re-confirmed against the exact installed evaluator version during implementation (STACK.md flags this as an undocumented implementation detail, not a guaranteed public contract), and the Five-of-a-Kind comparator needs property-test design (e.g., "a five-of-a-kind hand always outranks every possible non-duplicate 7-card hand"). Recommend `/gsd:plan-phase --research-phase 5`.
- **Phase 4 (Blackjack Core Odds Loop):** While Blackjack's rules are well-documented externally, the dealer fixed-drawing-rule playout has no analog anywhere in the existing codebase, and the EV/payout model (3:2 natural, per-unit convention) must be explicitly decided (not just implemented) before coding — recommend at least a scoped research/discussion pass on the exact payout formula and soft-total recomputation invariants before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Multiset Deck Foundation):** The fix pattern (physical-card identity replacing value-based `Set` membership) is fully specified by PITFALLS.md and ARCHITECTURE.md with exact file-by-file changes already identified from reading the actual codebase — implementation is mechanical.
- **Phase 2 (Worker Protocol Generalization):** A pure refactor with an existing test suite as the safety net; the target shape (`streamingRunner.ts`) is already fully specified in ARCHITECTURE.md.
- **Phase 3 (Game-Mode Shell & Store Separation):** Standard Zustand store-composition and component-splitting patterns, already used successfully in this codebase (v1 store split precedent) — no novel technique required.
- **Phase 6 (Cross-Game Deck-Count Toggle UI):** Trivial once both consumers exist — a single control reading/writing an existing store field.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every Blackjack package candidate verified via `npm view`, live download-count APIs, and `slopcheck`; the evaluator's internal source (`rank.ts`, `hash.ts`, `evaluate.ts`) was read directly rather than inferred, though its "silent wrong classification at ≥5" claim is superseded by PITFALLS.md's empirical test for the actual call path used (see reconciliation) |
| Features | MEDIUM-HIGH | Blackjack probability figures (dealer bust rate, natural-frequency deck-count deltas) corroborated across 3+ independent sources with consistent magnitude; the 2-deck poker hand-ranking convention rests on a single (though credible, gambling-math-specialist) community forum thread, not an official rulebook — flagged as "the most defensible convention found," not an authoritative standard |
| Architecture | HIGH | Based on direct reading of the actual shipped v1 codebase (every file/line cited), not inference; two items flagged MEDIUM/LOW in the source file depend on library behavior or Blackjack interaction decisions not yet made |
| Pitfalls | HIGH | Every codebase-specific claim backed by direct source inspection plus one empirical spike test run against the installed evaluator in this session (not hypothetical); general Blackjack-rule and deck-penetration claims corroborated by independent community sources (MEDIUM) |

**Overall confidence:** HIGH

### Gaps to Address

- **Reconciled evaluator failure mode needs a permanent regression test, not just a one-time spike:** the empirical finding (any duplicate throws `TypeError`, not just ≥5-of-a-rank) was confirmed via a temporary Vitest test removed after use this session. Phase 5 must add a permanent regression test asserting `evaluateHoldem`/`evaluate` is never called in production code with a duplicate-containing hand, and that the duplicate-gate correctly routes every duplicate shape (not just five-of-a-kind) to the custom path.
- **Evaluator wrapper fragility risk:** the non-validating behavior of `evaluate`/`rankN` that the 2-deck wrapper depends on is an observed implementation detail (read from current source), not a documented public guarantee. STACK.md recommends pinning the exact locked version and adding a regression test that fails loudly if a future upgrade changes this — carry this into Phase 5's test plan.
- **2-deck poker hand-ranking convention is single-sourced:** the Royal Flush > Five of a Kind > Straight Flush > ... ordering comes from one community forum thread (Wizard of Vegas), not an official rulebook (none exists for 2-deck Hold'em). Treat as the working convention but flag for revisit if a more authoritative source surfaces.
- **Split (two-hand Blackjack state model) has no design work done yet:** explicitly deferred to v2.x/v3 per FEATURES.md, and ARCHITECTURE.md/PITFALLS.md agree it needs a deliberately-designed two-independent-hands state shape, not a bolt-on — flag for its own research pass whenever it's scheduled, don't assume Phase 4's single-hand model extends trivially.
- **Blackjack EV payout model must be an explicit, documented decision** before Phase 4 implementation begins (3:2 natural, 1:1 regular win, push at 0, "EV per 1-unit bet" labeling) — PITFALLS.md frames this as a `/gsd:discuss-phase`-level decision, not an implementation detail to infer while coding.

## Sources

### Primary (HIGH confidence)
- Direct inspection of this repository's shipped v1 codebase — `src/engine/*.ts`, `src/worker/*.ts`, `src/state/*.ts`, `src/ui/*.tsx` (ARCHITECTURE.md and PITFALLS.md both independently verified against the same files)
- `node_modules/@poker-apprentice/hand-evaluator` and `@poker-apprentice/types` — source and type definitions read directly (`rank.ts`, `hash.ts`, `evaluate.ts`, `dist/esm/index.js`, `types.d.ts`)
- Empirical spike test (this session) — `evaluateHoldem` from the installed `@poker-apprentice/hand-evaluator@4.3.0`, confirming `TypeError: C is not iterable` on duplicate rank+suit cards, baseline non-duplicate quads evaluating correctly
- `npx vitest run` (this session) — 216/216 existing tests passing on `master` before this milestone's work begins
- npm registry + npmjs.org downloads API (live, 2026-08-24) — version/license/download-count data for all Blackjack package candidates
- `slopcheck` v0.6.1 (local install) — legitimacy audit of every Blackjack npm candidate
- `.planning/PROJECT.md` — v2.0 milestone scope and explicit exclusions (HIGH confidence, primary source)

### Secondary (MEDIUM confidence)
- Wizard of Odds, Best in Slot, GamblingCalc, The Probability Lab, PokerNews (blackjack calculators) — competitor feature landscape for Blackjack odds tools
- Medium/Towards Data Science/Casino.org writeups on dealer bust rate and natural-blackjack frequency by deck count — corroborate the specific probability deltas cited
- Wizard of Vegas forum: Two-deck poker — sole source for the 2-deck Hold'em hand-ranking convention (Five of a Kind above Straight Flush)
- GitHub: `mhluska/blackjack-simulator` — project purpose/API shape assessment via WebFetch summary

### Tertiary (LOW confidence)
- None — every claim in this milestone's research is backed by direct source/package inspection, an empirical spike test, this project's own prior research artifacts, or a corroborating community source cited above.

---
*Research completed: 2026-08-24*
*Ready for roadmap: yes*
