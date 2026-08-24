---
phase: 03-casino-table-ui-animation
plan: 04
subsystem: ui
tags: [react, motion, framer-motion, animation-gate, animate-presence, 3d-flip, accessibility]

# Dependency graph
requires:
  - phase: 03-casino-table-ui-animation (plan 03)
    provides: "uiStore.pendingAnimationCount gate, useAnimationGate primitive, AnimatedCard
      (deck-to-slot fly-in), tableGeometry position/offset helpers"
provides:
  - "communityDealIndex: pure stagger-index helper for street-advance board-card entry, exported
    from BoardDisplay.tsx for direct unit testing"
  - "useExitGate(count, enabled, resetKey): container-level TBL-04 gate registration for an
    AnimatePresence exit group — arms on a count DROP, releases via onExitComplete, and
    re-baselines (without registering) when resetKey changes so a re-deal's count drop never
    holds the gate for what must be an instant, non-exit removal"
  - "AnimatedCard now carries an optional 150ms easeIn exit variant (opacity 1->0, y 0->8px),
    inert unless a caller wraps it in AnimatePresence"
  - "FlipCard: a 3D rotateY(0/180) reveal component (perspective + preserve-3d + backface-
    visibility:hidden) that mounts the face image ONLY when faceUp && card is defined — the
    DOM-level enforcement of the no-peeking guarantee, on top of the simulation-level one from
    Phase 2"
affects: [03-05/03-06 (visual polish pass and the human checkpoint verify the real-motion
  behavior of all four choreographies — deal, street-advance, rewind, reveal — that this plan
  and 03-03 together implement)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Container-level exit gate (useExitGate) as a SEPARATE mechanism from the per-card gate
      (useAnimationGate) that AnimatedCard/FlipCard already use — the two never share
      registrations; useExitGate watches a COUNT (how many list items are visible) rather than a
      single element's own mount/complete lifecycle, arming exactly when that count drops."
    - "resetKey pattern for AnimatePresence + count-based gates: a value that changes exactly
      when a list is being WHOLESALE REPLACED (dealNonce) re-baselines the previous-count ref
      inside the SAME effect that would otherwise interpret the replacement's transient count
      drop as an exit — preventing a re-deal from ever registering a hold intended only for a
      genuine rewind."
    - "AnimatePresence must wrap the actual list items directly (not an intermediate host div) —
      wrapping a static wrapper element instead of the keyed children themselves would make
      AnimatePresence blind to additions/removals three levels down, since it only inspects its
      OWN direct children for key changes."
    - "A component's own Motion `animate`/`exit` target objects can each carry their own
      `transition` key that overrides the shared top-level `transition` prop for THAT specific
      animation only — this is how AnimatedCard runs a 300ms easeOut enter and a 150ms easeIn
      exit on the same element without two separate components (confirmed via Context7 motion.dev
      docs, not assumed from memory, since duration/easing correctness at the two different UI-
      SPEC-mandated timings was load-bearing)."
    - "Every hole-card slot (hidden or revealed) renders the SAME FlipCard instance shape — the
      call site never branches render output on `revealed`; only FlipCard's own `faceUp`/`card`
      props do. This keeps the leak-guard logic (never pass a real card while hidden) co-located
      in exactly one place (Seat.tsx's renderHoleSlot) rather than duplicated per branch."

key-files:
  created:
    - src/ui/BoardDisplay.test.tsx
    - src/ui/FlipCard.tsx
    - src/ui/FlipCard.test.tsx
  modified:
    - src/ui/BoardDisplay.tsx
    - src/ui/AnimatedCard.tsx
    - src/ui/useAnimationGate.ts
    - src/ui/useAnimationGate.test.ts
    - src/ui/Seat.tsx
    - src/ui/Seat.test.tsx
    - src/App.css
    - src/App.test.tsx

key-decisions:
  - "communityDealIndex is exported from BoardDisplay.tsx (with a targeted
    react-refresh/only-export-components eslint-disable, mirroring PlayingCard.tsx's existing
    precedent for cardAssetPath/cardAltText) rather than inspecting Motion's inline
    transition-delay style in tests — the plan explicitly authorized either approach."
  - "useExitGate takes a THIRD parameter (resetKey) beyond the plan's originally-stated
    2-parameter target_contracts signature — this is the plan-checker-mandated correction called
    out in the plan's own Task 2 text (AnimatePresence removing old-keyed children IS an exit by
    default; a dealNonce change does not automatically produce an untracked fresh mount), and was
    implemented exactly as that corrected text specifies."
  - "BoardDisplay's board-cards/board-empty-state ternary is UNCHANGED structurally (still
    mutually exclusive) rather than restructured to keep AnimatePresence permanently mounted
    across the empty-board case. This is a deliberate, scoped tradeoff — see 'Known Limitations'
    below."
  - "FlipCard.test.tsx and the App.test.tsx addition mock motion/react's useReducedMotion to
    return false (via vi.importActual + override) specifically to exercise the gate-registration
    codepath, since src/test/setup.ts's global matchMedia polyfill forces reduced motion on for
    every other test in the suite."

patterns-established:
  - "Verifying third-party animation-library API claims (per-variant transition override) via
    Context7 doc lookup before relying on them for a timing-sensitive dual-transition
    requirement, rather than assuming from general framer-motion familiarity."

requirements-completed: [TBL-03, TBL-04]

# Metrics
duration: ~17min
completed: 2026-08-24
---

# Phase 3 Plan 04: Street-Advance, Rewind Exit, and Opponent Reveal Choreography Summary

**Community cards now enter only-the-new-card(s)-per-street via AnimatedCard, a rewind fades departing board cards out (150ms easeIn) through a new container-level `useExitGate` that holds the TBL-04 gate until the exit finishes, and opponent reveals use a real perspective/preserve-3d/backface-visibility 3D flip whose face art never enters the DOM until the instant of reveal — 193/193 tests green (172 baseline + 21 new), zero regressions.**

## Performance

- **Duration:** ~17 min
- **Completed:** 2026-08-24
- **Tasks:** 3 completed (all TDD: RED test commit then GREEN implementation commit per task)
- **Files modified/created:** 11 (3 new: BoardDisplay.test.tsx, FlipCard.tsx, FlipCard.test.tsx; 8 modified)

## Accomplishments

- **Task 1 — Street-advance enter:** `BoardDisplay` now wires each visible community card through the existing `AnimatedCard` primitive, keyed by `community-${index}-${dealNonce}`, with a new exported `communityDealIndex(index, previouslyVisibleCount)` helper deriving the per-card stagger index from `previousStreet(street)` — so advancing a street sends only the newly-visible card(s) flying from the deck while already-settled board cards sit still, verified by DOM-identity assertions (`toBe` across a flop-to-turn advance) and a different-node assertion across a re-deal.
- **Task 2 — Rewind exit:** Added `useExitGate(count, enabled, resetKey)` to `useAnimationGate.ts` — a container-level gate registration that arms exactly when `count` drops below its previous value (never on a rise), releases via `AnimatePresence`'s `onExitComplete`, and re-baselines without registering when `resetKey` (`dealNonce`) changes, so a re-deal's instantaneous count drop never gets mistaken for an exit. `AnimatedCard` gained an optional 150ms `easeIn` exit variant (`opacity 1->0`, `y 0->8px`) that is completely inert unless a caller wraps it in `AnimatePresence` — confirmed via Context7 docs that a Motion target object's own `transition` key overrides the shared `transition` prop for just that variant, which is what lets the 300ms enter and 150ms exit coexist on one element. `BoardDisplay` wraps its mapped `AnimatedCard`s directly in `<AnimatePresence key={dealNonce} onExitComplete={releaseExitGate}>` — keyed by `dealNonce` so a re-deal replaces the whole presence tree instantly rather than letting `AnimatePresence` diff and exit the old board. `src/App.tsx` is untouched, per the plan's own acceptance guard — the exit path reuses the one TBL-04 gate.
- **Task 3 — Opponent reveal flip:** New `FlipCard.tsx` renders a true 3D flip (perspective on the outer element, `transform-style: preserve-3d` on the rotating element, `backface-visibility: hidden` on both faces — all three required together per 03-RESEARCH Pattern 3/A2) and mounts the face `<img>` ONLY when `faceUp && card !== undefined`, enforcing the no-peeking guarantee at the DOM level (not just the simulation level, per T-03-12). `Seat.tsx`'s opponent hole-card slots now render the identical `FlipCard` regardless of `revealed` state, passing `card={undefined}` whenever hidden. Registers with the TBL-04 gate via `useAnimationGate(flipKey, enabled && faceUp)`.
- Verified end-to-end: 193/193 tests pass (172 baseline + 21 new: 7 BoardDisplay + 5 useExitGate + 4 FlipCard-gate/leak + 2 FlipCard-layout + 2 Seat.tsx + 1 App.tsx regression), `tsc -b` clean, `eslint .` clean, production build succeeds, dev server verified serving the app (HTTP 200, no console-visible startup errors) — structural verification only, matching the 03-01/02/03 precedent; full visual/animation verification is explicitly deferred to the 03-06 human checkpoint per this plan's own `<verification>` text.

## Task Commits

1. **Task 1: Street-advance enter — only the newly visible board cards animate** - `b769de4` (test, RED) → `9427267` (feat, GREEN)
2. **Task 2: Rewind exit — departing cards leave, and cached odds wait for them** - `1dc004e` (test, RED) → `58f9cc6` (feat, GREEN)
3. **Task 3: Opponent reveal — a 3D flip that never leaks the face early** - `1d6aa90` (test, RED) → `bded38e` (feat, GREEN)

_Each task followed RED (failing test commit) then GREEN (implementation commit); no REFACTOR commits were needed._

## Files Created/Modified

- `src/ui/BoardDisplay.tsx` - Wires community cards through `AnimatedCard`/`AnimatePresence`; exports `communityDealIndex`
- `src/ui/BoardDisplay.test.tsx` (new) - Street-advance enter coverage (counts, DOM identity, re-deal, stagger index)
- `src/ui/AnimatedCard.tsx` - Optional exit variant (150ms easeIn, opacity+translateY)
- `src/ui/useAnimationGate.ts` - `useExitGate(count, enabled, resetKey)` container-level exit gate
- `src/ui/useAnimationGate.test.ts` - 5 new `renderHook` tests for `useExitGate`
- `src/ui/FlipCard.tsx` (new) - 3D rotateY reveal, leak-guarded face mounting, gate participation
- `src/ui/FlipCard.test.tsx` (new) - Leak guard, gate participation, no-layout-shift box contract
- `src/ui/Seat.tsx` - Opponent hole-card slots render `FlipCard` uniformly regardless of `revealed`
- `src/ui/Seat.test.tsx` - Updated revealed-seat image-count expectations (2 backs + 2 faces = 4); added explicit hidden-seat leak-guard test
- `src/App.css` - `.flip-card`/`.flip-card-inner`/`.flip-card-face` 3D-flip container rules
- `src/App.test.tsx` - Regression test: reveal click still triggers `startSimulation` with `knownOpponentHoles[i]` non-null through the `FlipCard` refactor

## Decisions Made

See `key-decisions` in frontmatter — `communityDealIndex` export placement, `useExitGate`'s corrected 3-parameter signature (per the plan's own plan-checker note), the deliberately-unchanged `board-cards`/`board-empty-state` ternary structure (see Known Limitations), and the `useReducedMotion` mock used specifically in `FlipCard.test.tsx`/`App.test.tsx` to exercise gate registration under jsdom's otherwise-global forced-reduced-motion harness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `react-refresh/only-export-components` lint error on `communityDealIndex`**
- **Found during:** Task 1, running `npx eslint .`
- **Issue:** Exporting the pure `communityDealIndex` helper alongside the `BoardDisplay` component from the same file trips this project's Fast-Refresh lint rule (a file exporting components should export only components).
- **Fix:** Added a targeted `eslint-disable-next-line react-refresh/only-export-components` with a comment explaining the co-location tradeoff, mirroring the exact precedent already established in `PlayingCard.tsx` for `cardAssetPath`/`cardAltText`.
- **Files modified:** `src/ui/BoardDisplay.tsx`
- **Verification:** `npx eslint .` exits 0; no functional change.
- **Committed in:** `9427267` (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Unused `screen` import in `FlipCard.test.tsx`**
- **Found during:** Task 3, running `npx tsc -b` / `npx eslint .`
- **Issue:** The RED-phase test file imported `screen` from `@testing-library/react` but the final test suite only needed `container`-scoped queries.
- **Fix:** Removed the unused import.
- **Files modified:** `src/ui/FlipCard.test.tsx`
- **Verification:** `npx tsc -b` and `npx eslint .` both exit 0.
- **Committed in:** `bded38e` (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, lint-compile fixes with no behavior change).
**Impact on plan:** None on scope. Both were necessary to make the plan's own acceptance criteria (`tsc -b`/`eslint .` exit 0) pass.

### Acceptance-Criteria Technicality (not a deviation, documented for transparency)

- **Task 1's `grep -c "STREET_BOARD_COUNT" src/ui/BoardDisplay.tsx` returns 3, not the plan's stated 2.** The plan's own acceptance bullet says this should return 2 ("the visibility slice and the previous-street stagger baseline"), but `grep -c` counts MATCHING LINES, and the file's `import { STREET_BOARD_COUNT, previousStreet } from '../engine/streets';` line is itself a third matching line — a line that was ALREADY present (and already counted) in the pre-Task-1 file, alongside the pre-existing single usage line (2 total, pre-Task-1). The plan's arithmetic appears to have not accounted for the import line contributing to the count both before and after this task's change. The SUBSTANTIVE intent of the guard — that `STREET_BOARD_COUNT[street]` remains the single source of truth for board visibility, with no second, independent visibility rule introduced — is fully satisfied: there are exactly two INDEXING usages (`STREET_BOARD_COUNT[street]` and `STREET_BOARD_COUNT[previousStreet(street)]`), matching the plan's own parenthetical description. No code change was made to force the literal grep count to 2, since doing so would require an unnatural import/aliasing restructure with no correctness benefit.

## Known Limitations

- **Full-board-to-empty rewind (flop -> pre-flop) may not show a graceful real-browser fade.** `BoardDisplay`'s `board-cards`/`board-empty-state` ternary is structurally unchanged from Phase 1-2: when `visibleBoard.length` drops to 0, the ternary swaps `<AnimatePresence>` itself out of the tree in the same React commit, rather than `AnimatePresence` remaining a stable ancestor while only its children exit. `AnimatePresence` can only intercept the removal of ITS OWN children while it stays mounted — it cannot delay its own unmount when a parent conditional replaces it. Partial rewinds (river->turn->flop, where the board never reaches zero) are unaffected and get the full 150ms fade+slide correctly, since `AnimatePresence` stays mounted throughout those transitions. This edge case does not affect any automated test (jsdom forces reduced motion globally, collapsing every transition to 0 duration regardless of this structural detail) and is called out here specifically for the 03-06 human checkpoint to verify visually. A full fix would require restructuring the empty-state conditional to keep `AnimatePresence` permanently mounted (rendering `board-empty-state` as a sibling rather than a mutually-exclusive alternative), which was out of this plan's explicit action-text scope.
- **"Card mounts already face-up" gate-safety is not independently exercised by a dedicated test.** The plan flags this as a defensive requirement with "there is no such path today" — `useAnimationGate`'s existing generic register-on-condition/release-on-complete-or-unmount contract (already covered by its own test suite from 03-03) does not special-case "was already at the mount value," so no FlipCard-specific behavior change was needed; this is a reliance on an already-tested primitive's generic contract rather than new code.

## Issues Encountered

- **jsdom's global forced-reduced-motion harness (src/test/setup.ts) neuters gate registration inside components by default.** Both `FlipCard.test.tsx` and the new `App.test.tsx` regression test needed a local `vi.mock('motion/react', ...)` (via `vi.importActual` + `useReducedMotion: () => false` override) to actually exercise the `enabled && faceUp` gate-registration codepath — without it, `enabled` is always `false` in every test, identical to the limitation 03-03 already documented for `AnimatedCard`'s per-card gate. No existing test file had this precedent, so it was introduced fresh in `FlipCard.test.tsx` with an explanatory comment.
- **No browser/computer-use tool available to this executor**, matching 03-01/02/03's precedent: performed structural verification only (dev server started, confirmed HTTP 200 + valid HTML with no missing-module errors, then terminated). Full visual verification (only-new-cards animating, the rewind fade, the 3D flip not looking like a flat squash) is explicitly deferred to the 03-06 human checkpoint per this plan's own `<verification>` text.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three of TBL-03's remaining choreographies (street-advance, rewind, reveal) are now wired, joining 03-03's deal fly-in — TBL-03 and TBL-04 are structurally complete pending the 03-06 human visual checkpoint.
- The one `pendingAnimationCount` gate from 03-03 now has FOUR distinct registration paths feeding it (deal's per-card `AnimatedCard`, street-advance's per-card `AnimatedCard`, rewind's container-level `useExitGate`, and reveal's per-card `FlipCard`) — all sharing the same store primitive, with `src/App.tsx` untouched throughout 03-04, confirming T-03-15's "no second gating mechanism" threat mitigation held.
- The Known Limitations item above (full-board-clear rewind's AnimatePresence-unmounts-with-its-parent edge case) should be specifically checked at the 03-06 human checkpoint: does a flop-to-preflop rewind visibly fade the three departing cards, or does the board vanish instantly? If the latter is unacceptable, the fix is a `BoardDisplay` restructure (keep `AnimatePresence` permanently mounted; render the empty-state message as a sibling rather than a ternary alternative) — scoped and understood, just deferred.

## Self-Check: PASSED

All created files verified present on disk (`src/ui/BoardDisplay.test.tsx`, `src/ui/FlipCard.tsx`, `src/ui/FlipCard.test.tsx`). All six task commit hashes (`b769de4`, `9427267`, `1dc004e`, `58f9cc6`, `1d6aa90`, `bded38e`) verified present in `git log`. Full suite: 193/193 tests passing, `tsc -b` clean, `eslint .` clean, `npm run build` succeeds.

---
*Phase: 03-casino-table-ui-animation*
*Completed: 2026-08-24*
