# Feature Research

**Domain:** Blackjack probability/odds explorers + multi-deck effects in card-based Monte Carlo simulators (v2.0 milestone: Blackjack + Multi-Deck, added to an existing Hold'em odds simulator)
**Researched:** 2026-08-24
**Confidence:** MEDIUM-HIGH

## Feature Landscape

Blackjack tooling on the web splits into three lineages, and this milestone deliberately wants exactly one of them, adapted to this project's existing "odds explorer" model:

1. **Strategy calculators / EV tools** (Wizard of Odds hand calculator, "Best in Slot" blackjack calculator, The Probability Lab, GamblingCalc) — you set player cards + dealer up-card + deck count/ruleset, and the tool returns the recommended action plus an EV number per action (hit/stand/double/split/surrender), usually expressed as expected return per 1 unit wagered. These are **prescriptive** (they tell you what to do) and mostly static/instant (closed-form or pre-tabulated, not a visible live simulation). They define the *analytical* table stakes for what numbers a credible blackjack tool must produce.
2. **Card-counting trainers** (Card Counting Trainer, True Count Trainer, bjcardcounter.com, mobile "Blackjack Coach" apps) — timed drills that flash cards and quiz the user on running count / true count / basic-strategy deviations. These are **skill-drill** tools (reflex/memorization training against a clock), a fundamentally different interaction loop from an odds explorer — no relevance to "watch the numbers move," everything is about the user producing the number correctly under time pressure.
3. **Dealer-bust / probability-table references** (Wizard of Odds "why number of decks matter," the classic dealer-bust-by-upcard chart, "Statistics of Blackjack" writeups) — static tables/articles showing dealer final-outcome distributions and how deck count shifts them. These are **descriptive reference material**, not interactive tools, but they identify exactly which numbers are considered the canonical "interesting" blackjack probabilities.

This project's existing Hold'em app already established the right synthesis for lineage 3 turned interactive (poker's hand-category table, win/tie/lose, live convergence). The blackjack feature should be **lineage 1's inputs and numbers, lineage 3's descriptive/non-prescriptive stance, delivered with the existing project's Monte Carlo/live-convergence presentation** — explicitly *not* lineage 2's drill/quiz interaction model.

### The Odds-Explorer Interaction Loop (Blackjack, no betting)

This is the direct blackjack analog of the existing Hold'em loop ("deal or construct → read odds → advance/rewind → watch odds respond"):

1. **Deal or construct a scenario** — random deal (default) or manual picker sets: player's first two cards, dealer's up-card (visible), dealer's hole card (hidden — same "anonymous but real" model as a poker opponent). This reuses the existing card-picker/random-deal/reveal patterns near-verbatim; the dealer's hidden hole card *is* an "opponent" in the existing engine's sense.
2. **Read the odds panel** for the current hand, before any decision: player bust-if-hit probability, dealer final-outcome distribution conditioned on the up-card, and win/push/lose probability + EV for the two live options (stand now vs. hit now). No recommended action is shown — this mirrors the already-established anti-GTO stance from the poker research (descriptive, not prescriptive).
3. **Take an action** (hit, stand, double if allowed, split if a pair) — this is the blackjack analog of "advance a street." Hitting deals one visible card and recomputes everything against the new total; standing locks the player's hand and reveals the dealer's hole card, triggering the dealer's fixed drawing-rule playout and a final win/push/lose result.
4. **Reveal the dealer's hole card early** (optional, analogous to poker's opponent reveal) — turns "what's the chance the dealer has a ten under there" from a live Monte Carlo question into a certainty, and all downstream odds recompute conditioned on it. This is a very natural reuse of the existing reveal mechanic and maps directly onto the real insurance decision's underlying question without needing to implement insurance as an actual side wager.
5. **Toggle deck count (1 vs 2)** at any point — every displayed number (bust chance, dealer distribution, natural frequency, EV) recomputes live so the user can watch deck composition itself move the odds. This is the same "watch information reshape probability" payoff the project's Core Value already commits to, just with the deck itself as the "information."

There is no bankroll, no bet sizing, and no chip stack anywhere in this loop — EV is reported as a **per-decision, per-unit-wagered ratio** (e.g., "Stand: −0.18 units expected" / "Hit: −0.31 units expected"), which is the standard way EV is expressed in blackjack literature (Wizard of Odds, Schlesinger's *Blackjack Attack*) and requires no actual money/chips concept to compute or display. This satisfies the project's no-betting constraint while still delivering the single most useful number a real strategy calculator produces.

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Player bust-if-hit probability | Every strategy calculator and every "dealer bust chart" reference leads with this; it's the single most intuitive blackjack probability (P(next card busts current total)) | LOW | Simple to compute exactly from remaining-shoe composition; still route through the Monte Carlo engine for presentation consistency with the rest of the app (see Architecture note below) |
| Dealer final-outcome distribution by up-card | The canonical "dealer bust chart" (17/18/19/20/21/blackjack/bust breakdown conditioned on the visible up-card) appears in essentially every blackjack probability reference (Wizard of Odds, "Statistics of Blackjack," Medium/DataGenetics writeups) — overall dealer bust rate is famously ~28% but varies sharply by up-card (dealer showing 5–6 busts ~40%+, dealer showing 7–A busts much less) | MEDIUM | This is blackjack's direct analog to the existing poker hand-category table — same "distribution table that updates live" pattern, reuse that UI concept |
| Win/push/lose probability for Stand vs. Hit | The headline output of literally every calculator surveyed (Wizard of Odds, Best in Slot, GamblingCalc, The Probability Lab) — always shown per available action | LOW (display) / MEDIUM (engine: needs dealer playout simulation) | Requires simulating the dealer's fixed drawing rule (hit to 17, stand on all 17s — pick one standard rule and don't expose it as a toggle, see Anti-Features) inside each trial |
| EV per decision, per-unit-wagered | Every surveyed calculator's "so what should I actually expect" number; industry-standard normalized unit (not dollars, not a bankroll) | LOW (given win/push/lose is already computed) | EV = P(win)×(+1, or +1.5 for a stood natural) + P(push)×0 + P(lose)×(−1); purely a derived statistic, no wager/chip state needed — this is what keeps the feature inside the no-betting constraint |
| Natural blackjack frequency | Universally cited stat in every blackjack probability reference; also the cleanest single number for demonstrating the deck-count effect (verified: ~4.83% at 1 deck vs. ~4.78% at 2 decks — small but real and directly attributable to card removal) | LOW | Pure deck-composition calculation (P(ace)×P(ten-value \| ace drawn) × 2 orderings); ideal candidate for a "before/after" deck-count-toggle callout since the delta is real but subtle enough to need the tool to make it visible |
| Live recalculation on every action and on the deck-count toggle | Matches the existing app's already-established pattern (every card change recomputes); users of any modern calculator expect zero "Compute" button | MEDIUM | Reuses the existing worker/Comlink streaming architecture — one more request-shape into the same engine, not a new architectural pattern |
| Random deal + manual card picker for player hand and dealer up-card | Direct reuse of the existing Hold'em picker/random-deal UX; users of the existing app will expect the same interaction to carry over to the new game | LOW (given existing picker component) | The "no duplicate cards" picker constraint now must also respect deck count (2-deck mode legitimately allows the same rank+suit to be picked twice — see 2-Deck Hold'em section) |
| Deck-count toggle (1 / 2) affecting Blackjack specifically | This is the explicit PROJECT.md v2.0 target feature — a shoe of 1 or 2 decks is table stakes for a blackjack tool that claims deck count as a first-class variable | LOW–MEDIUM | Must correctly rebuild the "remaining shoe" composition (52 or 104 cards minus dealt/known cards) that every other probability in this table is computed from |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Monte Carlo convergence display for Blackjack odds (not closed-form/instant) | Every surveyed blackjack calculator (Wizard of Odds, Best in Slot, GamblingCalc) returns an instant, silently-computed number — none narrate the *method*. Blackjack's finite state space makes exact enumeration trivially fast, so competitors never bother simulating; deliberately running it through the same visible-convergence Monte Carlo pipeline as the poker engine makes this tool's pedagogical thesis ("watch probability resolve") consistent across both games rather than "poker teaches the method, blackjack just shows an answer" | MEDIUM | Architectural consistency choice, not a performance necessity — blackjack could be computed exactly and instantly, but doing so would silently break the app's own teaching device. Worth an explicit product decision, not a default | 
| Dealer hole-card reveal as a live "insurance question," without implementing insurance as a bet | No surveyed calculator frames "is there a ten under there?" as a live, revealable Monte Carlo question the way this project already treats poker opponent reveals — most just let you set the dealer's hole card manually. Presenting it as a reveal action (matching the existing poker mechanic almost exactly) is a natural, low-cost differentiator unique to this app's existing interaction model | LOW (reuses existing reveal mechanic) | Deliberately expose the *probability* insurance is based on (P(dealer has ten-value hole card given an Ace up)) without any wager UI — keeps the no-betting constraint intact while still teaching the concept insurance is built on |
| Side-by-side / before-after deck-count comparison callout | Verified real numbers (natural blackjack frequency 4.83%→4.78%, dealer bust rate shifts, stiff-hand bust-on-hit deltas) are small enough that a bare toggle risks going unnoticed; explicitly highlighting *which* numbers just changed and by how much (e.g., a brief flash/delta annotation, similar to how the poker table needs to visibly re-settle percentages) makes the deck-count effect the tool's actual teaching moment rather than a background parameter | LOW–MEDIUM | Directly serves the v2.0 milestone's stated goal ("deck count visibly changes the odds") — this is arguably the single most important differentiator for satisfying that specific goal, more so than any individual new number |
| Double Down and Split as additional live decision branches | Both appear in every real strategy calculator (table stakes for a "credible blackjack tool" reputation) but add genuine engine complexity — double forces exactly one more card then a forced stand (cheap extension of the hit-then-dealer-playout trial); split creates two independent hands each needing their own hit/stand loop (nontrivial, especially interactions like double-after-split and resplitting) | Double: LOW–MEDIUM. Split: HIGH | Recommend shipping Hit/Stand (+ dealer reveal) as the v2.0 core loop, Double as a fast-follow (P1.5/P2), Split deferred to v2.x once the two-hand state model is validated |
| Non-graded running/true-count readout tied to the live odds panel | Distinguishes itself from every card-counting *trainer* (which quizzes/times the user) by simply displaying "here's why the odds just shifted" as a passive readout next to the odds table — this is thematically identical to the milestone's own framing ("deck composition is a probability variable") and the engine already tracks exact remaining-shoe composition needed to compute it for free | LOW (data already exists in engine state) | Recommend as a v3+ candidate bundled conceptually with the already-deferred EDU-01/02/03 annotation layer, not v2.0 — it's explanatory/annotation in nature, which PROJECT.md explicitly scoped out of this milestone |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full color-coded basic-strategy chart (the traditional hit/stand/double/split/surrender grid) | Every blackjack site has one; feels like an obviously "complete" blackjack tool without it | Directly conflicts with the project's already-established anti-GTO-recommendation stance for poker ("show descriptive odds only... not prescriptions"); a prescriptive strategy chart turns an odds *explorer* into a *trainer*, changing the product's identity | Show the same underlying EV numbers per action (hit/stand/double/split) descriptively, for the *current* hand only — never a static "correct play" grid or a green/red highlight telling the user what to do |
| Card-counting drill/quiz trainer (timed count practice, flash-card speed drills) | Genuinely popular standalone genre (Card Counting Trainer, True Count Trainer, bjcardcounter.com all exist and have real audiences) | Wrong interaction loop entirely — these are reflex/memorization trainers racing a clock, not an "explore and watch probability respond" tool; building this would import a whole second product genre with its own UX needs (deal speed controls, scoring, timers) that don't serve this project's Core Value | If deck-composition-driven probability shift is worth surfacing, do it as the passive non-graded count *readout* differentiator above — no quiz, no clock, no score |
| Side bets: Perfect Pairs, 21+3, Lucky Ladies, etc. | Common at real tables; "more numbers to show" feels additive | These are separate wagering side-games with independent payout tables, unrelated to the hand-value/bust/dealer-distribution probabilities this tool teaches; they also reintroduce betting-shaped concepts (stake, payout ratio) the project explicitly excludes | None needed — they don't serve the probability-education goal at all; skip entirely, not just defer |
| Insurance implemented as an actual side wager (place/resolve a bet, track a payout) | It's a real, standard blackjack decision point most players will expect to see modeled | Implementing it as a wager reintroduces bet-sizing/payout/bankroll concepts explicitly out of scope per PROJECT.md ("no betting, chips") | Expose the underlying probability (dealer hole-card is ten-value, given an Ace up) via the existing reveal mechanic instead — see Differentiators |
| Exposing every casino rule variant as a user setting (S17 vs H17, DAS, resplit limits, surrender availability, blackjack payout ratio) | Real calculators (Wizard of Odds, Best in Slot) all expose these as dropdowns for "accuracy" | Mirrors the already-identified poker anti-feature ("user-exposed trial-count/precision tuning... undermines the 'just watch it happen' simplicity"); a settings surface this wide has no learning payoff for this tool's audience and dilutes deck count as *the* explorable variable this milestone is about | Hard-code one sensible standard ruleset (e.g., dealer stands on all 17s, double after split allowed, no resplitting aces, 3:2 blackjack payout used only for EV math) and keep deck count (1 vs 2) as the sole user-facing probability knob for v2.0 |
| Exact/closed-form instant computation replacing Monte Carlo for blackjack (since it's fast enough to enumerate exactly) | Tempting "free" accuracy/performance win since blackjack's state space is small and fully enumerable | Exactly the same trap already flagged for poker's "deliberately not exact-enumerating" pattern — silently swapping in a different algorithm because it's easy breaks the app's consistent "watch Monte Carlo converge" pedagogy and makes blackjack feel bolted-on rather than a sibling game | Keep blackjack odds flowing through the same streaming Monte Carlo worker pipeline as poker, even though exact enumeration is computationally available |

## 2-Deck Hold'em: What Should Visibly Change

This is a mode of the *existing* poker game, not the new Blackjack game, but shares the same "deck count as a probability variable" theme and the same underlying shoe-composition engine work.

**What the user should see change:**
- **A new "Five of a Kind" row** in the existing hand-category table, ranked between Royal Flush and Straight Flush (see ranking convention below) — this is the most dramatic, legible signal that "something fundamental about the deck changed," and it's a natural top-of-table addition to a table structure that already exists.
- **Visibly shifted frequencies for Four of a Kind, Full House, and Flush** — with 8 copies of each rank in a 2-deck shoe (4 suits × 2 decks) instead of 4, quads and full houses become meaningfully more common; flush frequency is largely unaffected in kind but flush *ties* become more likely since more players can share an identical flush made of duplicate-origin cards. The live-updating category table already shows this automatically once the engine's shoe model is deck-count-aware — no new UI beyond the new row is strictly required, but the shift itself is worth confirming looks "real" in a quick sanity pass (values should visibly move when toggling 1→2 decks with the same seed/scenario).
- **Duplicate cards visibly present on the felt** — e.g., two Ace of Spades appearing simultaneously in different hands/board slots. This needs a **visual origin cue** (a small per-card deck-index badge, a second card-back color/pattern, or similar), not because the rules require it, but because a user who spots two identical-looking cards on the table without any differentiation will reasonably suspect a rendering bug rather than a real 2-deck outcome — this is a trust/legibility requirement, not a probability requirement.

**Hand ranking convention for the new hand (verified via community gambling-math consensus, not an official rulebook — no single deck count beyond "1" has an official rulebook):**
- Order, most to least rare within the new top tier: **Royal Flush → Five of a Kind → Straight Flush → Four of a Kind → Full House → Flush → Straight → Three of a Kind → Two Pair → Pair → High Card.** This matches the Wizard-of-Vegas gambling-math forum's worked-out 2-deck ranking (five of a kind and straight flush both treated as genuinely new/rarer categories, inserted above four of a kind, with royal flush remaining the single rarest hand) and is consistent with the standard poker-hand-ranking principle of "rarer combinatorially = ranks higher."
- **Do not** add the more exotic "flush containing two pair" category some 2-deck 5-card-draw rankings introduce (a flush whose 5 cards happen to also contain two pairs — only possible with duplicate ranks in the same suit). It is real but vanishingly rare, off-the-shelf evaluator libraries have no concept of it, and it would require a bespoke 12th category with its own detection logic for a hand type players will almost never see in a 7-card Hold'em context. Treat it as an anti-feature for this milestone: if it happens to occur, letting it evaluate as a plain Flush is an acceptable, defensible simplification.
- **Duplicate-card ties resolve exactly like standard Hold'em ties already do — no new rule is needed at the game-design level.** Poker ties are broken by rank only; suit never breaks a tie, and fully-equal hands split. Two players each holding an "Ace of Spades" from different physical decks are, for ranking purposes, just two players holding an Ace — the existing rank-based comparison already handles this correctly. The only real risk is **mechanical**, not a rules question: the evaluation layer must be verified to treat each of the 104 cards as a distinct object and must not internally collapse two physically-identical rank+suit cards into a single logical card (e.g., via a 52-bit-per-card bitmask representation, which some fast evaluator libraries use internally and which would silently undercount duplicate-rank groups). This is a hand-off note for the architecture/implementation phase, not a new game rule.
- **Dependency:** both "Five of a Kind" and correct duplicate-rank comparison require a **custom evaluation layer** built on top of (or replacing, in 2-deck mode) the existing off-the-shelf 7-card evaluator, which — like every mainstream Hold'em evaluator — assumes a single 52-card deck with no duplicates and has no built-in concept of "5 of the same rank." This was already anticipated in PROJECT.md's v2.0 feature list and should be treated as the single highest-complexity item in this milestone's poker-side scope.

## Feature Dependencies

```
Blackjack: Deck-aware shoe model (1 or 2 decks)
    └──requires──> Reuse of existing deck/card-removal tracking (extended to N decks, not just 52 unique cards)

Blackjack: Player bust-if-hit probability
    └──requires──> Deck-aware shoe model

Blackjack: Dealer final-outcome distribution
    └──requires──> Deck-aware shoe model
    └──requires──> Dealer fixed-drawing-rule playout logic (new engine code — poker has no analog)

Blackjack: Win/Push/Lose + EV for Stand/Hit
    └──requires──> Dealer final-outcome distribution
    └──requires──> Player hand-value logic (hard/soft totals, bust detection — new engine code)

Blackjack: Natural blackjack frequency
    └──requires──> Deck-aware shoe model
    └──enhances──> Deck-count comparison callout (their delta is the demonstration)

Blackjack: Double Down EV
    └──requires──> Win/Push/Lose + EV for Stand/Hit (extends the same trial logic by one forced card)

Blackjack: Split EV
    └──requires──> Win/Push/Lose + EV for Stand/Hit
    └──requires──> Two-independent-hand state model (new — no existing analog in the poker engine)

Blackjack: Dealer hole-card reveal ("insurance question")
    └──requires──> Reuse of existing opponent-reveal mechanic/pattern

Deck-count toggle (spans both games)
    └──requires──> Deck-aware shoe model (Blackjack)
    └──requires──> Deck-aware shoe model + custom evaluation layer (Hold'em 2-deck mode)
    └──enhances──> Natural blackjack frequency, all Blackjack odds, poker hand-category table

Hold'em: Five of a Kind category + duplicate-rank comparison
    └──requires──> Custom evaluation layer (off-the-shelf evaluator has no multi-deck/duplicate concept)
    └──requires──> Deck-aware shoe model (2-deck mode)

Hold'em: Duplicate-card visual origin cue on the felt
    └──enhances──> Hold'em 2-deck mode (trust/legibility, not correctness)

Card-counting readout (non-graded) [v3 candidate]
    └──requires──> Deck-aware shoe model
    └──conflicts with──> "no exposed precision/settings dial" philosophy if implemented as a graded drill (ANTI-FEATURE variant)

Full basic-strategy chart (ANTI-FEATURE)
    └──conflicts with──> existing "descriptive not prescriptive" product stance (already established for poker's GTO anti-feature)

Side bets (ANTI-FEATURE)
    └──conflicts with──> No-betting/no-chips constraint (PROJECT.md)
```

### Dependency Notes

- **Deck-aware shoe model is the single most load-bearing new piece of state for this milestone**, exactly analogous to how "deck/card-removal tracking" was flagged as the most load-bearing v1 state. Every blackjack probability and the entire 2-deck Hold'em mode read from it; it must be generalized from "which of 52 unique cards are known/removed" to "which of N×52 physical cards (with legitimate rank+suit duplicates when N=2) are known/removed." Get this generalization right before building any feature on top of it — the same "get this right first" lesson from v1 research applies directly.
- **Dealer fixed-drawing-rule playout is genuinely new engine logic with no poker analog.** Poker's engine only ever evaluates already-complete 7-card hands; blackjack requires simulating a *procedural* dealer decision loop (hit while total < 17, respecting the chosen soft-17 rule) inside every trial. This is real new complexity, not a thin wrapper over the existing evaluator.
- **Split requires a genuinely new state shape** (two independent hands sharing one shoe context, each with its own hit/stand decisions and its own EV) that nothing in the existing architecture anticipates — recommend treating it as a distinct, later phase rather than bundling it with the initial Hit/Stand/Dealer-Reveal loop.
- **The custom evaluation layer for 2-deck Hold'em is the highest-complexity single item in the poker half of this milestone** and was already flagged in PROJECT.md; it blocks both the Five-of-a-Kind category and correctness of ordinary category counts (quads/boat/flush) once duplicates are possible, so it should be built and correctness-tested (against known combinatorial counts, similar to v1's "known-answer hand" testing approach) before the deck-count toggle is wired up to the Hold'em UI.
- **The deck-count toggle "enhances" almost everything** rather than gating it — each game's odds should be correct at 1 deck without the toggle existing at all, and the toggle's job is purely to swap which shoe-size the already-correct engine is fed. This mirrors v1's finding that presentation/toggle layers should be decoupled from correctness-critical engine work.

## MVP Definition

### Launch With (v2.0)

Minimum viable set to deliver "Blackjack as a second game" + "deck count as a first-class variable," matching PROJECT.md's stated v2.0 target features.

- [ ] Deck-aware shoe model generalized to support 1 or 2 decks, for both games — foundational, nothing else works without it
- [ ] Blackjack: random deal + manual picker for player hand and dealer up-card — reuses existing picker/deal UX
- [ ] Blackjack: player bust-if-hit probability, live-updating
- [ ] Blackjack: dealer final-outcome distribution by up-card (17/18/19/20/21/blackjack/bust), via Monte Carlo dealer playout
- [ ] Blackjack: win/push/lose probability + per-unit EV for Stand and for Hit (no bankroll/chips)
- [ ] Blackjack: dealer hole-card reveal (opponent-reveal-pattern reuse), recomputing odds live
- [ ] Blackjack: natural (blackjack) frequency readout, deck-count-dependent
- [ ] Deck-count toggle (1/2) for Blackjack, with live recompute of every above number
- [ ] Hold'em 2-deck mode: custom evaluation layer supporting duplicate rank+suit cards and correct comparison
- [ ] Hold'em 2-deck mode: Five of a Kind category added to the hand-category table, ranked between Royal Flush and Straight Flush
- [ ] Hold'em 2-deck mode: visual origin cue distinguishing duplicate-looking cards on the felt
- [ ] Deck-count toggle (1/2) spanning both games (single shared control point)

### Add After Validation (v2.x)

- [ ] Double Down as a live decision with its own EV — trigger: core Hit/Stand loop is proven and users start asking "what if I double"
- [ ] Deck-count before/after comparison callout (explicit delta highlighting on numbers that just changed) — trigger: user testing shows the raw toggle alone doesn't make the deck-count effect legible enough
- [ ] Split as a live decision (two-hand state model) — trigger: Double is proven and the two-hand data model is deliberately designed, not bolted on
- [ ] Surrender EV as a fourth descriptive action option — cheap once Stand/Hit/Double EV all exist; low priority since it's a rule-variant, not a core mechanic

### Future Consideration (v3+)

- [ ] Non-graded running/true-count readout tied to the odds panel — bundle conceptually with the already-deferred EDU-01/02/03 annotation layer; defer for the same reason (explanatory layer, not core mechanic)
- [ ] Exposing additional casino rule variants (S17/H17, DAS, resplit limits, payout ratio) as user settings — defer indefinitely; conflicts with keeping deck count as the sole explorable variable, same reasoning as the already-established "no exposed precision dial" anti-feature
- [ ] "Flush with two pair" 2-deck hand category — defer indefinitely (near-never-seen edge case, no evaluator library support, high implementation cost for negligible educational payoff)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Deck-aware shoe model (both games) | HIGH | MEDIUM | P1 |
| Blackjack dealer playout + final-outcome distribution | HIGH | MEDIUM-HIGH | P1 |
| Blackjack bust-if-hit probability | HIGH | LOW | P1 |
| Blackjack win/push/lose + EV (Stand/Hit) | HIGH | MEDIUM | P1 |
| Blackjack dealer hole-card reveal | MEDIUM-HIGH | LOW | P1 |
| Blackjack natural-frequency readout | MEDIUM | LOW | P1 |
| Deck-count toggle (both games) | HIGH | LOW-MEDIUM | P1 |
| Hold'em 2-deck custom evaluation layer | HIGH (blocking) | HIGH | P1 |
| Hold'em Five of a Kind category | HIGH | MEDIUM (given evaluation layer) | P1 |
| Duplicate-card visual origin cue | MEDIUM (trust/legibility) | LOW | P1 |
| Double Down EV | MEDIUM-HIGH | LOW-MEDIUM | P2 |
| Deck-count before/after delta callout | MEDIUM-HIGH | LOW-MEDIUM | P2 |
| Split EV (two-hand model) | MEDIUM | HIGH | P2/P3 |
| Surrender EV | LOW-MEDIUM | LOW | P3 |
| Non-graded count readout | LOW-MEDIUM (niche) | LOW | P3 |
| Full basic-strategy chart (anti-feature) | LOW (for this audience) | MEDIUM | Do not build |
| Card-counting drill/quiz trainer (anti-feature) | LOW (wrong genre) | HIGH | Do not build |
| Side bets (anti-feature) | LOW | MEDIUM | Do not build |
| Exposed rule-variant settings (anti-feature) | LOW | MEDIUM | Do not build |

**Priority key:**
- P1: Must have for v2.0 launch
- P2: Should have, add when possible (v2.x)
- P3: Nice to have, future consideration (v3+)

## Competitor Feature Analysis

| Feature | Wizard of Odds hand calculator | Best in Slot / GamblingCalc calculators | Card-counting trainers (bjcardcounter, True Count Trainer) | Our Approach |
|---------|-------------------------------|------------------------------------------|--------------------------------------------------------------|--------------|
| Input model | Player cards + dealer up-card + full ruleset dropdowns (decks 1-8, S17/H17, DAS, surrender) | Same, form-based | Live simulated shoe dealt at speed; user counts along | Same random-deal/manual-picker card model as existing poker game; deck count (1/2) is the only exposed rule knob |
| Core output | Recommended action + EV in $/unit per action | Recommended action + EV per action | Running/true count accuracy score, timed | Descriptive EV per available action (Stand/Hit, later Double/Split) — no recommended action shown |
| Computation method | Closed-form/tabulated (instant) | Closed-form/tabulated (instant) | N/A (drill, not a calculator) | Streaming Monte Carlo with visible convergence, consistent with the existing poker engine |
| Dealer outcome visibility | Available as a separate reference chart, not tied to the calculator's live inputs | Not typically shown | N/A | Live dealer final-outcome distribution tied to the current up-card, same UI pattern as poker's hand-category table |
| Deck-count effect visibility | Exposed as a dropdown input; effect on EV shown only if the user manually toggles and re-reads numbers | Same | Deck count affects true-count math only, not surfaced as an "effect" | Explicit deck-count toggle spanning both games with (v2.x) delta-highlighting on numbers that changed |
| Betting/wager concepts | EV expressed per unit bet, no actual wager UI | Same | Often includes bet-spread/bankroll advice | EV per unit, no wager UI, no bankroll, no bet-spread — strictly descriptive |
| Prescriptive strategy | Yes — this is the entire point of the tool | Yes | Yes (deviation quizzes) | No — explicitly avoided, consistent with the existing poker anti-GTO stance |

## Sources

- [Wizard of Odds: Why the number of decks matter in blackjack](https://wizardofodds.com/games/blackjack/why-number-of-decks-matter/) — MEDIUM-HIGH confidence, official/authoritative gambling-math reference site, directly fetched
- [Best in Slot: Blackjack Calculator](https://www.bestinslot.co/blackjack-calculator) — MEDIUM confidence, product page, corroborated by multiple similar calculators
- [The Probability Lab: Blackjack Basic Strategy Calculator](https://theprobabilitylab.com/blackjack) — MEDIUM confidence, corroborates EV-per-unit convention
- [GamblingCalc: Blackjack Basic Strategy Calculator](https://gamblingcalc.com/casino/blackjack-calculator/) — MEDIUM confidence
- [PokerNews: Free Online Blackjack Calculator](https://www.pokernews.com/casino/blackjack/free-blackjack-calculator.htm) — MEDIUM confidence, corroborating source
- [Using Probability Theory to Calculate the Bust Odds for Every Dealer-Hand in Blackjack — Medium](https://medium.com/@andrewruggero16/using-probability-theory-to-calculate-the-bust-odds-for-every-dealer-hand-in-blackjack-d19749b45cb8) — MEDIUM confidence, corroborates ~28.4% overall dealer bust rate and up-card-dependent bust variation
- [The statistics of Blackjack — Towards Data Science](https://towardsdatascience.com/the-statistics-of-blackjack-e3b5fc29e67d/) — MEDIUM confidence, corroborates win/tie/loss/natural distribution figures
- [Casino.org: This Is How The Number Of Decks Used Can Impact Your Blackjack Game](https://www.casino.org/blog/how-many-decks-in-blackjack/) — MEDIUM confidence, corroborates natural-blackjack-frequency deck-count delta (~4.83% 1-deck vs. ~4.78% 2-deck, converging toward ~4.75% at higher deck counts)
- [Card Counting Trainer](https://cardcountingtrainer.com/), [True Count Trainer](https://truecount.vip/), [Blackjack Trainer (bjcardcounter.com)](https://bjcardcounter.com/), [The Card Counting](https://thecardcounting.com/) — MEDIUM confidence, product pages surveyed to establish the "drill/quiz" genre as distinct from an odds-explorer interaction loop
- [Blackjack Side Bets — betandbeat.com](https://betandbeat.com/blackjack/side-bets/), [PokerNews: Blackjack Side Bets](https://www.pokernews.com/casino/blackjack/side-bets.htm) — MEDIUM confidence, corroborate side bets as high-house-edge wagers unrelated to core hand-value probability, supporting the anti-feature classification
- [Wizard of Vegas forum: Two-deck poker](https://wizardofvegas.com/forum/gambling/poker/799-two-deck-poker/) — MEDIUM confidence (community forum, but a well-established gambling-math authority site with contributions from recognized industry mathematicians); primary source for the 2-deck poker hand-ranking order (Royal Flush > Five of a Kind > Straight Flush > Four of a Kind > ...) and for "ties handled the same as normal poker"
- [Americas Cardroom: What is Five of a Kind?](https://www.americascardroom.eu/how-to/poker-terms/five-of-a-kind/), [Poker.org: Poker Hand Rankings](https://www.poker.org/poker-hands-ranking-chart/) — MEDIUM confidence, corroborate the general convention that Five of a Kind (however enabled — wild card or duplicate deck) ranks above a Straight Flush
- [PokerNews: Tied Poker Hands](https://www.pokernews.com/poker-hands/tied-poker-hands.htm), [Poker.com: Ties](https://poker.com/rules-of-poker/ties/) — HIGH confidence, standard rules reference confirming suits never break ties and identical-rank hands split, which grounds the "no new tie-break rule needed for duplicate cards" finding
- Existing project research (`.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md` from v1) — HIGH confidence, direct reuse of already-validated architectural patterns (worker/Comlink streaming, reveal mechanic, "re-condition don't reuse trials," anti-GTO/anti-precision-dial stances) extended into this milestone rather than re-derived

**Note on confidence:** Blackjack probability figures (dealer bust rate, natural-blackjack frequency, deck-count deltas) are corroborated across 3+ independent sources with consistent direction and close magnitude — MEDIUM-HIGH confidence. The 2-deck poker hand-ranking convention rests on a single (but credible, gambling-math-specialist) community forum thread rather than an official rulebook, since no official rulebook for 2-deck Hold'em exists — flagged MEDIUM confidence and should be treated as "the most defensible convention found," not an authoritative standard, in case a future contributor wants to revisit it.

---
*Feature research for: Monte Carlo Poker Simulator v2.0 (Blackjack & Multi-Deck milestone)*
*Researched: 2026-08-24*
