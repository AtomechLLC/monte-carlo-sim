# Domain Pitfalls

**Domain:** Browser-based Monte Carlo Texas Hold'em odds simulator (graphical, client-side, live convergence, street rewind, opponent reveal)
**Researched:** 2026-08-23

## Critical Pitfalls

Mistakes that cause rewitten evaluators, wrong-answer bugs users will catch immediately, or silently-wrong odds (the worst outcome for a tool whose entire value proposition is "trustworthy probability").

### 1. Hand evaluator correctness bugs (kickers, wheel straight, category precedence, ties)

**What goes wrong:** The 7-card (2 hole + 5 board) best-hand evaluator gets a rule wrong: kickers aren't compared after the primary category ties (e.g., two players both have a pair of kings but the evaluator declares a tie without comparing the side cards); the A-2-3-4-5 "wheel" straight is missed because the evaluator only checks descending runs and treats the Ace as high-only; straight vs. flush vs. straight-flush precedence is mis-ordered; two genuinely equal hands aren't recognized as a split/tie.

**Why it happens:** Naive implementations compare hands by "category rank" alone and forget the tie-break is a second, ordered comparison (category → primary ranks → kickers, in strict order, stopping at the first difference). The wheel is a special case that breaks any "check for 5 consecutive ranks" logic written with the naive assumption that straights are always `high-4` through `high`. Evaluating 7 cards requires checking the best of all C(7,5)=21 five-card combinations (or a fast bit-mask/lookup-table method) — evaluators that only check "the most obvious 5 cards" silently return a hand that isn't actually the best available.

**Consequences:** Wrong winner declared, odds that don't match any external calculator (this will be the first thing a poker-literate user tests, since it's trivially checkable), and win/tie/lose percentages that don't reconcile with hand-category percentages. This is the single most damaging class of bug for a tool whose entire premise is "trust the number."

**Prevention:**
- Build (or adopt) a hand evaluator that operates on all 7 cards and finds the true best 5-card hand, not a hand assembled by "obvious" heuristics.
- Encode tie-breaking as a strict lexicographic comparison: `[category, primaryRanks..., kickers...]`, compared element by element.
- Explicitly special-case the wheel (A-2-3-4-5): when checking straights, treat Ace as both `14` and `1`.
- Write the evaluator's test suite *first*, from a known-correct reference (hand rankings tables, published poker odds, or a mature open-source evaluator's test fixtures) before writing simulation code that depends on it. Include explicit wheel, split-pot, and kicker-chain test cases (e.g., quad kings with different 5th kicker; identical two-pair with different kicker; identical straight; identical flush by suit-independent rank).
- Cross-check against known preflop equities (e.g., AA is ~85% vs a random hand heads-up, pocket pairs vs two overcards ~50/50 "coin flip") as a smoke test — if these don't come out approximately right, something upstream (evaluator or sampling) is broken.

**Detection (warning signs):**
- Hand-category probabilities don't sum to ~100% (see Pitfall #2).
- Manually constructed "obvious" scenarios (deal yourself a royal flush via the manual card picker) don't show 100% royal flush.
- Two hands that are visibly identical in rank (e.g., both hero and an opponent show the same straight) aren't reported as a tie.
- Even mature open-source JS poker hand evaluators have shipped exactly these bugs — e.g., `poker-apprentice/hand-evaluator` had a documented straight-flush detection bug in 6+ card hands where the straight flush's low card shared rank with another card, causing it to report a plain flush instead. This is evidence the bug class is real and easy to introduce, not a hypothetical.

**Phase:** Core hand evaluator must be built and unit-tested before any simulation, UI, or animation work depends on it — this is foundational, not incremental.

---

### 2. Hand-category odds don't sum to 100% (mutually-exclusive category confusion)

**What goes wrong:** The "probability of ending with each hand category" table is built by checking "does this hand contain three of a kind?" for every trial, rather than "what is this hand's single best category?" A hand that ends up a full house also technically "contains" three of a kind and a pair — if trials are bucketed by "contains X" instead of "best category is X," the reported probabilities overlap and sum to well over 100%, which is a very legible bug the moment a user adds up the column.

**Why it happens:** It's a natural but wrong mental model to check hand strength using a series of independent boolean tests ("has pair? has trips? has straight?") rather than computing one canonical best-category classification per trial and incrementing exactly one bucket.

**Consequences:** The signature feature of the tool (full hand-category odds table) visibly fails a sum-to-100% sanity check, undermining trust in every other number on screen.

**Prevention:** Every trial produces exactly one evaluated best-hand result with exactly one category; increment exactly one bucket per trial. Add a running assertion/dev-mode check that category percentages sum to ~100% (within floating point / rounding tolerance) and fail loudly in development if not.

**Detection:** Sum the displayed hand-category column; it should equal 100% (or very close, given rounding) at every trial count.

**Phase:** Same phase as the hand evaluator / simulation engine — this is a design decision about how simulation results are aggregated, not just a display concern.

---

### 3. Win/tie/lose bucketing errors (>= vs > comparisons, multi-way ties)

**What goes wrong:** With 4 players in every trial (hero + 3 opponents), "win" must mean hero's hand is *strictly* better than all three opponents; "tie" means hero shares the best hand with at least one opponent (not necessarily all three); "lose" means at least one opponent beats hero. A common bug is using `>=` instead of `>` when comparing hero to the best opponent hand, silently counting ties as wins (or vice versa), or only detecting a tie when *all four* players are equal instead of when hero shares the top rank with any subset of opponents.

**Why it happens:** Tie handling is the edge case developers reason about last, and with 3 opponents there are multiple possible tie shapes (hero ties with 1, 2, or 3 opponents; two opponents tie each other and beat hero; etc.) that a simple "compare hero to the single best opponent" reduction can get wrong if not careful about strict vs. non-strict comparisons.

**Consequences:** Win + tie + lose don't sum to 100%, or ties get folded into wins/losses, quietly overstating or understating hero's real equity — exactly the number this tool exists to teach correctly.

**Prevention:** Compute the best rank among all 4 hands each trial. Hero wins iff hero's rank is strictly the unique maximum. Hero ties iff hero's rank equals the maximum and at least one other player also equals it. Hero loses otherwise. Unit test all tie-shape permutations (2-way, 3-way, 4-way ties) with constructed hands, not just random sampling.

**Detection:** Win% + Tie% + Lose% must sum to 100% at every trial count; add a dev-mode assertion.

**Phase:** Simulation engine phase, alongside the hand evaluator.

---

### 4. Sampling bias from incomplete deck conditioning (known cards not removed before dealing unknowns)

**What goes wrong:** When simulating the remaining unknown cards (undealt board cards, opponents' hidden hole cards), the simulator must draw only from the deck of cards *not already visible anywhere* — not in hero's hand, not on the board, not in any revealed opponent's hand. A common bug: the "remaining deck" used to deal random opponent hands is built once at hand start and not updated as the board advances (street cards aren't removed) or as opponents are revealed (revealed cards leak back into the sampling pool for other opponents), producing biased odds and, occasionally, a physically impossible trial where the same card is dealt to two hands (or appears in both a hand and the board).

**Why it happens:** State touching "what cards are currently known" is scattered across hero's hand, the community board, and N opponent reveal flags. If the deck-of-remaining-cards isn't recomputed from a single source of truth every time any of these change, it drifts out of sync.

**Consequences:** Systematically wrong odds (not just noisy — biased in a fixed direction), and in the worst case, duplicate-card trials that a careful user could catch by noticing an "impossible" board/hand combination reported in a debug view.

**Prevention:**
- Maintain one authoritative "known cards" set (hero hole cards + all dealt board cards + any revealed opponent hole cards) and derive the sampling deck as `full 52-card deck minus known cards` fresh (or reactively) every time any known-card state changes — never cache a stale deck across a street advance or reveal action.
- Use a proper Fisher-Yates shuffle (or draw-without-replacement) over that derived deck for each trial — do **not** use `array.sort(() => Math.random() - 0.5)` as a shuffle; it is a well-documented non-uniform shuffle (`Array.prototype.sort` does not call the comparator a uniform number of times per element, so certain permutations come up far more often than others). This produces subtly-wrong long-run frequencies that are hard to notice by eye but are real statistical bias.
- Add an assertion in development builds that no card appears twice across hero + board + all opponents in any single trial.

**Detection:** Known preflop equities computed by the simulator drift from published references by more than sampling noise would explain; or a debug/logging mode reveals a duplicate card in a trial.

**Phase:** Simulation engine / dealing core — must be correct before the reveal mechanic (Pitfall #5) or street navigation (Pitfall #6) are layered on top, since both depend on deck conditioning being airtight.

---

### 5. Reveal mechanic doesn't correctly re-condition remaining simulation (stale opponent randomness)

**What goes wrong:** The reveal mechanic ("reveal any opponent's hole cards — revealed cards become known information and all odds recalculate") is the project's specific educational payoff, and it's also the easiest place to reintroduce Pitfall #4's bias in a subtler form: after a reveal, the revealed opponent must be simulated with their *actual fixed cards* every trial (not re-randomized), while the *other, still-anonymous* opponents must be re-randomized from a deck that now excludes the revealed cards. A common bug is either (a) continuing to treat the revealed opponent as random in the simulation loop even though the UI shows their cards face-up, or (b) correctly fixing the revealed opponent's cards but forgetting to exclude those specific cards from the pool used to deal the *other* opponents' random hands.

**Why it happens:** Reveal is a state transition that has to flow through to the simulation's per-player "is this hand fixed or random" flag *and* through to the shared deck-of-unknowns at the same time. It's easy to update one and miss the other, especially if the simulation was originally written assuming "all opponents are always random."

**Consequences:** Revealing a card visibly changes the table display but the odds either don't move, move incorrectly, or (if the revealed cards leak into other opponents' pools) produce biased results for everyone else at the table — directly breaking the feature the project calls out as its educational core ("the math must respect that").

**Prevention:** Model each opponent's hand explicitly as either `unknown (random, drawn from shared pool each trial)` or `known (fixed for all trials)`. On reveal, flip that opponent to `known` with their actual cards, remove those specific cards from the shared unknown-pool permanently (until un-revealed, if that's supported), and re-run/restart the simulation from trial zero using the updated conditioning. Write an integration test: reveal an opponent, verify their cards no longer appear in the deck used to deal remaining opponents' hands.

**Detection:** After revealing an opponent's cards, spot-check that no other opponent's simulated hands ever contain the revealed cards (debug/log mode), and that the revealed opponent's own win/tie/lose odds now reflect their *actual* hand strength rather than converging toward the "any two cards" average.

**Phase:** Dedicated to the reveal feature specifically, built and tested after the core dealing/simulation engine (Pitfall #4) is solid — this is exactly the kind of feature that "seems to work" in a quick manual test but is wrong under the hood.

---

## Moderate Pitfalls

### 1. Displaying noisy early-trial percentages as if they were converged truth

**What goes wrong:** Monte Carlo estimates are noisy at low trial counts and only tighten as trials accumulate (standard error shrinks roughly with 1/√n). If the UI shows raw percentages from the first few hundred trials with the same visual weight/precision as after 50,000+ trials, numbers will visibly jitter and can look "buggy" or arbitrary, undermining trust even when the underlying math is correct. This is compounded by the project's explicit goal of showing convergence live — if convergence isn't visually communicated as "settling," it just looks like noise.

**Why it happens:** It's tempting to just bind the UI directly to "wins so far / trials so far" and update every frame. Developers underestimate how jittery small-sample proportions look (e.g., 3/10 vs 4/10 is a 10-point swing) and don't design for it.

**Prevention:**
- Where the number of unknown cards is small (turn or river with only 1-2 unknown community cards and no unknown opponents left, or few opponents/board cards left), prefer **exact enumeration** over sampling — poker odds calculators commonly switch to enumerating every remaining combination once the space is small enough (e.g., a single unknown card is fully enumerable; two unknown cards is on the order of ~1,000 combinations), which removes sampling noise entirely rather than trying to converge it away. This directly serves the "live convergence" requirement in a smarter way: early streets show visible Monte Carlo settling, later streets can show exact answers.
- When sampling is used (preflop / flop with fully random opponents), throttle/smooth the displayed number (e.g., update the visible percentage a fixed number of times per second rather than every trial, and consider light smoothing) so users perceive "settling" rather than flicker.
- Consider surfacing the trial count prominently (this project explicitly wants the Monte Carlo method itself to be visible — trial count is part of the pedagogy, not something to hide) so users understand *why* early numbers move.

**Detection:** Watch the displayed percentage in the first second of a fresh simulation — if it swings by many points frame-to-frame in a way that looks random rather than "settling," this needs throttling/smoothing or a switch to exact enumeration.

**Phase:** Simulation engine phase for the enumeration/sampling split; UI/rendering phase for throttling and trial-count display.

---

### 2. Main-thread blocking from running trials synchronously

**What goes wrong:** Running thousands of Monte Carlo trials in a tight synchronous loop on the main JS thread freezes the UI — card animations stutter or stop, the re-deal button feels unresponsive, and street-advance/rewind interactions lag. This directly conflicts with the "live convergence" and animated-table requirements, which both depend on a responsive main thread at 60fps.

**Why it happens:** It's the natural first implementation (a `for` loop calling the evaluator N times) and it "works" in isolated testing before animation and interactivity are layered on top, so the blocking only becomes obvious once both are combined — often late.

**Prevention:** Run the simulation loop in a Web Worker (the project's own constraints already anticipate this — "likely Web Worker territory to keep the UI responsive"). Keep the main thread free for rendering/animation and input handling only. Build the worker boundary early, not as a later optimization pass, since retrofitting a synchronous engine into a worker later touches most of the simulation code.

**Detection:** Frame drops or unresponsive UI during simulation, visible via browser performance profiling (long tasks on the main thread) whenever trials are running.

**Phase:** Architecture must decide on Web Worker boundary in the simulation engine phase, before UI/animation work builds assumptions on top of a synchronous engine.

---

### 3. Web Worker message overhead from per-trial or per-card postMessage calls

**What goes wrong:** If the worker posts a message back to the main thread for every individual trial (or every card dealt within a trial), the overhead of `postMessage` itself becomes the bottleneck rather than the simulation math. Structured-clone serialization cost scales with message size and frequency; many small messages per second can visibly compete with rendering for main-thread time, defeating the purpose of moving work off-thread.

**Why it happens:** It's the simplest mental model ("worker computes one trial, tells main thread the result") but doesn't scale — thousands of trials per second means thousands of postMessage calls per second.

**Prevention:** Batch results in the worker and post aggregated counts (running totals per hand category, per win/tie/lose bucket) on a fixed cadence (e.g., a few times per second, or every N thousand trials) rather than per trial. Keep posted payloads small (plain counters/typed arrays, not full per-trial card arrays) — payloads well under the point where postMessage cost becomes noticeable (roughly tens of thousands of simple entries) keep this well under 16ms per message; batching also naturally produces the throttled, "settling" UI update cadence needed for Pitfall #1.

**Detection:** Profile worker-to-main message frequency and payload size; if the main thread shows many small `message` event handlers firing per second during simulation, this needs batching.

**Phase:** Simulation engine / worker architecture phase.

---

### 4. Worker lifecycle races: stale results from a superseded simulation overwrite newer results

**What goes wrong:** When the user advances/rewinds a street, re-deals, or reveals an opponent, a *new* simulation run needs to start against the updated known-card state. If the *previous* run's worker isn't stopped/ignored, its in-flight batched results can arrive after the new run has started and briefly (or permanently, if the race is unlucky) overwrite the new, correct numbers with stale ones from a scenario that no longer exists.

**Why it happens:** Async message-passing between main thread and worker has no inherent ordering guarantee relative to user-triggered state changes; if the code just always applies whatever result message arrives next, without checking it belongs to the current scenario, stale data can win the race.

**Prevention:** Tag every simulation run with a generation/request ID; when starting a new run (on street change, rewind, re-deal, or reveal), increment the ID and either terminate/restart the worker or have it check "is this still the current generation" before continuing to compute, and have the main thread discard/ignore any incoming result message whose generation ID doesn't match the current one.

**Detection:** Rapidly triggering re-deal, street-advance, or reveal in succession causes odds to briefly flash to a value that doesn't match the currently-displayed cards.

**Phase:** Simulation engine / worker architecture phase, and again when building street navigation and reveal (any feature that can invalidate an in-flight simulation).

---

### 5. Animation vs. simulation-state timing conflicts (odds spoil or contradict the still-animating cards)

**What goes wrong:** The worker can finish a full simulation and produce final numbers essentially instantly (well before a card-dealing/flipping animation has visually finished), or conversely the true "known state" changes (street advances) before the animation showing that change has played. If the UI binds the odds display directly to the underlying data the moment it changes, percentages can update — or even reveal outcome information — before the corresponding card animation shows the user why, breaking the intended cause → animation → effect narrative ("watch how each new piece of information reshapes the numbers").

**Why it happens:** Simulation state and animation state are naturally two separate systems (a data model and a rendering/animation layer) that are easy to wire directly together without an explicit sequencing/queue step between them.

**Prevention:** Treat "true simulation state has updated" and "UI has finished presenting that update" as distinct, sequenced steps — e.g., a small state machine or animation queue where the odds display only starts animating toward new values once the relevant card-reveal animation has completed (or the two are choreographed together deliberately, such as odds easing toward the new number in sync with the card flip). Don't let a fast worker response race ahead of a slower CSS/canvas animation.

**Detection:** Numbers change on screen before the card that explains the change has visually flipped/appeared; or numbers appear to "jump" without any visible card change (e.g., due to reaching a new trial-count batch) at moments where nothing conceptually changed.

**Phase:** UI/animation integration phase, after both the simulation engine and the animation system exist independently — this is specifically an integration-phase risk.

---

### 6. Rewind/replay state bugs: conflating "actual dealt history" with "ephemeral simulation estimate"

**What goes wrong:** Rewinding to an earlier street and re-examining it must show the odds *as they were* for that street's known-card state, computed fresh (or restored) for that state — not accidentally carry forward information from a later street, and not accidentally re-randomize the actual dealt board/hole cards themselves (which must stay fixed — only the "what's left to estimate" is what re-simulates). A common bug is treating the entire hand as one mutable blob of "current cards" rather than separating an immutable, ordered history of *actually dealt* cards (hero hand, flop, turn, river, any reveals) from the *simulation* that estimates outcomes given whatever subset of that history is "revealed" at the currently-viewed street.

**Why it happens:** It's simpler to model "the current game state" as a single mutable object than to model an append-only history plus a "which point in history am I viewing" cursor, but the simpler model breaks as soon as rewind is required, because rewinding means presenting a *past* state without destroying the *future* state the user might advance back into.

**Prevention:** Model the hand as an immutable, ordered record of dealt events (hero cards, flop, turn, river, opponent reveals, each timestamped/ordered) plus a "current street cursor." Advancing/rewinding moves the cursor; it never mutates or re-deals already-recorded history (re-deal is a distinct, explicit action that starts an entirely new hand/history). The simulation for "what happens from here" is always re-derived from the cursor position, never cached across cursor moves without invalidation (ties into Pitfall #4 above).

**Detection:** Rewind to preflop, then advance forward again without touching the manual picker or re-deal — the flop/turn/river should be *identical* to what was shown the first time (same cards, same order). If they differ, history and simulation state are conflated.

**Phase:** Core state/data-model design, ideally decided before street navigation and rewind are implemented (retrofitting an immutable-history model onto a "just mutate current state" implementation is expensive).

---

## Minor Pitfalls

### 1. Scope creep toward a full poker game

**What goes wrong:** Betting/chips, pot management, AI opponent decision-making, hand-history replay libraries, or multiplayer are all natural-feeling additions once the table looks and feels like real poker — but the project has explicitly scoped these out as out of the tool's learning goal. Each one adds substantial complexity (bankroll state, betting round logic, decision AI, network sync) that doesn't serve "probability made visible" and risks derailing a scoped odds-explorer into an unfinished poker game.

**Why it happens:** A polished, casino-style visual table naturally invites "just add betting" as the next obvious feature, especially once the core loop (deal → watch odds → advance streets) feels satisfying and developers want to extend it.

**Prevention:** Treat the Out of Scope list in the project's own scoping document as a standing guardrail through planning and implementation, not just an initial note — revisit it explicitly whenever a "wouldn't it be cool if..." feature is proposed. Anonymous opponents remain card holders for equity math only, never decision agents.

**Detection:** Any proposed feature that requires tracking chips/pot size, opponent betting decisions, or network state is a signal to re-check scope.

**Phase:** Ongoing guardrail across all phases, worth an explicit callout at roadmap/planning time and at any milestone re-scoping.

---

### 2. Investing in animation/visual polish before simulation correctness is validated

**What goes wrong:** Because "visual craft is part of the deliverable, not a skin," there's a temptation to build detailed card art, dealing/flip animations, and table polish early — before the hand evaluator and simulation engine (the parts that are actually hard to get *correct*, per the Critical Pitfalls above) are validated. If evaluator bugs are found late, after animation and UI are built around specific data shapes, fixing them costs more and risks UI churn.

**Why it happens:** Visual work is more immediately gratifying and demoable than a correctness-focused evaluator with a big unit test suite; it's easy to sequence work in the order that "feels productive" rather than the order that retires the highest-risk unknowns first.

**Prevention:** Sequence the roadmap so hand evaluation + simulation correctness (with a real test suite, verified against known reference odds) lands before or in parallel with — but validated ahead of — heavy animation investment. Build a minimal/placeholder UI first to validate the numbers, then layer animation on top of a proven-correct data layer.

**Detection:** If animation/visual work is substantially ahead of a passing evaluator test suite at any point in the roadmap, that's a sequencing risk worth flagging.

**Phase:** Roadmap sequencing decision — evaluator/simulation correctness should be an early phase; full table visual polish can follow once numbers are trustworthy.

---

### 3. Assuming `Math.random()` behavior is good enough without checking what "randomness" needs to mean for this tool

**What goes wrong:** `Math.random()` is not seedable and its underlying algorithm is implementation-defined per browser engine, which is usually fine for "just deal random cards" but becomes a design question the moment reproducibility matters (e.g., if a future "share this scenario" or debug/test-fixture feature is wanted, or if trials need to be deterministic for automated testing of the simulation engine itself).

**Why it happens:** `Math.random()` "just works" for casual dealing, so the question of seeding/determinism often isn't considered until a testing or reproducibility need arises later, at which point the RNG usage may be scattered throughout the codebase.

**Prevention:** For actual card dealing (re-deal / random opponent hands), `Math.random()` combined with a proper Fisher-Yates shuffle is statistically fine — the real risk is the shuffle algorithm (Pitfall #4 above), not `Math.random()`'s quality itself. For the simulation engine's internal trials, consider using a small seedable PRNG (e.g., a mulberry32/sfc32-style generator) so simulation runs can be made deterministic for unit testing the engine, independent of whatever the user-facing dealing RNG does.

**Detection:** N/A directly visible to users; relevant mainly for engine testability. Absence of deterministic tests for the simulation engine is the warning sign.

**Phase:** Simulation engine implementation phase, as a testing-infrastructure decision rather than a user-facing one.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|-----------------|------------|
| Hand evaluator (core) | Kicker/wheel/tie bugs; category-overlap in odds table (Critical #1, #2) | Build reference-verified test suite first; strict lexicographic tie-break comparison; explicit wheel handling |
| Dealing / deck & RNG core | Deck conditioning drift, duplicate-card trials, biased shuffle (Critical #4) | Single source of truth for "known cards"; real Fisher-Yates; dev-mode duplicate-card assertions |
| Simulation engine (Web Worker) | Main-thread blocking, message overhead, worker races (Moderate #2, #3, #4) | Worker boundary from the start; batch results; generation IDs to discard stale results |
| Simulation engine — win/tie/lose logic | Strict vs. non-strict comparison bugs in multi-way ties (Critical #3) | Compute max rank across all 4 hands; test all tie-shape permutations |
| Live convergence display / UX | Noisy early estimates shown as truth (Moderate #1) | Exact enumeration when few cards remain unknown; throttle/smooth sampled updates; surface trial count |
| Reveal opponent feature | Stale randomness / leaked cards after reveal (Critical #5) | Explicit known/unknown flag per opponent; remove revealed cards from shared pool; restart simulation on reveal |
| Street navigation (advance/rewind) | History/simulation state conflation (Moderate #6) | Immutable ordered history + cursor model, decided before implementation |
| UI/animation integration | Odds updating ahead of or out of sync with card animations (Moderate #5) | Sequence "state updated" vs. "presentation finished" explicitly; don't bind display directly to raw worker output |
| Roadmap/planning (ongoing) | Scope creep toward full poker game; animation-before-correctness sequencing (Minor #1, #2) | Treat Out of Scope list as a standing guardrail; sequence evaluator correctness ahead of visual polish |

## Sources

- [poker-apprentice/hand-evaluator (GitHub)](https://github.com/poker-apprentice/hand-evaluator) — documents a real straight-flush detection bug in 6+ card evaluation, cited as concrete evidence for Critical Pitfall #1. MEDIUM confidence (single source, but a specific documented fix, not speculation).
- [Understanding Monte Carlo Sampling in HRC — HoldemResources.net](https://www.holdemresources.net/docs/monte-carlo-sampling/) — describes deck conditioning (removing known/dead cards), Fisher-Yates shuffling per runout, and exact-enumeration vs. sampling switch based on remaining unknown cards. MEDIUM confidence (single vendor doc, but consistent with general poker-calculator practice).
- [pokeroddscalc.org](https://pokeroddscalc.org/) — corroborates automatic dead-card removal and enumeration-when-small-enough approach. MEDIUM confidence.
- ["Estimating the outcome of a Texas hold'em game using Monte Carlo simulation" — Petros Demetrakopoulos, Medium](https://petrosdemetrakopoulos.medium.com/estimating-the-outcome-of-a-texas-holdem-game-using-monte-carlo-simulation-1be35be29036) — general approach reference for exact enumeration vs. Monte Carlo by street. LOW-MEDIUM confidence (blog post, not official docs).
- ["High-performance Web Worker messages" — Nolan Lawson](https://nolanlawson.com/2016/02/29/high-performance-web-worker-messages/) and [Smashing Magazine — Web Workers for Multithreading](https://www.smashingmagazine.com/2023/04/potential-web-workers-multithreading-web/) — postMessage overhead thresholds and batching guidance for Moderate Pitfalls #2/#3. MEDIUM confidence (established web performance references, cross-corroborated by two independent sources).
- [MDN: DedicatedWorkerGlobalScope.postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/postMessage) — official reference for structured clone / transferable object behavior. HIGH confidence (official docs).
- ["How to Shuffle an Array Using JavaScript" (uniform/deterministic/crypto-safe) — TheLinuxCode](https://thelinuxcode.com/how-to-shuffle-an-array-using-javascript-uniform-deterministic-and-crypto-safe/) and [javascript.info: Shuffle an array](https://javascript.info/task/shuffle) — corroborate that `sort()` with a random comparator is a non-uniform, biased shuffle and Fisher-Yates is the correct approach. MEDIUM-HIGH confidence (two independent, technically detailed sources agreeing).
- [tc39/proposal-seeded-random (GitHub)](https://github.com/tc39/proposal-seeded-random) — confirms `Math.random()` is intentionally unseedable per spec, relevant to Minor Pitfall #3. HIGH confidence (official TC39 proposal repo).
- [Wayline — "Just One More Feature..." / Feature Creep: The Silent Killer of Indie Game Dreams](https://www.wayline.io/blog/scope-creep-buried-my-first-game) — general scope-creep pattern and prevention (MVP discipline, explicit scope guardrails) applied to Minor Pitfall #1. LOW-MEDIUM confidence (blog/opinion content, used for general pattern not domain-specific fact).
- General poker rules references for kicker/wheel/split-pot mechanics (used to verify Critical Pitfall #1's domain facts): [PokerNews — Tied Hands & Split Pots](https://www.pokernews.com/poker-hands/tied-poker-hands.htm), [CardPlayer — Kicker in Poker](https://www.cardplayer.com/rules-of-poker/glossary/kicker-in-poker). HIGH confidence (standard, uncontested poker rules, corroborated across multiple poker-education sites).
