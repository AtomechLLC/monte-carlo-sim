---
phase: 03-casino-table-ui-animation
reviewed: 2026-08-24T05:30:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - index.html
  - package.json
  - public/favicon.svg
  - src/App.acceptance.test.tsx
  - src/App.css
  - src/App.phase3.acceptance.test.tsx
  - src/App.test.tsx
  - src/App.tsx
  - src/index.css
  - src/state/gameStore.test.ts
  - src/state/gameStore.ts
  - src/state/uiStore.test.ts
  - src/state/uiStore.ts
  - src/test/setup.ts
  - src/ui/AnimatedCard.tsx
  - src/ui/BoardDisplay.test.tsx
  - src/ui/BoardDisplay.tsx
  - src/ui/CardBack.tsx
  - src/ui/FlipCard.test.tsx
  - src/ui/FlipCard.tsx
  - src/ui/HandDisplay.tsx
  - src/ui/OddsPanel.tsx
  - src/ui/OddsTable.tsx
  - src/ui/PlayingCard.test.tsx
  - src/ui/PlayingCard.tsx
  - src/ui/Seat.test.tsx
  - src/ui/Seat.tsx
  - src/ui/TableScene.test.tsx
  - src/ui/TableScene.tsx
  - src/ui/WinTieLossDisplay.tsx
  - src/ui/tableGeometry.test.ts
  - src/ui/tableGeometry.ts
  - src/ui/useAnimationGate.test.ts
  - src/ui/useAnimationGate.ts
  - tsconfig.app.json
findings:
  critical: 3
  warning: 2
  info: 5
  total: 10
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-24T05:30:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Phase 3's card art, felt composition, geometry math, and the *deal/flip* halves of the TBL-04 animation gate are sound. The synchronous-arm-in-action / release-in-`TableScene` pairing is correctly balanced for deal, advance, rewind, and reveal; no-op navigation never arms; `useAnimationGate`'s register/complete/unmount lifecycle is idempotent and StrictMode-safe (verified against `main.tsx`'s active `<StrictMode>`); the T-03-12 reveal-leak guard genuinely keeps hidden faces out of the DOM; and the reduced-motion path is coherent end-to-end (Motion queries the boolean `(prefers-reduced-motion)` form, which the test polyfill matches).

The **exit-gate half is broken**. `useExitGate` + `BoardDisplay`'s `AnimatePresence` wiring has three distinct, provable gate-stranding paths, each of which leaves `pendingAnimationCount` permanently above zero in any non-reduced-motion browser. Because `App.tsx`'s odds effect early-returns while the counter is armed, and because nothing in production ever calls `resetAnimations()`, every one of these paths freezes the odds panel at em dashes **forever — no deal, navigation, or reveal recovers; only a page reload does**. This is precisely the "gate stranding/deadlock" failure mode the phase was designed to prevent (D-10). All 203 tests pass because `src/test/setup.ts` forces reduced motion globally, which sets `enabled = false` on `useExitGate` in every App-level test, and the hook-level suite never simulates these three sequences. Two of the three findings are confirmed against the installed `framer-motion` `AnimatePresence` source, not inferred.

Prior review debt: 02-REVIEW WR-01 (stale error banner on cache hit) is **verified fixed** at `src/App.tsx:51-62` with a locking regression test (`src/App.test.tsx:690-721`). WR-02 (unsubscribed Worker error event) remains known-open and tracked; not re-derived here.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Rewinding to pre-flop strands the exit gate — odds frozen permanently

**Status:** FIXED in `e0512f3` (2026-08-24). `BoardDisplay` now passes `enabled = !reduce && visibleBoard.length > 0` (the recommended fix — the alternative of keeping `<AnimatePresence>` mounted at preflop was rejected to preserve the locked board-cards-absent-at-preflop test contract), so the 3 → 0 drop never arms. Additionally, `useExitGate` now releases any pending hold when `enabled` flips false, closing the overlapping variant (turn → flop arms a hold, then flop → preflop empties the board and destroys the still-exiting child inside the 150ms window — a path the enabled-guard alone would have left stranded until the next user action). Rewind-to-preflop remains the instant unmount it always visually was; partial rewinds keep the D-12 exit unchanged. Hook-level regression tests (enabled path) added in `useAnimationGate.test.ts`.

**File:** `src/ui/BoardDisplay.tsx:52-66` (with `src/ui/useAnimationGate.ts:117-120`)
**Issue:** On a flop → preflop rewind, `visibleBoard.length` drops 3 → 0, so `BoardDisplay`'s ternary (line 57) renders `board-empty-state` and **unmounts the entire `<AnimatePresence>` in that same commit**. `useExitGate`'s effect then runs post-commit, sees `0 < 3`, and arms a gate hold (`useAnimationGate.ts:117-120`) — but the `onExitComplete` callback that is its only release path belongs to a component that no longer exists. No exit ever plays, `releaseExitGate` is never called, `BoardDisplay` never unmounts (so the unmount safety net never fires), and a subsequent `deal()` takes the resetKey branch which re-baselines *without* releasing. `pendingAnimationCount` is stuck at ≥ 1 for the life of the page: the odds panel shows em dashes and `aria-busy` forever, and `App.tsx:43` early-returns on every future navigation. Reproduction is three ordinary clicks in any full-motion browser: Deal → Advance → Rewind. Every test passes because the global reduced-motion polyfill sets `enabled = false` on this exact code path.
**Fix:**
```tsx
// BoardDisplay.tsx — never arm an exit hold when the drop empties the board: the
// ternary unmounts <AnimatePresence> in the same commit, so no exit plays and
// onExitComplete can never fire.
const releaseExitGate = useExitGate(
  visibleBoard.length,
  !reduce && visibleBoard.length > 0,
  dealNonce,
);
```
(Alternative: keep `<AnimatePresence>` mounted even when the list is empty so rewind-to-preflop actually plays the spec'd exit — but that requires renegotiating the "board-cards absent at pre-flop" test contract at `src/App.test.tsx:687` and `src/TableScene.test.tsx` empty-board coverage.) Add a `renderHook` regression test: `rerender({ count: 0 })` with the container-unmounted semantics must leave the count at 0.

### CR-02: `useExitGate` double-arms on overlapping rewinds and leaks its hold across a re-deal — single release, permanent +1

**Status:** FIXED in `aff5672` (2026-08-24). (a) The arm is guarded with `!pendingRef.current` — at most one hold per exiting epoch, matching AnimatePresence's fire-once `onExitComplete` semantics. (b) The resetKey branch now releases any pending hold before re-baselining. Both applied exactly as suggested; hook-level regression tests (overlapping drops → single release → 0; resetKey change while pending → 0) added.

**File:** `src/ui/useAnimationGate.ts:103-121` (arming) and `104-110` (resetKey branch)
**Issue:** Two accounting flaws in the same effect. **(a)** When `count` drops twice before the first exit finishes (river → turn, then turn → flop within the 150ms exit window — an ordinary double-click on Rewind), the effect calls `beginAnimation()` a second time while `pendingRef.current` is already `true`. Two units are armed, but the hold is tracked by a single boolean, and the installed `AnimatePresence` fires the user-level `onExitComplete` exactly **once** when its whole exiting set drains (`framer-motion/dist/es/components/AnimatePresence/index.mjs:171-181` — `isEveryExitComplete` check). Even if it fired twice, the `pendingRef` idempotency guard at lines 133-138 would block the second release. Net: +1 stranded forever. **(b)** When `resetKey` changes while a hold is pending (user clicks Deal during a rewind-exit), the reset branch (lines 104-110) re-baselines and returns without releasing — `pendingRef` stays `true`, the armed unit stays in the store, and the re-keyed `AnimatePresence` discards the old exiting children so their completion can never fire. Both paths end in the same permanent odds freeze as CR-01.
**Fix:**
```ts
useEffect(() => {
  if (prevResetKeyRef.current !== resetKey) {
    prevResetKeyRef.current = resetKey;
    prevCountRef.current = count;
    // The re-keyed presence tree discards the old exiting children — their
    // onExitComplete can never fire, so release any pending hold here.
    if (pendingRef.current) {
      pendingRef.current = false;
      useUiStore.getState().endAnimation();
    }
    return;
  }
  const previous = prevCountRef.current;
  prevCountRef.current = count;
  if (!enabled) return;
  if (count < previous && !pendingRef.current) {
    useUiStore.getState().beginAnimation();
    pendingRef.current = true;
  }
}, [count, enabled, resetKey]);
```

### CR-03: Interrupted exit (rewind then re-advance within the exit window) never fires `onExitComplete` — hold stranded

**Status:** FIXED in `d1e7ac4` (2026-08-24). A count rise while a hold is pending now releases it, exactly as suggested (the rise means the exit was superseded by re-entry and the departing card is back on the board). The release runs BEFORE the `enabled` guard so it also fires if reduced motion flips on mid-exit. Combined with CR-01/CR-02 the hold lifecycle is closed under every count trajectory — the closed-lifecycle contract (5 release paths) is now documented on the hook itself. Regression test: rewind → advance → rewind at the hook level with no release callback invoked ends at 0 and re-arms cleanly.

**File:** `src/ui/useAnimationGate.ts:96-139` (contract) via `src/ui/BoardDisplay.tsx:66` (wiring)
**Issue:** `useExitGate`'s doc comment claims interruption safety via the unmount cleanup, but the interruption that actually occurs in this app does not unmount anything: rewind river → turn arms a hold and starts `community-4`'s exit; clicking Advance within the 150ms window re-adds the same key, and `AnimatePresence` **deletes the re-entering child from its exit-tracking map without invoking the user's `onExitComplete`** — verified in the installed source (`framer-motion/dist/es/components/AnimatePresence/index.mjs:98-101`: `exitComplete.delete(key); exitingComponents.current.delete(key)` on re-entry; the user callback's only invocation site is inside a completing child's `onExit`, lines 160-182). The count then rises (4 → 5), which `useExitGate` treats as a no-op, so the hold has no remaining release path: `pendingAnimationCount` stays ≥ 1 permanently, freezing the odds exactly as in CR-01. The hook's design assumption ("AnimatePresence always eventually fires onExitComplete") is false for cancelled exits, and this is long-standing documented Motion behavior, not a version quirk.
**Fix:** Release the hold when `count` rises while pending — a rise means the exit was superseded by re-entry and the departing card is back on the board, so there is nothing left to wait for:
```ts
if (count > previous && pendingRef.current) {
  // Exit superseded by re-entry: AnimatePresence drops the child from its
  // exit-tracking map without firing onExitComplete — release the hold here.
  pendingRef.current = false;
  useUiStore.getState().endAnimation();
}
```
Combined with CR-02's guarded arm, this makes the hold's lifecycle closed under every count trajectory. Add a `renderHook` test: `rerender({ count: 4 })` then `rerender({ count: 5 })` with no release callback invoked must end at count 0.

## Warnings

### WR-01: The documented "re-deal safety valve" does not exist — no production recovery from a stranded gate

**Status:** FIXED in `751ee47` (2026-08-24) via option (b): the CR-01/02/03 fixes close the hold lifecycle structurally, the misleading "re-deal safety valve" claim is deleted, and `resetAnimations`' doc now states it is test-only, explains why a naive `deal()` call would be unsafe (cross-registration theft: old cards' unmount cleanups would decrement units armed after the reset), and records what a real valve would require (generation-aware registrations). A timer-based watchdog was considered and deliberately NOT added: the gate is now un-strandable by construction (every arm has exactly one guaranteed release path), and a force-release timer would risk masking future accounting bugs and firing during legitimately long choreography (the ~860ms deal stagger) — defense-in-depth here would trade a solved deadlock for a new race.

**File:** `src/state/uiStore.ts:17` (claim) vs `src/state/gameStore.ts:82-91` (reality)
**Issue:** `resetAnimations()`'s doc comment states it is "used by tests and as a re-deal safety valve," but no production code path ever calls it — `deal()` only arms (`beginAnimation()`) and clears the odds cache. The claimed last-line-of-defense against exactly the CR-01/02/03 class of failure was documented but never wired, and the comment will mislead future maintainers into believing recovery exists. Note that naively calling `resetAnimations()` inside `deal()` is **not** safe as-is: old in-flight cards' unmount cleanups run in the re-deal commit and would then decrement units armed *after* the reset (the clamp prevents negatives, not cross-registration theft), letting the gate open before the new deal's cards finish registering.
**Fix:** Either (a) implement a real safety valve — e.g. `deal()` calls `resetAnimations()` *and* the release paths (`endAnimation` callers in `useAnimationGate`/`useExitGate`/`TableScene`) are made generation-aware (tag registrations with `dealNonce` and drop releases from a stale generation), or (b) fix the CR items above, delete the "re-deal safety valve" claim from the comment, and document that correctness relies solely on balanced arm/release accounting.

### WR-02: TypeScript strict mode is not enabled — this phase's nullability contracts are compiler-unenforced

**File:** `tsconfig.app.json:2-24`
**Issue:** `compilerOptions` contains no `"strict": true` (and no `strictNullChecks`), and the file extends nothing. Pre-existing since the Phase 1 scaffold (confirmed identical at diff base `43aee17` apart from the `types` addition), but Phase 3 materially raised the stakes: the T-03-12 leak guard is expressed entirely through nullable types — `FlipCard`'s "`card` MUST be undefined while the seat is hidden," `heroHole: readonly [Card, Card] | undefined`, `hole?.[slotIndex]`. Without `strictNullChecks`, `undefined`/`null` assignability is not checked, so a future call site passing a real `Card` where the contract demands `undefined`, or dereferencing `runout` without a guard, compiles clean and only fails (or leaks) at runtime. `tsc -b` passing is currently weak evidence for exactly the class of bug this phase's contracts guard against.
**Fix:** Add `"strict": true` to `tsconfig.app.json` (and the worker/node configs), then fix the fallout. If full strict is too large a diff for one pass, enable `"strictNullChecks": true` first — it carries nearly all of the value for these contracts.

## Info

### IN-01: `formatPct` duplicated verbatim across two components

**File:** `src/ui/OddsTable.tsx:5-10` and `src/ui/WinTieLossDisplay.tsx:4-9`
**Issue:** Identical function (including the identical doc comment about reusing the em-dash literal) maintained in two files; this phase's change (the `pending` short-circuit) had to be applied twice, and the next change will too.
**Fix:** Extract to a shared module (e.g. `src/ui/formatPct.ts`) or co-locate both displays' formatting in one place.

### IN-02: Phase 1 scaffold CSS is now fully dead — the assets it styled were deleted this phase

**File:** `src/App.css:1-184`
**Issue:** `.counter`, `.hero` (`.base`/`.framework`/`.vite`), `#center`, `#next-steps`, `#docs`, `#spacer`, `.ticks` have no consumers in `src/` (verified by search), and this phase deleted the images they styled (`src/assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg`). The Phase 2 comment justifying their retention ("Phase 1 scaffold selectors ... left exactly as they were") no longer holds — the scaffold markup and assets are gone.
**Fix:** Delete lines 1-184 (everything above the Phase 2 conformance banner).

### IN-03: `errorMessage` stores a string whose content is never rendered

**File:** `src/App.tsx:32, 87-90, 114-118`
**Issue:** The state holds the worker's error message, but the banner always renders the `SIMULATION_ERROR_MESSAGE` constant; the actual message reaches the user only via `console.error`. The string-typed state reads as if the message were displayed, which misleads at the call site.
**Fix:** Either render `errorMessage` (or include it as secondary detail), or change the state to `hasSimulationError: boolean` and keep the message purely in the log.

### IN-04: `"node"` types exposed to browser-app code

**File:** `tsconfig.app.json:7`
**Issue:** `"types": ["vite/client", "node"]` (added this phase for `PlayingCard.test.tsx`'s `node:fs` asset-existence check) makes Node globals (`process`, `Buffer`, `__dirname`, ...) typecheck in *all* app code under `src/`, so a stray `process.env.X` in a component compiles clean and crashes in the browser.
**Fix:** Keep the app config browser-only and scope Node types to the one test that needs them (e.g. a `/// <reference types="node" />` triple-slash directive at the top of `src/ui/PlayingCard.test.tsx`, or a separate tests tsconfig).

### IN-05: matchMedia polyfill matches on substring, inverting for the `no-preference` query form

**File:** `src/test/setup.ts:37-50`
**Issue:** `matches: query.includes('prefers-reduced-motion')` returns `true` for **any** reduced-motion query, including `'(prefers-reduced-motion: no-preference)'` — which semantically means reduced motion is OFF. It works today only because the installed Motion queries the boolean form `"(prefers-reduced-motion)"` (verified in `motion-dom/dist/es/render/utils/reduced-motion/index.mjs:9`); a Motion upgrade that switches query form would silently flip every test to full-motion.
**Fix:** Match precisely: `matches: query === '(prefers-reduced-motion)' || query.includes('prefers-reduced-motion: reduce')`.

---

_Reviewed: 2026-08-24T05:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
