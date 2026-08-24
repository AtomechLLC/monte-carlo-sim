# Milestones

## v1.0 MVP (Shipped: 2026-08-24)

**Phases completed:** 3 phases, 16 plans, 39 tasks

**Delivered:** A browser-based Monte Carlo Texas Hold'em odds explorer — deal or construct any scenario at a full casino table and watch win/tie/loss and hand-category probabilities converge live over 200,000 worker-computed trials, with odds that recondition on every street change and opponent reveal and never spoil a card still mid-animation.

**Key accomplishments:**

- Correct, seedable Monte Carlo engine streaming 200k trials off the main thread (Comlink worker), pinned to a verified 63.83% AA-vs-3 equity benchmark and fast-check property invariants, with a dev-mode runtime consistency guard.
- Full interaction loop: seven-slot card picker with visible duplicate blocking, street advance/rewind with knowledge-keyed settled-odds caching, and one-way opponent reveals that recondition every street's odds.
- Information-honesty architecture: `deriveConditionedState` is the sole reader of the predetermined runout, so odds only ever reflect what the user can see (no hidden-card leaks, verified by property tests and grep-checked invariants).
- Casino-table presentation: vendored CC0 SVG card deck behind a single mapping component, oval felt scene, and Motion deal/flip/reveal choreography with a `pendingAnimationCount` gate making "odds never contradict mid-animation cards" structural.
- Quality machinery that earned its keep: per-phase code reviews caught (and fixes closed) 3 critical animation-gate deadlocks invisible to the 208-test suite, each empirically confirmed and re-verified in a real browser.
- Shipped in under 24 hours: 3 phases, 16 plans, 39 tasks, 140 commits, ~5,900 LOC TypeScript, 208/208 tests, every phase goal-backward verified.

**Known deferred items at close:** 5 tech-debt items (see v1.0-MILESTONE-AUDIT.md frontmatter; headline: WR-02 worker-crash surfacing, no SECURITY.md gate run). v2 candidates: EDU-01/02/03 (see STATE.md Deferred Items).

---
