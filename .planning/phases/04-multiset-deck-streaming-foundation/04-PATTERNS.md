# Phase 4: Multiset Deck & Streaming Foundation - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 11 (5 new, 6 modified)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/engine/shoe.ts` (new) | utility (engine module) | transform | `src/engine/cards.ts` | exact |
| `src/engine/shoe.test.ts` (new) | test | transform | `src/engine/conditioning.test.ts` + `src/engine/equity.property.test.ts` | exact |
| `src/engine/conditioning.ts` (modified) | service (sole-reader) | transform | itself (pre-refactor) + `src/engine/shoe.ts` | exact |
| `src/engine/equity.ts` (modified — `ConditionedState` gains `deckCount`) | model/service | transform | itself (pre-refactor) | exact |
| `src/worker/streamingRunner.ts` (new) | service (worker orchestration engine) | streaming | `src/worker/simulationApi.ts` | exact (literal extraction source) |
| `src/worker/streamingRunner.test.ts` (new) | test | streaming | `src/worker/simulationApi.test.ts` | exact (literal extraction source) |
| `src/worker/simulationApi.ts` (modified — becomes thin Hold'em config) | service (worker config) | streaming | itself (pre-refactor) | exact |
| `src/worker/protocol.ts` (modified — generic defaults may relocate; validation-adjacent types) | config/type-definitions | request-response | itself (pre-refactor) | exact |
| `src/state/pickerStore.ts` (modified — count-aware `setPick`, new `remainingCopies`) | store | CRUD (draft state) | itself (pre-refactor) | exact |
| `src/state/pickerStore.test.ts` (modified — extend existing describe block, D-10) | test | CRUD | itself (pre-refactor) | exact |
| Golden parity test (new, e.g. `src/engine/deckParity.golden.test.ts` or sibling to `simulationApi.test.ts`) | test | batch/streaming | `src/worker/simulationApi.test.ts` + `src/engine/equity.test.ts` (c) | strong (role-match) |

## Pattern Assignments

### `src/engine/shoe.ts` (utility, transform)

**Analog:** `src/engine/cards.ts` (full file, 23 lines — read in full above)

**Imports pattern** (`src/engine/cards.ts` lines 1-2):
```typescript
import { ALL_CARDS } from '@poker-apprentice/types';
import type { Card } from '@poker-apprentice/types';
```
`shoe.ts` should additionally `import { FULL_DECK } from './cards'` per D-03 ("`buildShoe` repeats `FULL_DECK`") rather than re-importing `ALL_CARDS` directly — keeps one canonical 52-card source.

**Core pattern — deck construction and Set-based exclusion to replace** (`src/engine/cards.ts` lines 4-23):
```typescript
/** The full 52-card deck, in the exact `Card` union format the evaluator expects. */
export const FULL_DECK: readonly Card[] = ALL_CARDS;

/** Fixed number of anonymous opponents at the table. */
export const OPPONENT_COUNT = 3;
...
/** Returns `FULL_DECK` with every card in `excluded` removed. */
export function deckWithout(excluded: readonly Card[]): Card[] {
  const excludedSet = new Set(excluded);
  return FULL_DECK.filter((card) => !excludedSet.has(card));
}
```
`shoe.ts`'s `buildShoe(deckCount)` should follow the same "readonly Card[] constant + short doc comment" convention as `FULL_DECK`. `shoeWithout(deckCount, excluded)` must NOT copy the `new Set(excluded)` pattern verbatim (per D-01/ARCHITECTURE Pitfall 6/Pitfall 12 in PITFALLS.md) — replace with a `Map<Card, number>` occurrence-count budget: build counts from `excluded`, walk the deck once, skip an instance while its budget is `>0` (decrementing), otherwise keep it. The regression-safety invariant to test FIRST: "`shoeWithout(1, excluded)` produces byte-identical output to today's `deckWithout(excluded)` for every excluded set" (PITFALLS.md Pitfall 12's explicit guidance: add an ADDITIVE module, never redefine `FULL_DECK`/`deckWithout` in place).

**Type convention to mirror** (`src/engine/streets.ts` line 2, for the new `DeckCount` union):
```typescript
export type Street = 'preflop' | 'flop' | 'turn' | 'river';
```
Follow this exact style for `export type DeckCount = 1 | 2;` — a bare literal union, no enum, matching the codebase's existing closed-union convention (also seen in `pickerStore.ts`'s `SlotId`).

---

### `src/engine/shoe.test.ts` (test, transform)

**Analog 1:** `src/engine/conditioning.test.ts` (full file, 141 lines — read in full above)
**Analog 2:** `src/engine/equity.property.test.ts` (full file, 110 lines — read in full above)

**File header / environment directive** (`src/engine/conditioning.test.ts` lines 1-8):
```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import type { Card } from '@poker-apprentice/types';
import { deriveConditionedState, isOpponentRevealed, type PredeterminedRunout } from './conditioning';
import { STREET_ORDER, STREET_BOARD_COUNT, STREET_LABEL, nextStreet, previousStreet } from './streets';
import { FULL_DECK } from './cards';
```
All engine-layer tests use `@vitest-environment node` (pure logic, no DOM needed) and mix plain `describe/it` (exact-value cases) with `@fast-check/vitest`'s `test.prop` (invariants) in the SAME file.

**Property-test pattern to copy exactly** (`src/engine/conditioning.test.ts` lines 110-129):
```typescript
test.prop([fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 7 })])(
  'every (street, revealedMask) combination reconstitutes exactly the 52-card FULL_DECK with no duplicates',
  (streetIndex, revealedMask) => {
    const street = STREET_ORDER[streetIndex];
    const result = deriveConditionedState(runout, street, revealedMask);
    ...
    expect(allCards).toHaveLength(FULL_DECK.length);
    expect(new Set(allCards).size).toBe(FULL_DECK.length);
  },
);
```
For `shoe.ts`, the equivalent invariants (per D-05/D-10) are:
1. Regression: `deckCount=1` `shoeWithout` output is set-equal (as a multiset) to today's `deckWithout` output, for any `excluded`.
2. Multiset closure: `shoeWithout(deckCount, excluded) ∪ excluded` (as counts) always reconstructs exactly `deckCount` copies of every `Card` value — the 2-deck analogue of the property above, checked by COUNT not `Set.size` (PITFALLS Pitfall 12: do not reuse `new Set(...).size` as the 2-deck assertion — it collapses duplicates and asserts the wrong thing).
3. DECK-03 without-replacement guard (D-05): "a trial never uses more copies of a card than the shoe holds" — this is the new, ADDITIVE property test; do not touch `equity.property.test.ts`'s existing "(c) exactly 13 unique cards" property (that stays a 1-deck-only invariant per D-10).

**`fc.integer`/fixed-fixture pattern** (`src/engine/equity.property.test.ts` lines 39-71, the "(b)" property) is the closest analog for a "sample N draws, then assert count/uniqueness invariants over the captured samples" test shape — reuse its `captured: Card[][]` capture-and-assert idiom for the without-replacement guard test.

---

### `src/engine/conditioning.ts` (service, transform — modified)

**Analog:** itself, pre-refactor (full file, 53 lines — read in full above)

**Break point to fix** (lines 32-53, the exact code that must change):
```typescript
export function deriveConditionedState(runout: PredeterminedRunout, street: Street, revealedMask: number) {
  const knownBoard: Card[] = runout.board.slice(0, STREET_BOARD_COUNT[street]);
  const knownOpponentHoles: (readonly [Card, Card] | null)[] = runout.opponentHoles.map((hole, index) =>
    isOpponentRevealed(revealedMask, index) ? hole : null,
  );

  const knownCards = new Set<Card>([runout.heroHole[0], runout.heroHole[1], ...knownBoard]);
  for (const hole of knownOpponentHoles) {
    if (hole !== null) {
      knownCards.add(hole[0]);
      knownCards.add(hole[1]);
    }
  }
  const remainingDeck = FULL_DECK.filter((card) => !knownCards.has(card));

  return {
    heroHole: runout.heroHole,
    knownBoard,
    knownOpponentHoles,
    remainingDeck,
  };
}
```
Per D-01/D-04: replace the `new Set<Card>(...)` + `FULL_DECK.filter(...)` pair with a call into `shoeWithout(deckCount, knownCardsArray)` from the new `shoe.ts` — do NOT hand-roll a second `Map`-based exclusion here (ARCHITECTURE.md explicitly calls out this file as duplicating `cards.ts`'s bug independently; DRY it through one shared helper). Preserve the exact doc-comment style above the function (lines 22-31) — it documents the D-02 "sole reader" invariant and must be updated to mention `deckCount`, not deleted.

**Doc-comment convention to preserve** (lines 6-15, the interface-level D-01 comment):
```typescript
/**
 * The full hand, predetermined at deal time (D-01): hero hole, all 5 board cards, and all
 * 3 opponents' hole cards. Not all of this is necessarily visible to the user yet — that
 * depends on the current street and which opponents have been revealed.
 */
export interface PredeterminedRunout { ... }
```
Follow this "decision-ID-tagged JSDoc block above the interface/function" convention when adding `deckCount: DeckCount` to `ConditionedState` (in `equity.ts`) and threading it through `deriveConditionedState`'s signature/return.

---

### `src/engine/equity.ts` (model/service, transform — modified)

**Analog:** itself, pre-refactor (full file, 102 lines — read in full above)

**`ConditionedState` interface to extend** (lines 6-20):
```typescript
export interface ConditionedState {
  heroHole: [Card, Card];
  /** 0-5 cards, in street order (flop 3, then turn, then river). */
  knownBoard: Card[];
  /** Length `OPPONENT_COUNT` (3). `null` = still hidden. */
  knownOpponentHoles: (readonly [Card, Card] | null)[];
  /** Every card NOT in `heroHole`, `knownBoard`, or any non-null `knownOpponentHoles` entry. */
  remainingDeck: Card[];
}
```
Add `deckCount: DeckCount` here (imported from `./shoe`), following the existing per-field one-line doc-comment convention shown above. `runTrials`/`unknownCardsPerTrial` (lines 26-102) need NO logic change per D-05/ARCHITECTURE.md §(c) point 3 — they already operate on a plain `Card[]` pool and are deck-count-agnostic; only the type gains a field that downstream validation reads.

---

### `src/worker/streamingRunner.ts` (service, streaming — new, extracted)

**Analog:** `src/worker/simulationApi.ts` (full file, 142 lines — read in full above; this IS the extraction source, not just a similar file)

**Run-token supersession pattern to extract verbatim** (lines 25-38):
```typescript
let currentRequestId = -1;
// Per-invocation identity token. Supersession is decided by OBJECT IDENTITY, not by
// requestId equality (WR-01) — a caller that re-enters `runSimulation` with the SAME
// requestId still gets a fresh token here, so the stale loop's `runToken === currentRunToken`
// check correctly fails and it stops emitting, even though `requestId` didn't change.
let currentRunToken: object | null = null;

return {
  cancel(requestId: number): void {
    if (requestId === currentRequestId) {
      currentRequestId = -1;
      currentRunToken = null;
    }
  },
  ...
```

**Chunked batch loop + throttled emission + cooperative yield to extract verbatim** (lines 85-139):
```typescript
currentRequestId = requestId;
const runToken = {};
currentRunToken = runToken;
...
let lastEmitAt: number | null = null;

while (runToken === currentRunToken) {
  const trialsThisBatch = Math.min(batchSize, maxTrials - totals.trialsCompleted);
  const batch = runTrials(conditioned, trialsThisBatch, drawUnknown);
  ...
  // Supersession/cancellation check — bail without emitting a stale snapshot.
  if (runToken !== currentRunToken) {
    return;
  }

  const done = totals.trialsCompleted >= maxTrials;
  const now = Date.now();
  const shouldEmit = lastEmitAt === null || done || now - lastEmitAt >= progressIntervalMs;

  if (shouldEmit) {
    lastEmitAt = now;
    // Defensive copies — never hand the caller the mutable running arrays/objects.
    await onProgress({ ... });
  }

  if (done) {
    return;
  }

  // Yield so pending cancel()/newer runSimulation() calls can be processed.
  await new Promise((resolve) => setTimeout(resolve, 0));
}
```
Per D-06/ARCHITECTURE.md §(b), generalize this into `createStreamingRunner<TConditioned, TBatch, TSnapshot>(config)` where `runBatch`/`mergeBatch`/`makeEmptyTotals`/`toSnapshot`/`validate`/`unknownCardsPerTrial`/`getRemainingDeck` are injected hooks — the `categoryCounts`/`outcomes` merge block (lines 92-110) is the Hold'em-specific `mergeBatch`/`makeEmptyTotals` piece that moves OUT of this file and into `simulationApi.ts`'s config object. Keep the entry-point validation call as an injected `validate?.(conditioned)` hook — this is where the count-aware overlap-budget check (D-04) plugs in per-game.

**Defensive-copy discipline to preserve** (lines 123-130): never emit the live mutable arrays — always spread/copy before calling `onProgress`.

---

### `src/worker/streamingRunner.test.ts` (test, streaming — new)

**Analog:** `src/worker/simulationApi.test.ts` (full file, 241 lines — read in full above; this IS the suite the new file generalizes)

**`waitUntil` polling helper to copy verbatim** (lines 31-47):
```typescript
function waitUntil(predicate: () => boolean, timeoutMs = 2000, intervalMs = 5): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) { resolve(); return; }
      if (Date.now() - start > timeoutMs) { reject(new Error('waitUntil: timed out waiting for predicate')); return; }
      setTimeout(check, intervalMs);
    };
    check();
  });
}
```

**Supersession test shapes to genericize (not delete)** (lines 105-158): the "same requestId" (WR-01 regression guard) and "different requestId" supersession tests must be re-proven against the generic runner with a trivial fake `TConditioned`/`TBatch`/`TSnapshot` config — these are the tests that prove the extraction preserved WR-01 behavior at the generic level, independent of D-07's "existing `simulationApi.test.ts` passes unchanged" gate on the Hold'em-specific file.

**Entry-point validation test shape** (lines 173-240, the `describe('entry-point validation', ...)` block): mirrors how a `validate` hook's thrown errors propagate through `runSimulation` — reuse this `await expect(api.runSimulation(...)).rejects.toThrow(...)` idiom for testing that a generic `validate` hook's throw surfaces correctly through the extracted runner.

---

### `src/worker/simulationApi.ts` (service, streaming — modified to thin config)

**Analog:** itself, pre-refactor (already read in full above) — D-07 requires `simulationApi.test.ts` (the file above) to pass COMPLETELY UNCHANGED after this file becomes a config wrapper around `createStreamingRunner`.

**Entry-point validation to keep Hold'em-specific but rewrite the overlap check** (lines 46-83):
```typescript
if (heroHole.length !== 2) { throw new Error(...); }
if (!VALID_BOARD_LENGTHS.has(knownBoard.length)) { throw new Error(...); }
if (knownOpponentHoles.length !== OPPONENT_COUNT) { throw new Error(...); }

const revealedCount = knownOpponentHoles.filter((hole) => hole !== null).length;
const expectedRemainingDeckLength = FULL_DECK.length - 2 - knownBoard.length - 2 * revealedCount;
if (remainingDeck.length !== expectedRemainingDeckLength) { throw new Error(...); }

// Overlap check (T-02-01, review IN-06): remainingDeck must not intersect any known card
const knownCards = new Set<Card>([heroHole[0], heroHole[1], ...knownBoard]);
...
const overlapping = remainingDeck.filter((card) => knownCards.has(card));
if (overlapping.length > 0) { throw new Error(`runSimulation: remainingDeck overlaps known cards: ...`); }
```
Per D-04/ARCHITECTURE.md §(c) point 3 and PITFALLS Anti-Pattern 2: `expectedRemainingDeckLength` becomes `52 * deckCount - 2 - knownBoard.length - 2 * revealedCount`, and the zero-overlap `Set`-based throw becomes a per-value BUDGET check (`countInRemaining(card) + countKnown(card) <= deckCount`) — this is the check ARCHITECTURE.md flags as "actively wrong, not just arithmetic" if merely parameterized without rewriting the comparison itself. Preserve the "throw with the exact card value named" error-message style (`remainingDeck overlaps known cards: ${overlapping.join(', ')}`) — `simulationApi.test.ts` lines 216-239 assert on this exact string shape and (per D-07) must keep passing unchanged for `deckCount=1`.

---

### `src/worker/protocol.ts` (config/type-definitions, request-response — modified)

**Analog:** itself, pre-refactor (full file, 51 lines — read in full above)

**Constant/doc-comment convention to preserve** (lines 1-19):
```typescript
/**
 * `HandStrength` has TEN values (HighCard=0 .. StraightFlush=8, RoyalFlush=9).
 * Royal Flush is its own enum value, NOT folded into Straight Flush — the odds
 * table must have 10 rows, not 9.
 */
export const CATEGORY_COUNT = 10;

/** Trials executed per batch inside the worker before checking for cancellation/emission. */
export const DEFAULT_BATCH_SIZE = 4000;
```
Per D-06 ("Comlink exposure shape may stay as-is this phase"), `CATEGORY_COUNT`/`ProgressSnapshot`/`SimulationApi` stay Hold'em-shaped in this file — genuinely GENERIC knobs (`DEFAULT_BATCH_SIZE`, `DEFAULT_PROGRESS_INTERVAL_MS`, `DEFAULT_MAX_TRIALS`, `SimulationOptions`) are the candidates to relocate into `streamingRunner.ts` since they're not Hold'em-specific — but only move them if `simulationApi.ts`'s public re-export surface stays identical (D-07 gate). If left in place and merely re-exported, that satisfies D-07 with less churn; either way, keep the exact one-line-JSDoc-per-constant convention shown above for any new/moved constant.

---

### `src/state/pickerStore.ts` (store, CRUD — modified)

**Analog:** itself, pre-refactor (full file, 73 lines — read in full above)

**Boolean-membership guard to replace with a count-aware check** (lines 61-66):
```typescript
setPick: (slot, card) => {
  const { picks } = get();
  const heldByAnotherSlot = SLOT_ORDER.some((otherSlot) => otherSlot !== slot && picks[otherSlot] === card);
  if (heldByAnotherSlot) return;
  set({ picks: { ...picks, [slot]: card } });
},
```
Per D-09: `heldByAnotherSlot` (a boolean `.some()`) becomes a COUNT — `SLOT_ORDER.filter((otherSlot) => otherSlot !== slot && picks[otherSlot] === card).length >= deckCount` — blocking only once picks-using-`card` reach `deckCount` (default 1 this phase, so behavior is IDENTICAL at `deckCount=1`, satisfying "UNCHANGED at deckCount=1"). Keep the exact `set({ picks: { ...picks, [slot]: card } })` immutable-spread-update style used throughout this store (also in `clearSlot`/`clearAll`, lines 67-72).

**`pickedCards` helper convention to mirror for the new `remainingCopies` selector** (lines 37-49):
```typescript
/**
 * Returns the non-null picks in `picks`, in `SLOT_ORDER` order. The single shared source of
 * "which cards are already used" for both the picker UI's disabled rendering and
 * `gameStore.deal()`'s random-fill pool — never duplicate this filtering elsewhere.
 */
export function pickedCards(picks: PickerDraft): Card[] {
  const result: Card[] = [];
  for (const slot of SLOT_ORDER) {
    const card = picks[slot];
    if (card !== null) result.push(card);
  }
  return result;
}
```
D-09's `remainingCopies(card)` selector should follow this same "small, standalone exported function with a doc comment naming its single shared-source role" convention — likely `remainingCopies(picks, card, deckCount) => deckCount - countOccurrences(picks, card)`, exported alongside `pickedCards` rather than folded into the Zustand store body, matching this file's existing separation of pure helpers from store actions.

---

### `src/state/pickerStore.test.ts` (test, CRUD — modified, extend in place per D-10/PITFALLS)

**Analog:** itself, pre-refactor (full file, 104 lines — read in full above)

**Existing describe block to extend, NOT replace** (line 14):
```typescript
describe('pickerStore — seven-slot draft with duplicate rejection', () => {
```
PITFALLS.md explicitly names this describe block as "the test file to extend with a `deckCount=2` variant, not a new file, since it's the same invariant loosened by a parameter." Add a nested `describe('deckCount=2 — count-aware duplicate rejection', ...)` block reusing the existing `beforeEach` reset pattern (lines 15-17) and the existing "rejects a card already held by a different slot" test shape (lines 31-38) as the template for "allows a second copy at `deckCount=2`, rejects the third."

**Test shape to clone for the new block** (lines 31-38):
```typescript
it('setPick rejects a card already held by a different slot (D-05), leaving both slots unchanged', () => {
  usePickerStore.getState().setPick('hero-0', 'As');
  usePickerStore.getState().setPick('flop-0', 'As');

  const { picks } = usePickerStore.getState();
  expect(picks['hero-0']).toBe('As');
  expect(picks['flop-0']).toBeNull();
});
```

---

### Golden parity test (new — D-08 gate, must exist BEFORE the refactor lands)

**Analog 1:** `src/worker/simulationApi.test.ts` lines 54-69 (seeded streaming run + final-snapshot assertion pattern):
```typescript
it('streams at least 2 snapshots with non-decreasing trialsCompleted, ending done at maxTrials', async () => {
  const api = createSimulationApi({ maxTrials: 20000, batchSize: 5000, progressIntervalMs: 0 });
  const snapshots: ProgressSnapshot[] = [];
  await api.runSimulation(preflopState, 1, (s) => { snapshots.push(s); });
  ...
  const last = snapshots[snapshots.length - 1];
  expect(last.done).toBe(true);
  expect(last.trialsCompleted).toBe(20000);
});
```

**Analog 2:** `src/engine/equity.test.ts` lines 57+ ("(c) is deterministic: identical seeds produce identical categoryCounts and outcomes") — the exact-seed-equality pattern this golden test needs, but instead of comparing two live runs against each other, compare ONE live run's `categoryCounts`/`outcomes` against LITERAL numbers captured from the CURRENT shipped code (per D-08). Use `createSimulationApi({ seed: <fixed>, maxTrials: <fixed>, progressIntervalMs: 0 })` (mirroring `simulationApi.test.ts`'s options shape) with BOTH a preflop fixture (mirroring `preflopState` in `simulationApi.test.ts` lines 13-18) and a flop fixture (mirroring the `runout`/`deriveConditionedState(runout, 'flop', 0)` fixture at lines 20-29 and 160-171) — D-08 explicitly requires "fixed conditioned states (preflop + a flop case)." Record the literal expected tallies as a hardcoded object literal in the test BEFORE any shoe.ts/streamingRunner.ts code changes land, per the "golden-first" ordering.

---

## Shared Patterns

### Seeded determinism (`createRng(seed)` / `createDrawer`)
**Source:** `src/engine/rng.ts` (full file, 43 lines — read in full above)
**Apply to:** `shoe.ts` tests, golden parity test, `streamingRunner.test.ts`
```typescript
export function createRng(seed: number = Date.now() ^ (Math.random() * 0x100000000)): RandomGenerator {
  return xoroshiro128plus(seed);
}
export function createDrawer(rng: RandomGenerator, pool: readonly Card[], n: number): () => Card[] {
  const working = pool.slice();
  return () => {
    for (let i = 0; i < n; i++) {
      const j = uniformInt(rng, i, working.length - 1);
      [working[i], working[j]] = [working[j], working[i]];
    }
    return working.slice(0, n);
  };
}
```
No changes needed to this file (D-01: "already work with duplicate values as-is") — every new test that needs reproducible randomness should call `createRng(<fixed literal seed>)`, never `Math.random()` directly, matching every existing engine test.

### `@vitest-environment node` for engine/worker tests
**Source:** `src/engine/conditioning.test.ts` line 1, `src/engine/equity.test.ts` line 1, `src/engine/equity.property.test.ts` line 1, `src/worker/simulationApi.test.ts` line 1
**Apply to:** `shoe.test.ts`, `streamingRunner.test.ts`, golden parity test — all pure-logic, no DOM.
```typescript
// @vitest-environment node
```
Contrast: `src/state/simulationService.test.ts` (lines 9-13) deliberately STAYS on the jsdom default because it dispatches real `ErrorEvent`/`MessageEvent` — do not add this directive there, and do not omit it from new engine/worker-layer tests.

### fast-check property tests via `@fast-check/vitest`
**Source:** `src/engine/conditioning.test.ts` lines 2, 110-140; `src/engine/equity.property.test.ts` (whole file)
**Apply to:** `shoe.test.ts` (multiset closure + regression invariants), any new `equity`/`conditioning` deck-count properties
```typescript
import { test, fc } from '@fast-check/vitest';
...
test.prop([fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 7 })])(
  'description of the invariant',
  (streetIndex, revealedMask) => { /* ... */ },
);
```

### `vi.mock` factory + `vi.hoisted` for worker/Comlink boundary tests
**Source:** `src/state/simulationService.test.ts` lines 14-38
**Apply to:** Any new test that needs to fake the Comlink/worker boundary without a real Worker (relevant if `streamingRunner.test.ts` or a golden test needs to exercise the Comlink-exposed shape rather than the pure `createSimulationApi`/`createStreamingRunner` function directly)
```typescript
const { workers, runSimulation, cancel } = vi.hoisted(() => ({
  workers: [] as EventTarget[],
  runSimulation: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('../worker/simulation.worker?worker', () => {
  class FakeWorker extends EventTarget { postMessage() {} terminate() {} constructor() { super(); workers.push(this); } }
  return { default: FakeWorker };
});

vi.mock('comlink', () => ({ wrap: () => ({ runSimulation, cancel }), proxy: <T,>(cb: T) => cb }));
```
Most Phase 4 tests should prefer calling `createStreamingRunner`/`createSimulationApi` directly (as `simulationApi.test.ts` does) rather than going through this heavier Comlink-mock boundary — reserve this pattern only if a test specifically needs to prove the Comlink-exposed shape survives the extraction.

### Decision-ID-tagged JSDoc comments
**Source:** pervasive — `src/engine/conditioning.ts` lines 6-15, 22-31; `src/state/pickerStore.ts` lines 4-7, 53; `src/worker/simulationApi.ts` lines 28-29, 47-48, 71-72
**Apply to:** every new/modified file in this phase
```typescript
/**
 * ... (lines 4-7 of pickerStore.ts)
 * The seven manually-pickable slots (D-07): hero hole plus all five board slots. There is
 * deliberately no slot for any opponent hole card anywhere in this union.
 */
```
Every load-bearing invariant in this codebase is documented with its originating decision ID (`D-0x`) inline. New code introduced by this phase should tag comments with `D-01`..`D-10` (this phase's decisions) the same way, so a future reader can trace WHY a check exists back to `04-CONTEXT.md`.

### "Additive, not destructive" module discipline (PITFALLS Pitfall 12)
**Source:** `.planning/research/PITFALLS.md` Pitfall 12 + Recovery Strategies table
**Apply to:** `shoe.ts` (new, alongside untouched `cards.ts`), any new property test (new test, alongside untouched `equity.property.test.ts`'s "(c) 13 unique cards" property)
Never modify `FULL_DECK`, `deckWithout`, or the existing "13 unique cards" property test's assertion text to "also cover" 2-deck behavior — add new, parallel, deck-count-aware equivalents instead. This is the single most load-bearing cross-cutting rule for this phase (D-10 restates it explicitly for the picker/property tests).

## No Analog Found

None. Every file in this phase's scope has a direct, exact-match analog already in the v1 codebase — this phase is explicitly a refactor/extension of existing single-deck, single-worker-API patterns rather than new architectural territory (Blackjack/game-mode work in later phases will be the first files with no analog).

## Metadata

**Analog search scope:** `src/engine/`, `src/worker/`, `src/state/` (all `.ts`/`.tsx` source and test files; UI layer excluded per D-01/D-09 "no UI changes this phase")
**Files scanned:** `src/engine/cards.ts`, `src/engine/conditioning.ts`, `src/engine/conditioning.test.ts`, `src/engine/equity.ts`, `src/engine/equity.test.ts`, `src/engine/equity.property.test.ts`, `src/engine/evaluator.ts`, `src/engine/rng.ts`, `src/engine/streets.ts`, `src/worker/protocol.ts`, `src/worker/simulationApi.ts`, `src/worker/simulationApi.test.ts`, `src/worker/simulation.worker.ts`, `src/state/pickerStore.ts`, `src/state/pickerStore.test.ts`, `src/state/gameStore.ts`, `src/state/simulationService.ts`, `src/state/simulationService.test.ts`
**Pattern extraction date:** 2026-08-24
