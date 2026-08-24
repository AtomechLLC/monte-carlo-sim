# Pitfalls Research: v2.0 Blackjack & Multi-Deck

**Domain:** Adding a second game (Blackjack) and multi-deck shoe support to an existing single-deck Texas Hold'em Monte Carlo engine (React 19 / TypeScript / Zustand / Comlink Web Worker, 216 passing tests)
**Researched:** 2026-08-24
**Confidence:** HIGH — every codebase-specific claim below is backed by direct inspection of the actual `src/` source and `node_modules/@poker-apprentice/*` package internals, plus one empirical spike test run against the installed evaluator (see Pitfall 7). General Blackjack-rule and deck-penetration claims are corroborated by independent community sources (MEDIUM, cited).

<scope_note>
This research assumes the milestone's two additions land on top of the **exact current architecture** verified in this session:
- Cards are the bare template-literal string type `Card = \`${Rank}${Suit}\`` from `@poker-apprentice/types` (e.g. `'Ah'`) — **no built-in concept of "which physical copy" a card is.**
- `deriveConditionedState(runout, street, revealedMask)` in `src/engine/conditioning.ts` is the sole D-02 guard against peeking at hidden cards; `ConditionedState`/`runTrials` in `src/engine/equity.ts` and the validation formula in `src/worker/simulationApi.ts` are all shaped exclusively around single-deck Hold'em (0-5 known board cards, 0-3 known opponent holes, `FULL_DECK.length === 52`).
- `oddsStore`'s cache key is `knowledgeKey(street, revealedMask) = "${street}|${revealedMask}"`; `gameStore`'s state is `runout / street / revealedMask / dealNonce`; `pickerStore`'s duplicate guard and `CardPicker.tsx`'s disabled-rendering are both `Set<Card>`/value-equality based.
- `HandStrength` (from `@poker-apprentice/types`) has exactly 10 values (`HighCard=0` … `RoyalFlush=9`); `CATEGORY_COUNT=10` and `CATEGORY_LABELS` in `src/ui/categoryLabels.ts` hardcode that shape.
</scope_note>

## Critical Pitfalls

### Pitfall 1: The with-replacement shortcut erases the entire deck-count effect

**What goes wrong:**
A Blackjack trial loop draws each new card by picking a uniformly random rank (or rank+suit) independent of what's already been dealt — effectively an "infinite shoe" approximation — instead of drawing without replacement from an explicit, shrinking pool sized `52 * deckCount` minus known/dealt cards. The simulation still produces plausible-looking bust%/dealer-outcome numbers, but **1-deck and 2-deck shoes converge to statistically identical odds**, because with-replacement sampling is mathematically equivalent to an infinite deck regardless of the `deckCount` parameter fed into it.

**Why it happens:**
It's the easy path: hardcoding "13 ranks, roughly 4-per-rank probability" (or reusing `Math.random()` per card) requires no pool-tracking state, is trivial to parallelize per-trial, and reads correct in isolation — nobody manually re-derives probability by hand to notice the deck-count knob is a no-op. It is also *faster* to write than plumbing a real shoe array through the per-trial draw, so under time pressure it looks like a reasonable simplification rather than a correctness bug. This project's own existing Hold'em engine never had this temptation because `createDrawer`/`drawN` (partial Fisher-Yates over an explicit `remainingDeck` array, `src/engine/rng.ts`) was already the established pattern — but Blackjack is new code, and "just pick a random card" is the naive default a fresh implementation reaches for first.

**How to avoid:**
Build the Blackjack shoe the same way Hold'em's `remainingDeck` is built: an explicit array (`buildShoe(deckCount)` → `52 * deckCount` physical-card entries, see Pitfall 6 for why these must NOT be bare `Card` strings), and draw every card — for the player, the dealer's up card, the dealer's hidden hole card, and every hit — via `createDrawer`/`drawN`-style sampling without replacement over that same shrinking pool. Never introduce a second "just pick a random rank" code path anywhere in the Blackjack trial loop, including for `deckCount === 1`.

**Warning signs:**
- A quick manual check — run the same conditioning scenario (e.g., player shows two 5s, dealer up-card is a 6) at `deckCount: 1` vs `deckCount: 2` and the reported bust%/outcome distribution match to within Monte Carlo noise. They should differ measurably, especially for scenarios where several cards of one rank are already visible.
- No test in the suite asserts `remainingShoe.filter(isRank(R)).length === 4 * deckCount - alreadyDealtOfRank(R)` for a specific rank after several cards are dealt.
- The trial loop's draw function takes no pool/array argument at all — a static-analysis smell that it isn't consuming a shrinking deck.

**Phase to address:** Blackjack engine phase (before any UI work) — this must be caught by a dedicated regression test asserting 1-deck vs. 2-deck odds *differ* for a fixed conditioning scenario, not just that both "look plausible" independently.

---

### Pitfall 2: Soft-total (Ace) valuation is only checked once, not re-derived after every draw

**What goes wrong:**
The dealer (or player) hand's "soft" status is computed once at the initial two-card deal and never re-evaluated as more cards are drawn, or is detected by "does this hand contain an Ace" rather than "is an Ace currently being counted as 11 without busting." Both produce wrong hit/stand decisions: a hand like `A, 6, 10` totals 17 but the Ace **must** count as 1 (17 total; counting it as 11 would bust at 27) — this is a **hard** 17 despite containing an Ace, and under H17 the dealer must stand on it exactly as it would on a hard 17, not hit it as if it were soft.

**Why it happens:** Multiple Aces compound the bug: `A, A, 9` is soft 21 (11+1+9) — but if the demotion logic isn't a loop ("while total > 21 and at least one Ace is still counted as 11, demote one Ace from 11 to 1"), a hand-rolled implementation that only ever demotes one Ace, or only checks softness at deal time before any hits, will silently misclassify hands as more cards land on them.

**How to avoid:** Compute hand total via: sum all cards with Aces counted as 11, then while `total > 21` and at least one Ace is still "soft" (counted as 11), subtract 10 and decrement the soft-Ace count. Recompute this from scratch after **every** card added (initial deal AND every hit) — never cache a "this hand is soft" boolean set once at deal time.

**Warning signs:** A test with a dealer hand `[6, 6]` (hard 12) that hits an Ace (now `6,6,A` = soft 19, then correctly re-hardens if a further card would bust it as soft) is the canonical trap case — if the codebase has no test shaped like this, the soft-recompute-on-every-draw behavior is unverified.

**Phase to address:** Blackjack engine phase — core hand-total logic, unit-tested with exact-value cases (mirrors this project's existing pattern of exact-value evaluator tests for the poker engine, per `CLAUDE.md`'s testing guidance).

---

### Pitfall 3: S17/H17 rule implemented against the hard total only

**What goes wrong:** The dealer's stand/hit rule is implemented as `if (total >= 17) stand`, ignoring softness entirely. This is silently correct for S17 tables (dealer always stands on any 17+) but silently WRONG the moment H17 is offered as a variant — a dealer holding soft 17 (e.g., `A, 6`) must hit under H17 but this check would make it stand.

**Why it happens:** S17 and H17 differ only in a single edge case (soft 17), which is easy to overlook if the dealer-play function is written and tested only against hard-total examples, and the H17 branch is bolted on later without a matching soft-17 test.

**How to avoid:** The dealer's decision function must take the rule variant as a parameter and branch explicitly: `hit if total < 17, OR (variant === 'H17' AND total === 17 AND isSoft)`. Write both an S17 and an H17 exact-value test for the specific soft-17 hand.

**Warning signs:** Only one dealer-rule test exists, or it uses a hard-17 hand for both S17 and H17 cases (making the two variants indistinguishable by the test suite).

**Phase to address:** Blackjack engine phase, same unit as Pitfall 2 (soft-total logic is the shared dependency both rules need correct).

---

### Pitfall 4: Natural blackjack conflated with any 21, and EV computed without payout weighting

**What goes wrong:** Two related bugs: (a) treating any hand that totals 21 as "blackjack" instead of checking the specific rule (exactly 2 cards, dealt as the *initial* hand, totaling 21) — a 21 reached via a hit is a plain 21, not a natural, and does not share its push/payout behavior; (b) computing the milestone's stated "EV" metric as if every win pays 1:1, silently ignoring that a natural blackjack conventionally pays 3:2 (and that a player natural vs. a non-natural dealer 21 is a win, while natural vs. natural is a push, not a "tie" in the poker sense).

**Why it happens:** "21 is 21" looks like a reasonable simplification, and this project's existing win/tie/lose model (built for zero-sum poker equity, no payout structure) has no precedent for a payout-weighted EV — it's tempting to reuse the exact same `outcomes: {win, tie, lose}` shape from `src/worker/protocol.ts`/`ProgressSnapshot` unchanged and call the resulting win-rate "EV," which is not the same number.

**How to avoid:** Check `cards.length === 2 AND total === 21 AND this is the initial deal` (not any post-hit state) for "natural." Explicitly decide and document the payout model before implementing EV — e.g., blackjack pays 3:2, regular win pays 1:1, push pays 0 — and compute EV as a payout-weighted sum, not a bare win-probability. Given `PROJECT.md`'s explicit "no betting, chips, or pot management" constraint, scope EV to a fixed, clearly-labeled bet-unit assumption (e.g., "EV per 1-unit bet") rather than silently building a richer betting model than the milestone asks for.

**Warning signs:** The Blackjack result type only has a `win/tie/lose` shape with no natural/blackjack flag; "EV" is computed as `P(win) - P(lose)` with no payout multiplier anywhere in the formula.

**Phase to address:** Blackjack engine phase — settle the payout/EV definition explicitly during planning (a `/gsd:discuss-phase`-level decision, not an implementation detail), before writing the EV aggregation code.

---

### Pitfall 5: Peeking at the predetermined dealer hole card / future hits before they're revealed

**What goes wrong:** If Blackjack reuses this codebase's existing "predetermine the full runout up front, reveal via a visibility pointer" architecture (D-01/D-02, the same pattern `deriveConditionedState` enforces for poker), it is very easy to compute "what will the dealer end up with" by reading the dealer's *actual* predetermined hole card and hit sequence directly, instead of drawing a fresh, unknown hole card + hit sequence per Monte Carlo trial from the shoe with only the dealer's visible up-card and the player's own cards removed.

**Why it happens:** This is the exact same trap as this project's already-documented Poker Pitfall 1 (`02-RESEARCH.md`), just with "dealer hole card + future hits" replacing "opponent hole cards" — same architecture, same shape of mistake, and nothing about it is obviously different at a glance because the predetermined-runout data is "right there" and fully populated.

**How to avoid:** Apply the identical discipline already proven in `src/engine/conditioning.ts`: write ONE function that is the only place allowed to read the dealer's raw predetermined hole card/hit sequence, and have every simulation call site go through it, deriving "known" (dealer up-card only, until settlement) vs. "unknown" (hole card + all future dealer draws, redrawn per trial from the shoe) exactly the way `deriveConditionedState` does for `street`/`revealedMask`. Do not let the Blackjack runout's hidden fields be readable from the trial loop directly.

**Warning signs:** Bust-probability or dealer-outcome numbers that look suspiciously decisive/accurate before the dealer's hole card is ever revealed; no equivalent of the poker property test ("revealing a card never increases another player's true probability...") exists for the dealer's hole card.

**Phase to address:** Blackjack engine phase — same architectural review gate that guarded D-02 for poker should explicitly re-run against the new Blackjack conditioning function before merge.

---

### Pitfall 6: Bare-string `Card` identity collapses under every existing `Set`/`Map`-based dedup helper (the core multi-deck structural bug)

**What goes wrong:** Nearly every existing helper that manages "which cards are used" is built on `Set<Card>` membership over the bare `Card` string type (`'Ah'`, `'Ah'`, ... indistinguishable):
- `deckWithout` (`src/engine/cards.ts`): `new Set(excluded); FULL_DECK.filter(card => !excludedSet.has(card))`.
- `deriveConditionedState`'s `knownCards` (`src/engine/conditioning.ts`): `new Set<Card>([...])`, then `FULL_DECK.filter(card => !knownCards.has(card))`.
- `simulationApi.ts`'s overlap guard: `remainingDeck.filter(card => knownCards.has(card))`.
- `pickerStore.ts`'s `heldByAnotherSlot` check and `CardPicker.tsx`'s `usedElsewhere = new Set(pickedCards(picks))`.

If a 2-deck shoe legitimately contains **two physical copies** of `'Ah'` (one still in the pool, one already known — e.g., hero holds one, the shoe still has the other), every one of these helpers will treat the *value* `'Ah'` as a single boolean fact ("used" or "not used"), not a count. Concretely: `deckWithout`/`deriveConditionedState`'s `Set`-based filter will remove **both** physical copies of `'Ah'` from the remaining pool the instant *either* copy becomes known — silently shrinking the real 104-card shoe to fewer actually-available cards than it should have, and making the still-available second copy permanently undrawable for the rest of the hand.

**Why it happens:** These helpers were correct and sufficient for exactly one deck (where a card value and a physical card are the same thing) — nothing about them is "wrong" in the current codebase; they simply encode an assumption (at most one physical card per value) that a second deck directly violates, and that assumption is invisible until you specifically reason about what happens when the same string appears twice.

**How to avoid:** Introduce a genuine physical-card-identity type before writing any multi-deck logic — e.g., `{ id: string; value: Card }` (`id` unique per physical card, such as `'Ah#0'`/`'Ah#1'`), or an index into a per-hand `PhysicalCard[]` shoe array. Track "known"/"used"/"remaining" by `id`, never by `value`, in every dedup/removal helper touched by multi-deck code. Convert to the bare `Card` value ONLY at the boundary where the evaluator is called (it only understands rank+suit strings, see Pitfall 7) or where a display label is rendered. Do not retrofit the existing `Set<Card>` helpers in place for both games — either parameterize them to accept an identity-extraction function, or give multi-deck code its own parallel helpers, so single-deck Hold'em's existing 216 tests keep passing against the unmodified value-based helpers.

**Warning signs:** A 2-deck hand where a duplicate rank+suit value should legitimately still have one copy available in the remaining pool comes up one card short (`remainingDeck.length` off by one, or a worker validation "overlap" error firing on a **legitimate** state — see Pitfall 8); property tests asserting "N unique cards per trial" fail to distinguish "N unique physical cards" from "N unique values," and pass or fail for the wrong reason.

**Phase to address:** Foundational — must land before ANY other multi-deck work (Blackjack shoe, 2-deck Hold'em picker, or evaluator changes), since Pitfalls 1, 4 (shoe), 8, 9, 13, and 14 are all downstream consequences of this one data-model gap.

---

### Pitfall 7: The evaluator crashes (not "ranks wrong") on duplicate rank+suit cards — empirically confirmed

**What goes wrong:** `evaluateHoldem`/`evaluate` (the function this codebase's `src/engine/evaluator.ts` exclusively uses) has **no duplicate-card validation at all** — unlike the same package's own unused `equity`/`simulate` helpers, whose internal `createEngine` explicitly `claim()`s each card and throws a clean `DuplicateCardError` on a repeat. A direct spike test against the installed `@poker-apprentice/hand-evaluator@4.3.0` package in this repo confirms: calling `evaluateHoldem({ holeCards: ['Ah','Ah'], communityCards: [...] })` (or any two duplicate rank+suit values co-occurring anywhere across hole + community cards) does **not** silently miscompute a category — it throws `TypeError: C is not iterable`, an opaque, undocumented internal error with no domain-specific type. Baseline (non-duplicate) quads evaluated correctly (`strength = 7`) in the same spike run.

**Why it happens:** The library's fast lookup-table evaluator (`hashQuinary`/`NOFLUSH_BY_SIZE`, verified in `dist/esm/index.js`) is built for the closed combinatorial space of a single 52-card deck, where a given rank+suit value can appear in an evaluated hand **at most once**. A 2-deck Hold'em hand where the same value appears twice (any pair of matching cards drawn from the two different physical decks — not just an intentional "five of a kind," but the far more common case of *any two* duplicate values landing in the same 7-card window) falls outside that domain and the library's internal `handToIds`/`rankN` path has no guard for it.

**How to avoid:** Never pass a 2-deck-conditioned hand straight to `evaluateHand`/`evaluateHoldem` unchecked. Before evaluation, detect duplicate rank+suit values (by physical-card identity per Pitfall 6, converted back to bare `Card` values for this specific check) within the 7-card window; if none exist, delegate to the existing evaluator unchanged (the common case, still correct and fast); if duplicates exist, run a custom evaluation path that (a) correctly ranks Five of a Kind (5 cards of one rank, only reachable in 2-deck play) ABOVE Royal Flush — the standard convention in wild-card/multi-deck games — and (b) handles the general case of any duplicate co-occurrence that would otherwise crash the library, not just the 5-of-a-kind edge case specifically. This is a "verify the library empirically first" situation exactly matching this project's own `evaluator.ts` precedent (its top-of-file comment already documents one deviation discovered by direct verification against the actual toolchain, not the plan's assumption).

**Warning signs:** Any 2-deck Hold'em trial batch throwing intermittently (not on every trial — only when a duplicate co-occurrence happens to be drawn) surfaces exactly like the codebase's existing WR-02 "[simulation] worker exploded" error path already visible in this session's test output — i.e., it will look like an unrelated, unreproducible worker crash unless someone specifically suspects duplicate cards. `CATEGORY_COUNT = 10` / `HandStrength` (10 values, no Five of a Kind slot) and `CATEGORY_LABELS` (`src/ui/categoryLabels.ts`) both need extending — a missing 11th row is a second, independent tell that this pitfall wasn't addressed.

**Phase to address:** Multi-deck Hold'em evaluation phase — must include a dedicated pre-evaluation duplicate/five-of-a-kind detection layer and an extended `CATEGORY_COUNT`/label set, verified with the exact kind of exact-value spike test used to discover this (own a small, permanent regression test asserting `evaluateHoldem` is never called with duplicate values in production code paths, plus a custom five-of-a-kind comparator test).

---

### Pitfall 8: Worker's static remaining-deck-length/overlap validation rejects (or worse, wrongly accepts) legitimate multi-deck and Blackjack requests

**What goes wrong:** `simulationApi.ts`'s validation formula, `expectedRemainingDeckLength = FULL_DECK.length - 2 - knownBoard.length - 2 * revealedCount`, and its companion overlap check (`remainingDeck.filter(card => knownCards.has(card))` must be empty) both hardcode two single-deck assumptions: `FULL_DECK.length` is a fixed 52, and "a card value can appear in `knownCards` or `remainingDeck` but never validly in both." In 2-deck Hold'em, a *different physical copy* of an already-known value legitimately remaining in the pool is normal (see Pitfall 6) — the current overlap check would throw `runSimulation: remainingDeck overlaps known cards` on every such legitimate request, since it compares by value, not physical identity. Separately, reusing this exact validation function unmodified for Blackjack is a category error: Blackjack's "expected remaining shoe size" is a function of variable hit counts across player/dealer hands, not a fixed formula over street/opponent-count — it doesn't generalize, it's simply the wrong shape of check entirely.

**Why it happens:** The formula was correct and sufficient for the one knowledge shape single-deck Hold'em has; nobody needs to touch it again until a second deck or a second game's request shape shows up, at which point it's tempting to "generalize the constant" (`FULL_DECK.length * deckCount`) without noticing the *overlap* check's by-value comparison is the deeper, more consequential bug.

**How to avoid:** Re-derive the expected count/overlap check from physical-card identity, not value: `expectedRemainingCount = 52 * deckCount - (number of physical cards currently known)`, and the overlap check must compare `remainingDeck` (a set of physical-card ids) against `knownCards` (also physical-card ids) — never bare values — for it to correctly reject a *real* duplication bug (the same physical card appearing in both known and remaining) while accepting a legitimate second physical copy of the same value. For Blackjack, write an entirely separate validation function against Blackjack's own request shape — do not branch the existing Hold'em formula on a game-type flag.

**Warning signs:** Every 2-deck Hold'em request beyond the most trivial (any hand with a value appearing on both a known slot and still-in-shoe) throws in dev; if the throw is ever swallowed, the alternative failure mode is silently wrong probabilities — the same failure class this exact guard's own code comment already warns about for the single-deck case.

**Phase to address:** Multi-deck Hold'em evaluation phase (worker validation must be re-derived alongside Pitfall 6's identity model) and Blackjack engine phase (separate validation function), not a shared "generalize the one formula" fix.

---

### Pitfall 9: Reusing the poker `CardPicker`'s value-keyed React list and boolean `Set`-based "used" logic for a multi-copy panel

**What goes wrong:** `CardPicker.tsx`'s 52-button suit-grouped grid keys each button by the bare card value (`key={card}`, line 85) and disables it via `usedElsewhere.has(card)` — a boolean membership check. Extending this panel to show two selectable copies per value for 2-deck mode by simply rendering the same button twice with the same `key={card}` is a literal React duplicate-key bug (React cannot distinguish the two list items, and will misattribute state/DOM nodes between them on re-render, most visibly as visual glitches when picks are cleared or re-selected). Separately, the boolean-membership disabling logic has no way to express "1 of 2 copies still available" — it can only express "available" or "fully used," so a naive port either blocks a legitimate second pick entirely or, if patched carelessly, allows unlimited picks of the same value regardless of deck count.

**Why it happens:** The existing panel was built, correctly, for a domain where a card value and a pick slot are 1:1 — the multi-copy requirement genuinely doesn't fit the same data shape, and "just render it twice" is the path of least resistance when the underlying identity model (Pitfall 6) hasn't been introduced yet.

**How to avoid:** Key each pickable button by physical-card `id` (Pitfall 6's identity type), not by value, and drive the disabled state from a **count** of remaining copies per value (`Map<Card, number>`, initialized to `deckCount`, decremented per pick) rather than a boolean `Set`. This is also the direct fix for the UX pitfall in Pitfall 13 below — the same data-shape change resolves both the correctness bug and the display ambiguity.

**Warning signs:** React DevTools/console warnings about duplicate keys the moment a second-copy button is added anywhere in the picker; a picked second copy visually "stealing" the first copy's selected/disabled styling on re-render.

**Phase to address:** UI/Picker phase — but blocked on Pitfall 6 landing first (the identity type this fix needs must already exist).

---

### Pitfall 10: Blackjack bolted onto `gameStore`'s Hold'em-shaped fields ("mode leakage")

**What goes wrong:** `gameStore.ts`'s state (`runout`, `street: 'preflop'|'flop'|'turn'|'river'`, `revealedMask` as a 3-opponent bitmask, `dealNonce`) and its actions (`advanceStreet`, `reveal(opponentIndex)`) are shaped entirely around Hold'em's specific structure. Blackjack's natural state (player hand(s), a dealer hand with exactly one hidden hole card, a hit/stand action history, and round phases like "initial deal / player turn / dealer turn / settled") does not map onto `Street`'s four-value enum or a 3-bit opponent-reveal mask at all. Retrofitting Blackjack by reusing these fields — e.g., mapping "dealer hole card hidden/revealed" onto bit 0 of `revealedMask`, or coercing round phases into the `Street` union — forces every consumer of that field (the `App.tsx` effect's dependency array, `oddsStore`'s cache key, `deriveConditionedState`) to interpret the same field two different, game-dependent ways, via runtime branching that has to be kept in sync everywhere the field is read.

**Why it happens:** Reusing an existing, working, well-tested store looks like less work than building a parallel one, especially once the single `App.tsx` effect (`src/App.tsx`, dependency array `[runout, street, revealedMask, dealNonce, pendingAnimationCount]`) is already wired up and battle-tested against WR-01/WR-02-style races — it's tempting to widen it rather than duplicate its ignore-flag/cache-gate/animation-gate machinery for a second game.

**How to avoid:** Introduce a `blackjackStore.ts` with its own state shape (own to Blackjack's actual domain, not Hold'em's), and a **separate** effect (or a separate top-level screen/route) that independently re-implements the same proven ignore-flag + cache-gate + animation-gate pattern against Blackjack's own trigger set — do not widen the existing Hold'em effect's dependency array or `gameStore`'s fields to also cover Blackjack. A top-level `mode: 'holdem' | 'blackjack'` selector deciding which screen/store pair is active is the correct level of coupling between the two games — not shared mutable fields.

**Warning signs:** Any `if (mode === 'blackjack')` branch appearing inside `gameStore.ts`, `deriveConditionedState`, or the existing `App.tsx` effect; a Hold'em `reveal()` call site that needs to know whether a Blackjack round is "in progress" (or vice versa) to behave correctly.

**Phase to address:** Integration/mode-separation phase — should be decided architecturally before either game's UI is built, ideally alongside the roadmap's phase-boundary decision on whether Blackjack is a separate route/screen from the poker table.

---

### Pitfall 11: Shared `oddsStore` cache keyed by a poker-shaped string risks collision and cross-game data-shape poisoning

**What goes wrong:** `oddsStore.ts`'s `knowledgeKey(street: Street, revealedMask: number)` produces poker-specific strings like `"flop|5"` into a single `settledCache: Map<string, ProgressSnapshot>`. If Blackjack's odds are cached into the *same* `Map` using an ad-hoc key encoding (rather than a dedicated store/namespace), two risks compound: (a) an accidental string collision is possible if Blackjack's key-encoding scheme ever happens to produce a string shaped like a valid poker key (low probability, but a real risk without a discriminating prefix), and (b) even without a literal collision, `ProgressSnapshot.categoryCounts` means something *completely different* per game (a `HandStrength` histogram for poker vs. a bust/17-21/blackjack outcome histogram for Blackjack) — sharing one cache and one snapshot type erases the type system's ability to catch a wrong-shape read, which a `categoryCounts`-driven `OddsTable`/`categoryLabels.ts` render would display as nonsense (poker category labels over Blackjack frequencies, or vice versa) with no runtime error at all.

**Why it happens:** `oddsStore` already exists, is already wired to `OddsTable`/`WinTieLossDisplay`, and reusing it needs zero new plumbing — the cost (a semantically ambiguous shared cache) is invisible until two differently-shaped snapshots actually collide or a component reads the wrong one.

**How to avoid:** Either (a) give Blackjack its own store (`blackjackOddsStore.ts`) with its own snapshot type and its own cache, mirroring the store-separation recommendation in Pitfall 10, or at minimum (b) if a single cache is kept for infrastructure-reuse reasons, prefix every key with a game discriminant (`"holdem|flop|5"` vs `"blackjack|..."`) AND make `ProgressSnapshot` a discriminated union (`{ game: 'holdem', categoryCounts: ... } | { game: 'blackjack', outcomeCounts: ... }`) so a wrong-shape read is a TypeScript compile error, not a silent runtime display bug. Prefer (a) — it is the more consistent choice given Pitfall 10's store-separation recommendation.

**Warning signs:** `ProgressSnapshot`'s `categoryCounts: number[]` field being read/written with two different semantic meanings depending on a runtime `mode` check; no `game` discriminant anywhere in the cached snapshot type.

**Phase to address:** Integration/mode-separation phase, same decision point as Pitfall 10.

---

### Pitfall 12: Existing invariant tests are poker-specific and will be silently broken — or silently wrongly generalized — by careless multi-deck/Blackjack changes

**What goes wrong:** Several of the 216 existing tests encode invariants that are true *only* for single-deck Hold'em and will not simply "not apply" to the new modes — they will actively assert the wrong thing if the underlying code they test is changed carelessly:
- `equity.property.test.ts`'s property (c), `"every trial produces exactly 13 unique cards regardless of known/unknown split"`, asserts `new Set(allCards).size === 13` — this is precisely the invariant that a 2-deck Hold'em hand is allowed to violate by design (13 *physical* cards, but not necessarily 13 unique *values*). If this exact test is "generalized" to also run against 2-deck states without being rewritten around physical-card identity, it will fail on entirely correct 2-deck output; if it's instead weakened/deleted to make 2-deck code pass, it silently stops protecting single-deck Hold'em's own correctness.
- `simulationApi.ts`'s `VALID_BOARD_LENGTHS = new Set([0, 3, 4, 5])` and its accompanying tests are Hold'em-street-shaped; forcing Blackjack's validation through the same file/test suite (rather than a separate one) risks the wrong validation function running against the wrong game's request at the worker boundary — a mode-leakage bug in the *test* surface mirroring Pitfall 10's store-level version.
- Any test that hardcodes `FULL_DECK.length === 52` or iterates all of `FULL_DECK`/`ALL_CARDS` assuming exactly 52 unique entries will break the moment `FULL_DECK` itself is changed to conditionally be 104 cards for 2-deck mode — even though nothing about single-deck Hold'em actually needs to change.

**Why it happens:** It's natural to want "one card module" and "one validation module" rather than parallel ones, and the failure mode here is specifically the temptation to *modify a shared, well-tested module in place* to also serve the new mode, rather than adding a new, additive module alongside it.

**How to avoid:** Keep `FULL_DECK`/single-deck behavior completely untouched and add a *new*, separate `buildShoe(deckCount)` (or equivalent) used only by new multi-deck/Blackjack code paths — never redefine `FULL_DECK` itself to be deck-count-parametric. Rewrite the "13 unique cards" property test's *assertion*, not its *applicability* — for 2-deck mode, the correct invariant becomes "13 unique physical card ids, drawn without replacement from the deck-count-sized pool" (still true, just checked at the identity level, not the value level per Pitfall 6) — write this as a new, additive property test alongside the existing one, which should keep passing unmodified against pure single-deck Hold'em. Give Blackjack its own `blackjackSimulationApi.ts`/`blackjackApi.test.ts`, not a modification of the existing `simulationApi.ts`/`simulationApi.test.ts`.

**Warning signs:** A diff that modifies `equity.property.test.ts`'s existing assertion text/threshold rather than adding a new test; `simulationApi.ts`'s diff touching `VALID_BOARD_LENGTHS` or its validation function body to add Blackjack-shaped branches; the full `npm test` run count staying at 216 (or growing only slightly) despite two substantial new feature areas landing — a strong signal that new invariants weren't actually added, only old ones were loosened.

**Phase to address:** Cross-cutting — applies to every phase in this milestone; the roadmap should require each phase's plan to name which *new* additive tests it introduces, not just "existing tests still pass."

---

### Pitfall 13: 104-card picker with boolean-only "used" state is confusing, not just structurally buggy

**What goes wrong:** Even once Pitfall 9's structural React-key/count-tracking fix lands, a naive 104-button panel (two visually identical `Ah` buttons, say) gives the user no indication of *why* two copies exist, how many remain, or which slot each already-picked copy is occupying. This is a genuine usability regression from the current, well-understood single-copy panel (D-05's "already-used cards are visibly DISABLED... making the DEAL-03 duplicate-block observable is part of the learning goal") — the multi-copy version needs an equivalent, explicit "part of the learning goal" affordance, not just a disabled/enabled toggle.

**Why it happens:** The mental model that shipped in Phase 2 ("a card is either available or it's used, full stop") was correct for exactly one deck; multi-deck genuinely needs a *count*-based affordance, and it's easy to ship "the minimum change that compiles" (two buttons, same disabled logic) without redesigning the copy-count UI.

**How to avoid:** Render remaining-copy counts explicitly per value (e.g., "Ah — 1 of 2 remaining" or a small badge), and only fully disable a value once all `deckCount` copies are picked. This directly reuses the `Map<Card, number>` remaining-count data structure Pitfall 9 already requires for correctness — the UI fix and the correctness fix share one data model, they are not two separate pieces of work.

**Warning signs:** User testing (or a screenshot review) showing two identical-looking, both-enabled `Ah` buttons with no visible count/badge distinguishing them.

**Phase to address:** UI/Picker phase, same unit of work as Pitfall 9.

---

### Pitfall 14: Two physical copies of the same card are visually indistinguishable on the felt

**What goes wrong:** Once a 2-deck hand legitimately deals two physical copies of the same rank+suit to the table (e.g., hero holds one `Ah` and a revealed opponent or the board holds the other), the existing card-rendering components (`PlayingCard.tsx`/`AnimatedCard.tsx`/`FlipCard.tsx`) render both identically — there is no standard playing-card visual convention for "this is deck 2's copy," so to a user this looks exactly like a rendering bug or a duplicate-card glitch, even though it is mathematically and rules-correct 2-deck behavior.

**Why it happens:** Standard card art has no per-copy distinguishing feature by design (that's what makes it "the Ace of Spades" regardless of which deck it came from) — real casinos solve exactly this problem with a physical convention (back-color-coded decks, e.g. red-backed deck 1 vs. blue-backed deck 2) that has no default digital equivalent unless deliberately added.

**How to avoid:** Adopt the real-world convention directly: tint or badge each dealt card with a small, unobtrusive deck-index marker (e.g., a corner-color accent or a tiny "1"/"2" chip) tied to which physical deck it was drawn from, sourced from the same physical-card `id` (Pitfall 6) already needed for correctness — so the fix is "plumb the existing identity through to a rendering prop," not a new data source. This also resolves the animation/flip identity concern: `Seat.tsx`/`BoardDisplay.tsx` already key card elements by `${slot}-${dealNonce}` (position-based, verified in this session — NOT value-based, so no key-collision bug exists in the felt rendering today), and that positional-keying pattern should be preserved rather than switched to value-based keys, which would reintroduce a real collision risk for duplicate values.

**Warning signs:** A 2-deck scenario where a user (or a screenshot-based review) reports "why are there two identical Aces of Spades, is this a bug?" — treat this as an expected design question to pre-empt, not a support ticket to react to after the fact.

**Phase to address:** UI/Table-rendering phase — lower priority than Pitfalls 6-9 (a correctness prerequisite), but should land in the same milestone since the "deck count is a first-class, explorable variable" goal implies users are expected to actually see duplicate cards, not just see different odds.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| With-replacement/infinite-deck sampling for Blackjack draws | Simpler code, no pool-tracking state to thread through | Erases the entire deck-count feature — the milestone's core deliverable becomes a no-op | Never |
| Widening `gameStore`'s `street`/`revealedMask` fields (or adding `mode`-conditional branches inside it) to also represent Blackjack state | Avoids writing a second store/effect from scratch | Every consumer of the shared fields needs game-aware branching kept in sync forever; regressions in one game risk breaking the other | Never — acceptable only as a disposable spike never merged |
| Calling `evaluateHand`/`evaluateHoldem` directly on 2-deck-conditioned hands without a duplicate-card pre-check | No new code needed short-term, works for the (common) non-duplicate case | Crashes the worker with an opaque `TypeError` on any duplicate co-occurrence — confirmed empirically, not a hypothetical | Never |
| Sharing one `oddsStore`/`settledCache` `Map` across both games with an ad-hoc (non-discriminated) key scheme | Reuses existing, working cache plumbing | Loses TypeScript's ability to catch a wrong-game-shape cache read; low but real risk of key-string collision | Only as a throwaway spike; not for the shipped feature |
| Doubling every picker button 1:1 for 2-deck mode without a remaining-count affordance | Minimal UI diff | Confusing, unlabeled duplicate-looking buttons undermine the "observable duplicate-block" learning goal D-05 already established | Acceptable for an internal dev/debug picker only, not the shipped feature |

## Integration Gotchas

| Integration point | Common Mistake | Correct Approach |
|--------------------|-----------------|-------------------|
| `src/worker/simulationApi.ts` | Branching the existing Hold'em validation formula/`SimulationApi` on a game-type flag to also accept Blackjack requests | Give Blackjack its own request/response protocol and its own `createBlackjackSimulationApi` — never overload the Hold'em-shaped validation |
| `src/state/oddsStore.ts` | Writing Blackjack snapshots into the existing `settledCache` `Map` under an ad-hoc key with no game discriminant | New store/cache per game, or a discriminated-union snapshot type with a mode-prefixed key (Pitfall 11) |
| `src/App.tsx`'s single `useEffect` | Widening the dependency array and branching logic to juggle both games' triggers in one effect | A separate effect (or top-level screen) per game, each independently re-implementing the proven ignore-flag/cache-gate/animation-gate pattern |
| `@poker-apprentice/hand-evaluator` | Assuming it "just works" for 2-deck Hold'em because it works for 1-deck | Verify empirically first — duplicate cards throw `TypeError: C is not iterable` (confirmed) — and add a pre-evaluation duplicate/five-of-a-kind detector before ever calling it on a 2-deck-conditioned hand |
| `src/state/pickerStore.ts` / `src/ui/CardPicker.tsx` | Extending the existing `Set<Card>`/boolean-membership helpers as-is to cover 2-deck slots | Replace with physical-card-identity-keyed, count-aware helpers (`Map<Card, number>` remaining copies) before wiring a multi-deck picker |
| `src/engine/cards.ts`'s `deckWithout` and `src/engine/conditioning.ts`'s `knownCards` | Reusing these unmodified for a 104-card `FULL_DECK` | Add new, additive physical-identity-aware equivalents; leave `FULL_DECK`/`deckWithout` untouched for single-deck Hold'em (Pitfall 12) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|-------------|-----------------|
| With-replacement sampling used as a (mistaken) perf shortcut to avoid pool-shrinking bookkeeping | 1-deck and 2-deck odds converge to identical values | Always draw from an explicit finite pool sized `52 * deckCount` minus known/dealt cards, mirroring `createDrawer` | Immediately, on the first side-by-side deck-count comparison — not a scale issue at all, a correctness issue that happens to look like a perf shortcut |
| A naive, nested-loop duplicate/five-of-a-kind detector run inside the hot 200,000-trial Monte Carlo loop | Perceptibly slower convergence or dropped frames specifically in 2-deck Hold'em mode, most visible on lower-end/mobile devices (already flagged as a general risk in this project's `STACK.md`) | Implement duplicate/rank-count detection as a single O(n) pass with a rank-count array, mirroring the evaluator's own internal approach, not O(n²) pairwise comparisons | As soon as 2-deck mode's per-trial guard logic runs across the default 200k-trial batch; single-deck Hold'em is unaffected since it never needs this check |

## Security Mistakes

No new attack surface is introduced by this milestone — same conclusion as the prior phase's research: purely client-side, offline, no auth, no persistence, no network calls, and all new inputs (card-picker clicks, deck-count toggle) are closed-union selections, not free text. The one domain-specific risk worth naming explicitly (not a security vulnerability, a business-rule integrity risk, per this project's own established framing in `02-RESEARCH.md`) is under-validating the new request shapes at the worker boundary the same way Hold'em's entry-point defense-in-depth already does (Pitfall 8) — a missing or wrong validation here produces silently-wrong probabilities, not an exploit.

| Mistake | Risk | Prevention |
|---------|------|-------------|
| Skipping entry-point validation (card-count/shoe-size/overlap checks) for the new Blackjack and multi-deck Hold'em request shapes, reasoning "it's the same trust boundary as before" | Silently wrong probabilities reach the UI with no error signal — a correctness/pedagogical risk, not an exploit | Extend the existing defense-in-depth pattern (Pitfall 8) to every new request shape, with its own dedicated validation function per game |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Boolean-only "used" disabling in a 104-card picker (Pitfall 13) | User can't tell whether a disabled card is "used up" or simply not applicable, and can't tell a second copy is even pickable | Render "N of `deckCount` remaining" per value; disable only once all copies are picked |
| Two visually identical cards dealt to the felt with no deck-origin marker (Pitfall 14) | Looks like a duplicate-card rendering bug rather than correct 2-deck behavior, undermining trust in the tool | Add a subtle per-deck visual marker (color accent/badge), mirroring the real-world dual-back-color convention |
| Blackjack "EV" displayed with the same visual weight/format as poker's win/tie/lose without clarifying the payout assumption (Pitfall 4) | User may misread EV as a plain win-probability, missing that it's payout-weighted (or wrongly assumes it isn't) | Label the EV figure explicitly with its assumed payout structure (e.g., "EV per 1-unit bet, blackjack pays 3:2") |

## "Looks Done But Isn't" Checklist

- [ ] **Dealer hit/stand logic:** Often only re-checks softness at the initial 2-card deal — verify with a hand that becomes/stops being soft *after* a hit (e.g., dealer draws `6,6` then an Ace).
- [ ] **2-deck Hold'em duplicate handling:** Often "handled" by widening `FULL_DECK` to 104 cards without touching any `Set`-based dedup helper — verify by explicitly constructing a hand where a hero card and a board/opponent card share an identical rank+suit value, and confirming the pool/validation/evaluator all handle it correctly (not just "doesn't crash on a normal deal").
- [ ] **2-deck mode stability claims:** Often verified only by "a few manual deals didn't crash" — verify by running enough trials/deals that a same-value duplicate co-occurrence is virtually guaranteed (13-card Hold'em deals from a 104-card pool collide often enough to hit this within dozens of hands) and confirming the worker never throws.
- [ ] **Blackjack "EV" feature:** Often missing the blackjack 3:2 payout weighting entirely — verify EV isn't secretly just `P(win) − P(lose)` with an implicit flat 1:1 payout baked in.
- [ ] **Deck-count toggle:** Often verified only by "the UI toggle renders and re-runs a simulation" — verify the actual computed odds *differ* meaningfully (beyond Monte Carlo noise) between 1-deck and 2-deck for the same conditioning scenario, not just that a number changed at all.
- [ ] **Five-of-a-kind category:** Often missing from both the `CATEGORY_COUNT`/label list and from the comparator logic — verify a constructed 2-deck five-of-a-kind hand is both correctly detected AND correctly ranked above (not below, and not crashing on) a royal flush.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-------------------|
| With-replacement shortcut shipped (Pitfall 1) | LOW-MEDIUM | Swap the draw call site to sample from the real shrinking shoe array; isolated to the RNG draw function if the rest of the trial loop already threads a pool through |
| Set-based dedup structural bug shipped (Pitfall 6) | HIGH | Requires introducing the physical-card-identity type after the fact and touching every helper that does value-based `Set`/`filter` work (`deckWithout`, `conditioning.ts`, `simulationApi.ts`'s overlap check, `pickerStore.ts`) — a cross-cutting refactor; far cheaper to front-load as its own phase than patch reactively |
| Evaluator crash shipped to production (Pitfall 7) | MEDIUM | The existing WR-02 error-surfacing path (already verified in this session's test suite) catches and displays worker errors without a white-screen crash, containing the immediate user impact — but every 2-deck trial batch still needs the duplicate-detection guard added and re-released |
| Mode leakage shipped (Blackjack fields bolted onto `gameStore`, Pitfall 10) | HIGH | Untangling shared fields after both games' features are already built against them risks regressing Hold'em's existing tests; treat as "redo the store split now," not an incremental patch |
| Boolean-only picker shipped (Pitfall 9/13) | LOW | Swap the `Set<Card>` used-check for a `Map<Card, number>` remaining-count and adjust the disabled threshold and key strategy; contained to `CardPicker.tsx`/`pickerStore.ts` |

## Pitfall-to-Phase Mapping

| Pitfall | Recommended Build Stage | Verification |
|---------|---------------------------|----------------|
| 1 — With-replacement shortcut | Blackjack engine phase | Regression test comparing 1-deck vs 2-deck odds for a fixed conditioning scenario asserts a measurable difference |
| 2 — Soft-total re-check | Blackjack engine phase | Exact-value unit test: dealer hand that becomes/loses softness mid-hand via a hit |
| 3 — S17/H17 on hard total only | Blackjack engine phase | Exact-value unit tests for both variants against the same soft-17 hand |
| 4 — Natural vs. any-21, EV payout | Blackjack engine phase | EV formula reviewed/discussed explicitly before implementation; test asserting natural-blackjack push/payout is distinct from a hit-into-21 |
| 5 — Peeking at predetermined dealer hole card | Blackjack engine phase | A `deriveConditionedState`-equivalent guard function exists and is the sole reader of the dealer's hidden hole card/future hits |
| 6 — Bare-string identity collapse | Foundational (before any other multi-deck work) | New physical-card-identity type exists and is used by every multi-deck dedup/removal helper; single-deck Hold'em's 216 existing tests still pass unmodified |
| 7 — Evaluator crash on duplicates | Multi-deck Hold'em evaluation phase | Pre-evaluation duplicate/five-of-a-kind detector exists; regression test confirms no `TypeError` reaches production for any 2-deck-conditioned hand |
| 8 — Static validation formula | Multi-deck Hold'em evaluation phase + Blackjack engine phase (separate functions) | Validation re-derived from physical-card identity; Blackjack has its own dedicated validation function, not a branch of the Hold'em one |
| 9 — Picker React key/boolean dedup | UI/Picker phase (after Pitfall 6) | No duplicate-key warnings in dev console with 2-deck mode active; picking a second physical copy of a value succeeds and is visually distinct |
| 10 — Mode leakage across stores | Integration/mode-separation phase | `gameStore.ts` contains no Blackjack-specific fields or branches; Blackjack has its own store and effect |
| 11 — Shared cache collision risk | Integration/mode-separation phase | Cache keys are game-discriminated (separate store, or a mode-prefixed key + discriminated snapshot type) |
| 12 — Test-suite coupling | Cross-cutting, every phase | Each phase's plan documents which *new* additive tests it adds; no existing test's assertion text is loosened to accommodate a new mode |
| 13 — 104-card picker usability | UI/Picker phase (same unit as 9) | Remaining-copy count is visibly rendered per value in the picker panel |
| 14 — Indistinguishable felt duplicates | UI/Table-rendering phase | A 2-deck scenario with a duplicate value on the felt renders a visible per-copy distinguishing marker |

## Sources

### Primary (HIGH confidence — direct source/package inspection and empirical verification)
- Direct inspection of this repository's `src/engine/cards.ts`, `src/engine/conditioning.ts`, `src/engine/equity.ts`, `src/engine/evaluator.ts`, `src/engine/streets.ts`, `src/engine/rng.ts`, `src/worker/protocol.ts`, `src/worker/simulationApi.ts`, `src/worker/simulation.worker.ts`, `src/state/gameStore.ts`, `src/state/oddsStore.ts`, `src/state/pickerStore.ts`, `src/state/uiStore.ts`, `src/ui/CardPicker.tsx`, `src/ui/categoryLabels.ts`, `src/App.tsx`, and the `key=` usage across `src/ui/*.tsx` (confirmed `Seat.tsx`/`BoardDisplay.tsx` already key by position+`dealNonce`, not card value — no existing felt-rendering key bug)
- `node_modules/@poker-apprentice/types/dist/types/types.d.ts` — confirmed `Card = \`${Rank}${Suit}\`` (bare template-literal string, no physical-copy identity) and `HandStrength` enum's exact 10 values (`HighCard=0`…`RoyalFlush=9`, no Five of a Kind slot)
- `node_modules/@poker-apprentice/hand-evaluator/dist/esm/index.js` — direct inspection of `createEngine`'s `claim()`/`DuplicateCardError` path (used only by the unused `equity`/`simulate` helpers) versus `evaluate`'s actual code path (no duplicate validation), and the `hashQuinary`/`rankCounts`/`NOFLUSH_BY_SIZE` lookup-table structure this project's evaluator wrapper depends on
- **Empirical spike test (this session):** ran `evaluateHoldem` from the installed `@poker-apprentice/hand-evaluator@4.3.0` directly via a temporary Vitest test — baseline 4-of-a-kind evaluated correctly (`strength = 7`); every duplicate-rank+suit-card case tested (`['Ah','Ah']` in hole cards, and a duplicate split across hole/board) threw `TypeError: C is not iterable` before reaching `compare()`. Test file was removed after use; not part of the committed suite.
- `npx vitest run` (this session) — confirmed 216/216 existing tests pass on the current `master` branch before this milestone's work begins, establishing the baseline referenced throughout this document
- `.planning/PROJECT.md` — v2.0 milestone scope ("deck count as a first-class probability variable," "2-deck Hold'em variant... custom evaluation layer (five of a kind, duplicate-rank comparison)," explicit exclusion of betting/chips/pot management)
- `.planning/milestones/v1.0-phases/02-scenario-construction-street-navigation/02-RESEARCH.md` — prior pitfall format and the D-01/D-02 "predetermined runout + visibility-derived conditioning" architecture this milestone's Blackjack addition is expected to extend (Pitfall 5 is the direct Blackjack analogue of that document's Pitfall 1)

### Secondary (MEDIUM confidence — corroborating community sources, not project-specific)
- [CS231 Project 1: Monte-Carlo Simulation: Blackjack (Colby College)](https://wiki.colby.edu/display/~jhgelw22/CS231+Project+1:+Monte-Carlo+Simulation:+Blackjack) and related search results — corroborates the soft-17/hard-17 dealer-rule distinction and the general "reshuffle at the start of each deal" design pattern
- [How much does Penetration really matter? — Blackjack Apprenticeship](https://www.blackjackapprenticeship.com/how-much-does-penetration-really-matter/) and [Quantifying the Impact of the Number of Decks and Depth of Penetration — Quantoisseur](https://quantoisseur.com/2018/04/25/quantifying-the-impact-of-the-number-of-decks-and-depth-of-penetration-while-counting-blackjack/) — corroborate that deck count/penetration have a real, measurable effect on blackjack odds (the effect Pitfall 1's with-replacement shortcut would erase), independent of this project's own architecture

### Tertiary (LOW confidence)
- None — every claim above is backed by direct source/package inspection, an empirical spike test run in this session, this project's own prior research artifacts, or a corroborating community source cited above.

---
*Pitfalls research for: v2.0 Blackjack & Multi-Deck (Monte Carlo Poker Simulator)*
*Researched: 2026-08-24*
