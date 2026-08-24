# Stack Research — v2.0 Blackjack & Multi-Deck

**Domain:** Browser Monte Carlo casino game simulator — adding Blackjack + multi-deck Hold'em to a shipped v1.0 app
**Researched:** 2026-08-24
**Confidence:** HIGH

## Scope Note

This is a **subsequent-milestone, additive** stack review. The v1.0 stack (React 19.2.8, Vite 8.2.2, TypeScript 6.0.3, Zustand 5.0.15, Motion, Comlink 4.4.2, `pure-rand` 8.4.2, `@poker-apprentice/hand-evaluator` 4.3.0, vendored SVG cards) is locked and validated — it is **not** re-researched here. The question this file answers is narrow: **what, if anything, needs to be added or built for Blackjack and 2-deck Hold'em?**

**Bottom line, evidence-backed:** Nothing new needs to be installed. Both new capabilities are hand-rolled TypeScript modules layered on the existing worker/evaluator architecture. This confirms rather than merely defaults to the brief's stated expectation — see the evidence in each section below.

## Recommended Stack

### Core Technologies (reused, unchanged)

| Technology | Version | Purpose in v2.0 | Why no change needed |
|------------|---------|------------------|----------------------|
| Comlink | 4.4.2 (locked) | Same worker-RPC pattern streams Blackjack hand/EV results and 2-deck Hold'em odds, exactly like v1's poker loop | The streaming-progress pattern (`Comlink.proxy()` callback, partial-aggregate messages) is game-agnostic — it doesn't care whether the trial loop is poker or Blackjack. Reuse the same worker module (or a sibling module using the same wrapper), not a new library. |
| `pure-rand` | 8.4.2 (locked) | Seedable shuffling for a 1-or-2-deck Blackjack shoe and a 104-card (2-deck) Hold'em deck | A "shoe" is just a longer array to shuffle/draw from. No new RNG concern — `pure-rand`'s xoroshiro128+ engine doesn't care about deck size. |
| Zustand | 5.0.15 (locked) | New store slice for Blackjack game state (hand, dealer up-card, deck-count setting) and a `deckCount` setting shared across both games | Store composition (multiple slices/stores) is a Zustand pattern already available, no new state library needed. |
| `@poker-apprentice/hand-evaluator` | 4.3.0 (locked) | Still the evaluation core for 2-deck Hold'em's non-five-of-a-kind hands (see below) | Its low-level `evaluate`/`compare`/`rankN` primitives turn out to be reusable almost as-is for multi-deck play — confirmed by reading the actual source (not assumed). Only a thin wrapper is new; the dependency itself doesn't change. |
| React 19.2.8 / Motion / DOM+SVG cards (locked) | — | Blackjack table scene (dealer + player positions, hit/stand controls) reuses the same card component, felt-table visual language, and deal/flip animation primitives built for poker in Phase 3 | Blackjack has *fewer* on-screen cards than the poker table (1 dealer + 1-N player hands vs. 4 seats × 2 + 5 board), so the "DOM+SVG+Motion is plenty for this element count" conclusion from v1 research holds even more strongly. No rendering-approach change. |

### Supporting Libraries — none added

| Library | Version | Purpose | Verdict |
|---------|---------|---------|---------|
| *(none)* | — | Blackjack rules engine, multi-deck poker evaluation layer, multi-deck shoe model | All three are hand-written TypeScript modules inside the existing `src/` tree — see rationale below. Every candidate npm package investigated for these was rejected (see Package Legitimacy Audit). |

## (a) Blackjack Rules: Hand-Roll — Confirmed, Not Just Assumed

**Verdict: hand-roll. No maintained, browser-safe, fit-for-purpose Blackjack library exists at the versions/adoption level this project requires.**

Investigated every Blackjack-related npm package with any real signal (search + `npm view` + download stats + `slopcheck`):

| Package | Last real release | Downloads/mo | Fit | Problem |
|---------|-------------------|--------------|-----|---------|
| `blackjack-strategy` (gsdriver) | 2020-09-03 (v1.4.0) | 178 | Wrong shape | Only returns a basic-strategy **action suggestion** (`GetRecommendedPlayerAction` → `"hit"/"stand"/...`) — it does not compute bust probability, dealer outcome distributions, or EV, which is exactly what this project needs. Six years stale. |
| `engine-blackjack` (kedoska) | 2017-06-27 (v0.9.2) | 376 | License + abandonment | **GPL-2.0** — copyleft license risk for a project that should stay freely shippable/forkable; last published 2017, built on `neutrino` tooling that is itself long dead. |
| `blackjack-simulator` (gsdriver) | 2016-10-19 (v1.0.2) | 12 | Dead | 12 downloads/month — essentially unused; two versions ever published, in 2016. |
| `@blackjacktrainer/blackjack-simulator` (mhluska) | Actively maintained (343 commits, published 2 months ago) | 373 | Wrong product shape | This one is **legitimate** (real GitHub org, MIT, powers blackjacktrainer.app) — but it's built for **card-counting / bankroll session simulation** (`Simulator` class returns `amountEarned`, `bankrollMean`, `riskOfRuin` across many hands with bet-spread strategy). This project needs per-*current-hand* bust/dealer-outcome/EV odds, not multi-hand bankroll trajectories, and has no betting/bankroll concept at all (explicitly out of scope per `PROJECT.md`). Pulling in a 4.3MB package with its own Card/Shoe/Game class hierarchy to use ~5% of its surface (basic deal/bust arithmetic) is worse than writing the ~100 lines directly. |
| `miaoda-game-blackjack-rules` | 27 days old | 1,106 (suspiciously high for its age) | **SUS** | `slopcheck` flagged: no source repository linked at all, brand-new, and download count is anomalously high for a week-old, unlinked package. Sibling packages from the same publish window (`miaoda-game-deck-core`, `miaoda-game-blackjack-react`) show the same pattern — consistent with an AI-generated package cluster, not a project with real usage. **Rejected outright regardless of how good the description reads.** |
| `miaoda-game-deck-core` | 27 days old | — | **SUS** | Same red flags as above (dependency of the rules package). |

**Why hand-rolling is actually the right call here (not just "nothing good exists"):** Blackjack rules are a small, closed-form state machine — hard/soft total (an ace only needs one `if` to decide 1-vs-11 based on whether counting it as 11 busts), bust check (`total > 21`), dealer play (loop: hit while `total < 17`, or `total === 17 && isSoft && hitSoft17`), natural blackjack (`total === 21 && cards.length === 2`), and payout comparison. This is fundamentally different from 7-card poker hand ranking (the reason a library was recommended in v1) — poker hand ranking has thousands of non-obvious edge cases (kicker ordering, wheel straights, best-5-of-7 selection) that a perfect-hash lookup table exists specifically to get right at scale; Blackjack's rules have none of that combinatorial danger. Writing it is fast, testable with a handful of exact-value Vitest cases plus `fast-check` invariants (e.g., "dealer never stands below hard 17," "bust probability + non-bust probability sums to 1"), and keeps the entire new game's logic under project ownership with zero foreign class hierarchy to adapt to the existing worker/store architecture.

## (b) 2-Deck Hold'em Evaluation: Custom Wrapper, Not Standalone — Confirmed by Reading Source

**Verdict: no evaluator (this project's locked one, or any alternative found) supports duplicate cards or five-of-a-kind. This is a structural limitation of every standard lookup-table poker evaluator, not a documentation gap. The custom layer should be a thin wrapper around the existing locked evaluator, not a standalone reimplementation — confirmed by reading the actual `@poker-apprentice/hand-evaluator` v4 source, not by inference.**

**Evidence, read directly from the library's source (`poker-apprentice/hand-evaluator` on GitHub, `main` branch):**

1. **The high-level `equity`/`odds` functions explicitly throw on duplicates.** The v4 changelog states: *"`odds` validates its input. Duplicate cards and hands holding more cards than the game allows now throw instead of producing meaningless results"* (`DuplicateCardError`). Irrelevant in practice here — per v1's own research, this project never calls `equityHoldem`/`odds` directly; it hand-rolls the Monte Carlo loop around the low-level primitives, which is the layer that matters.
2. **The low-level `rankN` core has zero duplicate validation and a hard-coded ≤4-per-rank assumption.** Read from `src/core/rank.ts` and `src/core/hash.ts`: `rankN` builds a `rankCounts[rank] += 1` array directly from whatever cards are passed in (no uniqueness check at all — confirmed by reading `evaluate.ts` too, which is a non-validating wrapper around `rankN`). The perfect-hash table builder (`buildSuffixCounts` in `hash.ts`) explicitly caps each rank's count in its combinatorics at `digit <= SUIT_COUNT` (4), with an inline comment: *"a rank appears at most once per suit."* Feeding it a 5-of-a-kind rank count produces an out-of-range/incorrect hash table index — **silent wrong classification, not a thrown error.** This is worse than an error and is exactly the failure mode a pre-check must intercept.
3. **`HandStrength` enum (from `@poker-apprentice/types`) tops out at `RoyalFlush = 9`.** There is no slot for a hand rank above straight flush, confirming the "canonical 7,462 hand equivalence classes" the library targets structurally cannot represent five-of-a-kind.
4. **`@pokertools/evaluator`** (the locked alternative/fallback candidate) has the identical limitation, and says so in its own README: *"The evaluator does **not** validate for duplicate cards... `evaluate([0,0,0,0,0])` → undefined behavior."* Its combinatorics-verification table (2,598,960 for 5 cards = C(52,5)) confirms it's built on the same single-52-card-deck domain (Cactus Kevin / Two-Plus-Two lineage) as every other lookup-table evaluator found in a broader search (HenryRLee/PokerHandEvaluator, Nerdmaster/poker, paulhankin/poker, etc.) — **this is universal to the entire class of perfect-hash poker evaluators**, not a gap specific to one package. No amount of further package search will turn up a fix; the algorithm family is fundamentally single-deck.

**Why a wrapper (not a rewrite) is the right shape**, also confirmed by reading source rather than assumed:

- `compare(a, b)` in the locked library is trivially extensible: `if (a.strength === b.strength) return handComparator(a.hand, b.hand); return a.strength < b.strength ? 1 : -1;` — it only needs `strength` to be a comparable ordinal and `hand` to be a rank-sorted card array. A custom `FiveOfAKind` value (e.g. `10`, one above the library's `RoyalFlush = 9`) slots in cleanly.
- `handComparator` does element-wise rank comparison across the `hand` arrays (`cardComparator` per index) — this generalizes correctly to a monorank 5-card "hand" array (e.g. five Aces) with no special-casing needed, since every element shares the same rank.
- **Recommended module shape:** before delegating to the locked evaluator, count rank occurrences in the specific 7-card grouping being evaluated (2 hole + up to 5 board). If any rank's count is ≥5 (only possible with a 2-deck shoe: 8 copies of each rank exist, so 5+ in a single player's best-7 is rare but real), short-circuit and construct `{ strength: FiveOfAKind, hand: <first 5 matching dealt cards> }` directly — this needs no library call at all, it's a `Map<Rank, Card[]>` tally. Otherwise, every other category (high card through quads and straight flush) is evaluated identically to single-deck play regardless of *which* physical duplicate a card came from — rank-count-based classification doesn't care that two "Ace of Spades" strings are both present as long as the count itself stays ≤4, which the untouched `evaluate`/`rankN` already handles correctly since duplicate-string cards just look like "another card of that rank" to the counting logic. Delegate to the existing `evaluate`/`compare` unchanged for that path.
- This means the new work is genuinely small: a rank-tally pre-check (~20 lines), an extended enum value, and a comparator that checks the pre-check's flag before falling through to the locked library's `compare`. **Not** a reimplementation of 7-card hand ranking.

**Integration point to flag as a fragility (MEDIUM confidence risk, worth a regression test):** the non-validating behavior of `evaluate`/`rankN` is an *implementation detail* observed by reading the current source, not a documented public guarantee (only `equity`/`odds` validation is called out in the changelog/README as intentional, stable behavior). If a future minor/patch version of `@poker-apprentice/hand-evaluator` adds duplicate validation to `evaluate` itself (plausible, since v4 already moved in the direction of "throw instead of producing meaningless results" for the equity path), the 2-deck wrapper would start throwing on ordinary ≤4-of-a-rank duplicate-card input. **Mitigation:** pin the exact locked version (already done via lockfile), and add a Vitest regression test that calls `evaluate()` with a deliberately duplicated card pair (e.g., two `'As'` entries) and asserts it does *not* throw — this test will fail loudly on any future upgrade that changes this behavior, before it reaches the Monte Carlo loop.

## Deck/Shoe Model: Extend, Don't Replace

No new package for shoe management either. The one real change: v1's single-deck "remaining cards" model is presumably a `Set<Card>` (each of the 52 rank+suit strings present or absent). A 2-deck shoe needs a **multiset** (each rank+suit string can have a remaining count of 0, 1, or 2), because `'As'` is no longer a unique identifier once two of them exist in the shoe. This is a small, mechanical change to existing dealing/exclusion logic (swap `Set<Card>` for `Map<Card, number>` or a flat `Card[]` shoe array with real duplicate entries and index-based draws) — not a new dependency, and it's the same underlying `pure-rand` shuffle either way. Worth a `fast-check` invariant when this ships: "the number of remaining cards with a given rank+suit label never exceeds `deckCount`."

## Package Legitimacy Audit

`slopcheck` (v0.6.1, installed locally) was run against every Blackjack-candidate package via `py -m slopcheck install <packages> --ecosystem npm`, plus `npm view <pkg> scripts` was checked for each (no postinstall scripts found on any candidate — moot anyway since none are being installed).

| Package | Registry | Age / Evidence | Source Repo | slopcheck | Disposition |
|---------|----------|-----------------|--------------|-----------|-------------|
| `blackjack-strategy` | npm | Last real release 2020-09-03; 178 dl/mo | gsdriver/blackjack-strategy | [OK] (`"Not exactly popular"`) | **Rejected** — wrong API shape (action-suggestion, not odds/EV), stale |
| `blackjack-simulator` | npm | Last release 2016-10-19; 12 dl/mo | gsdriver/blackjack-simulator | **[SUS]** (`"Only 12 downloads. Nobody uses this."`) | **Rejected** — dead |
| `engine-blackjack` | npm | Last release 2017-06-27; 376 dl/mo; **GPL-2.0** | kedoska/engine-blackjack | [OK] (`"Not exactly popular"`) | **Rejected** — abandoned (9 years) + copyleft license risk |
| `@blackjacktrainer/blackjack-simulator` | npm | Actively maintained; 373 dl/mo | mhluska/blackjack-simulator | [OK] (`"Not exactly popular"`) | **Rejected** — legitimate project, wrong product shape (bankroll/card-counting trainer, not per-hand odds); 4.3MB for ~5% surface usage |
| `miaoda-game-blackjack-rules` | npm | 27 days old; 1,106 dl/mo (anomalous for age) | **none linked** | **[SUS]** (`"27 days old"`, `"No source repository linked"`) | **Rejected outright** — matches AI-generated package-cluster pattern, unverifiable code |
| `miaoda-game-deck-core` | npm | 27 days old (dependency of above) | **none linked** | **[SUS]** (same as above) | **Rejected outright**, same reasoning |

**Packages removed due to `[SLOP]` verdict:** none reached that tier — `slopcheck` doesn't have hard evidence of malicious payloads for any candidate, but two (`miaoda-game-*`) are flagged `[SUS]` with red flags (no repo + anomalous downloads for age) serious enough to reject without further diligence, consistent with the project's existing practice of treating `[SUS]` + missing provenance as disqualifying rather than something to "look into more."
**Net result: zero new runtime dependencies for v2.0.**

## Installation

```bash
# No new packages required for Blackjack or multi-deck Hold'em.
# Both are hand-written TypeScript modules added to the existing src/ tree,
# built on already-locked dependencies (Comlink, pure-rand, Zustand,
# @poker-apprentice/hand-evaluator + @poker-apprentice/types).
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Hand-rolled Blackjack rules engine | `@blackjacktrainer/blackjack-simulator` | If a future milestone adds card-counting practice, bet-spread strategy, or multi-hand bankroll simulation as an actual product feature (not currently planned) — at that point its `Simulator`/`Game` classes solve a real problem this project doesn't yet have, and revisiting it would be worth the integration cost. |
| Thin wrapper around `@poker-apprentice/hand-evaluator` for 2-deck Hold'em | Standalone multi-deck evaluator written from scratch | If the wrapper's fragility risk (see Version Compatibility) ever materializes — e.g., a future major version of the locked library adds duplicate validation to `evaluate()` itself and breaks the non-throwing assumption — a standalone rank-counting evaluator (still simple: 13-bucket rank tally + a small ordered category table) becomes the fallback. Not needed today. |
| `Map<Card, number>` multiset shoe model | Flat `Card[]` array with real duplicate entries, drawn by index and spliced | Either works; the flat-array approach is arguably simpler to reason about for shuffle correctness (it's just a longer version of what v1 already has) and avoids introducing a new data structure pattern. Pick based on whichever integrates more naturally with the existing single-deck draw code once it's in front of you — this is an implementation detail, not a stack decision. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `engine-blackjack` | GPL-2.0 licensed and unmaintained since 2017 (dead `neutrino` build tooling); copyleft risk for a project that should stay freely shareable | Hand-rolled rules engine |
| `blackjack-strategy` / `blackjack-simulator` (gsdriver) | Both stale since 2016-2020, and `blackjack-strategy`'s API (basic-strategy action suggestions) doesn't produce the bust probability / dealer outcome distribution / EV this project needs regardless of staleness | Hand-rolled rules engine + existing Monte Carlo worker pattern |
| `miaoda-game-blackjack-rules` / `miaoda-game-deck-core` | `slopcheck`-flagged: no linked source repository, 27 days old, anomalous download count for age — matches an AI-generated package-cluster pattern seen across sibling `miaoda-*` packages published in the same window | Hand-rolled rules engine |
| Any poker "multi-deck" or "duplicate-card" evaluator package (none found, but flag for future search) | Every lookup-table poker evaluator (the two already vetted for this project, plus every other one surfaced in a broad search) is built on the C(52,5)/C(52,7) single-deck combinatorial domain — this is a property of the *algorithm family* (perfect-hash / Two-Plus-Two lookup tables), not a gap any specific package happens to have. A package claiming multi-deck/five-of-a-kind support should be treated with extra `slopcheck` scrutiny, since it would be solving a problem essentially no one else in the ecosystem has solved. | The thin wrapper described above |
| `@poker-apprentice/hand-evaluator`'s `equity`/`odds` (or `equityHoldem`) functions for 2-deck mode | These validate and **throw `DuplicateCardError`** on any duplicate card — which is guaranteed to occur in 2-deck mode | The low-level `evaluate`/`compare`/`rankN` primitives (already what v1 uses for its hand-rolled Monte Carlo loop), gated by the five-of-a-kind pre-check |

## Stack Patterns by Variant

**If a future milestone adds Blackjack side bets, insurance, or splits/doubles:**
- Still hand-roll. Each of these is a well-defined additional branch in the same small rules state machine (e.g., split = evaluate two independent hands from the same starting pair; insurance = a side EV calculation off the dealer's up-card being an Ace). None of it crosses the complexity threshold where a lookup-table-style library would pay for its integration cost — Blackjack's total rule surface, even fully loaded with casino-standard options, is an order of magnitude smaller than 7-card poker hand ranking.

**If a future milestone extends beyond 2 decks (e.g., a 6-deck "shoe game" mode, matching real casino Blackjack):**
- The multiset shoe model and the five-of-a-kind pre-check both already generalize to N decks with no design change — the pre-check is "count ≥5 of a rank," which doesn't care whether that's possible because of 2 decks or 6. Only the shoe's total card count and per-rank cap (`4 × deckCount`) change, both already parameterized by `deckCount` in the model recommended above.

**If profiling shows the five-of-a-kind pre-check pass adds measurable overhead inside the 200k-trial-per-second worker loop:**
- Unlikely (it's a 7-element rank tally, negligible next to the lookup-table evaluation it gates), but if it matters, reuse the existing `evaluate.ts` pattern of pre-allocated scratch buffers (`Uint8Array` rank-count buffer, module-scoped, not re-allocated per trial) rather than reaching for a different library — this is a micro-optimization within the hand-rolled module, not a stack change.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@poker-apprentice/hand-evaluator@4.3.0` | Custom 2-deck wrapper (new, this milestone) | Wrapper relies on `evaluate`/`rankN` **not** validating duplicate cards — this is current-source-confirmed behavior but not a documented public guarantee (only `equity`/`odds` validation is called out as intentional in the v4 changelog). Pin the exact locked version; add a regression test (see "Integration point to flag" above) that fails loudly if a future version changes this. |
| `@poker-apprentice/types@^1.4.0` | `HandStrength` enum extension | The locked enum tops out at `RoyalFlush = 9`. The custom `FiveOfAKind` value must be defined in project code (not in the upstream package) as a value `>9` (e.g. `10`) in a project-local extended enum/type used only in 2-deck mode, keeping the upstream type untouched. |
| Multiset shoe model (new) | `pure-rand@8.4.2` (locked) | No compatibility concern — `pure-rand`'s shuffle/sample functions operate on arrays of arbitrary length and don't inspect card semantics; extending from a 52-card array to a 104-card array (2 decks) or a per-rank count map requires no RNG-side change. |

## Sources

- GitHub (`poker-apprentice/hand-evaluator`, `main` branch, fetched directly): `README.md`, `src/core/rank.ts`, `src/core/hash.ts`, `src/core/constants.ts`, `src/evaluate.ts`, `src/compare.ts`, `src/types.ts`, `src/utils/handComparator.ts` — HIGH confidence, primary source, read directly rather than inferred
- GitHub (`poker-apprentice/types`, `main` branch): `src/types.ts` (`HandStrength` enum definition) — HIGH confidence, primary source
- GitHub (`aaurelions/pokertools`, `packages/evaluator/README.md`): duplicate-card behavior, combinatorics verification table — HIGH confidence, official README, directly fetched
- npm registry (`npm view`, live, 2026-08-24): version/publish-date/license/scripts data for `blackjack-strategy`, `blackjack-simulator`, `engine-blackjack`, `@blackjacktrainer/blackjack-simulator`, `miaoda-game-blackjack-rules`, `miaoda-game-deck-core` — HIGH confidence
- npmjs.org downloads API (`api.npmjs.org/downloads/point/last-month/...`, live, 2026-08-24) — HIGH confidence, authoritative download counts
- `slopcheck` v0.6.1 (local install, `pip show slopcheck`), run via `py -m slopcheck install <packages> --ecosystem npm` — HIGH confidence, direct tool output
- GitHub (`mhluska/blackjack-simulator`): project purpose, API shape (`Simulator`, `Game` classes), maintenance status — MEDIUM-HIGH confidence, fetched via WebFetch summary of repo content
- WebSearch: "poker hand evaluator five of a kind multiple decks" — MEDIUM confidence, corroborates (does not solely establish) the primary-source finding that no evaluator in the ecosystem supports multi-deck/five-of-a-kind
- WebSearch: Blackjack npm package landscape survey — MEDIUM confidence, used to enumerate candidates before deeper per-package verification

---
*Stack research for: v2.0 Blackjack & Multi-Deck milestone, Monte Carlo Poker Simulator*
*Researched: 2026-08-24*
