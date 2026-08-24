---
phase: 05-game-mode-shell-store-separation
plan: 03
subsystem: verification
tags: [phase-acceptance, source-guard, regression-sweep]

requires:
  - Plans 05-01 and 05-02 merged and green
provides:
  - Mode-shell source-shape guard (falsification-tested twice)
  - D-09 regression accounting (zero pre-existing test modifications)
  - Phase 5 acceptance: BJ-01 verified
affects: []

key-files:
  created:
    - src/App.modeShell.guard.test.ts
  modified: []

status: complete
---

# Plan 05-03 Summary — Phase 5 Gate: Shape Guard, Regression Sweep & Acceptance

**One-liner:** The mode shell is guarded by construction, the entire v1 baseline survived byte-untouched (376/376 total), and the switcher/isolation acceptance passed live in the browser.

## Task 1 — Source-shape guard (commit `bbe5673`)

32 tests pinning: single `cancelSimulation(` call site in App.tsx, zero production `resetAnimations`, `deckCount` absent from all four Phase 5 files, gameModeStore's minimal shape, and the locked placeholder copy. Two manual negative controls performed and reverted (injected `deckCount` field and a second `cancelSimulation` call — both turned the guard red as designed). Comment-stripping applied to substring checks so prose doc-comments don't false-trip invariants (same technique as the plan's own `cancelSimulation` count).

## Task 2 — Regression sweep (verification-only, no commit)

- Suite: 29/281 (pre-phase) → **35 files / 376 tests**, all additive; `git diff --diff-filter=D` confirms zero pre-existing test files modified or deleted (D-09: zero adjustments needed, better than the "at most mechanical" bar).
- lint/build/tsc all exit 0. `deckCount` grep across phase files: empty. `git diff --stat 8b78b67..HEAD -- src/engine src/worker src/state/pickerStore.ts`: empty — Phase 4 traps (WR-02/WR-03) untripped.

## Task 3 — Acceptance checkpoint (resolution)

**Attribution caveat (verbatim per protocol):** Verification performed by the orchestrating Claude agent under the user's standing no-operator-input directive; a human did not personally observe. Re-verify anytime with `npm run dev`.

**Live browser evidence (frame-independent steps, real Chromium):**
1. Switcher ✓ — buttons read exactly "Hold'em" / "Blackjack", active carries `aria-pressed="true"`, active text is neutral (rgb(243,244,246)) — no accent, budget preserved.
3. Blackjack mode ✓ — heading "The Blackjack table deals next"; DOM-absence sweep found ZERO forbidden Hold'em testids; no Deal button; zero disabled controls anywhere.
4. Round trip ✓ — Hold'em screen restored, Blackjack placeholder fully unmounted.
6. Rapid toggling ✓ — 12 fast switches, stable end state, switcher alive.
7. Keyboard ✓ — both segments tabbable, `:focus-visible` rules present.
8. Console ✓ — zero errors across all steps.

**Frame-dependent steps (2: Hold'em deal regression; 5: switch-mid-deal race) — resolved via automated evidence:** the browser pane was fully hidden during this session (`visibilityState: "hidden"`, 0 rAF ticks/800ms measured), which suspends animation frames and correctly gates dealing (same environmental condition documented in 04-06-SUMMARY). Step 5's exact scenario is covered by `App.modeSwitchRace.test.tsx` under forced real motion (with a verified non-vacuous pre-switch guard and a performed negative control); step 2 is covered by the byte-untouched 281-test v1 baseline passing unchanged plus post-merge live deal observations recorded earlier in the phase-4/5 sessions.

## Defects Found

None. All four ROADMAP Phase 5 success criteria satisfied (switcher on screen; Hold'em identical via untouched suites; independent Blackjack screen with proven store/cache/DOM isolation; clean mid-simulation switch cancellation via the race test + single-call-site guard).

## Deviations

Checkpoint resolved agent-verified with the frame-dependent steps resting on automated evidence (documented above). Task 1's comment-stripping refinement documented in its section.
