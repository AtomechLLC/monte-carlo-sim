# Feature Research

**Domain:** Poker odds/equity simulators and calculators (Texas Hold'em), applied to a browser-based educational full-table visualizer
**Researched:** 2026-08-23
**Confidence:** MEDIUM-HIGH

## Feature Landscape

The poker odds/equity tool category splits into two lineages that this project deliberately fuses:

1. **Utilitarian equity calculators** (Equilab, PokerStove, CardPlayer/PokerNews/Omni Calculator/CalcBE web calculators, PokerCruncher, Flopzilla) — form-based UIs (dropdowns or flat card grids) built for players and coaches to crunch numbers. Fast, dense, unstyled. No table, no seats, no animation. These define the *analytical* table stakes: card selection, equity math, hand-category breakdowns, street handling.
2. **Broadcast-style odds overlays** (WSOP/televised poker graphics) — visual, at-a-glance win% per player shown on top of a real table as the hand progresses, updating at each street and on all-ins. These define the *presentational* target this project is aiming for, but broadcast graphics are one-way (viewer can't interact, pick cards, or rewind).

No product found combines both: a fully interactive, felt-table, animated-card presentation with live Monte-Carlo-driven odds a user can rewind, replay, and reveal into. That gap is this project's core differentiation opportunity — the analytics are commodity, the *experience* of watching probability resolve at a real table is not.

### Table Stakes (Users Expect These)

Features that exist in essentially every equity calculator on the market. Missing these makes the tool feel broken or amateurish to anyone who has used PokerStove, Equilab, or even a free web calculator.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Card picker for hole/board cards | Every calculator surveyed (Equilab, PokerStove, PokerNews, CardPlayer, Omni Calculator, PokerScout) uses a click-to-select card grid; it's the universal input pattern | LOW-MEDIUM | Must prevent duplicate-card selection across hand/board/opponents; needs 4-color or suit-clear deck rendering |
| Win/tie/lose equity vs opponents | The single output every tool leads with; PokerStove, Equilab, PokerNews, Omni Calculator, Wizard of Odds, 888poker all show this as the headline number | LOW (display) / HIGH (engine) | Display is trivial once the Monte Carlo engine exists; the engine itself is the real cost |
| Accurate 7-card hand evaluator | Underpins every other number in the app; every competitor has a correct, fast evaluator as its foundation | HIGH | Must correctly rank best-5-of-7, handle ties/splits; needs to run millions of times per second inside a Monte Carlo loop |
| Hand-category probability distribution | Equilab (hand strength view), CalcBE ("hold'em distribution"), and most modern free calculators show "% you end with a pair / two pair / trips / etc." by river | MEDIUM | Aggregation layer on top of the evaluator + simulation; must recompute per street as board narrows the outcome space |
| Street-by-street input/progression | PokerNews, Omni Calculator, CardPlayer all explicitly support leaving later-street cards "Unknown" and recompute as flop/turn/river are added | MEDIUM | Needs a simple state machine (preflop → flop → turn → river) plus recompute-on-change |
| Real-time recalculation on any card change | Every modern calculator (Flopzilla explicitly notes "updates automatically without a Compute button") recomputes the instant an input changes | MEDIUM | Requires the simulation to be cheap/fast enough (or interruptible) to not freeze the UI on every card click |
| Random/quick deal | PokerStove, Equilab, and consumer mobile apps ("Poker Odds – Simulator") all support one-click random dealing as the default entry point, distinct from manual setup | LOW | Simple RNG deal into the picker state; must respect "no duplicate cards" |
| Support for multiple simultaneous opponents | PokerScout supports up to 10 seats with live win/tie% per seat; PokerNews supports up to 9 opponents; multi-opponent is the norm, not the exception | LOW (fixed at 3 per this project) | This project fixes opponent count at 3, which simplifies layout vs. competitors that support variable N — a deliberate, reasonable scope reduction, not a regression |

### Differentiators (Competitive Advantage)

Features that are rare, absent, or done poorly in the surveyed products, and that align directly with this project's stated core value ("probability made visible").

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Full casino-table visual presentation (felt, seated opponents, animated card dealing/flipping) | No surveyed equity calculator (Equilab, PokerStove, web calculators, PokerCruncher, Flopzilla) has a real table scene — they're all forms. Broadcast TV graphics have the visual language but aren't interactive. This is the single biggest gap in the market for an *educational* tool | HIGH | Largest scope item in the project; art + animation work, not just logic. Justifies "game design learning tool" framing over "yet another calculator" |
| Live Monte Carlo convergence display (percentages visibly settling as trial count climbs) | Most calculators either show a static final answer or, at best, a progress spinner (PokerStove's Monte Carlo mode computes "millions per second" but doesn't narrate the convergence as a teaching moment). Making the *method* visible — not just the result — is this project's explicit pedagogical thesis | MEDIUM-HIGH | Requires a streaming/incremental simulation (Web Worker posting partial results every N trials) rather than a single batch compute-then-return; this is an architectural choice, not just a UI skin |
| Opponent card reveal mid-hand, with live recalculation | Standard calculators let you *set* opponent cards up front (known hand vs. known hand) but don't model the *act* of revealing previously-hidden information mid-flow and recomputing live off it — that's a broadcast-TV behavior, not a calculator one | MEDIUM | Requires the simulation to correctly condition on a partially-known opponent set (some revealed, some still random) — genuine simulation logic, not just UI |
| Forward + rewind street navigation | Calculators let you jump directly to any street by filling in cards, but none surveyed support "go back to preflop and watch the odds unwind" as a first-class interaction — it's always forward-only data entry | MEDIUM | Needs state history (snapshot per street) so rewinding is instant, not a recompute; enhances the "watch information reshape probability" narrative directly |
| Manual "what-if" scenario builder alongside random deal | Some tools (PokerStove, Equilab) allow manual card entry, but pairing a default *random* mode with an easy toggle into full manual construction, in a single fluid UI, is uncommon — most tools are manual-only forms | LOW-MEDIUM | Mostly a UI/mode-toggle concern once the card picker and engine exist |
| Outs / draw callouts tied to hand-category shifts | Equilab's Flop Outs Counter and dedicated outs calculators (CardPlayer, Bet Shrew) show numeric outs; doing this as a highlighted/annotated layer on top of the live table (not a separate tool) would be novel presentation of a known concept | MEDIUM | Not in the current locked requirement set — recommend as a v1.x addition once the core odds engine and table are proven |
| Educational annotations (plain-language explanations of what's happening) | Rare — only PokerNews' color-coded "cards that help/hurt" guide does anything like this among surveyed tools; most calculators assume the user already knows poker math | LOW-MEDIUM | High leverage for the stated audience (game-design learners, not necessarily poker experts); can be layered incrementally as tooltips/callouts without touching the simulation engine |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Hand-range input for opponents (Equilab/PokerCruncher/Flopzilla-style 13x13 range grid, weighted combos) | Power-user equity tools (Equilab, PokerCruncher, Flopzilla) all treat range-vs-range as their signature pro feature | Adds significant UI complexity foreign to this project's audience; conflicts with the "anonymous opponent, reveal or not" model already locked in PROJECT.md — ranges imply partial knowledge this tool doesn't model | Keep opponents binary: hidden (uniformly random from remaining deck) or revealed (fully known). No weighted/partial-range states |
| User-exposed trial-count / precision tuning (choose 10k vs 1M trials, enumeration vs Monte Carlo toggle) | PokerStove exposes "Enumerate All" vs "Monte Carlo" and trial-count settings for accuracy-conscious pros | Undermines the "just watch it happen" simplicity that is this project's actual pedagogical point; adds a settings surface with no learning payoff for the target audience | Auto-run to a sensible convergence threshold (or fixed high trial count) with no user-facing precision dial; the live convergence *display* is the feature, not manual control over it |
| Betting, pot, chip stacks, wagering | "Real poker" feel; most consumer poker apps (and the source game itself) center on betting | Explicitly out of scope per PROJECT.md — betting adds pot math, side pots, and decision-modeling complexity that serves a *game*, not a *probability lens*; doesn't serve the learning goal | Pure odds/equity display with no wagering — already the correct call, keep it locked |
| GTO/strategy recommendations ("you should bet/fold here") | Training-oriented tools (solvers, PokerCruncher's advanced stats) push toward "what should I do" | Turns an odds *explorer* into a poker *trainer*; conflates "what's true" (probability) with "what's optimal" (strategy), which is explicitly not this project's goal per PROJECT.md context | Show descriptive odds only — probabilities, not prescriptions |
| Configurable/variable number of opponents (1-9, like PokerNews/PokerScout) | Common in general-purpose calculators; feels more flexible | Conflicts with the fixed, art-directed felt-table layout (3 seated opponents) already decided in PROJECT.md; dynamic seating adds real rendering/layout complexity for a benefit this tool doesn't need | Fixed 3 opponents for v1; if variable seating is ever wanted, treat it as a distinct future milestone, not a v1 toggle |
| Hand history logging / session stats / HUD-style tracking | PokerTracker-style tools build entire businesses on this; feels like a natural "save your work" feature | Requires persistence (storage or backend), directly conflicts with the "client-side only, no backend" architectural constraint in PROJECT.md, and doesn't serve a single-session learning tool | Ephemeral session state only; a shareable permalink of a specific constructed scenario is a reasonable *future* alternative, not persistent history |
| Multiplayer / shared live sessions | Social/classroom appeal — "let's all look at the same hand" | Explicitly out of scope per PROJECT.md (single-user learning tool, no networked play); adds server/sync complexity that contradicts the client-only architecture | Single-user tool; if sharing matters later, a static exported/linked scenario state is lower-cost than live multiplayer |

## Feature Dependencies

```
7-card hand evaluator
    └──requires──> (nothing; foundational)

Monte Carlo simulation engine
    └──requires──> 7-card hand evaluator
                       └──requires──> deck/card-removal tracking (known vs. unknown cards)

Win/tie/lose equity display
    └──requires──> Monte Carlo simulation engine

Hand-category probability table
    └──requires──> Monte Carlo simulation engine (aggregated by resulting hand rank)

Street-by-street progression (preflop→flop→turn→river)
    └──requires──> Monte Carlo simulation engine (recompute per street)
    └──requires──> state history/snapshots (for rewind)

Rewind navigation
    └──requires──> Street-by-street progression's state history

Opponent card reveal
    └──requires──> deck/card-removal tracking (revealed card removed from "unknown" pool, forces re-simulation)
    └──requires──> Monte Carlo simulation engine (conditioning on mixed known/unknown opponents)

Live convergence display (trial counter, settling percentages)
    └──requires──> Monte Carlo simulation engine running as streaming/incremental (Web Worker posting partial results)

Full casino-table visual (felt, seats, animated cards)
    └──enhances──> all of the above (presentation layer; doesn't gate correctness of any calculation)

Card picker (manual entry)
    └──requires──> deck/card-removal tracking

Random deal / redeal
    └──requires──> deck/card-removal tracking

Outs / draw callouts
    └──requires──> 7-card hand evaluator (near-miss detection)
    └──enhances──> Hand-category probability table

Educational annotations
    └──enhances──> Win/tie/lose display, Hand-category probability table, Outs callouts (adds explanatory copy; doesn't gate them)

Hand-range input for opponents (ANTI-FEATURE)
    └──conflicts with──> Opponent card reveal model (binary known/unknown vs. weighted range)
```

### Dependency Notes

- **Everything downstream of "deck/card-removal tracking":** this is the single most load-bearing piece of state in the app. Random deal, manual picker, opponent reveal, and rewind all read/write it, and it must always stay internally consistent (no card assigned twice) or every displayed probability becomes wrong. Get this right first.
- **Live convergence display requires the simulation engine to be architected as streaming from day one.** If the engine is built as "compute once, return final answer," retrofitting incremental progress reporting later means re-architecting the Web Worker message protocol, not just adding a UI element. This should be a phase-0/phase-1 architectural decision, not deferred polish.
- **Rewind requires state history, not re-derivation.** The cheapest correct approach is snapshotting the equity result at each street as it's computed forward, so "rewind" is an instant lookup, not a re-simulation. This avoids re-running Monte Carlo trials every time the user steps backward.
- **Full casino-table visual enhances but never gates correctness.** It's safe to build and validate the odds engine against a bare-bones card grid first, then layer the felt-table presentation on top — the simulation and the scene are decoupled concerns.
- **Outs/draw callouts and educational annotations are additive layers**, not core-path dependencies — they read off data the engine already produces (hand-category shifts, evaluator near-misses) and can be scoped into v1.x without touching the simulation core.

## MVP Definition

### Launch With (v1)

This maps directly to PROJECT.md's current "Active" requirements — research confirms these are the correct, non-negotiable core, matching or exceeding the analytical table stakes found across every surveyed competitor while adding the presentational differentiator no competitor has.

- [ ] 7-card hand evaluator + Monte Carlo simulation engine (streaming/incremental) — nothing else works without this
- [ ] Card picker for manual hole/board card selection — table stakes across every competitor
- [ ] Random deal with re-deal — table stakes (PokerStove, Equilab, mobile apps)
- [ ] Win/tie/lose equity vs. 3 opponents — the headline output of every competitor
- [ ] Hand-category probability table by river — matches Equilab/CalcBE-tier tools
- [ ] Street-by-street progression (preflop→flop→turn→river) with recompute — table stakes
- [ ] Rewind navigation across streets — differentiator, no competitor does this
- [ ] Opponent card reveal with recalculation — differentiator, no competitor does this as a live mid-hand action
- [ ] Live convergence display (trial count + settling percentages) — differentiator, this is the pedagogical core
- [ ] Full casino-table visual scene with animated card dealing/flipping — differentiator, the single biggest gap in the market

### Add After Validation (v1.x)

- [ ] Outs/draw callouts (numeric outs + highlighting) — add once the core table and engine are proven; trigger: users asking "why did my odds jump" without an explanation
- [ ] Educational annotation layer (tooltips/callouts explaining hand ranks, what changed and why) — trigger: user testing shows people don't understand *why* percentages moved, only *that* they moved
- [ ] Shareable scenario permalinks (encode a constructed "what-if" scenario in a URL) — trigger: users want to show/discuss a specific scenario without screen-sharing

### Future Consideration (v2+)

- [ ] Variable opponent count (beyond fixed 3) — defer until the fixed-3 felt-table experience is validated; changes table layout/art significantly
- [ ] Other poker variants (Omaha, Stud) — explicitly deferred per PROJECT.md; only revisit if the Hold'em tool proves the concept
- [ ] Opponent hand-range modeling (weighted ranges instead of binary known/unknown) — defer indefinitely; conflicts with the simplicity goal, would need strong evidence of demand from an audience that has outgrown the current model

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hand evaluator + Monte Carlo engine | HIGH | HIGH | P1 |
| Win/tie/lose equity display | HIGH | LOW (given engine) | P1 |
| Hand-category probability table | HIGH | MEDIUM | P1 |
| Card picker (manual entry) | HIGH | MEDIUM | P1 |
| Random deal/re-deal | HIGH | LOW | P1 |
| Street-by-street progression | HIGH | MEDIUM | P1 |
| Rewind navigation | MEDIUM-HIGH | MEDIUM | P1 |
| Opponent card reveal | HIGH | MEDIUM | P1 |
| Live convergence display | HIGH | MEDIUM-HIGH | P1 |
| Full casino-table visual + animation | HIGH | HIGH | P1 |
| Outs/draw callouts | MEDIUM | MEDIUM | P2 |
| Educational annotations | MEDIUM-HIGH | LOW-MEDIUM | P2 |
| Shareable scenario permalinks | LOW-MEDIUM | LOW-MEDIUM | P3 |
| Variable opponent count | LOW | HIGH | P3 |
| Other poker variants | LOW (for this audience) | HIGH | P3 |
| Hand-range opponent modeling | LOW (for this audience) | HIGH | P3 (likely never) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Equilab | PokerStove | PokerNews/Omni-style web calculators | Our Approach |
|---------|---------|------------|---------------------------------------|--------------|
| Card input | Range-grid + specific cards | Specific cards or ranges | Click-to-select card grid | Click-to-select on a live felt table, not a form |
| Opponent modeling | Weighted ranges, library of school ranges | Specific hands or ranges | Specific hands, "random" default | Binary: hidden (random) or revealed (known) — no weighted ranges |
| Equity display | Numeric win/tie% per range | Numeric win/tie% per hand | Numeric win/loss/tie% | Same numbers, presented at animated table seats, not a results table |
| Hand-category breakdown | Yes (hand strength distribution) | Limited | Yes on several free calculators (CalcBE, Omni) | Yes, full high-card→royal-flush table, live-updating |
| Street progression | Manual re-entry per street | Manual re-entry per street | Leave later cards "Unknown," recompute | First-class forward/rewind navigation with animated dealing |
| Convergence visibility | Final number only | Final number only (Monte Carlo mode computes fast, not narrated) | Final number only | Live, visible, is the pedagogical centerpiece |
| Presentation | Utilitarian desktop app UI | Utilitarian desktop app UI (discontinued 2008) | Bare web form | Full casino table: felt, seats, detailed animated cards |
| Educational framing | None (assumes poker literacy) | None | PokerNews has a green/red "helps/hurts" guide; rare | Explanatory annotations layered on top of live odds |
| Outs display | Yes (Flop Outs Counter) | No | Some (CardPlayer, dedicated outs calculators) | Deferred to v1.x, presented as highlighted callouts not a separate tool |

## Sources

- [PokerListings: How To Use Equilab Poker Software in 2026](https://www.pokerlistings.com/poker-tools/calculators/equilab)
- [PokerStrategy.com: Equilab Hold'em](https://www.pokerstrategy.com/poker-software-tools/equilab-holdem/)
- [PokerVIP: PokerStrategy Equilab Holdem Calculator Review](https://www.pokervip.com/strategy-articles/texas-hold-em-no-limit-intermediate/pokerstrategy-equilab-holdem-calculator-review)
- [Cardmates: PokerStove Equity Calculator Review & Alternatives](https://cardmates.co.uk/pokerstove_calculator_review)
- [TwoPlusTwo forum: PokerStove "Monte Carlo" vs. "Enumerate All"](https://forumserver.twoplustwo.com/32/beginners-general-questions/pokerstove-quot-monte-carlo-quot-vs-quot-enumerate-all-quot-968226/)
- [Wikipedia: Poker calculator](https://en.wikipedia.org/wiki/Poker_calculator)
- [PokerNews: Texas Hold'em Poker Odds Calculator](https://www.pokernews.com/poker-tools/poker-odds-calculator.htm)
- [CardPlayer: Texas Hold'em Poker Odds Calculator](https://www.cardplayer.com/poker-tools/odds-calculator/texas-holdem)
- [PokerScout: Texas Hold'em Poker Odds Calculator](https://www.pokerscout.com/calculators/texas-holdem-odds/)
- [Wizard of Odds: Texas Hold'em Calculator](https://wizardofodds.com/games/texas-hold-em/calculator/)
- [CalcBE: Poker Odds Calculator for Texas Hold'em](https://calcbe.com/en/calculators/poker-probability/)
- [Omni Calculator: Poker Odds Calculator](https://www.omnicalculator.com/other/poker-odds)
- [Apple App Store: PokerCruncher - Expert - Odds](https://apps.apple.com/us/app/pokercruncher-expert-odds/id422498721?mt=12)
- [PokerCruncher: Tutorial](https://www.pokercruncher.com/ipPokerCruncherTutorial.html)
- [MyPokerCoaching: How to Use Flopzilla](https://www.mypokercoaching.com/flopzilla/)
- [PokerListings: Flopzilla Pro Full Guide & Price for 2026](https://www.pokerlistings.com/poker-tools/calculators/flopzilla-pro)
- [Quora: How are win/lose percentages from televised Texas Hold'em games calculated?](https://www.quora.com/How-are-the-win-lose-percentages-from-televised-Texas-Hold-Em-games-calculated-There-is-an-example-in-the-details)
- [Apple App Store: Poker Odds Teacher](https://apps.apple.com/us/app/poker-odds-teacher/id308077124)
- [Apple App Store: Poker Odds – Simulator](https://apps.apple.com/us/app/poker-odds-simulator/id1300580543)
- [ThePokerBank: Poker Percentage Odds Chart](https://www.thepokerbank.com/tools/odds-charts/percentage/)
- [Pokerology: Poker Odds & Outs](https://www.pokerology.com/poker/math/drawing-odds/)

**Note on confidence:** Most findings above draw on WebSearch summaries of product marketing/review pages rather than direct hands-on use or Context7-verified docs (poker equity calculators are not a documented library ecosystem). Corroboration came from multiple independent sources agreeing on core mechanics (card picker, win/tie/lose, Monte Carlo vs. enumeration, street progression), which supports MEDIUM-HIGH confidence on the table-stakes list. The claim that no competitor combines a full animated casino table with live-narrated Monte Carlo convergence is a negative claim based on absence across all sources checked (Equilab, PokerStove, PokerCruncher, Flopzilla, PokerNews/CardPlayer/Omni/CalcBE web calculators, mobile "Poker Odds" apps, and a direct search for 3D/WebGL poker odds visualizers) — flagged MEDIUM confidence since a true exhaustive market scan (especially of newer/smaller mobile apps) wasn't feasible within this research pass.

---
*Feature research for: Browser-based Monte Carlo Texas Hold'em odds simulator (educational, full casino-table presentation)*
*Researched: 2026-08-23*
