---
phase: 01-core-odds-loop
reviewed: 2026-08-24T04:38:52Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - .gitignore
  - README.md
  - eslint.config.js
  - index.html
  - package.json
  - src/App.css
  - src/App.test.tsx
  - src/App.tsx
  - src/engine/benchmark.test.ts
  - src/engine/cards.ts
  - src/engine/equity.property.test.ts
  - src/engine/equity.test.ts
  - src/engine/equity.ts
  - src/engine/evaluator.test.ts
  - src/engine/evaluator.ts
  - src/engine/rng.ts
  - src/index.css
  - src/main.tsx
  - src/state/gameStore.ts
  - src/state/oddsStore.ts
  - src/state/simulationService.ts
  - src/test/setup.ts
  - src/ui/DealButton.tsx
  - src/ui/HandDisplay.tsx
  - src/ui/OddsTable.tsx
  - src/ui/WinTieLossDisplay.tsx
  - src/ui/categoryLabels.ts
  - src/worker/protocol.ts
  - src/worker/simulation.worker.ts
  - src/worker/simulationApi.test.ts
  - src/worker/simulationApi.ts
  - tsconfig.app.json
  - tsconfig.json
  - tsconfig.node.json
  - vite.config.ts
findings:
  critical: 0
  warning: 2
  info: 8
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-24T04:38:52Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the full walking-skeleton implementation of the core odds loop: engine (cards/rng/evaluator/equity), worker pipeline (protocol/simulationApi/worker), state (gameStore/oddsStore/simulationService), UI components, and configs/tests. The domain-critical math paths were traced end-to-end and cross-checked against the *installed* third-party packages, not just the code's own claims:

- **Verified against `@poker-apprentice/types@1.4.2` dist:** `HandStrength` is `HighCard=0 .. RoyalFlush=9`, matching `CATEGORY_LABELS` ordering and `CATEGORY_COUNT=10` exactly — `categoryCounts[hero.strength]` indexing is correct.
- **Verified against `@poker-apprentice/hand-evaluator@4.3.0` dist source:** raw `compare(a, b)` returns `-1` when `a` is stronger (sort-strongest-first), so the inversion in `compareHands` is correct; tie comparison is rank-only (suits never break ties), so split-pot detection is sound. `evaluateHoldem` returns `{ strength, hand }`, matching the local `Hand` interface.
- **Verified against `pure-rand@8.4.2` dist source:** `uniformInt(rng, from, to)` is inclusive-both-ends, rejection-sampled (unbiased), and mutates the generator in place via `next()` — the `drawN`/`createDrawer` partial Fisher-Yates is a correct uniform no-replacement sampler, including the reused-working-array variant (Fisher-Yates uniformity is independent of the starting permutation).
- **Win/tie/lose reduction** in `runTrials` (max-then-count-ties) is correct for all multi-way tie shapes; hero-as-first-element with strict `> 0` max selection keeps ties resolvable via the tied-count pass.
- **Verified empirically:** `tsc -b` clean, `eslint .` clean, all 25 tests pass, `vite build` succeeds (worker gets its own chunk; the named-import deviation documented in `evaluator.ts` holds). TypeScript 6.0.3 defaults `strict` to true (confirmed by compiling a strict-violating file with the installed compiler), so the absence of a `strict` key in the tsconfigs is not a type-safety gap.
- **Security scan:** no injection surfaces, no `eval`/`innerHTML`, no secrets, no network calls; rendered card text comes from a closed string union. Clean.

No Critical findings. Two Warnings: an idempotency hole in the worker supersession protocol that spawns two concurrent simulation loops when `runSimulation` is re-entered with the same requestId (reachable via StrictMode/HMR remount in dev, and unguarded at every layer), and a completely unhandled error path from worker to UI (a worker failure silently freezes the odds display with an unobserved promise rejection). Eight Info items, including test fixtures that demonstrably trip the store's own consistency guard on every test run.

## Warnings

### WR-01: Duplicate-requestId re-entry spawns two concurrent simulation loops; no layer dedupes it and the App effect has no cleanup

**File:** `src/worker/simulationApi.ts:48-61`, `src/App.tsx:15-22`, `src/state/simulationService.ts:26-37`
**Issue:** The supersession protocol assumes every `runSimulation` call carries a *new* requestId. If `runSimulation` is invoked twice with the **same** requestId while the first run is in flight, the second call sets `currentRequestId = requestId` (a no-op) and starts a second loop — now **two concurrent loops** both satisfy `requestId === currentRequestId`, both run to `maxTrials`, and both emit snapshots that pass the main-thread filter in `simulationService` (same id). The store receives interleaved snapshots from two independent tallies: a non-monotonic, flickering trial counter and odds that jump between two sample sets, at 2x CPU.

This is reachable today: `App.tsx`'s effect has no cleanup, and a dev-mode remount with state preserved (React StrictMode double-invoked effects after an HMR update, or any future refactor that remounts `App` while `heroHole` is non-null in the Zustand store) re-runs the effect with identical `[heroHole, dealNonce]`, firing `startSimulation` twice with the same requestId. Nothing in `simulationService` (which only tracks `currentRequestId`, equal in both calls), the worker, or `oddsStore` (which has no staleness/monotonicity guard) breaks the tie. Production single-click flow is safe only because nothing currently re-enters — the protocol itself has the hole.
**Fix:** Make the newest invocation always supersede, even at equal requestIds, with a per-invocation token in `createSimulationApi`:
```ts
let currentRunToken: object | null = null;

async runSimulation(heroHole, remainingDeck, requestId, onProgress) {
  // ...validation...
  currentRequestId = requestId;
  const runToken = {};
  currentRunToken = runToken;
  // ...
  while (requestId === currentRequestId && runToken === currentRunToken) {
    // ...
  }
}
```
And add an effect cleanup in `App.tsx` so an unmounted/superseded effect cancels its generation:
```ts
useEffect(() => {
  if (!heroHole) return;
  useOddsStore.getState().reset();
  void startSimulation(heroHole, deckWithout(heroHole), dealNonce, (snapshot) =>
    useOddsStore.getState().applySnapshot(snapshot),
  );
  return () => {
    void cancelSimulation(dealNonce); // new export in simulationService wrapping api.cancel
  };
}, [heroHole, dealNonce]);
```

### WR-02: No error handling anywhere on the async worker path — a worker failure is an unobserved rejection and a silently frozen UI

**File:** `src/App.tsx:19`, `src/state/simulationService.ts:20-38`
**Issue:** There is not a single `catch` in the codebase (verified by grep). `App.tsx` fires `void startSimulation(...)`; `startSimulation` awaits `api.cancel` and `api.runSimulation` with no try/catch. If the worker fails — script load failure in production, a structured-clone/Comlink transport error, or the `runSimulation` entry validation throwing (`heroHole must have exactly 2 cards...`, which exists precisely to "fail loudly") — the rejection propagates into the `void`-ed promise and becomes an unhandled "Uncaught (in promise)" console entry. The UI gives no indication: the trial counter freezes at the last applied snapshot (or `0` / `—` after the reset), which for a probability-visualization tool is indistinguishable from "still converging". The loud-failure intent of the validation guards is defeated by the silent last mile.
**Fix:** Catch at the service boundary and surface state the UI can render:
```ts
// simulationService.ts
export async function startSimulation(...): Promise<void> {
  currentRequestId = requestId;
  try {
    await api.cancel(requestId - 1);
    await api.runSimulation(heroHole, remainingDeck, requestId, Comlink.proxy(...));
  } catch (error) {
    if (requestId === currentRequestId) {
      useOddsStore.getState().setError(error instanceof Error ? error.message : String(error));
    }
  }
}
```
with a matching `error: string | null` field in `oddsStore` (cleared by `reset()`) and a minimal render in `WinTieLossDisplay` or `App`.

## Info

### IN-01: App.test.tsx snapshot fixtures violate the categoryCounts-sum invariant, tripping the store's own consistency guard on every test run

**File:** `src/App.test.tsx:47-60`, `src/state/oddsStore.ts:41-45`
**Issue:** The "climbing trial counter" test streams snapshots with `categoryCounts: new Array(10).fill(0)` but `trialsCompleted: 50/100`. `import.meta.env.DEV` is true under Vitest, so `checkSnapshotConsistency` fires — verified in the actual run output: `[oddsStore consistency guard] categoryCounts sum (0) does not match trialsCompleted (50)` (and `(100)`). The suite passes today only because the guard is report-only; if it is ever escalated to `throw` in dev (a natural hardening step the ENG-04 comment invites), these tests break. Fixtures that model the system's own documented invariant should satisfy it.
**Fix:** Use internally consistent fixtures, e.g. `categoryCounts: [30, 20, 0, ...]` summing to 50 and `[60, 40, 0, ...]` summing to 100, mirroring what the category-table test already does correctly.

### IN-02: Scaffold leftovers shipped: user-visible "scaffold-tmp" title, stock template README, dead App.css, unused assets

**File:** `index.html:7`, `README.md:1`, `src/App.css:1`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`, `src/index.css:59-184`
**Issue:** `<title>scaffold-tmp</title>` is the user-visible browser-tab title of the app. `README.md` is the untouched Vite template README (describes plugin options, not this project). `src/App.css` is imported by nothing (verified: no `App.css` reference anywhere in `src/`; the built CSS chunk is index.css only) — 184 lines of dead scaffold styles. `src/assets/hero.png`, `react.svg`, `vite.svg`, and `public/icons.svg` are referenced by nothing. `index.css` retains large scaffold-only selector blocks (`#next-steps`, `.hero`, `.ticks`, `.counter`, `#social`).
**Fix:** Set the title to "Monte Carlo Poker Simulator", replace README with project docs, delete `src/App.css` and the unused assets, and prune the dead selectors from `index.css`.

### IN-03: `formatPct` duplicated verbatim in two components

**File:** `src/ui/OddsTable.tsx:4-7`, `src/ui/WinTieLossDisplay.tsx:3-6`
**Issue:** Identical function (including the `'—'` zero-trials sentinel) in both files. A future formatting change (decimal places, locale) must be made twice or the two displays drift.
**Fix:** Extract to `src/ui/formatPct.ts` and import in both components.

### IN-04: `runTrials` accepts `ConditionedState.remainingDeck` but never uses it

**File:** `src/engine/equity.ts:32-49`
**Issue:** Only `state.heroHole` is read; the actual card pool lives inside the `draw11` closure. Passing an unused `remainingDeck` invites silent drift — a caller can hand `runTrials` a `remainingDeck` that disagrees with the pool baked into `draw11`, and nothing detects it.
**Fix:** Either drop `remainingDeck` from `ConditionedState` (take `heroHole` directly), or use it: assert in dev that `draw11()`'s output ⊆ `remainingDeck` once per batch, making the declared state binding.

### IN-05: `oddsStore.done` is written but never read

**File:** `src/state/oddsStore.ts:9`, `src/state/oddsStore.ts:64`
**Issue:** No component consumes `done` — the UI cannot distinguish "still converging" from "settled at maxTrials", which is core to the "watch odds converge and settle" experience. Dead state field as of this phase.
**Fix:** Either render it (e.g., a "settled" indicator next to the trial counter) or annotate it as reserved for the next phase so it isn't flagged as dead code again.

### IN-06: Worker entry validation is length-only — duplicates or hero-card overlap in `remainingDeck` pass silently, contradicting the fail-loudly comment

**File:** `src/worker/simulationApi.ts:38-46`
**Issue:** The T-02-02 comment says malformed calls "would otherwise silently produce wrong probabilities rather than failing loudly", but the guard only checks lengths. A 50-card `remainingDeck` containing a duplicate card or one of the hero's hole cards passes validation and produces exactly the silent wrong-probabilities failure the guard claims to prevent.
**Fix:** Add set-based checks: `new Set(remainingDeck).size === remainingDeck.length` and `!remainingDeck.includes(heroHole[0]) && !remainingDeck.includes(heroHole[1])` (one-time cost per run, not per trial).

### IN-07: `drawN`/`createDrawer` have no `n <= pool.length` guard — misuse yields `NaN` indexes and `undefined` "cards"

**File:** `src/engine/rng.ts:21-28`, `src/engine/rng.ts:34-43`
**Issue:** With `n > pool.length`, `uniformInt(rng, i, working.length - 1)` is called with `from > to`; pure-rand's internal `deltaV % rangeSize` then produces `NaN`/garbage indexes and the returned array contains `undefined` entries that would flow into the evaluator as invalid cards. All current call sites pass safe constants (2 of 52, 11 of 50), so this is a latent-misuse guard, not a live bug.
**Fix:** `if (n > pool.length) throw new Error(...)` at the top of both functions (once per drawer creation in `createDrawer`).

### IN-08: `Comlink.proxy` callback port is never released — one leaked MessagePort per Deal

**File:** `src/state/simulationService.ts:33`
**Issue:** Each `startSimulation` wraps a fresh callback in `Comlink.proxy()`, which allocates a `MessageChannel`; the proxy is never released after `runSimulation` settles, so ports and listeners accumulate one per deal for the page lifetime. Noted as Info because memory/perf is explicitly out of v1 review scope — recorded here because the fix is two lines and the leak grows with a primary user action.
**Fix:** Hold the proxied callback in a variable and call `proxyCallback[Comlink.releaseProxy]()` (or `Comlink.transfer`-based cleanup) in a `finally` after `await api.runSimulation(...)` settles.

---

_Reviewed: 2026-08-24T04:38:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
