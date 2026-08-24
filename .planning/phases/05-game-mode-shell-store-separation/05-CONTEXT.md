# Phase 5: Game-Mode Shell & Store Separation - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning
**Mode note:** Captured via `--auto` (standing no-operator-input directive). Recommended defaults, logged for audit.

<domain>
## Phase Boundary

Phase 5 delivers exactly BJ-01: the user can switch between Hold'em and Blackjack via an on-screen mode switcher, with fully independent per-game state — no store-field sharing, no odds-cache key collisions, no mode leakage — and clean cancellation of any in-flight simulation when switching away. Blackjack GAMEPLAY is Phase 6; this phase ships the shell and proves isolation.

</domain>

<decisions>
## Implementation Decisions

### Mode switcher
- **D-01:** A segmented two-button control labeled exactly "Hold'em" and "Blackjack" sits in the top control bar, visible in both modes, with the active game visually indicated (accent per the UI-SPEC accent budget — this control's active label becomes a 4th reserved accent use ONLY if the UI-SPEC budget is amended; otherwise use a non-accent active treatment like the existing filled-slot style). No URL routing — mode lives in a store (SPA single-screen convention; routes are a deferred idea).
- **D-02:** New `src/state/gameModeStore.ts` holding only `{ mode: 'holdem' | 'blackjack', setMode() }` this phase. Per-game `deckCount` fields are added by later phases (P6 blackjack, P8 toggle) — do NOT pre-add them here.

### Blackjack placeholder screen (this phase only)
- **D-03:** Switching to Blackjack shows the felt scene shell (reusing felt/table styling) with an honest empty state — a `data-testid="blackjack-empty-state"` block whose copy explains the Blackjack table is coming next (UI-SPEC-conformant copy, no generic labels) — and NO dead or disabled gameplay controls. Phase 6 replaces this placeholder with the real game.
- **D-04:** Hold'em-only controls (Deal, Set Up Scenario, street controls, odds panel, seats) render ONLY in holdem mode. No Hold'em testid may appear in the DOM while in blackjack mode (isolation is observable in the DOM, not just the stores).

### Store & effect isolation
- **D-05:** Zero changes to the SHAPES of gameStore/oddsStore/pickerStore/uiStore — they remain Hold'em-owned. The odds effect in App.tsx becomes mode-scoped: it must not run (and must not start simulations) while mode is blackjack.
- **D-06:** A store-isolation test proves switching modes never mutates gameStore/oddsStore/pickerStore state (snapshot before switch === snapshot after switch-away-and-back), and that no oddsStore cache key is written while in blackjack mode.

### Switch semantics
- **D-07:** Hold'em state PERSISTS across switches: leaving cancels any in-flight simulation (via `cancelSimulation()`) and resets the animation gate (`pendingAnimationCount` must return to 0 — an armed gate must not strand while the scene unmounts); returning shows the exact table left behind, with settled odds restored from the knowledge-keyed cache (or recomputed if the run was cancelled mid-flight).
- **D-08:** Mid-animation switches must be clean: unmounting the Hold'em scene while cards are in flight releases all gate registrations (the useAnimationGate/useExitGate unmount-cleanup paths already guarantee this — the isolation test must cover the switch-mid-deal case explicitly).

### Regression bar
- **D-09:** The full existing suite (281 tests) passes with AT MOST mechanical adjustments to App-level tests (e.g., tests may need the mode switcher present; default mode is holdem so existing flows should pass unchanged — any adjustment must be justified in the SUMMARY). The v1 acceptance suites are the regression harness for "Hold'em works identically."
- **D-10:** Phase 4's future-trap notes apply: do NOT touch the deckCount wire path this phase (WR-02 validation is Phase 6's), and nothing may pass deckCount:2 anywhere (WR-03).

### Claude's Discretion
- Component naming (GameModeSwitcher/BlackjackScene placeholder), exact switcher styling within UI-SPEC tokens, where mode-scoping lives in App.tsx (early return vs conditional render tree).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 5 goal + 4 success criteria (BJ-01 acceptance bar)
- `.planning/REQUIREMENTS.md` — BJ-01
- `.planning/research/ARCHITECTURE.md` — game-switching ownership analysis (gameModeStore as the only cross-game store; parallel stores over generalization)
- `.planning/research/PITFALLS.md` — mode-leakage and cache-collision pitfalls (Pitfalls 10/11 territory)
- `.planning/phases/04-multiset-deck-streaming-foundation/04-REVIEW.md` + STATE.md trap notes — WR-02/WR-03 constraints this phase must NOT trip
- `.planning/milestones/v1.0-phases/03-casino-table-ui-animation/03-UI-SPEC.md` — control-bar copy/token/accent-budget contracts the switcher must respect

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/App.tsx` — the control bar the switcher joins; the odds effect to mode-scope; the conditional render tree.
- `src/ui/TableScene.tsx` + felt CSS — the shell the Blackjack placeholder reuses.
- `src/state/simulationService.ts` — `cancelSimulation()` for switch-away.
- `src/state/uiStore.ts` — gate counter that must drain on scene unmount (existing unmount cleanups).

### Established Patterns
- Curried Zustand stores with reset conventions; contractual lowercase-hyphen testids; explicit vi.mock factory for simulationService in component tests; RED→GREEN commit pairs; D-NN-tagged comments.

### Integration Points
- App.tsx mode branch is the single fork point; everything below it stays game-owned. Phase 6 will replace the placeholder with BlackjackScene + its own stores/worker config on the Phase 4 streaming runner.

</code_context>

<specifics>
## Specific Ideas

- Isolation must be DOM-observable (D-04), store-observable (D-06), and race-safe (D-08's switch-mid-deal case) — three distinct test angles, not one.

</specifics>

<deferred>
## Deferred Ideas

- URL routing / deep links per game (v2.x with permalinks), per-game deckCount fields (P6/P8), any blackjack gameplay (P6), shared felt component extraction beyond what the placeholder needs (P6 decides).

</deferred>

---

*Phase: 5-Game-Mode Shell & Store Separation*
*Context gathered: 2026-08-24*
