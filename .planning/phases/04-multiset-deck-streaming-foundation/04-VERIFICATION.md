---
phase: 04-multiset-deck-streaming-foundation
verified: 2026-08-24T18:08:30Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "A human confirms the running app is indistinguishable from shipped v1.0.0 — deal, street navigation, rewind, opponent reveal, card picker and live odds all behave exactly as before"
    reason: "Checkpoint (04-06 Task 2) was resolved via orchestrator-collated evidence rather than a human personally observing: full automated gate inventory (all 8 golden-parity tests, byte-identical diff of simulationApi.test.ts/equity.property.test.ts/cards.ts/rng.ts vs pre-phase base 91d6504, 281/281 full suite, tsc/eslint/build all exit 0) plus partial live-browser observation confirming deal and live-odds convergence and street advance to Flop/Turn behaved normally, before the sweep was cut short by an environmental hidden-pane rAF suspension (browser tab visibility hidden -> 0 rAF ticks measured; diagnosed as standard browser behavior unrelated to this phase's changes, not a regression). This matches the identical override pattern already established and accepted in this project's 01-VERIFICATION.md and 02-VERIFICATION.md for equivalent live-browser checkpoints, under the user's standing no-operator-input directive recorded in 04-DISCUSSION-LOG.md. Independently re-verified by this verifier: re-ran the full suite (281/281), re-diffed the four frozen artifacts against 91d6504 (clean), and re-ran tsc/eslint/build (all exit 0) — the automated two-thirds of the evidence is confirmed first-hand, not merely re-read from the SUMMARY."
    accepted_by: "orchestrator (per user's standing no-operator-input directive, recorded in 04-06-SUMMARY.md; same protocol accepted in 01-VERIFICATION.md and 02-VERIFICATION.md)"
    accepted_at: "2026-08-24T18:02:27Z"
---

# Phase 4: Multiset Deck & Streaming Foundation Verification Report

**Phase Goal:** The deck/shoe model correctly represents 1 or 2 physical decks — two copies of the same card are distinct, trackable objects that never collapse via value-based dedup — and the simulation streaming pipeline is generalized to serve any game, with zero behavioral drift from v1.0 at deckCount=1.
**Verified:** 2026-08-24T18:08:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Roadmap SC1 — at `deckCount=1`, shoe/draw/conditioning/picker behavior is byte-identical to shipped v1.0 | VERIFIED | Independently re-ran `npx vitest run src/engine/deckParity.golden.test.ts src/worker/streamingParity.golden.test.ts` — 8/8 pass, reproducing the exact literal `remainingDeck` orderings and seeded tallies recorded pre-refactor. Independently re-diffed `src/worker/simulationApi.test.ts`, `src/engine/equity.property.test.ts`, `src/engine/cards.ts`, `src/engine/rng.ts` against pre-phase base `91d6504` — `git diff --exit-code` returned 0 (byte-identical) on all four. |
| 2 | Roadmap SC2 — 2-deck multiset invariants: two physical copies coexist, drawn without replacement from `52 × deckCount`, never collapsed via value-based Set/Map dedup | VERIFIED | `src/engine/shoe.ts` read directly: `shoeWithout` walks a count budget (`Map<Card, number>`), no `new Set`/`.includes(` anywhere. `src/engine/shoe.test.ts` (19 tests) + `src/engine/multisetSampling.property.test.ts` (4 `test.prop` properties, read in full) independently confirmed: Property A (2-deck closure by count), Property B (remaining-length formula), Property C (DECK-03 without-replacement guard at both deck counts, 200 samples/case), Property D (deck count measurably changes the pool). Re-ran: `npx vitest run src/engine/shoe.test.ts src/engine/multisetSampling.property.test.ts` — all pass. |
| 3 | Roadmap SC3 — picker's duplicate-blocking is count-aware (blocked after 1 pick at 1 deck, only after 2 at 2 decks), remaining-copy state exposed | VERIFIED | `src/state/pickerStore.ts` read directly: `remainingCopies` and count-aware `setPick` (`heldByOtherSlots >= deckCount`) confirmed, no `.some(` boolean guard remains. `src/state/pickerStore.test.ts` nested `describe('deckCount=2 ...')` block (10 tests) read and independently re-run — covers the DECK-04 headline case (`setPick(...,'As',2)` into a second slot) and the third-copy no-op. Re-ran: `npx vitest run src/state/pickerStore.test.ts src/ui/CardPicker.test.tsx` — 20 + 12 pass. |
| 4 | Roadmap SC4 — generalized streaming runner passes the full existing Hold'em `simulationApi` suite unchanged | VERIFIED | `src/worker/simulationApi.ts` read directly: contains no `while (`, no `currentRunToken`, no `setTimeout` — control flow fully delegated to `createStreamingRunner`. `git diff --exit-code src/worker/simulationApi.test.ts` (frozen file) independently re-confirmed clean against 91d6504. Re-ran `npx vitest run src/worker/simulationApi.test.ts` — 13/13 pass. `src/worker/streamingRunner.ts`/`streamingRunner.test.ts` read directly: zero Hold'em-shaped tokens (`CATEGORY_COUNT`/`categoryCounts`/`heroHole`/`OPPONENT_COUNT`/`knownBoard` all absent), WR-01 same-requestId supersession re-proven against a fake non-poker config (`streamingRunner.test.ts:200`). |
| 5 | DECK-01 source-shape rule ("no value-based Set/Map dedup anywhere in the shoe path") is permanently enforced, not just achieved once | VERIFIED | `src/engine/shoePath.guard.test.ts` read in full (12 tests). Independently falsified: temporarily inserted `const x = new Set<Card>([]);` into `src/engine/shoe.ts`, re-ran the guard — it failed with the intended message ("shoe.ts must never call new Set(..."), then reverted (`git diff --exit-code src/engine/shoe.ts` confirmed clean). This is first-hand confirmation of the guard's claimed falsification, not a re-read of the SUMMARY's narrative. |
| 6 | D-10 — more than 216 pre-existing tests stay green, zero skipped, no v1 assertion loosened | VERIFIED | Independently ran `npm test` — 29 test files, **281/281** passing, 0 failed, 0 skipped. `npx tsc -b` and `npx eslint .` both exit 0. `npm run build` exits 0 and produces the `simulation.worker` chunk. |
| 7 | A human confirms the running app is indistinguishable from shipped v1.0 (deal, streets, rewind, reveal, picker, live odds unchanged) | PASSED (override) | See frontmatter override. Checkpoint resolved via orchestrator-collated automated evidence plus a partial live-browser pass, following the identical precedent set and accepted in Phase 1/2 VERIFICATION.md for this project. |

**Score:** 7/7 truths verified (6 directly verified, 1 via documented override matching established project precedent)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/engine/deckParity.golden.test.ts` | Literal v1 `remainingDeck` ordering + seeded tallies, tagged GOLDEN | VERIFIED | Exists, 5 tests, re-run green, `GOLDEN` token present, guarded against `.skip`/`.todo` by `shoePath.guard.test.ts`. |
| `src/worker/streamingParity.golden.test.ts` | Literal v1 worker final-snapshot + emission-shape golden | VERIFIED | Exists, 3 tests, re-run green. |
| `src/engine/shoe.ts` | `DeckCount`, `buildShoe`, `shoeSize`, `cardCounts`, `shoeWithout` — count-aware, no `Set` | VERIFIED | Read in full; matches target contract exactly; `new Set` count is 0. |
| `src/engine/shoe.test.ts` | Exact-value + property tests incl. v1-parity and multiset closure | VERIFIED | 19 tests, re-run green. |
| `src/engine/conditioning.ts` | `deriveConditionedState` threading optional `deckCount`, routed through `shoeWithout` | VERIFIED | Read in full; D-02 sole-reader guard extended, not replaced; `FULL_DECK`/`new Set` both absent. |
| `src/engine/equity.ts` | `ConditionedState.deckCount?: DeckCount` (optional) | VERIFIED | Read in full; field is optional as required by the critical constraint; `unknownCardsPerTrial`/`runTrials` untouched. |
| `src/engine/multisetSampling.property.test.ts` | 2-deck closure + DECK-03 without-replacement guard | VERIFIED | Read in full, 4 properties, `runTrials` correctly absent (avoids the evaluator duplicate-card crash), re-run green. |
| `src/state/pickerStore.ts` | Count-aware `setPick` + `remainingCopies` selector | VERIFIED | Read in full; matches target contract; `.some(` guard removed. |
| `src/state/pickerStore.test.ts` | v1 suite + additive `deckCount=2` describe block | VERIFIED | 20 tests, 10 pre-existing bodies unedited (`git diff --numstat` reports 0 deletions per SUMMARY, consistent with file content read), 10 new. |
| `src/ui/CardPicker.tsx` | Disabled-state driven by `remainingCopies`, behavior-identical at 1 deck | VERIFIED | Read in full; `new Set` absent; copy-string contract (`Already used in this hand`, `(used)`) intact; 12 pre-existing tests pass unmodified. |
| `src/worker/streamingRunner.ts` | Game-generic `createStreamingRunner`: supersession, batching, throttling, cancellation, done semantics | VERIFIED | Read in full; zero Hold'em-shaped tokens; WR-01 identity-based supersession comment intact. |
| `src/worker/streamingRunner.test.ts` | Generic-level proofs incl. WR-01 same-requestId guard, via non-poker fake config | VERIFIED | 12 tests, re-run green; WR-01 test named explicitly. |
| `src/worker/simulationApi.ts` | Thin Hold'em config; deck-count-aware length + per-value overlap budget | VERIFIED | Read in full; `createStreamingRunner` wired; `shoeSize`/`cardCounts` used; overlap check rewritten to a per-value budget with the frozen error-message prefix intact. |
| `src/engine/shoePath.guard.test.ts` | Source-level DECK-01 enforcement + D-07/D-10 untouchable-artefact guards | VERIFIED | Read in full, 12 tests; independently falsified (see Truth 5) and confirmed to fail on a real violation, then cleanly reverted. |
| `src/ui/node-builtins.d.ts` | Scoped Node built-in extension (+`readFileSync`) | VERIFIED | Read in full; exactly one symbol added; `@types/node` not reintroduced into `tsconfig.app.json`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `shoe.ts` | `cards.ts` | `buildShoe` repeats `FULL_DECK` rather than a second 52-card source | WIRED | Confirmed by source read; `cards.ts` byte-unmodified (`git diff --exit-code` clean vs 91d6504). |
| `conditioning.ts` | `shoe.ts` | `remainingDeck` derived via `shoeWithout(deckCount, knownCards)` | WIRED | Confirmed by source read; `new Set`/`FULL_DECK` both absent from `conditioning.ts`. |
| `equity.ts` | `shoe.ts` | type-only import of `DeckCount` for the optional field | WIRED | Confirmed by source read. |
| `pickerStore.ts` | `shoe.ts` | `DeckCount`/`cardCounts` reused, not re-derived | WIRED | Confirmed by source read. |
| `CardPicker.tsx` | `pickerStore.ts` | `remainingCopies(picks, card, deckCount)` drives disabled state | WIRED | Confirmed by source read; `handlePick` still calls `setPick(openSlot, card)` with no third argument — see WR-01 below (non-blocking this phase, tracked forward). |
| `simulationApi.ts` | `streamingRunner.ts` | `createSimulationApi` returns `createStreamingRunner(...)` | WIRED | Confirmed by source read; zero control-flow left in `simulationApi.ts`. |
| `simulationApi.ts` | `shoe.ts` | `shoeSize(deckCount)` replaces the hardcoded 52; `cardCounts` drives the overlap budget | WIRED | Confirmed by source read. |

### Data-Flow Trace (Level 4)

Not applicable in the standard sense — this is an engine/store-only phase with no new rendering surface (per the phase's `<mvp_note>` and D-09). The one UI file touched (`CardPicker.tsx`) renders from `remainingCopies`, which is a pure function over `usePickerStore`'s live `picks` state (not a hardcoded/static value) — confirmed by source read. No hollow-prop or disconnected-data pattern found.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full regression suite | `npm test` | 29 files, 281/281 passing, 0 skipped | PASS |
| Type-check | `npx tsc -b` | exit 0 | PASS |
| Lint | `npx eslint .` | exit 0 | PASS |
| Production build (incl. worker chunk) | `npm run build` | exit 0, `simulation.worker-*.js` chunk produced | PASS |
| All phase-4 test files together | `npx vitest run src/engine/deckParity.golden.test.ts src/worker/streamingParity.golden.test.ts src/engine/shoe.test.ts src/engine/multisetSampling.property.test.ts src/state/pickerStore.test.ts src/ui/CardPicker.test.tsx src/worker/simulationApi.test.ts src/engine/shoePath.guard.test.ts` | 8 files, 88/88 passing | PASS |
| DECK-01 guard falsification | inject `new Set<Card>([])` into `shoe.ts`, re-run guard, revert | Guard failed with the intended message; revert confirmed clean via `git diff --exit-code` | PASS |
| Byte-frozen artifact check | `git diff --exit-code 91d6504 -- src/worker/simulationApi.test.ts src/engine/equity.property.test.ts src/engine/cards.ts src/engine/rng.ts` | exit 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| DECK-01 | 04-01, 04-02, 04-03, 04-05, 04-06 | Deck/shoe model supports 1-2 physical decks with physical-card identity; no value-based `Set` dedup anywhere in the shoe path | SATISFIED | `shoe.ts`'s count-aware `shoeWithout`, `conditioning.ts`/`pickerStore.ts`/`CardPicker.tsx`/`simulationApi.ts` all confirmed free of `Set<Card>`/`new Set(` (except the one allowlisted `VALID_BOARD_LENGTHS`), and `shoePath.guard.test.ts` permanently enforces this — independently falsification-tested by this verifier. |
| DECK-03 | 04-01, 04-03, 04-05 | All trial sampling draws without replacement from the finite `deckCount×52 − known` shoe | SATISFIED | `multisetSampling.property.test.ts` Property C (200 samples/case, both deck counts, `sampleCount + knownCount <= deckCount` asserted); `simulationApi.ts`'s `shoeSize(deckCount)`-based length check and per-value overlap budget. |
| DECK-04 | 04-04, 04-06 | Card picker's duplicate blocking is count-aware; remaining-copy state exposed | SATISFIED | `pickerStore.ts`'s `remainingCopies` + count-aware `setPick`; `pickerStore.test.ts`'s `deckCount=2` block (10 tests) covers the exact headline behavior. |

No orphaned requirements: REQUIREMENTS.md traceability maps only DECK-01, DECK-03, DECK-04 to Phase 4 (DECK-02 is Phase 8); all three appear in at least one plan's `requirements:` frontmatter and are independently evidenced above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/ui/CardPicker.tsx` | 42-44 | `handlePick` calls `setPick(openSlot, card)` without the third `deckCount` argument, while `isUsed` reads the module-level `deckCount` const (04-REVIEW WR-01) | Info (tracked, not a Phase 4 blocker) | Does not affect this phase's behavior (both values are 1 today, confirmed by source read and 12 passing `CardPicker.test.tsx` tests). It is a real foot-gun for Phase 8's deck-count toggle; the misleading comment was already corrected in commit `c29091a`, and the risk is explicitly recorded in `.planning/STATE.md` (`e839dce`) as a Phase 8 must-fix. Verified independently: STATE.md entry and the corrected comment both exist as claimed. |
| `src/worker/simulationApi.ts` | 42 | `validateConditionedState` never validates `deckCount` itself is `1 \| 2` (04-REVIEW WR-02) | Info (tracked, not a Phase 4 blocker) | No production call site this phase ever sets `deckCount` to anything but 1 or 2 (only `deriveConditionedState`'s defaulted parameter produces it). Recorded in STATE.md as a Phase 6 should-fix. |
| `src/worker/simulationApi.ts` | 39-49 | Validation now accepts `deckCount=2` but `runTrials`→`evaluateHand` crashes on duplicate-card hands (04-REVIEW WR-03) | Info (tracked, not a Phase 4 blocker) | No production code path constructs a `deckCount:2` request this phase (confirmed: `App.tsx`/`OddsTable.tsx` call `deriveConditionedState` with 3 arguments, defaulting to 1). Duplicate-aware evaluation is explicitly Phase 7 scope per ROADMAP.md. Recorded in STATE.md. |
| `src/engine/shoePath.guard.test.ts` | 28-59 | Guard only bans `Set<Card>`/`new Set(` substrings; an `.includes()`-based membership rewrite would bypass it, and `CardPicker.tsx` has no behavioral 2-deck test (04-REVIEW WR-04) | Info (tracked, not a Phase 4 blocker) | `shoe.ts`/`conditioning.ts` are independently backstopped by behavioral closure properties even if the guard were bypassed there; only the picker UI lacks a 2-deck behavioral test, and the picker UI ships no 2-deck-reachable surface this phase (`deckCount` pinned to 1, D-09). Recorded in STATE.md as a Phase 7 should-fix. |
| various (IN-01 .. IN-06 in 04-REVIEW.md) | — | Minor docstring-accuracy and defensive-hardening notes (double-tracked `trialsCompleted` counters, an overlap-check comment underselling its own strictness, no `batchSize<=0` guard, missing "rejected-request doesn't disturb an in-flight run" test, line-number citations in comments) | Info | None affect Phase 4's success criteria; all independently confirmed as accurately described by the review by direct source read; none touch DECK-01/03/04 behavior at `deckCount=1`. |
| — | — | Debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) | None found | `grep` across all 15 phase-4-touched files returned zero matches. |

No BLOCKER-severity anti-patterns found. The 4 warnings above are pre-existing, human-reviewed findings from `04-REVIEW.md` (0 critical / 4 warning / 6 info), explicitly scoped to `deckCount=2` code paths that are not reachable from the shipped UI this phase, and are already tracked forward into Phases 6, 7, and 8 in `.planning/STATE.md` (commit `e839dce`). None of them contradict a roadmap Success Criterion for Phase 4, which is scoped to `deckCount=1` parity plus engine-level 2-deck invariants (both independently confirmed above).

### Human Verification Required

None outstanding. The phase's one blocking human-verify checkpoint (04-06 Task 2) was already resolved via a documented override — see frontmatter — following the identical precedent established and accepted in this project's Phase 1 and Phase 2 verifications.

### Gaps Summary

No gaps. All four ROADMAP Phase 4 Success Criteria, the DECK-01 source-guard requirement, and the D-10 regression-safety requirement were independently re-verified against the actual codebase (not merely re-read from SUMMARY.md claims): the full 281/281 test suite was re-run, `tsc`/`eslint`/`build` were re-run clean, the four "untouchable" v1 artifacts were re-diffed byte-identical against the pre-phase commit, the DECK-01 source guard was independently falsified and confirmed to fail on a real violation, and every claimed source file was read in full and found to match its plan/summary description exactly. The four code-review warnings are legitimate but scoped to `deckCount=2` paths unreachable from this phase's shipped surface, and are already tracked forward into the phases that will make them reachable.

---

_Verified: 2026-08-24T18:08:30Z_
_Verifier: Claude (gsd-verifier)_
