---
phase: 05-game-mode-shell-store-separation
reviewed: 2026-08-24T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/state/gameModeStore.ts
  - src/state/gameModeStore.test.ts
  - src/ui/GameModeSwitcher.tsx
  - src/ui/GameModeSwitcher.test.tsx
  - src/ui/BlackjackScene.tsx
  - src/App.tsx
  - src/App.css
  - src/App.modeSwitch.test.tsx
  - src/App.modeIsolation.test.tsx
  - src/App.modeSwitchRace.test.tsx
  - src/App.modeShell.guard.test.ts
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Phase 5 game-mode shell (gameModeStore, GameModeSwitcher, BlackjackScene placeholder, App mode fork with the mode-scoped odds effect) plus its four test suites and the source-shape guard. Cross-referenced against the unchanged modules the fork's correctness depends on: `simulationService.ts`, `streamingRunner.ts`, `oddsStore.ts`, `uiStore.ts`, `gameStore.ts`, `TableScene.tsx`, `AnimatedCard.tsx`, `FlipCard.tsx`, `useAnimationGate.ts`, `OddsPanel.tsx`, and `main.tsx` (StrictMode is enabled).

**Verified clean (adversarial probes that came back sound):**

- **Switch-away cancellation** — `mode` in the dependency array tears down the live-run effect instance; cleanup sets `ignore = true` before `cancelSimulation()`, and any run-owning effect instance always has a registered cleanup (early-return paths register none but also start nothing). No path leaves a live run or stale requestId after a switch-away. Worker-side, `streamingRunner`'s object-identity run tokens self-supersede, and `progressProxy`'s requestId filter drops late snapshots after `currentRequestId := -1`.
- **Gate drain on switch-away** — child-first effect destruction releases every `useAnimationGate`/`useExitGate` registration before App's cleanup runs; `pendingAnimationCount` reaches exactly 0 (confirmed by the non-vacuous real-motion race test).
- **No transient Hold'em flash in blackjack mode** — every JSX branch keys off the single subscribed `mode` value in one render; there is no path where both subtrees (or a CSS-hidden Hold'em tree) coexist.
- **Placeholder cannot touch simulationService** — `BlackjackScene` imports nothing; no gameStore action is reachable in blackjack mode; no cache key can be written while switched away (post-cancel snapshots are id-filtered and ignore-flagged before they could reach `cacheIfSettled`).
- **StrictMode double-invoke** — the double setup/cleanup/setup cycle on the odds effect is safe: worker supersession plus ignore flags prevent stale writes; only bounded dev-only wasted work.
- **Rapid-toggle re-entrancy** — same-tick toggles batch to a single (or zero) dependency change; no production code calls `setMode` from a cleanup; `setMode` with the current value produces no re-render (selector equality bail-out), so the "harmless no-op" claim holds.

**However**, the switch-BACK direction is broken. Phase 5 introduces a scenario Phase 3's animation-gate design explicitly assumed impossible — `TableScene` re-mounting with a dealt hand — and the two Critical findings below both fall out of that: the odds effect bypasses the animation gate on the first post-switch-back execution, and `TableScene`'s mount effect steals a card's gate unit on every re-mount. The phase's own real-motion race test exercises the first bug's exact mechanism (its top-of-file comment documents it as a "test-only" state-seeding trick) without recognizing that the production switch-back path has the identical shape.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Switch-back to Hold'em bypasses the animation gate — cached odds applied (or a live run started) while cards are mid-flight

**File:** `src/App.tsx:56` (gate check), `src/App.tsx:110` (dependency array)
**Issue:** The animation gate `if (pendingAnimationCount > 0) return;` uses the render-closure value. On the commit where `mode` flips back to `'holdem'` with a dealt hand, the render sees `pendingAnimationCount === 0` (nothing armed it — no gameStore action fired). In that same commit the entire card tree re-mounts; passive effects flush child-first, so every `AnimatedCard`/`FlipCard` registers with the gate (count = N) *before* App's odds effect runs — but the effect's closure still holds 0, so the gate check passes while N cards are mid-flight. Consequences under real motion (i.e., every real browser without reduced motion; the default test harness forces reduced motion, so no behavioral test can see this):
- **Cache hit:** the settled snapshot is applied immediately, violating the locked invariant quoted in this effect's own comment ("no cached snapshot may be applied, while any card describing that knowledge state is still mid-flight" — D-11/D-12, TBL-04).
- **Cache miss** (user switched away mid-run before settling): `useOddsStore.getState().reset()` zeroes the display and `startSimulation` launches mid-animation; the count change (0 → N−1) then re-runs the effect, which cancels that run milliseconds later — a start/cancel churn per switch-back, with a window for one streamed snapshot to land mid-flight before cancellation.

The Deal path is protected because `deal()` arms the gate synchronously *before* render, so the subscribed value is already >0 (the design the effect's lines 28–32 comment relies on). The mode switch-back has no synchronous arming, so that protection has no analogue. `App.modeSwitchRace.test.tsx:29-42` documents this exact closure-vs-registration window as the mechanism it uses to *construct* its race — production reaches the same window via a plain switcher click.
**Fix:** Add a live read as a *secondary* guard while keeping `pendingAnimationCount` in the dependency array. The 03-RESEARCH deadlock (gate never re-opening) only applies when a live read *replaces* the subscription; here the subscribed dep still re-triggers the effect on every drain step:
```tsx
// Subscribed dep still drives re-runs (03-RESEARCH); the live read guards the one commit where
// cards mounted in THIS flush registered after render but before this effect ran (mode switch-back).
if (pendingAnimationCount > 0 || useUiStore.getState().pendingAnimationCount > 0) return;
```

### CR-02: TableScene's release effect steals one gate unit on every re-mount with a dealt hand — gate opens one card early (two cards early in dev StrictMode)

**File:** `src/ui/TableScene.tsx:22-31` (defect activated by the Phase 5 fork in `src/App.tsx:166-171`)
**Issue:** `TableScene`'s effect calls `useUiStore.getState().endAnimation()` unconditionally, including on initial mount. Its own comment justifies this with "StrictMode dev-mode... double-invoke only simulates at a component's OWN initial mount, when pendingAnimationCount is always still 0 (nothing has been dealt yet)". Phase 5 falsifies that premise: switching blackjack → holdem re-mounts `TableScene` with `runout` non-null. Child-first effect ordering means the N re-mounting cards have already registered (count = N) when TableScene's mount effect fires and decrements a unit that no gameStore action armed — count = N−1 with N cards in flight. The gate therefore reaches 0 while the last-staggered card is still animating: odds un-dim and the cached snapshot applies (or a live run starts) one card early on *every* switch-back under real motion. In dev, StrictMode (enabled in `main.tsx`) double-invokes the effect — and since it registers no cleanup, that is *two* uncompensated `endAnimation()` calls, opening the gate two cards early. The clamp-at-0 prevents stranding but cannot prevent theft, exactly as `uiStore.ts`'s own resetAnimations comment warns ("the clamp prevents negatives, not cross-registration theft"). The race test's deliberately loose post-return assertion (`afterReturn >= 0`, `App.modeSwitchRace.test.tsx:137-140`) passes right through this.
**Fix:** Release only when the deps actually *changed*, using a previous-values ref (StrictMode-safe — both double-invocations see equal values; a fresh re-mount initializes the ref from current values and skips):
```tsx
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
Note: fixing CR-01 alone does not fix this — the stolen unit still opens the gate one card early for every *subsequent* effect execution; fixing CR-02 alone does not fix CR-01's first-execution bypass. Both are required.

## Warnings

### WR-01: Stale error banner re-mounts — and re-announces via role="alert" — on switch-back, persisting for the whole re-mount animation

**File:** `src/App.tsx:127-142` (banner), `src/App.tsx:38` (state)
**Issue:** `errorMessage` is not cleared when leaving Hold'em. If a run errored, the banner text ("...stopped updating. Re-deal, or navigate...") survives the blackjack dwell and re-renders the instant the user switches back — describing a run that the mode switch itself deliberately cancelled. Because clearing only happens once the gate opens (cache-hit microtask at `src/App.tsx:73`, or the first `onProgress` at line 91), under real motion the stale banner sits on screen for the full re-mount animation (~1s). Worse, re-mounting an element with `role="alert"` re-*announces* it to screen readers — a fresh, spurious error announcement on every switch-back after any historical error. This is the same "banner no longer describes what's on screen" class the project already fixed once as 02-REVIEW WR-01.
**Fix:** Clear the error when mode leaves `'holdem'`, mirroring the existing microtask discipline:
```tsx
useEffect(() => {
  if (mode !== 'holdem') queueMicrotask(() => setErrorMessage(null));
}, [mode]);
```
(Or clear it in the odds effect's mode-gate branch before the early return.)

### WR-02: Switch-back replays the entire deal choreography, contradicting the phase's own "instant DOM swap / no new animation" spec

**File:** `src/App.tsx:166-172`; spec at `.planning/phases/05-game-mode-shell-store-separation/05-UI-SPEC.md:236` and D-07 in `05-CONTEXT.md:30`
**Issue:** 05-UI-SPEC locks "Switching modes is an instant DOM swap (unmount one scene, mount the other) — no transition... this phase adds no new animation," and D-07 promises "returning shows the exact table left behind." In reality, every `AnimatedCard` re-mounts with `initial={{x: origin.x, y: origin.y, opacity: 0}}` and replays the full 300ms/80ms-stagger deck fly-in, and every revealed `FlipCard` replays its flip — a ~1s re-deal performance (with dimmed odds) before the "exact table left behind" is visible. The race test acknowledges the re-registration ("the same real cards mount again and register again under real motion") but no design artifact blesses the replay. This is also the mechanism that arms the gate CR-01/CR-02 then mishandle.
**Fix:** Decide explicitly: either (a) amend 05-UI-SPEC to bless replay-on-return as the intended behavior (in which case CR-01/CR-02 fixes make it at least gate-correct), or (b) suppress entrance animation on mode-return re-mounts (e.g., thread a "resume, don't deal" signal so `AnimatedCard` renders with `initial={false}` when the mount was caused by a mode flip rather than a deal/street change). Option (a) is the cheaper honest fix; option (b) matches the spec as written.

### WR-03: Fork shape is leak-prone and will trap Phase 6 — five repeated inline `mode === 'holdem'` guards plus Hold'em-scoped local state in the cross-game shell

**File:** `src/App.tsx:118, 127, 145, 161, 166` (guards); `src/App.tsx:38-41` (`errorMessage`, `scenarioOpen`)
**Issue:** Every Hold'em-only region carries its own inline `mode === 'holdem' &&` guard. A future Hold'em-only sibling added without its guard silently renders in blackjack mode — no compile-time signal, and the only safety nets are two manually-synced testid arrays that have *already diverged* (12 entries in `App.modeSwitch.test.tsx:39-52` vs 29 in `App.modeIsolation.test.tsx:87-117`), so a new testid missing from both lists is unprotected. Additionally, `errorMessage` and `scenarioOpen` are Hold'em-scoped state living in the cross-game App shell; Phase 6's Blackjack tree will need its own error/odds surface and either collides with these or forces the refactor then, under more pressure. The mode-scoped odds effect will face the same crowding when a second (Blackjack) simulation effect arrives.
**Fix:** Extract the Hold'em branch (its five JSX regions, the odds effect, `errorMessage`, `scenarioOpen`) into a `<HoldemGame />` component and reduce App to a single structural fork — `{mode === 'holdem' ? <HoldemGame /> : <BlackjackScene />}` plus the switcher. Leakage becomes structurally impossible (an unguarded sibling cannot exist outside its mode's component), the mode-scoped effect's mode gate becomes mount-scoped for free, and Phase 6 gets an obvious symmetric slot. Note the guard test's literal-string pins (`if (mode !== 'holdem') return;`, `pendingAnimationCount, mode]` in `App.modeShell.guard.test.ts:151-167`) must be amended in the same commit per that file's standing rule.

## Info

### IN-01: Stale "checked FIRST" comment on the animation gate

**File:** `src/App.tsx:51-56`
**Issue:** Two adjacent guards both carry comments claiming they are "checked FIRST" — the mode gate (line 43, correct) and the animation gate (line 51, now second; its "FIRST" referred to the pre-Phase-5 ordering relative to the cache-hit branch).
**Fix:** Reword the animation-gate comment to "checked before the cache-hit branch below" so the two comments stop contradicting each other.

### IN-02: Vacuous absence assertions and duplicated testid lists across the mode-switch suites

**File:** `src/App.modeSwitch.test.tsx:39-52, 133-155`
**Issue:** The D-04 sweep in this file asserts absence without first proving presence and never deals or opens the picker, so at least `card-picker` (picker never opened) and `board-cards` (pre-deal renders `board-empty-state` instead) are vacuously absent-before-and-after. The rigorous presence-guarded sweep lives in `App.modeIsolation.test.tsx`, whose `HOLDEM_ONLY_TESTIDS` list (29 entries) has already diverged from this file's (12 entries) — a maintenance drift the guard-style comments elsewhere in this phase try hard to prevent.
**Fix:** Either share one exported testid fixture between the two files, or drop the weaker unguarded sweep from `App.modeSwitch.test.tsx` in favor of the isolation file's presence-guarded version.

### IN-03: The "harmless no-op" store test doesn't verify no-op-ness

**File:** `src/state/gameModeStore.test.ts:21-24`
**Issue:** The test only re-reads the value after `setMode('holdem')`; it would pass even if the redundant set caused spurious subscriber notifications/re-renders. The actual no-op property (selector equality bail-out prevents re-renders) is untested.
**Fix:** Subscribe a spy via `useGameModeStore.subscribe` and assert the *selected* `mode` slice is unchanged (or assert render count stability in the `GameModeSwitcher` suite after clicking the active button).

---

_Reviewed: 2026-08-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
