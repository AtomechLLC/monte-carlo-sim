# Phase 6: Blackjack Core Odds Loop - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning
**Mode note:** Captured via `--auto` (standing no-operator-input directive). Recommended defaults, logged for audit.

<domain>
## Phase Boundary

Phase 6 delivers the full Blackjack vertical slice (BJ-02..BJ-07): deal a round (player hand + dealer upcard face-up, hole face-down) with live streamed Monte Carlo odds; show bust-if-hit and the dealer final-outcome distribution conditioned on the upcard; show win/push/lose and per-unit EV for Stand vs Hit; Hit/Stand actions with recompute and dealer playout; early hole-card reveal; and a blackjack-local 1/2-deck toggle whose effect on the odds is visible in-app. Double/Split/Surrender, rule variants, and the cross-game toggle component are out (v2.x / Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Round lifecycle
- **D-01:** At deal, draw player's two cards + dealer upcard face-up and PREDETERMINE the dealer hole card face-down (the BJ-06 reveal mechanic needs it, mirroring Hold'em's predetermine-then-reveal discipline). Hit cards and dealer playout cards are drawn LIVE from the remaining shoe at action time — blackjack has no rewind requirement, so nothing else is predetermined.
- **D-02:** Odds condition ONLY on visible/known cards (player hand + upcard + any revealed hole + all drawn cards removed from the shoe). The predetermined hole card must never leak into odds while face-down — a `deriveBlackjackConditionedState`-style single-reader guard mirrors Hold'em's D-02 invariant.
- **D-03:** Naturals resolve immediately at deal per standard rules (player natural without dealer natural pays 3:2; both = push; dealer natural checked after player actions... NO — peek convention: with the fixed S17 shoe game we lock the simple NO-PEEK-free variant: naturals are evaluated at deal — if the player has a natural, the round resolves immediately against the dealer's completed hand). Outcome states: win / lose / push, shown in an outcome banner; a new Deal starts the next round.
- **D-04:** Rules locked (from BJ-04 + STATE flag, an explicit decision, not inferred): dealer STANDS on soft 17; natural pays 3:2; win ±1 unit; push 0; dealer draws to 17+. Hard-coded, no settings UI.

### EV semantics (explicit, labeled)
- **D-05:** EV(Stand) = Monte Carlo expectation of standing on the current total (dealer plays out per D-04). EV(Hit) = draw exactly one card THEN STAND (bust = −1). The Hit tile carries visible sub-copy making the "hit once, then stand" basis explicit — honest and computable; optimal-continuation EV is a deferred v2.x refinement recorded in STATE Deferred Items.
- **D-06:** Displayed stats per decision point (BJ-03/04): player bust-if-hit %, dealer final-outcome distribution over 7 buckets (17/18/19/20/21/natural/bust) conditioned on the upcard and removed cards, win/push/lose % for Stand, and the two EV tiles (per-unit, signed, e.g. "−0.18 units"). All stream with the live trial counter (same convergence experience, BJ-02).

### Architecture
- **D-07:** STRUCTURAL PRE-WORK (folds in 05-REVIEW WR-03): extract `<HoldemGame />` from App.tsx so both games are sibling components under the mode fork; the two Hold'em-scoped `[mode]` effects and errorMessage/scenarioOpen state move with it. The diverged testid safety-net arrays get consolidated in the same task.
- **D-08:** Blackjack trials run in the SAME worker via a `blackjackSimulationApi` config on Phase 4's `createStreamingRunner`, exposed through a namespaced Comlink surface (research-locked `{ poker, blackjack }` shape — the poker path's external behavior must not change). No evaluator involvement anywhere in blackjack (hand values are rank sums; duplicates are naturally fine at deckCount=2 — WR-03 does not constrain the blackjack path).
- **D-09:** WR-02 closed THIS phase: the worker boundary validates `deckCount` shape (integer, 1 or 2; reject 0, >2, non-integers with a clear error) for BOTH game APIs.
- **D-10:** New stores: `blackjackStore` (round state: player hand, dealer upcard, predetermined hole, drawn-card ledger, roundPhase: idle|player-turn|resolved, revealedHole flag, blackjack-local deckCount) and blackjack odds state (own store or clearly-partitioned — planner's call) with NO key/field sharing with Hold'em stores (Phase 5 isolation invariants + guard tests must keep passing; extend the guard where it pins store shapes).
- **D-11:** Shoe math via Phase 4 primitives ONLY (`buildShoe`/`shoeWithout`/count-aware logic); all sampling without replacement (DECK-03 discipline); property tests for the blackjack trial fn (dealer playout S17 correctness incl. soft totals, no card over-drawn from the shoe, outcome distribution sanity).
- **D-12:** BJ-07 verification anchor: with a seeded run, natural frequency at deckCount=1 ≈ 4.83% vs ≈ 4.75-4.78% at 2 decks — assert the DIRECTION and approximate magnitude in a statistical test (generous tolerance, fixed seed), and make the in-app toggle → odds change observable in the acceptance test.

### Table layout & UI
- **D-13:** Blackjack scene replaces the Phase 5 placeholder: dealer area top-center (upcard face-up + hole face-down as a FlipCard for the reveal), player hand bottom-center, Hit/Stand controls + the blackjack-local deck-count toggle in the control bar area, outcome banner on resolution, odds cluster docked outside the felt (blackjack's own components — dealer-distribution display, bust stat, EV tiles — reusing the odds-panel visual conventions). Reuse PlayingCard/CardBack/FlipCard/AnimatedCard and the animation gate exactly as Hold'em does (odds gated on card landings, TBL-04 discipline).
- **D-14:** Hit/Stand disabled states follow UI-SPEC conventions (dimming, not destructive color); all new testids lowercase-hyphenated (`blackjack-*` prefix for scene-specific ones); copy conforms to the copy block-list; reveal is one-way per round like Hold'em seats.

### Claude's Discretion
- Exact store partitioning for blackjack odds, component decomposition, dealer playout animation pacing, EV tile styling within tokens, snapshot shape for the blackjack runner config.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 6 goal + 5 success criteria
- `.planning/REQUIREMENTS.md` — BJ-02..BJ-07
- `.planning/research/FEATURES.md` — blackjack odds-explorer loop, educational stat priority, deck-count effect numbers, anti-features
- `.planning/research/ARCHITECTURE.md` — namespaced worker shape, parallel-stores decision
- `.planning/research/PITFALLS.md` — S17/soft-total correctness, with-replacement trap, mode-leakage
- `.planning/STATE.md` Blockers — Phase 4 traps (WR-02 close here; WR-03 constraint), 05-REVIEW WR-03 HoldemGame extraction (D-07), Phase 6 EV-model flag (resolved by D-04/D-05)
- `.planning/phases/05-game-mode-shell-store-separation/05-REVIEW.md` — the switch-back defense mechanisms Phase 6 must not destabilize (restore-mount signal, TableScene prev-ref, live-read guard)
- `.planning/milestones/v1.0-phases/03-casino-table-ui-animation/03-UI-SPEC.md` + `.planning/phases/05-game-mode-shell-store-separation/05-UI-SPEC.md` — carried design system

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 4 shoe primitives + `createStreamingRunner` — the blackjack trial loop is a new config, not new machinery.
- `PlayingCard`/`CardBack`/`FlipCard`/`AnimatedCard` + `useAnimationGate` — full card presentation stack reusable as-is; FlipCard is exactly the hole-card reveal mechanism.
- `gameModeStore` (incl. `holdemRestorePending` restore-mount signal) — blackjack side may need a sibling signal if its scene animates on re-entry; planner decides.
- `simulationService` — extend for the namespaced surface; keep the error listeners (worker-crash path) intact for both games.
- Odds-panel visual conventions (labels, formatPct, aria-busy pending states) from the quick-task fixes.

### Established Patterns
- RED→GREEN pairs; property tests via @fast-check/vitest; seeded createRng; @vitest-environment node for engine/worker; explicit vi.mock factories; guard-test style (comment-stripped source-shape pins); D-NN comment tags.

### Integration Points
- App.tsx mode fork (post-D-07 extraction: <HoldemGame /> vs <BlackjackGame />), worker entry (namespaced expose), Phase 5 isolation/guard tests extended not weakened.

</code_context>

<specifics>
## Specific Ideas

- The dealer-distribution display is the phase's educational centerpiece — 7 labeled buckets that visibly reshape when the upcard changes or the hole is revealed.
- The deck toggle must make its effect FINDABLE: toggling should visibly re-run and land on measurably different numbers (natural %, dealer bust %) — that moment is BJ-07's whole point.

</specifics>

<deferred>
## Deferred Ideas

- Double/Split/Surrender EV (v2.x, recorded), optimal-continuation Hit EV (v2.x, new), peek/insurance/rule variants (out of scope), cross-game toggle component (Phase 8), visual excellence pass (VISUAL-EXCELLENCE-PLAN.md, pending insertion).

</deferred>

---

*Phase: 6-Blackjack Core Odds Loop*
*Context gathered: 2026-08-24*
