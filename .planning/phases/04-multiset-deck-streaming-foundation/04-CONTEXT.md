# Phase 4: Multiset Deck & Streaming Foundation - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning
**Mode note:** Captured via `--auto` (unattended chain authorized by user). Decisions are recommended defaults, logged for audit.

<domain>
## Phase Boundary

Phase 4 rebuilds the deck/shoe model to support 1 or 2 physical decks without value-collapse (DECK-01), mandates without-replacement sampling from the finite shoe (DECK-03), makes the picker's duplicate-blocking count-aware at the store level (DECK-04), and extracts the worker streaming machinery into a game-generic runner — all proven behavior-identical to shipped v1.0 at deckCount=1. Engine/store-only: no new user-visible surface this phase (deck toggle UI is Phase 8; 2-deck gameplay is Phases 6-7).

</domain>

<decisions>
## Implementation Decisions

### Multiset representation
- **D-01:** The shoe is modeled with COUNT-based multiset logic, not object-identity wrappers. Pools remain flat `Card[]` arrays in which duplicates legitimately coexist (the v1 `drawN`/`createDrawer` Fisher-Yates primitives already sample flat arrays correctly with duplicate values — verified in research). Wherever v1 used value-based `Set<Card>` membership (deckWithout, conditioning's knownCards, worker overlap check, pickerStore blocking), v2 uses count-aware logic (conceptually `Map<Card, number>`).
- **D-02:** NO `PhysicalCard`/identity-wrapper type is introduced. React keys are already positional (`community-${index}-${dealNonce}`, seat-slot keys) and stay that way; Phase 7's copy-cue derives copy-index positionally. DECK-01's "never collapse" contract is satisfied by counts and enforced by property tests, not by object identity.
- **D-03:** New engine module (suggested `src/engine/shoe.ts`): `buildShoe(deckCount: 1 | 2): Card[]` (flat, FULL_DECK repeated), `shoeWithout(deckCount, excluded: readonly Card[]): Card[]` (count-aware subtraction — each excluded occurrence removes ONE copy), and a `DeckCount = 1 | 2` type. `FULL_DECK`/`deckWithout` remain for existing single-deck callers until their callsites migrate; no behavioral change at deckCount=1.

### Conditioning & worker contract
- **D-04:** `ConditionedState` gains `deckCount: DeckCount` (default 1 everywhere in this phase — Hold'em stays visibly unchanged). `deriveConditionedState` computes `remainingDeck` via count-aware subtraction over the shoe; the worker's entry validation generalizes to `remaining.length === 52 * deckCount − knownCount` and its overlap check becomes count-aware (a card may legitimately appear twice across known+remaining when deckCount=2, but never more times than deckCount).
- **D-05:** DECK-03 mandate: every trial samples WITHOUT replacement from the finite remaining shoe (the existing partial-Fisher-Yates already guarantees this for flat pools — the requirement is a guard against future with-replacement shortcuts; add a property test asserting a trial never uses more copies of a card than the shoe holds).

### Streaming runner extraction
- **D-06:** Extract from `simulationApi.ts` into `src/worker/streamingRunner.ts`: run-token supersession, chunked trial loop, throttled snapshot emission, and done semantics — generic over a snapshot/accumulator type. `simulationApi.ts` becomes the Hold'em-specific configuration (trial function + snapshot shape) on top of the runner. Comlink exposure shape may stay as-is this phase (namespacing to `{ poker, blackjack }` is Phase 5/6 work).
- **D-07:** Behavior-preservation gate: the ENTIRE existing `simulationApi.test.ts` suite must pass UNCHANGED (not adjusted) after the extraction — this is roadmap success criterion 4 and is non-negotiable.

### v1-parity gate
- **D-08:** Golden-first ordering: BEFORE any refactor lands, record a seeded golden test — fixed seed, fixed conditioned states (preflop + a flop case), literal expected outcome/category tallies captured from the CURRENT shipped code. The refactor must then reproduce those exact values at deckCount=1. This plus the full 216-test suite unchanged constitutes "byte-identical" (roadmap criterion 1).

### Picker count-awareness (store level)
- **D-09:** `pickerStore` blocking becomes count-aware: a card is blocked when picks-using-it reach `deckCount` (deckCount sourced as a parameter/store value defaulting to 1 this phase). Expose `remainingCopies(card)` selector state for the UI to consume later. `CardPicker` UI behavior is UNCHANGED at deckCount=1; no new visible UI this phase (Phase 7 surfaces copies).
- **D-10:** All 216 existing tests stay green; new tests are additive (multiset property tests, golden parity test, count-aware picker tests, runner extraction coverage). The v1 property test "every trial produces exactly 13 unique cards" stays as-is (it is a 1-deck invariant); a separate 2-deck-aware version is added rather than modifying it (per PITFALLS guidance).

### Claude's Discretion
- Exact module/file naming (shoe.ts vs cards.ts extension), Map vs sorted-array internals for count math, runner generic signature shape, where deckCount defaulting lives.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (primary inputs)
- `.planning/research/SUMMARY.md` — reconciled findings incl. the evaluator duplicate-crash (empirically verified) and phase-ordering rationale
- `.planning/research/ARCHITECTURE.md` — line-level trace of every Set-based collapse point this phase must fix (cards.ts, conditioning.ts, simulationApi.ts overlap check, pickerStore)
- `.planning/research/PITFALLS.md` — with-replacement trap, identity-vs-value dedup pitfalls, test-invariant guidance
- `.planning/research/STACK.md` — no new dependencies; multiset is a data-structure extension, not a package

### Scope & requirements
- `.planning/ROADMAP.md` — Phase 4 goal + 4 success criteria
- `.planning/REQUIREMENTS.md` — DECK-01, DECK-03, DECK-04

### Contracts that must survive
- `./CLAUDE.md` — locked stack; pure-rand subpath imports; evaluator named imports
- v1 conventions from `.planning/milestones/v1.0-phases/` SUMMARYs (D-02 conditioning leak guard, knowledge-keyed cache, TDD commit pairs)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/rng.ts` — `drawN`/`createDrawer` work with duplicate values as-is (no change).
- `src/engine/cards.ts` — `FULL_DECK` is the 1-deck source `buildShoe` repeats; `deckWithout`'s callsites are the migration list.
- `src/engine/conditioning.ts` — `deriveConditionedState` stays the SOLE runout reader (D-02 v1 invariant); its remaining-deck derivation is the count-aware rewrite target.
- `src/worker/simulationApi.ts` — supersession/chunk/throttle logic to extract; its validation formula (`52 - known`) and Set-based overlap check are the flagged break points.
- `src/state/pickerStore.ts` — `setPick` duplicate rejection becomes count-aware; `pickedCards` helper feeds shoe subtraction.

### Established Patterns
- TDD RED→GREEN commit pairs (`test(04-NN):` → `feat(04-NN):`); `@vitest-environment node` for engine/worker tests; explicit vi.mock factory for simulationService; fast-check for property tests; seeded determinism via createRng(seed).

### Integration Points
- No UI changes this phase. `App.tsx`/stores keep current behavior at deckCount=1. Downstream phases consume: `buildShoe`/`shoeWithout`, `ConditionedState.deckCount`, `streamingRunner`, `pickerStore.remainingCopies`.

</code_context>

<specifics>
## Specific Ideas

- Golden test FIRST, refactor SECOND — the parity gate must exist before the code it gates changes.
- The worker overlap check must not be deleted — it becomes count-aware (cap at deckCount occurrences), preserving its fail-loud role against conditioning bugs.

</specifics>

<deferred>
## Deferred Ideas

- Deck-count user toggle (Phase 8 / DECK-02), game-mode shell and namespaced worker APIs (Phase 5), blackjack trial logic (Phase 6), duplicate-aware evaluation + felt copy-cues (Phase 7), deck counts >2 (v2.x).

</deferred>

---

*Phase: 4-Multiset Deck & Streaming Foundation*
*Context gathered: 2026-08-24*
