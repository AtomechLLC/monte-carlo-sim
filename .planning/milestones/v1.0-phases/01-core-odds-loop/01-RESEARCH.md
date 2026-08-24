# Phase 1: Core Odds Loop - Research

**Researched:** 2026-08-23
**Domain:** Vite/React/TypeScript project scaffolding + client-side Monte Carlo Texas Hold'em simulation (hand evaluator integration, Web Worker streaming, minimal UI)
**Confidence:** HIGH

## Summary

Phase 1 is a walking skeleton: scaffold the entire Vite + React + TypeScript project, then build the thinnest correct vertical slice of the odds engine — deal a **preflop-only** random hand (hero's 2 hole cards; 3 opponents fully hidden; **no community cards dealt yet**, since street navigation is explicitly Phase 2's scope), run a streaming Monte Carlo simulation off the main thread, and render win/tie/lose + a full hand-category table in a minimal, unstyled UI. Every recommended library version was re-verified live against the npm registry today (2026-08-23) and matches `STACK.md` exactly.

The single most consequential finding from this research: **`@poker-apprentice/hand-evaluator` (the locked evaluator library) already ships a Monte Carlo generator (`simulate`/`simulateHoldem`) that does exactly the deck-conditioning and multi-way win/tie/lose math this project needs** — but it hardcodes `Math.random()` (not swappable, verified by reading the compiled source) and only returns win/tie/total/equity, never a per-hand-category breakdown. Since the project needs both a deterministic/seedable engine (for property-based tests, per `STACK.md`'s `pure-rand` decision) and the category histogram (`ODDS-02`), the correct design is a **hand-rolled trial loop** that calls the library's low-level `evaluate`/`compare` primitives directly (not its `simulate` helper), exactly as `ARCHITECTURE.md` designed — this research now has concrete, executable proof of *why* that design is correct, not just an assumption.

Second major finding: **`npm create vite@latest . -- --template react-ts` will fail in this exact project directory.** create-vite's emptiness check only tolerates a bare `.git` directory; `.planning/` and `CLAUDE.md` already exist here, so non-interactive scaffolding cancels with "Operation cancelled" (verified by reproducing the exact directory shape in a scratch sandbox). `--overwrite` is **not** the fix — it deletes everything except `.git`, which would destroy `.planning/` and `CLAUDE.md`. The correct approach (verified working) is to scaffold into a throwaway subdirectory and move the generated files up.

Third finding: the hand evaluator library reports **10** hand-strength categories (`HighCard`=0 through `RoyalFlush`=9 — Royal Flush is its own enum value, distinct from `StraightFlush`=8), not 9. `ARCHITECTURE.md`'s worker protocol sketch commented "9 hand categories" — this is off by one and the odds table must have 10 rows.

**Primary recommendation:** Scaffold via a throwaway subdirectory + merge (never run `create-vite` with `--overwrite` in this repo root); build `engine/` as a pure module wrapping `@poker-apprentice/hand-evaluator`'s `evaluate`/`compare` (not its `simulate` helper) with a hand-rolled, `pure-rand`-seeded trial loop; wire it into a Web Worker via Comlink using a generation-tagged request/cancel protocol; keep Phase 1's game state to exactly what `DEAL-01` needs (hero hole cards + a re-deal trigger) — do not build the street/history/reveal state model yet, that's Phase 2.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | Hand evaluator correctly ranks best-5-of-7 cards, including kickers, ties/split pots, and the A-2-3-4-5 wheel straight | `@poker-apprentice/hand-evaluator`'s `evaluateHoldem`/`compare` verified directly: wheel straight test passed (`strength === HandStrength.Straight`), tied-board test passed (`compare === 0`), and the library's own documented historical straight-flush kicker-sharing bug was reproduced and confirmed fixed in v4.3.0. See "Don't Hand-Roll" and Code Examples. |
| ENG-02 | Monte Carlo simulation conditions on all known cards; hidden opponents sampled uniformly from remaining unseen deck; no card appears twice in a trial | Pattern 1 (hand-rolled trial loop) + Pattern 2 (partial Fisher-Yates via `pure-rand`, verified deterministic) draw all 11 unknown cards (board + 3 opponents) from a single no-replacement draw against the post-hero-cards deck, guaranteeing no duplicates by construction. `fast-check` property-test example provided for the sum-invariant; a no-duplicate-card property test follows the same pattern. |
| ENG-03 | Simulation runs off the main thread and streams incremental results — UI never freezes | Pattern 3: Comlink-wrapped chunked Web Worker with `setTimeout(...,0)` yield between batches and a `Comlink.proxy()` progress callback; batch size derived from a real (not vendor-claimed) throughput benchmark. See "Anti-Patterns to Avoid" for the vendor-benchmark correction. |
| ENG-04 | Displayed probabilities verifiably accurate — validated against published benchmark odds; internal consistency (categories sum to 100%, win/tie/lose sums to 100%) | "Benchmark Odds Values" table gives 4 tool-verified regression targets (AA vs 1, AA vs 3, 72o vs 1, KK vs AQ) computed directly against the recommended library at 2M samples. `fast-check` property test enforces both sum invariants. Pitfall 7 flags the specific bug (`compare()` sign inversion) that would violate accuracy while still passing the sum-to-100% check. |
| ODDS-01 | Live win/tie/lose probability vs. 3 opponents | Pattern 1's `outcomes` object + `oddsStore` shape; streamed via Pattern 3's `onProgress` callback every batch. |
| ODDS-02 | Full hand-category probability table (high card → royal flush), sums to ~100%, updates live | Pitfall 6 corrects `ARCHITECTURE.md`'s "9 categories" assumption to the verified 10 (`HandStrength` enum 0-9, Royal Flush distinct from Straight Flush) — `categoryCounts` must be a 10-element array/table. |
| ODDS-03 | Visible trial counter climbs; percentages settle in real time; page stays responsive | `trialsCompleted` field streamed in every `onProgress` snapshot (Pattern 3); chunked batching (not per-trial messages) keeps `postMessage` overhead low per `PITFALLS.md` Moderate #3, inherited unchanged into the Comlink-based design. |
| DEAL-01 | Deal a random hand (own hole cards + 3 opponents) with one click; re-deal at any time | `gameStore.deal()` code example: draws 2 hero cards via `drawN`/`pure-rand`, increments `dealNonce` (doubles as worker `requestId`), which the `simulationService` watches to cancel the in-flight run and start a fresh one — a single counter serves both the re-deal trigger and the generation-tagged cancellation protocol. |

</phase_requirements>

## Architectural Responsibility Map

This is a pure client-side SPA with no backend, CDN, or database tier (per `PROJECT.md`'s explicit "no server" constraint) — the only meaningful tier boundary is **Main Thread (UI)** vs. **Web Worker (compute)**, both inside the Browser/Client tier.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Random hand dealing (hero cards) | Browser / Client (Main Thread) | — | Instant, cheap (2-card draw); no reason to push to worker |
| Hand evaluation (7-card best-hand) | Browser / Client (Web Worker) | Browser / Client (Main Thread, for tests) | Same pure function runs in both — Node for tests, Worker for production, main thread never blocks |
| Monte Carlo trial loop | Browser / Client (Web Worker) | — | Must never run on main thread (ENG-03); this is the whole point of the worker boundary |
| Win/tie/lose + category aggregation | Browser / Client (Web Worker) | — | Computed inside the same trial loop as evaluation, streamed out in batches |
| Odds display / trial counter | Browser / Client (Main Thread, React) | — | Subscribes to streamed worker output only; never computes |
| State management (hero cards, dealNonce) | Browser / Client (Main Thread, Zustand) | — | Authoritative, synchronous; the worker never touches it directly |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react, react-dom | 19.2.8 | UI framework | [VERIFIED: npm registry, 2026-08-23] Matches `STACK.md`'s locked decision |
| vite | 8.2.2 | Build tool / dev server | [VERIFIED: npm registry] `?worker` import syntax confirmed via Context7 (`/vitejs/vite`) |
| typescript | 6.0.3 (pin exactly, not `^`/`~`) | Language | [VERIFIED: npm registry + Context7] `create-vite`'s scaffolded default is `~6.0.2` (verified by running the scaffold) — must be bumped/pinned to exactly `6.0.3` per `STACK.md`; **never** let a bare `npm install typescript` pull the `latest` dist-tag (7.0.2), which breaks `typescript-eslint` |
| @vitejs/plugin-react | ^6.0.4 (scaffold default) | Vite React integration | [VERIFIED: via scaffold] Babel-based Fast Refresh transform |
| zustand | 5.0.15 | Client state (gameStore, oddsStore) | [VERIFIED: npm registry] `create<State>()((set,get)=>({...}))` pattern confirmed via Context7 (`/pmndrs/zustand`) |
| @poker-apprentice/hand-evaluator | 4.3.0 | 7-card hand evaluation primitives | [VERIFIED: installed the actual package and read its compiled `.d.ts` + source directly] See "Hand Evaluator API" below |
| @poker-apprentice/types | ^1.4.0 (peer, auto-installed) | `Card`, `Hand`, `HandStrength`, `ALL_CARDS` | [VERIFIED: read `.d.ts` directly] Only runtime dependency of the evaluator; also the only place `HandStrength` enum and the ready-made 52-card `ALL_CARDS` array live |
| comlink | 4.4.2 | Web Worker RPC | [VERIFIED: npm registry + Context7 `/googlechromelabs/comlink`] `expose`/`wrap`/`proxy` API confirmed with real code snippets |
| pure-rand | 8.4.2 | Seedable PRNG for deck sampling | [VERIFIED: installed the actual package, ran a working Fisher-Yates shuffle against it, confirmed deterministic] See "Deck Sampling" code example |

### Supporting (test tooling)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.11 | Test runner | [VERIFIED: npm registry] `environment: 'jsdom'` default, per-file `// @vitest-environment node` override confirmed still supported in v4 (Context7) |
| fast-check | 4.9.0 | Property-based testing | [VERIFIED: npm registry] Use for ENG-04's invariants (sum-to-100%, no-duplicate-card) |
| @fast-check/vitest | 0.4.1 | `it.prop`/`test.prop` Vitest integration | [VERIFIED: npm registry + Context7] |
| @testing-library/react | 16.3.2 | Component tests | [VERIFIED: npm registry] |
| @testing-library/jest-dom | 7.0.1 | DOM matchers | [VERIFIED: npm registry] |
| @testing-library/user-event | 14.6.6 | Interaction simulation | [VERIFIED: npm registry] |
| jsdom | 30.0.1 | Vitest DOM environment | [VERIFIED: npm registry] |
| eslint | 10.9.0 (scaffold default `^10.8.0`, close enough — bump if desired) | Linting | [VERIFIED: npm registry + live scaffold] `engines.node`: `^20.19.0 \|\| ^22.13.0 \|\| >=24` — this machine runs Node v24.15.0, compatible |
| typescript-eslint | 8.67.0 (scaffold default `^8.65.0`) | TS lint rules | [VERIFIED: npm registry] Peer range `>=4.8.4 <6.1.0` confirms the TS 6.0.3 pin |
| prettier | 3.9.6 | Formatting | [VERIFIED: npm registry] |

**Deferred to Phase 3 (not installed in Phase 1):** `motion` (animation), `immer` (state — Phase 1's state is flat, skip until nesting justifies it). `@playwright/test` (1.62.1) is optional discretion for Phase 1 — a single smoke E2E ("click Deal, see numbers move") has value but isn't required by any Phase 1 requirement ID; recommend deferring to whichever phase first needs cross-boundary (worker+UI) E2E coverage unless the planner wants it now.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled trial loop calling `evaluate`/`compare` | The library's own `simulateHoldem` generator | Rejected for Phase 1: no category breakdown output, and its internal RNG is hardcoded `Math.random()` (verified in source — `engine.sample(Math.random)`), which blocks the deterministic/seeded tests `STACK.md` requires via `pure-rand`. Two independent Monte Carlo passes (one via library `simulate`, one hand-rolled for category) would also double the evaluation work for no benefit. |
| `evaluateHoldem()` convenience wrapper | Raw `evaluate()` with explicit `minimumHoleCards`/`maximumHoleCards` | `evaluateHoldem` is a thin wrapper that hardcodes `minimumHoleCards: 0, maximumHoleCards: 2` (verified in source) — the correct Hold'em rule (best 5 of 7, including "playing the board"). Use it directly; no reason to call the lower-level `evaluate()` in Phase 1. |
| `react-ts` Vite template | `react-compiler-ts` template (React 19 Compiler / oxc path) | `react-compiler-ts` exists as of this Vite version (confirmed via Context7 CLI help output) but `STACK.md` locked `@vitejs/plugin-react`'s default Babel transform, not the compiler/oxc path. Stick with `react-ts` for Phase 1 unless the planner wants to revisit this as a discretionary upgrade. |

**Installation (see "Scaffolding" pitfall below for the safe sequencing):**
```bash
npm install zustand@5.0.15 comlink@4.4.2 pure-rand@8.4.2 @poker-apprentice/hand-evaluator@4.3.0
npm install -D vitest@4.1.11 fast-check@4.9.0 @fast-check/vitest@0.4.1 @testing-library/react@16.3.2 @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.6 jsdom@30.0.1
npm install -D typescript@6.0.3 --save-exact   # overrides the scaffold's ~6.0.2 pin with the exact verified version
```

## Package Legitimacy Audit

`slopcheck` was installed and run (`py -m slopcheck install <packages> --ecosystem npm`) against every package this phase installs, plus `npm view <pkg> scripts.postinstall` was checked for each — no postinstall scripts found on any package.

| Package | Registry | Age / Evidence | Source Repo | slopcheck | Disposition |
|---------|----------|-----------------|--------------|-----------|-------------|
| react, react-dom | npm | Long-established | facebook/react | [OK] | Approved |
| vite, @vitejs/plugin-react | npm | Long-established | vitejs/vite | [OK] | Approved |
| typescript | npm | Long-established | microsoft/TypeScript | [OK] | Approved |
| zustand | npm | Long-established | pmndrs/zustand | [OK] | Approved |
| @poker-apprentice/hand-evaluator | npm | Actively maintained, MIT | poker-apprentice/hand-evaluator | [OK] | Approved |
| @poker-apprentice/types | npm | 783 weekly downloads — slopcheck noted "not exactly popular" but verdict is still OK | poker-apprentice (same org) | [OK] | Approved — low download count is expected for a scoped types-only peer dependency of a niche-domain library, not a red flag; installed and inspected its actual `.d.ts` directly to confirm legitimacy beyond the registry check |
| comlink | npm | Long-established, Google Chrome Labs | GoogleChromeLabs/comlink | [OK] | Approved |
| pure-rand | npm | Long-established, used internally by `fast-check` itself | dubzzz/pure-rand | [OK] | Approved |
| fast-check | npm | Long-established | dubzzz/fast-check | [OK] | Approved — slopcheck flagged the *name pattern* ("starts with 'fast-' — classic LLM naming pattern") but explicitly noted "package is established"; not a real risk |
| @fast-check/vitest | npm | Official fast-check/Vitest adapter | dubzzz/fast-check (monorepo) | [OK] | Approved |
| @testing-library/react, jest-dom, user-event | npm | Long-established | testing-library org | [OK] | Approved |
| eslint, typescript-eslint, prettier | npm | Long-established | respective orgs | [OK] | Approved |
| jsdom | npm | Long-established | jsdom/jsdom | [OK] | Approved |
| **vitest** | npm | Created 2021-12-03, github.com/vitest-dev/vitest | vitest-dev/vitest | **[SUS]** | **Flagged by slopcheck as "Suspiciously close to 'vite'. Could be a typosquat" — this is a false positive.** `vitest` is the standard, extremely widely used Vite-ecosystem test runner (4577 Context7 code snippets, official `vitest-dev/vitest` org, 5-year-old package, already a locked decision in `STACK.md`). No action needed beyond noting it here; do not swap it for anything else. |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `vitest` — confirmed false positive (name-similarity heuristic triggering on a legitimate, well-known package); no `checkpoint:human-verify` needed, but noted per protocol.

## Architecture Patterns

### System Architecture Diagram (Phase 1 scope only — preflop, no street navigation)

```
┌─────────────────────────────── MAIN THREAD ────────────────────────────────┐
│                                                                              │
│   [Deal button click]                                                       │
│          │                                                                  │
│          ▼                                                                  │
│   gameStore.deal()                                                          │
│    - draws 2 hero cards from a fresh 52-card deck (pure-rand)               │
│    - increments dealNonce (doubles as the worker requestId)                 │
│          │                                                                  │
│          ▼                                                                  │
│   useEffect watches [heroHole, dealNonce] ──► SimulationService             │
│                                                     │                       │
│                              api.cancel(prevId) ────┤                       │
│                              api.runSimulation( ────┤ Comlink RPC call      │
│                                heroHole, dealNonce,  │ (async, awaited      │
│                                Comlink.proxy(onProgress)) │ but never       │
│                                                     │ resolves until        │
│                                                     │ cancelled/superseded) │
│                                                     ▼                       │
│                                          ┌─────────────────────┐            │
│                                          │     WEB WORKER       │            │
│                                          │  (Comlink.expose)    │            │
│                                          │                       │            │
│                                          │  loop (chunked):      │            │
│                                          │   sample 11 cards     │            │
│                                          │   (5 board + 6 opp)   │            │
│                                          │   from remaining deck │            │
│                                          │   evaluate hero + 3   │            │
│                                          │   opponents, classify │            │
│                                          │   win/tie/lose,       │            │
│                                          │   bucket hero category│            │
│                                          │   every batch:        │            │
│                                          │    onProgress(snapshot)│            │
│                                          └───────────┬───────────┘            │
│   oddsStore updated  ◄─────────────────────────────────┘ (via Comlink.proxy  │
│    (categoryCounts,                                        callback, checks  │
│     outcomes, trials)                                      requestId match)  │
│          │                                                                  │
│          ▼                                                                  │
│   OddsTable / WinTieLoss / TrialCounter (React, subscribes to oddsStore)    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 1 slice of the full ARCHITECTURE.md design)
```
src/
├── engine/
│   ├── cards.ts            # deck helpers built on @poker-apprentice/types' ALL_CARDS
│   ├── rng.ts               # pure-rand wrapper: createRng(seed?), drawCards(rng, deck, n)
│   ├── evaluator.ts          # thin re-export/wrapper around evaluateHoldem + compare
│   ├── equity.ts             # runTrials(state, trialCount, rng) -> { categoryCounts, outcomes }
│   └── *.test.ts             # Vitest + fast-check, node environment
├── worker/
│   ├── simulation.worker.ts  # Comlink.expose({ runSimulation, cancel })
│   └── protocol.ts           # shared types: ConditionedState, ProgressSnapshot
├── state/
│   ├── gameStore.ts          # heroHole: [Card,Card] | null, dealNonce: number
│   ├── oddsStore.ts          # categoryCounts (10-length), outcomes, trialsCompleted
│   └── simulationService.ts  # owns the Comlink-wrapped worker, wires gameStore -> worker -> oddsStore
├── ui/
│   ├── DealButton.tsx
│   ├── OddsTable.tsx         # 10-row hand-category table
│   └── WinTieLossDisplay.tsx
└── App.tsx / main.tsx
```

Do **not** build `history.ts`, opponent-reveal flags, or a street cursor in Phase 1 — `NAV-01/02/03` and `DEAL-02/03` are Phase 2. Building them now risks guessing at a state shape Phase 2's own research/planning should decide. Phase 1's `ConditionedState` is always: `heroHole` fixed, `board: []` (5 unknown), `opponents: ['hidden','hidden','hidden']` (6 unknown) — a single, constant shape.

### Pattern 1: Hand-rolled trial loop using the evaluator's primitives (not its `simulate` helper)

**What:** One function, `runTrials`, draws 11 cards per trial (5 board + 2 per opponent) from the deck remaining after removing hero's cards, evaluates all 4 hands with `evaluateHoldem`, buckets hero's `strength` into a 10-slot category histogram, and determines win/tie/lose via `compare`.
**Why not the library's `simulate`/`simulateHoldem`:** Verified by reading the compiled source (`dist/esm/index.js`) — the internal `simulate()` generator calls `engine.sample(Math.random)` with a **hardcoded** `Math.random`, not a pluggable RNG, and its `EquityResult` shape (`{wins, ties, total, equity}`) has no hand-category field at all.

**Example (verified working against the real package):**
```typescript
// engine/equity.ts
import pkg from '@poker-apprentice/hand-evaluator';
const { evaluateHoldem, compare } = pkg; // CJS interop: must destructure default import, not named imports
import type { Card } from '@poker-apprentice/types';
import { HandStrength } from '@poker-apprentice/types';

export interface ConditionedState {
  heroHole: [Card, Card];
  remainingDeck: Card[]; // full 52-card deck minus heroHole, length 50 for Phase 1
}

export interface TrialBatchResult {
  categoryCounts: number[]; // length 10, index = HandStrength enum value (0=HighCard .. 9=RoyalFlush)
  outcomes: { win: number; tie: number; lose: number };
  trialsCompleted: number;
}

export function runTrials(
  state: ConditionedState,
  trialCount: number,
  draw11: () => Card[], // caller-supplied, seeded via pure-rand (see rng.ts)
): TrialBatchResult {
  const categoryCounts = new Array(10).fill(0);
  const outcomes = { win: 0, tie: 0, lose: 0 };

  for (let t = 0; t < trialCount; t++) {
    const sampled = draw11(); // 11 cards, no duplicates, drawn fresh from remainingDeck each trial
    const board = sampled.slice(0, 5);
    const opp1 = sampled.slice(5, 7);
    const opp2 = sampled.slice(7, 9);
    const opp3 = sampled.slice(9, 11);

    const hero = evaluateHoldem({ holeCards: state.heroHole, communityCards: board });
    const villains = [opp1, opp2, opp3].map((hole) =>
      evaluateHoldem({ holeCards: hole, communityCards: board }),
    );

    categoryCounts[hero.strength]++;

    // IMPORTANT sign convention (verified empirically — do not assume the opposite!):
    // compare(a, b) returns -1 if `a` is the STRONGER hand, +1 if `a` is WEAKER, 0 if tied.
    // (This is a "sort strongest-first" comparator, the reverse of naive numeric intuition.)
    let best = hero;
    for (const v of villains) {
      if (compare(v, best) === -1) best = v;
    }
    const heroIsBest = compare(hero, best) === 0;
    if (!heroIsBest) {
      outcomes.lose++;
    } else {
      const tiedCount = [hero, ...villains].filter((h) => compare(h, best) === 0).length;
      if (tiedCount > 1) outcomes.tie++;
      else outcomes.win++;
    }
  }

  return { categoryCounts, outcomes, trialsCompleted: trialCount };
}
```

### Pattern 2: Deck sampling — partial Fisher-Yates with `pure-rand` (verified deterministic)

**What:** Draw exactly `n` cards from a `k`-card pool without replacement using a partial Fisher-Yates (only shuffle the first `n` positions, not the whole array) — cheaper per-trial than a full shuffle when `n` (11) is much smaller than the remaining deck (50).
**Verified:** Ran this exact pattern against `pure-rand@8.4.2`; same seed produces identical shuffles across two independent runs, different seeds diverge.

```typescript
// engine/rng.ts
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { RandomGenerator } from 'pure-rand'; // subpath re-export; see note below
import type { Card } from '@poker-apprentice/types';

// NOTE: pure-rand@8.4.2 has NO top-level "." export — every import must use a subpath
// (verified via package.json "exports" map). `import { xoroshiro128plus } from 'pure-rand'`
// will throw ERR_PACKAGE_PATH_NOT_EXPORTED.

export function createRng(seed: number = Date.now() ^ (Math.random() * 0x100000000)) {
  return xoroshiro128plus(seed);
}

// Draws `n` cards from `pool` without replacement, mutating a working copy each call.
// For a fresh 50-card pool drawn 11 at a time per trial, allocate the copy once per
// trial-batch call site and reset it, not once per trial, to avoid GC pressure at scale.
export function drawN(rng: RandomGenerator, pool: readonly Card[], n: number): Card[] {
  const working = pool.slice();
  for (let i = 0; i < n; i++) {
    const j = uniformInt(rng, i, working.length - 1);
    [working[i], working[j]] = [working[j], working[i]];
  }
  return working.slice(0, n);
}
```

### Pattern 3: Comlink-wrapped chunked worker with generation-tagged cancellation

`ARCHITECTURE.md`'s Pattern 2 (chunked, cancellable, generation-tagged stream) was designed around raw `postMessage`. `STACK.md` separately locked Comlink as the RPC layer. This is the concrete reconciliation of the two, verified against Comlink's actual API (Context7 `/googlechromelabs/comlink`):

```typescript
// worker/simulation.worker.ts
import * as Comlink from 'comlink';
import { runTrials } from '../engine/equity';
import { createRng, drawN } from '../engine/rng';
import type { Card } from '@poker-apprentice/types';

let currentRequestId = -1;

const api = {
  cancel(requestId: number) {
    if (requestId === currentRequestId) currentRequestId = -1;
  },

  async runSimulation(
    heroHole: [Card, Card],
    remainingDeck: Card[],
    requestId: number,
    onProgress: (snapshot: {
      categoryCounts: number[];
      outcomes: { win: number; tie: number; lose: number };
      trialsCompleted: number;
    }) => void,
  ) {
    currentRequestId = requestId;
    const rng = createRng(); // fresh randomness per run; pass an explicit seed in tests
    const BATCH_SIZE = 4000; // ~10-30ms/batch at this machine's measured ~0.65M evals/sec,
                              // 4 evals/trial -> re-tune once profiled in an actual browser Worker
    const totals = { categoryCounts: new Array(10).fill(0), outcomes: { win: 0, tie: 0, lose: 0 }, trialsCompleted: 0 };

    while (requestId === currentRequestId) {
      const batch = runTrials(
        { heroHole, remainingDeck },
        BATCH_SIZE,
        () => drawN(rng, remainingDeck, 11),
      );
      for (let i = 0; i < 10; i++) totals.categoryCounts[i] += batch.categoryCounts[i];
      totals.outcomes.win += batch.outcomes.win;
      totals.outcomes.tie += batch.outcomes.tie;
      totals.outcomes.lose += batch.outcomes.lose;
      totals.trialsCompleted += batch.trialsCompleted;

      if (requestId !== currentRequestId) return; // superseded mid-batch — stop silently
      await onProgress({ ...totals, categoryCounts: [...totals.categoryCounts] });
      await new Promise((r) => setTimeout(r, 0)); // yield so cancel()/a new run can be processed
    }
  },
};

Comlink.expose(api);
export type SimulationApi = typeof api;
```

```typescript
// state/simulationService.ts (main thread)
import * as Comlink from 'comlink';
import type { SimulationApi } from '../worker/simulation.worker';
import SimWorker from '../worker/simulation.worker?worker'; // Vite ?worker import, verified via Context7

const worker = new SimWorker();
const api = Comlink.wrap<SimulationApi>(worker);
let currentRequestId = 0;

export async function startSimulation(
  heroHole: [Card, Card],
  remainingDeck: Card[],
  onProgress: (s: ProgressSnapshot) => void,
) {
  const requestId = ++currentRequestId;
  await api.cancel(requestId - 1);
  await api.runSimulation(
    heroHole,
    remainingDeck,
    requestId,
    Comlink.proxy((snapshot) => {
      if (requestId !== currentRequestId) return; // stale — ignore (defense in depth; worker already stops itself)
      onProgress(snapshot);
    }),
  );
}

// Call on app teardown (rare for an SPA, but correct for HMR/StrictMode double-invoke):
// worker.terminate();
```

### Anti-Patterns to Avoid
- **Assuming `compare(a, b) > 0` means `a` wins.** It's the opposite — verified empirically (see Pattern 1). Getting this backwards silently inverts every win/tie/lose number while still summing to 100%, so it will **not** be caught by the sum-to-100% sanity check (Pitfall #2 in `PITFALLS.md`) — only by a known-benchmark smoke test (see "Benchmark Odds Values" below) or a hand-constructed win/lose test case.
- **Calling `npm create vite@latest . --overwrite` in this repo root.** Deletes `.planning/` and `CLAUDE.md`. See "Common Pitfalls."
- **Using named ESM imports from `@poker-apprentice/hand-evaluator`.** It's published as CJS with an ESM build (`main`/`module` fields, no `exports` map) — verified that `import { describeHand } from '@poker-apprentice/hand-evaluator'` throws in Node's ESM loader for functions not detected by CJS-named-export interop. Use `import pkg from '@poker-apprentice/hand-evaluator'; const { evaluate, evaluateHoldem, compare } = pkg;` (verified working). Also note: `describeHand` is **not** part of the public API at all (present in `dist/types/utils/` but not re-exported from `dist/types/index.d.ts`) — don't rely on it.
- **Trusting the vendor's throughput claim (~18M evals/sec) for chunk-size math.** Benchmarked on this dev machine (Node v24.15.0): `evaluateHoldem()` sustains ~0.65M evals/sec, not 18M — likely because the marketing figure profiles a lower-level internal path without the public API's options-object overhead. Use the ~0.65M number (or better, profile in an actual browser Worker) for batch-size tuning, not the vendor claim.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 7-card best-hand evaluation (kickers, wheel, category precedence) | Custom evaluator | `@poker-apprentice/hand-evaluator`'s `evaluateHoldem`/`compare` | Verified correct on the exact documented historical bug case (straight-flush low card sharing rank with another card) — reproduced the bug scenario, confirmed it now returns `StraightFlush` correctly in 4.3.0 |
| 52-card deck construction | Hand-written rank×suit loop | `ALL_CARDS` from `@poker-apprentice/types` | Already exported, already typed as the exact `Card` union the evaluator expects — avoids a whole class of "my deck's card-string format doesn't match the evaluator's" bugs |
| Deck shuffling for trial sampling | `array.sort(() => Math.random() - 0.5)` | Fisher-Yates via `pure-rand`'s `uniformInt` | `sort`-based "shuffle" is a well-documented non-uniform bias; `pure-rand` also gives seedability for free, needed for deterministic tests |
| Win/tie/lose multi-way comparison | Ad-hoc greater-than chains | `compare()` + explicit max-then-count-ties reduction (Pattern 1 above) | The comparator's inverted sign convention is exactly the kind of subtle bug `PITFALLS.md`'s Critical #3 warns about — isolate it in one tested function |

**Key insight:** Every "don't hand-roll" item here has a documented, verifiable failure mode if hand-rolled (a real historical bug in evaluators, a well-known biased-shuffle footgun, a signed-comparator inversion) — this isn't generic library-preference advice, it's pointing at specific bugs this exact stack has already exhibited or could easily exhibit.

## Common Pitfalls

### Pitfall 1: `npm create vite@latest .` cancels (or worse, deletes project files) in this exact repo
**What goes wrong:** Running the scaffold command directly against the project root either silently cancels (non-interactive, no `--overwrite`) or deletes `.planning/` and `CLAUDE.md` (with `--overwrite`).
**Why it happens:** `create-vite`'s `isEmpty()` check only tolerates a bare `.git` directory in the target — verified by reading its source and reproducing the exact failure in a sandbox with the same `.git` + `.planning/` + `CLAUDE.md` shape as this repo.
**How to avoid:**
```bash
npm create vite@latest _scaffold_tmp -- --template react-ts --eslint
# then move _scaffold_tmp's contents into the repo root, merging (not overwriting)
# any files that might collide — verified there are none in this repo (only .git/.planning/CLAUDE.md exist)
mv _scaffold_tmp/* _scaffold_tmp/.gitignore .
rmdir _scaffold_tmp
```
**Warning signs:** CLI output literally says `Operation cancelled`; or (far worse, don't let this happen) `.planning/` disappearing after a scaffold command.

### Pitfall 2: `--eslint` flag is required, or the scaffold silently uses Oxlint instead
**What goes wrong:** `create-vite`'s React templates now default to **Oxlint**, not ESLint (`"lint": "oxlint"` in the generated `package.json` — verified by running the scaffold without the flag). `STACK.md` locked ESLint 10.9.0 + `typescript-eslint` 8.67.0 as the project's linting stack.
**Prevention:** Always pass `--eslint` explicitly: `npm create vite@latest _scaffold_tmp -- --template react-ts --eslint`. Verified this produces `eslint.config.js` (flat config), `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` in `devDependencies`, and `"lint": "eslint ."`.

### Pitfall 3: TypeScript version drifts to 7.0.2 on a later `npm install`
**What goes wrong:** The scaffold pins `typescript: "~6.0.2"` (verified), which is safe, but any later `npm install typescript` (without a version) or a broad `npm update` can pull the `latest` dist-tag (7.0.2), breaking `typescript-eslint` (peer range `>=4.8.4 <6.1.0`, verified via `npm view typescript-eslint`).
**Prevention:** After scaffolding, explicitly re-pin: `npm install -D typescript@6.0.3 --save-exact`, and avoid `npm update` without checking what it touches.

### Pitfall 4: TS `lib` conflict between the app (`DOM`) and the worker (`WebWorker`)
**What goes wrong:** `tsconfig.app.json` (scaffolded default) sets `"lib": ["ES2023", "DOM"]` for all of `src/`, including the worker file. `WebWorker` and `DOM` lib types can conflict (both define ambient globals like `self`, `postMessage` with different signatures).
**Why it's lower-risk here than usual:** Because the worker uses Comlink (`Comlink.expose(api)`), the code never directly calls `self.postMessage`/`self.onmessage` — Comlink's own type definitions handle that boundary, so the typical `postMessage` overload clash is largely avoided.
**Prevention:** Start with the simple approach — add `"WebWorker"` to `tsconfig.app.json`'s existing `lib` array alongside `"DOM"`: `"lib": ["ES2023", "DOM", "WebWorker"]`. If `tsc -b` reports ambient-global conflicts once the worker file exists, fall back to a dedicated `tsconfig.worker.json` (`lib: ["ES2023", "WebWorker"]`, `include: ["src/worker/**/*"]`) referenced from the root `tsconfig.json` and excluded from `tsconfig.app.json`.

### Pitfall 5: React 19 StrictMode double-invokes the worker-creation effect in dev
**What goes wrong:** `main.tsx`'s scaffolded `<StrictMode>` wrapper double-invokes effects in development, which can create two Workers (leaking one) if worker instantiation lives directly in a `useEffect` body without cleanup.
**Prevention:** Instantiate the worker once at module scope in `simulationService.ts` (as shown in Pattern 3), not inside a component effect — or if instantiated in an effect, return a cleanup function that calls `worker.terminate()`.
**Detection:** Two worker threads visible in browser DevTools' "Threads"/"Workers" panel after a single page load in dev mode.

### Pitfall 6: Hand-category table renders 9 rows instead of 10
**What goes wrong:** `ARCHITECTURE.md`'s protocol sketch comments "9 hand categories, high card..royal flush" and sizes `categoryCounts` as a 9-element array. The actual `HandStrength` enum (verified by reading `@poker-apprentice/types`' `.d.ts`) has **10** values: `HighCard=0, OnePair=1, TwoPair=2, ThreeOfAKind=3, Straight=4, Flush=5, FullHouse=6, FourOfAKind=7, StraightFlush=8, RoyalFlush=9`.
**Prevention:** Size `categoryCounts` as a 10-element array (or a `Map<HandStrength, number>` seeded with all 10 keys at zero) and index directly by `hero.strength`. `ODDS-02`'s "high card → royal flush" range literally means 10 distinct rows, not 9.
**Detection:** Sum-to-100% check (Pitfall #2 in `PITFALLS.md`) still passes even with only 9 buckets if Royal Flush is silently folded into Straight Flush — this bug is otherwise invisible except to a poker-literate user who deals themselves a royal and sees it labeled "Straight Flush."

### Pitfall 7 (inherited from `PITFALLS.md`, reinforced with concrete evidence): `compare()`'s inverted sign convention
See "Anti-Patterns to Avoid" above. This is the single easiest way to reintroduce `PITFALLS.md`'s Critical Pitfall #3 (win/tie/lose bucketing errors) even while using the "correct" library function, because the bug is a sign flip, not a logic error — code that reads naturally (`if (compare(hero, opp) > 0) hero wins`) is exactly backwards.

## Code Examples

### Zustand stores (Phase 1 minimal shape)
```typescript
// state/gameStore.ts
import { create } from 'zustand';
import type { Card } from '@poker-apprentice/types';
import { ALL_CARDS } from '@poker-apprentice/types';
import { createRng, drawN } from '../engine/rng';

interface GameState {
  heroHole: [Card, Card] | null;
  dealNonce: number; // doubles as the worker's requestId — one counter, one source of truth
  deal: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  heroHole: null,
  dealNonce: 0,
  deal: () => {
    const rng = createRng();
    const [c1, c2] = drawN(rng, ALL_CARDS, 2);
    set({ heroHole: [c1, c2], dealNonce: get().dealNonce + 1 });
  },
}));
```
```typescript
// state/oddsStore.ts
import { create } from 'zustand';

interface OddsState {
  categoryCounts: number[]; // length 10
  outcomes: { win: number; tie: number; lose: number };
  trialsCompleted: number;
  setSnapshot: (s: Omit<OddsState, 'setSnapshot'>) => void;
}

export const useOddsStore = create<OddsState>((set) => ({
  categoryCounts: new Array(10).fill(0),
  outcomes: { win: 0, tie: 0, lose: 0 },
  trialsCompleted: 0,
  setSnapshot: (s) => set(s),
}));
```

### Vitest config
```typescript
// vite.config.ts (merge test block into the scaffolded config)
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', // needed for @testing-library/react component tests
    globals: true,
    setupFiles: ['./src/test/setup.ts'], // imports @testing-library/jest-dom matchers
  },
});
```
```typescript
// engine/equity.test.ts — pure engine tests don't need jsdom; opt out for speed
// @vitest-environment node
```

### fast-check property tests for ENG-04's invariants
```typescript
import { test, fc } from '@fast-check/vitest';
import { runTrials } from './equity';
import { createRng, drawN } from './rng';
import { ALL_CARDS } from '@poker-apprentice/types';

test.prop([fc.integer({ min: 1, max: 5000 })])(
  'category counts always sum to trial count, and win+tie+lose always sums to trial count',
  (trialCount) => {
    const rng = createRng(12345); // fixed seed -> deterministic test
    const heroHole = ALL_CARDS.slice(0, 2) as [typeof ALL_CARDS[number], typeof ALL_CARDS[number]];
    const remainingDeck = ALL_CARDS.slice(2);
    const result = runTrials({ heroHole, remainingDeck }, trialCount, () => drawN(rng, remainingDeck, 11));
    const categorySum = result.categoryCounts.reduce((a, b) => a + b, 0);
    const outcomeSum = result.outcomes.win + result.outcomes.tie + result.outcomes.lose;
    return categorySum === trialCount && outcomeSum === trialCount;
  },
);
```

## Benchmark Odds Values (for ENG-04's "validated against published benchmark odds")

Computed directly against the recommended library (`@poker-apprentice/hand-evaluator`'s `simulateHoldem`, 2,000,000 samples each) — use these as regression-test targets with a generous tolerance band (±2-3 percentage points is reasonable for a few hundred thousand trials at runtime; tighten the band as trial count grows):

| Scenario | Hero Equity (2M-sample benchmark) | Notes |
|----------|-----------------------------------|-------|
| AA vs. 1 random hand (heads-up) | **85.20%** | Classic "AA is ~85% heads-up" reference — matches published figures closely |
| AA vs. 3 random hands (Phase 1's actual scenario shape) | **63.83%** | This is the exact scenario `DEAL-01`/`ODDS-01` build — use this as the primary smoke test |
| 7-2 offsuit vs. 1 random hand ("worst starting hand") | **34.57%** | Useful low-equity sanity check |
| KK vs. AQ (pair vs. two overcards, heads-up) | **71.95% / 28.05%** | Useful "coin-flip-adjacent" sanity check for the pair-vs-overcards shape |

**Provenance:** `[VERIFIED: computed by this research session directly against the exact recommended library version, 2026-08-23]` — not copied from an external published table, so there's no risk of the source using a different rule variant (e.g., short-deck, different opponent count). Re-derive with a larger sample if a tighter tolerance is needed.

## Runtime State Inventory

Not applicable — this is a greenfield phase (first phase of a new project, empty directory except `.git`/`.planning`/`CLAUDE.md`). No rename/refactor/migration is occurring.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm scripts, Vite dev server, Vitest | ✓ | v24.15.0 | — |
| npm | package management | ✓ | 11.12.1 | — |
| Web Worker API | ENG-03 (off-main-thread simulation) | ✓ (all evergreen browsers; not a Node-side dependency) | — | — |

No missing dependencies. This phase has no external services, databases, or network dependencies (client-only app, per `PROJECT.md`).

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled per policy), but Phase 1 is a purely client-side, offline, no-auth, no-persistence, no-network-request application — most ASVS categories genuinely do not apply. Reporting this honestly rather than padding it with inapplicable rows:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No accounts, no login — single-user local tool |
| V3 Session Management | No | No sessions — everything is in-memory React/Zustand state, discarded on refresh |
| V4 Access Control | No | No resources to protect — everything is local computation |
| V5 Input Validation | Marginal | Phase 1 has no free-form user input (Deal button only; manual card entry is `DEAL-02`, Phase 2). The one internal validation surface is `@poker-apprentice/types`' `assertCard`/`isCard` guards if/when card strings ever cross a serialization boundary (e.g., worker `postMessage`) — TypeScript's `Card` union type gives compile-time safety for internally-constructed values, so this is a defense-in-depth note, not a required control for Phase 1's actual attack surface (there isn't one) |
| V6 Cryptography | No | No secrets, no crypto |

### Known Threat Patterns for this stack
None applicable at meaningful severity — no network requests, no user-supplied strings rendered as HTML (React's JSX escaping handles any incidental text rendering by default), no persistence layer, no third-party script execution beyond the pinned npm dependencies already covered by the Package Legitimacy Audit above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node throughput benchmarks (~0.65M evals/sec) translate to a "comfortably responsive" experience once running inside an actual browser Web Worker | Standard Stack / Pattern 3 | Low — even a 2-5x slowdown in-browser still comfortably fits a 4,000-trial batch under a 100ms frame budget; if real-device profiling shows otherwise, `BATCH_SIZE` is a one-line tune, not an architecture change |
| A2 | `react-ts` (not `react-compiler-ts`) remains the right Vite template choice for Phase 1 | Alternatives Considered | Low — `STACK.md` explicitly locked the Babel-based `@vitejs/plugin-react` transform; switching later to the compiler template is a config-level change, not a rewrite |

**All other claims in this document were verified via direct package inspection, executed code, live npm registry queries, Context7-sourced official documentation, or reproduced failure/success scenarios in a sandbox** — no claim above those two carries meaningful unverified risk.

## Open Questions (RESOLVED)

1. **Should Phase 1 include a Playwright smoke test, or defer all E2E to a later phase?**
   - What we know: `STACK.md` lists Playwright as part of the testing stack; no Phase 1 requirement ID explicitly demands E2E coverage.
   - What's unclear: Whether `nyquist_validation` being disabled in `config.json` (it is — `false`) plus `code_review: true`/`code_review_depth: standard` already provides enough of a safety net for a phase this thin, or whether one smoke test ("click Deal, verify the trial counter increases and win% is not NaN") is cheap enough to include regardless.
   - RESOLVED: deferred at planner's discretion — no Playwright in Phase 1; decision recorded in SKELETON.md ("Playwright E2E. Deferred; no Phase 1 requirement demands cross-boundary E2E coverage").

## Sources

### Primary (HIGH confidence)
- Direct package inspection: installed `@poker-apprentice/hand-evaluator@4.3.0`, `@poker-apprentice/types`, and `pure-rand@8.4.2` into a scratch directory and read their compiled `.d.ts` files and bundled source directly (not summarized by a third party)
- Executed code: ran `evaluateHoldem`/`compare`/`simulateHoldem` against constructed and edge-case hands (wheel straight, royal flush, tied boards, the documented historical straight-flush bug scenario, 2M-sample equity benchmarks) and captured real output
- Executed code: reproduced this exact repo's directory shape (`.git` + `.planning/` + `CLAUDE.md`) in a sandbox and ran the real `npm create vite@latest` scaffold command against it, both with and without a subdirectory workaround
- Context7 (`ctx7` CLI, installed this session after verifying it on the npm registry): `/vitejs/vite` (Web Worker `?worker` syntax, `create-vite` template contents, tsconfig split, TS `lib` guidance), `/googlechromelabs/comlink` (expose/wrap/proxy API, TypeScript `Remote<T>` typing), `/pmndrs/zustand` (store creation pattern), `/vitest-dev/vitest` (environment config, per-file environment override), `/dubzzz/fast-check` (Vitest integration)
- npm registry (`npm view`, live, 2026-08-23) — every version number in the Standard Stack table

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md` — project-level research this phase-level research extends and, in two places (category count, `compare()` sign convention), corrects with verified evidence

### Tertiary (LOW confidence)
- None — every claim in this document above is either verified via tool execution/direct inspection, or explicitly logged in the Assumptions table above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version re-verified live against npm; hand evaluator API verified by direct package inspection and execution, not documentation alone
- Architecture: HIGH — worker/Comlink protocol verified against real Comlink API docs; scaffolding safety verified by reproducing the exact failure in a sandbox
- Pitfalls: HIGH — every pitfall in this document (except the two logged Assumptions) is backed by an executed reproduction, not inference

**Research date:** 2026-08-23
**Valid until:** 2026-09-22 (30 days — stable ecosystem, but re-verify npm versions if planning is delayed, since `typescript`, `vite`, and `eslint` all move fast)
