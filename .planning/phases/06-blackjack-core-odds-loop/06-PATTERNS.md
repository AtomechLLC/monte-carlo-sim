# Phase 6: Blackjack Core Odds Loop - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 24 new/modified units (engine 3, worker 3, state 4, UI 9, tests 5)
**Analogs found:** 21 / 24 (2 style-only, 1 partial)

Sources: 06-CONTEXT.md (D-01..D-14, D-03a/b), 06-RESEARCH.md (file layout, correctness spec), direct read of every analog cited below at current HEAD (7d8fb13).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engine/blackjackHandValue.ts` | engine (pure rules) | transform | none — RESEARCH spec; style from `src/engine/shoe.ts` | no-analog (style only) |
| `src/engine/blackjackConditioning.ts` | engine (derivation) | transform | `src/engine/conditioning.ts` | exact |
| `src/engine/blackjackEquity.ts` | engine (trial loop) | batch | `src/engine/equity.ts` | exact |
| `src/worker/blackjackProtocol.ts` | config/types | streaming | `src/worker/protocol.ts` | exact |
| `src/worker/blackjackSimulationApi.ts` | worker config | streaming | `src/worker/simulationApi.ts` | exact |
| `src/worker/simulation.worker.ts` (MODIFIED) | worker entry | streaming | itself + RESEARCH Pattern 4 | exact |
| `src/worker/simulationApi.ts` (MODIFIED, WR-02/D-09) | worker config | streaming | its own `validateConditionedState` | exact |
| `src/state/blackjackStore.ts` | store (round state) | event-driven | `src/state/gameStore.ts` | exact |
| `src/state/blackjackOddsStore.ts` | store (odds/cache) | streaming consumer | `src/state/oddsStore.ts` | exact |
| `src/state/blackjackSimulationService.ts` (or split per ARCHITECTURE.md) | service | request-response | `src/state/simulationService.ts` | exact |
| `src/state/gameModeStore.ts` (MODIFIED, restore signal) | store | event-driven | its own `holdemRestorePending` | exact |
| `src/App.tsx` (MODIFIED, mode fork only) | shell | — | itself | exact |
| `src/ui/HoldemGame.tsx` (D-07 extraction) | component (game root) | event-driven | `src/App.tsx` lines 23-207 (verbatim move) | exact |
| `src/ui/BlackjackGame.tsx` | component (game root, odds effect) | event-driven | `src/App.tsx` odds effect (45-121) | exact |
| `src/ui/BlackjackTable.tsx` | component (composition root) | event-driven | `src/ui/TableScene.tsx` | exact |
| Dealer area / player hand components | component (card seats) | event-driven | `src/ui/Seat.tsx` + `FlipCard.tsx` + `AnimatedCard.tsx` | role-match |
| `src/ui/BlackjackOddsPanel.tsx` | component (odds dock) | streaming display | `src/ui/OddsPanel.tsx` | exact |
| `src/ui/DealerDistributionDisplay.tsx` | component (7-bucket table) | streaming display | `src/ui/OddsTable.tsx` | exact |
| `src/ui/BustEvDisplay.tsx` | component (stat tiles) | streaming display | `src/ui/WinTieLossDisplay.tsx` | exact |
| `src/ui/BlackjackControls.tsx` | component (controls) | event-driven | `src/ui/StreetControls.tsx` + `src/ui/GameModeSwitcher.tsx` | role-match |
| `formatEv` helper | utility | transform | `src/ui/formatPct.ts` | exact |
| Outcome banner (win/push/lose) | component | event-driven | `src/App.tsx` error banner (160-175) | partial |
| Engine/statistical tests | test | — | `equity.property.test.ts`, `benchmark.test.ts`, `deckParity.golden.test.ts` | exact |
| Guard-test extensions | test | — | `src/App.modeShell.guard.test.ts` | exact |
| UI/acceptance tests | test | — | `src/App.modeIsolation.test.tsx` + `src/test/setup.ts` | exact |

## Pattern Assignments

### `src/engine/blackjackHandValue.ts` (engine, transform) — NO functional analog

Nothing in this poker codebase computes rank sums; the algorithm comes from 06-RESEARCH.md "Blackjack Rules Engine Correctness Spec" (the `while (total > 21 && softAces > 0)` demotion loop, `isNatural = cards.length === 2 && total === 21`, S17 `hit while total < 17`, `compareToDealer` with the `dealer.bucket === 'natural'` branch). Copy only STYLE:

**Doc-comment style analog:** `src/engine/shoe.ts` lines 4-8 and 51-68 — every exported function carries a header comment that (a) names the decision tag (`D-01, D-03`), (b) states the contract in one sentence, and (c) names the pitfall it defends against (`PITFALLS.md Pitfall 6`). New engine functions must cite `D-03/D-03a/D-04` and PITFALLS Pitfalls 2/3/4 the same way.

**Type-union style analog:** `src/engine/shoe.ts` lines 4-8:
```typescript
/**
 * Number of physical decks in the shoe (D-01, D-03). Closed literal union, mirroring
 * `Street`'s style in `./streets` — no enum, no arbitrary integers.
 */
export type DeckCount = 1 | 2;
```
`DealerBucket` and `roundPhase` (`'idle' | 'player-turn' | 'resolved'`) follow this closed-literal-union convention — never a TS enum, never a boolean pair.

---

### `src/engine/blackjackConditioning.ts` (engine, transform)

**Analog:** `src/engine/conditioning.ts` — copy structure, then double it (dual-exclusion-set rule, RESEARCH Pattern 1).

**Sole-reader doc contract** (`conditioning.ts` lines 22-33) — this exact framing must appear on BOTH new readers:
```typescript
 * This is the ONLY function in the codebase permitted to read `runout.board` or
 * `runout.opponentHoles` for simulation input (D-02, RESEARCH Pitfall 1). Every other module
 * that needs conditioned odds input must call this function rather than slicing the raw
 * runout itself — that is what keeps hidden board cards and hidden opponent holes out of the
 * odds computation. Hidden cards remain in `remainingDeck` (the unknown pool), never dropped.
```

**Core derivation pattern** (`conditioning.ts` lines 35-61): build `knownCards` from visibility state, then `const remainingDeck = shoeWithout(deckCount, knownCards);` — return a flat conditioned object. Blackjack needs TWO such functions with distinct known sets:
- `deriveBlackjackConditionedState(...)` — excludes hole card only when `revealedHole` (D-02 mirror; odds pool)
- `liveShoeLedger(...)` — ALWAYS excludes the predetermined hole (real Hit/Stand draws)

RESEARCH lines 184-223 give the exact recommended bodies. The deal-time natural check (`resolveNaturals`) is a third permitted raw-hole reader for OUTCOME purposes only — document it with the same "sole reader" language (RESEARCH resolution-order step 2).

**Trap the analog embodies:** `deriveConditionedState`'s `deckCount: DeckCount = 1` default exists for Hold'em back-compat. Blackjack has no legacy callers — make `deckCount` a required parameter so a forgotten deck-toggle wire-through fails to compile instead of silently simulating 1 deck.

---

### `src/engine/blackjackEquity.ts` (engine, batch)

**Analog:** `src/engine/equity.ts`.

**Conditioned-state + budget pattern** (`equity.ts` lines 13-32): `ConditionedState` interface with doc comments per field, then `unknownCardsPerTrial(state)`. Blackjack's version returns the fixed generous constant `BLACKJACK_TRIAL_CARD_BUDGET = 12` (RESEARCH Trial-Loop Design) — NOT an exact formula. Keep the analog's shape (an exported function the runner config plugs in) even though the body is a constant.

**Cursor-based draw consumption** (`equity.ts` lines 67-77):
```typescript
  for (let t = 0; t < trialCount; t++) {
    const drawn = drawUnknown();
    const board = [...state.knownBoard, ...drawn.slice(0, unknownBoardCount)];

    let cursor = unknownBoardCount;
    const oppHoles: [Card, Card][] = state.knownOpponentHoles.map((known) => {
      if (known !== null) return known as [Card, Card];
      const pair: [Card, Card] = [drawn[cursor], drawn[cursor + 1]];
      cursor += 2;
      return pair;
    });
```
Blackjack's trial consumes the same one-`drawUnknown()`-per-trial, cursor-advanced prefix: `drawn[0]` = hypothetical hole, `drawn[1..k]` = dealer hits, `drawn[k+1]` = the disjoint "if I hit" card (RESEARCH lines 522-564). Never call `drawUnknown()` twice in one trial.

**Batch result shape** (`equity.ts` lines 35-40 + return at 104): integer tallies only, `trialsCompleted` included, percentages derived at display time. Blackjack's `BlackjackTrialBatchResult` = `dealerOutcomeCounts[7]` (fixed order `[17,18,19,20,21,natural,bust]`), `bustIfHitCount`, `standOutcomes`, `hitOutcomes`, `trialsCompleted`. Track `bustIfHitCount` as its OWN tally, never derived from `hitOutcomes.lose` (RESEARCH EV note).

**Trap:** `createDrawer` (`src/engine/rng.ts` lines 34-43) misbehaves when `n > pool.length` (`uniformInt(rng, i, working.length - 1)` invalid once `i >= working.length`). The defensive `remainingDeck.length >= BLACKJACK_TRIAL_CARD_BUDGET` check belongs in the worker `validate` hook (below), not here.

---

### `src/worker/blackjackProtocol.ts` (types, streaming)

**Analog:** `src/worker/protocol.ts`.

Copy the module shape exactly: documented constants, `ProgressSnapshot`-style interface with `requestId`/`trialsCompleted`/`done` (lines 22-30), an API interface generic over the game's conditioned/snapshot types (lines 42-51). Note the cycle-avoidance discipline at lines 1-3 (`import type` only back into engine modules — a value import would create a runtime cycle). `BlackjackProgressSnapshot`'s shape is spec'd at RESEARCH lines 488-502.

**Reuse, don't relocate:** `DEFAULT_BATCH_SIZE`/`DEFAULT_PROGRESS_INTERVAL_MS`/`DEFAULT_MAX_TRIALS`/`SimulationOptions` stay in `protocol.ts` and get imported — `streamingRunner.ts` lines 58-62 documents that moving them risks the byte-frozen golden gate for zero benefit.

---

### `src/worker/blackjackSimulationApi.ts` (worker config, streaming)

**Analog:** `src/worker/simulationApi.ts` — the single most direct copy target of the phase.

**Validate hook framing** (`simulationApi.ts` lines 16-22):
```typescript
/**
 * Entry-point validation, defence in depth (T-02-01): malformed internal calls would
 * otherwise silently produce wrong probabilities rather than failing loudly. Wired in
 * below as the generic runner's `validate` hook, so it runs before the run-token
 * supersession machinery ever sees this request.
 */
```
Blackjack's `validateBlackjackConditionedState` checks: player hand length >= 2, upcard present, `remainingDeck.length >= BLACKJACK_TRIAL_CARD_BUDGET`, the copy-budget overlap check adapted from lines 51-78 (`cardCounts` from `src/engine/shoe.ts`), AND the WR-02 deckCount shape check (see Shared Patterns).

**Error-message convention** (lines 26, 30, 47): `` `runSimulation: <field> must <constraint>, got ${actual}` `` — keep byte-compatible phrasing style so test assertions can match on prefixes.

**Runner config shape** (lines 85-115) — copy this wiring verbatim, swapping the type parameters and hooks:
```typescript
export function createSimulationApi(options: SimulationOptions = {}): SimulationApi {
  return createStreamingRunner<ConditionedState, TrialBatchResult, ProgressSnapshot>({
    validate: validateConditionedState,
    getRemainingDeck: (conditioned) => conditioned.remainingDeck,
    unknownCardsPerTrial,
    makeEmptyTotals: () => ({ ... }),
    runBatch: runTrials,
    mergeBatch: (totals, batch) => { /* integer folds, field by field */ },
    toSnapshot: (totals, meta) => ({
      requestId: meta.requestId,
      // Defensive copies — never hand the caller the mutable running arrays/objects.
      categoryCounts: [...totals.categoryCounts],
      outcomes: { ...totals.outcomes },
      trialsCompleted: meta.trialsCompleted,
      done: meta.done,
    }),
    options,
  });
}
```
The defensive-copy comment in `toSnapshot` is a hard rule (`streamingRunner.ts` line 42: "MUST return defensive copies of any mutable field") — `dealerOutcomeCounts` must be spread-copied.

**Do NOT touch `src/worker/streamingRunner.ts`** — it is the shared machinery (Don't-Hand-Roll table, RESEARCH). Its WR-01 fix (object-identity run tokens, lines 71-76 and 97-98) is exactly why a config, not a fork, is mandated by D-08. Header-comment style for the new file: copy `simulationApi.ts` lines 81-84 ("pure, Comlink-free... Node-testable directly").

---

### `src/worker/simulation.worker.ts` (MODIFIED — namespaced expose)

**Analog:** itself (currently 7 lines) + RESEARCH Pattern 4 (Comlink nested-path resolution verified against installed source).

Current file:
```typescript
import * as Comlink from 'comlink';
import { createSimulationApi } from './simulationApi';

Comlink.expose(createSimulationApi());

/** Type-only export for `Comlink.wrap<SimulationApi>` typing on the main thread. */
export type { SimulationApi } from './protocol';
```
Becomes `Comlink.expose({ poker: createSimulationApi(), blackjack: createBlackjackSimulationApi() })` with a namespaced type export (e.g. `export interface WorkerApi { poker: SimulationApi; blackjack: BlackjackSimulationApi }`).

**Trap:** `simulationService.ts` line 4 imports `type { SimulationApi } from '../worker/simulation.worker'` and line 10 does `Comlink.wrap<SimulationApi>(worker)` — the wrap type and every `api.runSimulation(...)`/`api.cancel(...)` call site (lines 96, 116) become `api.poker.*` in the same change. D-08 locks that the poker path's EXTERNAL behavior must not change; `src/worker/streamingParity.golden.test.ts` and `src/engine/deckParity.golden.test.ts` are the drift detectors that must stay green untouched.

---

### `src/state/blackjackStore.ts` (store, event-driven)

**Analog:** `src/state/gameStore.ts`.

**Interface style** (lines 12-35): every field and action carries a doc comment naming its decision tag; the nonce doubles as identity counter (lines 19-23: "Increments on every `deal()`. Doubles as the simulation `requestId`... deliberately a single counter, not two") — `roundNonce` follows this exactly.

**Single-shuffle deal discipline** (lines 43-52 comment + body):
```typescript
    // Merge-on-deal (D-03, D-06): ... Never draw a second time for a
    // different slot category — independent draws from the same starting pool can collide
    // (RESEARCH Pitfall 5), ...
    const pool = deckWithout(picked);
    const rng = createRng();
    const fill: Card[] = drawN(rng, pool, CARDS_PER_DEAL - picked.length);
```
Blackjack (D-01, no picker per D-03b): `const [p0, p1, upcard, hole] = drawN(createRng(), shoeWithout(deckCount, []), 4);` — ONE `drawN` for all four initial cards. Live Hit/dealer-playout draws use `createRng()` unseeded (real, non-reproducible draws — same convention as `deal()`), drawing from `liveShoeLedger(...)`, never the odds pool.

**Arm-in-the-same-tick discipline** (lines 82-90):
```typescript
    set({ runout, street: 'preflop', revealedMask: 0, dealNonce: get().dealNonce + 1 });
    // Arm the animation gate synchronously alongside the state write above (same synchronous
    // tick, so React batches both into one render) — deal() always animates, unconditionally
    // (D-11). Armed BEFORE the odds cache is cleared ...
    useUiStore.getState().beginAnimation();
    // A fresh hand must never serve a previous hand's settled odds ...
    useOddsStore.getState().clearCache();
```
Every blackjack action that mounts/animates a card (`deal`, `hit`, `stand`'s dealer playout, `revealHole`) must call `beginAnimation()` synchronously in the same tick as its `set()`, and `deal()` must clear the blackjack odds cache. Exception per RESEARCH deal-shape: a natural-resolved deal (`roundPhase='resolved'` immediately) — the planner decides whether resolution animates; if it does not arm, it must not need a release.

**Conditional-arming discipline** (lines 92-118): `advanceStreet`/`rewindStreet`/`reveal` all guard `beginAnimation()` behind "did state actually change" — "arming a no-op would increment a count that nothing will ever release, deadlocking the odds effect permanently (D-11)". Apply to: Hit while resolved, reveal when already revealed, Stand after Stand.

**Monotonic reveal** (lines 30-34): "OR-in a bit, never clear one — there is deliberately no un-reveal/toggle action". `revealedHole` is a one-way boolean per round (D-14), reset only by `deal()`.

**Trap:** `gameStore.deal()` reads `usePickerStore` — blackjack must NOT (D-03b, no picker; and the isolation guard forbids cross-game store imports). `blackjackStore` may import only `uiStore` (gate), its own odds store, and engine modules. The blackjack-local `deckCount` lives HERE (D-10), never in `gameModeStore` (guard-pinned, see Shared Patterns).

---

### `src/state/blackjackOddsStore.ts` (store, streaming consumer)

**Analog:** `src/state/oddsStore.ts`.

**One-way dependency comment** (lines 6-7): "oddsStore must not import gameStore — the dependency runs one way only". Replicate for the blackjack pair.

**Key function** (lines 9-12): blackjack gets its OWN key function keyed on its own knowledge dimensions (e.g. player-hand-length | revealedHole | deckCount — planner's call per D-10 discretion). The guard test pins the poker `knowledgeKey` shape verbatim (`App.modeShell.guard.test.ts` lines 241-251: "Phase 6 gets its OWN store instead of widening this one") — do not touch `oddsStore.ts`.

**reset vs. clearCache split** (lines 26-29, 37-39, 85): `reset()` zeroes live display fields only, never the cache; `clearCache()` empties the cache only, called from `deal()`. Both semantics carry over.

**Copy-on-write cache** (lines 98-105):
```typescript
  cacheIfSettled: (street, revealedMask, snapshot) => {
    if (!snapshot.done) return;
    // Copy-on-write: never mutate the existing Map in place (Zustand reference-equality rule ...
    set((state) => ({
      settledCache: new Map(state.settledCache).set(knowledgeKey(street, revealedMask), snapshot),
    }));
  },
```

**Dev-only consistency guard** (lines 51-77 + 87-89): a `checkSnapshotConsistency` behind `import.meta.env.DEV` that `console.error`s (never throws) when tallies fail to reconcile. Blackjack version asserts: `dealerOutcomeCounts` length 7 and sums to `trialsCompleted`; `standOutcomes`/`hitOutcomes` each sum to `trialsCompleted`; `bustIfHitCount <= hitOutcomes.lose` is NOT an invariant (a hit can lose without busting) — assert `bustIfHitCount <= trialsCompleted` instead.

---

### `src/state/blackjackSimulationService.ts` (service; split layout is Claude's Discretion)

**Analog:** `src/state/simulationService.ts`.

**Module-scope singleton** (lines 7-10): "Module scope, not inside a component effect: React 19 StrictMode double-invokes effects... instantiating the worker there would leak a second worker thread." Exactly ONE `new SimWorker()` for both games — whichever file layout is chosen, both services must share the singleton worker and its crash listeners.

**Crash-listener exactly-once discipline** (lines 24-50): `reportWorkerFailure` nulls callbacks and invalidates `currentRequestId` BEFORE invoking the captured `onError`. CONTEXT requires the worker-crash path stay intact for both games — a hard crash must surface in whichever game is active; the planner decides whether that means per-game `onError` registries or a shared one keyed by active generation.

**The releaseProxy trap** (lines 52-71): the long DEVIATION comment documents why there is ONE module-lifetime `Comlink.proxy` progress callback, never per-call create+release (`[releaseProxy]` only exists on `wrap()` remotes — calling it on the local proxy-marked callback throws). Blackjack needs its own module-lifetime `progressProxy` filtering on its own `currentRequestId`, or a shared one dispatching by generation — never per-call proxies:
```typescript
const progressProxy = Comlink.proxy((snapshot: ProgressSnapshot) => {
  if (snapshot.requestId !== currentRequestId) return;
  currentOnProgress?.(snapshot);
});
```

**start/cancel generation pattern** (lines 83-117): `await cancelSimulation()` first; `const requestId = ++lastRequestId`; catch reports only if still-current (`if (requestId === currentRequestId)`); finally nulls callbacks only if still-current. Copy this whole body, retargeting `api.poker.*` → `api.blackjack.*`. Per RESEARCH Pattern 4 corollary: cancel BOTH games' in-flight runs on every mode switch (cheap, idempotent).

---

### `src/state/gameModeStore.ts` (MODIFIED — `blackjackRestorePending` sibling)

**Analog:** its own `holdemRestorePending` field (lines 25-33 doc, 39-47 recompute logic):
```typescript
  setMode: (mode) =>
    set((state) => ({
      mode,
      // Recomputed on EVERY call: exactly a blackjack -> holdem transition marks a restore;
      // any other call (switch-away, A5 no-op click) clears it, so a stale flag can never
      // outlive the transition that justified it.
      holdemRestorePending: state.mode === 'blackjack' && mode === 'holdem',
    })),
  ackHoldemRestore: () => set({ holdemRestorePending: false }),
```
Add the symmetric `blackjackRestorePending: state.mode === 'holdem' && mode === 'blackjack'` + `ackBlackjackRestore` in the SAME `setMode` (RESEARCH Pattern 5). The consuming ack effect lives in the blackjack game root, mirroring `App.tsx` lines 141-143.

**Trap:** `App.modeShell.guard.test.ts` lines 82-93 forbid the tokens `deckCount`/`gameStore`/`oddsStore`/`pickerStore`/`uiStore` in this file's executable code. `blackjackRestorePending` is safe (no forbidden token), but the blackjack `deckCount` must NOT land here — it is blackjack-local state in `blackjackStore` (D-10).

---

### `src/ui/HoldemGame.tsx` (D-07 extraction) + `src/App.tsx` (MODIFIED)

**Analog:** `src/App.tsx` — a verbatim MOVE, not a rewrite (RESEARCH: "App.tsx's existing effect + JSX, moved verbatim").

What moves into `<HoldemGame />`:
- The odds effect, lines 45-121 in full (mode gate → CR-01 dual animation-gate check → cache gate → ignore-flag + `deriveConditionedState` + `startSimulation` → cleanup `cancelSimulation`), including every comment.
- The WR-01 error-clear effect (lines 130-132) and WR-02 ack effect (lines 141-143) — the "two Hold'em-scoped `[mode]` effects" D-07 names. Note: if `<HoldemGame />` only mounts when `mode === 'holdem'`, these `[mode]` guards may simplify to mount/unmount semantics — the planner decides, but the CANCELLATION path (effect cleanup firing on unmount) must be preserved, since the mode-flip teardown is D-07's entire cancellation mechanism (guard test comment, lines 17-19).
- `errorMessage`/`scenarioOpen` state (lines 40-43) and all `mode === 'holdem' &&` JSX blocks (151-204).

What stays in `App.tsx`: `<MotionConfig reducedMotion="user">` (line 149, app-wide D-09), `<h1>`, `<GameModeSwitcher />`, and the fork: `{mode === 'holdem' && <HoldemGame />}{mode === 'blackjack' && <BlackjackGame />}`.

**TRAP — guard test pins App.tsx's exact shape.** `App.modeShell.guard.test.ts` asserts against `App.tsx` source text: exactly one `cancelSimulation(` call site (lines 125-136), the literal `if (mode !== 'holdem') return;` (151-158), the dependency-array tail `pendingAnimationCount, mode]` (160-167), and zero `deckCount` (170-181). The extraction moves all of these out of `App.tsx` — per the STANDING RULE (guard test lines 29-33), AMEND the guard in the SAME COMMIT as the extraction, retargeting those assertions at `ui/HoldemGame.tsx` and citing D-07 in the updated comments. Never delete an assertion; retarget it.

**TRAP — two diverged testid arrays.** `HOLDEM_ONLY_TESTIDS` exists in `App.modeIsolation.test.tsx` (lines 87-115, comprehensive, the UI-SPEC-synced source of truth) AND `App.modeSwitch.test.tsx` (lines 39-52, a stale subset missing seat/deck-origin/category testids). D-07 folds their consolidation into the extraction task — one shared exported list (or re-sync the short one), so a new Hold'em testid is a one-line addition.

---

### `src/ui/BlackjackGame.tsx` (game root — owns the blackjack odds effect)

**Analog:** the `App.tsx` odds effect, re-implemented against blackjack stores. The gate ORDER is the load-bearing contract:

**1. Mode gate first** (`App.tsx` lines 46-51): `if (mode !== 'blackjack') return;` as the FIRST line, with `mode` in the dependency array — the teardown of this effect instance IS the mode-switch cancellation (D-07 mechanism, no second call site).

**2. Animation gate: subscribed dep + live-read secondary guard** (lines 26-34 and 58-67):
```typescript
  const pendingAnimationCount = useUiStore((state) => state.pendingAnimationCount);
  ...
    // CR-01 fix (05-REVIEW): the live read is a SECONDARY guard for the one commit where cards
    // that mounted in THIS render flush registered with the gate AFTER the render closure
    // captured 0 but BEFORE this effect ran (passive effects flush child-first) ...
    if (pendingAnimationCount > 0 || useUiStore.getState().pendingAnimationCount > 0) return;
```
Copy BOTH halves — the subscribed dependency drives re-runs (drops the 03-RESEARCH deadlock), the live read closes the switch-back re-mount window. New blackjack code does not inherit this; it must re-implement it (RESEARCH Pitfall G).

**3. Cache gate before the worker** (lines 71-86): `getCached` → `applySnapshot` → `queueMicrotask(() => setErrorMessage(null))` → return with NO cleanup. The microtask deferral is the `react-hooks/set-state-in-effect` lint discipline — copy the comment.

**4. Ignore-flag run** (lines 88-120): `let ignore = false;` + `reset()` + `deriveBlackjackConditionedState(...)` + `startBlackjackSimulation(...)`, snapshot callback filing `cacheIfSettled` under the keys captured in THIS closure (line 104-108 comment: "not a fresh getState() read — a late snapshot from a superseded run must not be cached under whatever [state] happens to be current"), cleanup `{ ignore = true; void cancelBlackjackSimulation(); }`.

Also copy: the roundPhase branch (no simulation when `roundPhase !== 'player-turn'` — resolved rounds run nothing, RESEARCH deal shape), the ack effect for `blackjackRestorePending` (mirror `App.tsx` 141-143), and the error-banner clear-on-leave effect (130-132).

---

### `src/ui/BlackjackTable.tsx` (composition root — replaces `BlackjackScene.tsx`)

**Analog:** `src/ui/TableScene.tsx` — copy the CURRENT (post-CR-02) release effect, not a naive draft.

**The prev-values-ref release** (lines 34-44) — the phase's most safety-critical copy:
```typescript
  // CR-02 fix (05-REVIEW): release only when the navigation deps actually CHANGED. Phase 5's
  // mode fork re-mounts this component with a DEALT hand (blackjack -> holdem switch-back),
  // falsifying the old premise that a mount always happens with pendingAnimationCount === 0 —
  // an unconditional endAnimation() here stole one of the re-mounting cards' freshly-registered
  // units ... No cleanup function, deliberately — a compensating cleanup would introduce a
  // permanent +1 drift on every LATER, real transition ...
  const prevRef = useRef({ dealNonce, street, revealedMask });
  useEffect(() => {
    const prev = prevRef.current;
    if (prev.dealNonce === dealNonce && prev.street === street && prev.revealedMask === revealedMask) {
      return; // mount / StrictMode re-invoke / mode switch-back re-mount: no action armed anything
    }
    prevRef.current = { dealNonce, street, revealedMask };
    useUiStore.getState().endAnimation();
  }, [dealNonce, street, revealedMask]);
```
Adapt the tracked keys to blackjack fields (`roundNonce`, `playerHandLength` or equivalent, `roundPhase`, `revealedHole` — RESEARCH Pattern 3's sketch) with the invariant: every `beginAnimation()` call site in `blackjackStore` changes at least one tracked dep in the same `set()` tick, so every armed unit has exactly one release. StrictMode-safe by construction; no cleanup function, deliberately.

**TRAP — the placeholder is guard-pinned.** `App.modeShell.guard.test.ts` pins `ui/BlackjackScene.tsx`: no `<button`/store imports (lines 183-197), locked heading/body copy verbatim (199-223), zero `resetAnimations`/`deckCount` (138-149, 170-181). Replacing the placeholder invalidates those describe blocks — amend them in the same commit (retarget the copy checks per the new 06-UI-SPEC copy, keep the `resetAnimations` prohibition against the NEW blackjack files). Also `App.modeSwitch.test.tsx` line 56 embeds the placeholder body copy as an assertion constant — it breaks too.

---

### Dealer area + player hand components (card presentation)

**Analog:** `src/ui/Seat.tsx` (call-site conventions), `src/ui/FlipCard.tsx` and `src/ui/AnimatedCard.tsx` (reused UNMODIFIED — Don't-Hand-Roll table).

**Keying convention** (`Seat.tsx` lines 71-84):
```typescript
          // Keyed by `${seatKey}-${slot}-${dealNonce}` (never card identity, 03-RESEARCH
          // Anti-Patterns): a re-deal fully unmounts/remounts this element rather than Motion
          // retargeting an in-flight card into a different card.
          return (
            <AnimatedCard
              key={`${HERO_SEAT_KEY}-${slot}-${dealNonce}`}
              animationKey={`${HERO_SEAT_KEY}-${slot}-${dealNonce}`}
              origin={dealOriginOffset('seat-hero')}
              dealIndex={dealIndex('hero', slot)}
```
Blackjack card keys: `` `player-${slotIndex}-${roundNonce}` ``, `` `dealer-up-${roundNonce}` ``, `` `dealer-hole-${roundNonce}` ``, hit cards `` `player-${handIndex}-${roundNonce}` `` — slot + nonce, never card identity.

**Pre-deal plain slot** (`Seat.tsx` lines 64-70): before any round exists, render a plain `<span className="card-slot ...">` — "never wrapped in AnimatedCard, or the gate would arm on page load before any deal has happened."

**Hole-card DOM leak guard** (`Seat.tsx` lines 122-128):
```typescript
  // ... `card` is passed as `undefined` whenever the seat is hidden — NEVER the real card —
  // which is what keeps a hidden opponent's hole cards out of the DOM entirely (T-03-12).
    const flip = <FlipCard flipKey={flipKey} faceUp={revealed} card={revealed ? hole?.[slotIndex] : undefined} />;
```
The dealer hole card renders `<FlipCard faceUp={revealedHole} card={revealedHole ? round.dealerHole : undefined} flipKey={...} />` — the predetermined hole must never be in the DOM while face-down (D-02's UI face).

**Restore-mount capture** — both primitives already implement it; the blackjack side only needs the store flag:
- `FlipCard.tsx` lines 46-51: `const [mountedFaceUp] = useState(faceUp);` gate enabled only for the hidden→face-up TRANSITION.
- `AnimatedCard.tsx` lines 52-57: `const [restoredMount] = useState(restorePendingNow && gateIdleNow);` — captured ONCE at mount, `initial={false}` restore path.

**TRAP:** `AnimatedCard.tsx` line 52 reads `holdemRestorePending` specifically. For blackjack's cards to get the symmetric protection (RESEARCH Pattern 5 / Pitfall C), either generalize this read (e.g. select the flag for the active mode) or thread it — a modification to `AnimatedCard.tsx` that must NOT change Hold'em behavior (the capture-once + gate-idle-backstop logic stays byte-equivalent in effect).

**Do not use `useExitGate` speculatively:** blackjack has no rewind (D-01), so no card list ever shrinks mid-round; new rounds replace via key change (instant unmount). Arming exit holds with no drain path is the deadlock class `useAnimationGate.ts` lines 99-107 documents (5 release paths, closed lifecycle). Only reach for it if a real AnimatePresence exit is designed in.

---

### `src/ui/BlackjackOddsPanel.tsx` (odds dock)

**Analog:** `src/ui/OddsPanel.tsx` (whole file, lines 10-23):
```typescript
export function OddsPanel() {
  const pending = useUiStore((state) => state.pendingAnimationCount > 0);

  return (
    <div
      data-testid="odds-panel"
      aria-busy={pending}
      className={pending ? 'odds-panel--pending' : undefined}
    >
```
Same shape: docked OUTSIDE the felt as a sibling of the table (D-13; analog's doc comment line 6-8), `aria-busy` from the gate, testid `blackjack-odds-panel`. Children: `DealerDistributionDisplay`, `BustEvDisplay`, trial counter.

---

### `src/ui/DealerDistributionDisplay.tsx` (7-bucket table)

**Analog:** `src/ui/OddsTable.tsx`.

**Label-array-driven rows** (lines 45-52):
```typescript
        {/* Rows are always derived from CATEGORY_LABELS, never from categoryCounts.length,
            so a malformed or short snapshot cannot silently shrink the table. */}
        {CATEGORY_LABELS.map((label, index) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td data-testid={`category-pct-${index}`}>
              {formatPct(categoryCounts[index] ?? 0, trialsCompleted, pending)}
            </td>
```
Blackjack: a `DEALER_BUCKET_LABELS` constant (7 entries, fixed order `[17,18,19,20,21,natural,bust]` per RESEARCH) drives the rows; `formatPct(dealerOutcomeCounts[index] ?? 0, trialsCompleted, pending)`; per-row testids `` `blackjack-dealer-bucket-${index}` `` (lowercase-hyphenated, `blackjack-*` prefix, D-14). Copy the `<caption>` + subtitle pattern (lines 31-36) — this display is the phase's educational centerpiece; the caption explains what the buckets mean. Also copy the analog's `useMemo` + pending short-circuit shape (lines 17-27) if any derived marker is added.

---

### `src/ui/BustEvDisplay.tsx` (bust-if-hit % + EV tiles) + `formatEv`

**Analog:** `src/ui/WinTieLossDisplay.tsx` (whole file) — `<dl className="odds-stats">` of `<div className="odds-stat">` blocks, each `dt` label + `dd` value with a testid, values via `formatPct(count, trialsCompleted, pending)` (lines 10-34). Blackjack stats: bust-if-hit %, Stand win/push/lose %, EV(Stand), EV(Hit). Testids like `blackjack-bust-pct`, `blackjack-ev-stand`, `blackjack-ev-hit`.

**`formatEv` follows `formatPct`'s contract exactly** (`src/ui/formatPct.ts` lines 6-9):
```typescript
export function formatPct(count: number, trialsCompleted: number, pending: boolean): string {
  if (pending || trialsCompleted === 0) return '—';
  return `${((count / trialsCompleted) * 100).toFixed(1)}%`;
}
```
New `formatEv(outcomes, trialsCompleted, pending)` → signed decimal like `−0.18` with the SAME `pending || trialsCompleted === 0 → '—'` short-circuit and the same em dash literal (the analog's header comment: reuse the literal, never a second dash constant). D-05: the Hit tile carries visible sub-copy stating the "hit once, then stand" basis.

---

### `src/ui/BlackjackControls.tsx` (Deal / Hit / Stand / deck toggle)

**Analogs:** `src/ui/StreetControls.tsx` (disabled-state buttons) + `src/ui/GameModeSwitcher.tsx` (segmented toggle) + `src/ui/DealButton.tsx`.

**Disabled convention** (`StreetControls.tsx` lines 15-21): plain `<button type="button" data-testid="..." disabled={...}>` — disabled derives from store state (`noHand || street === 'preflop'`), dimming via default disabled styling, never destructive color (D-14). Hit/Stand: `disabled={roundPhase !== 'player-turn'}`.

**Deck-count toggle** (`GameModeSwitcher.tsx` lines 16-33): the segmented two-button pattern — `role="group"` + `aria-label`, per-button `aria-pressed`, labels never change with state, neither button ever `disabled`, clicking the active option is a harmless no-op:
```typescript
    <div data-testid="game-mode-switcher" role="group" aria-label="Game mode">
      <button
        type="button"
        data-testid="game-mode-switch-holdem"
        aria-pressed={mode === 'holdem'}
        onClick={() => setMode('holdem')}
      >
```
Blackjack-local: `blackjack-deck-count-1` / `blackjack-deck-count-2` testids; writes `blackjackStore.deckCount` (NOT gameModeStore). BJ-07's whole point: toggling must visibly re-run and land on different numbers — the toggle changing `deckCount` must feed the odds-effect dependency chain.

### Outcome banner (win/push/lose)

**Partial analog:** `App.tsx` error banner (lines 160-175) — a conditional block with a testid'd, `role`-carrying element and locked copy discipline. The outcome banner is a status (`role="status"`, not `alert` — planner's call vs. UI-SPEC), testid `blackjack-outcome-banner`, copy conforming to the copy block-list, rendered when `roundPhase === 'resolved'`.

---

### Tests

#### Engine property tests (D-11) — analog: `src/engine/equity.property.test.ts`

**File header + import shape** (lines 1-8): `// @vitest-environment node` FIRST LINE, `import { test, fc } from '@fast-check/vitest';`, `expect` from vitest, seeded `createRng`/`createDrawer` from `./rng`. Intent comment (lines 11-13): "invariants that must hold for every input, not just the hand-picked cases... A sign-inverted comparator or a biased sampler can pass every deterministic test."

**Sum-reconciliation property** (lines 24-37): for any `(trialCount, seed)`, tallies sum exactly to trialCount. Blackjack versions: `dealerOutcomeCounts` sums to trials; `standOutcomes`/`hitOutcomes` each sum to trials.

**Capture-the-drawer sampling property** (lines 53-69):
```typescript
    const baseDraw = createDrawer(rng, state.remainingDeck, unknownCardsPerTrial(state));
    const captured: Card[][] = [];
    const drawUnknown = (): Card[] => {
      const sample = baseDraw();
      captured.push(sample);
      return sample;
    };
    // 100 trials is enough — this property is about sampling structure, not statistics.
```
Blackjack versions: per-trial draw has BUDGET distinct cards excluding all known cards ("no card over-drawn from the shoe"); at deckCount=2 use `cardCounts` budgets instead of `Set` uniqueness (see `src/engine/multisetSampling.property.test.ts` for the count-aware assertion precedent). S17 correctness properties (dealer never hits at >= 17, never stands below 17, hard-17-with-ace vectors) use the RESEARCH test-vector table (lines 334-344) as `it.each` exact-value cases alongside the properties.

#### D-12 natural-frequency statistical test — analog: `src/engine/benchmark.test.ts`

**Band + inversion-floor + timeout pattern** (lines 17-46):
```typescript
const BENCHMARK_TIMEOUT_MS = 60000;
...
      // Benchmark provenance: computed by the phase research session directly against
      // @poker-apprentice/hand-evaluator@4.3.0 at 2,000,000 samples on 2026-08-23.
...
      // A 1.0 percentage-point band is far outside the ~0.11pp standard error at this
      // trial count.
      expect(winRate).toBeLessThanOrEqual(63.83 + 1.0);
      expect(winRate + tieRate).toBeGreaterThanOrEqual(63.83 - 1.0);
      // Inversion floor: a sign-inverted comparator would report a win rate near 12% here
      // — no tolerance band above should ever be widened to accommodate that instead.
      expect(winRate).toBeGreaterThanOrEqual(55);
```
Copy all four conventions: explicit timeout constant, provenance comment (cite RESEARCH's closed forms 64/1326 ≈ 4.8265% and 256/5356 ≈ 4.7797%), SE-justified tolerance (RESEARCH tolerance table: ±1.0pp at 10k rounds), and a direction assertion (1-deck fraction exceeds 2-deck by >= ~0.3pp — RESEARCH: this is the with-replacement-bug detector). Ordering comparison at a shared seed mirrors test (b) lines 48-76 (same seed both arms).

#### Golden discipline (poker parity must not drift) — analog: `src/engine/deckParity.golden.test.ts` lines 8-19

"The correct response to a red test in this file is to fix the refactor so it reproduces these numbers again, NEVER to re-record the expected literals." The namespacing change (worker + service) must leave `deckParity.golden.test.ts` and `streamingParity.golden.test.ts` green and UNTOUCHED — they are D-08's "poker path's external behavior must not change" enforcement.

#### Guard-test extensions — analog: `src/App.modeShell.guard.test.ts`

**Comment-stripping technique** (lines 42-58) — reuse `stripCommentLines` verbatim ahead of COUNT assertions, never ahead of presence/absence assertions:
```typescript
function stripCommentLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*');
    })
    .join('\n');
}
```
Also reuse: `readSource(relativePath)` reading OTHER files only (lines 7-9: "never its own, so it cannot self-invalidate"), `normalizeWhitespace` for JSX copy checks (lines 61-69), `it.each` token sweeps with explanatory failure messages citing D-NN tags (lines 82-93).

**Phase 6 guard amendments (same-commit, per lines 29-33 STANDING RULE):** retarget the App.tsx odds-effect assertions at `HoldemGame.tsx`; update the BlackjackScene locked-copy block; NEW pins worth adding in the analog's style: blackjack stores never import Hold'em stores and vice versa (extend the lines 95-118 no-mode-branch sweep with the new blackjack files in the holdem-forbidden direction); `blackjackStore`/`blackjackOddsStore` never mention `street`/`revealedMask`/`knowledgeKey` (D-10 no key/field sharing); `oddsStore.ts` knowledgeKey pin stays as-is.

#### UI tests — analog: `src/App.modeIsolation.test.tsx` + `src/test/setup.ts`

**Explicit vi.mock factory** (lines 28-34) — the locked pattern, with its rationale comment:
```typescript
// Explicit factory (not bare automocking): automocking would still import the real module to
// introspect its exports, which instantiates a real Worker at module scope — unsupported by
// jsdom. Same rationale/pattern as App.test.tsx's/App.acceptance.test.tsx's existing mock.
vi.mock('./state/simulationService', () => ({
  startSimulation: vi.fn(),
  cancelSimulation: vi.fn(),
}));
```
Blackjack UI tests mock the blackjack service module the same way (factory listing every export; if the service stays one file, the factory must list all four function pairs).

**resetStores harness** (lines 42-72): reset every store between tests — gameStore `setState` first, THEN `resetAnimations()` (order comment at 44-45), odds `reset()` + `clearCache()`, mode reset, mock resets, and a per-call-distinct settled-snapshot `mockImplementation` (win climbs by 1 per call) so cache hits are provably not fresh runs. Blackjack's harness adds `useBlackjackStore.setState({...})` + blackjack odds resets to the same function.

**Testid sweep** (lines 81-110): `HOLDEM_ONLY_TESTIDS` synced from the UI-SPEC source-of-truth list, swept with `it.each` for DOM absence in the other mode. Phase 6 adds the mirror-image `BLACKJACK_ONLY_TESTIDS` sweep (blackjack testids absent in holdem mode) and consolidates the two diverged Hold'em arrays (see HoldemGame trap above).

**jsdom reduced-motion determinism** (`src/test/setup.ts` lines 26-36): forced `prefers-reduced-motion: reduce` via the matchMedia polyfill keeps every Motion duration 0 — blackjack UI tests get deterministic card mounts for free; do NOT add per-file real-motion mocks except in a race-test sibling file (the `App.modeSwitchRace.test.tsx` precedent — vi.mock is file-scoped, hence its own file, per its top comment).

## Shared Patterns

### WR-02 deckCount validation (D-09 — closes at the worker boundary, BOTH APIs)
**Source pattern:** `src/worker/simulationApi.ts` lines 22-49 (`validateConditionedState` throw style).
**Apply to:** `validateConditionedState` (poker, MODIFIED) and `validateBlackjackConditionedState` (new).
```typescript
  // D-09 / WR-02: deckCount SHAPE validation — integer, exactly 1 or 2; reject 0, >2,
  // non-integers with a clear error. (Poker: absent still means 1, per the existing D-04 line.)
  if (deckCount !== 1 && deckCount !== 2) {
    throw new Error(`runSimulation: deckCount must be 1 or 2, got ${String(conditioned.deckCount)}`);
  }
```
Placement: before any arithmetic uses `deckCount`. In poker's validator that is above line 42's `?? 1` consumption (keep the absent-means-1 rule — only reject PRESENT-but-invalid values, or the golden/parity tests break). Trap: `TypeScript`'s `DeckCount = 1 | 2` does not protect the worker boundary — Comlink-deserialized payloads are runtime data (the analog's whole "defence in depth" framing, lines 16-21).

### Animation-gate accounting (arm ↔ release, balanced by construction)
**Sources:** `src/state/gameStore.ts` (arm synchronously in-action, conditionally), `src/ui/TableScene.tsx` lines 34-44 (release only on real dep change, prevRef, no cleanup), `src/ui/useAnimationGate.ts` (per-card registration with unmount safety), `src/state/uiStore.ts` lines 17-28 (`resetAnimations` is TEST-ONLY — guard-enforced).
**Apply to:** `blackjackStore` actions, `BlackjackTable`, every blackjack card call site. Invariant to preserve: every `beginAnimation()` has exactly one guaranteed release path; never arm on a no-op; never release unconditionally on mount.

### Restore-mount signal (mode switch-back must not replay animations)
**Sources:** `src/state/gameModeStore.ts` lines 39-47, `src/ui/AnimatedCard.tsx` lines 42-57, `src/ui/FlipCard.tsx` lines 39-51, `App.tsx` ack effect lines 141-143.
**Apply to:** `blackjackRestorePending` + `ackBlackjackRestore` + blackjack game-root ack effect + the blackjack-direction consumption in the card layer.

### Single-reader conditioning (D-02 discipline)
**Source:** `src/engine/conditioning.ts` lines 22-33.
**Apply to:** both blackjack sole readers + `resolveNaturals`; `DealerDistributionDisplay`-style UI code must derive card knowledge via the sanctioned reader, never a raw round slice (the `OddsTable.tsx` lines 18-22 precedent: "Cards come from `deriveConditionedState` — the ONLY sanctioned reader").

### D-NN comment tags + review-finding citations
**Source:** every analog above. Convention: decisions cited as `(D-07)`, review findings as `CR-02 fix (05-REVIEW)`, pitfalls as `(RESEARCH Pitfall 5)` / `(PITFALLS Pitfall 10)` — inline, at the code they justify. Phase 6 code cites its own D-01..D-14 and 06-RESEARCH Pitfalls A-G the same way.

### Pending-dash display convention
**Source:** `src/ui/formatPct.ts` (whole file) + `WinTieLossDisplay.tsx` line 14 (`pending ? '—' : trialsCompleted.toLocaleString()` for the trial counter).
**Apply to:** every blackjack stat cell, the blackjack trial counter, and `formatEv`.

### Testid conventions (D-14)
**Source:** guard test lines 231-238 (testids are a locked contract), `Seat.tsx`/`OddsTable.tsx` (lowercase-hyphenated, indexed suffixes).
**Apply to:** all new testids — `blackjack-*` prefix for scene-specific ones; add them to the UI-SPEC list and the consolidated testid array in the same change.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/engine/blackjackHandValue.ts` (algorithms) | engine | transform | No rank-sum/bust/natural logic exists anywhere; implement from 06-RESEARCH Correctness Spec (lines 293-421) + its test-vector tables. Style-only analog: `shoe.ts`. |
| Dealer playout animation pacing | component | event-driven | Hold'em has no sequential draw-until-threshold choreography; UI-SPEC "Animation Choreography Contract" constants (`AnimatedCard.tsx` lines 8-12 style: named `*_DURATION_S` constants citing the spec) are the convention to follow, but the pacing itself is Claude's Discretion per CONTEXT. |
| Outcome banner semantics | component | event-driven | Only partial analog (error banner). Win/push/lose presentation is new; follow the locked-copy + testid + role conventions. |

## Metadata

**Analog search scope:** `src/engine/`, `src/worker/`, `src/state/`, `src/ui/`, `src/*.test.tsx`, `src/test/`
**Files scanned:** 82 source files globbed; 30 read in full or targeted
**Pattern extraction date:** 2026-08-24
**Line numbers valid at:** commit 7d8fb13 (clean tree)
