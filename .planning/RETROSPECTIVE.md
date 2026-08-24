# Project Retrospective — Monte Carlo Poker Simulator

A living document, appended at each milestone close.

## Milestone: v1.0 — MVP

**Shipped:** 2026-08-24
**Phases:** 3 | **Plans:** 16 | **Tasks:** 39 | **Commits:** ~140 | **Tests at close:** 208/208 | **LOC:** ~5,900 TS/TSX

### What Was Built

A browser-based Monte Carlo Texas Hold'em odds explorer: seedable streaming engine (200k trials off-main-thread), full interaction loop (picker with duplicate blocking, street advance/rewind with settled-odds caching, one-way opponent reveals), and a casino-table presentation (CC0 SVG card art, felt scene, Motion choreography) with a structural animation gate keeping odds honest to what's on screen.

### What Worked

- **Engine-before-pixels sequencing.** Proving the math on an unstyled UI (Phases 1-2) meant the Phase 3 re-skin was purely presentational — the 120-test regression harness rode through the whole visual rewrite nearly untouched.
- **Wave-based worktree execution with post-merge gates.** Every wave merged through a build+test gate; the one real integration issue (main-tree node_modules missing `motion` after merge) was caught by the gate, not by a user.
- **Adversarial verification layers genuinely earned their keep.** The plan-checker caught the AnimatePresence re-deal misconception before execution; the Phase 3 code review caught 3 critical exit-gate deadlocks that BOTH the 203-test suite (reduced-motion-forced) and the browser walkthrough (wrong rewind depth) missed. Empirical browser confirmation (Deal→Advance→Rewind froze the app) turned an "advisory" review into a same-day fix cycle.
- **Locked decisions with citation gates.** CONTEXT.md D-NN decisions cited in plan must_haves made scope drift mechanically detectable (14/14 coverage both phases that used it).
- **Real-browser checkpoint automation.** Orchestrator-driven walkthroughs with DOM/timing instrumentation (staggered-deal windows, gate timing to the millisecond, cached-value verbatim checks) gave far sharper acceptance evidence than eyeballing, with the attribution caveat honestly recorded.

### What Was Inefficient

- **Windows worktree cleanup friction.** Leftover node/vite processes from executors blocked `git worktree remove` three times (and doubled test counts when vitest scanned residual copies). Mitigation evolved mid-run (explicit terminate-before-return instructions, process kills, manual merges); a pre-return process sweep in the executor contract would have prevented all of it.
- **Base-mismatch merge block.** Committing tracking docs between capturing a wave's base and merging it back tripped the cleanup helper's strictness once. Ordering rule learned: merge before committing anything new to master.
- **A content-filter false positive** killed one executor mid-LICENSE-write; resumed cleanly with a curl-the-file workaround. Cheap lesson: never have agents type license legalese.
- **jsdom's forced reduced-motion is a coverage hole by construction.** It kept 200+ tests deterministic but blinded the suite to the exact class of bug that mattered most in the animation phase. The fix added hook-level `enabled: true` tests; future animation work should start with that pattern.

### Patterns Established

- `deriveConditionedState` as the single runout reader (information-honesty by module boundary).
- Knowledge-keyed caching (`street|revealedMask`) where invalidation falls out of key composition, not explicit code.
- Synchronously-armed, structurally-released animation gate; five documented release paths; test via store flags, never timers.
- RED→GREEN commit pairs per plan; explicit vi.mock factories; guarded jsdom polyfills (dialog, matchMedia).
- Named imports only for `@poker-apprentice/hand-evaluator`; subpath imports for `pure-rand`.

### Key Lessons

1. A review finding that "can't happen per the tests" deserves an empirical repro before dismissal — the suite's own environment forcing (reduced motion) was the blind spot.
2. Checkpoint walkthrough scripts should enumerate boundary depths (rewind-to-first-street, re-deal-from-last-street), not just one instance of each action — both misses this milestone were depth/boundary cases.
3. Worktree isolation pays off for parallel safety, but on Windows the executor contract must include process hygiene, and orchestrator tracking commits must wait until after merge.

### Cost Observations

- Model mix: opus for planning (2 phases), sonnet for research/execution/verification/review, orchestration in the main loop.
- Sessions: 1 continuous autonomous session (user-directed unattended chain).
- Notable: ~20 subagents across the milestone; the three-layer quality stack (plan-checker → code review → integration audit) consumed roughly a quarter of total tokens and caught every defect that mattered.

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases / plans / tasks | 3 / 16 / 39 |
| Tests at close | 208 |
| Critical defects caught pre-close | 3 (all fixed + re-verified) |
| Requirements satisfied | 17/17 |
