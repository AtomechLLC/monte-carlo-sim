# Phase 7: 2-Deck Hold'em Evaluation Layer - Context

**Gathered:** 2026-08-25
**Status:** Ready for research → planning
**Mode note:** Captured via `--auto` (standing no-operator-input directive). Recommended defaults, logged for audit in 07-DISCUSSION-LOG.md.

<domain>
## Phase Boundary

Phase 7 delivers 2-deck Hold'em (HE2-01..03): the user can enable a 2-deck variant of Hold'em where dealing, the card picker, street navigation, and opponent reveal all operate over the 104-card shoe; duplicate-containing hands evaluate correctly and never crash (a detection gate routes them away from the stock evaluator, which throws `TypeError: C is not iterable` on ANY duplicate rank+suit co-occurrence — empirically confirmed); Five of a Kind appears as its own odds-table row in 2-deck mode, ranked above Royal Flush, with a correct probability; and two copies of the same card are visually legible on the felt via a copy cue. The cross-game deck-count toggle component is Phase 8; this phase ships a Hold'em-local entry point only.

</domain>

<decisions>
## Implementation Decisions

### Mode entry & lifecycle
- **D-01:** 2-deck Hold'em is entered via a HOLD'EM-LOCAL deck toggle in Hold'em's control bar, mirroring blackjack's segmented control verbatim (Phase 6 A4 pattern: same wrapper/active-state/aria-pressed, labels "1 deck" / "2 decks", zero accent). Phase 8 unifies/absorbs both local toggles into the cross-game control — build this one to be absorbable (same component conventions), not bespoke.
- **D-02:** Unlike blackjack's same-cards re-run (BJ-07 findability), the Hold'em toggle TRIGGERS A FRESH DEAL when clicked with a hand on the table (and simply sets deckCount when idle). Rationale: Hold'em's whole runout is predetermined at deal from a deckCount-sized shoe (Phase 2 D-02 discipline) — switching shoes mid-hand would invalidate the predetermined runout and every settled cache entry. `deal()` already clears the cache; the CR-02 dealNonce generation guard (06-REVIEW fix) already protects the stream. Same-cards cross-deck comparison is NOT an HE2 requirement.
- **D-03:** The Hold'em odds cache key gains no deckCount dimension — toggle → fresh deal → cache cleared makes the key unambiguous within a hand. The planner MUST add a guard test pinning that a deck toggle always passes through `deal()`'s cache clear (no path may reuse a 1-deck settled entry in 2-deck mode).

### Evaluation layer (the correctness-critical core)
- **D-04:** Duplicate handling is a WRAPPER around the stock evaluator, not a replacement: a cheap duplicate-detection gate runs on every 7-card evaluation input in 2-deck mode; duplicate-free hands delegate to `evaluateHoldem` unchanged (the 1-deck path NEVER pays the gate — deckCount=1 trials must remain byte-identical to v1.0, golden-protected). The gate must catch EVERY duplicate co-occurrence shape, not just rank-count ≥5 (STATE research note).
- **D-05:** Ranking convention locked (STATE flag, working convention): Five of a Kind ranks ABOVE Royal Flush. It renders as its own category-table row ONLY in 2-deck mode (1-deck mode's table is unchanged — guard-pinned).
- **D-06:** The duplicate-aware evaluation path's exact algorithm (how to score a duplicate-containing 7-card hand, comparison semantics between two duplicate-containing hands, kicker/tie rules with duplicate ranks, integration point in the trial hot path at 200k-trial throughput) is the PHASE RESEARCHER'S primary deliverable — do not improvise it at planning time. Requirements on the result: total order consistent with the stock comparator on duplicate-free hands; deterministic; property-testable (e.g., "adding a copy of a card never weakens a hand"); fast enough that 2-deck trials stay in the same performance envelope as 1-deck (worker streaming cadence unchanged).
- **D-07:** WR-04 folds in here: strengthen the shoe-path guard against `.includes()`-style value-membership regressions and add behavioral 2-deck CardPicker tests (both copies pickable, third copy blocked — DECK-04's remaining-copy state exercised in real UI tests).

### UI (copy cue + table)
- **D-08:** HE2-03 copy cue: a small corner badge on the SECOND visible copy of any duplicated card on the felt (board + revealed holes + hero hole), visible only in 2-deck mode, using existing badge tokens (no new accent). Exact treatment (glyph, corner, size) is the UI researcher's call within tokens; it must survive card animations (badge rides the card, not the slot) and be screen-reader-labelled.
- **D-09:** Five of a Kind row: appears above Royal Flush at the TOP of the category table in 2-deck mode, same row conventions (label + formatPct + locked-in ✓ eligibility). The 1-deck table renders zero trace of it (no hidden row, no colspan artifacts) — DOM-absence pinned both ways, mirroring the Phase 5 isolation discipline.
- **D-10:** All new testids lowercase-hyphenated, `holdem-` prefix for Hold'em-scoped additions (e.g., `holdem-deck-toggle`, `holdem-deck-toggle-1/-2`, `category-five-of-a-kind`, copy-cue testid per UI spec); copy conforms to the block-list.

### Guards & non-negotiables
- **D-11:** D-08-class protection carried forward: at deckCount=1, Hold'em's external behavior is byte-identical — both golden files, the five frozen v1 suites, and `simulationApi.test.ts` stay untouched and green. Blackjack files are NOT touched this phase (its local toggle, stores, engine all frozen).
- **D-12:** WR-03 RETIRES this phase: after the duplicate-aware layer ships, deckCount:2 into the Hold'em trial path becomes legal. The retirement is explicit — remove/retarget the WR-03 compliance comments and extend the worker validation so poker deckCount=2 is accepted end-to-end (the 06-03 acceptance test that pinned the `102 cards, got 101` rejection gets retargeted to the new legal path, never deleted).
- **D-13:** Property tests are mandatory for the evaluation layer: seeded statistical anchor for Five of a Kind frequency (researcher supplies the closed-form/reference value + tolerance), duplicate-hand comparison properties, and the "gate catches every duplicate shape" exhaustive/property sweep.

### Claude's Discretion
- Evaluation-wrapper module decomposition, copy-cue exact visual treatment within tokens, category-table row-injection mechanism, whether the Hold'em toggle lives beside the Deal button or the switcher, test file organization.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 7 goal + 4 success criteria
- `.planning/REQUIREMENTS.md` — HE2-01..03
- `.planning/research/PITFALLS.md` — evaluator-crash shapes, 2-deck ranking, performance traps
- `.planning/research/ARCHITECTURE.md` — evaluation-layer placement
- `.planning/STATE.md` Blockers — WR-01 (Phase 8, pickerStore untouched THIS phase too unless the picker work in D-07 requires the setPick deckCount wire — if it does, that closes WR-01 early with tests, note it), WR-03 retirement (D-12), WR-04 fold-in (D-07), Five-of-a-Kind convention flag
- `.planning/phases/06-blackjack-core-odds-loop/06-REVIEW.md` — CR-02 generation-guard pattern now in both game roots (do not regress), WR-01 leak-acceptance precedent
- `03-UI-SPEC.md` + `05-UI-SPEC.md` + `06-UI-SPEC.md` — carried design system incl. the Phase 6 deck-toggle pattern being mirrored

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildShoe`/`shoeWithout` (count-aware, Phase 4) — already serve 2-deck; the Hold'em path just starts passing deckCount=2.
- `deriveConditionedState` (sole runout reader) — gains deckCount plumbing (it already has the optional `deckCount?: DeckCount` parameter with `=1` default; 2-deck callers pass it explicitly).
- Blackjack's deck-toggle component + store conventions (Phase 6) — the visual/interaction pattern D-01 mirrors.
- Phase 6's CR-02 generation guard in HoldemGame (dealNonce) — already protects the toggle→redeal stream path.
- `pickerStore`'s count-aware `setPick`/`remainingCopies` (Phase 4 DECK-04) — the picker substrate D-07's behavioral tests exercise.

### Established Patterns
- RED→GREEN pairs; property tests via @fast-check/vitest; seeded createRng; @vitest-environment node for engine; guard-test comment-stripped source pins; D-NN tags; golden-parity discipline; same-commit guard amendments.

### Integration Points
- `src/engine/equity.ts` trial loop (evaluation call site — the wrapper's hot-path integration), `src/engine/evaluator.ts` (stock evaluator wrapper), `src/state/gameStore.ts` (deal + deckCount), `src/ui/HoldemGame.tsx` (toggle + effect), `src/ui/OddsTable.tsx` (Five of a Kind row), CardPicker (D-07 tests), worker validation (D-12 retargeting).

</code_context>

<specifics>
## Specific Ideas

- The Five of a Kind row appearing at the top of the table in 2-deck mode IS the phase's visible payoff — its probability converging from 0.00% to a small nonzero value makes "deck composition changes what's possible" tangible.
- The copy cue should make a duplicate feel like a deliberate feature the moment it first appears — the user's first duplicate must read as "two physical copies" instantly.

</specifics>

<deferred>
## Deferred Ideas

- Cross-game toggle component (Phase 8), deck counts beyond 2 (v2.x), deck-count delta callout UI (v2.x), visual excellence pass (VISUAL-EXCELLENCE-PLAN.md, pending insertion decision), blackjack picker (v2.x).

</deferred>

---

*Phase: 7-2-Deck Hold'em Evaluation Layer*
*Context gathered: 2026-08-25*
