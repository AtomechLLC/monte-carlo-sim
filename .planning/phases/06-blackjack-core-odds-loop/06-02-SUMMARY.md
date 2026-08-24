---
phase: 06-blackjack-core-odds-loop
plan: 02
subsystem: ui
tags: [react, zustand, vitest, testing-library, refactor]

# Dependency graph
requires:
  - phase: 05-game-mode-shell-store-separation
    provides: mode fork, gameModeStore, mode-shell guard test, and the switch-back defenses (CR-01 live-read guard, WR-01 error-clear effect, WR-02 restore-mount ack) this extraction had to preserve intact
provides:
  - src/ui/HoldemGame.tsx — the Hold'em game root; owns the odds effect, WR-01/WR-02 effects, errorMessage/scenarioOpen state, and the full Hold'em JSX (renders its own control bar with GameModeSwitcher first)
  - Slimmed src/App.tsx cross-game shell — MotionConfig + h1 + two-way mode fork only, zero game state, zero simulation imports (with a temporary Blackjack shim until 06-07)
  - src/test/holdemTestids.ts — the single exported HOLDEM_ONLY_TESTIDS list (29 entries) both mode-switch suites now sweep
  - Retargeted src/App.modeShell.guard.test.ts — the three moved pins now read ui/HoldemGame.tsx, plus a NEW App.tsx zero-cancellation pin
affects: [06-03, 06-04, 06-05, 06-06, 06-07, 06-08, 07-2-deck-holdem-evaluation, 08-cross-game-deck-count-toggle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Game-root component extraction (D-07): each game is a sibling component under the shell's mode fork; each renders its OWN control bar with GameModeSwitcher as first child, so the shipped DOM order survives byte-equivalent"
    - "Belt-and-braces mode gate: the extracted component keeps its `if (mode !== 'holdem') return;` guard AND the `mode` dependency even though it only mounts in its own mode — the effect cleanup firing on the mode flip IS the entire cancellation mechanism"
    - "Shared test-fixture module under src/test/ (no production consumer) as the single source of truth for cross-suite testid sweeps"

key-files:
  created:
    - src/ui/HoldemGame.tsx
    - src/test/holdemTestids.ts
  modified:
    - src/App.tsx
    - src/App.modeShell.guard.test.ts
    - src/App.modeIsolation.test.tsx
    - src/App.modeSwitch.test.tsx

key-decisions:
  - "Control-bar ownership (planner decision executed as specified): each game branch renders its own .control-bar with GameModeSwitcher first — Hold'em's rendered DOM is byte-equivalent to HEAD, and App.tsx's blackjack branch carries a temporary shim (control bar + BlackjackScene) that plan 06-07 deletes"
  - "The mode gate and `mode` dependency were kept in HoldemGame with an explicit D-07 comment marking the guard as belt-and-braces and the dependency as load-bearing for teardown ordering, so a future reader does not simplify the cancellation path away"
  - "Guard amendments were retargets-plus-additions only: 3 assertions moved to ui/HoldemGame.tsx (each message citing D-07 and stating it MOVED, not weakened), 1 new App.tsx zero-cancellation pin added, resetAnimations sweep extended with ui/HoldemGame.tsx — no describe/it/expect deleted"
  - "HOLDEM_ONLY_TESTIDS transcribed verbatim from App.modeIsolation.test.tsx's 29-entry UI-SPEC-synced list (the source of truth), never the stale 12-entry subset"

patterns-established:
  - "Adding a Hold'em testid is now a one-line addition to src/test/holdemTestids.ts — both DOM-absence sweeps extend automatically"
  - "Plan 06-07 adds the mirror-image BLACKJACK_ONLY_TESTIDS list beside it (documented in the module comment)"

requirements-completed: [] # BJ-02 progressed (D-07 structural pre-work); BJ-02 completion lands with the Blackjack vertical-slice plans (06-03..06-07)

# Metrics
duration: ~10min
completed: 2026-08-24
---

# Phase 6 Plan 02: HoldemGame Extraction, Guard Retarget & Testid Consolidation Summary

**Verbatim extraction of the entire Hold'em tree (odds effect, WR-01/WR-02 effects, errorMessage/scenarioOpen state, all five JSX regions) out of App.tsx into a self-contained `<HoldemGame />` sibling component, with the mode-shell guard's three App.tsx pins retargeted at the new file in the same commit and the two diverged Hold'em testid safety-net arrays consolidated into one exported 29-entry list.**

## Performance

- **Duration:** ~10 min of task execution (plus `npm ci` in the fresh worktree)
- **Started:** 2026-08-24T14:36 local (baseline suite run)
- **Completed:** 2026-08-24T14:45 local (final gate)
- **Tasks:** 3 (Tasks 1+2 deliberately share one commit per the plan's commit discipline)
- **Files modified:** 6 (2 created, 4 modified) — exactly the plan's `files_modified` list

## Test-Suite Counts (before → after)

- **Baseline at HEAD (7b9ca13):** 37 test files / **388 tests**, all passing (verified by a fresh full run before any edit)
- **After this plan (00370fb):** 37 test files / **407 tests**, all passing — **+19**, all additive:
  - +2 in `App.modeShell.guard.test.ts` (new App.tsx zero-cancellation pin; `ui/HoldemGame.tsx` added to the resetAnimations sweep): 32 → 34
  - +17 in `App.modeSwitch.test.tsx` (the D-04 sweep grew from the stale 12-entry subset to all 29 shared entries): 20 → 37
- `npx tsc --noEmit` clean, `npx eslint .` clean, `npm run build` exits 0 (pre-existing chunk-size warning only)

## Task Commits

1. **Task 1: Extract HoldemGame from App.tsx (verbatim move)** — staged only, NO standalone commit (plan-mandated: the guard goes red the instant App.tsx changes, and no red-suite commit may exist)
2. **Task 2: Amend the mode-shell guard — retarget, never delete** — `4551bb9` (refactor), the ONE commit containing both the extraction and the guard amendment
3. **Task 3: Consolidate the two diverged Hold'em testid arrays** — `00370fb` (test)

**Guard green at every commit in the range (verified by checkout):** `4551bb9` → 34/34 passing (run at a detached checkout of that exact commit); `00370fb` (HEAD) → 34/34 passing. No commit boundary in this plan ever had a red guard suite.

## Files Created/Modified

- `src/ui/HoldemGame.tsx` — New Hold'em game root (216 lines): the five store subscriptions, `errorMessage`/`scenarioOpen` state, `SIMULATION_ERROR_MESSAGE`/`CARD_PICKER_REGION_ID` constants, the odds effect in full (mode gate → CR-01 dual animation-gate check → cache gate with `queueMicrotask` → ignore-flag run → `cancelSimulation()` cleanup, dependency array ending `pendingAnimationCount, mode]`), the WR-01 error-clear and WR-02 ack effects, and the full Hold'em JSX with `mode === 'holdem' &&` guards removed but DOM order, testids, classNames, copy, ids and aria attributes untouched. A new D-07 comment marks the mode gate as belt-and-braces while the `mode` dependency stays load-bearing for teardown ordering.
- `src/App.tsx` — Reduced to the shell: `MotionConfig` + `<h1>` + `{mode === 'holdem' && <HoldemGame />}` + the blackjack branch's temporary shim (`.control-bar` with `GameModeSwitcher` + `BlackjackScene`, identical DOM to the pre-extraction shape; 06-07 deletes it). Zero `useState`/`startSimulation`/`deriveConditionedState`/`errorMessage`/`scenarioOpen`/`cancelSimulation(` occurrences; exactly two `mode === '` comparisons.
- `src/App.modeShell.guard.test.ts` — Describe renamed to name both files; the `cancelSimulation(` count, `if (mode !== 'holdem') return;` and `pendingAnimationCount, mode]` pins retargeted at `ui/HoldemGame.tsx` (each message citing D-07 and stating the assertion MOVED because the odds effect moved); NEW `toBe(0)` assertion pinning App.tsx as cancellation-free; `ui/HoldemGame.tsx` added to the resetAnimations `it.each` list; file-level comment block records the 2026-08-24 amendment per the STANDING RULE. The `deckCount` sweep, BlackjackScene placeholder block, locked-copy block and oddsStore knowledgeKey pin are untouched and still green.
- `src/test/holdemTestids.ts` — New shared fixture exporting `HOLDEM_ONLY_TESTIDS: readonly string[]` (29 entries, transcribed verbatim from the isolation suite's UI-SPEC-synced list), with the carried-over explanatory comments and the 06-07 `BLACKJACK_ONLY_TESTIDS` forward note.
- `src/App.modeIsolation.test.tsx` — Local array deleted; imports the shared list; no assertion touched; the `empty-hand-state` conditional-setup explanation retained.
- `src/App.modeSwitch.test.tsx` — Local 12-entry array deleted; imports the shared list; sweep documented as the absence-only smoke sweep (no deal, entries requiring a dealt hand are vacuously absent) with `App.modeIsolation.test.tsx` named as the owner of the non-vacuous present-then-absent proof.

## D-08 Behavior-Preservation Proof

- The five frozen v1 acceptance suites — `App.test.tsx`, `App.acceptance.test.tsx`, `App.phase3.acceptance.test.tsx`, `App.modeErrorBanner.test.tsx`, `App.modeSwitchRace.test.tsx` — **pass with ZERO edits** (48 tests green immediately after the extraction; `git diff --name-only 7b9ca13..00370fb` lists exactly the six planned files and none of the five suites).
- No file under `src/engine/`, `src/worker/` or `src/state/` was touched.
- The mode-flip teardown still cancels Hold'em's in-flight run through the single effect-cleanup call site, now in `HoldemGame` — no second cancellation call site exists anywhere (guard-pinned in both directions: exactly 1 in HoldemGame, exactly 0 in App).

## Guard Negative Control (recorded per plan)

A second `void cancelSimulation();` was temporarily added to HoldemGame's effect cleanup: the retargeted count assertion went red with `expected 2 to be 1` ("ui/HoldemGame.tsx must contain exactly ONE cancelSimulation( call…"), proving the guard still bites at its new target. The change was then reverted before the full-suite pre-commit run.

## Testid Consolidation Results

- `App.modeSwitch.test.tsx`'s parameterised D-04 sweep rose from 12 to 29 cases — a strict coverage increase; **all 17 newly-swept entries passed immediately with no conditional-setup treatment needed** (that file's sweep runs pre-deal, so dealt-hand entries are vacuously absent there by design, as its new comment documents).
- No real leakage gap was uncovered by the widened sweep — the extraction left no Hold'em element mounted under the blackjack branch (T-06-10 mitigated).

## Deviations from Plan

None — plan executed exactly as written, including the plan-mandated non-standard commit discipline (Task 1 staged without committing; Tasks 1+2 landed as the single commit `4551bb9` so the guard suite was green at every commit boundary).

## Known Flags (routed forward, per plan)

- **Mode-switch focus lands on `<body>`:** because each game component now owns its control bar, the switcher's subtree identity changes on a mode flip and focus moves to `<body>` after a switch click. No test or 05-UI-SPEC rule pins mode-switch focus (A5 only forbids disabling the segments), and the shipped opponent-reveal control already accepts focus loss to body. **Routed to the 06-08 phase checkpoint for a keyboard-trap check** (T-06-11, accepted disposition).
- **Temporary Blackjack shim in App.tsx:** intentional, documented in-code, deleted by plan 06-07 together with the `BlackjackScene` placeholder. Not a data stub — the placeholder ships exactly the Phase 5 behavior, and every Phase 5 test stays green through waves 1-3.

## Issues Encountered

None. jsdom note honored: all suite results here run under forced reduced motion, so no animation-choreography claims are made from them (real-motion behavior remains the 06-08 human checkpoint's territory).

## User Setup Required

None.

## Next Phase Readiness

- The post-extraction shell (`{mode === 'holdem' && <HoldemGame />}{mode === 'blackjack' && …}`) is the exact shape waves 3-4 extend: `<BlackjackGame />` slots in at 06-07 by replacing the shim.
- The guard's amended describe is the template for 06-07's further amendments (placeholder-copy retirement, blackjack-store isolation pins).
- `src/test/holdemTestids.ts` is ready to receive the mirror-image `BLACKJACK_ONLY_TESTIDS` in 06-07.

---
*Phase: 06-blackjack-core-odds-loop*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 6 plan files confirmed present on disk (`src/ui/HoldemGame.tsx`, `src/test/holdemTestids.ts`,
`src/App.tsx`, `src/App.modeShell.guard.test.ts`, `src/App.modeIsolation.test.tsx`,
`src/App.modeSwitch.test.tsx`). Both task commits (`4551bb9`, `00370fb`) confirmed present in
`git log`. Full suite 37 files / 407 tests green at HEAD; guard suite verified green at both
commits in the plan's range via detached checkout.
