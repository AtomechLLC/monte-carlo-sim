---
phase: 02-scenario-construction-street-navigation
reviewed: 2026-08-24T07:19:05Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - src/App.acceptance.test.tsx
  - src/App.css
  - src/App.test.tsx
  - src/App.tsx
  - src/engine/benchmark.test.ts
  - src/engine/cards.ts
  - src/engine/conditioning.test.ts
  - src/engine/conditioning.ts
  - src/engine/equity.property.test.ts
  - src/engine/equity.test.ts
  - src/engine/equity.ts
  - src/engine/streets.ts
  - src/index.css
  - src/state/gameStore.test.ts
  - src/state/gameStore.ts
  - src/state/oddsStore.test.ts
  - src/state/oddsStore.ts
  - src/state/pickerStore.test.ts
  - src/state/pickerStore.ts
  - src/state/simulationService.ts
  - src/test/setup.ts
  - src/ui/BoardDisplay.tsx
  - src/ui/CardPicker.test.tsx
  - src/ui/CardPicker.tsx
  - src/ui/HandDisplay.tsx
  - src/ui/StreetControls.tsx
  - src/worker/protocol.ts
  - src/worker/simulationApi.test.ts
  - src/worker/simulationApi.ts
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-24T07:19:05Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed all Phase 2 source changes (conditioning, street navigation, settled-odds cache, one-way reveal, seven-slot picker, run-token supersession, worker error surfacing) plus cross-referenced non-changed modules they depend on (`rng.ts`, `evaluator.ts`, `simulation.worker.ts`, `DealButton`, `WinTieLossDisplay`, `OddsTable`). The domain-critical paths were traced adversarially:

- **D-02 information leak — verified clean.** Grep across all non-test source confirms `deriveConditionedState` is the only reader of `runout.board`/`runout.opponentHoles` for simulation input. `BoardDisplay` slices only the street-visible board; `HandDisplay` reads opponent holes solely for rendering already-revealed seats. Hidden cards provably stay in `remainingDeck` (property test reconstitutes the full 52-card deck for all 32 street/mask combinations), and the acceptance suite asserts the invariant against every captured conditioned state.
- **Cache staleness — verified sound.** Key = `street|revealedMask`; reveal is monotonic (OR-only, no un-reveal path), so old-mask entries become permanently unreachable rather than stale-servable; `deal()` clears the whole cache before any effect can read it (`clearCache()` runs synchronously inside `deal()`, effects run post-render). Cache writes are filed under the effect-closure's `(street, mask)` — never a fresh `getState()` read — and are double-gated (App `ignore` flag + `cacheIfSettled`'s `done` gate), so a superseded run cannot poison the cache under any interleaving I could construct.
- **Supersession races — verified sound.** Traced rapid navigate/re-deal interleavings across the three defense layers: worker run-token identity (fixes prior WR-01, including the same-requestId re-entry case, with a dedicated regression test), main-thread `currentRequestId` filter (set to `-1` synchronously at cancel time), and the per-effect `ignore` flag. MessagePort FIFO ordering guarantees two overlapping `startSimulation` calls resume in call order, so the newer conditioned state always wins.
- **Duplicate cards — verified sound.** Merge-on-deal draws all fills from one shuffle of `deckWithout(picked)`; picker blocks cross-slot duplicates at both UI and store layers; the worker overlap guard rejects remainingDeck/known-card intersection (though not internal duplicates — see IN-01).
- **Prior-phase fix verification:** WR-01 (run token + effect cleanup) is **genuinely fixed** — cleanup exists at `App.tsx:69-72`, token supersession at `simulationApi.ts:86-113`, regression test at `simulationApi.test.ts:131-158`. WR-02 (visible error path) is **fixed for the call-rejection path only** — worker load failure / hard worker death still produces the exact silent freeze the original finding described (see WR-02 below).

No Critical findings. Two Warnings: a stale error banner that persists over valid cached odds (the one path that never clears it), and the residual silent-freeze gap on worker death. Six Info items, including two phase-1 findings that were only half-addressed while their files were heavily edited this phase.

## Warnings

### WR-01: Simulation-error banner persists across cache-hit navigation, contradicting its own instructions

**File:** `src/App.tsx:34-38`, `src/App.tsx:54`
**Issue:** `errorMessage` is cleared in exactly one place — the `onProgress` callback of a *live* run (line 54). The cache-hit branch (lines 34-38) applies the cached snapshot and returns without ever touching `errorMessage`. Concrete repro: deal (preflop settles, cached) → Advance (flop run errors, banner appears) → Rewind (preflop is a cache hit). The display now shows preflop's perfectly valid settled odds while the banner still reads "The simulation hit an unexpected error and stopped updating. Re-deal, or navigate to another street, to try again" — the user followed that instruction, the odds updated, and the alert is now false. Because settled streets are the *common* navigation target after an error (that is the cache's whole purpose), the recovery path most likely to be taken is the one that never clears the error. The existing test ("disappears on the next successful run") only covers the cache-miss recovery path, which is why this escaped.
**Fix:** Clear the error on the cache-hit path too:
```tsx
const cached = useOddsStore.getState().getCached(street, revealedMask);
if (cached) {
  useOddsStore.getState().applySnapshot(cached);
  setErrorMessage(null); // cached settled odds are now on display — any prior run's error is moot
  return;
}
```
(If `react-hooks/set-state-in-effect` flags the synchronous call, clear it via the same pattern used for the miss path — e.g., queueMicrotask — but do not leave the banner uncleared.) Add a test: error on flop → rewind to cached preflop → `simulation-error` is absent.

### WR-02: Worker load failure / hard worker death is still a silent freeze — the original WR-02 scenario is only half fixed

**File:** `src/state/simulationService.ts:9-10`, `src/state/simulationService.ts:52`, `src/state/simulationService.ts:74-78`
**Issue:** The phase-1 WR-02 fix (try/catch around `api.runSimulation` → `onError` → visible banner) covers *rejected Comlink calls* — validation throws and exceptions inside the worker's message handler. It does not cover the failure mode the original finding led with: "script load failure in production". When the worker script fails to load (bad deploy, CSP, network) or the worker dies outright, the browser fires the Worker `error` event — which nothing listens to — and every pending Comlink promise simply never settles. `startSimulation` then hangs forever at `await cancelSimulation()` (line 52, notably *outside* the try block, so even a rejection there would bypass `onError` and become an unhandled rejection in App's `void startSimulation(...)`). Result: no `onError`, no banner, trial counter frozen at zero — for a probability-visualization tool, indistinguishable from "still converging". Every layer of the carefully-built error surfacing is bypassed because the error arrives on an event channel nobody subscribed to.
**Fix:** Surface worker-level errors at the module boundary and include the pre-try await inside the guarded region:
```ts
let currentOnError: ((message: string) => void) | null = null;

worker.addEventListener('error', (event) => {
  currentOnError?.(`Simulation worker failed: ${event.message || 'worker error'}`);
});
worker.addEventListener('messageerror', () => {
  currentOnError?.('Simulation worker failed: message deserialization error');
});

export async function startSimulation(conditioned, onProgress, onError): Promise<void> {
  currentOnError = onError;
  try {
    await cancelSimulation();          // moved inside try
    const requestId = ++lastRequestId;
    currentRequestId = requestId;
    currentOnProgress = onProgress;
    await api.runSimulation(conditioned, requestId, progressProxy);
  } catch (error) { /* existing requestId-gated onError */ }
  finally { /* existing cleanup */ }
}
```
(`currentOnError` needs the same generation discipline as `currentOnProgress`; the `error` event has no requestId, but "the worker is dead" is never stale information.)

## Info

### IN-01: remainingDeck entry validation still misses internal duplicates — half of phase-1 IN-06 remains open

**File:** `src/worker/simulationApi.ts:63-83`
**Issue:** The new guard checks length (line 65) and known-card overlap (lines 73-83), but not uniqueness *within* `remainingDeck`. A deck of the correct length, disjoint from known cards, but containing card Y twice (and therefore missing some card X entirely) passes validation and silently skews odds — Y can appear twice in one trial's table and X can never appear. This is exactly the "silently produce wrong probabilities" class the guard's own comment claims to close. Unreachable via `deriveConditionedState` (filters the unique `FULL_DECK`), so defense-in-depth only — but the guard exists precisely for callers that bypass that function.
**Fix:** One line alongside the overlap check: `if (new Set(remainingDeck).size !== remainingDeck.length) throw new Error('runSimulation: remainingDeck contains duplicate cards');`

### IN-02: The "singleton proxy avoids per-call MessageChannel" comment is factually wrong — the IN-08 port leak is unchanged, now hidden behind a confident comment

**File:** `src/state/simulationService.ts:16-35`
**Issue:** The block comment asserts "no new `MessageChannel`/port is ever created per `startSimulation()` call — the actual leak surface (T-02-04, IN-08) this behaviour was meant to close." Verified against the installed `comlink@4.4.2` dist (`comlink.mjs:15-21`): `proxyTransferHandler.serialize` runs on **every postMessage** that carries the proxy-marked value — `new MessageChannel()` + `expose(obj, port1)` per `api.runSimulation(...)` call, regardless of whether the marked callback is a module singleton. `Comlink.proxy()` only sets a marker symbol; channel allocation happens at serialization time, per call. The requestId-routing behavior is correct and the leak itself is out of v1 review scope (Comlink 4.4's FinalizationRegistry-based release also partially mitigates it), but a load-bearing comment claiming a closed leak surface that is demonstrably still open will misdirect the next person who profiles this.
**Fix:** Correct the comment: the singleton consolidates *routing* (one dispatch target, requestId-filtered) but a MessageChannel is still allocated per `runSimulation` call by Comlink's transfer handler; note that GC-driven release (Comlink `finalizer`) is the actual mitigation.

### IN-03: App.test.tsx fixtures still trip the store's own DEV consistency guard — phase-1 IN-01 unaddressed despite heavy edits to this file

**File:** `src/App.test.tsx:56-69`, `src/App.test.tsx:286-293`, `src/state/oddsStore.ts:58-77`
**Issue:** The climbing-counter fixtures (`categoryCounts: new Array(10).fill(0)` vs `trialsCompleted: 50/100`) and the error-recovery fixture (`trialsCompleted: 1`, zero category sum) violate the categoryCounts-sum invariant, so `checkSnapshotConsistency` fires `console.error` on every test run (`import.meta.env.DEV` is true under Vitest). This was flagged as IN-01 in the phase-1 review; the file gained ~200 lines this phase and the fixtures were not fixed. The suite passes only because the guard is report-only; escalating it to throw-in-dev (the natural hardening the ENG-04 comment invites) breaks these tests. The acceptance suite's fixtures (`App.acceptance.test.tsx:52`) show the correct pattern.
**Fix:** Make fixtures satisfy the invariant, e.g. `categoryCounts: [30, 20, 0, ...]` for `trialsCompleted: 50`, `[1, 0, ...]` for `trialsCompleted: 1`.

### IN-04: App.css now ships ~185 lines of dead phase-1 scaffold selectors to production

**File:** `src/App.css:1-184`, `src/App.tsx:2`
**Issue:** Phase 1's IN-02 noted `App.css` was dead because nothing imported it. Phase 2 added `import './App.css'` to App.tsx, which resurrects the entire file — including the scaffold selectors (`.counter`, `.hero`, `#next-steps`, `#docs`, `#spacer`, `.ticks`) that match no rendered element — into the production CSS bundle. The 02-05 comment acknowledges this ("unused dead code and all") and defers to Phase 3, so this is a tracked deferral, recorded here so it does not silently survive Phase 3.
**Fix:** Delete lines 1-184 (everything above the Phase 2 banner comment) when Phase 3 takes ownership of the visual layer — or now; nothing references those selectors.

### IN-05: `deriveConditionedState` has no explicit return type — its contract with `ConditionedState` is only structural luck

**File:** `src/engine/conditioning.ts:32`
**Issue:** The function that feeds the worker is typed by inference. It currently matches `ConditionedState` structurally, but any drift (e.g., someone widens `knownOpponentHoles` element typing, or `ConditionedState` gains a field) surfaces as a confusing error at the App call site — or worse, silently type-checks if the inferred shape stays assignable while semantically wrong. For the single most contract-critical function in the phase (D-02's sole authorized reader), the binding should be explicit.
**Fix:** `export function deriveConditionedState(...): ConditionedState { ... }` with `import type { ConditionedState } from './equity'` (no runtime cycle: equity.ts does not import conditioning.ts).

### IN-06: gameStore navigation/reveal actions have no store-level guard against a null runout

**File:** `src/state/gameStore.ts:86-94`
**Issue:** `advanceStreet`, `rewindStreet`, and `reveal` mutate `street`/`revealedMask` even when `runout === null`. The UI disables the buttons (`StreetControls` `noHand`, `HandDisplay` seat `disabled`), and App's effect no-ops on a null runout, so this is currently unreachable in production — but it is inconsistent with the codebase's own stated two-lines-of-defence philosophy (`pickerStore.setPick` documents a "store-level second line of defence" for the same class of UI-prevented misuse). A future caller (keyboard shortcut, replay feature) invoking these on an empty table would leave `street`/`revealedMask` desynced from the "no hand" state.
**Fix:** Early-return when `get().runout === null` in all three actions, mirroring the pickerStore pattern.

---

_Reviewed: 2026-08-24T07:19:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
