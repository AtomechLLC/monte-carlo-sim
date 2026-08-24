# Requirements: Monte Carlo Poker Simulator

**Defined:** 2026-08-23
**Core Value:** Probability made visible — the user can watch odds converge in real time and see exactly how each new piece of information reshapes the numbers.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Simulation Engine

- [ ] **ENG-01**: Hand evaluator correctly ranks best-5-of-7 cards, including kickers, ties/split pots, and the A-2-3-4-5 wheel straight
- [ ] **ENG-02**: Monte Carlo simulation conditions on all known cards (user's hole cards, dealt board, revealed opponents) — hidden opponents are sampled uniformly from the remaining unseen deck, and no card can appear twice in a trial
- [ ] **ENG-03**: Simulation runs off the main thread and streams incremental results — the UI never freezes during computation
- [ ] **ENG-04**: Displayed probabilities are verifiably accurate — validated against published benchmark odds, with internal consistency checks (hand categories sum to 100%, win/tie/lose sums to 100%)

### Odds Display

- [ ] **ODDS-01**: User can see live win/tie/lose probability for their hand against the 3 opponents
- [ ] **ODDS-02**: User can see a full hand-category probability table — their chance of ending with each rank (high card → royal flush) by the river
- [ ] **ODDS-03**: User can watch percentages visibly settle in real time as simulation trials accumulate, with a visible trial counter

### Cards & Dealing

- [ ] **DEAL-01**: User can deal a random hand (own hole cards + 3 opponents) with one click, and re-deal at any time
- [ ] **DEAL-02**: User can manually pick their own hole cards and board cards from a card picker for "what-if" scenario construction
- [ ] **DEAL-03**: Duplicate card selection is impossible — every card exists exactly once across hands, board, and deck

### Street Navigation

- [ ] **NAV-01**: User can advance street by street (pre-flop → flop → turn → river) and all odds recompute at each street
- [ ] **NAV-02**: User can rewind to earlier streets — odds return to their earlier-street values, and re-advancing shows the same cards (a separate re-deal action reshuffles)
- [ ] **NAV-03**: User can reveal any opponent's hole cards mid-hand — revealed cards become known information and all odds recalculate to account for them

### Table Presentation

- [ ] **TBL-01**: Full casino-table scene: felt table, user's seat, 3 anonymous opponent seats, community card area
- [ ] **TBL-02**: Detailed playing card faces with proper pips and court cards
- [ ] **TBL-03**: Cards animate — dealing, flipping, and opponent reveal
- [ ] **TBL-04**: Odds displays coordinate with animations — numbers never contradict or spoil cards still being dealt/flipped

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Educational Layer

- **EDU-01**: Outs/draw callouts — numeric outs with highlighting of cards that improve the hand
- **EDU-02**: Educational annotations — plain-language explanations of what changed and why odds moved
- **EDU-03**: Shareable scenario permalinks — encode a constructed "what-if" scenario in a URL

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Betting, chips, pot management | Odds explorer, not a playable poker game — betting complexity doesn't serve the learning goal |
| Opponent hand-range modeling (13×13 grids, weighted combos) | Conflicts with the binary hidden/revealed opponent model; power-user feature foreign to the audience |
| User-exposed trial-count / precision tuning | Undermines "just watch it happen" simplicity — auto-run to a sensible trial count; the convergence display is the feature |
| GTO/strategy recommendations | Descriptive odds only — probabilities, not prescriptions; this is an explorer, not a trainer |
| Variable opponent count | Fixed 3 opponents preserves the art-directed table layout; variable seating is a future milestone at most |
| Multiplayer / shared sessions | Single-user learning tool; contradicts client-only architecture |
| Hand history / session stats | Requires persistence; ephemeral session state only |
| Poker variants beyond Texas Hold'em | Flop/turn/river structure is the target; revisit only if the Hold'em tool proves valuable |
| Server backend | Client-side only — zero install, easy sharing |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 1: Core Odds Loop | Pending |
| ENG-02 | Phase 1: Core Odds Loop | Pending |
| ENG-03 | Phase 1: Core Odds Loop | Pending |
| ENG-04 | Phase 1: Core Odds Loop | Pending |
| ODDS-01 | Phase 1: Core Odds Loop | Pending |
| ODDS-02 | Phase 1: Core Odds Loop | Pending |
| ODDS-03 | Phase 1: Core Odds Loop | Pending |
| DEAL-01 | Phase 1: Core Odds Loop | Pending |
| DEAL-02 | Phase 2: Scenario Construction & Street Navigation | Pending |
| DEAL-03 | Phase 2: Scenario Construction & Street Navigation | Pending |
| NAV-01 | Phase 2: Scenario Construction & Street Navigation | Pending |
| NAV-02 | Phase 2: Scenario Construction & Street Navigation | Pending |
| NAV-03 | Phase 2: Scenario Construction & Street Navigation | Pending |
| TBL-01 | Phase 3: Casino Table UI & Animation | Pending |
| TBL-02 | Phase 3: Casino Table UI & Animation | Pending |
| TBL-03 | Phase 3: Casino Table UI & Animation | Pending |
| TBL-04 | Phase 3: Casino Table UI & Animation | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-23*
*Last updated: 2026-08-23 after roadmap creation*
