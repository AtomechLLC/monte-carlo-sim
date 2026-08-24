# Phase 6: Blackjack Core Odds Loop - Research

**Researched:** 2026-08-24
**Domain:** Blackjack rules engine (hand values, dealer playout, natural resolution), Monte Carlo trial-loop design on an existing generic streaming runner, namespaced Web Worker/Comlink surface, game-mode-shell integration risk (Phase 5 switch-back regressions)
**Confidence:** HIGH for architecture/integration (direct source inspection of the shipped codebase + installed library internals); HIGH for the natural-frequency probability anchor (independently re-derived by combinatorics, matching cited sources exactly); MEDIUM for dealer-bust/outcome-by-upcard reference numbers (corroborated across multiple sources but sourced from 6-deck/infinite-deck tables, not this project's 1-2-deck shoe); MEDIUM-LOW for two explicitly-flagged rules-engine design choices that CONTEXT.md's D-03 text leaves ambiguous (see Assumptions Log A1/A2).

## Summary

Phase 6 is a full vertical slice built entirely on machinery Phases 4-5 already proved: `createStreamingRunner` (generic batch/cancellation/throttled-emission loop), `buildShoe`/`shoeWithout` (count-aware multiset shoe primitives), `PlayingCard`/`CardBack`/`FlipCard`/`AnimatedCard`/`useAnimationGate` (fully generic card presentation + gate primitives), and the `gameModeStore` mode fork. Nothing new needs to be built at the "streaming Monte Carlo plumbing" layer — the entire net-new surface is (1) a from-scratch blackjack rules engine (hand values, dealer S17 playout, natural resolution, win/push/lose) that has zero precedent in this poker-only codebase, and (2) a namespaced `{ poker, blackjack }` Comlink surface, which is a directly-verified-safe pattern (Comlink's proxy `get` trap recursively resolves nested paths — confirmed by reading the installed `comlink` package source).

The single most load-bearing new architectural rule this phase introduces — with no v1 precedent — is that a Blackjack round requires **two structurally different "known cards" exclusion sets drawn from the same shoe**, not one: an **odds-conditioning set** (mirrors Hold'em's D-02 discipline exactly: the predetermined dealer hole card must stay excluded from "known" until revealed, so Monte Carlo trials keep resampling it as unknown) and a **live-shoe ledger** (must ALWAYS include the predetermined hole card, because it is a real physical card already removed from the shoe, face-down or not — a live Hit or the real dealer playout must never accidentally redraw it). Conflating these two sets either leaks the hole card into displayed odds (a D-02 violation) or lets a live action re-deal a card that is already secretly on the table (a physical-shoe-integrity bug). This is documented in detail below with a concrete recommended algorithm.

The second major, non-obvious finding is that **one Monte Carlo trial can and should compute every displayed statistic simultaneously** (dealer-outcome bucket, bust-if-hit, Stand win/push/lose, Hit win/push/lose) by drawing ONE shared per-trial card sequence: the dealer's hypothetical hole + hits come first (dealer play is independent of the player's choice), then one further, distinct card serves as the hypothetical "if I hit" card. This is a standard, valid variance-reduction technique (common random numbers) — not a shortcut that introduces bias — provided the shared draw is a single without-replacement sample and each hypothetical role consumes a disjoint prefix of it.

Third, natural resolution needs a decision this phase's own CONTEXT.md leaves textually ambiguous: **CONTEXT.md D-03 explicitly locks "if the player has a natural, resolve immediately," but does not explicitly say what happens when only the dealer has a natural.** This research recommends resolving the round immediately whenever EITHER side has a natural (the only internally-consistent reading given D-03's closing "outcome states: win/lose/push" and the standard meaning of "no-peek-free" simple blackjack) and flags it as Assumption A1 needing a one-line confirmation, not a re-litigation.

**Primary recommendation:** Build a from-scratch `blackjackHandValue.ts` (hard/soft total with a "demote one ace at a time while busted" loop — this is the one place nearly every hand-rolled blackjack engine gets subtly wrong), a `blackjackConditioning.ts` with two distinct sole-reader functions (one for odds, one for live/outcome draws) mirroring `deriveConditionedState`'s discipline, and a `blackjackEquity.ts` trial function that draws one generous, fixed-size card budget per trial via the existing `createDrawer` and consumes a cursor-based prefix of it for dealer play + the hit hypothetical. Everything else (worker namespacing, store separation, card presentation, animation gating) is direct reuse of already-built, already-fixed patterns — copy the CURRENT (post-05-REVIEW) versions of `TableScene.tsx`'s gate-release effect and `AnimatedCard`'s restore-mount guard, not a naive first draft, since this exact bug class (gate-unit theft on re-mount) was already found and fixed twice for Hold'em and will recur identically for Blackjack if not designed in from the start.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hand-value/dealer-playout/natural rules (blackjack engine) | Browser / Client (Web Worker) | — | Pure computation, no server; runs inside the same Web Worker as Hold'em's engine for the hot Monte Carlo loop, imported directly (unbundled) by the main thread only for the one-time deterministic deal/action resolution |
| Monte Carlo trial loop (bust-if-hit, dealer distribution, EV) | Browser / Client (Web Worker) | — | Identical tier to Hold'em's `runTrials` — must stay off the main thread to keep the UI responsive during 200k-trial batches |
| Round state (player hand, dealer upcard/hole, roundPhase, drawn-card ledger, deckCount) | Browser / Client (Zustand store) | — | No persistence, no server; mirrors `gameStore`'s tier exactly |
| Odds display (dealer-distribution table, bust-if-hit, EV tiles, win/push/lose) | Browser / Client (React components) | — | DOM/SVG rendering, same tier as `OddsPanel`/`OddsTable` |
| Namespaced worker transport (`{ poker, blackjack }`) | Browser / Client (Web Worker + Comlink) | — | Single shared worker thread; Comlink's proxy `get` trap already supports nested-object path resolution natively, no new transport tier needed |
| Card presentation (deal-in, flip reveal) | Browser / Client (React + Motion) | — | Direct reuse of `PlayingCard`/`CardBack`/`FlipCard`/`AnimatedCard` — zero new components needed at this tier |

No CDN/static, SSR, or database/storage tier is implicated anywhere in this phase (client-only app, no persistence, confirmed by `PITFALLS.md`'s Security Mistakes section and re-confirmed below under Security Domain).

## Project Constraints (from CLAUDE.md)

- **Zero new runtime dependencies.** CLAUDE.md's own stack table lists no blackjack-specific package, and STATE.md's Decisions log explicitly records "Zero new runtime dependencies for v2.0 — Blackjack rules engine, multiset shoe, and 2-deck evaluation wrapper are all hand-written TypeScript on the existing v1.0 stack." Confirmed independently by this research: blackjack hand values are rank sums (no evaluator library involvement at all — D-08), so there is no dependency gap to fill.
- **DOM + SVG + Motion rendering only** — do not introduce PixiJS or Konva for the Blackjack table; reuse `PlayingCard`/`CardBack`/`FlipCard`/`AnimatedCard` exactly as Hold'em does (CLAUDE.md "Rendering Approach," "What NOT to Use").
- **Web Worker + Comlink for all Monte Carlo trials** — "Running Monte Carlo trials on the main thread" is explicitly listed as a "What NOT to Use" anti-pattern; Blackjack's trial loop must run inside `simulation.worker.ts`, not on the main thread, even though blackjack's state space is small enough to enumerate exactly (this exact temptation is independently flagged as an anti-feature in `.planning/research/FEATURES.md`'s Differentiators section: "deliberately not exact-enumerating... blackjack could be computed exactly and instantly, but doing so would silently break the app's own teaching device").
- **No `Math.random()` for simulation trials** — use `pure-rand`'s seeded RNG via the existing `createRng`/`createDrawer` (`src/engine/rng.ts`), unchanged, for every Monte Carlo draw. Real (non-simulated) live draws (an actual Hit, the actual dealer playout) should use `createRng()` with no seed, mirroring `gameStore.deal()`'s existing convention for real, non-reproducible-by-design draws.
- **No betting, chips, or bankroll UI** — EV is per-unit, descriptive only (CLAUDE.md project constraints + `REQUIREMENTS.md` "Out of Scope: Betting, chips, bankroll"). This is already locked by CONTEXT.md D-05/D-06.
- **TypeScript 6.0.3 line, not 7.x** — no action needed this phase (no new tooling installed), but any new file must not introduce syntax requiring the TS 7 compiler.
- **GSD workflow enforcement** — file changes for this phase must flow through `/gsd:plan-phase` → execution commands, not direct ad-hoc edits (project-level `CLAUDE.md` directive, orthogonal to the technical content of this research but binding on how the resulting plan gets executed).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BJ-02 | Deal a blackjack round with live streamed Monte Carlo odds + visible trial counter | Reuse `createStreamingRunner` verbatim via a new `blackjackSimulationApi.ts` config; deal-time card draw must be ONE shuffle for all 4 initial cards (player×2, upcard, hole), mirroring `gameStore.deal()`'s single-shuffle discipline (see Architecture Patterns) |
| BJ-03 | Bust-if-hit % + dealer final-outcome distribution (17/18/19/20/21/natural/bust) conditioned on upcard | Trial-Loop Design section: one shared per-trial dealer draw produces the 7-bucket histogram; bust-if-hit uses a distinct hypothetical hit-card draw from the same trial (no shortcut exact-ratio calculation — must flow through Monte Carlo per the project's own anti-exact-enumeration stance) |
| BJ-04 | Win/push/lose % + per-unit EV for Stand vs Hit, fixed S17/3:2/±1/push-0 conventions | EV Computation Shape + Blackjack Rules Engine Correctness Spec sections: EV(Stand)/EV(Hit) trial outcomes are always exactly `{-1, 0, +1}` (never `+1.5`) because naturals are already fully resolved before player-turn is reachable — this resolves an ambiguity in the phase brief's stated `{-1, 0, +1, +1.5}` outcome-unit set |
| BJ-05 | Hit/Stand actions; hit recomputes odds live; Stand plays dealer out and shows outcome | Round Lifecycle + dual-exclusion-set rule: a real Hit/Stand draws from the **live shoe ledger** (includes the hidden hole card as spent), never the odds-conditioning pool; `blackjackStore` actions must call `beginAnimation()` synchronously in the same tick, mirroring `gameStore`'s existing convention, and the Blackjack composition root needs a `TableScene`-style CR-02-safe (prevRef-gated) release effect |
| BJ-06 | Early dealer hole-card reveal, odds recondition on reveal | `FlipCard` reused as-is (already the exact mechanism); reveal moves the hole card from "unknown" to "known" in the odds-conditioning exclusion set only — the live ledger already had it |
| BJ-07 | Deck count (1/2) visibly changes blackjack odds; natural frequency ≈4.83%→≈4.78% | Verified Probability Anchors section: exact combinatorial derivation (64/1326 vs 256/5356) matches cited sources exactly — HIGH confidence, with a statistically-sound tolerance table for a seeded regression test |

</phase_requirements>

## Standard Stack

### Core

No new libraries. Every dependency this phase needs is already installed and already used by the Hold'em path:

| Library | Version | Purpose | Why Standard (for this phase) |
|---------|---------|---------|--------------------------------|
| `zustand` | ^5.0.15 (installed) | `blackjackStore`, `blackjackOddsStore` | Same pattern as `gameStore`/`oddsStore` — no new state library needed |
| `comlink` | ^4.4.2 (installed) | Namespaced `{ poker, blackjack }` worker surface | Directly verified (see Architecture Patterns) to support nested-object path resolution with zero new API surface |
| `pure-rand` | ^8.4.2 (installed) | Seeded trial RNG via existing `createRng`/`createDrawer` | Already the sole RNG source in the codebase; blackjack trials must use the same seedable generator for deterministic tests |
| `motion` (Framer Motion) | ^13.1.1 (installed) | Deal-in / flip-reveal animation | `AnimatedCard`/`FlipCard` are already built on this and are reused unmodified |
| `@fast-check/vitest` | ^0.4.1 (installed) | Property tests for the dealer-playout/hand-value engine | Matches the codebase's established pattern (`equity.property.test.ts`, `multisetSampling.property.test.ts`) — new invariants: "dealer playout never draws a card already known," "handTotal's demotion loop never leaves total>21 with a soft ace still counted," "dealer-distribution bucket counts always sum to trialsCompleted" |

### Explicitly NOT needed

| Would-be dependency | Why not |
|---|---|
| `@poker-apprentice/hand-evaluator` or any hand-evaluator | D-08 locks "No evaluator involvement anywhere in blackjack — hand values are rank sums." Confirmed independently: blackjack has no 5-card-combination-ranking problem, only integer arithmetic on a fixed-size hand. |
| A second Web Worker | ARCHITECTURE.md (milestone-level, already researched) recommends and this research confirms: one worker, two namespaced Comlink APIs — only one game simulates at a time, so a second worker thread doubles crash-listener/lifecycle bookkeeping for zero benefit. |

**Installation:** None — zero new packages this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (confirmed against `.planning/STATE.md`'s locked decision "Zero new runtime dependencies for v2.0" and independently re-derived above: blackjack's engine is pure arithmetic on the existing `Card` type, and every piece of Monte Carlo/worker/animation machinery it rides on is already installed). The Package Legitimacy Gate protocol (slopcheck, registry verification) does not apply — skip it. If a future plan discovers a genuine need for a new package, re-run the gate at that time; do not retroactively assume this audit covers a package introduced later.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Main thread                                                             │
│                                                                           │
│  User clicks Deal ──▶ blackjackStore.deal()                             │
│    │  1. ONE drawN(rng, shoeWithout(deckCount, picks), 4) shuffle for   │
│    │     player×2 + upcard + hole (never 2 separate draws — collision   │
│    │     risk, mirrors gameStore.deal()'s existing discipline)          │
│    │  2. beginAnimation() synchronously in the same set() tick          │
│    │  3. Deterministic natural check (resolveNaturals) — reads the      │
│    │     raw predetermined hole card ONCE, for outcome purposes only    │
│    │                                                                     │
│    ├─▶ Natural on either side? ──▶ roundPhase='resolved', outcome       │
│    │       banner shows win/push/lose immediately. NO Monte Carlo run.  │
│    │                                                                     │
│    └─▶ No natural ──▶ roundPhase='player-turn'                         │
│           │                                                              │
│           ▼                                                              │
│  BlackjackGame's odds effect (mirrors HoldemGame's effect exactly:      │
│  mode-gate → animation-gate → cache-gate → deriveBlackjackConditionedState│
│  → blackjackSimulationService.startSimulation → applySnapshot)          │
│           │                                                              │
│           │  deriveBlackjackConditionedState reads ONLY player hand +   │
│           │  upcard + (revealed hole, if any) — NEVER the raw           │
│           │  predetermined hole while hidden (D-02 discipline mirrored) │
│           ▼                                                              │
│  postMessage ──────────────────────────────────────────────────────────▶│
├─────────────────────────────────────────────────────────────────────────┤
│  Web Worker (simulation.worker.ts)                                      │
│  Comlink.expose({ poker: createSimulationApi(),                        │
│                    blackjack: createBlackjackSimulationApi() })         │
│                                                                           │
│  createBlackjackSimulationApi() → createStreamingRunner({               │
│    getRemainingDeck, unknownCardsPerTrial (fixed generous budget, NOT   │
│    an exact count — see Trial-Loop Design), runBatch: runBlackjackTrials│
│  })                                                                      │
│                                                                           │
│  Per trial (runBlackjackTrials): ONE drawUnknown() call ──▶             │
│    drawn[0]           = hypothetical dealer hole card                   │
│    drawn[1..k]         = dealer hits until total≥17 (S17: soft==hard)   │
│    drawn[k+1]         = hypothetical "if I hit" card (disjoint slot)    │
│    → tallies: dealerOutcomeCounts[7], bustIfHitCount,                   │
│      standOutcomes{win,push,lose}, hitOutcomes{win,push,lose}           │
├─────────────────────────────────────────────────────────────────────────┤
│  ◀───────────────────────── throttled ProgressSnapshot stream ──────────│
│  Main thread: applySnapshot → BlackjackOddsPanel re-renders             │
│  (dealer-distribution table, bust-if-hit %, EV(Stand)/EV(Hit) tiles)    │
└─────────────────────────────────────────────────────────────────────────┘

  Separately, on a REAL Hit/Stand/Reveal action:
  blackjackStore reads the LIVE shoe ledger (player hand + upcard +
  predetermined hole — ALWAYS included, hidden or not — + any cards
  already live-drawn this round) and draws the ACTUAL next card via
  createRng()/drawN — a completely separate exclusion set from the
  odds-conditioning pool above. See "The dual-exclusion-set rule" below.
```

### Recommended Project Structure

Naming below matches `.planning/research/ARCHITECTURE.md`'s already-researched milestone-level file layout (that document is the canonical source for the cross-phase file plan; this section only adds blackjack-rules-specific detail ARCHITECTURE.md didn't need to resolve):

```
src/engine/
├── blackjackHandValue.ts      # handTotal() (hard/soft/bust), isNatural(), RANK_VALUE map
├── blackjackConditioning.ts   # TWO sole-reader functions (see below) — odds vs. live/outcome
└── blackjackEquity.ts         # runBlackjackTrials (pure per-batch trial fn), unknownCardsPerTrial
src/worker/
├── blackjackProtocol.ts       # BlackjackConditionedState, BlackjackProgressSnapshot types
├── blackjackSimulationApi.ts  # createBlackjackSimulationApi() on createStreamingRunner
└── simulation.worker.ts       # MODIFIED: Comlink.expose({ poker, blackjack })
src/state/
├── blackjackStore.ts          # round state (D-10): hand, upcard, hole, ledger, roundPhase, revealedHole, deckCount
├── blackjackOddsStore.ts      # settled-cache + live display fields, blackjack-shaped snapshot
└── blackjackSimulationService.ts  # thin wrapper on the shared worker singleton, .blackjack namespace
src/ui/
├── HoldemGame.tsx             # D-07 extraction — App.tsx's existing effect + JSX, moved verbatim
├── BlackjackGame.tsx          # replaces BlackjackScene.tsx placeholder; owns the mode-gated odds effect
├── BlackjackTable.tsx         # composition root — the gate-release effect lives HERE (mirrors TableScene)
├── BlackjackOddsPanel.tsx     # docks outside the felt, aria-busy pattern reused
├── DealerDistributionDisplay.tsx  # 7-bucket table
├── BustEvDisplay.tsx          # bust-if-hit % + EV(Stand)/EV(Hit) tiles
└── BlackjackControls.tsx      # Deal / Hit / Stand / deck-count toggle
```

### Pattern 1: The dual-exclusion-set rule (the phase's central new architectural principle)

**What:** Blackjack needs TWO different "known cards" sets derived from the SAME predetermined round, each feeding a different consumer:

1. **Odds-conditioning set** (`deriveBlackjackConditionedState`) — `[...playerHand.allCardsSoFar, dealerUpcard, ...(revealedHole ? [predeterminedHole] : [])]`. This is what `shoeWithout(deckCount, ...)` excludes to build the Monte Carlo trial pool. The predetermined hole card is **deliberately excluded from this set until revealed** — exactly mirroring `deriveConditionedState`'s D-02 treatment of Hold'em's hidden opponent holes and hidden board cards.
2. **Live shoe ledger** (used by the real Hit action and the real dealer playout when Stand is chosen) — `[...oddsConditioningSet-equivalent-fields, predeterminedHole]` — the predetermined hole card is **always** included here, whether hidden or revealed, because it is a real physical card already removed from the shoe.

**When to use:** Every read of "what cards remain in the shoe" in this phase's engine code must go through exactly one of these two functions, never a third ad-hoc exclusion list.

**Why this matters (the failure modes if conflated):**
- Using the live ledger's exclusion set for ODDS conditioning would remove the predetermined hole card from the Monte Carlo trial pool, silently narrowing the sample space the trials draw from — a bias, not a crash, so it would not be caught by a smoke test. This is the same *class* of bug as PITFALLS.md's Pitfall 5 (peeking at the predetermined hole card), just manifesting as a shrunk sample space rather than a direct value read.
- Using the odds-conditioning set for a LIVE draw would leave the predetermined hole card "in the pool," risking the live draw physically re-dealing the exact same card that is secretly the hole card — impossible at `deckCount=1` (shoe integrity violation: two copies of one card on the table) and silently wrong at `deckCount=2` (the sibling copy gets consumed by the wrong role).

**Example (recommended shape):**
```typescript
// src/engine/blackjackConditioning.ts

/** Sole reader of the raw predetermined hole card for ODDS purposes (D-02 mirror). */
export function deriveBlackjackConditionedState(
  round: PredeterminedBlackjackRound,
  playerCardsSoFar: readonly Card[],
  revealedHole: boolean,
  deckCount: DeckCount,
): BlackjackConditionedState {
  const knownCards: Card[] = [
    ...playerCardsSoFar,
    round.dealerUpcard,
    ...(revealedHole ? [round.dealerHole] : []),
  ];
  return {
    playerHand: playerCardsSoFar,
    dealerUpcard: round.dealerUpcard,
    remainingDeck: shoeWithout(deckCount, knownCards), // hole stays "in the pool" until revealed
    deckCount,
  };
}

/** Sole reader of the raw predetermined hole card for LIVE/OUTCOME purposes. */
export function liveShoeLedger(
  round: PredeterminedBlackjackRound,
  playerCardsSoFar: readonly Card[],
  liveDrawnSoFar: readonly Card[],
  deckCount: DeckCount,
): Card[] {
  const known: Card[] = [
    ...playerCardsSoFar,
    round.dealerUpcard,
    round.dealerHole, // ALWAYS included — a real, already-dealt card
    ...liveDrawnSoFar,
  ];
  return shoeWithout(deckCount, known);
}
```

### Pattern 2: Single-shuffle deal (reuse of an existing anti-collision discipline)

**What:** Draw all 4 of the round's initial cards (player×2, dealer upcard, dealer hole) from ONE `drawN(rng, pool, 4)` call, never as separate sequential draws.

**When to use:** `blackjackStore.deal()`.

**Why:** `gameStore.deal()`'s own top-of-function comment already states this exact principle for Hold'em ("Never draw a second time for a different slot category — independent draws from the same starting pool can collide") — this is a direct, proven precedent to copy, not a new risk specific to blackjack.

### Pattern 3: Gate-release effect on the Blackjack composition root — copy the FIXED version

**What:** `gameStore`'s navigation actions (`deal`, `advanceStreet`, `rewindStreet`, `reveal`) each call `useUiStore.getState().beginAnimation()` synchronously, arming ONE "placeholder" gate unit the instant the action dispatches — before any child `AnimatedCard`/`FlipCard` has had a chance to register its own unit via its own passive effect. `TableScene.tsx` (the common ancestor, whose effects run AFTER all children's per React's child-first passive-effect flush order) is the ONE place that releases that placeholder unit — and only when its tracked deps (`dealNonce`/`street`/`revealedMask`) actually *changed* versus a `useRef`-tracked previous value, never unconditionally on every mount.

**When to use:** `blackjackStore`'s `deal`/`hit`/`stand`/`reveal` actions must each call `beginAnimation()` synchronously in the same `set()` tick (mirroring `gameStore` exactly), and `BlackjackTable.tsx` needs an analogous release effect.

**Why this is worth calling out explicitly:** This exact bug (CR-02 in `05-REVIEW.md`) was shipped and had to be fixed TWICE for Hold'em — once for the original TableScene, and its underlying cause (an unconditional `endAnimation()` on every mount, including a mode-switch re-mount with cards already in flight) is now permanently documented in `TableScene.tsx`'s own comment. A Blackjack composition root written from a naive "release on every mount" starting point will reproduce the identical bug the instant the user switches away from Blackjack mid-round and back. Copy the CURRENT (prevRef-gated, no-cleanup) pattern verbatim, adapting the tracked keys to whatever `blackjackStore` fields change on a real action (e.g. `roundNonce`/`playerHandLength`/`roundPhase`/`revealedHole` — the planner's call, per D-10, but MUST include enough fields that every `beginAnimation()` call site has a matching dependency change).

```typescript
// BlackjackTable.tsx — mirrors TableScene.tsx's CR-02 fix exactly
const prevRef = useRef({ roundNonce, roundPhase, revealedHole });
useEffect(() => {
  const prev = prevRef.current;
  if (prev.roundNonce === roundNonce && prev.roundPhase === roundPhase && prev.revealedHole === revealedHole) {
    return; // mount / StrictMode re-invoke / mode switch-back re-mount: nothing armed anything
  }
  prevRef.current = { roundNonce, roundPhase, revealedHole };
  useUiStore.getState().endAnimation();
}, [roundNonce, roundPhase, revealedHole]);
```

### Pattern 4: Namespaced Comlink surface — verified safe

**What:** `Comlink.expose({ poker: createSimulationApi(), blackjack: createBlackjackSimulationApi() })` in `simulation.worker.ts`; `Comlink.wrap<{ poker: SimulationApi; blackjack: BlackjackSimulationApi }>(worker)` on the main thread; call as `api.poker.runSimulation(...)` / `api.blackjack.runSimulation(...)`.

**Verification (this session):** Read `node_modules/comlink/dist/esm/comlink.mjs` directly. `createProxy`'s `get` trap does `return createProxy(ep, pendingListeners, [...path, prop])` for any non-special property access — i.e., every `.poker`/`.blackjack`/`.runSimulation` access builds up an accumulating `path` array and returns a fresh proxy, resolved via a single `requestResponseMessage` when finally invoked (the `apply` trap, not shown above but present in the same file). This is exactly the mechanism that makes `api.blackjack.runSimulation(...)` work with zero special-casing — Comlink was built for arbitrarily nested object graphs, not just flat top-level functions. `[VERIFIED: comlink package source, node_modules/comlink/dist/esm/comlink.mjs]` — HIGH confidence, this is a direct reading of the shipped, installed dependency, not training-data recall.

**Corroboration:** WebSearch results independently describe the identical pattern ("expose a single object that contains multiple namespaced APIs like `{ api1: {...}, api2: {...} }`") as a standard, documented Comlink usage for exactly this scenario. `[CITED: multiple Comlink usage writeups, MEDIUM confidence — corroborating, not primary]`

**Split `simulationService.ts`:** Either follow ARCHITECTURE.md's recommended 3-file split (`workerClient.ts` singleton + `pokerSimulationService.ts` + `blackjackSimulationService.ts`), or keep one file exporting two independent `start*/cancel*` function pairs sharing the same module-scope `worker`/`api`/crash-listener singleton — both are valid; this is Claude's Discretion (file organization, not locked by CONTEXT.md). Whichever is chosen, **cancel both games' in-flight runs on every mode switch** (cheap, idempotent, closes a race on rapid mode-flipping) — ARCHITECTURE.md's explicit recommendation, and consistent with Phase 5's existing "switching modes cancels the leaving game's run" invariant.

### Pattern 5: Generalize the restore-mount signal for the Blackjack direction too

**What:** `gameModeStore.holdemRestorePending` currently only fires on a blackjack→holdem transition (consumed by `AnimatedCard`/`FlipCard` to suppress replaying the deal/flip animation on switch-back). Blackjack's own cards need the identical protection in the OTHER direction: switching holdem→blackjack→holdem→blackjack (mid-round) will otherwise replay Blackjack's deal-in/flip animations on every return visit, exactly the class of bug 05-REVIEW WR-02 already found and fixed for Hold'em.

**Recommendation:** Add a `blackjackRestorePending: boolean` field to `gameModeStore`, set on a holdem→blackjack transition (symmetric to the existing field's holdem-direction logic), consumed by Blackjack's own `AnimatedCard`/`FlipCard` usages exactly the way `HoldemGame`'s cards already consume `holdemRestorePending`. This is a same-shape, same-file addition — not a new pattern to design from scratch — and is explicitly anticipated by D-10's "planner decides" framing ("blackjack side may need a sibling signal if its scene animates on re-entry").

### Anti-Patterns to Avoid

- **Reusing `gameStore`'s `street`/`revealedMask` fields or App.tsx's single Hold'em effect for Blackjack** — PITFALLS.md's Pitfall 10/11 (mode leakage, shared-cache collision) apply verbatim; Blackjack needs its own store, its own odds cache, and its own effect (already the direction D-07/D-10 lock).
- **Rejection-free vs. rejection-sampling for the dealer-distribution Monte Carlo — pick ONE, document it, do not silently drift.** See Blackjack Rules Engine Correctness Spec, "Should the trial condition out a hypothetical dealer natural?" below — this is a real design fork, not an oversight to "fix" ad hoc mid-implementation.
- **Computing bust-if-hit as an exact ratio instead of a Monte Carlo tally** — technically correct and cheaper, but breaks the project's own established "watch everything converge, even the trivially-exact numbers" pedagogical stance (`FEATURES.md` Differentiators: "blackjack could be computed exactly and instantly, but doing so would silently break the app's own teaching device").
- **A "just render it twice" gate-release effect that ignores whether a mount is a real action vs. a mode-switch re-mount** — see Pattern 3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming batch loop, cancellation, throttled emission, run-token supersession | A second copy of the batch/cancel/emit loop for Blackjack | `createStreamingRunner<TConditioned, TBatch, TSnapshot>` (`src/worker/streamingRunner.ts`), unmodified | This exact machinery had a real shipped bug (WR-01, requestId-equality vs. object-identity supersession) already found and fixed once — a copy-paste sibling would not inherit the fix, and the generic runner already accepts a fully custom `validate`/`runBatch`/`toSnapshot` config, so there is no reason to fork it |
| Multi-deck shoe exclusion (count-aware, not value-based) | A blackjack-specific `Set`-based "used cards" helper | `shoeWithout(deckCount, excludedArray)` / `buildShoe(deckCount)` (`src/engine/shoe.ts`), unmodified | Already correctly count-aware (verified by direct reading, confirmed in Pitfall 6/PITFALLS.md's terms) — a fresh `Set`-based helper would silently reintroduce the exact duplicate-collapse bug the existing primitive exists to prevent |
| Card deal-in / flip-reveal animation, animation gating | New Blackjack-specific animation components | `PlayingCard`/`CardBack`/`FlipCard`/`AnimatedCard`/`useAnimationGate`/`useExitGate`, unmodified | Already fully generic (string/number keys, no poker-specific logic) and already correctly handle StrictMode double-invocation and the mode-switch re-mount edge case (post-05-REVIEW) |
| Percentage formatting with a pending/zero-trials dash | A second `formatPct`-alike | `formatPct.ts`, unmodified, for every %-shaped stat (bust-if-hit, Stand win/push/lose) | Already the single shared implementation (dedupe already happened once, per its own comment) |
| RNG for Monte Carlo trials | A second seeded RNG wrapper | `createRng`/`createDrawer` (`src/engine/rng.ts`), unmodified | Already deck-count/uniqueness-agnostic (operates on plain `Card[]`, no assumption of no-duplicates) — zero changes needed for blackjack's use |

**Key insight:** Every piece of *generic* machinery this phase needs was already built, generalized, and proven by Phases 4-5 specifically so that Blackjack (the "first real consumer that exercises the multiset primitive under normal, non-error-path conditions" per ARCHITECTURE.md) would not need to hand-roll it. The only genuinely new code this phase must hand-write is the blackjack RULES (hand values, dealer playout, natural resolution, win/push/lose) — which is correct, since nothing generic could have anticipated blackjack-specific game logic.

## Blackjack Rules Engine Correctness Spec

### Card rank values

```typescript
import { getRank } from '@poker-apprentice/types'; // [VERIFIED: package source, dist/types/index.d.ts — already an exported function, not previously imported by this codebase]

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11, // Ace starts at 11; demoted below as needed
};
```

### Hand-value algorithm (hard/soft totals, multiple aces)

```typescript
export interface HandTotal {
  total: number;
  /** True iff at least one Ace is STILL being counted as 11 after the demotion loop. */
  soft: boolean;
  bust: boolean;
}

export function handTotal(cards: readonly Card[]): HandTotal {
  let total = 0;
  let softAces = 0;
  for (const card of cards) {
    const rank = getRank(card);
    if (rank === 'A') { total += 11; softAces += 1; }
    else total += RANK_VALUE[rank];
  }
  // Demote ONE ace at a time, in a loop, until the total is not bust OR no soft ace remains.
  // This loop (not a single one-time demotion) is what correctly handles multiple aces.
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }
  return { total, soft: softAces > 0, bust: total > 21 };
}
```

**Why the loop, not a single `if`:** PITFALLS.md Pitfall 2 documents this exact trap directly (soft-total valuation checked once, or only one Ace ever demoted). A single-Ace demotion silently misclassifies `[A,A,9]` (should be soft 21) or busts `[A,A,A,8]` incorrectly. The `while` loop is the only construction that is correct for 1, 2, or 3 Aces uniformly.

### Reference test vectors — hand value (exact-value unit tests)

| Cards | Total | Soft? | Bust? | Note |
|---|---|---|---|---|
| `[7h, 7c]` | 14 | false | false | Plain hard total, no aces |
| `[Ah, 6c]` | 17 | true | false | Canonical soft 17 |
| `[6h, 6c, Ad]` | 13 | false | false | **Canonical Pitfall-2 vector**: naive "contains an ace" softness check would misclassify this as soft; correct demotion loop yields hard 13 (6+6+11=23>21 → demote → 13, no soft ace left) |
| `[Ah, 6c, Td]` | 17 | false | false | **Canonical "hard 17 despite an Ace" vector** (PITFALLS.md Pitfall 2/3): 11+6+10=27>21 → demote → 17, hard. Under S17 the dealer stands here — correctly, since S17 stands on ALL 17s regardless of softness, but the point is the ENGINE must not mis-total this as "soft 17" internally |
| `[Ah, Ac, 9d]` | 21 | true | false | Multiple-aces vector: 11+11+9=31>21 → demote once → 21, one ace still soft |
| `[Ah, Ac, Ad, 8c]` | 21 | true | false | Three-aces vector: 33+8=41>21 → demote twice → 21, one ace still soft |
| `[Kh, Qc, 2d]` | 22 | false | true | Plain bust, no aces involved |
| `[Ah, Kc]` (exactly 2 cards, INITIAL deal) | 21 | — | false | **Natural** — see below |
| `[7h, 7c, 7d]` (3 cards) | 21 | false | false | **NOT a natural** — same total as above, reached via 3 cards. Must be priced as a plain 21, not 3:2 |

### Natural detection and resolution order

**Detection:** `isNatural(cards) = cards.length === 2 && handTotal(cards).total === 21`, checked **only** immediately after the initial two-card deal — never re-checked after a hit (a hit-into-21 always has ≥3 cards by construction, so `cards.length === 2` alone is a sufficient and correct guard; PITFALLS.md Pitfall 4 warns against the weaker "any 21" check).

**Resolution order (recommended, deterministic, at deal time — before `roundPhase` ever becomes `'player-turn'`):**

1. Draw all 4 initial cards in one shuffle (Pattern 2 above).
2. Check `playerNatural = isNatural(playerHand)` and `dealerNatural = isNatural([upcard, hole])` — this is the ONE place in the "outcome" reader function permitted to read the raw predetermined hole card before any reveal (mirrors PITFALLS.md Pitfall 5's "one sole-reader function" discipline, applied to the outcome path specifically, distinct from the odds-conditioning sole-reader in Pattern 1).
3. If `playerNatural && dealerNatural` → **push**, `roundPhase = 'resolved'`.
4. Else if `playerNatural` → **win, pay 3:2**, `roundPhase = 'resolved'`.
5. Else if `dealerNatural` → **lose**, `roundPhase = 'resolved'`. *(See Assumption A1 below — this step is the one CONTEXT.md D-03 does not explicitly spell out.)*
6. Else → `roundPhase = 'player-turn'`; neither hand is a natural, by construction, for the remainder of the round's Monte Carlo/decision-point phase.

**Reference test vectors — natural resolution:**

| Player | Dealer (up+hole) | Outcome | Payout |
|---|---|---|---|
| `[Ah, Kc]` (natural) | `[9d, 6s]` (18) | Player wins | +1.5 |
| `[Ah, Kc]` (natural) | `[Ac, Ks]` (natural) | Push | 0 |
| `[9h, 9c]` (18, not natural) | `[Ac, Ks]` (natural) | Player loses | -1 |
| `[Ah, 8c]` (19, not natural) | `[9d, 6s]` (15 → will hit) | Neither natural → `roundPhase='player-turn'`, Monte Carlo odds begin |

### Dealer S17 playout

**Decision rule:** `hit while total < 17` — no soft/hard branch needed under S17, because S17 means "stand on ALL 17s, hard or soft" (this is precisely what distinguishes it from the out-of-scope H17 variant, which this project hard-locks away per D-04). The engine must still compute `total` via the full `handTotal` demotion loop above — PITFALLS.md Pitfall 3's trap is not "forgetting a soft/hard branch" (there is none, correctly, under S17) but "computing `total` naively" (e.g., always counting aces as 1, or always as 11 without demotion), which corrupts the `<17` check regardless of which stand-rule variant is in play.

```typescript
function playDealerHand(upcard: Card, hole: Card, drawNext: () => Card): { cards: Card[]; result: HandTotal } {
  const cards = [upcard, hole];
  let result = handTotal(cards);
  while (!result.bust && result.total < 17) {
    cards.push(drawNext());
    result = handTotal(cards);
  }
  return { cards, result };
}
```

**Bucket classification (BJ-03's 7 buckets, fixed order recommendation: `[17, 18, 19, 20, 21, natural, bust]`):**

```typescript
function classifyDealerOutcome(cards: Card[], result: HandTotal): DealerBucket {
  if (result.bust) return 'bust';
  if (cards.length === 2 && result.total === 21) return 'natural';
  return String(result.total) as '17' | '18' | '19' | '20' | '21';
}
```

### Win/push/lose comparison — including the natural-priority rule

```typescript
function compareToDealer(
  player: { total: number; bust: boolean },
  dealer: { total: number; bust: boolean; bucket: DealerBucket },
): 'win' | 'push' | 'lose' {
  if (player.bust) return 'lose';
  if (dealer.bust) return 'win';
  if (dealer.bucket === 'natural') return 'lose'; // dealer natural beats ANY non-natural total, incl. a non-natural 21 — never a push
  if (player.total > dealer.total) return 'win';
  if (player.total < dealer.total) return 'lose';
  return 'push';
}
```

**Why the `dealer.bucket === 'natural'` branch matters even though the REAL round can never reach a Stand decision against an actual dealer natural (naturals are fully resolved at deal time per the resolution order above):** this comparison function is also the one used INSIDE the Monte Carlo trial loop, where a *hypothetical* dealer hole card can legitimately sample a natural-shaped value (see "Should the trial condition out a hypothetical dealer natural?" below) even though the real predetermined hole is known (by construction) not to be one. Getting this branch wrong would silently miscount a fraction of trials as "push" that should be "dealer wins," which is invisible in a smoke test and only shows up as a small, hard-to-explain skew in the reported win/push/lose percentages.

**Reference test vector:** dealer hand `[Ac, Ks]` (natural, bucket='natural') vs. player total 21 via `[7h, 7c, 7d]` (non-natural 21) → **dealer wins**, not a push.

### Should the trial condition out a hypothetical dealer natural? (explicit design fork — recommend Option A)

Because naturals are resolved deterministically at deal time (per the resolution order above), by the time `roundPhase === 'player-turn'` is reachable, the game already knows with certainty that the REAL dealer hole card does not make a natural. The Monte Carlo trial loop computing the dealer-outcome distribution during player-turn could either:

- **(A) Not condition on this fact** — sample the hypothetical hole card uniformly from the odds-conditioning remaining deck, including hole values that would produce a hypothetical dealer natural. This is what every published "dealer bust/outcome chart by upcard" reference (Wizard of Odds, blackjackinfo.com) computes — pre-decision, upcard-conditioned only, not additionally conditioned on "the round reached a decision point." **Recommended default** — it keeps the BJ-07/verification-anchor numbers directly comparable to cited literature (see Verified Probability Anchors below), needs no extra trial-loop logic, and wastes no trials.
- **(B) Condition on it via rejection sampling** — discard and redraw any hypothetical hole card that would create a dealer natural, since the app deterministically knows this can't be the real case. This is more rigorous (a fully "honest" conditional probability given everything the app currently knows) and arguably a better teaching moment ("once you're asked to act, you already know the dealer doesn't have blackjack" — a real, if subtle, blackjack fact) but adds trial-loop complexity and produces numbers that will NOT match the published dealer-bust-by-upcard reference tables (a modest but real shift, since the natural bucket's ~7-31% probability mass, upcard-dependent, gets redistributed).

**Recommendation:** Ship (A) for this phase. It is simpler, matches the literature this phase's own verification anchors are drawn from, and is not contradicted by any locked CONTEXT.md decision. Note (B) explicitly in the plan as a deliberately deferred rigor enhancement (candidate for a future EDU/annotation-layer phase), not a bug to silently "fix" later without a decision record.

## Verified Probability Anchors

### Natural (blackjack) frequency — exact combinatorial derivation

At `deckCount=1` (52 cards: 4 Aces, 16 ten-value cards `{T,J,Q,K}×4 suits`):

```
P(natural) = C(4,1) × C(16,1) / C(52,2) = (4 × 16) / 1326 = 64 / 1326 ≈ 4.8265%
```

At `deckCount=2` (104 cards: 8 Aces, 32 ten-value cards):

```
P(natural) = (8 × 32) / C(104,2) = 256 / 5356 ≈ 4.7797%
```

`[VERIFIED: derived independently by combinatorics in this session AND cross-checked via WebSearch against forums.saliu.com's identical worked formula — both the 1-deck (64/1326) and 2-deck (256/5356) figures match exactly]`. HIGH confidence — this is a closed-form probability, not a Monte-Carlo-only approximation, so a test can assert against it with a tight, principled tolerance (below) rather than a loosely-guessed band.

### Statistically sound tolerance for a seeded regression test

Standard error for a binomial proportion: `SE = sqrt(p(1-p)/n)`. Using `p ≈ 0.0483` (1-deck):

| Rounds dealt (n) | SE | 3σ band (≈99.7% CI) | Recommended assertion tolerance |
|---|---|---|---|
| 1,000 | ±0.68pp | ±2.0pp | Not recommended — too noisy for a tight assertion |
| 10,000 | ±0.21pp | ±0.64pp | ±1.0 percentage point |
| 100,000 | ±0.068pp | ±0.20pp | ±0.3 percentage point |
| 200,000 | ±0.048pp | ±0.14pp | ±0.25 percentage point |

**Recommended test design:** deal N rounds with a fixed seed (via `createRng(seed)`), tally the fraction that are natural at `deckCount=1` and separately at `deckCount=2`, and assert (a) both fall within tolerance of their respective closed-form value above, AND (b) the 1-deck fraction is measurably higher than the 2-deck fraction by at least ~0.3pp (guards against the with-replacement/infinite-deck shortcut PITFALLS.md Pitfall 1 warns about — that bug would make the two decks converge to the SAME number, not just a slightly-off number). 10,000 rounds is a reasonable default for test runtime; use 100,000+ if CI budget allows for a tighter bound.

**Important scope note:** this is a test of the DEAL-TIME natural-resolution function (repeated deals, count how many are natural), not the per-decision-point Monte Carlo trial loop — a structurally different kind of statistical test than the dealer-outcome-distribution check below.

### Dealer bust / final-outcome distribution by upcard

`[CITED: blackjackinfo.com "Blackjack Dealer Outcome Probabilities" and multiple corroborating sources (liveabout.com, casino.org), MEDIUM confidence — these are 6-deck-or-infinite-deck S17 tables, not this project's 1-2-deck shoe, so treat the exact percentages as SHAPE/ranking references, not tight assertion targets]`

| Upcard | Bust % (approx., S17, large-deck reference) |
|---|---|
| 2 | ~33-35% |
| 3 | ~36-38% |
| 4 | ~39-40% |
| 5 | ~42% (highest) |
| 6 | ~42% (highest) |
| 7 | ~26% |
| 8 | ~23-24% |
| 9 | ~22-23% |
| 10 | ~21% (lowest non-Ace) |
| Ace | ~12-17% (lowest overall) |

Overall dealer bust rate across all upcards (weighted): **~28-30%** `[CITED: Medium/"statistics of blackjack" writeups, MEDIUM confidence, corroborated by 2+ independent sources]`.

**Recommended verification approach for THIS project's 1-2 deck shoe:** do not assert against the exact percentages above (deck count materially shifts them). Instead assert:
1. **Shape/ranking invariant** (robust across deck counts): bust probability for upcards 5 and 6 is the highest, and for upcard 10/Ace is the lowest — this ranking is a structural property of the game (weak upcards force more hits), not a magic number, and should hold at 1 or 2 decks with generous tolerance (a wide band, e.g. ±5pp, since this is a directional/ranking check, not a value check).
2. **Overall bust rate in a plausible band** (~25-32%) at 200,000 trials with the tolerance-table reasoning above (using p≈0.28, SE≈0.10pp at n=200,000, so a ±2-3pp band comfortably covers both statistical noise AND the 1-2-deck-vs-published-6-deck gap).

### EV convention comparability caveat

`[CITED: theprobabilitylab.com, gamblingcalc.com, MEDIUM confidence]` — every surveyed real-world "Hit EV" calculator computes EV under OPTIMAL CONTINUATION (hit repeatedly per basic strategy, not just once) — this project's D-05-locked EV(Hit) ("draw exactly one card then STAND, forced") is a structurally different, simpler number. **The displayed EV(Hit) tile must not be presented or labeled in a way that invites direct comparison to a "real" blackjack calculator's Hit EV number** — CONTEXT.md D-05 already anticipates this ("The Hit tile carries visible sub-copy making the 'hit once, then stand' basis explicit"); this research confirms that sub-copy requirement is well-founded, not just a defensive UX flourish.

## EV Computation Shape

**Confirmed: EV(Stand) and EV(Hit) trial outcomes are always exactly `{-1, 0, +1}` — never `+1.5`.** Naturals are fully and deterministically resolved before `roundPhase` can ever be `'player-turn'` (per the resolution order above), so the Stand/Hit Monte Carlo trial loop can never observe a "player natural" case — a natural specifically requires the INITIAL 2-card hand, and by the time Stand/Hit odds are being computed, the player's decision point already implies the initial 2 cards were checked and found not to be a natural. This resolves an ambiguity in the phase brief's stated `{-1, 0, +1, +1.5}` outcome-unit set: **all four units appear somewhere in the ROUND's full outcome space (the one-time deterministic natural-resolution step can emit +1.5), but the RECURRING Monte Carlo trial loop that powers the live-converging EV tiles only ever emits `{-1, 0, +1}`.** Do not build the trial accumulator with a "natural" bucket — it would always be zero and add dead code.

```typescript
interface BlackjackProgressSnapshot {
  requestId: number;
  /** Length 7, fixed order [17, 18, 19, 20, 21, natural, bust]. */
  dealerOutcomeCounts: number[];
  bustIfHitCount: number;
  standOutcomes: { win: number; push: number; lose: number };
  hitOutcomes: { win: number; push: number; lose: number };
  trialsCompleted: number;
  done: boolean;
}

// EV(Stand) = (standOutcomes.win * 1 + standOutcomes.push * 0 + standOutcomes.lose * -1) / trialsCompleted
// EV(Hit)   = (hitOutcomes.win  * 1 + hitOutcomes.push  * 0 + hitOutcomes.lose  * -1) / trialsCompleted
// bust-if-hit % = bustIfHitCount / trialsCompleted
```

**Streaming:** identical pattern to Hold'em's `applySnapshot`/`cacheIfSettled` — the worker streams cumulative integer tallies (never a running average directly), and the UI derives percentages/EV at display time. `formatPct.ts` is directly reusable for the %-shaped stats (bust-if-hit, Stand/Hit win/push/lose); EV needs one new small formatter (e.g. `formatEv(outcomeCounts, trialsCompleted, pending): string`) that produces a signed decimal like `"−0.18"` rather than a percentage — following `formatPct`'s exact `pending || trialsCompleted === 0 → '—'` convention.

**Note:** `bustIfHitCount` must be tracked as its OWN tally, not derived from `hitOutcomes.lose` — a hit can lose WITHOUT busting (post-hit total below dealer's), so "bust-if-hit %" and "P(lose | hit)" are two different displayed numbers that happen to overlap for the subset of hands that actually bust.

## Trial-Loop Design

### The generous-fixed-budget, cursor-based algorithm (services ALL displayed stats from ONE trial)

```typescript
/** Deliberately generous, NOT rule-derived (unlike Hold'em's exact unknownCardsPerTrial) —
 *  see justification below. */
const BLACKJACK_TRIAL_CARD_BUDGET = 12;

export function unknownCardsPerTrial(): number {
  return BLACKJACK_TRIAL_CARD_BUDGET;
}

export function runBlackjackTrials(
  conditioned: BlackjackConditionedState,
  trialCount: number,
  drawUnknown: () => Card[],
): BlackjackTrialBatchResult {
  const totals = makeEmptyBlackjackTotals();

  for (let t = 0; t < trialCount; t++) {
    const drawn = drawUnknown(); // 12 distinct cards, fresh per trial, uniformly sampled w/o replacement
    let cursor = 0;

    // 1. Hypothetical dealer hole card — the ONLY hypothetical draw both the Stand-path and
    //    Hit-path comparisons share (common random numbers — valid because dealer play is
    //    independent of the player's hit-or-stand choice under a fixed dealer rule).
    const dealerHole = drawn[cursor++];
    const dealerCards = [conditioned.dealerUpcard, dealerHole];
    let dealerResult = handTotal(dealerCards);
    while (!dealerResult.bust && dealerResult.total < 17) {
      dealerCards.push(drawn[cursor++]);
      dealerResult = handTotal(dealerCards);
    }
    const dealerBucket = classifyDealerOutcome(dealerCards, dealerResult);
    totals.dealerOutcomeCounts[BUCKET_INDEX[dealerBucket]]++;

    // 2. STAND path: player's CURRENT (already-decided) hand vs. the shared dealer outcome.
    const playerTotal = handTotal(conditioned.playerHand); // never bust — Stand only reachable on a valid hand
    const standResult = compareToDealer(playerTotal, { ...dealerResult, bucket: dealerBucket });
    totals.standOutcomes[standResult]++;

    // 3. HIT path: a DISTINCT, not-yet-consumed card from the SAME trial's draw — never the
    //    same array position the dealer already consumed.
    const hitCard = drawn[cursor++];
    const playerAfterHit = handTotal([...conditioned.playerHand, hitCard]);
    if (playerAfterHit.bust) {
      totals.bustIfHitCount++;
      totals.hitOutcomes.lose++;
    } else {
      totals.hitOutcomes[compareToDealer(playerAfterHit, { ...dealerResult, bucket: dealerBucket })]++;
    }
  }

  totals.trialsCompleted = trialCount;
  return totals;
}
```

**Why sharing the dealer draw across Stand and Hit is valid, not a bias:** the STAND-path and HIT-path outcomes are two different counterfactual QUESTIONS asked of the SAME hypothetical trial world ("what if I stand" vs. "what if I hit"), and the dealer's play in fixed-rule blackjack does not depend on what the player chooses. Reusing one dealer outcome to answer both questions is the standard *common random numbers* variance-reduction technique — it is unbiased because each question's answer is still computed from a valid, independently-drawn dealer sample; sharing it across the two questions only reduces variance in their *difference* (which this phase doesn't even need), never introduces bias in either individual estimate.

**Why the budget is a fixed, generous constant rather than an exact count (unlike Hold'em's `unknownCardsPerTrial`):** the number of dealer hits needed is inherently random (depends on what's drawn), so no fixed formula can express it exactly. A dealer hand needing more than ~8-9 total cards to resolve is already astronomically rare — even a worst-case chain of small cards is bounded by how many copies of each low rank actually exist in a 1-2 deck shoe (e.g., only 4 copies of any given rank exist at `deckCount=1`, hard-capping how long a "keep drawing small cards" streak can plausibly run). **12** (1 dealer hole + up to 10 dealer hits + 1 disjoint player hit-card) is a deliberately generous, cheap-to-reserve margin — `createDrawer`'s partial Fisher-Yates costs `O(budget)` swaps regardless of pool size, so reserving extra unused slots is nearly free across a 200,000-trial run. **Validity is preserved because any prefix of a uniformly-random without-replacement sample is itself a valid without-replacement sample of that prefix length** — a standard, uncontroversial probability fact `[ASSUMED: general probability theory, not project-specific — HIGH confidence, non-controversial]` — so consuming a data-dependent cursor-based prefix of the fixed 12-card draw introduces no bias regardless of how many of the 12 cards actually get used in a given trial.

**Required defensive check:** `createDrawer(rng, pool, n)` will misbehave if `n > pool.length` (its internal partial Fisher-Yates loop calls `uniformInt(rng, i, working.length - 1)`, which is invalid once `i >= working.length`). Add a `validate` hook to `createBlackjackSimulationApi` (mirroring `simulationApi.ts`'s existing `validateConditionedState` pattern) asserting `remainingDeck.length >= BLACKJACK_TRIAL_CARD_BUDGET`, throwing a clear error otherwise. In practice this can only be approached in extreme edge cases (a very deep round with many real hits already taken at `deckCount=1` with cards also removed by earlier revealed information) — defensive, not expected to fire in normal play.

## Common Pitfalls

The following build directly on `.planning/research/PITFALLS.md` (already-documented, do not re-litigate) and add blackjack-build-specific detail that document doesn't cover:

### Pitfall A: Conflating the odds-conditioning set with the live shoe ledger

Already covered in depth under Architecture Patterns, Pattern 1 (the dual-exclusion-set rule) — repeated here because it is the single highest-risk NEW correctness bug this phase introduces that has no PITFALLS.md precedent (PITFALLS.md's Pitfall 5 covers "don't peek at the predetermined hole for ANY simulation purpose," but doesn't anticipate that blackjack legitimately needs TWO different exclusion sets serving two different, both-legitimate purposes).

**Warning signs:** dealer-distribution/bust-if-hit numbers that look suspiciously tight/decisive before any reveal (odds set leaking the hole card in); a live Hit or dealer playout that can, in rare testing, produce the exact same card as the later-revealed hole card at `deckCount=1` (live ledger missing the hole card).

### Pitfall B: Copying TableScene.tsx's ORIGINAL (pre-05-REVIEW) gate-release pattern instead of the fixed one

Already covered under Architecture Patterns, Pattern 3. **Warning sign:** a new `BlackjackTable.tsx` (or equivalent) whose gate-release effect has no `useRef`-based previous-value comparison, or releases unconditionally on mount.

### Pitfall C: Forgetting the Blackjack-direction restore-mount signal

Already covered under Architecture Patterns, Pattern 5. **Warning sign:** switching Hold'em → Blackjack → Hold'em → Blackjack mid-round replays the Blackjack deal-in/flip animation on the second Blackjack visit; no `blackjackRestorePending`-equivalent field exists anywhere in `gameModeStore`.

### Pitfall D: `unknownCardsPerTrial` treated as exact, or too small

Already covered under Trial-Loop Design. **Warning sign:** a `runBlackjackTrials` implementation that throws or silently corrupts output on hands needing more than a handful of dealer hits; no defensive `remainingDeck.length >= budget` check anywhere in `createBlackjackSimulationApi`'s validation.

### Pitfall E: Natural detected via "total === 21" alone, without the 2-card-initial-deal guard

Directly PITFALLS.md Pitfall 4, restated with this phase's exact guard clause: `isNatural(cards) = cards.length === 2 && total === 21`, checked ONLY at deal time (never inside the Hit/Stand decision loop, where `cards.length` is always ≥2 for the player but the natural window has already closed).

### Pitfall F: Dealer-natural priority silently dropped from the trial comparison function

New pitfall specific to this phase's chosen Option A design (no rejection sampling — see Blackjack Rules Engine Correctness Spec). If `compareToDealer` compares raw totals only (`player.total > dealer.total`) without a dedicated `dealer.bucket === 'natural'` branch, a hypothetical trial where the dealer samples a natural-shaped hole card and the player's total also happens to be 21 (via a hit or multiple hits) will be silently miscounted as a **push** instead of a **dealer win** — invisible in a smoke test, only visible as a small skew in the reported win/push/lose percentages that a reviewer would have to specifically suspect to catch.

### Pitfall G: StrictMode double-invocation of the Blackjack odds effect

Not new (Hold'em's effect already handles this correctly via ignore-flags and run-token supersession — verified clean by 05-REVIEW's "StrictMode double-invoke" adversarial probe) — but the Blackjack odds effect is NEW code that must independently re-implement the SAME ignore-flag + cache-gate + animation-gate discipline, not inherit it for free. `main.tsx` has StrictMode enabled project-wide; any new effect that starts a worker call must be re-verified against double-invocation the same way `HoldemGame`'s effect already was.

## Code Examples

### Deal action (blackjackStore, illustrative shape)

```typescript
// Source: adapted from gameStore.ts's existing deal() — single-shuffle discipline, D-01/D-02
deal: () => {
  const { deckCount } = get();
  const pool = shoeWithout(deckCount, []); // no picks in scope this phase — random deal only (see Open Questions)
  const rng = createRng();
  const [p0, p1, upcard, hole] = drawN(rng, pool, 4);
  const round: PredeterminedBlackjackRound = { dealerUpcard: upcard, dealerHole: hole };
  const playerHand: Card[] = [p0, p1];

  const playerNatural = isNatural(playerHand);
  const dealerNatural = isNatural([upcard, hole]);

  if (playerNatural || dealerNatural) {
    const outcome = playerNatural && dealerNatural ? 'push' : playerNatural ? 'win' : 'lose';
    set({ round, playerHand, roundPhase: 'resolved', outcome, revealedHole: true /* natural reveals the hole */ });
    return; // no Monte Carlo run — nothing to animate/simulate for a resolved-at-deal round
  }

  set({ round, playerHand, roundPhase: 'player-turn', outcome: null, revealedHole: false, roundNonce: get().roundNonce + 1 });
  useUiStore.getState().beginAnimation();
},
```

### Namespaced worker exposure

```typescript
// src/worker/simulation.worker.ts — Source: Comlink nested-object pattern, verified against
// node_modules/comlink/dist/esm/comlink.mjs (see Architecture Patterns, Pattern 4)
import * as Comlink from 'comlink';
import { createSimulationApi } from './simulationApi';
import { createBlackjackSimulationApi } from './blackjackSimulationApi';

Comlink.expose({
  poker: createSimulationApi(),
  blackjack: createBlackjackSimulationApi(),
});
```

## State of the Art

No "old vs. new approach" shift applies here — this is greenfield engine code within an already-modern (2026) stack. The one relevant "state of the art" note is architectural, not library-version-related:

| Old Approach (naive blackjack Monte Carlo) | This Project's Approach | Impact |
|---|---|---|
| Exact closed-form/tabulated computation (every surveyed real-world calculator) | Streaming Monte Carlo with visible convergence, same pipeline as poker | Deliberate product/pedagogy choice, not a technical limitation — see FEATURES.md Differentiators |
| Separate Hit-EV and Stand-EV simulation passes | One shared per-trial draw (common random numbers) servicing all four displayed stats | Lower variance, same trial count, no extra worker round-trips |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A dealer-only natural (player does NOT have one) resolves the round immediately as a loss, exactly like a player-only natural resolves immediately as a win — CONTEXT.md D-03's text only explicitly states the player-natural case. | Blackjack Rules Engine Correctness Spec, "Natural detection and resolution order" | If wrong (e.g., the intended design is "only a PLAYER natural triggers immediate resolution; a dealer-only natural is discovered later, at Stand-time reveal"), the entire `roundPhase='player-turn'` reachability condition changes, and the "naturals are impossible during player-turn" premise EV Computation Shape relies on would only be half-true (player-side only) — this would also reopen the "should dealer-distribution trials condition out a dealer natural" question with a different answer. Low implementation cost to confirm before coding (one sentence in discuss-phase or a plan-level checkpoint); worth confirming explicitly rather than inferring silently. |
| A2 | The Monte Carlo dealer-outcome-distribution trial does NOT condition out (via rejection sampling) the fact that the app already knows the real dealer doesn't have a natural once player-turn is reached (Option A, not Option B). | Blackjack Rules Engine Correctness Spec, "Should the trial condition out a hypothetical dealer natural?" | If the team later decides Option B is actually wanted (more rigorous, better teaching moment), the trial loop needs a rejection-sampling branch added and the BJ-07 verification anchors need re-deriving (they'd no longer match the cited literature's numbers). Low cost to flag now, higher cost to silently ship one and discover the other was wanted after BJ-07's acceptance test is already written against Option A's numbers. |
| A3 | Phase 6 does NOT include a manual card-construction picker for Blackjack (random deal only) — `.planning/research/FEATURES.md`'s milestone-level MVP list mentions a "manual picker for player hand and dealer up-card" as part of v2.0's overall feature set, but CONTEXT.md's Phase Boundary and BJ-02's requirement text for THIS phase only describe dealing a round, with no picker mentioned anywhere in Decisions or Discretion. | Open Questions | If a picker is actually expected THIS phase, the phase scope (and plan wave count) is meaningfully larger than the CONTEXT.md text implies — worth a one-line confirmation before planning, not a silent scope expansion or silent omission. |

**If this table is empty:** N/A — see above.

## Open Questions

> **Status (annotated 2026-08-24, during phase planning):** BOTH open questions below are now RESOLVED.
> They are retained verbatim for the audit trail — the resolution is recorded inline under each,
> pointing at the decision that closed it. Neither is an outstanding blocker on execution.

1. **(RESOLVED — see 06-CONTEXT.md D-03b)** **Is a Blackjack manual card-construction picker in scope for Phase 6, or deferred?**
   - **Resolution:** DEFERRED. 06-CONTEXT.md D-03b locks Phase 6 as random-deal-only: "BJ-02..BJ-07 contain no picker requirement; the milestone FEATURES.md MVP list does not override REQUIREMENTS.md IDs. A blackjack picker is a deferred idea (v2.x)." This is exactly the recommendation below, confirmed rather than overridden. Plan 06-04 accordingly forbids `blackjackStore` from importing `usePickerStore`.

   - What we know: CONTEXT.md's Phase Boundary, Decisions, and Discretion sections for Phase 6 never mention a picker; D-13's UI layout lists "Hit/Stand controls + the blackjack-local deck-count toggle," not a picker/"Set Up Scenario" equivalent. BJ-02's requirement text says only "User can deal a blackjack round," with no mention of manual construction.
   - What's unclear: `.planning/research/FEATURES.md` (milestone-level feature research, written before phase-level CONTEXT.md) lists "Blackjack: random deal + manual picker for player hand and dealer up-card" under its v2.0 "Launch With" MVP list — a broader scope than what CONTEXT.md locked for this specific phase.
   - Recommendation: Treat Phase 6 as **random-deal-only** (matching the more specific, more recently authored CONTEXT.md), and treat a Blackjack picker as an explicit candidate for a LATER phase or a fast-follow, unless the orchestrator/user confirms otherwise before planning. This keeps Phase 6's scope aligned with its own locked decisions rather than a milestone-level document that predates them.

2. **(RESOLVED — see plan 06-03's "Planner decisions taken under Claude's Discretion")** **Exact component/store file split for the worker-service layer** (one `simulationService.ts` file with two exported function pairs, vs. ARCHITECTURE.md's suggested 3-file `workerClient.ts` + two per-game services split).
   - **Resolution:** the ARCHITECTURE.md 3-file split, with the singleton constructed LAZILY. Rationale recorded in plan 06-03: seven existing suites mock `./state/simulationService` with an explicit two-export factory, so adding blackjack exports to that module would make each of them throw at import on a missing named export — a separate module leaves them untouched. The laziness is a second, independent requirement found during plan review: at wave 4 `App -> BlackjackGame -> blackjackSimulationService -> workerClient` becomes a second, unmocked import path, and a module-scope `new SimWorker()` would instantiate a real Worker at import time in jsdom.

   - What we know: both are functionally equivalent and D-08 only locks the WORKER's exposed shape (`{ poker, blackjack }`), not the main-thread wrapper's file layout.
   - What's unclear: nothing correctness-relevant — this is pure file organization.
   - Recommendation: Claude's Discretion, explicitly granted by CONTEXT.md ("snapshot shape for the blackjack runner config" and general component decomposition). Lean toward the 3-file split for symmetry with the `oddsStore`/`blackjackOddsStore` split already locked by D-10, but either is acceptable.

## Environment Availability

Skipped — this phase introduces no new external tools, services, runtimes, or CLI dependencies. Every dependency (Node/npm toolchain, all installed packages) was already verified present and in use by Phases 1-5; no new probe is needed.

## Validation Architecture

Skipped — `.planning/config.json` has `workflow.nyquist_validation: false` (explicitly disabled, not merely absent), so this section is omitted per the skip condition.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled per the default), consistent with `.planning/STATE.md`'s existing tracked blocker ("Security enforcement is enabled but no SECURITY.md exists for any phase... client-only app; low risk").

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth anywhere in this app |
| V3 Session Management | No | No sessions, no persistence |
| V4 Access Control | No | Single-user, no roles |
| V5 Input Validation | Yes (narrow) | `deckCount` shape validation (WR-02, already scoped to close THIS phase per D-09: integer, 1 or 2, reject 0/>2/non-integers) at the Blackjack worker boundary, mirroring `validateConditionedState`'s existing pattern; every other "input" (Hit/Stand clicks, deck-toggle clicks) is a closed-union UI action, not free text |
| V6 Cryptography | No | No secrets, no crypto anywhere in this app |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed internal `deckCount`/hand-shape reaching the Blackjack worker boundary (not an external attacker — a defense-in-depth concern against internal bugs, same framing as the existing `validateConditionedState`) | Tampering (internal, not adversarial) | Explicit `validate` hook in `createBlackjackSimulationApi`, mirroring `simulationApi.ts`'s existing pattern — throws loudly rather than silently producing wrong probabilities |

No new attack surface: purely client-side, offline, no auth, no persistence, no network calls (identical conclusion to PITFALLS.md's own Security Mistakes section, reconfirmed for this phase's specific new code).

## Sources

### Primary (HIGH confidence)

- Direct reading of this repository's shipped source (this session): `src/worker/streamingRunner.ts`, `src/worker/simulationApi.ts`, `src/worker/protocol.ts`, `src/worker/simulation.worker.ts`, `src/engine/shoe.ts`, `src/engine/equity.ts`, `src/engine/conditioning.ts`, `src/engine/cards.ts`, `src/engine/rng.ts`, `src/engine/evaluator.ts`, `src/engine/streets.ts`, `src/state/simulationService.ts`, `src/state/gameModeStore.ts`, `src/state/gameStore.ts`, `src/state/oddsStore.ts`, `src/state/uiStore.ts`, `src/App.tsx`, `src/ui/BlackjackScene.tsx`, `src/ui/TableScene.tsx`, `src/ui/FlipCard.tsx`, `src/ui/AnimatedCard.tsx`, `src/ui/useAnimationGate.ts`, `src/ui/OddsPanel.tsx`, `src/ui/WinTieLossDisplay.tsx`, `src/ui/formatPct.ts`
- `node_modules/comlink/dist/esm/comlink.mjs` — direct inspection of `createProxy`'s `get` trap confirming nested-path proxy resolution (HIGH confidence, primary verification for the namespaced worker pattern)
- `node_modules/@poker-apprentice/types/dist/types/{types,getRank,constants}.d.ts` — confirmed `Rank`/`Suit`/`Card` shapes and the exported `getRank` function (previously unused by this codebase but directly importable)
- `.planning/phases/05-game-mode-shell-store-separation/05-REVIEW.md` — CR-01/CR-02/WR-01/WR-02/WR-03 findings and their fix commits, the direct basis for this document's Pattern 3/Pattern 5 recommendations
- `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md` (milestone-level research, already vetted) — file-layout recommendations, anti-exact-enumeration stance, Pitfalls 1-14 (not repeated here except where this phase adds blackjack-build-specific detail)
- `.planning/phases/06-blackjack-core-odds-loop/06-CONTEXT.md` — locked decisions D-01 through D-14
- `.planning/config.json` — `nyquist_validation: false`, `security_enforcement` absent (treated enabled)

### Secondary (MEDIUM confidence)

- [Blackjack Dealer Outcome Probabilities — blackjackinfo.com](https://www.blackjackinfo.com/dealer-outcome-probabilities/) — 6-deck S17 dealer final-outcome-by-upcard table
- [How Likely Will Your Dealer Bust in Blackjack? — liveabout.com](https://www.liveabout.com/blackjack-dealer-bust-percentages-537109) and [casino.org's dealer-upcard guide](https://www.casino.org/blog/dealers-upcard-blackjack/) — corroborating bust-by-upcard figures
- [Using Probability Theory to Calculate the Bust Odds — Medium](https://medium.com/@andrewruggero16/using-probability-theory-to-calculate-the-bust-odds-for-every-dealer-hand-in-blackjack-d19749b45cb8) — overall ~28% dealer bust rate
- [forums.saliu.com Blackjack Probability, Odds: Natural 21](https://forums.saliu.com/blackjack-natural-odds-probability.html) — independently corroborates the exact 64/1326 (1-deck) and 256/5356 (2-deck) natural-frequency derivation this research re-derived from scratch
- [theprobabilitylab.com](https://theprobabilitylab.com/blackjack), [gamblingcalc.com blackjack EV guide](https://gamblingcalc.com/gambling-guides/blackjack-expected-value/) — confirms real-world "Hit EV" calculators use optimal-continuation play, structurally different from this project's locked "hit once then stand" EV(Hit)
- WebSearch results on Comlink nested-object/namespaced-API patterns — corroborating (not primary) confirmation of the `{ poker, blackjack }` exposure pattern already verified directly against the installed package source

### Tertiary (LOW confidence)

- None — every claim above is either a direct reading of shipped/installed source, an independently-reproduced combinatorial derivation, or a MEDIUM-confidence citation corroborated by 2+ sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every reused primitive directly verified in the shipped codebase
- Architecture: HIGH — dual-exclusion-set rule, gate-release pattern, and namespaced Comlink surface are all either direct extensions of already-fixed/verified codebase patterns or independently verified against installed library source
- Blackjack rules engine: HIGH for hand-value/dealer-playout/win-push-lose algorithms (standard, unambiguous rules, directly implementable and testable); MEDIUM-LOW for the two explicitly-flagged design forks (Assumptions A1/A2) where CONTEXT.md's text is genuinely ambiguous
- Probability anchors: HIGH for natural frequency (independently re-derived, exact match to citation); MEDIUM for dealer-bust/outcome-by-upcard (corroborated but sourced from 6-deck/infinite-deck tables, not this project's 1-2-deck shoe)
- Pitfalls: HIGH — built directly on PITFALLS.md's already-HIGH-confidence, source-verified milestone research, with blackjack-build-specific additions grounded in the same direct-source-reading discipline

**Research date:** 2026-08-24
**Valid until:** No expiry driver identified (no library versions pinned that could drift, no external API surface) — treat as valid for the lifetime of this phase's planning and execution; re-research only if CONTEXT.md's locked decisions change.
