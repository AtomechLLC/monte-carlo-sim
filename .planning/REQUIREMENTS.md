# Requirements — Milestone v2.0 Blackjack & Multi-Deck

Defined 2026-08-24 from the confirmed milestone scope (Blackjack + 1/2-deck shoe, 2-deck Hold'em variant, cross-game deck-count toggle; EDU layer excluded) and `.planning/research/` findings. REQ-ID numbering continues v1 conventions with new categories.

## v2 Requirements

### Multi-Deck Foundation (DECK)

- [ ] **DECK-01**: The deck/shoe model supports 1 or 2 physical decks with physical-card identity — two copies of the same card are distinct objects that never collapse in deck math, drawing, or conditioning (no value-based `Set` dedup anywhere in the shoe path)
- [ ] **DECK-02**: User can toggle deck count (1 or 2) per game; changing it cancels any in-flight simulation and recomputes all odds under the new shoe
- [ ] **DECK-03**: All trial sampling draws WITHOUT replacement from the finite shoe (deckCount×52 − known cards), so deck count measurably changes the odds — with-replacement shortcuts are prohibited
- [ ] **DECK-04**: The card picker's duplicate blocking is count-aware — with 2 decks a card can be picked twice, is visibly blocked only when all copies are used, and shows remaining-copy state

### Blackjack (BJ)

- [ ] **BJ-01**: User can switch between Hold'em and Blackjack; each game keeps its own state and odds (no mode leakage, no shared odds-cache keys)
- [ ] **BJ-02**: User can deal a blackjack round — player hand face-up, dealer upcard face-up, dealer hole card face-down — with live Monte Carlo odds streaming off the main thread with the visible trial counter (same convergence experience as Hold'em)
- [ ] **BJ-03**: User sees the player bust-if-hit probability and the dealer final-outcome distribution (17, 18, 19, 20, 21, natural, bust) conditioned on the visible upcard
- [ ] **BJ-04**: User sees win/push/lose probabilities and per-unit EV for Stand vs Hit at the current decision point (EV per unit wagered, no bankroll/chips — fixed conventions: dealer stands on soft 17, natural pays 3:2)
- [ ] **BJ-05**: User can Hit or Stand; after each action the hand state updates and all odds recompute; standing plays out the dealer per the fixed rules and shows the round outcome
- [ ] **BJ-06**: User can reveal the dealer's hole card early (same one-way reveal mechanic as Hold'em) and watch all odds recondition on the newly known card
- [ ] **BJ-07**: Deck count visibly changes blackjack odds (e.g., natural frequency ≈4.83% at 1 deck vs ≈4.78% at 2 decks) — verifiable in-app by toggling

### 2-Deck Hold'em (HE2)

- [ ] **HE2-01**: User can enable a 2-deck Hold'em variant; dealing, the picker, street navigation, and opponent reveal all work over the 104-card shoe
- [ ] **HE2-02**: Hands containing duplicate cards evaluate correctly via a duplicate-aware evaluation layer — any duplicate co-occurrence is detected BEFORE delegating to the stock evaluator (which crashes on duplicates), and Five of a Kind ranks above Royal Flush with its own category-table row in 2-deck mode
- [ ] **HE2-03**: Two copies of the same card are visually legible on the felt (a copy cue), so a duplicate never reads as a rendering bug

## Future Requirements (deferred, not in v2.0)

- Blackjack Double / Split / Surrender actions with EV (v2.x fast-follow; Split needs design)
- Deck counts beyond 2 (4/6/8-deck shoes)
- Deck-count delta callout UI (side-by-side 1-vs-2-deck comparison display)
- EDU-01/02/03 education layer (queued for v3)

## Out of Scope (v2.0)

- Betting, chips, bankroll — unchanged project constraint; EV is per-decision units only
- Basic-strategy charts, card-counting trainers, side bets — prescriptive-trainer territory, conflicts with the exploration ethos (research anti-features)
- Blackjack rule-variant settings (H17, DAS, peek/no-peek, etc.) — one standard convention hard-coded (S17, 3:2)
- Poker variants beyond Hold'em (Omaha, Stud) — unchanged

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DECK-01 | TBD | Pending |
| DECK-02 | TBD | Pending |
| DECK-03 | TBD | Pending |
| DECK-04 | TBD | Pending |
| BJ-01 | TBD | Pending |
| BJ-02 | TBD | Pending |
| BJ-03 | TBD | Pending |
| BJ-04 | TBD | Pending |
| BJ-05 | TBD | Pending |
| BJ-06 | TBD | Pending |
| BJ-07 | TBD | Pending |
| HE2-01 | TBD | Pending |
| HE2-02 | TBD | Pending |
| HE2-03 | TBD | Pending |
