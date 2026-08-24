# Phase 2: Scenario Construction & Street Navigation - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 20 (10 modified, 10 new; test files counted alongside their source)
**Analogs found:** 20 / 20 (every file has at least a role-match; several are "self" analogs — the file's own Phase 1 version is the pattern anchor for its own generalization)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/engine/streets.ts` | model/config | transform | `src/engine/cards.ts` | role-match |
| `src/engine/conditioning.ts` | utility | transform | `src/engine/cards.ts` (+ `src/engine/equity.ts` for interface style) | role-match |
| `src/engine/equity.ts` | service (pure engine) | batch/transform | itself (Phase 1 version, same file) | exact (self, generalizing) |
| `src/engine/cards.ts` | config/utility | transform | itself (Phase 1 version, same file) | exact (self, minor addition) |
| `src/engine/equity.test.ts` | test | batch/transform | itself + `src/engine/equity.property.test.ts` | exact (self) |
| `src/engine/conditioning.test.ts` | test | transform | `src/engine/equity.property.test.ts` | role-match |
| `src/worker/protocol.ts` | model/config | request-response | itself (Phase 1 version, same file) | exact (self, generalizing) |
| `src/worker/simulationApi.ts` | service (worker RPC handler) | streaming | itself (Phase 1 version, same file) | exact (self, generalizing) |
| `src/worker/simulationApi.test.ts` | test | streaming | itself (Phase 1 version, same file) | exact (self) |
| `src/worker/simulation.worker.ts` | route/entrypoint | request-response | itself — unchanged wiring | exact (no change expected) |
| `src/state/gameStore.ts` | store | CRUD + event-driven | itself (Phase 1 version, same file) | exact (self, generalizing) |
| `src/state/pickerStore.ts` | store | CRUD | `src/state/gameStore.ts` (Phase 1) | role-match |
| `src/state/oddsStore.ts` | store | event-driven (stream apply) + CRUD (cache) | itself (Phase 1 version, same file) | exact (self, generalizing) |
| `src/state/simulationService.ts` | service (worker RPC client) | request-response/streaming | itself (Phase 1 version, same file) | exact (self, generalizing) |
| `src/ui/CardPicker.tsx` | component | request-response (click → state) | `src/ui/HandDisplay.tsx` + `src/ui/DealButton.tsx` | role-match |
| `src/ui/StreetControls.tsx` | component | event-driven | `src/ui/DealButton.tsx` | role-match |
| `src/ui/BoardDisplay.tsx` | component | transform (derived render) | `src/ui/HandDisplay.tsx` | role-match |
| `src/ui/HandDisplay.tsx` | component | event-driven (extended) | itself (Phase 1 version, same file) | exact (self, extending) |
| `src/App.tsx` | provider/root component | event-driven (effect orchestration) | itself (Phase 1 version, same file) | exact (self, generalizing) |
| `src/App.test.tsx` | test | event-driven | itself (Phase 1 version, same file) | exact (self) |

## Pattern Assignments

### `src/engine/streets.ts` (model/config, transform) — NEW

**Analog:** `src/engine/cards.ts`

**Style to copy** (`src/engine/cards.ts` lines 1-11):
```typescript
import { ALL_CARDS } from '@poker-apprentice/types';
import type { Card } from '@poker-apprentice/types';

/** The full 52-card deck, in the exact `Card` union format the evaluator expects. */
export const FULL_DECK: readonly Card[] = ALL_CARDS;

/** Fixed number of anonymous opponents at the table. */
export const OPPONENT_COUNT = 3;

/** Unknown cards drawn per Monte Carlo trial: 5 board + 2 per opponent x 3 opponents. */
export const CARDS_PER_TRIAL = 11;
```
Follow this exact convention: a small, single-purpose module exporting `const`/`type` with a one-line doc comment per export, no classes, no default export. Apply it to produce `Street`, `STREET_ORDER`, `STREET_BOARD_COUNT` exactly as sketched in `02-RESEARCH.md`'s "Street type and board-count map" code example — same file-size and doc-comment density as `cards.ts`.

---

### `src/engine/conditioning.ts` (utility, transform) — NEW

**Analog:** `src/engine/cards.ts` (`deckWithout`) for the set-based filtering idiom; `src/engine/equity.ts` for the `interface`-first documentation style.

**Set-based filtering idiom to copy** (`src/engine/cards.ts` lines 13-17):
```typescript
/** Returns `FULL_DECK` with every card in `excluded` removed. */
export function deckWithout(excluded: readonly Card[]): Card[] {
  const excludedSet = new Set(excluded);
  return FULL_DECK.filter((card) => !excludedSet.has(card));
}
```
`deriveConditionedState` must build its `remainingDeck` the same way (accumulate a `Set<Card>` of everything known, then `FULL_DECK.filter`), not an O(n²) `.includes()` scan.

**Interface + doc-comment style to copy** (`src/engine/equity.ts` lines 1-17):
```typescript
import type { Card } from '@poker-apprentice/types';
import { CATEGORY_COUNT } from '../worker/protocol';
import { evaluateHand, compareHands, type Hand } from './evaluator';

/** The known/unknown card partition a trial batch is conditioned on. */
export interface ConditionedState {
  heroHole: [Card, Card];
  remainingDeck: Card[];
}
```
This is THE critical file for D-02: per `02-RESEARCH.md` Pitfall 1, `deriveConditionedState(runout, street, revealedMask)` must be the ONLY function in the codebase allowed to read `runout.board`/`runout.opponentHoles` for simulation purposes. Model it directly on the `02-RESEARCH.md` "Code Examples" snippet (`engine/conditioning.ts`) — that snippet is already written against this codebase's real types and is safe to copy near-verbatim.

---

### `src/engine/equity.ts` (service/pure engine, batch/transform) — MODIFY (generalize)

**Analog:** itself, Phase 1 version (already in context above, full file read)

**Core pattern to preserve unchanged** (current `src/engine/equity.ts` lines 40-71 — the max-then-count-ties reduction):
```typescript
const hero = evaluateHand(state.heroHole, board);
const villains = oppHoles.map((hole) => evaluateHand(hole, board));

categoryCounts[hero.strength]++;

const allHands: Hand[] = [hero, ...villains];
let best = allHands[0];
for (let i = 1; i < allHands.length; i++) {
  if (compareHands(allHands[i], best) > 0) {
    best = allHands[i];
  }
}

if (compareHands(hero, best) !== 0) {
  outcomes.lose++;
} else {
  let tiedCount = 0;
  for (const hand of allHands) {
    if (compareHands(hand, best) === 0) tiedCount++;
  }
  if (tiedCount > 1) outcomes.tie++;
  else outcomes.win++;
}
```
Do NOT rewrite this reduction — it is the exact multi-way-tie-safe pattern; only the code that CONSTRUCTS `board`/`oppHoles` before it changes (from a fixed `sampled.slice(0,5)`/`[5,6],[7,8],[9,10]` layout to the variable known+drawn reconstruction in `02-RESEARCH.md` Pattern 1). Resolves review IN-04 (`remainingDeck` was declared-but-unused) as a side effect of `ConditionedState` gaining real fields that ARE used (`knownBoard`, `knownOpponentHoles`).

**Signature/interface convention to copy** (lines 5-17):
```typescript
export interface ConditionedState {
  heroHole: [Card, Card];
  remainingDeck: Card[];
}

export interface TrialBatchResult {
  categoryCounts: number[];
  outcomes: { win: number; tie: number; lose: number };
  trialsCompleted: number;
}
```
Extend `ConditionedState` in place (add `knownBoard`, `knownOpponentHoles`), keep `TrialBatchResult` untouched — the worker and UI layers depend on this exact shape.

---

### `src/engine/cards.ts` (config/utility, transform) — MODIFY (minor)

**Analog:** itself (see full file above)

`CARDS_PER_TRIAL = 11` (line 11) is now WRONG as a universal constant — it was correct only for Phase 1's single fixed knowledge shape. Either remove it in favor of a computed `unknownCount` in `conditioning.ts`/`equity.ts`, or keep it explicitly labeled `PREFLOP_CARDS_PER_TRIAL` for the fully-unknown case and compute the general case elsewhere. `FULL_DECK`, `OPPONENT_COUNT`, `deckWithout` are unchanged and remain the picker's and deal-time random-fill's duplicate-blocking primitives (per `02-CONTEXT.md`'s Reusable Assets note).

---

### `src/worker/protocol.ts` (model/config, request-response) — MODIFY (generalize)

**Analog:** itself, Phase 1 version (full file above)

**Type-definition + doc-comment convention to copy** (lines 19-37):
```typescript
/** A partial-result snapshot streamed from the worker to the main thread. */
export interface ProgressSnapshot {
  requestId: number;
  categoryCounts: number[];
  outcomes: { win: number; tie: number; lose: number };
  trialsCompleted: number;
  done: boolean;
}
```
`ProgressSnapshot` shape stays unchanged (UI already depends on exactly these fields). Change the `SimulationApi.runSimulation` PARAMETER shape from positional `(heroHole, remainingDeck, requestId, onProgress)` to accept the generalized conditioning inputs (`knownBoard`, `knownOpponentHoles` or a single `ConditionedState`-shaped argument) — keep `requestId`/`onProgress` calling convention identical since `simulationApi.test.ts` and `simulationService.ts` both depend on that convention. `CATEGORY_COUNT = 10` (line 8, with its Royal-Flush-is-distinct doc comment) is untouched — do not let a new contributor "fix" it to 9.

---

### `src/worker/simulationApi.ts` (service/worker RPC handler, streaming) — MODIFY (generalize)

**Analog:** itself, Phase 1 version (full file above)

**Entry-point validation pattern to copy and generalize** (lines 38-46):
```typescript
if (heroHole.length !== 2) {
  throw new Error(`runSimulation: heroHole must have exactly 2 cards, got ${heroHole.length}`);
}
if (remainingDeck.length !== FULL_DECK.length - 2) {
  throw new Error(
    `runSimulation: remainingDeck must have exactly ${FULL_DECK.length - 2} cards, got ${remainingDeck.length}`,
  );
}
```
Per `02-RESEARCH.md` Pitfall 2, the second check's `FULL_DECK.length - 2` constant MUST become a formula: `52 - 2 - knownBoard.length - 2 * knownOpponentHoles.filter(h => h !== null).length`, and per review IN-06 (now higher severity — "opportunistic cleanup where touched" per D-14), add a set-overlap check: `remainingDeck` must not intersect `heroHole ∪ knownBoard ∪ any known opponent hole`. Keep the "throw loudly, don't silently produce wrong probabilities" doc-comment style (line 37).

**Streaming loop + defensive-copy pattern to copy unchanged** (lines 82-99):
```typescript
if (shouldEmit) {
  lastEmitAt = now;
  // Defensive copies — never hand the caller the mutable running arrays/objects.
  await onProgress({
    requestId,
    categoryCounts: [...totals.categoryCounts],
    outcomes: { ...totals.outcomes },
    trialsCompleted: totals.trialsCompleted,
    done,
  });
}

if (done) {
  return;
}

// Yield so pending cancel()/newer runSimulation() calls can be processed.
await new Promise((resolve) => setTimeout(resolve, 0));
```
This batching/throttling/yield/defensive-copy structure is untouched by Phase 2 — only the trial-construction inputs feeding `runTrials` change. The `currentRequestId`/`cancel()` supersession loop (lines 22-29, 61-76) also carries forward unchanged as the base to extend per D-13 (widen the "generation" concept, don't replace the mechanism).

**WR-01 fix to apply here** (per `01-REVIEW.md` lines 80-89, cited verbatim as the prescribed remediation):
```typescript
let currentRunToken: object | null = null;

async runSimulation(heroHole, remainingDeck, requestId, onProgress) {
  // ...validation...
  currentRequestId = requestId;
  const runToken = {};
  currentRunToken = runToken;
  // ...loop condition becomes `runToken === currentRunToken`, not just requestId equality...
}
```

---

### `src/worker/simulationApi.test.ts` (test, streaming) — MODIFY

**Analog:** itself, Phase 1 version (full file above)

**`waitUntil` polling helper and supersession-test structure to copy unchanged** (lines 10-26, 84-108):
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
Reuse this exact helper for new tests asserting same-requestId re-entry no longer interleaves (WR-01 regression test) and for cache-miss-triggers-worker / cache-hit-skips-worker assertions. `// @vitest-environment node` (line 1) is required at the top of every worker/engine test file — Comlink/Worker-adjacent code under jsdom breaks without it.

---

### `src/state/gameStore.ts` (store, CRUD + event-driven) — MODIFY (generalize)

**Analog:** itself, Phase 1 version (full file above)

**Zustand store shape/action convention to copy** (lines 1-26):
```typescript
import { create } from 'zustand';
import type { Card } from '@poker-apprentice/types';
import { FULL_DECK } from '../engine/cards';
import { createRng, drawN } from '../engine/rng';

interface GameState {
  heroHole: [Card, Card] | null;
  dealNonce: number;
  deal: () => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  heroHole: null,
  dealNonce: 0,
  deal: () => {
    const rng = createRng();
    const [c1, c2] = drawN(rng, FULL_DECK, 2);
    set({ heroHole: [c1, c2], dealNonce: get().dealNonce + 1 });
  },
}));
```
`create<T>()((set, get) => ({...}))` — the double-call curried form (not `create<T>((set) => ...)`) — is the established convention; keep it for every new/extended store. `dealNonce` remains the single hand-identity counter (D-13: do not add a parallel counter — widen the trigger set consumed downstream instead, per `02-RESEARCH.md`'s effect-dependency-array example: `[dealNonce, street, revealedMask]`). Add `board`, `opponentHoles`, `street`, `revealedMask` fields and `advanceStreet`/`rewindStreet`/`reveal` actions using the identical `set((state) => ({...}))` idiom shown in Pattern 3 of `02-RESEARCH.md`:
```typescript
reveal: (opponentIndex: number) =>
  set((state) => ({ revealedMask: state.revealedMask | (1 << opponentIndex) })),
```

---

### `src/state/pickerStore.ts` (store, CRUD) — NEW

**Analog:** `src/state/gameStore.ts` (Phase 1 version, same curried-create convention above)

Follow the identical `create<T>()((set, get) => ({...}))` shape. Actions are simple slot-setters/clearers (`setHeroPick(i, card)`, `clearSlot(name, i)`, `clearAll()`) — same flat, non-nested `set({...})` style as `gameStore.deal()`, no Immer needed (CLAUDE.md flags Immer as optional/only if nesting gets error-prone; this draft state is flat enough to skip it, matching Phase 1's own choice not to use Immer). Base the `PickerDraft` interface and `allPickedCards`/merge-on-deal logic directly on `02-RESEARCH.md` Pattern 4's code example (already written against this project's `Card` type).

---

### `src/state/oddsStore.ts` (store, event-driven + CRUD cache) — MODIFY (generalize)

**Analog:** itself, Phase 1 version (full file above)

**Dev-mode consistency guard to copy unchanged** (lines 25-51):
```typescript
function checkSnapshotConsistency(snapshot: ProgressSnapshot): void {
  const categorySum = snapshot.categoryCounts.reduce((a, b) => a + b, 0);
  const outcomeSum = snapshot.outcomes.win + snapshot.outcomes.tie + snapshot.outcomes.lose;
  if (snapshot.categoryCounts.length !== CATEGORY_COUNT) {
    console.error(`[oddsStore consistency guard] categoryCounts has length ${snapshot.categoryCounts.length}, expected ${CATEGORY_COUNT}`);
  }
  if (categorySum !== snapshot.trialsCompleted) {
    console.error(`[oddsStore consistency guard] categoryCounts sum (${categorySum}) does not match trialsCompleted (${snapshot.trialsCompleted})`);
  }
  if (outcomeSum !== snapshot.trialsCompleted) {
    console.error(`[oddsStore consistency guard] outcomes sum (${outcomeSum}) does not match trialsCompleted (${snapshot.trialsCompleted})`);
  }
}
```
This report-only (never throws) guard pattern is exactly right for the new cache layer too — do not make cache-consistency checks throw either.

**`applySnapshot`/`reset` pattern to copy, then extend with cache** (lines 53-67):
```typescript
export const useOddsStore = create<OddsState>()((set) => ({
  ...initialOddsFields(),
  reset: () => set(initialOddsFields()),
  applySnapshot: (snapshot) => {
    if (import.meta.env.DEV) { checkSnapshotConsistency(snapshot); }
    set({ categoryCounts: snapshot.categoryCounts, outcomes: snapshot.outcomes, trialsCompleted: snapshot.trialsCompleted, done: snapshot.done });
  },
}));
```
Add `settledCache: Map<KnowledgeKey, ProgressSnapshot>`, `getCached`, `cacheIfSettled`, `clearCache` per `02-RESEARCH.md` Pattern 2 — critically, always construct a NEW `Map` on write (`new Map(state.settledCache).set(...)`), never mutate in place, per the Zustand reference-equality rule cited in that pattern. This is also where review IN-05 (`done` written-but-never-read) gets resolved: `if (snapshot.done) cacheIfSettled(...)` is the first real consumer of `done`. Also add `setError`/`error` field here for the WR-02 fix (App/simulationService need somewhere to surface a worker failure).

---

### `src/state/simulationService.ts` (service/worker RPC client, request-response/streaming) — MODIFY (generalize)

**Analog:** itself, Phase 1 version (full file above)

**Module-scope singleton + Comlink.wrap pattern to copy unchanged** (lines 1-12):
```typescript
import * as Comlink from 'comlink';
import type { SimulationApi } from '../worker/simulation.worker';
import SimWorker from '../worker/simulation.worker?worker';

// Module scope, not inside a component effect: React 19 StrictMode double-invokes effects
// in development, and instantiating the worker there would leak a second worker thread.
const worker = new SimWorker();
const api = Comlink.wrap<SimulationApi>(worker);

let currentRequestId = 0;
```
Do not move worker instantiation into a component/effect — this module-scope comment is load-bearing and must be preserved verbatim as a comment in the modified file.

**WR-02 + IN-08 fix to apply** (per `01-REVIEW.md` lines 113-124 and 174-178, cited verbatim as the prescribed remediation):
```typescript
export async function startSimulation(...): Promise<void> {
  currentRequestId = requestId;
  const proxyCallback = Comlink.proxy((snapshot: ProgressSnapshot) => {
    if (snapshot.requestId !== currentRequestId) return;
    onProgress(snapshot);
  });
  try {
    await api.cancel(requestId - 1);
    await api.runSimulation(/* generalized args */, requestId, proxyCallback);
  } catch (error) {
    if (requestId === currentRequestId) {
      useOddsStore.getState().setError(error instanceof Error ? error.message : String(error));
    }
  } finally {
    proxyCallback[Comlink.releaseProxy]();
  }
}
```
This single change resolves WR-02 (error surfacing), IN-08 (proxy port leak), and D-13 (widening the trigger set) simultaneously — exactly the "necessarily reworks... as part of that rework" framing in D-14.

---

### `src/ui/CardPicker.tsx` (component, request-response click→state) — NEW

**Analog:** `src/ui/HandDisplay.tsx` for store-reading/testid convention; `src/ui/DealButton.tsx` for click-dispatches-store-action convention.

**Store-read + data-testid convention to copy** (`src/ui/HandDisplay.tsx`, full file above):
```tsx
import { useGameStore } from '../state/gameStore';
import { OPPONENT_COUNT } from '../engine/cards';

export function HandDisplay() {
  const heroHole = useGameStore((state) => state.heroHole);
  return (
    <div>
      <div data-testid="hero-hole">
        {heroHole?.map((card) => <span key={card}>{card}</span>)}
      </div>
      ...
    </div>
  );
}
```
`data-testid` attributes are contractual per `02-CONTEXT.md` ("keep testids stable where possible") — every new interactive element needs one (`hero-slot-0`, `flop-slot-0`, `card-btn-As`, etc., planner/executor's naming call, but MUST be stable and MUST be added, not omitted).

**Click-dispatches-action convention to copy** (`src/ui/DealButton.tsx`, full file above):
```tsx
import { useGameStore } from '../state/gameStore';

export function DealButton() {
  const deal = useGameStore((state) => state.deal);
  return (
    <button type="button" onClick={deal}>
      Deal
    </button>
  );
}
```
Every slot button and every 52-card grid button follows this exact `<button type="button" onClick={...}>` shape (no custom form handling, no preventDefault needed).

**Suit-grouped disabled-rendering pattern** — use verbatim from `02-RESEARCH.md` Pattern 4 (already written against this project's real `ALL_SUITS`/`ALL_RANKS` exports, confirmed in `node_modules/@poker-apprentice/types/dist/types/constants.d.ts`: `ALL_RANKS = ["2",...,"A"]`, `ALL_SUITS = ["c","d","h","s"]`):
```tsx
import { ALL_SUITS, ALL_RANKS } from '@poker-apprentice/types';

function CardGrid({ usedCards, onPick }: { usedCards: Set<Card>; onPick: (c: Card) => void }) {
  return (
    <>
      {ALL_SUITS.map((suit) => (
        <div key={suit}>
          {ALL_RANKS.map((rank) => {
            const card = `${rank}${suit}` as Card;
            const isUsed = usedCards.has(card);
            return (
              <button key={card} type="button" disabled={isUsed}
                title={isUsed ? 'Already used in this hand' : undefined}
                onClick={() => onPick(card)}>
                {card}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}
```

---

### `src/ui/StreetControls.tsx` (component, event-driven) — NEW

**Analog:** `src/ui/DealButton.tsx` (full file above — identical shape, just two buttons instead of one, plus a label span read from `gameStore.street`)

```tsx
export function StreetControls() {
  const street = useGameStore((state) => state.street);
  const advance = useGameStore((state) => state.advanceStreet);
  const rewind = useGameStore((state) => state.rewindStreet);
  return (
    <div>
      <span data-testid="street-label">{street}</span>
      <button type="button" onClick={rewind} disabled={/* at preflop */}>Rewind</button>
      <button type="button" onClick={advance} disabled={/* at river */}>Advance</button>
    </div>
  );
}
```
No styling required (D-04/street-indicator note in `02-CONTEXT.md`: "unstyled buttons + label; anything readable is fine").

---

### `src/ui/BoardDisplay.tsx` (component, transform/derived render) — NEW

**Analog:** `src/ui/HandDisplay.tsx`'s `hero-hole`/`opponents` derived-list rendering (full file above)

```tsx
<div data-testid="hero-hole">
  {heroHole?.map((card) => <span key={card}>{card}</span>)}
</div>
```
`BoardDisplay` is the same shape: read `board` and `street` from `gameStore`, slice `board.slice(0, STREET_BOARD_COUNT[street])`, map to `<span>` elements under a `data-testid="board"` container — this is a pure derived-render component with zero local state, exactly like `HandDisplay`'s hero-hole block. Also see `src/ui/OddsTable.tsx`'s formatting-helper convention (`formatPct`, top-of-file, defined outside the component) if `BoardDisplay` needs a card-label formatter.

---

### `src/ui/HandDisplay.tsx` (component, event-driven, extended) — MODIFY

**Analog:** itself, Phase 1 version (full file above)

Opponent seats currently render as static `<span key={i}>Hidden</span>` (lines 12-16). Convert each to a clickable element following `DealButton`'s `onClick`-dispatches-store-action convention:
```tsx
<div data-testid="opponents">
  {Array.from({ length: OPPONENT_COUNT }, (_, i) => (
    <button key={i} type="button" onClick={() => reveal(i)} data-testid={`opponent-seat-${i}`}>
      {isRevealed(i) ? opponentHoles[i].join(' ') : 'Hidden'}
    </button>
  ))}
</div>
```
Keep the `data-testid="opponents"` container and its `.children` count contract intact (App.test.tsx currently asserts `opponents.children).toHaveLength(3)` — do not rename or restructure this container).

---

### `src/App.tsx` (root component, event-driven effect orchestration) — MODIFY (generalize)

**Analog:** itself, Phase 1 version (full file above)

**Current effect (the thing being replaced) — cite as "what NOT to leave as-is":**
```tsx
useEffect(() => {
  if (!heroHole) return;
  useOddsStore.getState().reset();
  void startSimulation(heroHole, deckWithout(heroHole), dealNonce, (snapshot) =>
    useOddsStore.getState().applySnapshot(snapshot),
  );
}, [heroHole, dealNonce]);
```
No cleanup function (WR-01), no try/catch (WR-02), narrow dependency array (only `dealNonce`, not street/reveal).

**Replacement pattern to use** — copy `02-RESEARCH.md`'s "Effect wiring with ignore-flag cleanup" code example verbatim (already written against this codebase's actual store/service shapes):
```tsx
useEffect(() => {
  const runout = useGameStore.getState().runout;
  if (!runout) return;
  const { street, revealedMask } = useGameStore.getState();
  const cached = useOddsStore.getState().getCached(street, revealedMask);
  if (cached) {
    useOddsStore.getState().applySnapshot(cached);
    return; // cache hit — no worker invocation at all
  }
  let ignore = false; // React's canonical cleanup-token pattern
  useOddsStore.getState().reset();
  void (async () => {
    try {
      await startSimulation(deriveConditionedState(runout, street, revealedMask), (snapshot) => {
        if (ignore) return;
        useOddsStore.getState().applySnapshot(snapshot);
        if (snapshot.done) useOddsStore.getState().cacheIfSettled(street, revealedMask, snapshot);
      });
    } catch (error) {
      if (!ignore) useOddsStore.getState().setError(String(error));
    }
  })();
  return () => { ignore = true; void cancelSimulation(); };
}, [dealNonce, street, revealedMask]);
```

---

### `src/App.test.tsx` (test, event-driven) — MODIFY

**Analog:** itself, Phase 1 version (full file above)

**Explicit-factory worker mock pattern to copy unchanged** (lines 15-17):
```tsx
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
}));
```
The comment above it in the current file explains WHY (automocking still imports the real module and instantiates a real Worker under jsdom) — keep that comment when extending this test file; it is the single most important gotcha for anyone adding new mocked-service tests (pickerStore/gameStore UI tests will need the identical mock shape). The `mockImplementation` streaming-snapshot pattern (lines 44-66, 98-109) is the template for new tests asserting street-navigation cache-hit/cache-miss UI behavior and reveal-triggers-recompute behavior.

---

## Shared Patterns

### Zustand store creation convention
**Source:** `src/state/gameStore.ts` lines 18-26, `src/state/oddsStore.ts` lines 53-67
**Apply to:** `pickerStore.ts` (new), extended `gameStore.ts`, extended `oddsStore.ts`
```typescript
export const useXStore = create<XState>()((set, get) => ({
  // ...initial fields...
  someAction: (arg) => set((state) => ({ /* new fields, always fresh object/Map/array */ })),
}));
```
Never mutate `Map`/array/object fields in place — always construct a new instance on `set()` (Zustand reference-equality rule, cited in `02-RESEARCH.md`'s Pattern 2/3 for `settledCache` and `revealedMask`).

### Ignore-flag effect cleanup (WR-01 fix, extended to 3 triggers)
**Source:** `01-REVIEW.md` lines 80-107 (fix sketch); `02-RESEARCH.md` "Effect wiring with ignore-flag cleanup" code example
**Apply to:** `src/App.tsx`, and `src/worker/simulationApi.ts`'s run-token check
A `let ignore = false` local in the effect, flipped to `true` in the returned cleanup, checked before every state-mutating callback inside the effect's async body. Must cover ALL of `[dealNonce, street, revealedMask]`, not just deal — per Pitfall 3 in `02-RESEARCH.md`, a narrow fix that only covers re-deal leaves the identical race reachable via rapid street-navigation or reveal clicks.

### try/finally Comlink releaseProxy (WR-02 + IN-08 fix)
**Source:** `01-REVIEW.md` lines 113-124, 174-178
**Apply to:** `src/state/simulationService.ts`
```typescript
try {
  await api.runSimulation(...);
} catch (error) {
  if (requestId === currentRequestId) useOddsStore.getState().setError(String(error));
} finally {
  proxyCallback[Comlink.releaseProxy]();
}
```

### Defensive copy on every streamed snapshot
**Source:** `src/worker/simulationApi.ts` lines 84-91
**Apply to:** any new worker-boundary code that constructs a `ProgressSnapshot`
```typescript
await onProgress({
  requestId,
  categoryCounts: [...totals.categoryCounts],
  outcomes: { ...totals.outcomes },
  trialsCompleted: totals.trialsCompleted,
  done,
});
```
Never hand the caller a reference to a mutable running total.

### Dev-mode report-only consistency guard
**Source:** `src/state/oddsStore.ts` lines 25-51
**Apply to:** any new invariant check on cached/derived odds data (e.g., a guard that a cache entry's `knowledgeKey` matches the snapshot it's keyed under)
`console.error` only, gated by `import.meta.env.DEV`, never throws — keeps the live display unbreakable even when a check fails.

### `data-testid` contract stability
**Source:** `src/ui/HandDisplay.tsx`, `OddsTable.tsx`, `WinTieLossDisplay.tsx` (all testids cited in `02-CONTEXT.md` as contractual: `hero-hole`, `opponents`, `trial-counter`, `win-pct`, `tie-pct`, `lose-pct`, `category-pct-{n}`, `category-table`)
**Apply to:** every UI file, modified or new
Do not rename or restructure existing testid-bearing containers; add new testids (`street-label`, `opponent-seat-{i}`, `board`, per-slot picker ids) following the same lowercase-hyphenated, semantic-not-implementation naming style.

### `deckWithout` as the single duplicate-block primitive
**Source:** `src/engine/cards.ts` lines 13-17
**Apply to:** `pickerStore.ts` (used-card set for the picker's `disabled` rendering), `gameStore.deal()` (random-fill pool)
Reused unchanged — do not write a second/parallel duplicate-filtering function.

### Explicit `vi.mock` factory for the worker-backed service (never automock)
**Source:** `src/App.test.tsx` lines 15-17
**Apply to:** any new test file that renders a component transitively depending on `simulationService`
`vi.mock('./state/simulationService', () => ({ startSimulation: vi.fn() }))` — automocking still imports the real module (which instantiates a Worker at module scope) and fails under jsdom.

### `// @vitest-environment node` for engine/worker-layer tests
**Source:** `src/engine/equity.test.ts` line 1, `src/engine/equity.property.test.ts` line 1, `src/worker/simulationApi.test.ts` line 1
**Apply to:** `conditioning.test.ts`, any new engine-layer or `simulationApi`-adjacent test
Pure computation/worker-boundary tests run under Node, not jsdom — only component tests (`App.test.tsx`-style) need the (default) jsdom environment.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/state/pickerStore.test.ts` (if planner creates one) | test | CRUD | No existing store has its own standalone unit-test file — Phase 1 tested `gameStore`/`oddsStore` only indirectly through `App.test.tsx`'s mocked-service integration tests. If the planner wants direct store unit tests (recommended, since picker-draft merge logic and reveal-bitmask logic are pure and easy to unit test), there is no in-repo precedent file to copy structurally — fall back to plain Vitest `describe`/`it` against `useXStore.getState()`, no special environment or mocking needed (stores have no Worker/Comlink dependency of their own). |
| `src/ui/CardPicker.test.tsx` / `StreetControls.test.tsx` (if planner creates them) | test | request-response / event-driven | No standalone component test files exist in Phase 1 — all UI behavior was verified through `App.test.tsx`'s full-tree render. Planner should decide whether Phase 2's larger UI surface (picker + street controls + seats) still fits comfortably in one `App.test.tsx`, or warrants splitting into per-component test files using `@testing-library/react` directly (no existing split-file precedent to copy, but the render/`userEvent.setup()`/`screen.getByTestId` idioms already used in `App.test.tsx` transfer directly). |

## Metadata

**Analog search scope:** `src/engine/`, `src/worker/`, `src/state/`, `src/ui/`, `src/App.tsx`, `src/App.test.tsx` (entire Phase 1 codebase — small enough to read in full rather than sample)
**Files scanned:** 17 source files + 5 test files (all of `src/` as of Phase 1 completion)
**Pattern extraction date:** 2026-08-24
