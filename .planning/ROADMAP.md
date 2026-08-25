# Roadmap: Monte Carlo Poker Simulator

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-08-24) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 Blackjack & Multi-Deck** — Phases 4-8 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-08-24</summary>

- [x] Phase 1: Core Odds Loop (4/4 plans) — completed 2026-08-24
- [x] Phase 2: Scenario Construction & Street Navigation (6/6 plans) — completed 2026-08-24
- [x] Phase 3: Casino Table UI & Animation (6/6 plans) — completed 2026-08-24

Full phase details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
Requirements outcomes: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

### 🚧 v2.0 Blackjack & Multi-Deck (In Progress)

**Milestone Goal:** Add Blackjack as a second game and make deck count (1 or 2 decks) a first-class, explorable probability variable across both games.

- [x] **Phase 4: Multiset Deck & Streaming Foundation** - Physical-card-identity deck model (1 or 2 decks, no dedup collapse) and a generalized streaming worker runner, proven behavior-identical to v1.0 at deckCount=1 (completed 2026-08-24)
- [x] **Phase 5: Game-Mode Shell & Store Separation** - Users can switch between Hold'em and Blackjack, each with fully independent state and odds (completed 2026-08-24)
- [x] **Phase 6: Blackjack Core Odds Loop** - Full Blackjack vertical slice: deal, bust/dealer-outcome odds, Stand/Hit EV, hit/stand play, dealer reveal, deck toggle (completed 2026-08-24)
- [x] **Phase 7: 2-Deck Hold'em Evaluation Layer** - Hold'em over a 104-card shoe with correct duplicate-card evaluation and a Five of a Kind category (completed 2026-08-25)
- [ ] **Phase 8: Cross-Game Deck-Count Toggle UI** - One shared deck-count control spanning both games

## Phase Details

### Phase 4: Multiset Deck & Streaming Foundation

**Goal**: The deck/shoe model correctly represents 1 or 2 physical decks — two copies of the same card are distinct, trackable objects that never collapse via value-based dedup — and the simulation streaming pipeline is generalized to serve any game, with zero behavioral drift from v1.0 at deckCount=1.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: DECK-01, DECK-03, DECK-04
**Success Criteria** (what must be TRUE):

  1. Regression tests prove that at `deckCount=1`, shoe/draw/conditioning/picker behavior is byte-identical to shipped v1.0 — no silent behavior drift from the refactor.
  2. Property tests confirm 2-deck multiset invariants: two physical copies of the same card coexist as distinct trackable objects, are drawn without replacement from the correct `52 × deckCount`-card shoe, and never collapse via value-based `Set`/`Map` dedup anywhere in the shoe path.
  3. The card picker's duplicate-blocking is verified count-aware: a card is blocked after 1 pick at 1 deck, and only after 2 picks at 2 decks, with remaining-copy state exposed for the UI to consume.
  4. The generalized streaming runner passes the full existing Hold'em `simulationApi` test suite unchanged, proving the worker-protocol refactor is behavior-preserving before any new game rides on it.

**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Golden parity baseline: pin seeded v1 remainingDeck ordering and streaming tallies BEFORE any refactor (D-08)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — src/engine/shoe.ts: count-aware buildShoe/shoeWithout multiset primitive with v1-parity and closure properties

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Thread deckCount through ConditionedState/deriveConditionedState; additive DECK-03 without-replacement property tests
- [x] 04-04-PLAN.md — Count-aware pickerStore blocking plus the remainingCopies selector, picker UI unchanged at 1 deck

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-05-PLAN.md — Extract the generic streamingRunner; simulationApi becomes a Hold'em config with deck-count-aware validation (D-06/D-07)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-06-PLAN.md — DECK-01 shoe-path source guard, simultaneous gate sweep, human regression checkpoint

### Phase 5: Game-Mode Shell & Store Separation

**Goal**: Users can switch between Hold'em and Blackjack via a mode switcher, with each game maintaining fully independent state and odds so neither leaks into or corrupts the other.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: BJ-01
**Success Criteria** (what must be TRUE):

  1. User can switch between Hold'em and Blackjack via a mode switcher component on screen.
  2. Hold'em's full existing interaction loop (deal, street nav, rewind, reveal, picker) works identically after the refactor, verified by the full existing acceptance suite passing unchanged.
  3. Switching to Blackjack shows an independent game screen/state that shares no store fields or odds-cache keys with Hold'em, verified by a store-isolation test.
  4. Switching modes mid-simulation cleanly cancels any in-flight worker run for the game being left, so no stale odds bleed across modes.

**Plans:** 3/3 plans complete
**UI hint**: yes

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Mode-switch vertical slice: gameModeStore, GameModeSwitcher, BlackjackScene placeholder, App mode fork (D-01/D-02/D-03/D-04/D-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Three-angle isolation proof: store snapshots and cache non-write, DOM-absence sweep, switch-mid-deal gate/cancel race (D-04/D-06/D-07/D-08)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-03-PLAN.md — Mode-shell source-shape guard, full 281-test regression sweep, browser acceptance checkpoint (D-09/D-10)

### Phase 6: Blackjack Core Odds Loop

**Goal**: Users can play a full Blackjack round on its own table screen — deal, watch live bust/dealer-outcome/EV odds converge, hit or stand, reveal the dealer's hole card, and see deck count change the odds — mirroring Hold'em's live-convergence experience.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: BJ-02, BJ-03, BJ-04, BJ-05, BJ-06, BJ-07
**Success Criteria** (what must be TRUE):

  1. User can deal a Blackjack round (player hand + dealer upcard face-up, hole card face-down) and watch live win/push/lose, bust-if-hit, and dealer-outcome-distribution odds converge over streamed worker trials with a visible trial counter.
  2. User sees per-unit EV for Stand vs. Hit at the current decision point, computed under fixed conventions (dealer stands on soft 17, natural pays 3:2).
  3. User can Hit or Stand; hitting updates the hand and recomputes odds live, and standing plays the dealer out per the fixed rules and shows the round outcome.
  4. User can reveal the dealer's hole card early and watch all odds recondition on the newly known card.
  5. Toggling deck count (1 vs. 2) for Blackjack visibly changes the odds (e.g., natural-blackjack frequency ~4.83% → ~4.78%), verifiable in-app.

**Plans:** 8/8 plans complete
**UI hint**: yes

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Blackjack rules engine, cursor-based trial loop and the D-12 natural-frequency anchor
- [x] 06-02-PLAN.md — D-07 HoldemGame extraction, mode-shell guard retarget, testid consolidation

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-03-PLAN.md — Namespaced { poker, blackjack } worker surface, WR-02 deckCount validation, shared transport
- [x] 06-04-PLAN.md — Blackjack round and odds stores, symmetric restore-mount signal

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-05-PLAN.md — Blackjack felt: composition root, dealer/player areas, outcome banner, all Phase 6 CSS
- [x] 06-06-PLAN.md — Blackjack odds cluster: bust/trials, stand outcomes, EV tiles, 7-bucket dealer table

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06-07-PLAN.md — Controls, BlackjackGame odds effect, App fork, placeholder retirement, BJ-02..07 loop suite

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 06-08-PLAN.md — Full regression sweep, multi-source coverage audit, browser acceptance checkpoint

### Phase 7: 2-Deck Hold'em Evaluation Layer

**Goal**: Users can play Hold'em over a 104-card (2-deck) shoe with correct, crash-free evaluation of duplicate-card hands, a new Five of a Kind category, and legible duplicate cards on the felt.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: HE2-01, HE2-02, HE2-03
**Success Criteria** (what must be TRUE):

  1. User can enable 2-deck Hold'em; dealing, the card picker, street navigation, and opponent reveal all work correctly over the 104-card shoe.
  2. Hands containing duplicate cards evaluate correctly and never crash — a duplicate-detection gate routes any duplicate-containing hand away from the stock evaluator before it's called.
  3. Five of a Kind appears as its own row in the odds table in 2-deck mode, ranked above Royal Flush, with a correct probability.
  4. Two copies of the same card are visually distinguishable on the felt via a visible copy-cue UI badge, so a duplicate never reads as a rendering glitch.

**Plans:** 7/7 plans complete
**UI hint**: yes

Plans:
**Wave 1**

- [x] 07-01-PLAN.md — Duplicate-aware evaluation module: stamped gate, five-of-a-kind branch, suit-remap proxy, flush-zone scorer, extended comparator, brute-force oracle and both seeded frequency anchors
- [x] 07-02-PLAN.md — Hold'em deckCount in gameStore with D-02 toggle lifecycle, count-aware deal pool, and the CardPicker deckCount wire closing WR-01

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-03-PLAN.md — Category-index spine: hoisted evaluator selection in runTrials, grow-on-merge snapshots, length-tolerant odds guard, D-12 WR-03 retirement, WR-04 guard extension
- [x] 07-04-PLAN.md — Copy cue: canonical-scan second-copy derivation, the x2 badge on PlayingCard, and the three felt render paths with A11 accessibility

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-05-PLAN.md — Hold'em deck toggle with the same-commit modeShell guard retarget, every Phase 7 style, and the D-03 cache guard suite
- [x] 07-06-PLAN.md — Five of a Kind row at the strength end, derived 11-row label source, and deck-count-aware lockedInCategory routing

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 07-07-PLAN.md — Full regression sweep, blocker-ledger reconciliation, multi-source coverage audit and browser acceptance checkpoint

### Phase 8: Cross-Game Deck-Count Toggle UI

**Goal**: Users control deck count for either game through one consistent, shared control component that immediately cancels and recomputes odds under the new shoe.
**Mode:** mvp
**Depends on**: Phase 6, Phase 7
**Requirements**: DECK-02
**Success Criteria** (what must be TRUE):

  1. A single shared deck-count control component appears in both Hold'em's and Blackjack's control bar, always reflecting the active game's current deck count.
  2. Changing deck count in either game immediately cancels any in-flight simulation and recomputes all odds under the new shoe size, with no stale numbers left on screen.
  3. The control follows the same "takes effect on next deal" discipline already established for the card picker — no disruptive mid-hand mutation.

**Plans:** 1/3 plans executed
**UI hint**: yes

Plans:
**Wave 1**

- [x] 08-01-PLAN.md — Extract the shared DeckCountToggle onto both games behind a nine-state pre-extraction outerHTML golden, with the mode-shell guard amended additively in the same commit

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 08-02-PLAN.md — Component-level contract suite plus the cross-game consolidation suite, one describe block per success criterion

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 08-03-PLAN.md — Regression sweep, golden commit-ordering proof, multi-source coverage audit and production-build browser acceptance checkpoint

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Odds Loop | v1.0 | 4/4 | Complete | 2026-08-24 |
| 2. Scenario Construction & Street Navigation | v1.0 | 6/6 | Complete | 2026-08-24 |
| 3. Casino Table UI & Animation | v1.0 | 6/6 | Complete | 2026-08-24 |
| 4. Multiset Deck & Streaming Foundation | v2.0 | 6/6 | Complete   | 2026-08-24 |
| 5. Game-Mode Shell & Store Separation | v2.0 | 3/3 | Complete   | 2026-08-24 |
| 6. Blackjack Core Odds Loop | v2.0 | 8/8 | Complete    | 2026-08-25 |
| 7. 2-Deck Hold'em Evaluation Layer | v2.0 | 7/7 | Complete    | 2026-08-25 |
| 8. Cross-Game Deck-Count Toggle UI | v2.0 | 1/3 | In Progress|  |
