# Architecture Research

**Domain:** Client-side Monte Carlo poker (Texas Hold'em) simulator with live graphical table
**Researched:** 2026-08-23
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          MAIN THREAD — UI                            │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐ │
│  │ TableScene │  │   Card /   │  │  OddsTable /│  │  Controls       │ │
│  │ (felt,     │  │ CardGrid   │  │  WinTieLoss │  │ (advance/rewind,│ │
│  │  seats)    │  │ (picker)   │  │  /Converge  │  │  deal, reveal)  │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └───────┬─────────┘ │
│        │  reads         │  reads        │ reads           │ dispatch │
│        └────────────────┴───────┬───────┴─────────────────┘         │
│                                  ▼                                    │
│                    ┌───────────────────────────┐                      │
│                    │   State Layer (main thread) │                    │
│                    │  gameStore (authoritative)  │                    │
│                    │  oddsStore (derived/async)  │                    │
│                    │  history (street snapshots) │                    │
│                    └──────────────┬──────────────┘                    │
│                                   │ watches game state, owns worker    │
│                                   ▼                                    │
│                    ┌───────────────────────────┐                      │
│                    │   SimulationService         │                    │
│                    │  (coordinator / glue)       │                    │
│                    └──────────────┬──────────────┘                    │
└───────────────────────────────────┼───────────────────────────────────┘
                          postMessage │ ▲ postMessage
                    SimRequest/Cancel │ │ SimProgress/SimDone
                                      ▼ │
┌──────────────────────────────────────────────────────────────────────┐
│                        WEB WORKER — SIMULATION                       │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Trial Loop: deal unknown cards → evaluate all hands → tally    │  │
│  │  Chunked (e.g. 2,000 trials/batch), posts progress each chunk   │  │
│  └───────────────────────────┬────────────────────────────────────┘  │
├──────────────────────────────┴────────────────────────────────────────┤
│                     ENGINE (pure, framework-agnostic)                 │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────────┐      │
│  │  Deck /  │   │  7-card Hand │   │  Equity / Trial Runner    │      │
│  │  RNG     │   │  Evaluator   │   │  (conditions on known     │      │
│  │          │   │  (lookup tbl)│   │   cards, samples unknowns)│      │
│  └──────────┘   └──────────────┘   └──────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

The single most important structural decision in this domain: **the engine (deck, evaluator, trial runner) has zero DOM/UI dependencies and can run identically in Node (for tests), in a Web Worker (for production), or synchronously on the main thread (for tiny/debug runs)**. Everything else in the architecture exists to feed known-card state into that engine and stream its output back to pixels.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Deck/RNG | Represent a 52-card deck, remove "known" cards, shuffle/sample the remainder | Cards as small integers (`rank * 4 + suit`, 0–51); Fisher–Yates or partial (swap-based) shuffle; seedable PRNG (e.g. mulberry32) for reproducible "what-if" runs |
| Hand Evaluator | Given 7 cards, return best 5-card hand's category + comparable strength | Precomputed lookup table (Two-Plus-Two / perfect-hash style, e.g. Cactus Kev derivative); pure function, no allocation in hot path |
| Equity / Trial Runner | Given known cards + which opponents are hidden, run N random completions and tally win/tie/lose + hand-category outcomes for the hero | Tight loop: sample missing cards from remaining deck, evaluate hero + each opponent, compare, increment counters (typed arrays) |
| Worker Wrapper | Own the trial loop's execution context; chunk work; stream progress; support cancellation | `simulation.worker.ts` using `postMessage`/`onmessage`; runs trial runner in batches inside a loop, yielding to the event loop between batches |
| SimulationService (coordinator) | Bridge game state → worker requests → odds state; manage worker lifecycle, request generations, cancellation | Plain TS class or store-subscription glue on the main thread; not a UI component |
| gameStore | Authoritative source of truth for street, hero cards, board, opponent known/hidden state, dead cards, deal mode | Small reactive store (Zustand/Redux/Signals/whatever the chosen framework favors) |
| oddsStore | Derived, asynchronous, worker-fed odds data (category histogram, win/tie/lose, trial count) | Separate store from gameStore; only the SimulationService writes to it |
| history | Per-street snapshots enabling rewind/advance | Array of immutable game-state snapshots indexed by street |
| TableScene / Seat / CommunityCardArea | Lay out felt table, seat positions, community card row | SVG or DOM+CSS component tree, presentational |
| Card / CardGrid | Render a single card (face up/down, rank/suit) and a full-deck picker grid | Presentational component, props-only (no store access) |
| OddsTable / WinTieLoss / ConvergenceIndicator | Visualize oddsStore contents, update as progress messages arrive | Presentational, subscribes to oddsStore only |
| Controls | Street advance/rewind, deal/re-deal, manual card picker open, opponent reveal buttons | Presentational, dispatches gameStore actions only |

## Recommended Project Structure

```
src/
├── engine/                    # Pure simulation logic — no DOM, no framework, unit-testable in Node
│   ├── cards.ts                # Card type/encoding, full-deck generation, rank/suit helpers
│   ├── deck.ts                 # Shuffle, seedable RNG, "remaining deck given known cards"
│   ├── evaluator.ts            # 7-card hand evaluator public API (evaluate(cards) -> {category, strength})
│   ├── evaluator.tables.ts     # Precomputed lookup tables (generated once by a script, committed)
│   ├── equity.ts               # runTrials(conditionedState, trialCount) -> aggregated counts
│   └── *.test.ts                # Correctness tests vs known benchmark odds (e.g. AA preflop heads-up)
├── worker/
│   ├── simulation.worker.ts    # Worker entry point: receives requests, chunks equity.runTrials, streams progress
│   └── protocol.ts             # Message type definitions shared by main thread and worker
├── state/
│   ├── gameStore.ts            # Street, hero/board/opponent cards, deal mode — authoritative, sync
│   ├── history.ts              # Street snapshot stack — rewind/advance without re-randomizing
│   ├── oddsStore.ts            # Category histogram, win/tie/lose, trial count — derived, async
│   └── simulationService.ts    # Watches gameStore, owns the worker, manages request generation IDs
├── ui/
│   ├── table/                  # TableScene, Seat, CommunityCardArea
│   ├── card/                   # Card, CardBack, CardGrid (manual picker)
│   ├── odds/                   # HandCategoryTable, WinTieLossDisplay, ConvergenceIndicator
│   └── controls/               # StreetControls, DealButton, RevealButton, ManualPickerPanel
└── app entry (main.tsx / App.tsx — wires stores to the worker and mounts the UI tree)
```

### Structure Rationale

- **`engine/`:** Deliberately has no imports from `state/`, `ui/`, or `worker/`. This is what makes it possible to build and correctness-test the hardest part of the project (hand evaluation, equity math) before any pixel exists, and to run it in a plain Node test file, in the worker, or synchronously for tiny manual-picker recalculations.
- **`worker/`:** Thin glue only — chunking, message shape, cancellation. No poker logic lives here; it imports `engine/` and nothing else project-specific.
- **`state/`:** Split into `gameStore` (what the user *chose* — synchronous, instant) and `oddsStore` (what the simulation *computed* — asynchronous, streams in over time). Keeping these as two stores, not one, avoids a whole class of bugs where a UI render shows odds that don't match the currently-selected cards.
- **`ui/`:** Organized by table region, not by generic atomic-design buckets — matches how a poker table is actually composed and keeps `Card` reusable between the table and the manual picker grid.

## Architectural Patterns

### Pattern 1: Engine as a pure, worker-portable module

**What:** The deck, evaluator, and trial runner are plain functions/classes with no `window`, `document`, or framework imports. The exact same `equity.ts` module is imported by both a Node test file and the Web Worker entry point.
**When to use:** Always, for this project — it's the pattern that makes "engine first" build ordering possible and makes correctness testable independent of UI.
**Trade-offs:** Requires discipline not to reach for DOM/store globals from inside engine code "just this once." Pays for itself immediately: engine tests run in milliseconds with `vitest`/`node`, no browser needed.

**Example:**
```typescript
// engine/equity.ts — no DOM, no framework
export interface ConditionedState {
  heroHole: [Card, Card];
  board: Card[];              // 0..5 known board cards
  opponents: (Card[] | 'hidden')[]; // length 3; fixed cards if revealed
  deadCards: Card[];
}

export function runTrials(state: ConditionedState, trialCount: number, rng: () => number): TrialBatchResult {
  // sample missing board cards + hidden opponents from remaining deck each trial,
  // evaluate hero + all opponents, tally win/tie/lose and hero's hand category
}
```

### Pattern 2: Worker as a chunked, cancellable, generation-tagged stream

**What:** Rather than one giant `postMessage` request that runs to completion, the worker runs trials in small batches (e.g. 2,000–5,000), posting an incremental `PROGRESS` message after each batch. Every request carries a `requestId` (a monotonically increasing generation counter); both sides ignore any message that doesn't match the current generation.
**When to use:** Any time the underlying conditioned state can change while trials are in flight — which is constantly here (street advance, rewind, reveal, manual card edit all invalidate the current run).
**Trade-offs:** Slightly more message-passing overhead than "fire and wait," but this is what makes (a) live convergence visible and (b) rapid user interaction (spam-clicking reveal/rewind) safe without stale results flashing on screen.

**Example:**
```typescript
// worker/protocol.ts
export type SimRequest = {
  type: 'RUN_SIMULATION';
  requestId: number;
  state: ConditionedState;
  batchSize: number;
  seed?: number;
};
export type SimCancel = { type: 'CANCEL_SIMULATION'; requestId: number };

export type SimProgress = {
  type: 'PROGRESS';
  requestId: number;
  trialsCompleted: number;
  categoryCounts: Uint32Array;      // 9 hand categories, high card..royal flush
  outcomes: { win: number; tie: number; lose: number };
};
export type SimDone = { type: 'DONE'; requestId: number; totalTrials: number };
```

```typescript
// worker/simulation.worker.ts (sketch)
let currentRequestId = -1;
self.onmessage = (e: MessageEvent<SimRequest | SimCancel>) => {
  if (e.data.type === 'CANCEL_SIMULATION') { currentRequestId = -1; return; }
  const { requestId, state, batchSize } = e.data;
  currentRequestId = requestId;
  const totals = createEmptyTally();
  const loop = () => {
    if (requestId !== currentRequestId) return; // superseded — stop silently
    runTrials(state, batchSize, rng).mergeInto(totals);
    postMessage({ type: 'PROGRESS', requestId, ...snapshot(totals) });
    setTimeout(loop, 0); // yield so cancel/new requests can be processed
  };
  loop();
};
```

### Pattern 3: Re-condition, don't reuse, trials on any state change

**What:** When the conditioning set changes (new street dealt, an opponent revealed, a manual card edited, a rewind), the previous accumulated trial counts are **discarded**, not adjusted — a fresh `RUN_SIMULATION` request starts a new tally from zero.
**When to use:** Every state transition in this app. Conditioning on a newly revealed card doesn't just narrow existing samples (that would require importance-reweighting or rejection sampling against the old sample set — needlessly complex); it changes what "unknown" means, so the cleanest correct approach is: recompute the remaining deck, restart sampling.
**Trade-offs:** Costs a brief re-convergence period after every action (which is actually desirable here — the "watch percentages resettle" moment *is* the pedagogical payoff described in the project's Core Value). The alternative (incremental reweighting) is more complex and error-prone for a learning tool where trust in the displayed numbers matters most.

## Data Flow

### Simulation Request Flow

```
User action (advance street / reveal opponent / edit card / rewind)
    ↓
gameStore updated (synchronous, authoritative)
    ↓
SimulationService observes gameStore change
    ↓
increments requestId (generation), posts CANCEL for old id, posts new SimRequest
    ↓
Worker: runs trial loop in chunks → posts PROGRESS per chunk
    ↓
SimulationService receives PROGRESS, checks requestId matches latest, writes into oddsStore
    ↓
Odds UI (HandCategoryTable, WinTieLossDisplay, ConvergenceIndicator) re-renders from oddsStore
```

### State Management

```
gameStore (street, heroHole, board[], opponents[], deadCards, dealMode)
    ↓ read                                      ↑ dispatch (advance/rewind/reveal/deal/manual-set)
TableScene, Card, Controls  ←───────────────────┘

oddsStore (categoryCounts, outcomes, trialsCompleted)
    ↑ write-only via SimulationService (from worker PROGRESS/DONE messages)
    ↓ read
OddsTable, WinTieLossDisplay, ConvergenceIndicator
```

Two stores, one-directional per store: `gameStore` is only ever mutated by user actions (Controls); `oddsStore` is only ever mutated by the SimulationService relaying worker output. No component writes to `oddsStore` directly, and the worker never touches `gameStore` — it only receives a conditioned snapshot as a message payload.

### Key Data Flows

1. **Street advance/rewind:** Controls dispatch a gameStore action → `history.ts` either pushes a new snapshot (advance, first time) or moves a pointer to an existing snapshot (rewind, or re-advance after rewind) → gameStore updates → SimulationService restarts the worker run with the newly conditioned state.
2. **Opponent reveal:** Controls dispatch "reveal opponent N" → gameStore moves that opponent's hole cards from `'hidden'` to fixed `Card[]` → the conditioned state sent to the worker now includes those cards as *both* known/blocked (unavailable to other deals) *and* fixed inputs to every trial's evaluation, changing win/tie/lose and (often) narrowing the hero's hand-category distribution.
3. **Manual card picker:** User opens CardGrid → grid excludes any card already present in gameStore's known-card set (hero hole, dealt board, revealed opponents, dead cards) → selecting a card dispatches a gameStore "set card" action → same downstream re-conditioning flow as above.
4. **Live convergence rendering:** Each worker PROGRESS message is a full running total (not a delta), so the UI simply replaces oddsStore's numbers each time — no client-side accumulation logic duplicated outside the worker, avoiding drift between what the worker thinks the totals are and what the UI displays.

## How Conditioning on Revealed Cards Changes the Simulation

This is the mechanic the project's Core Value explicitly hinges on ("watch how each new piece of information reshapes the numbers"), so it deserves explicit treatment:

- **Unknown opponent (default):** In every trial, that opponent's 2 hole cards are randomly sampled from the remaining deck along with any undealt board cards. Their hand still competes for win/tie/lose, but which specific cards they hold varies trial to trial — this is what "anonymous but real" means mathematically.
- **Revealed opponent:** Their hole cards become part of the **known/blocked** set (removed from the pool other trials sample from, exactly like the hero's hole cards or the dealt board) but remain **fixed inputs** to the hand-comparison step of every trial. This simultaneously (a) shrinks the sampling space for everyone else's unknowns and (b) makes that opponent's actual equity — not an average opponent — visible.
- **Rewinding a street:** Cards dealt on streets after the rewind point return to the "unknown" pool for simulation purposes. The recommended state design: **the underlying dealt board array is preserved**, and rewind only moves a "revealed-through" index/pointer backward. Re-advancing forward after a rewind (without hitting re-deal) shows the *same* cards that were there before — this matches user expectation ("rewind to look again" implies nothing changed) and avoids a confusing re-randomization on every rewind/advance toggle. A separate, explicit "re-deal" action is what actually reshuffles.
- **Dead cards / manual picker:** Any card assigned anywhere (hero, board, a specific revealed opponent, or explicitly marked dead) is removed from the deck the trial runner samples from. The same "known-card set" computation used to filter the manual picker's available-card grid is the same computation used to build the worker's conditioned request — one function, two consumers, to guarantee they can't drift apart.
- **Deliberately not exact-enumerating:** In situations with very few unknown cards (e.g., river with only one opponent still hidden — a fully enumerable ~C(46,2) space), it is tempting to switch to exact enumeration for a "perfect" instant answer. **Don't** — the project's stated value is watching Monte Carlo convergence itself, including trial counts, as a visible mechanic. Keep sampling (optionally note in the UI when the sample space is small enough that convergence will be near-instant) rather than silently swapping in a different algorithm.

## Scaling Considerations

This is a single-user, client-side tool — "scale" here means simulation throughput and device performance, not concurrent users.

| Scenario | Architecture Adjustments |
|----------|---------------------------|
| Early preflop, all 3 opponents hidden, no board (largest unknown space: up to 11 cards sampled per trial, 4 hand evaluations per trial) | Baseline case — must sustain smooth convergence via chunked worker streaming; lookup-table evaluator (not naive combinatorial checking) required here |
| Late streets / some opponents revealed (smaller unknown space) | Same code path — fewer cards sampled and fewer evaluations per trial, so convergence is simply faster; no special-casing needed |
| Low-end/mobile device | Trial batch size should be tunable (smaller batches = more frequent, cheaper progress messages = UI stays responsive on slow CPUs); avoid transferring large payloads per message — send aggregated typed-array counts, not per-trial data |

### Scaling Priorities

1. **First bottleneck:** Hand evaluator speed. A naive "check all 21 five-card subsets of 7 cards with generic straight/flush detection" evaluator is fine for correctness bootstrapping but will visibly cap trial throughput once wired to the worker. Fix: swap in a lookup-table evaluator (see Sources) behind the same function signature — the trial runner and worker don't need to change.
2. **Second bottleneck:** postMessage overhead if progress messages are too frequent or carry too much data. Fix: batch trials (thousands per message, not one message per trial) and keep the payload to small typed arrays/plain counts, not full per-trial hand objects.

## Anti-Patterns

### Anti-Pattern 1: Running the whole simulation on the main thread with `setTimeout`/`requestIdleCallback` chunking instead of a Worker

**What people do:** Skip the Worker to "keep it simple," chunking trials across animation frames on the main thread.
**Why it's wrong:** Every chunk still competes with layout/paint/input handling on the same thread; on anything but a very fast device, card-flip animations and click responsiveness visibly stutter while trials run — exactly the opposite of the "live, responsive table" the project wants.
**Do this instead:** Use a dedicated Web Worker for the trial loop from the start (per Constraints in PROJECT.md — this is explicitly called out as "likely Web Worker territory"). Reserve main-thread chunking only as a documented fallback for environments where Workers are unavailable, if that's ever a requirement.

### Anti-Pattern 2: Reusing/mutating shared arrays across trials without resetting per-trial state

**What people do:** For performance, allocate one "used cards" array or one opponent hole-card array outside the trial loop and mutate it in place each trial — but forget to fully reset it (e.g., leftover `true` flags from a previous trial's larger board), silently corrupting later trials' card availability.
**Why it's wrong:** Produces wrong equity numbers that are *close* to correct (so they look plausible) but are quietly biased — the worst kind of bug for a tool whose entire purpose is teaching correct probability.
**Do this instead:** Reuse allocations for performance (typed arrays, index-based swap-shuffle of a fixed-size deck array), but make the reset step between trials explicit, cheap, and covered by a correctness test that runs many trials and checks aggregate stats against known benchmark odds (e.g., pocket aces heads-up preflop equity).

### Anti-Pattern 3: Coupling the `Card` component to global game state

**What people do:** Have the `Card` component reach into `gameStore` directly (e.g., "the hero's first hole card") instead of receiving `{ rank, suit, faceUp }` as props.
**Why it's wrong:** Blocks reuse of the same component in the manual card-picker grid (which needs to render up to 52 cards with no relation to "whose card is this"), and makes the table layout untestable/unstorybook-able in isolation.
**Do this instead:** Keep `Card` fully presentational and props-driven; let `TableScene`/`CardGrid` be the only components that know how to map store state to a list of `Card` props.

### Anti-Pattern 4: Letting stale worker messages update the UI

**What people do:** Post a new simulation request on every state change but don't tag/track which request is "current," so a slow in-flight PROGRESS message from a superseded request (e.g., user already advanced past it) overwrites fresher odds with stale ones.
**Why it's wrong:** Produces visible "flicker back" to wrong numbers, especially when the user interacts quickly (rapid reveal-clicking, fast street navigation) — directly undermines trust in a tool whose job is showing correct probabilities.
**Do this instead:** Tag every request/response pair with a monotonically increasing `requestId`; discard any message (in the worker and in the coordinator) that doesn't match the latest known id, per Pattern 2 above.

## Integration Points

### External Services

None. Per the project's constraints (client-side only, no backend), this app has no external services to integrate — everything (deck, evaluator, trial runner, rendering) executes in the browser. The only "integration" is the standard library boundary between the main thread and a Web Worker it spawns itself.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| `engine/` ↔ `worker/` | Direct function import (same JS realm inside the worker) | No serialization cost here — the worker just calls `runTrials()` in-process |
| `worker/` ↔ `state/simulationService.ts` | `postMessage`/`onmessage`, generation-tagged messages (Pattern 2) | This is the only structured-clone boundary in the app; keep payloads small (typed arrays of counts, not full hand objects) |
| `state/gameStore` ↔ `ui/` | Store subscription (framework-specific: Zustand selectors, Redux `useSelector`, or signals) | Read-only for display components; writes only via dispatched actions from `ui/controls` |
| `state/oddsStore` ↔ `ui/odds` | Store subscription | Write-only by `simulationService`; never written to directly by UI |
| `state/gameStore` ↔ `state/simulationService.ts` | Subscription/watch, not a message-passing boundary (same thread) | Service reacts to game state changes and derives the next `SimRequest` payload from it |

## Sources

- [HenryRLee/PokerHandEvaluator](https://github.com/HenryRLee/PokerHandEvaluator) — 7-card and Omaha hand evaluation algorithm using perfect hashing; explains the lookup-table approach in depth (HIGH confidence, official project docs)
- [thlorenz/phe](https://github.com/thlorenz/phe) — pure-JavaScript hand evaluator confirmed browser/Web-Worker compatible via direct fetch, compact table via perfect hashing, supports 5–7 card evaluation with `evaluateCards`/`rankCards` API (HIGH confidence, verified directly)
- [Cactus Kev's Poker Hand Evaluator](http://suffe.cool/poker/evaluator.html) — foundational reference for the bit-twiddling + lookup-table evaluation approach that Two-Plus-Two/perfect-hash evaluators build on (MEDIUM confidence, long-standing community reference, verified via multiple secondary sources)
- [decs/texas](https://github.com/decs/texas/) — JS implementation of the Two-Plus-Two lookup-table method for 5–7 card Hold'em evaluation, useful as an architecture/API reference even if not adopted directly (MEDIUM confidence)
- [OMPEval (dalorveen fork)](https://github.com/dalorveen/OMPEval) — example of perfect hashing reducing a hand-evaluator lookup table from 36MB to ~200KB, relevant to bundle-size tradeoffs for a client-side app (MEDIUM confidence)
- [cookpete/poker-odds](https://github.com/cookpete/poker-odds) — reference implementation of a `calculateEquity()`-style API returning win/tie counts and hand-category breakdowns, useful shape reference for `equity.ts`'s public API (MEDIUM confidence)
- WebSearch synthesis on Web Worker + streaming patterns (chunked progress updates, backpressure, avoiding UI floods) confirms chunked/generation-tagged progress streaming as the standard approach for long-running in-browser simulations (MEDIUM confidence — pattern is well-established general Web Worker practice, not poker-specific)
- WebSearch synthesis on Canvas vs SVG vs DOM for card UIs: SVG/DOM+CSS is preferred over Canvas for scenes with a small, bounded number of interactive elements (a poker table has at most ~13 visible cards plus a deck), since DOM/SVG cards remain individually stylable/clickable (needed for reveal-on-click) without sacrificing meaningful performance at this element count (MEDIUM confidence — general rendering guidance, not project-specific benchmark)

---
*Architecture research for: Client-side Monte Carlo Texas Hold'em poker simulator*
*Researched: 2026-08-23*
