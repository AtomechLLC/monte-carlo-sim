---
phase: 03-casino-table-ui-animation
plan: 05
subsystem: ui
tags: [react, motion, framer-motion, zustand, animation-gate, accessibility, testing, code-review]

# Dependency graph
requires:
  - phase: 03-casino-table-ui-animation (plan 03)
    provides: "pendingAnimationCount gate, useAnimationGate/useExitGate primitives, AnimatedCard
      deck-to-slot fly-in, gated odds effect on both live and cache-hit branches"
  - phase: 03-casino-table-ui-animation (plan 04)
    provides: "Street-advance enter, rewind exit (useExitGate), and FlipCard 3D reveal — all four
      choreographies (deal/advance/rewind/reveal) wired into the one shared gate"
provides:
  - "WR-01 fix: the odds effect's settled-cache branch now clears a stale simulation-error
    banner on a cache hit, via a queueMicrotask-deferred setState mirroring the live branch's
    callback-shaped discipline (avoids react-hooks/set-state-in-effect)"
  - "Regression coverage proving D-09 (reduced motion), D-10 (re-deal cancellation: manual
    arm/release to zero, no-orphan DOM shape) and D-13 (error-through-gate + WR-01) all hold on
    the fully composed App — 4 new tests in src/App.test.tsx"
  - "D-14 cosmetic debt closed: index.html title is 'Monte Carlo Poker Simulator', favicon.svg is
    a hand-written flat spade glyph in --accent purple, and all four dead scaffold assets
    (react.svg, vite.svg, hero.png, icons.svg) are deleted with grep-before-delete evidence"
  - "src/App.phase3.acceptance.test.tsx: one describe per ROADMAP Phase 3 success criterion
    (verbatim), proving TBL-01..04 hold together on <App /> — 6 tests, zero production changes
    needed (03-01..04 already implement all four criteria correctly)"
affects: [03-06 (human visual checkpoint — confirms real-motion behaviour the automated suite
  cannot, and closes the phase)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "queueMicrotask-deferred setState as the escape hatch for a synchronous branch of a
      react-hooks/set-state-in-effect-governed effect that needs to clear state on a cache hit —
      mirrors how the live branch's setState-in-a-worker-callback already avoids the same lint
      rule, without introducing a second state-management mechanism."
    - "Remount-identity assertion (capturing child DOM node references before/after a re-deal and
      asserting toBe fails) as the jsdom-safe way to prove Motion's key-based
      remount-not-retarget contract, without depending on real animation frames."
    - "Acceptance-suite-proves-nothing-new is an acceptable, expected TDD outcome for a pure
      proof/hardening task: src/App.phase3.acceptance.test.tsx's 6 tests all passed on first run
      with zero production changes, because Tasks 1-2 of this plan (and all of 03-01..04) already
      correctly implement the behavior being proven."

key-files:
  created:
    - src/App.phase3.acceptance.test.tsx
    - .planning/phases/03-casino-table-ui-animation/deferred-items.md
  modified:
    - src/App.tsx
    - src/App.test.tsx
    - index.html
    - public/favicon.svg
    - src/index.css
  deleted:
    - src/assets/react.svg
    - src/assets/vite.svg
    - src/assets/hero.png
    - public/icons.svg

key-decisions:
  - "WR-01's fix defers setErrorMessage(null) via queueMicrotask rather than calling it
    synchronously in the cache-hit branch — a direct synchronous call is reachable from the
    effect's own top-level scope and would trip react-hooks/set-state-in-effect (verified: this
    project's locked eslint config enables it as an error, and 03-03 already hit this same rule
    on a similar shape). The live branch avoids it because its setErrorMessage(null) call lives
    inside an async callback (onProgress) that runs later, not synchronously during the effect
    body's own execution — queueMicrotask reproduces that same 'not directly reachable' shape for
    the cache-hit branch."
  - "The #social .button-icon rule in src/index.css was deleted (icons.svg gone, no element
    carries that class) but the closely-related --social-bg custom property and App.css's
    separate #next-steps ul a { background: var(--social-bg) } rule were left alone — --social-bg
    is still actively consumed there, and that whole #next-steps block (plus #docs, .logo) is
    itself dead scaffold CSS unrelated to icons.svg. It's logged to deferred-items.md rather than
    fixed, since 03-05 Task 2's plan text only authorized removing the icons.svg-paired rule, not
    a broader App.css scaffold cleanup (scope-boundary discipline)."
  - "Task 3's acceptance suite intentionally required zero production changes. Rather than forcing
    an artificial RED phase, the suite was written once, run, and confirmed to pass 6/6
    immediately — this is the expected and correct outcome for a plan whose own text says
    'everything before this plan added capability; this plan makes it provable', not a TDD
    process violation."

patterns-established:
  - "For a shared effect with two exit branches (live vs. cache-hit) governed by
    react-hooks/set-state-in-effect, any new synchronous setState added to the previously
    callback-only branch should default to a deferred (queueMicrotask/callback-shaped) call
    rather than a direct one, checked with eslint before assuming a fix is 'simple'."

requirements-completed: [TBL-01, TBL-02, TBL-03, TBL-04]

# Metrics
duration: ~20min
completed: 2026-08-24
---

# Phase 3 Plan 05: Animation Hardening, Cosmetic Debt Closure, and the Phase 3 Acceptance Suite Summary

**Closed the one real bug found across 03-03/03-04 (WR-01's stale error banner surviving a settled-cache hit), verified D-09/D-10 reduced-motion and re-deal-cancellation guarantees hold end-to-end with 4 new regression tests, retired the Phase 1 "scaffold-tmp" title/favicon/dead-asset debt (D-14), and added a 6-test Phase 3 acceptance suite proving all four ROADMAP success criteria hold together on the fully composed app — 203/203 tests green, zero regressions.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-24
- **Tasks:** 3 completed (Task 1 TDD: RED test commit then GREEN fix commit; Task 2 single chore commit; Task 3 single test commit — no GREEN needed, see Decisions)
- **Files modified/created:** 8 (2 new test/doc files, 5 modified, 4 deleted)

## Accomplishments

- **Task 1 — D-09/D-10/D-13 hardening + WR-01 fix:** Added 4 regression tests to `src/App.test.tsx` proving (a) a full deal→advance×3→rewind→reveal sequence ends `pendingAnimationCount` at 0 under the suite's forced reduced-motion environment, (b) re-dealing while 3 animations are manually armed releases exactly those 3 without the counter ever going negative, (c) a re-deal leaves no orphaned DOM (hero-hole 2 children, opponents 3, board-empty-state present, board-cards absent at preflop), and (d) fixed the one genuine bug: the odds effect's settled-cache branch (`src/App.tsx`) now clears a stale `simulation-error` banner on a cache hit — closing 02-REVIEW.md's WR-01. 3 of the 4 tests passed immediately (proving the gate mechanics from 03-03/03-04 were already correct); only the WR-01 regression test failed pre-fix, confirming the bug was real and isolated.
- **Task 2 — D-14 cosmetic debt:** `index.html`'s `<title>` changed from `scaffold-tmp` to `Monte Carlo Poker Simulator`; `public/favicon.svg` replaced with a hand-written single-`<path>` flat spade glyph filled `--accent` purple (`#aa3bff`), no script/font/raster. Grep-verified zero references to `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`, and `public/icons.svg` across `src/`, `index.html`, and `*.css` before deleting all four. Removed the now-orphaned `#social .button-icon` rule in `src/index.css` (paired specifically with `icons.svg`); left `--social-bg` and App.css's separate `#next-steps` block untouched (out of scope — see Deviations) and logged that block to a new `deferred-items.md`.
- **Task 3 — Phase 3 acceptance suite:** Created `src/App.phase3.acceptance.test.tsx` with 4 top-level `describe` blocks (criterion text quoted verbatim from ROADMAP.md), 6 tests total, proving: (1) `table-scene` composes `hero-hole`, 3 opponent seats, a `.community-area`, and `deck-origin` in one render with `odds-panel` docked outside the felt; (2) every hero/board card `img` matches `^/cards/[CDHS]-(10|[2-9JQKA])\.svg$` with a human-readable alt, and hidden opponents show only `/cards/back.svg`; (3) a re-deal produces new DOM node instances for every hero/opponent/community card slot (remount-identity proof) and reveal shares the same TBL-04 gate as deal (arm-then-release proof using the reveal action specifically); (4) with the counter armed, zero `startSimulation` calls occur and all 14 value cells (`trial-counter`, `win/tie/lose-pct`, `category-pct-0..9`) read the em dash, on both the live-run path and the settled-cache path, with correct numbers returning after release.
- Verified end-to-end: 203/203 tests pass (193 baseline + 4 hardening + 6 acceptance), `tsc -b` clean, `eslint .` clean, production build succeeds and its `dist/index.html` carries the correct title/favicon with zero references to any deleted scaffold asset.

## Task Commits

1. **Task 1: Reduced motion, re-deal cancellation, and error surfacing through the gate** - `eaba13d` (test, RED) → `b91ba19` (fix, GREEN)
2. **Task 2: Close the tracked cosmetic debt (D-14)** - `9b47972` (chore) + `f137b6a` (docs: deferred-items note)
3. **Task 3: Phase 3 acceptance suite** - `f1dec04` (test — no GREEN commit needed, see Decisions)

_Task 1 followed RED (failing WR-01 test) then GREEN (the fix); Task 3 is a pure proof task that passed on first run with zero production changes, so no separate GREEN/feat commit exists for it — this is the expected outcome, not a skipped step._

## Files Created/Modified

- `src/App.test.tsx` - 4 new tests: full-sequence counter-to-zero, manual-arm re-deal cancellation, post-re-deal DOM shape, WR-01 cache-hit error-clear regression guard
- `src/App.tsx` - Cache-hit branch of the odds effect now clears `errorMessage` via a `queueMicrotask`-deferred `setState` (WR-01 fix)
- `index.html` - `<title>` corrected to "Monte Carlo Poker Simulator"
- `public/favicon.svg` - Replaced scaffold Vite mark with a hand-written flat spade glyph (`#aa3bff`)
- `src/index.css` - Removed the orphaned `#social .button-icon` rule
- `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`, `public/icons.svg` - Deleted (zero references, grep-verified)
- `src/App.phase3.acceptance.test.tsx` (new) - 4-describe/6-test Phase 3 acceptance suite
- `.planning/phases/03-casino-table-ui-animation/deferred-items.md` (new) - Logs the out-of-scope dead `#next-steps` CSS block in `App.css`

## Decisions Made

See `key-decisions` in frontmatter — the `queueMicrotask` deferral pattern for WR-01's fix (avoiding `react-hooks/set-state-in-effect`), leaving `--social-bg`/App.css's `#next-steps` block alone (scope boundary, logged as deferred), and treating Task 3's immediate 6/6 pass as the correct outcome for a proof-only task rather than forcing an artificial RED phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WR-01: stale `simulation-error` banner survives a settled-cache hit**
- **Found during:** Task 1, writing the RED test for the cache-hit error-clearing behavior specified in the plan's own `<behavior>` block
- **Issue:** `src/App.tsx`'s odds effect cache-hit branch (`if (cached) { applySnapshot(cached); return; }`) never cleared `errorMessage`, so an error from a previous run could sit over valid, freshly-applied cached odds — exactly 02-REVIEW.md's WR-01 finding.
- **Fix:** Added `queueMicrotask(() => setErrorMessage(null));` to the cache-hit branch, deferred (not called synchronously in the effect body) to mirror the live branch's callback-shaped `setState` discipline and avoid this project's `react-hooks/set-state-in-effect` lint rule (the same rule 03-03 already hit on `useAnimationGate.ts`).
- **Files modified:** `src/App.tsx`
- **Verification:** New `App.test.tsx` test (`a stale simulation-error banner clears when the next street is served from the settled cache (WR-01)`) fails before the fix, passes after; `npx eslint .` exits 0 confirming no lint regression from the fix.
- **Committed in:** `b91ba19` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, a genuine pre-existing bug the plan explicitly targeted for closure — not new scope, this was the plan's own stated objective for Task 1).
**Impact on plan:** None beyond the plan's own explicit intent. WR-02 (hard worker death) remains untouched and out of scope per the plan's own text — it lives in `simulationService`, outside this phase's responsibility map.

## Issues Encountered

- **Task 2's plan text asked this executor to update `.planning/STATE.md`'s Blockers/Concerns section to strike the Phase 1 cosmetic-debt entry.** This executor is running as a parallel worktree agent under an explicit orchestrator instruction: "Do NOT modify STATE.md or ROADMAP.md — the orchestrator owns those writes after all worktree agents in the wave complete." That instruction takes precedence over the plan's action text in this execution context. **The Phase 1 cosmetic-debt entry in STATE.md's Blockers/Concerns ("Cosmetic: index.html title is still 'scaffold-tmp'; scheduled for Phase 3") should be struck by the orchestrator once this worktree merges**, since D-14 is now fully closed (verified: `grep -c 'scaffold-tmp' index.html` returns 0).
- **Discovered pre-existing, unrelated dead scaffold CSS in `src/App.css`** (`#next-steps ul` block, `#docs`, `.logo`) while investigating the `#social .button-icon` rule's `icons.svg` pairing. Left untouched per the scope-boundary deviation rule (only `#social .button-icon` was authorized for removal by this task's plan text) and logged to `.planning/phases/03-casino-table-ui-animation/deferred-items.md` for a future cleanup pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four of D-09/D-10/D-13/D-14 are closed and covered by tests or explicit grep gates; WR-01 is closed; WR-02 remains explicitly deferred (documented, out of this phase's scope).
- `src/App.phase3.acceptance.test.tsx` gives the 03-06 human checkpoint a green automated baseline for all four ROADMAP Phase 3 success criteria — the checkpoint's remaining job is confirming REAL-motion behavior (actual card fly-in/flip/exit timing and visual quality) that jsdom's forced reduced-motion cannot exercise, not re-discovering whether the criteria are met at all.
- **Orchestrator action needed on merge:** strike the Phase 1 cosmetic-debt line from `.planning/STATE.md`'s Blockers/Concerns section (this worktree could not modify STATE.md directly per its execution constraints) — D-14 is verified closed.
- **Deferred, not blocking:** `src/App.css`'s dead `#next-steps`/`#docs`/`.logo` scaffold block (see `deferred-items.md`) — zero DOM references, safe to remove whenever `App.css` is next touched.

## Self-Check: PASSED

All created files verified present on disk (`src/App.phase3.acceptance.test.tsx`, `.planning/phases/03-casino-table-ui-animation/deferred-items.md`, `public/favicon.svg` content updated, `index.html` title updated). All deleted files verified absent (`src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`, `public/icons.svg`). All five task-related commit hashes (`eaba13d`, `b91ba19`, `9b47972`, `f137b6a`, `f1dec04`) verified present in `git log`. Full suite: 203/203 tests passing, `tsc -b` clean, `eslint .` clean, `npm run build` succeeds with a correct `dist/index.html`.

---
*Phase: 03-casino-table-ui-animation*
*Completed: 2026-08-24*
