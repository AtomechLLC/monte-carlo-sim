# Phase 8: Cross-Game Deck-Count Toggle UI - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning
**Mode note:** Captured via `--auto` (standing no-operator-input directive). Recommended defaults, logged in 08-DISCUSSION-LOG.md.

<domain>
## Phase Boundary

Phase 8 delivers DECK-02's remaining substance: ONE shared deck-count control component rendered in both Hold'em's and Blackjack's control bars, always reflecting the active game's current deck count. Both games already ship LOCAL toggles with locked, verified semantics (Phase 6 A3/A4 for blackjack; Phase 7 D-01/D-02/A2-A4 for Hold'em) — this phase EXTRACTS the shared component and rewires both games onto it without changing any shipped behavior, testid, or copy. This is a consolidation/refactor phase, not new game logic.

</domain>

<decisions>
## Implementation Decisions

### The shared component
- **D-01:** Extract `<DeckCountToggle />` (name at planner's discretion) into src/ui/, rendered by BOTH BlackjackControls and HoldemGame. Props-driven: `{ deckCount, onSelect, disabledSegment?: { which, title }, testidPrefix, idleTitle? }` (exact shape planner's call) — the component owns the shared segmented-control MARKUP/aria (group + aria-label "Deck count", aria-pressed, active-never-disabled, labels "1 deck"/"2 decks"); each game supplies its own state wiring and guard predicates. No shared store, no new store: gameStore.deckCount and blackjackStore's deckCount stay exactly where they are (D-10/D-14 store-locality preserved).
- **D-02:** Per-game testids are CONTRACTUAL and unchanged: `blackjack-deck-toggle(-1/-2)` and `holdem-deck-toggle(-1/-2)` — the shared component takes the prefix as a prop. The Phase 5/6/7 isolation sweeps (HOLDEM_ONLY_TESTIDS, blackjack DOM-absence) keep passing byte-untouched. SC1's "single shared control component" is satisfied at the COMPONENT level, not the testid level.
- **D-03:** All locked per-game semantics carry over EXACTLY: blackjack mid-player-turn toggle re-runs same-cards (06 A3), resolved/idle toggle sets pending only (retained numbers + subtitle untouched), physical-round 2→1 guard with the documented one-bit leak (06-REVIEW WR-01 convention — STATE note satisfied); Hold'em mid-hand toggle fresh-deals (07 D-02), idle sets value, picks-only 2→1 guard (07 A4). The extraction must be behavior-preserving — every existing toggle test keeps passing without modification (retargets only where a test pins component-internal structure).

### Success-criteria reconciliation (roadmap wording vs shipped semantics)
- **D-04:** SC2 ("immediately cancels in-flight simulation and recomputes... no stale numbers") is ALREADY satisfied by shipped behavior: blackjack's synchronous reset + restart (06 A3, FLAG-2 masking) and Hold'em's fresh-deal path (cancel via effect cleanup + CR-02 dealNonce guard + D-03 cache clear). Phase 8 adds a consolidation test suite asserting both games' cancel/recompute behavior THROUGH the shared component, but changes no logic.
- **D-05:** SC3 ("takes effect on next deal discipline... no disruptive mid-hand mutation") is interpreted against the SHIPPED locked semantics, which post-date the roadmap wording: neither game silently mutates a hand in place — blackjack re-runs odds over the SAME visible cards; Hold'em visibly replaces the hand with the full fresh-deal choreography (locked D-02, checker-approved). SC3 is recorded as satisfied-by-interpretation in the phase verification, with this decision as the citation. No behavior change to force a literal "next deal only" reading — that would UNDO Phase 6's BJ-07 findability requirement (locked, shipped, verified).

### Guards & non-negotiables
- **D-06:** Zero visual/copy changes: the shared component renders byte-identical DOM per game (same classes — the shipped `.game-mode-switcher`-derived selector lists keep matching; no new CSS rules, no new tokens, no accent). If the extraction requires any selector-list edit, it is additive-only with blackjack+holdem computed styles provably unchanged.
- **D-07:** Guard-test discipline (the recurring lesson): any guard/test pinning component-internal structure of the two inline toggles gets retargeted in the SAME COMMIT as the extraction; retarget, never delete; guard suites green at every commit, verified by checkout.
- **D-08:** Both games' full suites, goldens, frozen v1 suites, and all isolation sweeps stay green with zero pre-existing test modifications beyond sanctioned mechanical retargets (enumerated in SUMMARYs).
- **D-09:** The D-16 (Phase 7) value-assertion discipline applies to any test touched: assert rendered values/attributes, never mere presence where a value is checkable.

### Scope guard
- **D-10:** OUT: any new deck counts (>2), any store unification, any change to toggle semantics, delta callouts, the visual excellence pass. This phase is the milestone's closer — smallest possible diff that makes SC1 true and SC2/SC3 verifiable through the shared component.

### Claude's Discretion
- Component name/prop shape, file organization, whether BlackjackControls/HoldemGame keep their guard-predicate derivation inline or hoist tiny helpers, consolidation-test structure.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 8 goal + 3 success criteria
- `.planning/REQUIREMENTS.md` — DECK-02
- `.planning/phases/06-blackjack-core-odds-loop/06-UI-SPEC.md` A3/A4 + `.planning/phases/07-2-deck-holdem-evaluation/07-UI-SPEC.md` A2/A3/A4 — the locked per-game toggle contracts the shared component must preserve verbatim
- `.planning/STATE.md` Blockers — the 06-REVIEW WR-01 leak-acceptance convention (carry it; this phase absorbs the blackjack-local toggle)
- src/ui/BlackjackControls.tsx + src/ui/HoldemGame.tsx — the two shipped inline toggles being consolidated
- src/App.modeShell.guard.test.ts + both isolation suites — the sweeps that must keep passing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The two shipped toggles are already near-identical segmented controls (07's deliberately cloned 06's) — the extraction is mechanical.
- App.holdemDeckToggle.test.tsx + the blackjack toggle tests — the behavior contracts the extraction must keep green.

### Established Patterns
- Same-commit guard retargets; behavior-preserving extraction precedent (06-02 HoldemGame extraction); comment-stripped source pins; per-game testid prefixes.

### Integration Points
- BlackjackControls.tsx, HoldemGame.tsx (render sites), the shared CSS selector lists in App.css, guard/isolation test files.

</code_context>

<specifics>
## Specific Ideas

- The consolidation suite is the phase's real deliverable beyond the refactor: one describe block per SC, exercising BOTH games through the shared component (cancel-on-toggle, no-stale-numbers, per-game guard behaviors).

</specifics>

<deferred>
## Deferred Ideas

- Deck counts beyond 2 (v2.x), delta callout UI (v2.x), store unification (rejected — store locality is a Phase 5/6 invariant), visual excellence pass (pending insertion decision).

</deferred>

---

*Phase: 8-Cross-Game Deck-Count Toggle UI*
*Context gathered: 2026-08-25*
