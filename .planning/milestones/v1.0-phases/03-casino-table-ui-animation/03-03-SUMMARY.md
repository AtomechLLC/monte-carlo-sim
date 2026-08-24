---
phase: 03-casino-table-ui-animation
plan: 03
subsystem: ui
tags: [react, motion, framer-motion, zustand, animation-gate, useSyncExternalStore, accessibility]

# Dependency graph
requires:
  - phase: 03-casino-table-ui-animation (plan 01)
    provides: PlayingCard/CardBack card-code-to-art bridge, card-slot width tokens
  - phase: 03-casino-table-ui-animation (plan 02)
    provides: TableScene/Seat/OddsPanel composition, felt geometry percentages in App.css,
      --z-in-flight token (declared but unused until this plan)
provides:
  - "motion@13.1.1 installed and wired via MotionConfig reducedMotion=\"user\" (D-09)"
  - "uiStore: pendingAnimationCount — a clamped counter (never a boolean) armed synchronously
    and conditionally by gameStore's four navigation actions"
  - "useAnimationGate: registration/completion/unmount-safe gate participation for any animated
    element, reflected via useSyncExternalStore"
  - "AnimatedCard: motion.span flying a card from the deck to its slot in A3 dealer rotation"
  - "tableGeometry: POSITIONS/dealOriginOffset/dealIndex against a locked 760x475 reference felt"
  - "App's odds effect structurally gated on pendingAnimationCount on BOTH the live-simulation
    and settled-cache branches (TBL-04); OddsPanel/WinTieLossDisplay/OddsTable show a pending
    em-dash/aria-busy state while any card is in flight"
affects: [03-04 (board-card deal/street-advance/rewind choreography reuses AnimatedCard and
  tableGeometry's community-N position keys), 03-05/03-06 (reveal-flip animation and the human
  visual-verification checkpoint build on this gate)]

# Tech tracking
tech-stack:
  added: [motion@13.1.1]
  patterns:
    - "Animation-gate counter (uiStore.pendingAnimationCount): armed synchronously inside the
      SAME set() transaction as the state change that requires an animation, conditionally
      (never on a clamped no-op), released once per commit by the nearest common ancestor of
      every animated card (TableScene) plus once per individual card's own registration/
      completion — a belt-and-suspenders design so every navigation action is gate-safe even
      before its own choreography is wired (advanceStreet/rewindStreet/reveal all arm+release
      cleanly today despite animating nothing yet in this plan)"
    - "useSyncExternalStore instead of useState-in-effect for a hook that must reflect external
      registration state in render: this project's locked eslint config
      (reactHooks.configs.flat.recommended) enables react-hooks/set-state-in-effect as an error,
      which flags any setState call inside a useEffect body — useSyncExternalStore is React's
      own sanctioned escape hatch for exactly this synchronize-with-an-external-system case"
    - "Keyed by `${seatKey}-${slotIndex}-${dealNonce}` (both React key and AnimatedCard's own
      animationKey prop), never by card identity — a re-deal fully unmounts/remounts rather than
      Motion retargeting an in-flight card into a different card"
    - "Pre-deal/pre-hand placeholder slots stay plain (non-animated) spans; AnimatedCard only
      mounts once there is an actual card to fly in, so the gate never arms on page load"

key-files:
  created:
    - src/state/uiStore.ts
    - src/state/uiStore.test.ts
    - src/ui/tableGeometry.ts
    - src/ui/tableGeometry.test.ts
    - src/ui/useAnimationGate.ts
    - src/ui/useAnimationGate.test.ts
    - src/ui/AnimatedCard.tsx
  modified:
    - src/state/gameStore.ts
    - src/state/gameStore.test.ts
    - src/test/setup.ts
    - src/ui/Seat.tsx
    - src/ui/Seat.test.tsx
    - src/ui/HandDisplay.tsx
    - src/ui/TableScene.tsx
    - src/App.tsx
    - src/App.css
    - src/App.test.tsx
    - src/App.acceptance.test.tsx
    - src/ui/OddsPanel.tsx
    - src/ui/OddsTable.tsx
    - src/ui/WinTieLossDisplay.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Used the arithmetic delay fallback (0.08 * dealIndex) instead of Motion's stagger() helper:
    stagger() returns a DynamicOption<number> ((i, total) => number) which only typechecks
    against transition.delayChildren (parent variant orchestration), not a single element's own
    transition.delay (plain number) — confirmed by reading motion-dom's own .d.ts. Each
    AnimatedCard mounts independently (no shared staggerChildren parent), so the fallback is not
    just a typecheck workaround but the mechanically correct choice."
  - "TableScene's release effect has NO compensating cleanup, by design: React StrictMode's
    dev-only mount->cleanup->mount double-invoke only simulates at a component's OWN initial
    mount, when pendingAnimationCount is always still 0 (nothing dealt yet) — the clamp-at-0
    absorbs the extra call harmlessly. A compensating cleanup was tried and reverted: it
    introduced a permanent +1 drift on every LATER real transition, since those are single
    (non-doubled) cleanup-then-setup cycles, not phantom StrictMode ones."
  - "useAnimationGate reflects `pending` via useSyncExternalStore, not useState-in-effect: this
    project's eslint config enables react-hooks/set-state-in-effect as an error, which flagged
    every setState-in-effect shape tried (including a derived-registeredKey variant). Verified
    functionally identical via the hook's own 5-test suite plus the full App-level regression
    suite."
  - "AnimatedCard's className prop carries the SAME card-slot/card-slot--hero(--opponent) classes
    the plain placeholder span used pre-03-03, replacing it as the width-owning box (rather than
    nesting AnimatedCard inside an extra wrapper span) — .card-slot's CSS is tag-agnostic so this
    required no new CSS rule for width/display, only the new z-index rule."

patterns-established:
  - "Deviation-safe StrictMode reasoning for release-only effects: verify whether the phantom
    double-invoke can ever observe a non-zero/non-baseline value before adding a compensating
    cleanup — a cleanup that's correct for the phantom case can be actively wrong for the real
    one."

requirements-completed: [TBL-03, TBL-04]

# Metrics
duration: ~40min
completed: 2026-08-24
---

# Phase 3 Plan 03: Deal Choreography and the Animation Gate Summary

**Motion 13.1.1 installed; eight hole cards fly from the deck in A3 dealer rotation via a new `AnimatedCard`/`useAnimationGate` primitive, and the odds effect (both its live-simulation and settled-cache branches) is structurally gated on a `pendingAnimationCount` counter so no odds number can ever describe a card the user hasn't seen land yet — 172/172 tests green (150 baseline + 22 new), zero regressions.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-24
- **Tasks:** 3 completed (all TDD: RED test commit then GREEN implementation commit per task)
- **Files modified/created:** 23 (7 new: uiStore.ts/.test.ts, tableGeometry.ts/.test.ts, useAnimationGate.ts/.test.ts, AnimatedCard.tsx; 16 modified)

## Accomplishments

- Installed `motion@13.1.1` (verified: no `postinstall` script, official `motiondivision/motion` repo, resolved version matches the pin exactly)
- Built `uiStore.pendingAnimationCount` — a clamped counter armed synchronously and conditionally by `gameStore`'s `deal`/`advanceStreet`/`rewindStreet`/`reveal`, so a clamped no-op navigation (e.g. `advanceStreet()` at `river`) can never arm a count nothing will release
- Built `tableGeometry.ts` (deck-origin pixel offsets + A3 dealer-rotation ordering against a locked 760x475 reference felt, derived from the exact percentages/card-dimension tokens committed in 03-02's CSS) and `useAnimationGate.ts` (registration/completion/unmount-safe gate participation, reflected via `useSyncExternalStore` rather than `useState`-in-effect to satisfy this project's `react-hooks/set-state-in-effect` lint rule)
- Built `AnimatedCard.tsx` — a `motion.span` that flies a card from the deck to its slot with an 80ms-per-card arithmetic stagger, honouring `useReducedMotion()`, and wired it into `Seat.tsx` for both hero and opponent hole cards, keyed by slot+`dealNonce` (never card identity) so a re-deal always fully unmounts/remounts
- `TableScene` now releases the one gate unit each navigation action armed, once per commit, after every descendant card has registered (React's child-first passive-effect flush order) — the safety net that keeps `advanceStreet`/`rewindStreet`/`reveal` gate-safe even though their own choreography isn't wired until later plans
- Gated `App`'s odds effect on `pendingAnimationCount` FIRST — above the cache-hit lookup, not below it — so a rewind to an already-settled street also waits for the gate; `WinTieLossDisplay`/`OddsTable` render the pending em dash and `OddsPanel` exposes `aria-busy` + a dimmed visual state while any card is in flight
- Verified end-to-end: 172/172 tests pass (150 baseline + 22 new), `tsc -b` clean, `eslint .` clean, production build succeeds, dev server serves the app without error (structural verification only — no browser/computer-use tool was available to this executor; full visual/animation verification is explicitly deferred to the 03-06 human checkpoint per the plan's own text)

## Task Commits

1. **Task 1: Install Motion and build the animation-gate state layer** - `85811c4` (test, RED) → `0d9f289` (feat, GREEN)
2. **Task 2: Deal choreography — cards fly from the deck in dealer rotation** - `572cb34` (test, RED) → `4ed7b4f` (feat, GREEN)
3. **Task 3: Gate the odds effect and show the pending state** - `37efcca` (test, RED) → `9b559c9` (feat, GREEN)

_Each task followed RED (failing test commit) then GREEN (implementation commit); no REFACTOR commits were needed — no task required a cleanup pass beyond what GREEN already produced._

## Files Created/Modified

- `src/state/uiStore.ts` / `.test.ts` - `pendingAnimationCount` counter with clamped begin/end/reset
- `src/state/gameStore.ts` / `.test.ts` - Four navigation actions arm the gate synchronously and conditionally
- `src/test/setup.ts` - `matchMedia` polyfill forcing `prefers-reduced-motion: reduce` in tests (deterministic jsdom harness)
- `src/ui/tableGeometry.ts` / `.test.ts` - Deck-origin offsets + A3 dealer-rotation ordering
- `src/ui/useAnimationGate.ts` / `.test.ts` - Registration/completion/unmount-safe gate hook
- `src/ui/AnimatedCard.tsx` - Motion wrapper flying a card from the deck to its slot
- `src/ui/Seat.tsx` / `.test.ts` - Hero + opponent hole-card slots wired through `AnimatedCard`
- `src/ui/HandDisplay.tsx` - Passes `dealNonce` down to `Seat`
- `src/ui/TableScene.tsx` - Releases the one gate unit armed per commit
- `src/App.tsx` - `MotionConfig reducedMotion="user"`; odds effect gated on `pendingAnimationCount`
- `src/App.css` - `.card-in-flight`/`.card-slot` z-index, `.odds-panel--pending` opacity
- `src/App.test.tsx` / `src/App.acceptance.test.tsx` - `resetStores()` also resets the animation counter; 4 new gate-regression tests
- `src/ui/OddsPanel.tsx` / `OddsTable.tsx` / `WinTieLossDisplay.tsx` - Pending em-dash/`aria-busy` state
- `package.json` / `package-lock.json` - `motion@13.1.1`

## Decisions Made

See `key-decisions` in frontmatter — arithmetic stagger fallback, no compensating cleanup on TableScene's release effect, `useSyncExternalStore` over `useState`-in-effect, and AnimatedCard directly carrying the `card-slot` classes as the width-owning box.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `Seat.test.tsx` for the new required `dealNonce` prop**
- **Found during:** Task 2, running `npx tsc -b`
- **Issue:** `Seat.tsx`'s `HeroSeatProps`/`OpponentSeatProps` gained a required `dealNonce: number` field (needed to key `AnimatedCard`). The pre-existing `Seat.test.tsx` (from plan 03-02, not in this plan's `files_modified` list) renders `<Seat>` directly with the old prop shape, so `tsc -b` failed with 8 "Property 'dealNonce' is missing" errors.
- **Fix:** Added `dealNonce={0}` or `dealNonce={1}` (matching each test's `hasHand`/dealt-state) to every `<Seat>` render call in `Seat.test.tsx`. No test assertions changed.
- **Files modified:** `src/ui/Seat.test.tsx`
- **Verification:** `npx tsc -b` exits 0; all 9 pre-existing `Seat.test.tsx` tests still pass unchanged.
- **Committed in:** `4ed7b4f` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] `react-hooks/set-state-in-effect` violation in `useAnimationGate.ts`**
- **Found during:** Task 2, running `npx eslint .`
- **Issue:** This project's eslint config enables the React Compiler's `react-hooks/set-state-in-effect` rule as an error. The initial `useAnimationGate` implementation (tracking `pending` via `useState`, set inside the registration effect) tripped this rule — first on the disabled early-return branch's `setPending(false)`, then (after removing that branch's call) on the registration branch's `setRegisteredKey(animationKey)` call.
- **Fix:** Rewrote the hook to reflect `pending` via `useSyncExternalStore` (a local ref + listener set, notified from inside the effect) instead of `useState`-in-effect — React's own documented mechanism for reflecting external-system state in render without the cascading-render risk the lint rule targets.
- **Files modified:** `src/ui/useAnimationGate.ts`
- **Verification:** `npx eslint .` exits 0; all 5 `useAnimationGate.test.ts` tests still pass with identical assertions (implementation detail only, no behavior change).
- **Committed in:** `4ed7b4f` (Task 2 GREEN commit)

**3. [Rule 1 - Bug] `key={\`${...` grep acceptance criterion required an inline template literal**
- **Found during:** Task 2, running the acceptance-criteria check `grep -c "key={\`\${" src/ui/Seat.tsx` (must be ≥1, containing `dealNonce`)
- **Issue:** The initial implementation computed `animationKey` into a local variable and passed `key={animationKey}` — functionally identical, but not a literal inline template, so the grep guard (checking that the key expression is visibly interpolated, not a card-code) returned 0.
- **Fix:** Inlined the template literal directly into both the `key` and `animationKey` JSX attributes (`` key={`${seatKey}-${slotIndex}-${dealNonce}`} ``), introducing a small `seatKey`/`HERO_SEAT_KEY` constant so the backtick is immediately followed by an interpolation, matching the grep pattern exactly.
- **Files modified:** `src/ui/Seat.tsx`
- **Verification:** `grep -c "key={\`\${" src/ui/Seat.tsx` returns 2; no functional change (same key values).
- **Committed in:** `4ed7b4f` (Task 2 GREEN commit)

**4. [Rule 1 - Bug] Reworded an `App.tsx` doc comment that was tripping its own acceptance-criteria grep**
- **Found during:** Task 3, running the acceptance-criteria check `grep -c "useUiStore.getState().pendingAnimationCount" src/App.tsx` (must be 0 — subscribed value only)
- **Issue:** A doc comment explaining why the effect must not read the store's live `getState()` snapshot literally contained the disallowed substring as an illustrative example, so the grep guard (designed to catch a real live-read regression) matched the comment instead.
- **Fix:** Reworded the comment to describe the same rationale without the literal disallowed substring.
- **Files modified:** `src/App.tsx`
- **Verification:** `grep -c "useUiStore.getState().pendingAnimationCount" src/App.tsx` now returns 0; no functional code change.
- **Committed in:** `9b559c9` (Task 3 GREEN commit)

---

**Total deviations:** 4 auto-fixed (1 blocking test-compile fix outside this plan's `files_modified` list, 1 lint-driven implementation rewrite, 2 comment/grep-matching fixes to satisfy the plan's own stated acceptance criteria). None changed scope or behavior beyond what Tasks 1-3 already specified.
**Impact on plan:** None on scope. All were necessary to make the plan's own acceptance criteria pass or to keep the pre-existing test suite compiling.

## Issues Encountered

- **No browser/computer-use tool available to this executor:** The plan's `<verification>` section calls for a manual `npm run dev` smoke check (click Deal, watch the stagger, toggle reduced motion). Despite the system prompt describing computer-use MCP tools generally, this executor's actual tool set (Read/Write/Edit/Bash/Grep/Glob) does not include them. Performed structural verification instead, matching the precedent set by 03-01/03-02: started the dev server and confirmed it serves the app (HTTP 200, no console-visible startup errors), confirmed the production CSS bundle contains the new `.card-in-flight`/`--z-in-flight`/`.odds-panel--pending` rules, and ran the full 172-test suite (which exercises the gate's exact arm/release counting via the store, independent of real animation timing). A human visual pass — actually watching eight cards fly out in rotation and confirming the reduced-motion toggle — is explicitly deferred to the 03-06 human checkpoint per this plan's own `<verification>` text ("real-motion behaviour is accepted by the human checkpoint in plan 03-06").
- **Confirmed the reduced-motion test harness (Task 1) makes the animation gate fully exercisable under jsdom:** because `AnimatedCard`'s `enabled = !useReducedMotion()` is `false` in every test (via the `matchMedia` polyfill), no `AnimatedCard` ever registers with the gate during tests — the ONLY arm/release pairs exercised automatically are `gameStore`'s synchronous arm and `TableScene`'s per-commit release. This is why all pre-existing `App.test.tsx`/`App.acceptance.test.tsx` tests (which assert `startSimulation` was called immediately after `await user.click(dealButton)`) continue to pass unmodified: the arm+release cycle completes within the same `act()`-flushed render/effect chain that `user.click()` awaits, before the next test statement runs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `AnimatedCard`/`tableGeometry`'s `community-0`..`community-4` position keys are ready for 03-04's board-card deal/street-advance/rewind choreography — no changes needed to the primitive itself, only to how `BoardDisplay` wires it in.
- The animation gate is a safety net for ALL FOUR navigation actions today, not just `deal()`: `advanceStreet`/`rewindStreet`/`reveal` already arm and release cleanly via `TableScene`'s effect even though board-card and reveal-flip animations aren't wired until 03-04/later plans — later plans only need to add real `AnimatedCard` registrations for those transitions, not touch the gate mechanics.
- Reveal-flip animation (UI-SPEC "Reveal flip" row: 400ms `rotateY` 3D flip) is explicitly NOT implemented in this plan — `reveal()` already arms/releases the gate correctly, but the opponent seat's `AnimatedCard` wrapper persists across a reveal (same key, since `revealedMask` isn't part of the `animationKey`) with only its child content switching from `CardBack` to `PlayingCard`, with no flip transition yet.
- A human visual pass at 03-06 should confirm: eight cards visibly fly out in dealer rotation on Deal, the odds panel shows em dashes + dimmed opacity until the last card lands, and toggling OS "reduce motion" makes cards appear instantly while odds still compute correctly.

## Self-Check: PASSED

All created files verified present on disk (`src/state/uiStore.ts`, `src/ui/tableGeometry.ts`, `src/ui/useAnimationGate.ts`, `src/ui/AnimatedCard.tsx`). All six task commit hashes (`85811c4`, `0d9f289`, `572cb34`, `4ed7b4f`, `37efcca`, `9b559c9`) verified present in `git log`. Full suite: 172/172 tests passing, `tsc -b` clean, `eslint .` clean, `npm run build` succeeds.

---
*Phase: 03-casino-table-ui-animation*
*Completed: 2026-08-24*
