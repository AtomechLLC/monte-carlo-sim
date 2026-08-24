# Phase 2: Scenario Construction & Street Navigation - Research

**Researched:** 2026-08-24
**Domain:** Extending an existing Vite/React 19/Zustand/Comlink-worker Monte Carlo poker engine to support partial-knowledge conditioning (manual card picker, street navigation, opponent reveal), per-knowledge-state odds caching, and correct effect-driven worker lifecycle management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Dealing & runout model
- **D-01:** The full hand is predetermined at deal time: hero hole (unless manually picked), 3×2 opponent hole cards, and all 5 board cards are drawn up front in one conditioned draw. Street navigation only moves a "visible street" pointer (pre-flop → flop → turn → river); no cards are drawn during navigation. This directly satisfies NAV-02 — rewinding and re-advancing always shows the same cards — with zero extra machinery. A separate re-deal reshuffles everything.
- **D-02:** Odds computation must condition ONLY on cards the user can currently see (visible street's board cards + hero hole + any revealed opponents), never on predetermined-but-hidden cards. The simulation's "known cards" set is derived from the visibility/knowledge state, not from the stored runout. This keeps the probabilities honest to the user's information state — the educational core.
- **D-03:** One deal flow, not two modes: the Deal action deals a full random hand as today, but respects any picker-set slots (picked cards are kept, unset slots are drawn randomly from the remaining deck). There is no separate "construct mode."

#### Card picker interaction
- **D-04:** Slot-based picker: clickable slots for hero hole (2), flop (3), turn (1), river (1). Clicking a slot opens a 52-card selection panel grouped by suit. Minimal unstyled rendering (text/buttons) — card art is Phase 3.
- **D-05:** Already-used cards are visibly DISABLED (grayed with reason), not hidden — making the DEAL-03 duplicate-block observable is part of the learning goal. Selecting a used card is impossible through the UI, and the store rejects duplicates as a second line of defense.
- **D-06:** Partial scenarios are allowed: any unpicked slot is dealt randomly at deal time. Per-slot Clear and a Clear-all reset are provided.
- **D-07:** Opponent hole cards are NOT pickable in this phase — opponents are always dealt randomly from the remaining deck (requirements limit the picker to own hole + board). Picking opponent cards is a deferred idea.

#### Reveal semantics
- **D-08:** Clicking an opponent seat reveals that opponent's (predetermined) hole cards. Reveal is one-way for the current hand — no un-reveal; knowledge is monotonic within a hand. Cleared only by re-deal / new scenario.
- **D-09:** Reveals persist across street navigation — rewinding to an earlier street does not "unlearn" a revealed opponent. Earlier-street odds after a reveal are recomputed conditioned on the revealed cards (they legitimately differ from pre-reveal values; watching that shift is the point of the feature).

#### Odds behavior on navigation
- **D-10:** Per-street odds results are cached keyed by (street, knowledge set). Rewinding to a street whose knowledge set is unchanged shows the cached settled numbers immediately — the literal "odds return to their earlier-street values" of NAV-02. No re-simulation noise on rewind.
- **D-11:** Any knowledge change (reveal) invalidates ALL cached streets — every street's odds recompute conditioned on the new knowledge when visited.
- **D-12:** Navigating to a street with no cached result always runs a fresh live-converging simulation with the climbing trial counter — visible convergence remains the core value and must not be hidden behind caching.
- **D-13:** Street navigation, reveal, and re-deal all supersede any in-flight simulation run (extend the Phase 1 generation-tagged cancellation; the single `dealNonce` counter grows into a request key that also reflects street/knowledge state — planner decides the exact shape).

#### Phase 1 review debt folded in
- **D-14:** Because this phase necessarily reworks `simulationService`/`App.tsx` effect wiring for navigation triggers, the two advisory warnings from `01-REVIEW.md` MUST be fixed as part of that rework, not left behind: WR-01 (same-requestId re-entry can interleave two worker loops; add effect cleanup + per-invocation run token) and WR-02 (no error handling on the worker path; a worker failure must surface visibly, not freeze the display).

### Claude's Discretion

- Exact Zustand store shape (extend gameStore vs new scenarioStore), component decomposition, picker panel layout, and worker protocol changes — planner/executor decide.
- Street indicator/control styling (unstyled buttons + label; anything readable is fine).
- Whether the per-street cache lives in oddsStore or a new structure.

### Deferred Ideas (OUT OF SCOPE)

- Picking opponent hole cards in the card picker (beyond DEAL-02 scope; would make reveal trivial/moot for constructed opponents) — future phase or v2.
- Un-reveal toggle / "forget" a revealed opponent — conflicts with monotonic-knowledge model; revisit only if playtesting demands it.
- Street-advance dealing animation and card art — Phase 3 (Casino Table UI & Animation).
- `index.html` title still "scaffold-tmp" — cosmetic, queued for Phase 3 branding pass.

</user_constraints>

## Summary

Phase 2 does not introduce any new library — it is a correctness- and architecture-focused extension of the exact Phase 1 codebase (`src/engine/`, `src/worker/`, `src/state/`, `src/ui/`). Every decision in `02-CONTEXT.md` is already locked at the product level (D-01 through D-14); this research verified the concrete mechanics needed to implement those decisions against the real, installed source of `@poker-apprentice/hand-evaluator@4.3.0`, `@poker-apprentice/types`, `pure-rand@8.4.2`, `zustand@5.0.15`, and React 19's effect-cleanup semantics (via Context7 `/react/react` and `/pmndrs/zustand`).

The single most consequential finding: **Phase 1's `runTrials`/`ConditionedState`/worker-validation trio hardcode a single, fixed knowledge shape** (0 known board cards, 0 known opponent holes, exactly 11 unknown cards drawn per trial, `remainingDeck.length === 50` as a static validation constant). Phase 2's whole engine surface — DEAL-02/03 (picker), NAV-01/02/03 (street nav, rewind, reveal) — requires generalizing this to a **variable knowledge partition**: `0-5` known board cards and `0-3` known (revealed) opponent holes, meaning the per-trial unknown-card count ranges from `0` (river, all opponents revealed — fully determined) to `11` (preflop, Phase 1's original shape) to `13` if no board is known and no opponents revealed but 2 hero cards are unknown too (not applicable here — hero is always known). This is a **generalization, not a rewrite**: `createDrawer(rng, pool, n)` already accepts an arbitrary `n` (verified in `src/engine/rng.ts`) and needs no changes; `runTrials` needs to accept known-board/known-opponent-hole arrays and reconstruct full hands per trial instead of assuming a fixed 5+2+2+2 layout; the worker's static length-check (`remainingDeck.length !== FULL_DECK.length - 2`) must become a formula derived from the same known-card counts, or it will silently reject every non-preflop request.

Second major finding, directly resolving Phase 1 review debt (D-14): React's own documentation (Context7 `/react/react`) confirms the canonical fix for WR-01 is the **"ignore flag" / cleanup-token pattern** — an effect-scoped local variable set to `true` in the returned cleanup function, checked before every state-mutating callback — which is exactly the fix already sketched in `01-REVIEW.md`'s WR-01 remediation and generalizes cleanly to street/reveal triggers (not just re-deals). Comlink's own docs (Context7 `/googlechromelabs/comlink`) confirm `Comlink.releaseProxy` inside a `try/finally` is the standard fix for WR-02's sibling leak (IN-08) — worth folding in now because Phase 2 multiplies worker-invocation frequency (every street navigation or reveal that misses the odds cache starts a new run, not just once per Deal click).

Third finding: **the correctness-critical trap of this entire phase is D-02** ("condition ONLY on cards the user can currently see... never on predetermined-but-hidden cards"). Because D-01 predetermines the full runout up front, it is very easy to accidentally build the simulation's "known" state from the stored runout (`board`, `opponentHoles`) directly instead of from the visibility state (`street`, `revealedOpponents`) — e.g. slicing `board` incorrectly or passing the full predetermined array. This would silently leak future-street/hidden-opponent information into the odds and make pre-flop numbers look artificially decisive. No test in Phase 1 guards against this because Phase 1 never had a knowledge partition to get wrong — Phase 2 must add an explicit invariant test for it (see Code Examples).

**Primary recommendation:** Generalize `ConditionedState` to `{ heroHole, knownBoard: Card[], knownOpponentHoles: (readonly [Card,Card] | null)[], remainingDeck }`, derive `knownBoard`/`knownOpponentHoles` from visibility state (`street`, `revealedOpponents`) every time — never from the stored predetermined runout directly — cache settled (`done: true`) odds snapshots keyed by a composite string of `(street, revealedOpponents)` so that D-10/D-11's caching and full-invalidation-on-reveal behavior fall out automatically from key composition (no explicit "invalidate all" step needed), represent `revealedOpponents` as a bitmask number (not a `Set`) for cheap React-dependency-array and cache-key use, and fix WR-01/WR-02 via the standard ignore-flag effect-cleanup + try/finally Comlink proxy-release patterns extended to cover every simulation trigger (deal, street change, reveal), not just deal.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEAL-02 | User can manually pick own hole cards and board cards from a card picker for "what-if" scenario construction | Pattern 4 (picker draft state + merge-on-deal) using `ALL_SUITS`/`ALL_RANKS`/`ALL_CARDS` from `@poker-apprentice/types` for suit-grouped rendering; `deckWithout` (existing, reused unchanged) computes the duplicate-blocked/available set |
| DEAL-03 | Duplicate card selection is impossible across hands, board, and deck | Pattern 4's used-card union (`[...heroPicks, ...boardPicks].filter(Boolean)`) feeds both the picker's `disabled` attribute (visible block, D-05) and a store-level rejection (second line of defense, D-05) |
| NAV-01 | Advance street by street, odds recompute at each step | Pattern 1 (generalized `ConditionedState`/`runTrials`) + Pattern 2 (knowledge-key cache) — advancing changes `street`, which changes the visible-board-count slice and the cache key, triggering a fresh conditioned simulation on cache miss |
| NAV-02 | Rewind shows earlier-street odds returning to prior values; re-advancing shows the same cards unless re-dealt | D-01 (predetermined full runout, pointer-only navigation) already guarantees "same cards" for free; Pattern 2's cache guarantees "same odds" for free — rewinding to an unchanged-knowledge street is a pure cache hit, no re-simulation |
| NAV-03 | Reveal opponent hole cards mid-hand; odds recalculate | Pattern 3 (reveal = bitmask OR-in) changes the knowledge-key for every street simultaneously, which (via Pattern 2's composite keying) transparently forces every street's next visit to miss cache and recompute conditioned on the revealed cards — satisfying D-11 without an explicit invalidation pass |

</phase_requirements>

## Architectural Responsibility Map

Unchanged from Phase 1: this remains a pure client-side SPA with exactly one tier boundary (Main Thread / React+Zustand vs. Web Worker / compute). Phase 2 adds capabilities entirely within the existing two tiers — no new tier, no new external service.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Card picker UI + duplicate-block rendering | Browser / Client (Main Thread) | — | Pure UI state (draft picks); `deckWithout` computation is cheap (52-element filter), no reason to push to worker |
| Predetermined full-runout dealing (merge picks + random fill) | Browser / Client (Main Thread) | — | One-time draw at Deal-click, same cost class as Phase 1's `deal()` |
| Street pointer / navigation state | Browser / Client (Main Thread, Zustand) | — | Pure state transition, no computation |
| Opponent reveal (knowledge-state mutation) | Browser / Client (Main Thread, Zustand) | — | Pure state transition (bitmask OR) |
| Knowledge-key derivation + odds cache lookup | Browser / Client (Main Thread) | — | Must happen before deciding whether to invoke the worker at all — inherently a main-thread gate |
| Monte Carlo trial loop (generalized to variable known/unknown split) | Browser / Client (Web Worker) | — | Same as Phase 1 — must never block the main thread; now conditioned on a variable-size known-card set instead of a fixed one |
| Odds cache storage (settled snapshots per knowledge key) | Browser / Client (Main Thread, Zustand or adjacent module) | — | Cache lookups gate whether the worker runs at all; must live on the main thread, co-located with or adjacent to `oddsStore` |

## Standard Stack

### Core

No new packages. This phase extends existing Phase 1 dependencies only — every package below is already installed and was independently re-verified as still current for reference (no drift, no action needed).

| Library | Installed Version | Purpose in Phase 2 | Why No Change Needed |
|---------|---------|---------|--------------|
| react, react-dom | ^19.2.8 | Street-nav effect wiring, picker components, opponent-seat reveal UI | [VERIFIED: package.json + Context7 `/react/react`] The ignore-flag effect-cleanup pattern needed for WR-01/D-13 is core `useEffect` behavior, no new API |
| zustand | ^5.0.15 | Extended `gameStore` (runout + street + reveal state) and a new/extended odds cache | [VERIFIED: package.json + Context7 `/pmndrs/zustand`] `Map`-based or plain-object cache patterns confirmed via official docs, no new dependency needed |
| comlink | ^4.4.2 | Same worker RPC boundary, invoked more frequently (per cache-miss navigation, not just per deal) | [VERIFIED: package.json + Context7 `/googlechromelabs/comlink`] `releaseProxy`/`finalizer` API already exists in this version, just not yet used (IN-08) |
| pure-rand | ^8.4.2 | `createDrawer`/`drawN` unchanged — now called with a variable `n` instead of a hardcoded `11` | [VERIFIED: `src/engine/rng.ts` already accepts arbitrary `n`; no signature change needed] |
| @poker-apprentice/hand-evaluator | ^4.3.0 | `evaluateHoldem` called once per trial per hand, same as Phase 1 — reconstructed board/hole arrays are always full 5+2 by the time they reach it | [VERIFIED: read `dist/types/evaluate.d.ts` directly — `communityCards` is `Card[]`, no fixed-length constraint enforced by the type, and Phase 2 always constructs a full 5-card board per trial before calling it, so no new usage pattern is needed] |
| @poker-apprentice/types | (peer, auto-installed) | `ALL_SUITS`, `ALL_RANKS`, `ALL_CARDS`, `Card` type — now also used for picker rendering, not just deck construction | [VERIFIED: read `dist/types/*.d.ts` directly] `ALL_SUITS = ['c','d','h','s']`, `ALL_RANKS` ascending `'2'..'A'` — sufficient to render a 4-column suit-grouped 52-card panel (D-04) without any new library |

**Installation:** None required — `npm install` is a no-op for this phase; do not add new dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Predetermined-runout + street-pointer model (D-01, already locked) | `zundo` (Zustand undo/redo time-travel middleware) — discovered during this research as a real, actively-maintained option in the Zustand ecosystem (Context7 `/charkour/zundo`) | Rejected — not because it's a bad library, but because D-01 already sidesteps the entire problem class `zundo` solves. `zundo` snapshots *state mutations over time* for undo/redo; this app never mutates the runout during navigation (rewind is a pointer move, not an undo), so there is nothing to time-travel through. Pulling in an undo/redo middleware here would be solving a problem the locked architecture doesn't have. Do not introduce it. |
| `revealedOpponents: Set<number>` in Zustand state | `revealedOpponents: number` (bitmask, bit `i` = opponent `i` revealed) | The bitmask is the recommended default (see Pattern 3) — a `Set` is a mutable reference type that (a) requires cloning (`new Set(prev)`) on every update to satisfy Zustand's reference-equality change detection [VERIFIED: Context7 `/pmndrs/zustand` "Map and Set... you must create new instances when updating"], (b) is awkward to use directly in a `useEffect` dependency array (object identity, not value equality), and (c) is awkward to stringify into a cache key. A bitmask is a primitive: trivially compared, trivially used as a `useEffect` dep, trivially concatenated into a cache-key string, and the "monotonic reveal" rule (D-08) is just `mask |= (1 << i)`. |
| Composite-key cache with automatic invalidation-by-miss (Pattern 2) | An explicit `cache.clear()` call on every reveal | Both are correct; the composite-key approach (key = `${street}|${revealedMask}`) is recommended because it requires writing zero invalidation code — D-11's "any knowledge change invalidates ALL cached streets" falls out for free from the key changing, rather than needing a separate code path that must be kept in sync with every place knowledge can change. An explicit `.clear()` is a reasonable fallback if the planner prefers more visible/explicit invalidation semantics, at the cost of one more call site to keep correct. |

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. All engine/state/worker/UI work extends dependencies already audited in `.planning/phases/01-core-odds-loop/01-RESEARCH.md`'s Package Legitimacy Audit (all `[OK]`, no `[SLOP]`/`[SUS]` beyond the already-resolved `vitest` false positive). No `slopcheck` run was needed this session; `slopcheck@0.6.1` was confirmed present in the environment (`pip show slopcheck`) in case a later plan does introduce a new package (e.g., if the planner chooses a picker/combobox helper library — not recommended, see Don't Hand-Roll).

## Architecture Patterns

### System Architecture Diagram (Phase 2 additions layered on Phase 1)

```
┌──────────────────────────────────── MAIN THREAD ─────────────────────────────────────────┐
│                                                                                            │
│  [Card Picker UI]                    [Deal button]                                        │
│    clicks a slot (hero/flop/turn/       │                                                 │
│    river) -> opens 52-card panel        │                                                 │
│    grouped by suit (ALL_SUITS x         ▼                                                 │
│    ALL_RANKS); already-used cards   gameStore.deal()                                      │
│    rendered `disabled` (D-05)         - reads draft picks (heroPicks, boardPicks)          │
│         │                             - draws random fill for unset slots from             │
│         ▼                               deckWithout(allPicks) (opponents ALWAYS random,    │
│  pickerStore (draft picks,              D-07 — never pickable)                             │
│  pre-deal only)                       - sets predetermined runout: heroHole, board[5],      │
│         │                               opponentHoles[3][2]                                │
│         └──── merged in ──────────────► - resets street='preflop', revealedMask=0          │
│                                        - clears odds cache (new hand = new cache)           │
│                                        - bumps dealNonce (hand-identity counter)            │
│                                                │                                            │
│  [Advance/Rewind buttons] ───► street ◄────────┘                                           │
│  [Opponent seat click] ─────► revealedMask |= (1 << i)   (monotonic, D-08)                 │
│                                                │                                            │
│                                                ▼                                            │
│                          knowledgeKey = `${street}|${revealedMask}`                         │
│                                                │                                            │
│                          effect watches [dealNonce, street, revealedMask]                  │
│                          with ignore-flag cleanup (WR-01 fix, extended to all 3 triggers)   │
│                                                │                                            │
│                    ┌───────────── cache.get(knowledgeKey) ─────────────┐                   │
│                    │ HIT (done snapshot exists)      │ MISS             │                   │
│                    ▼                                  ▼                                    │
│         apply cached snapshot                knownBoard = board.slice(0, streetCount)      │
│         directly to oddsStore                knownOpponentHoles = opponentHoles.map(       │
│         (no worker call — the                  (h,i) => (mask & (1<<i)) ? h : null)        │
│         literal NAV-02 "odds return             — ALWAYS derived from visibility state,    │
│         to earlier values" behavior,            NEVER from the raw predetermined arrays    │
│         D-10)                                   directly (D-02 — the critical pitfall)     │
│                                                │                                            │
│                                                ▼                                            │
│                                     new run token; try { await startSimulation(...) }      │
│                                     finally { proxy[Comlink.releaseProxy]() }  (WR-02 +     │
│                                     IN-08 fix)                                              │
│                                                │                                            │
│                                                ▼                                            │
│                                    ┌─────────────────────┐                                 │
│                                    │     WEB WORKER        │                                │
│                                    │ generalized runTrials:│                                │
│                                    │  unknownCount =        │                                │
│                                    │   (5-knownBoard.len)   │                                │
│                                    │   + 2*hiddenOppCount   │                                │
│                                    │  draw unknownCount     │                                │
│                                    │  cards; reconstruct    │                                │
│                                    │  full board + opp      │                                │
│                                    │  holes per trial;      │                                │
│                                    │  evaluate + tally as   │                                │
│                                    │  Phase 1               │                                │
│                                    │  dynamic validation:    │                                │
│                                    │  remainingDeck.length   │                                │
│                                    │  === 52 - 2 -           │                                │
│                                    │  knownBoard.length -    │                                │
│                                    │  2*revealedCount        │                                │
│                                    │  (was a static -2       │                                │
│                                    │   constant in Phase 1)  │                                │
│                                    └───────────┬───────────┘                                │
│                        onProgress(snapshot) ◄──┘                                            │
│                                │                                                            │
│                                ▼                                                            │
│                        oddsStore.applySnapshot(snapshot)                                    │
│                        if (snapshot.done) cache.set(knowledgeKey, snapshot)                 │
│                                │                                                            │
│                                ▼                                                            │
│               OddsTable / WinTieLoss / TrialCounter / BoardDisplay / OpponentSeats           │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions/changes to Phase 1's tree)

```
src/
├── engine/
│   ├── cards.ts            # existing FULL_DECK/deckWithout/OPPONENT_COUNT unchanged;
│   │                       #   consider adding STREET_BOARD_COUNT map here or in a new streets.ts
│   ├── rng.ts               # UNCHANGED — createDrawer/drawN already accept arbitrary n
│   ├── evaluator.ts          # UNCHANGED
│   └── equity.ts             # ConditionedState generalized: knownBoard, knownOpponentHoles
│                             #   added; runTrials reconstructs full hands per trial instead
│                             #   of assuming a fixed 5+2+2+2 split (resolves review IN-04)
├── worker/
│   ├── protocol.ts           # ConditionedState/request shape extended; validation formula
│   │                       #   becomes dynamic (was FULL_DECK.length - 2 constant)
│   └── simulation.worker.ts  # unchanged wiring, generalized inputs pass through
├── state/
│   ├── gameStore.ts          # grows: predetermined board[5]/opponentHoles[3][2], street,
│   │                       #   revealedMask (bitmask), dealNonce (unchanged role: hand
│   │                       #   identity + cache-reset trigger)
│   ├── pickerStore.ts        # NEW (or a slice within gameStore, planner's call, D-discretion):
│   │                       #   draft picks (heroPicks[2], flopPicks[3], turnPick[1],
│   │                       #   riverPick[1]), all Card|null; Clear/Clear-all actions
│   ├── oddsStore.ts          # extended: knowledge-keyed cache (Map<string, ProgressSnapshot>)
│   │                       #   layered on top of or alongside the existing live-snapshot fields;
│   │                       #   `done` field (previously dead, IN-05) now gates cache writes
│   └── simulationService.ts  # startSimulation gains try/finally releaseProxy (WR-02+IN-08);
│                             #   run-token generalized to cover street/reveal triggers, not
│                             #   just dealNonce (D-13)
├── ui/
│   ├── CardPicker.tsx        # NEW — slot buttons + 52-card suit-grouped panel, disabled
│   │                       #   rendering for used cards (D-04, D-05)
│   ├── StreetControls.tsx    # NEW — Advance/Rewind buttons + current-street label
│   ├── BoardDisplay.tsx      # NEW — renders board.slice(0, streetBoardCount) as visible
│   │                       #   community cards (nothing existed for this in Phase 1)
│   ├── HandDisplay.tsx       # extended — opponent seats become clickable reveal targets,
│   │                       #   showing predetermined hole cards once revealed
│   ├── OddsTable.tsx         # unchanged rendering logic, now fed by conditioned snapshots
│   └── WinTieLossDisplay.tsx # unchanged rendering logic
└── App.tsx                   # effect dependency array grows from [heroHole, dealNonce] to
                              #   [dealNonce, street, revealedMask]; ignore-flag cleanup added
```

### Pattern 1: Generalized `ConditionedState` and `runTrials` (variable known/unknown split)

**What:** Replace Phase 1's fixed "always 11 unknown cards, always exactly 5 board slots + 3×2 opponent slots all unknown" assumption with a knowledge partition that can range from fully-unknown (preflop, 0 opponents revealed — Phase 1's original shape) to fully-known (river, all 3 opponents revealed — 0 unknown cards, fully deterministic outcome).

**Why this is safe to generalize without touching `pure-rand` or the evaluator library:** `createDrawer(rng, pool, n)` (verified in `src/engine/rng.ts`) already loops `for (let i = 0; i < n; i++)` — it has no assumption baked in about `n` being `11`. `evaluateHoldem({ holeCards, communityCards })` (verified via `dist/types/evaluate.d.ts`) takes `communityCards?: Card[]` with no fixed-length runtime check — Phase 2 always constructs a full 5-card board per trial (known + drawn) before calling it, so the library sees exactly the same shape of input it always has.

```typescript
// engine/equity.ts (generalized)
import type { Card } from '@poker-apprentice/types';
import { OPPONENT_COUNT } from './cards';
import { evaluateHand, compareHands, type Hand } from './evaluator';

export interface ConditionedState {
  heroHole: [Card, Card];
  /** 0-5 cards, in street order (flop 3, then turn, then river) — ALWAYS derived from the
   * user's current visibility state (street pointer), never from the full predetermined board. */
  knownBoard: Card[];
  /** Length OPPONENT_COUNT (3). `null` = still hidden. ALWAYS derived from the reveal bitmask,
   * never from the full predetermined opponentHoles array directly. */
  knownOpponentHoles: (readonly [Card, Card] | null)[];
  /** Every card NOT in heroHole, knownBoard, or any non-null knownOpponentHoles entry. */
  remainingDeck: Card[];
}

export function runTrials(
  state: ConditionedState,
  trialCount: number,
  drawUnknown: () => Card[], // length = (5 - knownBoard.length) + 2 * hiddenOpponentCount
): TrialBatchResult {
  const hiddenIndices = state.knownOpponentHoles
    .map((h, i) => (h === null ? i : null))
    .filter((i): i is number => i !== null);
  const unknownBoardCount = 5 - state.knownBoard.length;

  const categoryCounts = new Array(CATEGORY_COUNT).fill(0);
  const outcomes = { win: 0, tie: 0, lose: 0 };

  for (let t = 0; t < trialCount; t++) {
    const drawn = drawUnknown(); // may be [] when fully determined (river, all revealed)
    const board = [...state.knownBoard, ...drawn.slice(0, unknownBoardCount)];

    let cursor = unknownBoardCount;
    const oppHoles: [Card, Card][] = state.knownOpponentHoles.map((known) => {
      if (known !== null) return known as [Card, Card];
      const pair: [Card, Card] = [drawn[cursor], drawn[cursor + 1]];
      cursor += 2;
      return pair;
    });

    const hero = evaluateHand(state.heroHole, board);
    const villains = oppHoles.map((hole) => evaluateHand(hole, board));
    categoryCounts[hero.strength]++;

    const allHands: Hand[] = [hero, ...villains];
    let best = allHands[0];
    for (let i = 1; i < allHands.length; i++) {
      if (compareHands(allHands[i], best) > 0) best = allHands[i];
    }
    if (compareHands(hero, best) !== 0) {
      outcomes.lose++;
    } else {
      const tiedCount = allHands.filter((h) => compareHands(h, best) === 0).length;
      tiedCount > 1 ? outcomes.tie++ : outcomes.win++;
    }
  }
  return { categoryCounts, outcomes, trialsCompleted: trialCount };
}
```

### Pattern 2: Knowledge-keyed odds cache with implicit full-invalidation-on-reveal

**What:** Cache SETTLED (`done: true`) snapshots keyed by a string combining street and reveal state. Rewinding to an unchanged-knowledge street is then a pure `Map.get` — no re-simulation, satisfying D-10's "return to earlier-street values" literally. Because the key includes the reveal bitmask, a reveal changes the key for every street simultaneously; every future cache lookup at any street misses until recomputed, satisfying D-11 with zero explicit invalidation code.

```typescript
// state/oddsStore.ts (additive)
type KnowledgeKey = string; // `${Street}|${number}` e.g. "flop|5"

function knowledgeKey(street: Street, revealedMask: number): KnowledgeKey {
  return `${street}|${revealedMask}`;
}

interface OddsState {
  // ...existing live-streaming fields (categoryCounts, outcomes, trialsCompleted, done)...
  settledCache: Map<KnowledgeKey, ProgressSnapshot>;
  /** Called by the effect BEFORE starting a worker run — returns the cached snapshot if one
   * exists for this exact knowledge state, or undefined on a miss. */
  getCached: (street: Street, revealedMask: number) => ProgressSnapshot | undefined;
  /** Called only when a streamed snapshot has `done === true` — Pattern 2's cache-write gate. */
  cacheIfSettled: (street: Street, revealedMask: number, snapshot: ProgressSnapshot) => void;
  /** Called on new deal/re-deal — a fresh hand invalidates every cache entry from the last hand. */
  clearCache: () => void;
}

// Zustand Map-update rule (Context7 /pmndrs/zustand "Map and Set... create new instances"):
// mutating the existing Map in place would not trigger a re-render / would risk stale reads
// through selectors that memoize on reference — always construct a new Map on write.
cacheIfSettled: (street, mask, snapshot) =>
  set((state) => ({
    settledCache: new Map(state.settledCache).set(knowledgeKey(street, mask), snapshot),
  })),
```

**Note on `done` (review IN-05):** Phase 1 flagged `oddsStore.done` as written-but-never-read dead state. Phase 2's cache-write gate (`if (snapshot.done) cacheIfSettled(...)`) is exactly the consumer that was missing — this field becomes load-bearing, not dead, once this pattern lands.

### Pattern 3: Bitmask-based monotonic opponent reveal

**What:** `revealedMask: number`, one bit per opponent index. `reveal(i)` is `mask | (1 << i)` — inherently monotonic (D-08's "no un-reveal" is structurally guaranteed; there is no `unreveal` operation exposed, and OR-in never clears a bit). Cheap to use as a `useEffect` dependency (primitive, compares by value) and cheap to embed in a cache key (Pattern 2).

```typescript
// state/gameStore.ts (additive slice)
reveal: (opponentIndex: number) =>
  set((state) => ({ revealedMask: state.revealedMask | (1 << opponentIndex) })),

isRevealed: (state: GameState, opponentIndex: number) =>
  (state.revealedMask & (1 << opponentIndex)) !== 0,
```

### Pattern 4: Picker draft state — merge-on-deal, not a separate mode

**What:** D-03 locks "one deal flow, not two modes." The picker writes into draft slots that `deal()` reads and merges with random fill — it never becomes an alternate code path.

```typescript
// state/pickerStore.ts (or a gameStore slice — planner's discretion)
interface PickerDraft {
  heroPicks: [Card | null, Card | null];
  flopPicks: [Card | null, Card | null, Card | null];
  turnPick: [Card | null];
  riverPick: [Card | null];
}

function allPickedCards(draft: PickerDraft): Card[] {
  return [...draft.heroPicks, ...draft.flopPicks, ...draft.turnPick, ...draft.riverPick].filter(
    (c): c is Card => c !== null,
  );
}

// gameStore.deal() — generalized from Phase 1's `drawN(rng, FULL_DECK, 2)`:
deal: () => {
  const draft = usePickerStore.getState();
  const picked = allPickedCards(draft);
  const pool = deckWithout(picked); // existing helper, reused unchanged (DEAL-03's engine primitive)
  const rng = createRng();
  const draw = createDrawer(rng, pool, 52 - picked.length); // one shuffle covers all random fill

  let cursor = 0;
  const heroHole: [Card, Card] = [
    draft.heroPicks[0] ?? draw()[cursor++],
    draft.heroPicks[1] ?? draw()[cursor++],
    // NOTE: illustrative — in practice, draw all needed random cards in one call up front
    // (partial Fisher-Yates over `pool`) and assign by walking the picked/unpicked slots in
    // order, rather than calling draw() repeatedly. See "Common Pitfalls" for why a single
    // up-front draw matters (duplicate-safety across all random slots at once).
  ];
  // ...same merge pattern for board[5]; opponents are ALWAYS fully random (D-07) —
  // draw 6 more cards from the SAME remaining pool after hero+board are assigned.
},
```

**Duplicate-block UI (D-05):**
```tsx
// ui/CardPicker.tsx — disabled rendering with a visible reason
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
              <button
                key={card}
                type="button"
                disabled={isUsed}
                title={isUsed ? 'Already used in this hand' : undefined}
                onClick={() => onPick(card)}
              >
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

### Anti-Patterns to Avoid

- **Deriving `ConditionedState.knownBoard`/`knownOpponentHoles` from the stored predetermined runout without going through the visibility state.** This is D-02's core requirement and the single easiest correctness bug in the phase — e.g. `board.slice(0, 3)` on the wrong array, or accidentally passing all 3 predetermined `opponentHoles` regardless of `revealedMask`. It will not fail loudly; it will just make pre-flop/pre-reveal odds subtly (or wildly) more accurate than they should be, and nothing currently in the codebase checks for this because Phase 1 never had a partial-knowledge state to get wrong.
- **Using `Set<number>` for `revealedOpponents` in Zustand state.** Requires manual cloning on every write and complicates both `useEffect` deps and cache-key stringification. Use a bitmask (Pattern 3).
- **Reintroducing a static `remainingDeck.length !== CONSTANT` validation in `simulationApi.ts`.** Phase 1's `FULL_DECK.length - 2` check is correct ONLY for the fixed preflop shape; Phase 2 must compute the expected length from `52 - 2 - knownBoard.length - 2 * revealedCount` or the guard will reject every legitimate non-preflop request.
- **Treating a zero-unknown-cards trial (river, all 3 opponents revealed) as an error case.** It is a valid, fully-determined boundary condition — `drawUnknown()` returning `[]` is correct, every trial produces an identical result, and the "convergence" display is real but instantaneous (trial 1 already equals the final answer). Do not special-case this away; do not treat "the numbers aren't moving" as a bug in this specific state.
- **Calling `startSimulation` without a `try/finally releaseProxy`.** Phase 1's review (IN-08) flagged this as low-priority because it only leaked once per Deal click; Phase 2 makes every street-navigation and reveal a potential new worker invocation, multiplying the leak rate substantially. Fold the fix in now (Comlink docs, Context7 `/googlechromelabs/comlink`: `try { await proxy.runSimulation(...) } finally { proxy[Comlink.releaseProxy]() }`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Street rewind / "time travel" state | A custom undo/redo stack, or a full state-history middleware (`zundo`) | The already-locked predetermined-runout + street-pointer model (D-01) | There is no mutation to undo — rewinding just moves a pointer over already-fixed data. Introducing undo/redo middleware here solves a problem this architecture doesn't have (see Alternatives Considered) |
| 52-card suit-grouped rendering | Hand-written rank×suit string tables, or a hardcoded `[['2c','2d',...], ...]` literal | `ALL_SUITS` / `ALL_RANKS` from `@poker-apprentice/types`, combined as `` `${rank}${suit}` `` | Already exported, already the exact literal-union format the evaluator/`Card` type expects — avoids introducing a second, potentially-inconsistent card-string source |
| Duplicate-card detection across hero/board/opponent slots | Ad-hoc equality loops per picker slot | `deckWithout` (existing, `src/engine/cards.ts`) applied to the full union of all currently-picked/known cards | Already exists, already used for the deck-minus-hero case in Phase 1; generalizes trivially to "deck minus everything picked or known" for both the picker's disabled-set and the deal-time random-fill pool |
| Cache invalidation on knowledge change | An explicit dependency graph / manual "clear these streets" list | Composite cache keys (`${street}|${revealedMask}`) that change automatically when either component changes (Pattern 2) | Explicit invalidation logic is a second thing that must be kept in sync with every place knowledge can change; composite keying makes "stale key never matches" structurally true instead of procedurally maintained |
| Worker cancellation / supersession | A new cancellation mechanism for the street/reveal triggers | Extend Phase 1's existing generation-tagged run-token protocol (`simulationApi.ts`'s `currentRequestId`/run-token pattern, per the WR-01 fix already sketched in `01-REVIEW.md`) | The protocol already handles "a newer request supersedes an older one"; it just needs its trigger set widened from `[dealNonce]` to `[dealNonce, street, revealedMask]` and a real cleanup function in the watching effect — not a new design |

**Key insight:** Every "don't hand-roll" item here is a case where the *locked* architecture (D-01 through D-14) already structurally avoids the problem a naive implementation would reach for a heavier tool to solve — the research value here is confirming that restraint is correct, not finding a library to add.

## Common Pitfalls

### Pitfall 1: Peeking at predetermined-but-hidden cards (violates D-02, the phase's core correctness rule)
**What goes wrong:** Odds are computed using the full stored predetermined `board`/`opponentHoles` (or an incorrectly-sliced subset) instead of the visibility-derived `knownBoard`/`knownOpponentHoles`.
**Why it happens:** D-01 requires the full runout to be predetermined and stored at deal time — it is right there, fully populated, and it is tempting (and produces plausible-looking numbers) to just read from it directly rather than deriving a fresh visibility-filtered view every time `street`/`revealedMask` changes.
**How to avoid:** Write ONE function, e.g. `deriveConditionedState(runout, street, revealedMask)`, that is the ONLY place allowed to read `runout.board`/`runout.opponentHoles` for simulation purposes, and have it explicitly slice/null-out based on `street`/`revealedMask`. No other call site should touch the raw runout fields for conditioning.
**Warning signs:** Pre-flop win% that looks suspiciously close to the eventual river win% before any cards are revealed; a property test asserting "revealing a card never increases another player's true probability of holding a card the user can't see" (mentioned in `CLAUDE.md`'s testing guidance) failing.

### Pitfall 2: Static worker-validation formula breaks on every non-preflop request
**What goes wrong:** `simulationApi.ts`'s existing guard `remainingDeck.length !== FULL_DECK.length - 2` throws `runSimulation: remainingDeck must have exactly 50 cards` for every flop/turn/river or post-reveal request, because those legitimately have fewer remaining unknown cards.
**Why it happens:** The constant was correct for Phase 1's one-and-only knowledge shape; Phase 2 has up to 32 distinct shapes (4 streets × 8 reveal-subsets).
**How to avoid:** Replace the constant with a formula: `expected = 52 - 2 - knownBoard.length - 2 * knownOpponentHoles.filter(h => h !== null).length`. Cross-check with `remainingDeck.length` and (per review IN-06, now much higher-value given the larger state space) add a set-based overlap check: `remainingDeck` must not intersect `heroHole ∪ knownBoard ∪ any known opponent hole`.
**Warning signs:** Every advance/rewind/reveal action after the first throws in dev; if the throw is swallowed anywhere, silently wrong probabilities (the exact failure mode the original guard's comment warns about).

### Pitfall 3: Effect re-entry across THREE trigger types, not just one
**What goes wrong:** WR-01's original bug (`App.tsx`'s effect has no cleanup, so a same-key re-entry can spawn two concurrent worker loops) was reachable only via `[heroHole, dealNonce]` in Phase 1. Phase 2 widens the dependency array to `[dealNonce, street, revealedMask]` — three independent axes of change, any of which can now interleave a stale run with a fresh one if the fix isn't applied to all three.
**Why it happens:** It's tempting to fix WR-01 narrowly for the "re-deal" case (since that's how it was discovered) and not realize the identical race exists for rapid street-navigation clicks or a reveal fired while a street's simulation is still converging.
**How to avoid:** The ignore-flag/run-token fix must live in the effect itself (watching all three deps) and in `simulationApi.ts`'s run-token check (per-invocation object identity, not just requestId equality) — verified as the standard React pattern via Context7 `/react/react` ("the canonical `let ignore = false` pattern... A cleanup function sets an ignore flag, and the in-flight response checks this flag before calling setState").
**Warning signs:** Rapidly clicking Advance/Rewind causes the trial counter or win% to flicker between two different streets' numbers.

### Pitfall 4: Cache entries surviving a re-deal (stale cross-hand data)
**What goes wrong:** A cache keyed only by `(street, revealedMask)` — with no per-hand scoping — could serve a *previous hand's* settled snapshot for, say, `"flop|0"` if the cache isn't cleared when `dealNonce` changes.
**Why it happens:** `(street, revealedMask)` collides across different hands by construction (both reset to `preflop`/`0` on every deal, and flop/turn/river keys are also reused hand-to-hand).
**How to avoid:** Either (a) clear the entire cache `Map` on every `deal()` call (recommended — simplest, matches "new hand = blank slate"), or (b) namespace every key with `dealNonce` (`${dealNonce}|${street}|${revealedMask}`) and never clear, accepting unbounded (but tiny — at most 32 entries/hand) growth. Recommend (a).
**Warning signs:** Dealing a new hand and seeing flop odds appear instantly with zero trial count climb, even though this is a brand-new hand that has never been simulated.

### Pitfall 5: Picker random-fill must draw from ONE shuffle over the post-pick pool, not several independent draws
**What goes wrong:** Calling `drawN`/`createDrawer` separately per unset slot category (e.g., once for unset hero slots, again for unset board slots, again for opponents) risks the same card being drawn twice across those independent calls if each call starts from the same `deckWithout(picked)` pool without removing what the previous call already consumed.
**Why it happens:** Phase 1's `deal()` only ever drew from one category (2 hero cards, one call). Phase 2's merge-on-deal (D-03) has up to 4 categories (hero/flop/turn/river) plus 3 opponents needing random cards from a single pool, and it's natural to reach for "one draw per category" without threading the shrinking pool through.
**How to avoid:** Compute the full set of "slots needing a random card" up front, do ONE `createDrawer(rng, deckWithout(allPicks), totalUnsetSlotCount)` call, and distribute its output across the unset slots in a fixed order (e.g., hero, then flop, then turn, then river, then all 6 opponent-hole slots) — exactly one shuffle, one deck, no possibility of overlap because `createDrawer`'s no-replacement guarantee (verified via `pure-rand`'s Fisher-Yates in Phase 1's research) covers the whole batch at once.
**Warning signs:** Extremely rare test failures (duplicate card across hero/board/opponents) that don't reproduce with a fixed seed unless the exact multi-call sequence is replayed — a classic "looks fine in manual testing, fails once in a thousand automated runs" bug shape.

### Pitfall 6: `Comlink.proxy()` callback leak scales with navigation frequency, not just deal frequency
**What goes wrong:** Phase 1's review (IN-08) flagged one leaked `MessageChannel`/proxy per Deal click as low-priority. Phase 2 calls `startSimulation` (and thus `Comlink.proxy(onProgress)`) on every cache-miss street navigation or reveal, not just once per hand — a session with heavy navigation could leak dozens of ports instead of a handful.
**Why it happens:** The underlying leak (proxy never released) is unchanged from Phase 1; only the invocation frequency changed, which is exactly the kind of severity escalation code review "Info" items are meant to be re-evaluated against when the surrounding code is touched (per `01-REVIEW.md`'s own framing, and D-14's "plus Info items worth opportunistic cleanup where touched").
**How to avoid:** Wrap the proxied-callback lifecycle in `try { await api.runSimulation(...) } finally { proxyCallback[Comlink.releaseProxy]() }` (Comlink's documented pattern, Context7 `/googlechromelabs/comlink`).
**Warning signs:** Browser DevTools' memory/listener count climbing steadily during a session with many street-navigation clicks, never garbage collected.

## Code Examples

### Deriving the conditioned state from visibility (the D-02 guardrail function)

```typescript
// engine/conditioning.ts (new, small, single-purpose — the ONLY place allowed to slice
// the raw predetermined runout for simulation input)
import type { Card } from '@poker-apprentice/types';
import type { Street } from './streets';
import { STREET_BOARD_COUNT } from './streets';

export interface PredeterminedRunout {
  heroHole: [Card, Card];
  board: [Card, Card, Card, Card, Card];
  opponentHoles: [[Card, Card], [Card, Card], [Card, Card]];
}

export function deriveConditionedState(
  runout: PredeterminedRunout,
  street: Street,
  revealedMask: number,
) {
  const knownBoard = runout.board.slice(0, STREET_BOARD_COUNT[street]);
  const knownOpponentHoles = runout.opponentHoles.map((hole, i) =>
    (revealedMask & (1 << i)) !== 0 ? hole : null,
  );
  const knownCards = new Set<Card>([runout.heroHole[0], runout.heroHole[1], ...knownBoard]);
  for (const h of knownOpponentHoles) if (h) { knownCards.add(h[0]); knownCards.add(h[1]); }
  const remainingDeck = FULL_DECK.filter((c) => !knownCards.has(c));

  return { heroHole: runout.heroHole, knownBoard, knownOpponentHoles, remainingDeck };
}
```

### Street type and board-count map

```typescript
// engine/streets.ts (new)
export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export const STREET_ORDER: readonly Street[] = ['preflop', 'flop', 'turn', 'river'];
export const STREET_BOARD_COUNT: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};
```

### Effect wiring with ignore-flag cleanup, extended to all three triggers (WR-01 fix, generalized)

```typescript
// App.tsx (or a dedicated hook, e.g. useSimulationEffect)
useEffect(() => {
  const runout = useGameStore.getState().runout;
  if (!runout) return;

  const { street, revealedMask } = useGameStore.getState();
  const key = knowledgeKey(street, revealedMask);
  const cached = useOddsStore.getState().getCached(street, revealedMask);
  if (cached) {
    useOddsStore.getState().applySnapshot(cached);
    return; // cache hit — no worker invocation at all
  }

  let ignore = false; // React's canonical cleanup-token pattern (Context7 /react/react)
  useOddsStore.getState().reset();

  void (async () => {
    try {
      await startSimulation(deriveConditionedState(runout, street, revealedMask), (snapshot) => {
        if (ignore) return; // superseded by a newer effect run — drop stale data
        useOddsStore.getState().applySnapshot(snapshot);
        if (snapshot.done) useOddsStore.getState().cacheIfSettled(street, revealedMask, snapshot);
      });
    } catch (error) {
      if (!ignore) useOddsStore.getState().setError(String(error)); // WR-02 fix
    }
  })();

  return () => {
    ignore = true;
    void cancelSimulation(); // extend simulationApi's run-token cancellation
  };
}, [dealNonce, street, revealedMask]); // widened from Phase 1's [heroHole, dealNonce]
```

### Property test for the phase's core invariant (extends Phase 1's fast-check suite)

```typescript
// engine/equity.property.test.ts (additive)
import { test, fc } from '@fast-check/vitest';

test.prop([
  fc.integer({ min: 0, max: 5 }), // knownBoardCount
  fc.integer({ min: 0, max: 7 }), // revealedMask (3 bits)
])(
  'every trial produces exactly 13 unique cards regardless of known/unknown split',
  (knownBoardCount, revealedMask) => {
    // ...construct a ConditionedState with `knownBoardCount` known board cards and the
    // opponents indicated by `revealedMask` marked known, run one trial, and assert
    // new Set([...hero, ...board, ...opp1, ...opp2, ...opp3]).size === 13.
  },
);
```

## State of the Art

| Old Approach (Phase 1) | Current Approach (Phase 2) | When Changed | Impact |
|--------------------------|------------------------------|---------------|--------|
| Fixed knowledge shape: 0 known board cards, 0 known opponent holes, always 11 unknown cards/trial | Variable knowledge shape: 0-5 known board cards, 0-3 known opponent holes, 0-11 unknown cards/trial | This phase (NAV-01/02/03, DEAL-02/03) | `ConditionedState`, `runTrials`, and the worker's input-validation formula all generalize; nothing in `pure-rand`/`evaluateHoldem` needs to change |
| `dealNonce` alone is both hand-identity and worker-requestId | `dealNonce` (hand identity + cache-reset) is now paired with `street`/`revealedMask` as the full simulation-trigger key; run-token supersession must consider all three | This phase (D-13) | Effect dependency array and `simulationApi`'s supersession check both widen; WR-01's fix must cover all three, not just `dealNonce` |
| `oddsStore.done` is written, never read (dead field, review IN-05) | `done` gates cache writes — the phase's caching mechanism (D-10) is its first real consumer | This phase | Resolves a Phase 1 review Info item as a natural side effect of the phase's own design, not a separate cleanup task |

**Deprecated/outdated:** Nothing in the dependency stack is deprecated — this is a pure application-logic generalization, not a library-version change.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Picker draft picks (hero/board slots) persist across multiple `Deal` clicks and are only cleared via the explicit per-slot Clear / Clear-all actions (D-06), not implicitly cleared by Deal itself | Pattern 4 | Low-medium — if wrong, "Deal" should instead consume-and-clear the draft after each use. This is inferred (not explicitly stated in `02-CONTEXT.md`) from D-06's phrasing ("Per-slot Clear and a Clear-all reset are provided" implies a separate action is needed to clear, i.e. Deal alone doesn't clear) and from the "what-if scenario construction" framing (re-dealing while holding e.g. "always AA" fixed is the more useful UX for an odds-explorer tool). Flagging for planner/discuss-phase confirmation since it changes `deal()`'s post-condition. |
| A2 | Clearing the entire settled-odds cache on every `deal()`/re-deal (rather than namespacing cache keys by `dealNonce` and never clearing) is the preferred implementation of "new hand = fresh cache" | Common Pitfalls #4 | Low — both are correct; this is a recommendation for simplicity, not a locked requirement. Either satisfies D-10/D-11/D-12. |
| A3 | A single new `engine/streets.ts`/`engine/conditioning.ts` module (rather than folding `Street`/`STREET_BOARD_COUNT`/`deriveConditionedState` into existing `cards.ts`/`equity.ts`) is the cleanest file boundary | Recommended Project Structure | Low — pure code-organization preference; `02-CONTEXT.md` explicitly leaves "component decomposition" and store shape to planner/executor discretion, so this is a suggestion, not a constraint |

**If this table is empty:** N/A — see above; all three assumptions are low-risk implementation-detail inferences from strongly-worded (but not 100%-explicit) context, not load-bearing product decisions.

## Open Questions

1. **Does `deal()` consume (clear) the picker draft after use, or leave it in place for a repeat "what-if" deal with the same fixed cards?**
   - What we know: D-06 provides explicit Clear/Clear-all actions, implying Deal itself is not expected to be the mechanism that clears picks (see Assumption A1).
   - What's unclear: `02-CONTEXT.md` never states this explicitly either way.
   - Recommendation: Default to "picks persist until explicitly cleared" (matches the "construct a scenario and explore it" framing of DEAL-02); the planner should confirm this reading during plan creation, or raise it back to `/gsd:discuss-phase` if it materially changes the picker's state-ownership design.

2. **Should the opponent-reveal UI expose which street the opponent's hand was revealed "as of" (i.e., does a reveal happen at a specific street, or is it street-agnostic once triggered)?**
   - What we know: D-08 says reveal is a one-way action on an opponent seat; D-09 says reveals persist across navigation and earlier streets' odds legitimately change after a reveal.
   - What's unclear: Whether the UI needs to show "revealed at Flop" provenance, or whether reveal is simply a global (non-street-scoped) fact about the current hand once triggered. The odds-computation model in this research treats reveal as global/non-street-scoped (a single `revealedMask` shared across all streets), which matches D-09's explicit requirement that earlier streets recompute using the reveal — this question is about UI presentation only, not the underlying model.
   - Recommendation: Treat as UI polish, not a blocking modeling question — the `revealedMask` model above already satisfies the functional requirement regardless of how the UI chooses to present "when" a reveal happened.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm scripts, Vite dev server, Vitest | ✓ | v24.15.0 | — |
| npm | package management (no new installs this phase) | ✓ | 11.12.1 | — |
| Web Worker API | NAV-01/02/03 conditioned simulations, same worker boundary as Phase 1 | ✓ (evergreen browsers) | — | — |

No missing dependencies. This phase introduces no new external services, databases, network calls, or packages.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled per policy). As in Phase 1, this remains a purely client-side, offline, no-auth, no-persistence, no-network application. Phase 2 adds user-driven input (card picker clicks) but no free-text input and no new attack surface beyond Phase 1's.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No accounts — unchanged from Phase 1 |
| V3 Session Management | No | All state is in-memory Zustand, discarded on refresh — unchanged |
| V4 Access Control | No | No protected resources — unchanged |
| V5 Input Validation | Marginal | The picker only emits values from the closed `Card` union (button clicks on a fixed 52-item panel, never free text), so there is no injection surface. The load-bearing validation here is a **business-rule** invariant, not a security boundary: DEAL-03's duplicate-block (D-05's "store rejects duplicates as a second line of defense") and the worker's dynamic remaining-deck-length/overlap check (Pitfall 2) both exist to prevent silently-wrong probabilities, not to prevent a security exploit. Worth stating clearly so this isn't over-engineered as a security control. |
| V6 Cryptography | No | No secrets, no crypto — unchanged |

### Known Threat Patterns for this stack
None applicable at meaningful severity — same conclusion as Phase 1 (no network requests, no HTML injection surface, no persistence, closed-union card input). The correctness risks in this phase (Pitfall 1, "peeking" at hidden cards) are a **probability-accuracy bug**, not a security vulnerability — flagging this distinction explicitly so it is verified via the property/invariant tests recommended above, not treated as an ASVS control gap.

## Sources

### Primary (HIGH confidence)
- Direct source inspection: read `src/engine/cards.ts`, `src/engine/rng.ts`, `src/engine/equity.ts`, `src/engine/evaluator.ts`, `src/worker/protocol.ts`, `src/worker/simulationApi.ts`, `src/worker/simulation.worker.ts`, `src/state/gameStore.ts`, `src/state/oddsStore.ts`, `src/state/simulationService.ts`, `src/App.tsx`, and all `src/ui/*.tsx` components directly from the working tree (not summarized) to determine exactly what Phase 2 must generalize versus what's reusable unchanged
- Direct package inspection: read `node_modules/@poker-apprentice/hand-evaluator/dist/types/evaluate.d.ts` and `node_modules/@poker-apprentice/types/dist/types/*.d.ts` directly — confirmed `communityCards?: Card[]` has no fixed-length constraint, and `ALL_SUITS`/`ALL_RANKS`/`assertCard`/`isCard` are all real, typed exports usable for the picker
- Context7 (`ctx7` CLI, confirmed installed this session): `/react/react` (canonical `let ignore = false` effect-cleanup pattern, verified against the actual ESLint exhaustive-deps test fixtures and React DevTools source) — HIGH confidence, primary source for the WR-01 generalization
- Context7 (`ctx7` CLI): `/pmndrs/zustand` (Map/Set update-by-reference rule, slices pattern, `useShallow` for multi-selector components) — HIGH confidence, official docs
- Context7 (`ctx7` CLI): `/googlechromelabs/comlink` (`releaseProxy`/`finalizer` API, `try/finally` cleanup pattern) — HIGH confidence, official docs, directly resolves review IN-08
- `.planning/phases/01-core-odds-loop/01-RESEARCH.md`, `01-REVIEW.md` — this phase's canonical inherited context (WR-01/WR-02 remediation sketches, IN-04/IN-05/IN-06/IN-08 opportunistic-cleanup items, verified Phase 1 architecture)
- `npm view`-equivalent verification: `package.json` read directly — confirms no version drift on any Phase 1 dependency; no new packages needed this phase

### Secondary (MEDIUM confidence)
- Context7 (`ctx7` CLI): `/charkour/zundo` (Zustand undo/redo middleware) — surfaced as a real ecosystem option during research and explicitly rejected with reasoning (see Alternatives Considered); not adopted, so confidence level is about the library's existence/fit-assessment, not about a recommendation being acted on

### Tertiary (LOW confidence)
- None — every claim in this document is backed by direct source/package inspection, Context7-sourced official documentation, or the project's own prior (already-verified) research and review artifacts. The two Open Questions above are explicitly flagged as unresolved rather than asserted.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every existing package's continued fitness for Phase 2's generalized usage was verified by direct `.d.ts`/source inspection, not assumed from Phase 1's summary alone
- Architecture: HIGH — the generalization from fixed-shape to variable-shape `ConditionedState`/`runTrials` was designed against the actual installed evaluator's real type signature (`communityCards?: Card[]`, no length constraint) and the actual `createDrawer`/`drawN` implementation (already `n`-generic); the effect-cleanup and cache-invalidation patterns are sourced directly from official React and Zustand documentation, not inferred
- Pitfalls: HIGH — every pitfall traces to either a concrete, already-documented Phase 1 review finding (WR-01, WR-02, IN-04, IN-05, IN-06, IN-08) being re-evaluated at Phase 2's larger state space, or a structural consequence of the locked D-01/D-02 decisions (the "peeking" pitfall) that was reasoned through against the actual data shapes involved, not a generic checklist item

**Research date:** 2026-08-24
**Valid until:** 2026-09-23 (30 days — no new external dependencies to go stale; the only expiry risk is if `02-CONTEXT.md`'s locked decisions are revisited before planning starts)
