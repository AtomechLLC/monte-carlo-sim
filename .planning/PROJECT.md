# Monte Carlo Poker Simulator

## What This Is

A graphical Monte Carlo simulator for Texas Hold'em, running in the browser as a full casino-style poker table. The user sits at a felt table with detailed, animated playing cards and three anonymous opponents, and watches live-computed odds — the probability of making each hand category and the probability of winning — evolve as the hand advances through pre-flop, flop, turn, and river. It's a game design learning tool: a way to make probability and randomness visible, explorable, and intuitive.

## Core Value

Probability made visible — the user can watch odds converge in real time and see exactly how each new piece of information (a dealt street, a revealed opponent) reshapes the numbers.

## Requirements

### Validated

Validated in Phase 1: core-odds-loop (2026-08-24):

- [x] Win/tie/lose probability vs the 3 anonymous opponents, computed by Monte Carlo simulation
- [x] Full hand-category odds table: live probability of ending with each hand rank (high card → royal flush) by the river (unstyled table; visual polish is Phase 3)
- [x] Live convergence: percentages visibly settle in real time as simulation trials accumulate (200,000 trials streamed off the main thread)
- [x] Random dealing with a re-deal button (default mode)

### Active

- [ ] Full poker table scene in the browser: felt table, user's seat, three anonymous opponent seats, community card area
- [ ] Detailed playing card visuals (proper pips and court cards) with dealing, flipping, and reveal animations
- [ ] Advance street by street (pre-flop → flop → turn → river) and watch odds change
- [ ] Rewind to earlier streets to re-examine — odds update in both directions
- [ ] Manual card picker: set specific hole cards and board cards for "what if" scenario exploration
- [ ] Reveal any opponent's hole cards — revealed cards become known information and all odds recalculate to account for them

### Out of Scope

- Betting, chips, pot management — this is an odds explorer, not a playable poker game; betting adds complexity without serving the learning goal
- Multiplayer / networked play — single-user learning tool
- Poker variants beyond Texas Hold'em (Omaha, Stud, etc.) — flop/turn/river structure is the target; variants can come later if the tool proves valuable
- AI opponent behavior/strategy — opponents are card holders for equity calculation, not decision-making agents
- Server backend — simulation runs client-side in the browser; no install, easy to share

## Context

- Part of the user's GameDesignSkills projects — the driving goal is understanding probability and randomness as a game design skill, using Monte Carlo methods as the lens.
- Greenfield project, empty directory, no existing code.
- The simulator is exploratory/educational, not a poker training aid: seeing the Monte Carlo method at work (convergence, trial counts) is part of the point, not an implementation detail to hide.
- Key interaction loop: deal (or construct) a scenario → read the odds → advance/rewind streets or reveal opponents → watch the odds respond.
- "Anonymous players" means opponents whose hole cards are dealt but hidden; the reveal mechanic converts unknown information into known information, and the math must respect that (conditioning the simulation on revealed cards).

## Constraints

- **Platform**: Browser-based web app — zero install, easy to share, and canvas/SVG rendering suits detailed card visuals
- **Architecture**: Client-side simulation — Monte Carlo trials must run fast enough in the browser to feel live (likely Web Worker territory to keep the UI responsive)
- **Fidelity**: Full table feel — felt table, seated opponents, animated cards; visual craft is part of the deliverable, not a skin

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Texas Hold'em only | Flop/turn/river structure is the explicit target; keeps hand evaluation tractable | — Pending |
| Odds recalculate on reveal | Revealed cards are known information; conditioning the simulation on them is the educational payoff | — Pending |
| Live convergence display | Watching percentages settle teaches the Monte Carlo method itself — core to the learning goal | — Pending |
| Both random deal and manual picker | Random for playing out hands, manual for constructing "what if" scenarios | — Pending |
| Forward + rewind street navigation | Re-examining earlier streets shows how information changed the odds | — Pending |
| No betting mechanics | Odds explorer, not a poker game — betting doesn't serve the probability-learning goal | — Pending |
| Client-side only, no backend | Simplicity, shareability; browser is fast enough for Monte Carlo poker equity | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-24 — Phase 1 (core-odds-loop) complete: walking skeleton with live Monte Carlo odds*
