# Phase 7: 2-Deck Hold'em Evaluation Layer - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 18 new/modified production files + 9 new/amended test files
**Analogs found:** 16 / 18 production units (2 partial — see No Analog Found)

Every line reference below was verified against the working tree at commit `7d8fb13`. This map extends 07-RESEARCH's 12-point Integration Map with the analog conventions each new file must copy and the exact guard/golden pins each change collides with.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engine/evaluatorTwoDeck.ts` (new; name = Claude's Discretion) | engine module (evaluation wrapper) | transform (hot path) | `src/engine/evaluator.ts` + `src/engine/blackjackHandValue.ts` | role-match (composite) |
| `src/engine/equity.ts` (`runTrials`) | engine module (trial loop) | batch | itself (surgical edit) | exact |
| `src/worker/protocol.ts` | worker protocol constants | request-response | `src/worker/blackjackProtocol.ts` | exact |
| `src/worker/simulationApi.ts` (`mergeBatch`/`toSnapshot`) | worker service config | streaming | itself (surgical edit) | exact |
| `src/state/oddsStore.ts` (dev guard) | store | streaming consumer | itself (surgical edit) | exact |
| `src/state/gameStore.ts` (deckCount + deal) | store | CRUD/event | `src/state/blackjackStore.ts` | exact |
| `src/ui/HoldemGame.tsx` (toggle + plumbing) | component (game root) | event-driven | `src/ui/BlackjackControls.tsx` (toggle), itself (effect) | exact |
| `src/ui/OddsTable.tsx` (row source + locked routing) | component (data table) | request-response | itself (surgical edit) | exact |
| `src/ui/categoryLabels.ts` (additive 11-row source) | UI constant | — | `src/worker/blackjackProtocol.ts` derived-constant style | role-match |
| `src/ui/lockedCategory.ts` | UI utility (evaluator consumer) | request-response | itself (surgical edit) | exact |
| `src/ui/CardPicker.tsx` (deckCount wire, D-15) | component | event-driven | itself + `src/state/pickerStore.ts` | exact |
| Copy-cue derivation helper (new, e.g. `src/ui/copyCue.ts`) | UI utility (pure derivation) | transform | `src/ui/lockedCategory.ts` (leak-proof pure derivation) | role-match |
| Copy-cue badge render (in `PlayingCard.tsx`/felt callers) | component | — | `src/ui/BlackjackDealerArea.tsx` badge + `Seat.tsx` seat-label | role-match |
| `src/App.modeShell.guard.test.ts` (retarget) | guard test | — | its own amendment history (06-02, 06-07) | exact |
| `src/worker/deckCountValidation.test.ts` (retarget) | boundary test | — | itself | exact |
| `src/engine/shoePath.guard.test.ts` (D-07 extension) | guard test | — | itself | exact |
| Evaluation test suites (new) | tests | — | `evaluator.test.ts`, `equity.property.test.ts`, `blackjackNaturalFrequency.test.ts`, `blackjackDealerOutcome.test.ts` | exact |
| D-03 toggle-cache guard test (new) | test | — | `src/App.holdemCachePoison.test.tsx` | exact |

## Pattern Assignments

### 1. `src/engine/evaluatorTwoDeck.ts` — duplicate-aware evaluation module (new)

The algorithm itself is fully specified in 07-RESEARCH ("The Duplicate-Aware Evaluation Algorithm" — lift verbatim). What the analogs supply is the module's *shape*.

**Analog A: `src/engine/evaluator.ts` (wrapper conventions — the file the new module wraps)**

- **The import invariant (lines 3-14):** the header comment ends "This is the ONLY module in the codebase permitted to import `@poker-apprentice/hand-evaluator` directly." The new module MUST import from `./evaluator`, never the library:
  ```typescript
  // evaluator.ts lines 1-2, 14 — what the new module does NOT get to do:
  import { evaluateHoldem, compare } from '@poker-apprentice/hand-evaluator';
  ```
  The new module's imports are `import { evaluateHand, compareHands, HandStrength, type Hand } from './evaluator';` plus `ALL_CARDS`/`getRank`/`getSuit` from `@poker-apprentice/types` (types-package imports are unrestricted — `blackjackHandValue.ts` line 8 is the precedent).
- **Result shape (lines 19-22):** `export interface Hand { strength: HandStrength; hand: Card[]; }` — `HandTwoDeck` (research spec) extends this shape with optional `tiebreak?: number[]`; keep field names identical so stock-shaped results are assignable.
- **Comparator sign convention (lines 47-51):** `compareHands` returns `+1` when `a` is stronger, `0` tie (never `-0` — the special case is documented at lines 43-45), `-1` weaker. `compareHandsTwoDeck` must copy this exact convention, including the never-`-0` discipline, and delegate to `compareHands` for stock-shaped equal-strength pairs (research spec step 2).
- **Test-only escape hatch convention (lines 53-58):** `rawCompareForTesting` shows the house style for exposing internals to a single named test file with a doc comment naming that file. If the gate's stamped array or the proxy builder needs test visibility, use this pattern (e.g. `export const findDuplicatesForTesting = ...` with a comment naming the consumer).

**Analog B: `src/engine/blackjackHandValue.ts` (pure-function engine-module style — the best whole-file template)**

- **File header (lines 1-7):** states purpose, cites decision tags (D-03, D-04, D-08), and names the PITFALLS entries the code defends against. The new module's header should cite D-04/D-05/D-06/D-16 and PITFALLS Pitfall 7 (as corrected by 07-RESEARCH).
- **Module-scope lookup tables built once from `ALL_CARDS` (lines 32-42):**
  ```typescript
  // Module-scope card lookups, built ONCE at load by iterating ALL_CARDS. `getRank`
  // validates and throws on every invocation, so calling it per card inside a trial-loop
  // function would be measurable waste across a 200k-trial run — it is never called below
  // this block.
  const CARD_VALUE = new Map<Card, number>();
  const ACE_CARDS = new Set<Card>();
  for (const card of ALL_CARDS) {
    const rank = getRank(card);
    CARD_VALUE.set(card, RANK_VALUE[rank]);
    if (rank === 'A') ACE_CARDS.add(card);
  }
  ```
  This is exactly how the gate's `CARD_INDEX` / `RANK_OF` / `SUIT_OF` tables should be built (research gate spec). **One deviation is mandatory:** no `Set<Card>` and no `new Set(` anywhere in the new module — it joins `shoePath.guard.test.ts`'s prohibition list (see §8). `blackjackHandValue.ts`'s `ACE_CARDS` Set is legal only because that file is not on the shoe path; the new module IS. Use the `Int32Array(52)` stamp array (research spec) and `Map<Card, number>` lookups only.
- **Exhaustive `Record` literals (lines 16-30):** `RANK_VALUE: Record<Rank, number>` with the comment "so a missing rank is a compile error (the `RANK_TO_ASSET` discipline from `PlayingCard.tsx`)". Any rank-index table in the new module follows this.
- **Unreachable-guard style (lines 48-54):** total-by-construction lookups still throw a named error (`blackjackHandValue: unknown card ...`) as a type-narrowing guard. The proxy builder's defense-in-depth assertion (research: "throw loudly if a proxy suit reaches 5 that wasn't already ≥5-clean") uses this style — prefix the message with the module name.
- **Doc comments that name the trap being defended (lines 84-86, 104-108):** every non-obvious branch cites its pitfall. The gate's "value-equality, not rank-count-only" decision and the flush-zone `max(custom, proxy)` merit the same treatment.
- **Closed literal union style (line 67):** `export type DealerBucket = '17' | ... ` "Closed literal union, mirroring `DeckCount`'s style in `./shoe`". `FIVE_OF_A_KIND = 10 as const` + `ExtendedStrength` union (research spec) follows this.

**Analog C: `src/engine/equity.ts` (hot-path discipline — what the wrapper must not break)**

- **Zero per-trial allocation where possible:** `rng.ts` `createDrawer` (lines 34-43) reuses one working array across calls "to avoid per-trial GC pressure in hot loops" — the gate's module-scope stamp array + generation counter is the same idea; never allocate a Map/Set per evaluation call.
- **The trial loop the wrapper plugs into (lines 67-101):** evaluation call sites are lines 79-80 (`evaluateHand(state.heroHole, board)` / villains map) and comparisons at lines 87, 92, 97. Section 2 below covers the hoisting edit.

---

### 2. `src/engine/equity.ts` + category-index extension — every `categoryCounts` length/shape pin

**The edit (research Integration Map §2):** hoist `evalFn`/`cmpFn` selection and `categoryCounts` sizing out of the per-trial loop:

```typescript
// equity.ts line 63 today — the sizing pin to replace:
const categoryCounts = new Array(CATEGORY_COUNT).fill(0);
// line 82 — works unchanged at index 10:
categoryCounts[hero.strength]++;
```

`ConditionedState.deckCount` already exists (lines 21-22, "ABSENT MEANS 1") — the hoist branches on `state.deckCount ?? 1`. Copy the loop's own comment style: `runTrials`'s doc (lines 43-57) explains the max-then-count-ties reduction; extend that doc, do not fork the loop (research: "wrapper-in-path, not parallel path" — `blackjackEquity.ts` is explicitly NOT the analog here).

**Complete census of `categoryCounts` length/shape pins (verified by grep — this is exhaustive):**

| # | Site | Line(s) | What pins it | Required action |
|---|------|---------|--------------|-----------------|
| 1 | `src/worker/protocol.ts` | 10 | `export const CATEGORY_COUNT = 10;` | STAYS 10 (anti-pattern warning in research: never widen it). ADD `FIVE_OF_A_KIND_INDEX = 10` and `categoryCountFor(deckCount)` here. Note lines 1-2: protocol.ts is the value-exporting side of the protocol↔equity import direction ("equity.ts imports the runtime value CATEGORY_COUNT from this module") — `categoryCountFor` must live here too, or a runtime cycle appears. |
| 2 | `src/engine/equity.ts` | 63 (also doc refs 36, 50) | `new Array(CATEGORY_COUNT)` | Replace with `categoryCountFor(deckCount)` sizing (hoisted). |
| 3 | `src/worker/simulationApi.ts` | 103 (`makeEmptyTotals`), 110 (`mergeBatch` loop bound) | both hardcode `CATEGORY_COUNT` | `makeEmptyTotals` STAYS 10 (it cannot see `conditioned` — verified: `createStreamingRunner` config gives it no argument, and sizing it at 11 breaks 1-deck goldens, Pitfall 6). `mergeBatch` is the grow-on-merge site: extend `totals.categoryCounts` with zeros up to `batch.categoryCounts.length`, then loop to the batch length instead of `CATEGORY_COUNT`. `toSnapshot` (lines 117-124) already copies `[...totals.categoryCounts]` — length-agnostic, no change. |
| 4 | `src/state/oddsStore.ts` | 62-65 (dev guard), 44 (`initialOddsFields`) | guard hard-checks `length !== CATEGORY_COUNT`; initial fields sized 10 | Guard must accept `CATEGORY_COUNT` or `CATEGORY_COUNT + 1` (or `categoryCountFor` lengths). `initialOddsFields` line 44 can stay 10: `applySnapshot` (lines 90-95) replaces the array wholesale, and `OddsTable` line 51 reads `categoryCounts[index] ?? 0` — a missing index 10 renders as 0 pre-snapshot. The `categorySum === trialsCompleted` check (line 67) holds at length 11 unchanged. |
| 5 | `src/ui/OddsTable.tsx` + `src/ui/categoryLabels.ts` | OddsTable 45-47 ("Rows are always derived from CATEGORY_LABELS, never from categoryCounts.length"); categoryLabels 7-18 | row source is the 10-entry `CATEGORY_LABELS` | Add an additive 11-entry source (e.g. `CATEGORY_LABELS_TWO_DECK = [...CATEGORY_LABELS, 'Five of a Kind']` in categoryLabels.ts, derived — never a second hand-written list, the `BUCKET_INDEX` derivation discipline of `blackjackProtocol.ts` lines 24-30). Select by deckCount in OddsTable. Preserve the line 45-46 comment's contract: rows from the label source, never from `categoryCounts.length`. |
| 6 | `src/App.test.tsx` (FROZEN) | 132 | `expect(rowLabels).toEqual([...CATEGORY_LABELS]);` | **Do not widen `CATEGORY_LABELS` itself** — this frozen suite renders at deckCount=1 and compares the rendered rows against the whole constant. Widening the constant reds an untouchable file. This is why the 11-row source must be a NEW derived constant. |
| 7 | `src/engine/deckParity.golden.test.ts` | 62, 73 | 10-length `categoryCounts` literals (`[0, 1861, 1960, ...]`) | Untouchable. Green as long as `runTrials` at deckCount-absent returns length 10. Note lines 35, 56: it calls `deriveConditionedState(runout, 'preflop', 0)` with NO deckCount argument — `conditioning.ts` line 39's `deckCount: DeckCount = 1` default parameter is load-bearing for this golden; never make the parameter required. |
| 8 | `src/worker/streamingParity.golden.test.ts` | 62, 101 | 10-length literals + emission shape (line 82-83: exactly 4 snapshots) | Untouchable. Pins that `mergeBatch` growth must be a no-op at 1 deck (batch length 10 → no growth) and that batch/cadence knobs stay untouched. |
| 9 | `src/App.holdemCachePoison.test.tsx` | 56 | `categoryCounts: [100, 0, ..., 0]` (10 entries) in its snapshot fixture | Editable file, but its 10-length fixture must stay valid — another reason the oddsStore guard accepts both lengths rather than requiring 11. |
| 10 | `src/ui/lockedCategory.test.ts` | 30-37 | test titled "always returns a valid CATEGORY_LABELS index (0-9)" | Editable; holds for 1-deck inputs. New index-10 assertions go in sibling tests, don't rewrite this one. |

**Testid note:** OddsTable's per-row testids are index-derived (`category-pct-${index}`, `category-locked-${index}`, lines 50, 53) — the new row gets `category-pct-10`/`category-locked-10` for free; D-10 additionally requires `category-five-of-a-kind` on the row. Row `key={label}` (line 48) stays unique with the new label. Per D-09-as-amended (A2): the shipped table is ascending (High Card = first DOM row, Royal Flush = last), so Five of a Kind is the LAST DOM row.

---

### 3. `src/state/gameStore.ts` — deckCount field + deal-over-shoe + toggle→fresh-deal (D-02, D-14)

**Analog: `src/state/blackjackStore.ts` (exact — the D-10 store-locality precedent D-14 mirrors)**

- **Field declaration + doc (lines 42-43):**
  ```typescript
  /** Blackjack-LOCAL shoe size (D-10) — lives here, never in the cross-game mode store. */
  deckCount: DeckCount;
  ```
  Copy the "-LOCAL ... lives here, never in the cross-game mode store" framing (cite D-14). Import `type DeckCount` from `../engine/shoe` (blackjackStore line 5).
- **`setDeckCount` same-value early return (line 185):** `if (get().deckCount === deckCount) return;` with the comment "The already-selected segment is a harmless no-op ... nothing changes, nothing arms, the cache stays." Copy verbatim in spirit. The Hold'em body then follows D-02 (research Code Examples, lift verbatim):
  ```typescript
  setDeckCount: (deckCount: DeckCount) => {
    if (get().deckCount === deckCount) return;      // no-op click, never arms anything
    set({ deckCount });
    if (get().runout !== null) {
      get().deal();  // fresh deal: clears cache (D-03), bumps dealNonce (CR-02 stream guard)
    }
  },
  ```
  **Deliberate divergences from the analog to document in-code:** (a) no duplicate-guard refusal branch (blackjackStore lines 186-197) — Hold'em redeal makes 2→1 always legal, there is no retained table to invalidate; (b) no `beginAnimation()` from setDeckCount itself (blackjack line 214's rule: "a deck toggle is not a card animation") — the fresh `deal()` arms it; (c) no odds-store calls from setDeckCount — `deal()` already owns `clearCache()` (gameStore line 90).
- **`deal()` pool swap (line 50):** `const pool = deckWithout(picked);` becomes `shoeWithout(get().deckCount, picked)`; the import at line 3 (`deckWithout` from `../engine/cards`) gains/swaps to `shoeWithout` from `../engine/shoe`. Byte-identical at 1 deck is already proven: `shoe.ts` lines 62-64 ("Walking in order ... is what makes `shoeWithout(1, x)` reproduce `deckWithout(x)`'s output exactly, including its ordering") + `deckParity.golden.test.ts`. `CARDS_PER_DEAL` (13) and the merge-on-deal single-shuffle discipline (lines 43-52 comments) unchanged.
- **Ordering discipline inside `deal()` (lines 82-90):** `set(...)` → `beginAnimation()` → `clearCache()` with the two explanatory comments — leave intact; the toggle path inherits all three by calling `deal()`.

**TRAP — modeShell "no mode branch" sweep reads gameStore.ts RAW, comments included:** `App.modeShell.guard.test.ts` lines 111-134 asserts `state/gameStore.ts` (and oddsStore/pickerStore/uiStore/conditioning.ts) contains neither `"blackjack"` nor `"gamemode"` **case-insensitively, in the raw source** (no comment stripping — line 121: `readSource(relativePath).toLowerCase()`). The new deckCount comments in gameStore.ts must NOT say "mirrors blackjack's..." or mention `gameMode` — cite "D-14" and "the D-10 store-locality precedent" without naming the other game.

**Test analog:** `blackjackStore.test.ts` lines 418-529 (`setDeckCount()` describe block) — conventions to copy: `arms()` spy on the animation gate asserting `arms()).toBe(0)` for non-animating actions; reference-identity assertions for no-op paths (line 494: `expect(useBlackjackStore.getState()).toBe(storeBefore)`); one test per semantic branch (same-value no-op / idle set / mid-hand redeal). `gameStore.test.ts`'s own harness (lines 20-24) resets state via `setState({ runout: null, street: 'preflop', revealedMask: 0, dealNonce: 0 })` — **when deckCount lands, that `beforeEach` must add `deckCount: 1`** or a prior test's `deckCount: 2` leaks into the frozen-ish "13 distinct cards" test (lines 34-52), which is only valid at 1 deck.

---

### 4. `src/ui/HoldemGame.tsx` — toggle + effect changes (D-01, D-02) + guard retarget

**Analog: `src/ui/BlackjackControls.tsx` lines 67-93 (the Phase 6 A4 segmented control D-01 mirrors "verbatim")**

```tsx
{/* Structural twin of GameModeSwitcher (A4): segment labels never change with state;
    `aria-pressed` alone carries which count is active. The active segment is never
    `disabled` — clicking it is a harmless no-op routed through setDeckCount (the store's
    same-value early return). */}
<div data-testid="blackjack-deck-toggle" role="group" aria-label="Deck count">
  <button type="button" data-testid="blackjack-deck-toggle-1" aria-pressed={deckCount === 1}
          onClick={() => setDeckCount(1)}>
    1 deck
  </button>
  <button type="button" data-testid="blackjack-deck-toggle-2" aria-pressed={deckCount === 2}
          onClick={() => setDeckCount(2)}>
    2 decks
  </button>
</div>
```

Copy: wrapper `role="group" aria-label="Deck count"`, `aria-pressed`, labels `1 deck` / `2 decks` verbatim, active-segment-never-disabled comment. **Omit** the blackjack-only `disabled={duplicateOnTable}`/`title` half (lines 76-81) — D-02's fresh-deal semantics make every switch legal in Hold'em. Testids per D-10: `holdem-deck-toggle`, `holdem-deck-toggle-1`, `holdem-deck-toggle-2`. Placement (Claude's Discretion): the control bar is HoldemGame lines 190-203 (`GameModeSwitcher` → `DealButton` → Set Up Scenario → `StreetControls`). Store reads follow BlackjackControls lines 20/24 (`useBlackjackStore((state) => state.deckCount)` / `setDeckCount`) — here from `useGameStore`.

**Effect plumbing:** line 103 `const conditioned = deriveConditionedState(runout, street, revealedMask);` gains the `deckCount` argument (a subscribed store read, following the line 27-30 selector style). Research §10: adding `deckCount` to the dependency array (line 139) is not strictly needed (D-02: any mid-hand change bumps `dealNonce`; idle changes early-return at `!runout`) but is harmless belt-and-braces — **if added, insert BEFORE `pendingAnimationCount`**, because the modeShell guard (lines 214-223) pins that the array literally ends with `pendingAnimationCount, mode]`.

**Guard collisions on this file (all same-commit, 06-07 precedent):**

1. `App.modeShell.guard.test.ts` lines 226-243: the deckCount-zero sweep list at line 233 is `['App.tsx', 'state/gameModeStore.ts', 'ui/GameModeSwitcher.tsx', 'ui/HoldemGame.tsx']`. **Remove ONLY `'ui/HoldemGame.tsx'`** in the same commit that adds the toggle, updating the block comment (lines 227-232) and the assertion message (lines 237-241) to cite Phase 7/D-01/D-12 — the exact move this file performed for BlackjackScene in 06-07 (documented lines 41-49) and mandated by the standing rule (lines 29-33). The three shell files stay deckCount-free forever.
2. Same file, lines 146-159: HoldemGame must keep exactly ONE `cancelSimulation(` call site outside comments — the toggle must not add a second cancellation path (the fresh `deal()`/dealNonce mechanism is the supersession path).
3. Same file, lines 203-212: the literal `if (mode !== 'holdem') return;` must survive as the effect's first check.

---

### 5. `src/ui/lockedCategory.ts` — the main-thread evaluator call site (research Pitfall 3)

**The site, named:** `src/ui/lockedCategory.ts` line 26 — `return evaluateHand([heroHole[0], heroHole[1]], [...knownBoard]).strength;` — the ONLY production `evaluateHand(` call site outside `equity.ts` (verified by grep: equity.ts lines 79-80 and this line are the complete set). At 2 decks its input (visible hero hole + board from `deriveConditionedState`) can contain duplicates — this call must route through `evaluateHandTwoDeck` when deckCount=2 (extend the signature with a `deckCount: DeckCount = 1` parameter, the `conditioning.ts` line 39 default-parameter convention, so all 1-deck callers and `lockedCategory.test.ts` stay untouched).

**Caller:** `src/ui/OddsTable.tsx` lines 17-27 (`lockedIndex` memo). Line 22 `deriveConditionedState(runout, street, revealedMask)` gains `deckCount`; line 26 passes it to `lockedInCategory`. The memo deps (line 27: `[pending, runout, street, revealedMask]`) gain `deckCount` — same belt-and-braces reasoning as §4. Copy the memo's numbered-comment style (lines 18-25: "(1) Cards come from `deriveConditionedState` — the ONLY sanctioned reader...").

**Free behavior:** the extended return (10) makes the ✓ column work on the new row with zero further change — OddsTable line 54 `lockedIndex === index` matches index 10 against the appended row.

**Return-type note:** `lockedInCategory` currently returns `HandStrength | null` (lines 20-23); the extension returns `ExtendedStrength | null`. `HandStrength` is re-exported from `evaluator.ts` (line 16) — import `ExtendedStrength` from the new wrapper, keeping lockedCategory.ts free of any library import.

---

### 6. `src/ui/CardPicker.tsx` + `src/state/pickerStore.ts` — deckCount wire (D-07, D-15, closes WR-01)

**The pinned site:** `CardPicker.tsx` lines 16-24 —

```typescript
/**
 * Fixed deck count for this phase (D-09): ... Phase 8 (cross-game deck-count toggle):
 * replacing this const with a `gameModeStore` read is NOT sufficient on its own — the
 * `setPick(openSlot, card)` call below MUST also pass `deckCount` as its third argument,
 * or the store keeps blocking at its default of 1 while `isUsed` shows a second copy as
 * available (silent lost picks — 04-REVIEW WR-01).
 */
const deckCount: DeckCount = 1;
```

The comment itself documents both halves of the fix: (a) the const becomes a live read of **Hold'em's** deckCount — per D-14 that is `useGameStore((state) => state.deckCount)`, NOT a `gameModeStore` read as the (pre-Phase-6-decision) comment speculates; (b) line 44 `setPick(openSlot, card);` becomes `setPick(openSlot, card, deckCount);`. `isUsed` (lines 53-58) already threads `deckCount` into `remainingCopies` — it goes live automatically. Rewrite the lines 16-24 comment to record WR-01's closure (cite D-15).

**Store side needs ZERO changes** — `pickerStore.ts` `setPick` (lines 80-85) and `remainingCopies` (lines 61-64) are already count-aware (Phase 4 DECK-04), with store-level tests at `pickerStore.test.ts` lines 106-167 already covering both-copies/third-blocked/re-pick-own-slot at deckCount=2.

**Behavioral test analogs (the D-07 requirement is UI-level tests):** `CardPicker.test.tsx` lines 89-114 are the exact templates —
- "a card held by a DIFFERENT slot renders disabled, with `(used)` text and the used-reason title" (89-101): the 2-deck sibling asserts the SECOND pick of `As` succeeds and only the THIRD encounter shows `As (used)`/disabled/`title="Already used in this hand"`.
- "the card held by the slot currently being edited is NOT marked used" (103-114): re-verify at deckCount=2.
- Harness: `beforeEach` resets picks via `usePickerStore.setState({ picks: { ...EMPTY_PICKS } })` (lines 17-20); the 2-deck tests must ALSO seed `useGameStore.setState({ deckCount: 2, ... })` and reset it — CardPicker now subscribes to gameStore, a new test-isolation surface this file never had.

**TRAP — new store subscription vs. guard sweeps:** `CardPicker.tsx` is in `shoePath.guard.test.ts`'s `noSetFiles` list (line 29) — no `Set<Card>`, no `new Set(` may appear in the edit. It is NOT in the modeShell "no blackjack/gameMode" sweep, but keep the rewritten comment free of `gameModeStore` claims that contradict D-14. Also note `pickerStore.ts` IS in the modeShell raw-source sweep (line 116) — if it were touched (it should not be), no "blackjack" tokens even in comments.

**Deal-time integration:** picks with two copies of a value flow into `deal()`'s `shoeWithout(deckCount, picked)` correctly because `pickedCards` (pickerStore lines 44-51) preserves duplicates (it never dedups) and `shoeWithout` (shoe.ts lines 70-82) removes one physical copy per occurrence.

---

### 7. Copy-cue badge (HE2-03, D-08)

**Badge visual conventions — the tokens D-08 mandates:**
- `src/index.css` lines 22-28: `--seat-badge-bg: rgba(0, 0, 0, 0.45); --seat-badge-text: #ffffff;` (with lines 77-78 noting dark mode deliberately does not override them).
- `src/App.css` lines 433-440: `.seat-label` applies `background: var(--seat-badge-bg); color: var(--seat-badge-text);` — the shipped badge treatment. The outcome banner (lines 742-754) reuses the same tokens ("badge tokens, never destructive") — precedent that new badge-shaped UI reuses `--seat-badge-*` rather than minting tokens.

**Badge markup analog: `src/ui/BlackjackDealerArea.tsx` lines 123-138** — the richest badge in the codebase (dynamic content, nested testid, explicit aria decision):

```tsx
{/* NOT aria-hidden — a deliberate divergence from Seat.tsx's opponent badge: the
    "Dealer" context and the live A11 total are information not duplicated elsewhere ... */}
<span data-testid="blackjack-dealer-label" className="seat-label">
  Dealer
  {dealerTotal !== null && (
    <>
      {' · '}
      <span data-testid="blackjack-dealer-total">...</span>
    </>
  )}
</span>
```

Copy: conditional-content-inside-a-badge shape, the explicit in-comment aria reasoning (the copy cue must be screen-reader-labelled per D-08 — so NOT `aria-hidden`, following this file's divergence note, vs. `Seat.tsx` line 178 where the opponent label IS `aria-hidden` because the button's aria-label duplicates it), and a testid on the badge (lowercase-hyphenated, per D-10 — the UI spec names the exact string).

**Badge placement — rides the card, not the slot (D-08):** the badge must be render-time content inside the `AnimatedCard` wrapper so it inherits fly-in/flip/restore. Three render paths carry face-up cards on the felt:
1. Hero holes: `Seat.tsx` lines 75-84 — `<AnimatedCard ...><PlayingCard card={card} /></AnimatedCard>`.
2. Board: `BoardDisplay.tsx` lines 79-88 — same shape inside `<AnimatePresence key={dealNonce}>`.
3. Revealed opponent holes: `Seat.tsx` line 128 → `FlipCard` → `PlayingCard` at `FlipCard.tsx` line 76 (`<PlayingCard card={card} decorative />`). Note FlipCard's face only mounts when revealed (lines 71-78, the T-03-12 leak guard) — the badge on an opponent copy therefore also only exists in the DOM after reveal, which is correct (second-copy determination uses only visible cards).

The lowest-friction insertion consistent with "single card-code → art bridge" (`PlayingCard.tsx` lines 12-23) is an optional prop on `PlayingCard` (e.g. `copyCue?: boolean`) rendering the badge span next to the `<img>` — `PlayingCard`'s props interface (lines 84-90) is the extension point, and `FlipCard`/`Seat`/`BoardDisplay` thread it through. Mechanism is Claude's Discretion; whatever is chosen, the badge must NOT be a sibling of `AnimatedCard` (it would not ride the motion span, `AnimatedCard.tsx` lines 83-96).

**WHY felt keys must stay positional (document in the plan):** every felt key is `${slot}-${dealNonce}` — `Seat.tsx` lines 76-77 (`hero-${slot}-${dealNonce}`), line 127/142-143 (`opponent-${index}-${slotIndex}-${dealNonce}`), `BoardDisplay.tsx` lines 80-81 (`community-${index}-${dealNonce}`) — each with the comment "never card identity, 03-RESEARCH Anti-Patterns", and `AnimatedCard.tsx` lines 15-17 documents `animationKey` the same way. At 2 decks two IDENTICAL cards can be on the felt simultaneously; a value-based key would collide (duplicate React keys → unmount/remount corruption) and would make Motion retarget an in-flight card. Positional keys are what make duplicates safe BY CONSTRUCTION. The copy-cue work adds render content only — it must not touch any `key`/`animationKey`/`flipKey` expression (PITFALLS Pitfall 9/14; current code verified clean).

**Second-copy derivation (new pure helper):** analog is `lockedCategory.ts`'s structurally-leak-proof pure-function pattern (lines 8-19: "this function can only ever see the cards its caller passes in") — a pure function of `(runout, street, revealedMask)` visible cards in the canonical scan order (research §9: hero holes → board in street order → revealed opponents by seat index; seat order, not reveal chronology — `revealedMask` is a set, gameStore line 17). Visible only at deckCount=2. Test it headlessly like `lockedCategory.test.ts` (`@vitest-environment node`, known-vector style).

---

### 8. WR-03 retirement (D-12) — the complete retarget census

Grep-verified: tokens `WR-03` referring to the STATE-blocker appear in exactly TWO files (plus this phase's planning docs):

| Site | Lines | Retarget action |
|------|-------|-----------------|
| `src/App.modeShell.guard.test.ts` | 24 (header bullet "nothing here may pass `deckCount: 2` ... before Phase 7's duplicate-aware evaluator exists (D-10, WR-02, WR-03)"), 226 (describe title), 227-232 (block comment), 240 (assertion message) | Same commit as the HoldemGame toggle: remove `ui/HoldemGame.tsx` from the line 233 list; rewrite the WR-03 rationale in the comment/title/message to "the shell files stay deckCount-free (D-10); Hold'em's deckCount lives in gameStore (Phase 7 D-14)". Never delete the describe block — the three shell files keep the sweep. |
| `src/worker/deckCountValidation.test.ts` | 97-114 — the 06-03 acceptance test: title "accepts an explicit deckCount of 2 at the validation boundary (WR-03 keeps the 2-deck TRIAL path off-limits)", comment lines 98-104, and the pinned rejection `'runSimulation: remainingDeck must have exactly 102 cards, got 101'` | RETARGET, never delete (D-12): the test becomes a real end-to-end 2-deck run — valid `shoeWithout(2, heroHole)` remainingDeck (102 cards) + `deckCount: 2`, run to `done`, assert an 11-length `categoryCounts` snapshot whose sum equals `trialsCompleted` (the research §3 shape). Keep the file's conventions: `pokerState()` factory (lines 26-37), `waitUntil` helper, exact-error-message assertions for the still-valid rejection cases (lines 61-76 stay). The `102 cards, got 101` string may survive as a plain malformed-length rejection test — what retires is only the "trial path off-limits" framing. |

**NOT WR-03-the-blocker (do not touch):** `src/App.tsx` line 7 and `src/ui/HoldemGame.tsx` line 21 say "05-REVIEW WR-03" — that is a Phase 5 REVIEW finding (the HoldemGame extraction), an unrelated identifier collision. Leave both comments alone.

**`conditioning.ts` note (task-list item, verified):** `conditioning.ts` contains NO WR-03 comment. Its relevant convention is the line 39 default parameter `deckCount: DeckCount = 1` — already shipped, already documented (lines 30-33 explain 2-deck count-aware subtraction). Phase 7 changes NOTHING in this file (research §6); its two Hold'em call sites gain the argument (HoldemGame line 103, OddsTable line 22). The default must stay (golden dependency, §2 row 7) — and `conditioning.ts` sits in BOTH raw-source guard sweeps (modeShell lines 111-134, shoePath line 29), one more reason to leave it untouched.

**Worker validation:** `simulationApi.ts` lines 39-90 already accept deckCount=2 with correct `shoeSize(deckCount)` length arithmetic and the per-value copy-budget overlap check (lines 63-90) — verified, no production validation change needed for D-12; only the test retarget above.

---

### 9. Tests — analogs and conventions per suite

**(a) Duplicate-evaluation known-answer vectors** — analog `src/engine/evaluator.test.ts` (whole file, 63 lines): `@vitest-environment node` header; lettered test titles `(a)`..`(f)`; hand-literal fixtures typed `const hole: [Card, Card] = ['As', '2h']`; exact `HandStrength` assertions; the sign-convention pin (lines 53-62) as the template for pinning `compareHandsTwoDeck`'s convention against `compareHands`. The research's `GATE_SHAPES` table (07-RESEARCH Code Examples) plugs directly into this style via `it.each`. Per D-16: every vector asserts VALUES (category + tiebreak), never mere non-throwing.

**(b) Property suites** — analog `src/engine/equity.property.test.ts`:
- Import pattern: `import { test, fc } from '@fast-check/vitest';` + `import { expect } from 'vitest';` (lines 2-3).
- **The 30s-timeout precedent for heavy properties, lines 24-40:** the third argument `30_000` after the property body, with the comment "comfortably fast alone (~2.4s) but can exceed vitest's 5s default under full-suite CPU contention (51 parallel files)". The oracle-vs-candidate sweep (brute-force best-of-21 per case) should budget the same way.
- Seeded `createRng(seed)` from fc-generated integers (lines 24-28).
- **Trap:** the `(c)` property title and its `new Set(allCards).size).toBe(13)` assertion are byte-pinned by `shoePath.guard.test.ts` lines 74-82 — 2-deck invariants are ADDITIVE SIBLINGS ("13 physical cards with per-value count ≤ deckCount"), following `multisetSampling.property.test.ts`'s explicit sibling pattern (lines 12-14: "the 2-deck-aware siblings of conditioning.test.ts's 1-deck-only properties ... additive, never a loosening", and lines 29-33 explaining WHY the 1-deck property cannot be generalised). Count-shaped assertions use `cardCounts` (lines 50-54), never Set-size.
- The monotonicity property ("adding a copy never weakens") and the "gate-flagged windows are never HighCard" property (research validation Leg 3 + histogram note) fit this file's shape directly.

**(c) Five-of-a-Kind seeded anchor** — analog `src/engine/blackjackNaturalFrequency.test.ts` (whole file, 96 lines — the closest structural match in the codebase). Conventions to copy:
- Closed-form constants with derivation shown in comments (lines 36-42): Phase 7's are Anchor A `93,318 / 83,291,670 = 1.1204×10⁻³` (research, hero `[Ah, Ah]`, 200k trials, 3σ count band `[179, 269]` on `categoryCounts[10]`).
- Band arithmetic documented in a comment (lines 44-49): SE shown, band justified as ~Nσ, and what failure mode the band detects.
- **The STANDING RULE comment (lines 22-27):** "the correct response to a red test in this file is to fix the sampling code, NEVER to widen the band ... RAISE N or change the seed and re-derive". Copy verbatim in spirit — research Assumption A3 depends on it.
- `const SEED = 20260824;` (line 31 — the house seed), explicit timeout const with rationale (lines 33-34, `120000`).
- Companion assertions mirroring Phase 6 D-12's design (research anchor section): `categoryCounts[10] > 0` at 2 decks, `=== 0` (or absent) for every deckCount=1 run.
- Hero `[Ah, Ah]` fixture doubles as the D-07 both-copies picker path exercised at the engine level.

**(d) Statistical shape/ranking checks** — analog `src/engine/blackjackDealerOutcome.test.ts`: header comment discipline (lines 9-22) stating provenance, WHY exact percentages are NOT asserted, and the raise-N-don't-loosen rule (line 17-18); `TRIALS_PER_UPCARD = 200000`, seeded, `120000` timeout (lines 24-28). Template for the optional dup-branch-share sanity band (research: "assert only a generous band (10-35%) or skip").

**(e) D-03 toggle-cache guard test (new, App-level)** — analog `src/App.holdemCachePoison.test.tsx` (whole file):
- Explicit `vi.mock` factories for BOTH simulation services with the jsdom-Worker rationale comment (lines 29-42).
- `resetStores()` covering all seven stores + `resetAnimations()` ordering note (lines 63-95) — the new test's reset must ALSO include `deckCount: 1` in the gameStore setState once the field exists.
- Internally-consistent snapshot fixtures (lines 51-61: "category and outcome sums both equal trialsCompleted, so the dev-only store consistency guard stays silent").
- The `callIndex` distinct-settled-values trick (lines 46-49) to distinguish cache-served from fresh-run numbers — exactly what "no path may reuse a 1-deck settled entry in 2-deck mode" needs: settle a 1-deck run, toggle to 2 decks, assert a NEW `startSimulation` call and that the displayed numbers are the fresh run's, not the cached ones.
- Sibling-file discipline (lines 24-27 name the five frozen v1 suites: `App.test.tsx`, `App.acceptance.test.tsx`, `App.phase3.acceptance.test.tsx`, `App.modeErrorBanner.test.tsx`, `App.modeSwitchRace.test.tsx` — new App-level tests are new files, never edits to these).

**(f) Toggle behavioral tests** — analog `src/App.blackjackLoop.test.tsx` lines 432-511 (aria-pressed flip assertion line 435, no-new-run assertion line 438, already-active-segment no-op test lines 498-511). NOTE: that file is a blackjack suite — copy its shapes into a NEW Hold'em-side file; D-11 freezes blackjack files including their tests this phase. Key semantic difference to encode: where blackjack asserts "no new run" after a mid-round toggle, Hold'em asserts a FRESH DEAL (dealNonce bump, `startSimulation` called again, cache emptied) per D-02.

**(g) Guard extensions** — `src/engine/shoePath.guard.test.ts`:
- D-07's `.includes(`-prohibition lands here, following the existing `it.each(noSetFiles)` shape (lines 28-41) with a new token; file list = the shoe-path files (`engine/shoe.ts`, `engine/conditioning.ts`, `state/pickerStore.ts`, `ui/CardPicker.tsx` — currently zero `.includes(` occurrences, per research §11) PLUS the new wrapper module.
- Add the new wrapper module to the `noSetFiles` list itself (its gate must never regress to Set-based dedup).
- The allowlist mechanism for any legitimate exception is lines 43-59 (line-level pin, "not a blanket exemption").
- Amendments here are additive describe blocks — the pinned-artefact blocks (lines 74-118) are the untouchability enforcement and must not be weakened; note line 99-105 pins that `simulationApi.test.ts` never gains the token `deckCount` (new worker tests continue going to sibling files, the `deckCountValidation.test.ts` precedent).

---

## Shared Patterns

### Same-commit guard amendment (applies to plans touching HoldemGame, deckCountValidation, shoePath)
**Source:** `App.modeShell.guard.test.ts` lines 29-33 (the STANDING RULE) + lines 35-49 (two worked amendment examples with date/plan/decision citations).
"When a later phase legitimately needs one of these tokens ... AMEND this guard in the SAME COMMIT as the feature, with the phase decision cited in the updated assertion/comment — never silently delete or weaken." Every retarget in §4/§8 follows this: comment updated, assertion retargeted, rationale cites the D-number, red-test window zero.

### Comment-stripped vs raw-source guard reads (know which one you're up against)
**Source:** `App.modeShell.guard.test.ts` lines 58-74. `stripCommentLines` runs only ahead of COUNT assertions (`cancelSimulation(` counts); **substring absence checks read raw source including comments** (the deckCount sweep lines 235-242, the no-blackjack sweep lines 120-134, the D-05 store sweeps lines 255-264, 360-374). Consequence: in swept files, forbidden tokens are forbidden even in prose comments.

### Seeded determinism
**Source:** `src/engine/rng.ts` (whole file, 43 lines). `createRng(seed)` for tests, `createRng()` (no seed) for real deals (gameStore line 51, blackjackStore line 79 comment: "real, non-reproducible-by-design draws"). `createDrawer` for hot loops (reused working array), `drawN` for one-off draws. No `Math.random()` in simulation paths — the phase adds no new RNG call sites (gate/proxy deterministic).

### Additive sibling test files, never frozen-file edits
**Source:** `deckCountValidation.test.ts` header lines 12-18 ("a new sibling of `simulationApi.test.ts` (a frozen contract that must not be edited)") and `App.holdemCachePoison.test.tsx` lines 24-27. Untouchables this phase (D-11): the five frozen v1 App suites, both goldens (`deckParity.golden.test.ts`, `streamingParity.golden.test.ts` — meta-pinned by shoePath guard lines 108-118 as never-`.skip`ed), `simulationApi.test.ts`, and every `blackjack*` file (source AND test).

### Derived index constants, single source
**Source:** `blackjackProtocol.ts` lines 18-30 — `DEALER_BUCKET_COUNT = DEALER_BUCKET_ORDER.length` and `BUCKET_INDEX` derived via `Object.fromEntries` ("never a second hand-written list, so the two can never drift"). Apply to `categoryCountFor`/`FIVE_OF_A_KIND_INDEX`/`CATEGORY_LABELS_TWO_DECK`. Also copy its lines 1-3 cycle-avoidance note: protocol modules export runtime values INTO the engine, type-only imports back.

### D-NN tags + pitfall citations in code comments
Every analog file cites decision tags and PITFALLS entries at the branch that implements them (`blackjackHandValue.ts` lines 84-86; `blackjackStore.ts` lines 182-215; `Seat.tsx` lines 71-73). Phase 7 code should cite D-01..D-16 the same way — subject to the raw-source sweep constraint above for gameStore/pickerStore/conditioning.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Suit-remap proxy + one-suit flush scorer internals | engine algorithm | transform | No multi-deck evaluation exists anywhere (research: no published library handles it either). The algorithm comes from 07-RESEARCH's validated spec, not from a codebase analog — only the module *conventions* (§1) are copied. |
| Test-side brute-force oracle (best-of-C(7,5) scorer) | test utility | — | No existing test builds an independent reimplementation oracle; nearest spiritual precedent is `deckParity.golden.test.ts`'s "independent proof" framing. Research licenses it explicitly as "disposable-quality code" living only in test files. |

## Consolidated Traps for the Planner (guard collisions, golden sensitivities, wave layout)

1. **`ui/HoldemGame.tsx` is a one-plan file.** Toggle + effect deckCount plumbing + the modeShell guard retarget (remove it from the line-233 list) must land in ONE commit — any split leaves a red guard (Pitfall 4). The same plan should own the D-03 toggle-cache guard test (it exercises this file's paths).
2. **The category-index spine is one wave:** `protocol.ts` (categoryCountFor) → `equity.ts` (hoist) → `simulationApi.ts` (grow-on-merge) → `oddsStore.ts` (guard widening) share a single snapshot-shape contract; splitting them across concurrent plans risks a length-10/length-11 mismatch mid-wave and dev-guard console spam (Pitfall 2). `OddsTable.tsx`/`categoryLabels.ts` depend on `FIVE_OF_A_KIND_INDEX` but can be a later plan.
3. **`OddsTable.tsx` is touched by two units** (row source AND lockedIndex routing) — same plan, or strict wave ordering; two concurrent plans editing it will conflict.
4. **`CATEGORY_LABELS` must stay 10 entries** — `App.test.tsx` line 132 (frozen) compares rendered rows to the whole constant. The 11-row source is a new derived constant.
5. **Raw-source token sweeps:** no "blackjack"/"gameMode" (any case, comments included) may enter `gameStore.ts`, `oddsStore.ts`, `pickerStore.ts`, `uiStore.ts`, `conditioning.ts` (modeShell lines 111-134); no `deckCount` may remain in `App.tsx`/`gameModeStore.ts`/`GameModeSwitcher.tsx` (lines 226-243, post-retarget); no `Set<Card>`/`new Set(` in shoe-path files INCLUDING the new wrapper module once listed (shoePath lines 28-41).
6. **HoldemGame effect dep array must keep ending `pendingAnimationCount, mode]`** (modeShell lines 214-223) — insert `deckCount` (if added) before `pendingAnimationCount`.
7. **Golden sensitivity chain:** goldens call `deriveConditionedState` WITHOUT deckCount and expect 10-length `categoryCounts` — the `= 1` default parameter (conditioning.ts line 39), `runTrials`' length-10-at-absent sizing, and `mergeBatch`'s no-growth-at-10 are each individually load-bearing for `deckParity.golden.test.ts` lines 62/73 and `streamingParity.golden.test.ts` lines 62/82-83/101.
8. **`gameStore.test.ts` beforeEach** (lines 20-24) must gain `deckCount: 1` in the same plan that adds the field, or state leaks across tests into the 1-deck-only "13 distinct cards" assertion (lines 34-52).
9. **CardPicker tests gain a gameStore dependency** — the picker test harness must start resetting `useGameStore` (deckCount) once the wire lands; today it only resets `usePickerStore` (CardPicker.test.tsx lines 17-20).
10. **Felt keys are read-only for the copy-cue plan** — no `key`/`animationKey`/`flipKey` expression may change (Seat 76-77/127/142-143, BoardDisplay 77/80-81, AnimatedCard 15-17); the badge is content inside the existing wrappers.
11. **Blackjack freeze includes test files** — toggle-behavior analogs in `App.blackjackLoop.test.tsx` and store analogs in `blackjackStore.test.ts` are copy-from sources only; never edit them (D-11).
12. **`lockedInCategory` is the ONLY other production `evaluateHand` call site** (lockedCategory.ts line 26; the complete set is equity.ts 79-80 + this). After Phase 7, a cheap regression guard can pin that no NEW `evaluateHand(` call sites appear outside `equity.ts`/`lockedCategory.ts`/the wrapper — the shoePath/modeShell count-assertion pattern (comment-stripped `split('evaluateHand(').length - 1`) is the template.

## Metadata

**Analog search scope:** `src/engine`, `src/state`, `src/worker`, `src/ui`, `src/*.test.tsx`, `src/index.css`, `src/App.css`
**Files read at line level:** 38 (all 12 Integration Map surfaces verified, plus every guard/golden/frozen suite they collide with)
**Pattern extraction date:** 2026-08-24
**Upstream inputs:** 07-CONTEXT.md (D-01..D-16), 07-RESEARCH.md (12-point Integration Map — all 12 points verified at line level; two corrections recorded: the CardPicker deckCount read targets `gameStore` per D-14, not the `gameModeStore` its stale comment names; `conditioning.ts` carries no WR-03 comment to retire)
