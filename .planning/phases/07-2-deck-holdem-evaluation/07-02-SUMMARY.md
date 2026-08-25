---
phase: 07-2-deck-holdem-evaluation
plan: 02
subsystem: state
tags: [typescript, zustand, react, vitest, testing-library, holdem, deck-count]
status: complete

# Dependency graph
requires:
  - phase: 04-multiset-deck-streaming-foundation
    provides: "shoeWithout/cardCounts count-aware shoe primitives and pickerStore's count-aware setPick/remainingCopies (DECK-04) — consumed UNMODIFIED except the additive hasDuplicatePick export"
provides:
  - src/state/gameStore.ts — deckCount field (D-14 store-locality) + setDeckCount with the full D-02 lifecycle + deal() over shoeWithout(deckCount, picked)
  - src/state/pickerStore.ts — hasDuplicatePick(picks) additive predicate (the A4 guard's single shared source)
  - src/ui/CardPicker.tsx — live gameStore deckCount subscription + setPick third argument (WR-01 CLOSED) + A9 title states
affects: [07-04, 07-05, 07-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deck toggle lifecycle routes ALL mid-hand side effects through deal() — setDeckCount never arms the gate or touches the odds store itself (D-02)"
    - "Store-boundary refusal as UI-guard backstop: hasDuplicatePick is the ONE predicate behind both the disabled segment (plan 07-05) and setDeckCount's 2->1 refusal"
    - "Picker titles derived from the same remainingCopies counting source as the disabled state — no second duplicate-counting helper, no Set on the shoe path"

key-files:
  created: []
  modified:
    - src/state/gameStore.ts
    - src/state/gameStore.test.ts
    - src/state/pickerStore.ts
    - src/state/pickerStore.test.ts
    - src/ui/CardPicker.tsx
    - src/ui/CardPicker.test.tsx

key-decisions:
  - "setDeckCount branch order AS SHIPPED (plan 07-05's toggle is written against this): (1) same-value early return; (2) A4 refusal — `deckCount === 1 && hasDuplicatePick(usePickerStore.getState().picks)` returns untouched; (3) `set({ deckCount })` then `if (get().runout !== null) get().deal()` — no beginAnimation, no odds-store call anywhere in the body"
  - "hasDuplicatePick exact signature: `export function hasDuplicatePick(picks: PickerDraft): boolean` — counts physical occurrences via cardCounts(pickedCards(picks)), never a Set"
  - "CardPicker's availability helper returns `{ used, title }` from one own-slot-adjusted available count; consumed = deckCount - available selects the A9 title (0 -> none; 1-at-2-decks -> '1 of 2 copies used'; full -> 'Both copies already used in this hand' / 'Already used in this hand')"
  - "The deal() comment cites the 1-deck byte-parity WITHOUT the removed helper's token, keeping the file clean for the acceptance grep (see Deviations)"

patterns-established:
  - "Hold'em-local per-game state cites D-14 and the D-10 store-locality precedent without naming the other game (raw-source sweep discipline)"

requirements-completed: [HE2-01]

# Metrics
duration: 8min
completed: 2026-08-25
---

# Phase 7 Plan 02: gameStore deckCount + deal-over-shoe + CardPicker deckCount wire Summary

**Hold'em owns a local deckCount in gameStore with the complete D-02 toggle lifecycle (same-value no-op, idle set, mid-hand fresh deal, A4 picks-duplicate refusal), deal() draws from the count-aware shoe with 1-deck parity golden-pinned, and CardPicker's pinned `deckCount = 1` is replaced by a live gameStore read wired into setPick — closing 04-REVIEW WR-01 a phase early with a behavioral regression detector.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-25T01:35:28Z (after npm ci in fresh worktree, base `343018a` verified)
- **Completed:** 2026-08-25T01:42:42Z (final full-suite verification)
- **Tasks:** 2 (both RED→GREEN, four commits)
- **Files modified:** 6 (0 created, 6 modified — exactly the plan's files_modified list)

## Task Commits

| Task | Phase | Commit | Message |
|------|-------|--------|---------|
| 1 | RED | `872847c` | test(07-02): add failing tests for Hold'em deckCount, D-02 toggle lifecycle, and hasDuplicatePick |
| 1 | GREEN | `be25807` | feat(07-02): Hold'em deckCount in gameStore with the D-02 toggle lifecycle and a count-aware deal pool (D-02/D-14, HE2-01) |
| 2 | RED | `5cbe2e9` | test(07-02): add failing 2-deck CardPicker behavioral tests (WR-01 regression detector) |
| 2 | GREEN | `bc72058` | feat(07-02): CardPicker reads Hold'em's live deckCount and passes it to setPick, closing WR-01 with behavioral tests (D-07/D-15, HE2-01) |

## Accomplishments

- **setDeckCount D-02 lifecycle, every branch pinned:** same-value click asserts whole-store reference identity (idle AND mid-hand); idle different-value sets the field with dealNonce unchanged, zero arming, cache intact; mid-hand different-value re-deals — dealNonce +1 exactly, gate armed exactly once (spy assertion), cache emptied, street back to preflop, revealedMask 0.
- **A4 store-boundary refusal:** 2→1 with duplicated picks is a COMPLETE no-op — deckCount stays 2, dealNonce unchanged, the whole game store reference-identical, and (the load-bearing guarantee) the picks object reference-untouched. The on-table hand never blocks: 2→1 with duplicate-free picks succeeds mid-hand, and 1→2 is always allowed.
- **Count-aware deal pool:** `deal()` now draws from `shoeWithout(get().deckCount, picked)`. At 2 decks with no picks the runout's per-value cap ≤2 is asserted via `cardCounts` (never Set-size); with both copies of `As` picked into two slots, both land where placed and exactly two `As` exist in the 13 cards.
- **WR-01 closed with both halves in one commit (`bc72058`):** the pinned `const deckCount: DeckCount = 1` became `useGameStore((state) => state.deckCount)` AND `handlePick` passes it as `setPick`'s third argument. The regression detector: at 2 decks the SECOND pick of the same card into a second slot succeeds — asserted against both the rendered slots and the store draft — which goes red if either half is reverted.
- **A9 picker presentation:** 2-deck titles land verbatim (`1 of 2 copies used` on the enabled second copy, `Both copies already used in this hand` on the fully-consumed disabled cell); the visible `{card} (used)` suffix and disabled logic are byte-identical at both counts; a 1→2 store switch re-enables a `(used)` cell in the same render. A dedicated test pins that at 1 deck no cell ever carries either 2-deck title.

## Harness Edits (enumerated, with justification)

1. **`src/state/gameStore.test.ts`** — both pre-existing `beforeEach` reset objects gained `deckCount: 1` (with in-file comments): without it a 2-deck test leaks into the 1-deck-only "13 distinct cards" assertions, which are only valid at one deck (07-PATTERNS trap 8 / T-07-10). No existing test bodies were edited; two new describe blocks (deal pool, setDeckCount) are purely additive and copy the analog store-test conventions (beginAnimation spy `arms()`, whole-store reference-identity no-op assertions).
2. **`src/ui/CardPicker.test.tsx`** — `beforeEach` gained `useGameStore.setState({ deckCount: 1 })` (with an in-file comment): the picker now subscribes to gameStore, a NEW test-isolation surface this file never had to reset before (07-PATTERNS trap 9). The two shipped 1-deck used-state tests are unmodified and green (D-11 byte-identical-at-one-deck contract).

## Frozen-Artifact Confirmation

- `git diff --stat 343018a HEAD` lists exactly the six planned files — both goldens (`src/engine/deckParity.golden.test.ts`, `src/worker/streamingParity.golden.test.ts`) and the five frozen v1 suites (`App.test.tsx`, `App.acceptance.test.tsx`, `App.phase3.acceptance.test.tsx`, `App.modeErrorBanner.test.tsx`, `App.modeSwitchRace.test.tsx`) are byte-unmodified across the whole commit range.
- Both goldens ran green in Task 1's verification; all five frozen suites ran green in Task 2's verification.

## WR-03 Compliance Evidence

Nothing in this plan routes deckCount=2 into evaluation:
- `git grep -n "deckCount" -- src/ui/HoldemGame.tsx src/App.tsx src/state/gameModeStore.ts src/ui/GameModeSwitcher.tsx` → empty (the modeShell deckCount-zero sweep is untouched; its retarget belongs to plan 07-05).
- `HoldemGame.tsx` and every `deriveConditionedState` call site are unchanged (diff scope is the six files only).
- The new tests contain zero occurrences of `runTrials`/`deriveConditionedState`/`startSimulation` (grep-verified) — all coverage is store/component-level; no trial ever runs at deckCount=2.
- `deckCount` defaults to 1 and nothing outside tests sets it to 2.

## Raw-Source Sweep Evidence

- `git grep -in "blackjack\|gamemode" -- src/state/gameStore.ts src/state/pickerStore.ts` → empty (comments included).
- No `new Set(` / `Set<Card>` in `src/state/pickerStore.ts` or `src/ui/CardPicker.tsx` (shoePath guard list).
- `setDeckCount`'s body contains no `beginAnimation` call and no `useOddsStore` reference (its only `beginAnimation` token is the plan-mandated "must NOT call" comment).

## Test-Count Delta

- **Baseline:** 52 files / 697 tests at `7d8fb13`.
- **After:** 52 files / **718 tests**, 0 failed, 0 skipped (+21: 13 in the store suites, 8 in CardPicker — all additive; no pre-existing test modified).
- `npx tsc --noEmit` clean; `npx eslint .` clean (no new inline eslint-disable); `npm run build` exits 0.

## Deviations from Plan

**1. [Rule 1 - Bug] deal() comment rephrased to satisfy the `deckWithout`-absence acceptance grep**
- **Found during:** Task 1 acceptance-criteria check
- **Issue:** The plan's action text asked for a comment citing the `shoeWithout(1, x)` ≡ `deckWithout(x)` equivalence, but its acceptance criterion requires the file to "no longer contain `deckWithout`" — the first draft of the comment contained the token.
- **Fix:** Reworded to "reproduce the previous single-deck pool helper's output exactly", preserving the equivalence citation (shoe.ts ordering note + deckParity golden) without the token.
- **Files modified:** src/state/gameStore.ts
- **Commit:** `be25807` (fixed before the GREEN commit)

No other deviations — the plan executed as written.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data paths were introduced; the deckCount UI entry point is deliberately absent by design (plan 07-05 owns it, WR-03).

## Threat Flags

None. No new surface beyond the plan's threat model: T-07-07 (both WR-01 halves + behavioral detector), T-07-08 (goldens untouched/green), T-07-09 (store refusal shipped), T-07-10 (both harness resets shipped), T-07-11 (sweep greps re-run, empty). No package installs (T-07-SC: `npm ci` from the committed lockfile only).

## Self-Check: PASSED

- All six modified files exist on disk and match the diff scope.
- All four task commits present in `git log`: 872847c, be25807, 5cbe2e9, bc72058.
- Full suite 718/718 green; tsc, eslint, build all clean.
