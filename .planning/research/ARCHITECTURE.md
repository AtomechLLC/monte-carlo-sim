# Architecture Research: v2.0 Blackjack & Multi-Deck Integration

**Domain:** Adding a second game (Blackjack) and a first-class deck-count variable to an existing, shipped Monte Carlo poker simulator
**Researched:** 2026-08-24
**Confidence:** HIGH (based on direct reading of the actual v1 codebase — `src/engine`, `src/worker`, `src/state`, `src/ui`, and their test files). Two items are flagged MEDIUM/LOW below because they depend on library behavior not yet exercised in this codebase, or on Blackjack interaction decisions this milestone hasn't made yet (owned by FEATURES research, not architecture).

## Current Architecture (v1, verified by reading)

```
┌──────────────────────────────────────────────────────────────────────┐
│ App.tsx (single Hold'em effect: gate → cache → deriveConditionedState│
│          → startSimulation → applySnapshot/cacheIfSettled)           │
├──────────────────────────────────────────────────────────────────────┤
│ UI            TableScene/Seat/HandDisplay/BoardDisplay  (Hold'em      │
│               shaped: hero + 3 opponents + 5-board, tableGeometry.ts) │
│               OddsPanel/OddsTable/WinTieLossDisplay (10-category      │
│               table + win/tie/loss, formatPct.ts)                    │
│               CardPicker (7 fixed Hold'em slots) / DealButton /       │
│               StreetControls                                         │
│               PlayingCard/CardBack/AnimatedCard/FlipCard (generic)   │
├──────────────────────────────────────────────────────────────────────┤
│ State (Zustand) gameStore (runout/street/revealedMask/dealNonce)      │
│               oddsStore (settledCache keyed "street|revealedMask")   │
│               pickerStore (7-slot draft, Set-based dup-block)        │
│               uiStore (pendingAnimationCount — fully generic)        │
│               simulationService (singleton worker + Comlink wrap)    │
├──────────────────────────────────────────────────────────────────────┤
│ Worker         simulation.worker.ts → Comlink.expose(createSimulationApi())│
│               simulationApi.ts (streaming loop: batch, run-token      │
│               supersession, throttled progress, validation)          │
│               protocol.ts (ProgressSnapshot: categoryCounts[10] +    │
│               win/tie/lose — Hold'em-shaped)                          │
├──────────────────────────────────────────────────────────────────────┤
│ Engine         cards.ts (FULL_DECK=ALL_CARDS, Set-based deckWithout) │
│               conditioning.ts (deriveConditionedState — sole reader  │
│               of PredeterminedRunout, Set-based remainingDeck)       │
│               equity.ts (runTrials — pure per-batch Hold'em trial)   │
│               evaluator.ts (ONLY importer of hand-evaluator lib)     │
│               rng.ts (createRng/drawN/createDrawer — array-based,    │
│               already deck-count/uniqueness agnostic)                │
└──────────────────────────────────────────────────────────────────────┘
```

**Load-bearing v1 disciplines that must survive this milestone unchanged:**
- D-01/D-02: predetermine the full outcome at deal time; exactly one function (`deriveConditionedState`) is allowed to read the raw predetermined runout for simulation input. Everything else reads through it.
- Run-token identity (not requestId equality) decides supersession in the worker (`simulationApi.ts`), guarding against a caller re-entering with the same id.
- `oddsStore`'s settled-cache is keyed by a composite "knowledge state" string and is never namespaced/partially invalidated — a knowledge change invalidates by changing the key space, not by deleting entries.
- The animation gate (`uiStore` + `useAnimationGate`/`useExitGate`) is a pure counter with no game-specific knowledge at all.

## (a) Game-Switching: Where Game Mode Lives, Store/Component Ownership

**New: `src/state/gameModeStore.ts`** — a small Zustand store, sibling to the existing stores, holding exactly two fields that are genuinely cross-cutting:
```ts
interface GameModeState {
  mode: 'holdem' | 'blackjack';
  deckCount: 1 | 2;
  setMode: (mode: 'holdem' | 'blackjack') => void;
  setDeckCount: (count: 1 | 2) => void;
}
```
This is the ONLY new store that both games read. Everything else splits cleanly by game because v1's stores are already, in practice, Hold'em-shaped, not generically "the game's" state:

| Store/Component | Today | v2.0 disposition |
|---|---|---|
| `uiStore.ts` | Generic animation-pending counter | **Shared, unmodified.** No poker knowledge in it at all — reused verbatim by Blackjack's own animated cards. |
| `gameStore.ts` | Hold'em `runout`/`street`/`revealedMask`/`dealNonce` | **Kept as-is, becomes the Hold'em-specific store** (rename optional, e.g. `holdemGameStore.ts`, but not required — file already lives at a Hold'em-specific path conceptually). |
| **New** `src/state/blackjackStore.ts` | — | Mirrors `gameStore`'s D-01/D-02 shape: a `PredeterminedBlackjackRound` (full shoe order / dealer hole card predetermined at deal time) plus a `deriveBlackjackConditionedState`-equivalent sole-reader function in a new `src/engine/blackjackConditioning.ts`. This is the single most valuable pattern to carry over unchanged — it's what keeps hidden dealer-hole-card information out of the simulation input by construction. |
| `oddsStore.ts` | Hold'em-shaped: `categoryCounts[10]`, `outcomes.win/tie/lose` | **Not reused as-is.** Extract the generic settled-cache/gate mechanics (`knowledgeKey`, `settledCache: Map`, `reset`/`applySnapshot`/`getCached`/`cacheIfSettled`/`clearCache`) into a factory `createOddsCacheStore<TSnapshot>()` in a new `src/state/oddsCacheStore.ts`. Rebuild `oddsStore.ts` (Hold'em) and a new `blackjackOddsStore.ts` on top of that factory, each typed to its own snapshot shape. Forcing both games' results into one struct (optional/nullable fields) would break the codebase's own "exhaustive under TypeScript" convention (see `CATEGORY_LABELS`'s 10-row exhaustiveness comment) — Blackjack has no hand-category histogram at all. |
| `pickerStore.ts` | Fixed 7-slot Hold'em union (`SlotId`), Set-based dup-block | **Not reused as-is.** Needs (1) a deck-count-aware rewrite regardless of Blackjack (see §c), and (2) a parallel `blackjackPickerStore.ts` with its own slot union (player card 1/2, dealer up-card, etc.) if Blackjack gets scenario construction. Recommend extracting the shared "count-based used-elsewhere" logic into a small helper both stores call, rather than a single generic store — the slot shapes are genuinely different closed unions. |
| `simulationService.ts` | Singleton worker + Comlink wrap, module-scope | **Split.** See §b — extract the worker-instantiation/crash-listener singleton into `src/worker/workerClient.ts`, then two thin per-game wrappers (`pokerSimulationService.ts`, `blackjackSimulationService.ts`) built on it. |
| `App.tsx` | Hard-wires the one Hold'em effect + all Hold'em JSX | **Becomes a thin shell.** Move the existing effect and JSX body, verbatim, into a new `src/ui/HoldemGame.tsx`. `App.tsx` keeps `MotionConfig` (game-agnostic) and renders `mode === 'holdem' ? <HoldemGame /> : <BlackjackGame />` based on `gameModeStore`, plus a new `GameModeSwitcher` control in the control bar. |

**Why this split, not a single generalized "gameStore":** v1's `gameStore` interleaves data (`runout`) with Hold'em-specific navigation semantics (`street`, `revealedMask` sized to `OPPONENT_COUNT`). Blackjack's progression (initial deal → hit/stand decision points → dealer plays out) is a different shape, not a parametrization of the same one — trying to force one store to cover both would reintroduce exactly the kind of nullable/optional-field sprawl the codebase has deliberately avoided everywhere else (see the exhaustive `Record<Rank,...>`/`Record<Suit,...>` maps in `PlayingCard.tsx`, the fixed 10-row `CATEGORY_LABELS`). Two stores sharing one *pattern* (predetermine-then-reveal-through-a-sole-reader) is more in keeping with the existing style than one store sharing one *shape*.

## (b) Worker Protocol: Generalizes as a Pattern, Not as a Payload Type

Reading `simulationApi.ts` closely: `createSimulationApi()` actually mixes two concerns that are currently inseparable:

1. **Generic streaming-Monte-Carlo machinery** (game-agnostic): the run-token identity-based supersession (`runToken === currentRunToken`), the batch loop bounded by `maxTrials`, the throttled-emission logic (`lastEmitAt`/`progressIntervalMs`), the `await new Promise((resolve) => setTimeout(resolve, 0))` cooperative yield that lets `cancel()`/a newer `runSimulation()` interrupt an in-flight loop, and `cancel(requestId)`'s guard against cancelling a superseded generation.
2. **Hold'em-specific payload logic**: the entry-point validation (`heroHole.length !== 2`, `VALID_BOARD_LENGTHS`, `OPPONENT_COUNT` checks, the remaining-deck overlap check), the `CATEGORY_COUNT`-sized totals array, and the calls into `runTrials`/`unknownCardsPerTrial` from `equity.ts`.

**Recommendation: extract (1) into a new `src/worker/streamingRunner.ts`**, a generic helper parameterized by the trial-batch function and the validation/merge/snapshot hooks:
```ts
export function createStreamingRunner<TConditioned, TBatch, TSnapshot>(config: {
  runBatch: (conditioned: TConditioned, trialCount: number, drawUnknown: () => Card[]) => TBatch;
  mergeBatch: (totals: TBatch, batch: TBatch) => void;
  makeEmptyTotals: () => TBatch;
  toSnapshot: (totals: TBatch, requestId: number, done: boolean) => TSnapshot;
  validate?: (conditioned: TConditioned) => void;
  unknownCardsPerTrial: (conditioned: TConditioned) => number;
  getRemainingDeck: (conditioned: TConditioned) => readonly Card[];
  options?: SimulationOptions;
}): SimulationApi<TConditioned, TSnapshot>
```
Then:
- **Modified:** `src/worker/simulationApi.ts` (Hold'em) becomes a thin config object wiring `runTrials`/`unknownCardsPerTrial` from `equity.ts` plus its existing validation into `createStreamingRunner`. This is a pure refactor — the existing `simulationApi.test.ts` should pass unchanged, which is the safety net that de-risks the extraction.
- **New:** `src/worker/blackjackSimulationApi.ts` wires a new `runBlackjackTrials`/`unknownCardsPerTrial`-equivalent from a new `src/engine/blackjackEquity.ts` into the SAME `createStreamingRunner`.
- **New:** `src/worker/blackjackProtocol.ts` defines Blackjack's own `ConditionedState`/`ProgressSnapshot`-equivalents (bust probability, dealer-outcome-distribution buckets, EV — not a 10-category histogram). Do not extend the existing `protocol.ts`'s `ProgressSnapshot` with optional Blackjack fields; keep the two payload shapes fully separate types, matching the `oddsStore` split rationale in §a.

**One worker file, two exposed APIs — not two worker threads.** `simulation.worker.ts` changes from `Comlink.expose(createSimulationApi())` to `Comlink.expose({ poker: createPokerSimulationApi(), blackjack: createBlackjackSimulationApi() })`. Rationale: only one game is ever actively simulating (mode switch, not simultaneous play), so a second worker thread buys nothing but doubles the crash-listener/lifecycle bookkeeping that `simulationService.ts` already carefully handles (see its `WR-02` hard-crash-routing comment) once per worker instead of once. The alternative — two separate `?worker`-imported modules, lazily instantiated per active mode for bundle-splitting — is a legitimate escape hatch if the Hold'em hand-evaluator dependency ever needs to be excluded from a Blackjack-only bundle, but at this app's scale (both games' logic combined is still tiny) it is premature, mirroring this project's own stated position on `Transferable`/`SharedArrayBuffer` ("don't add that complexity preemptively").

**`simulationService.ts` splits into three files, not two:** extract `src/worker/workerClient.ts` (the `new SimWorker()` + `Comlink.wrap()` singleton + the `error`/`messageerror` crash listeners) so it happens exactly once; then `pokerSimulationService.ts` and `blackjackSimulationService.ts` each hold their own independent `currentRequestId`/`onProgress`/`onError`/`progressProxy` closures built on top of the shared client, calling `api.poker.*`/`api.blackjack.*` respectively. Keep the requestId counters independent per game (simpler than one shared counter across two differently-typed APIs) but make the game-mode-switch handler call **both** services' `cancelSimulation()` defensively on every switch — cheap, idempotent, and closes a race if the user flips modes rapidly.

## (c) Deck-Count / Multiset Deck: What Breaks and Where

`rng.ts`'s `drawN`/`createDrawer` **already generalize with zero changes.** They operate on a plain `Card[]` via partial Fisher-Yates shuffle — duplicate string values in the pool shuffle and slice correctly with no uniqueness assumption anywhere in the implementation. This is worth stating plainly because it means the multiset problem is entirely confined to the *exclusion/validation* logic, not the *drawing* logic.

Everything that breaks does so because it uses `Set<Card>` membership ("is this card value known at all?") where a multiset deck needs a **count** ("how many of the `deckCount` copies of this value are still unaccounted for?"). Traced file-by-file:

1. **`src/engine/cards.ts`**
   - `FULL_DECK = ALL_CARDS` (52, always unique) needs a new `buildDeck(deckCount: 1 | 2): Card[]` that concatenates `deckCount` copies of `ALL_CARDS` (104 cards for 2 decks, each value appearing exactly `deckCount` times). Keep `FULL_DECK` as the 1-deck constant for backward compatibility with any code not yet deck-count-aware.
   - `deckWithout(excluded)` today: `new Set(excluded)` then filter — this removes **every** occurrence of a value that appears **anywhere** in `excluded`, which is only correct when both the deck and `excluded` contain each value at most once. **Break:** with a 2-deck pool, excluding one physical 'As' (because the hero holds it) must remove exactly one 'As' from the pool, leaving the second 'As' drawable — the Set-based filter removes both. **Fix:** rewrite as a `Map<Card, number>` occurrence-count exclusion (build counts from `excluded`, walk the deck once, skip an instance while its budget is `>0`, decrementing, otherwise keep it). This is a self-contained, independently property-testable change: "for `deckCount=1`, the new count-based `deckWithout` produces byte-identical output to today's Set-based version" is the regression-safety invariant to assert first.

2. **`src/engine/conditioning.ts`** (`deriveConditionedState`)
   - `const remainingDeck = FULL_DECK.filter((card) => !knownCards.has(card))` has the **identical** Set-based bug, duplicated independently of `cards.ts`'s `deckWithout` — this is worth fixing by having `deriveConditionedState` call the same generalized, count-based exclusion helper rather than maintaining two parallel implementations (a DRY opportunity, not just a bug fix). **Break, concretely:** in the 2-deck Hold'em variant, hero holds one 'As' and nobody else holds the other — `knownCards.has('As')` is `true` either way, so the current filter strips **both** shoe copies of 'As' out of `remainingDeck`, when exactly one copy should remain drawable. This directly under-counts the remaining deck and biases every downstream trial.
   - The `PredeterminedRunout` **shape** (`heroHole`/`board`/`opponentHoles`) itself needs no structural change — only how the pool it's drawn from is built (`buildDeck(deckCount)` instead of the hardcoded 52-card `FULL_DECK`) at `gameStore.deal()` time.

3. **`src/worker/simulationApi.ts`** (validation, in `runSimulation`)
   - `expectedRemainingDeckLength = FULL_DECK.length - 2 - knownBoard.length - 2 * revealedCount` hardcodes a 52-card total. **Fix:** parameterize on `deckCount * 52` (thread `deckCount` through `ConditionedState` or `SimulationOptions`).
   - **The overlap check is the one that actively breaks correctness, not just arithmetic:** `const overlapping = remainingDeck.filter((card) => knownCards.has(card))`, followed by throwing if any overlap exists. In a 1-deck game this is a correct invariant ("a known card can never also be in the drawable pool"). In a 2-deck game with duplicates enabled, it is **actively wrong** — it is expected and correct for `remainingDeck` to contain a card value that a player already holds, as long as fewer than `deckCount` total copies of that value are accounted for. **This check must become a per-value budget check** (`countInRemainingDeck(card) + countKnown(card) <= deckCount`) rather than "zero known-overlap allowed." Flag this explicitly for the roadmap/pitfalls pass — it's an assertion that will fire and hard-fail the very feature (duplicate cards) this milestone is building, unless rewritten deliberately rather than just loosened.
   - `runTrials`'s per-trial hero/opponent evaluation logic is otherwise deck-count-agnostic (plain `Card[]` in, `Hand` out) — its only 2-deck-specific need is routing to a different evaluator when duplicates are possible (see §d).

4. **`src/state/pickerStore.ts` / `src/ui/CardPicker.tsx`**
   - `setPick`'s `heldByAnotherSlot = SLOT_ORDER.some((otherSlot) => otherSlot !== slot && picks[otherSlot] === card)` and `CardPicker.tsx`'s `usedElsewhere = new Set(pickedCards(picks))` both assume a card value can occupy **at most one** slot ever — correct for 1 deck, wrong for 2, where the same rank+suit string can legitimately fill two different slots simultaneously (e.g., hero holds 'As' and the flop also shows 'As'). **Fix:** both need to become count-based against `deckCount` — block only when a value already occupies `deckCount` (not `1`) other slots. This is a direct, easily-testable break exactly where the milestone context anticipated it; the existing `pickerStore.test.ts` describe block name ("seven-slot draft with duplicate rejection") is the test file to extend with a `deckCount=2` variant, not a new file, since it's the same invariant loosened by a parameter.

5. **Blackjack's shoe is the same primitive, not a new one.** A Blackjack "1-deck" or "2-deck" shoe is exactly `buildDeck(deckCount)` from `cards.ts` — no separate shoe-building code needed. This is a good argument for landing the `cards.ts` generalization *before* Blackjack work starts: Blackjack becomes the first real consumer that exercises the multiset primitive under normal (non-error-path) conditions, catching bugs in a context with no legacy 1-deck behavior to regress.

## (d) 2-Deck Hold'em Evaluation: The Seam

`node_modules/@poker-apprentice/hand-evaluator`'s own README documents `DuplicateCardError` as a hard validation error: *"The same card appears more than once across all hole and community cards."* `evaluator.ts`'s existing `evaluateHand`/`compareHands` route through `evaluateHoldem`/`compare`, and `evaluator.ts` is explicitly commented as **the only module in the codebase permitted to import the library directly** — that invariant should not be broken by this milestone. Given that constraint, a 2-deck hand that happens to contain a duplicate card value cannot be routed through the existing evaluator at all; a 2-deck hand that happens **not** to contain any duplicate (still by far the common case even with two decks in play) evaluates identically to today and should keep using the fast lookup-table path unchanged.

**Recommended seam — a new `src/engine/duplicateEvaluator.ts`, `evaluator.ts` untouched:**
```ts
export function evaluateHandMultiDeck(
  deckCount: 1 | 2,
  holeCards: [Card, Card],
  communityCards: Card[],
): DuplicateAwareHand {
  if (deckCount === 1) return evaluateHand(holeCards, communityCards); // byte-identical to today
  const all = [...holeCards, ...communityCards];
  if (!hasDuplicateValue(all)) return evaluateHand(holeCards, communityCards); // common case, unchanged
  return evaluateWithDuplicates(all); // hand-rolled: five-of-a-kind + duplicate-rank kicker rules
}
```
This gives the roadmap a clean, independently-testable boundary:
- `deckCount === 1` path: zero behavior change, zero risk to the 216 existing tests.
- `deckCount === 2`, no duplicate in *this specific 7-card hand*: delegates straight to the existing, already-verified evaluator — this is the majority of 2-deck trials.
- `deckCount === 2`, duplicate present: isolated in one new module that needs its own comparator and its own top-of-ranking category (**Five of a Kind**, ranked above Royal Flush) — which means the `HandStrength` 10-value model becomes an 11-value model *conditionally*, only in 2-deck Hold'em mode. That has a UI consequence, not just an engine one: `CATEGORY_LABELS`/`OddsTable`'s fixed 10-row table (explicitly commented as "ten entries, not nine" today) needs an 11th conditional row, and `compareHands`'s sign-convention discipline needs a merged comparator that special-cases the new top category while delegating every other comparison to the existing `compareHands`.
- **Testing implication for the roadmap:** this is exactly the kind of hand-evaluation edge case the codebase's existing property-testing discipline (`fast-check`, `equity.property.test.ts`) is built for — budget real phase time for invariants like "a five-of-a-kind hand always outranks every possible non-duplicate 7-card hand" and "the multi-deck evaluator agrees with the standard evaluator on every hand with zero duplicate values," not just hand-picked example tests.
- **Confidence flag (MEDIUM):** the library's error table describes `DuplicateCardError` in the context of `odds`/`equity`/`evaluate`'s general validation section rather than explicitly confirming `evaluateHoldem` itself throws on duplicates in every call path. The architectural seam above (check-for-duplicates-first, delegate-or-hand-roll) is safe regardless of the exact answer — a duplicate-containing hand is simply never passed to the library either way — but this should be confirmed against the installed version during implementation rather than assumed.

## (e) Shared vs. Per-Game UI

| Component | Disposition | Why |
|---|---|---|
| `MotionConfig` wrapper (in `App.tsx`) | **Shared**, stays at true app root | Game-agnostic reduced-motion setting. |
| `PlayingCard.tsx`, `CardBack.tsx`, `AnimatedCard.tsx`, `FlipCard.tsx` | **Shared, unmodified** | Pure primitives — card code + faceUp boolean + animation key + pixel origin. No poker-specific logic; Blackjack's cards animate through the exact same components. |
| `useAnimationGate.ts` / `useExitGate` (and `uiStore`) | **Shared, unmodified** | Already fully generic (string/number keys), proven in this codebase, zero poker-specific logic. |
| `formatPct.ts` | **Shared, unmodified** | Pure `(count, total, pending) → string` formatter. |
| `tableGeometry.ts` | **Not shared as-is.** New sibling `blackjackTableGeometry.ts` | `PositionKey`/`POSITIONS` are a closed union hand-tuned to Hold'em's hero+3-opponent+5-board felt layout. Blackjack's felt (dealer + hero, no opponents, possibly split-hand slots) is a different static lookup table, not a parametrization of the same one — cheap duplication beats a leaky shared abstraction here, consistent with how `SlotId` in `pickerStore` is already a closed, game-specific union. |
| `TableScene.tsx`, `Seat.tsx`, `HandDisplay.tsx`, `BoardDisplay.tsx` | **Not reused.** New `BlackjackTable.tsx` etc. | Hard-coded to `OPPONENT_COUNT` opponents + a 5-card community row with reveal-button semantics. Blackjack needs its own composition root, built from the shared primitives above. |
| `OddsPanel.tsx` (the docking/`aria-busy` chrome) | **Pattern shared, instance per-game** | The "dock outside the felt, `aria-busy` reflects the animation gate" convention is worth repeating for a `BlackjackOddsPanel`, but its children (`OddsTable`, `WinTieLossDisplay`) are Hold'em-shaped and not reusable — see §a's `oddsStore` split. |
| `OddsTable.tsx`, `WinTieLossDisplay.tsx` | **Not reused.** New `BlackjackOddsTable`/`BlackjackEvDisplay` | Consume `oddsStore`'s Hold'em-shaped fields directly; Blackjack's result (bust %, dealer outcome distribution, EV) has no category histogram or win/tie/loss triad at all. |
| `DealButton.tsx`, `StreetControls.tsx` | **Not reused.** New Blackjack-equivalent controls | Wired directly to `gameStore`'s Hold'em actions. The *pattern* (thin button → one store action) repeats trivially. |
| `CardPicker.tsx` | **Not reused as one component**, but its rank/suit grid dialog is worth extracting | If Blackjack gets scenario construction, extract the generic "pick a card from a suit-grouped grid, disable already-used ones" piece into a shared `CardGridDialog.tsx`, reused by a Hold'em `CardPicker` and a new `BlackjackCardPicker`, each driving its own picker store (see §a). Don't force one component to branch on `SlotId` unions from two different games. |
| New `GameModeSwitcher` | **New, shared** | Small control reading/writing `gameModeStore`; lives in the app-level control bar alongside (not inside) either game's own controls. |

## Anti-Patterns to Avoid

### Anti-Pattern 1: One `ProgressSnapshot`/`oddsStore` shape for both games
**What people do:** Add optional Blackjack fields (`bustProbability?`, `dealerDistribution?`) to the existing Hold'em-shaped snapshot/store rather than creating a second one.
**Why it's wrong:** Breaks the exhaustiveness discipline already established (fixed 10-row `CATEGORY_LABELS`, exhaustive `Record` maps) and makes every consumer defensively null-check fields that are only ever meaningful for one game.
**Instead:** Two typed stores/snapshot shapes sharing one generic caching/gate *pattern* (§a, §b).

### Anti-Pattern 2: Loosening the `remainingDeck` overlap check instead of rewriting it
**What people do:** See the `runSimulation` overlap-check throw fire under 2-deck duplicates and just delete or `try/catch` around it to make the error go away.
**Why it's wrong:** That check is real defense-in-depth (the file's own comment: "a stale/malformed caller could otherwise silently double-count a card into a trial") — deleting it reopens exactly the bug class it exists to catch.
**Instead:** Replace the zero-overlap assertion with a per-value budget assertion (`count in remaining + count known <= deckCount`), so it still catches genuine double-counting bugs while permitting legitimate multi-deck duplication.

### Anti-Pattern 3: Two Comlink-wrapped worker threads for two games that never run concurrently
**What people do:** Spin up a second `?worker`-imported module for Blackjack alongside the existing one, each with its own crash-listener/singleton boilerplate.
**Why it's wrong:** Doubles lifecycle bookkeeping (`workerClient.ts`'s crash routing, per the existing `WR-02` fix) for zero benefit, since only one game is visible/simulating at a time.
**Instead:** One worker exposing two namespaced Comlink APIs (§b); revisit only if bundle size analysis later shows the poker evaluator meaningfully bloats a Blackjack-only load.

## Integration Points — New vs. Modified Files

### New files
| File | Purpose |
|---|---|
| `src/state/gameModeStore.ts` | `mode: holdem\|blackjack`, `deckCount: 1\|2` — the only genuinely cross-game store. |
| `src/state/blackjackStore.ts` | Blackjack's D-01/D-02-style predetermined-round store. |
| `src/state/blackjackOddsStore.ts` | Built on the extracted `oddsCacheStore` factory. |
| `src/state/oddsCacheStore.ts` | Generic `createOddsCacheStore<TSnapshot>()` factory, extracted from today's `oddsStore.ts`. |
| `src/state/blackjackPickerStore.ts` | (If Blackjack gets scenario construction) mirrors `pickerStore`'s shape with its own `SlotId` union, deck-count-aware dup-block. |
| `src/state/blackjackSimulationService.ts` | Thin per-game wrapper on `workerClient.ts`. |
| `src/worker/workerClient.ts` | Extracted singleton worker instantiation + Comlink wrap + crash listeners, shared by both game services. |
| `src/worker/streamingRunner.ts` | Extracted generic batch/cancellation/throttled-emission engine. |
| `src/worker/blackjackSimulationApi.ts` | Blackjack's config wiring into `streamingRunner`. |
| `src/worker/blackjackProtocol.ts` | Blackjack's `ConditionedState`/`ProgressSnapshot`-equivalents. |
| `src/engine/blackjackConditioning.ts` | Sole reader of the predetermined Blackjack round, mirroring `deriveConditionedState`. |
| `src/engine/blackjackEquity.ts` | Pure per-batch Blackjack trial loop, mirroring `equity.ts`'s `runTrials`. |
| `src/engine/blackjackHandValue.ts` | Bust/value/soft-ace logic — no poker evaluator dependency at all. |
| `src/engine/duplicateEvaluator.ts` | 2-deck Hold'em seam: delegate-when-no-duplicate, hand-roll (incl. Five of a Kind) when duplicates present. |
| `src/ui/HoldemGame.tsx` | Existing `App.tsx` effect + JSX body, moved verbatim. |
| `src/ui/BlackjackGame.tsx`, `BlackjackTable.tsx`, `BlackjackOddsPanel.tsx`, `BlackjackOddsTable.tsx`, `BlackjackEvDisplay.tsx`, Blackjack controls | New per-game UI, built from shared primitives (`PlayingCard`, `AnimatedCard`, `FlipCard`, `formatPct`). |
| `src/ui/blackjackTableGeometry.ts` | Blackjack's own position/deal-index lookup table. |
| `src/ui/GameModeSwitcher.tsx` | New shared control. |
| `src/ui/CardGridDialog.tsx` | (If Blackjack picker is in scope) extracted generic rank/suit grid, shared by both pickers. |

### Modified files
| File | Change |
|---|---|
| `src/engine/cards.ts` | Add `buildDeck(deckCount)`; rewrite `deckWithout` from Set-based to count-based multiset exclusion. |
| `src/engine/conditioning.ts` | Rewrite `remainingDeck` derivation to use the same count-based exclusion helper (currently duplicates `cards.ts`'s bug independently); thread `deckCount` through. |
| `src/worker/simulationApi.ts` | Refactor to a thin config on top of new `streamingRunner.ts` (pure refactor, should not change observed behavior for `deckCount=1`); parameterize `expectedRemainingDeckLength` on `deckCount`; replace the zero-overlap assertion with a per-value-budget assertion. |
| `src/worker/simulation.worker.ts` | `Comlink.expose({ poker: ..., blackjack: ... })` instead of exposing one API object. |
| `src/state/simulationService.ts` | Split into `workerClient.ts` + a renamed/kept `pokerSimulationService.ts`. |
| `src/state/pickerStore.ts` | `setPick`'s dup-block becomes count-based against `deckCount` (read from `gameModeStore`). |
| `src/ui/CardPicker.tsx` | `usedElsewhere` becomes count-based, not a flat `Set`. |
| `src/engine/equity.ts` | Route hero/opponent hand evaluation through `evaluateHandMultiDeck(deckCount, ...)` instead of calling `evaluateHand` directly, when `deckCount === 2`. |
| `src/ui/categoryLabels.ts`, `src/ui/OddsTable.tsx` | Conditionally render an 11th "Five of a Kind" row when the active Hold'em game is in 2-deck mode. |
| `src/App.tsx` | Reduced to `MotionConfig` + mode-based render of `HoldemGame`/`BlackjackGame` + `GameModeSwitcher`. |

## Recommended Build Order

The dependency chain runs from the deck primitives (everything needs them) → the worker-protocol extraction (both new game paths ride on it, and it's a pure, test-verifiable refactor before any new game logic complicates the picture) → the game-mode shell (isolates "did the Hold'em refactor regress anything" from "does Blackjack work" as separate, independently-verifiable questions) → Blackjack as a full vertical slice (the larger, more novel body of work, exercising the multiset-deck code under real, non-error-path conditions) → the 2-deck Hold'em evaluator (highest correctness risk, benefits from deck-count plumbing already being proven by Blackjack) → the cross-game deck-count toggle UI last, once both consumers exist.

1. **Multiset deck foundation** — `cards.ts` (`buildDeck`, count-based `deckWithout`) + `conditioning.ts` (route `remainingDeck` through the same helper) + `pickerStore.ts`/`CardPicker.tsx` (count-based dup-block). Property-test the regression invariant first ("`deckCount=1` output is byte-identical to today's Set-based behavior"), then the multiset invariants ("remaining ∪ known always reconstructs exactly `deckCount` copies of every value"). Pure engine/state work, no UI-visible change yet at `deckCount=1`.
2. **Worker protocol extraction** — pull `streamingRunner.ts` out of `simulationApi.ts`; refactor Hold'em's path onto it with zero behavior change (existing `simulationApi.test.ts` is the safety net). Do this *before* writing any Blackjack trial code, so the generic engine is proven against a known-good workload first.
3. **Game-mode shell** — `gameModeStore.ts`, split `App.tsx` into `HoldemGame.tsx` + a `BlackjackGame.tsx` placeholder + `GameModeSwitcher`, split `simulationService.ts` into `workerClient.ts` + per-game wrappers. Verify Hold'em's existing acceptance tests still pass unchanged under the new shell before touching Blackjack logic.
4. **Blackjack vertical slice** — `blackjackHandValue.ts`, `blackjackEquity.ts`, `blackjackConditioning.ts`, `blackjackStore.ts`, `blackjackSimulationApi.ts` (on the shared runner), `blackjackOddsStore.ts` (on the shared cache factory), minimal `BlackjackTable`/`BlackjackOddsPanel`. Treat this as its own multi-phase arc (core odds loop → scenario construction if in scope → table UI), mirroring how v1 built Hold'em, rather than one large phase.
5. **2-deck Hold'em variant** — `duplicateEvaluator.ts` (delegate-or-hand-roll), the conditional 11th `OddsTable` row, wiring `equity.ts`/`gameStore.deal()` to `deckCount`. Sequenced after Blackjack so the multiset-deck plumbing is already battle-tested by a real consumer; budget real phase time for property tests on the duplicate-evaluator's five-of-a-kind ranking and its agreement with the standard evaluator on zero-duplicate hands.
6. **Cross-game deck-count toggle UI** — surface `gameModeStore.deckCount` in both games' control bars once both consumers exist; apply the existing "picks persist, take effect on next deal" discipline (already established for `pickerStore`) rather than inventing new mid-hand-mutation rules for a deck-count change.

## Sources

- Direct reading of the shipped v1 codebase (HIGH confidence, primary source for every claim above): `src/engine/cards.ts`, `src/engine/conditioning.ts`, `src/engine/equity.ts`, `src/engine/evaluator.ts`, `src/engine/rng.ts`, `src/engine/streets.ts`, `src/worker/protocol.ts`, `src/worker/simulationApi.ts`, `src/worker/simulation.worker.ts`, `src/state/gameStore.ts`, `src/state/oddsStore.ts`, `src/state/pickerStore.ts`, `src/state/uiStore.ts`, `src/state/simulationService.ts`, `src/App.tsx`, `src/ui/TableScene.tsx`, `src/ui/OddsPanel.tsx`, `src/ui/OddsTable.tsx`, `src/ui/Seat.tsx`, `src/ui/CardPicker.tsx`, `src/ui/HandDisplay.tsx`, `src/ui/BoardDisplay.tsx`, `src/ui/WinTieLossDisplay.tsx`, `src/ui/AnimatedCard.tsx`, `src/ui/FlipCard.tsx`, `src/ui/CardBack.tsx`, `src/ui/PlayingCard.tsx`, `src/ui/tableGeometry.ts`, `src/ui/categoryLabels.ts`, `src/ui/lockedCategory.ts`, `src/ui/useAnimationGate.ts`.
- `node_modules/@poker-apprentice/hand-evaluator/README.md` (installed v4.3.0) — `DuplicateCardError` behavior (MEDIUM confidence for `evaluateHoldem`'s exact throw path specifically; HIGH confidence that duplicate-containing hands cannot be assumed safe to pass to the library).
- `node_modules/@poker-apprentice/types/dist/types/types.d.ts`, `constants.d.ts` — confirms `Card` is a plain string union (`${Rank}${Suit}`) with no built-in uniqueness constraint, and `HandStrength` is a 10-value (0-9) enum (HIGH confidence).
- `.planning/PROJECT.md` — v2.0 milestone scope and explicit exclusions (EDU-01/02/03 deferred to v3) (HIGH confidence, primary source).
- `CLAUDE.md` — v1 stack rationale (Web Worker/Comlink pattern, `pure-rand`, no `Transferable`/`SharedArrayBuffer` at this scale) used to justify the "one worker, two namespaced APIs" recommendation by consistency with existing stated principles (HIGH confidence, primary source).

---
*Architecture research for: Monte Carlo Poker Simulator v2.0 (Blackjack & Multi-Deck)*
*Researched: 2026-08-24*
