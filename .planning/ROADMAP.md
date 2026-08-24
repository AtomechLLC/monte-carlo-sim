# Roadmap: Monte Carlo Poker Simulator

## Overview

This roadmap delivers the Monte Carlo Poker Simulator as three widening vertical slices. Phase 1 proves the hard part first: a correct, streaming Monte Carlo engine (hand evaluator, deck conditioning, off-main-thread trials) wired to a bare-bones deal button and odds table, so every number on screen is trustworthy before any art exists. Phase 2 widens the interaction loop the tool is built around — manual scenario construction, street-by-street advance/rewind, and opponent reveal — still on the minimal UI, so the state model (history, known/unknown opponents) is proven correct before it becomes expensive to change. Phase 3 wraps the proven engine and interaction loop in the full casino-table experience: felt table, seated opponents, detailed animated cards — the visual craft that makes probability feel alive, layered onto a foundation that's already numerically correct.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Odds Loop** - Deal, compute (streaming Monte Carlo), and display live odds in a minimal UI (completed 2026-08-24)
- [ ] **Phase 2: Scenario Construction & Street Navigation** - Manual card picker, street advance/rewind, and opponent reveal
- [ ] **Phase 3: Casino Table UI & Animation** - Full felt-table scene, detailed card art, and dealing/flip/reveal animations

## Phase Details

### Phase 1: Core Odds Loop

**Goal**: Users can deal a random Hold'em hand and watch accurate win/tie/lose and hand-category odds converge live, computed off the main thread, in a minimal (unstyled) UI.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ODDS-01, ODDS-02, ODDS-03, DEAL-01
**Success Criteria** (what must be TRUE):

  1. User can click "Deal" to get a random hand (their own two hole cards plus 3 opponents' hidden hole cards) with one click, and re-deal at any time for a fresh hand.
  2. User can see live win/tie/lose probability against the 3 opponents, computed by Monte Carlo simulation, that updates as trials accumulate.
  3. User can see a full hand-category probability table (high card through royal flush) that sums to ~100% and updates live.
  4. User can watch a visible trial counter climb and percentages visibly settle/converge in real time, with the page staying fully responsive (no freeze) throughout.

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold the Vite/React/TS project and deliver one-click random dealing (DEAL-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Stream Monte Carlo trials from a Web Worker to a live trial counter (ENG-03, ODDS-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Replace the stub with real hand evaluation and add the 10-row category table (ENG-01, ENG-02, ODDS-01, ODDS-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Validate accuracy against benchmark odds and invariants, then phase acceptance (ENG-04)

### Phase 2: Scenario Construction & Street Navigation

**Goal**: Users can construct their own "what-if" scenarios and navigate a hand street by street — advancing, rewinding, and revealing opponents — with odds correctly recalculating at every step, still on the minimal UI proven in Phase 1.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DEAL-02, DEAL-03, NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):

  1. User can manually pick their own hole cards and the board cards via a card picker to construct a scenario, with already-used cards blocked so duplicates are impossible across hands, board, and deck.
  2. User can advance street by street (pre-flop → flop → turn → river), with all odds recomputing at each step.
  3. User can rewind to an earlier street and see odds return to their earlier-street values; re-advancing shows the same cards unless a separate re-deal action is taken.
  4. User can reveal any opponent's hole cards mid-hand and see all odds recalculate to account for the newly known cards.

**Plans:** 4/6 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Generalize the conditioning engine and worker contract to a variable knowledge partition (NAV-01, NAV-03, DEAL-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Predetermined runout, street advance/rewind, board display, and effect rewiring (NAV-01, NAV-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Knowledge-keyed settled-odds cache and one-way opponent reveal (NAV-02, NAV-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Seven-slot card picker with visible duplicate blocking and merge-on-deal (DEAL-02, DEAL-03)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 02-05-PLAN.md — Empty state, UI-contract conformance pass, and the end-to-end acceptance suite (all)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 02-06-PLAN.md — Phase acceptance: human walkthrough of the full construction and navigation loop (all)

### Phase 3: Casino Table UI & Animation

**Goal**: Users interact with a full casino-table interface — felt table layout, seated opponents, and detailed animated card components — so the odds feel embedded in a real poker scene rather than a bare calculator, without ever contradicting cards still mid-animation.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: TBL-01, TBL-02, TBL-03, TBL-04
**Success Criteria** (what must be TRUE):

  1. User sees a full casino-table scene: felt table, their own seat, 3 anonymous opponent seats, and a community card area.
  2. User sees detailed playing cards with proper pips and court-card art in place of the plain/placeholder cards used in Phases 1-2.
  3. User sees cards animate when dealt, flipped, and revealed (opponent reveal).
  4. User never sees odds numbers contradict or spoil cards that are still mid-animation — odds update only once the corresponding animation has completed.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Odds Loop | 4/4 | Complete   | 2026-08-24 |
| 2. Scenario Construction & Street Navigation | 4/6 | In Progress|  |
| 3. Casino Table UI & Animation | 0/TBD | Not started | - |
