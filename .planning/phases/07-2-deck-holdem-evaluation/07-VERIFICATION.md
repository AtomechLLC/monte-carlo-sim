---
phase: 07-2-deck-holdem-evaluation
verified: 2026-08-24T20:20:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
known_limitations:
  - item: "A5 pip-clipping (badge vs card pips at hero and 64px opponent widths, incl. mid-flip)"
    disposition: "Visually unverified — screenshot compositing blocked in the rAF-suspended pane; routed to the recommended 5-minute human walk (documented in 07-07-SUMMARY step 7 and its live addendum). Non-gating: the SC4 truth itself (visible badge on the second copy) was live-verified in real Chromium."
  - item: "Frame-dependent choreography (deal/flip animation feel, badge riding the fly-in, live convergence ticking)"
    disposition: "Rests on automated end-state assertions plus frame-independent live evidence (real-browser DOM checks under a hidden pane with rAF suspended, per 07-07-SUMMARY addendum). Non-gating per the phase checkpoint's documented routing."
---

# Phase 7: 2-Deck Hold'em Evaluation Layer — Verification Report

**Phase Goal:** Users can play Hold'em over a 104-card (2-deck) shoe with correct, crash-free evaluation of duplicate-card hands, a new Five of a Kind category, and legible duplicate cards on the felt.
**Verified:** 2026-08-24T20:20:00Z (all commands re-run this session against HEAD `7ef1bca`, phase range `343018a..HEAD`, 43 commits)
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (4 ROADMAP Success Criteria + 6 task-mandated must-haves)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | SC1: User can enable 2-deck Hold'em; dealing, picker, street nav, opponent reveal all work over the 104-card shoe | ✓ VERIFIED | Toggle live in `src/ui/HoldemGame.tsx:234-264` (`holdem-deck-toggle`/-1/-2, aria-pressed, A3/A4 titles); `gameStore.ts:139-161` `setDeckCount` full D-02 lifecycle (same-value no-op → A4 refusal → set + mid-hand `deal()`); `deal()` draws from `shoeWithout(get().deckCount, picked)` (`gameStore.ts:70`); CardPicker live `deckCount` subscription (`CardPicker.tsx:30`) wired into `setPick(openSlot, card, deckCount)` (`:48`); odds effect passes `deckCount` into `deriveConditionedState` (`HoldemGame.tsx:120`) with `deckCount` in the dep array (`:160`). Spot-run: `deckCountValidation.test.ts` real end-to-end 2-deck worker run (1000 trials, done:true, 11-length reconciling categoryCounts) + `App.holdemDeckToggle.test.tsx` (11 tests) — green this session. Live-browser addendum: toggle→fresh-deal, reveal at 2 decks, and 2→1 return direction verified in real Chromium. |
| 2   | SC2: Duplicate-containing hands evaluate correctly and never crash — a duplicate-detection gate routes them away from the stock evaluator | ✓ VERIFIED | `src/engine/evaluatorTwoDeck.ts` (562 lines, substantive): stamped `Int32Array(52)` + generation-counter gate (`:98-110`), Five-of-a-Kind branch (`:375`), suit-remap proxy, flush-zone `max(custom, proxy)` (`:422`), extended comparator (`:482-505`). Wired: hoisted per-batch `evalFn`/`cmpFn` selection in `runTrials` (`equity.ts:86-88`) — branch above the loop, 1-deck path never pays the gate; main-thread `lockedInCategory` routes at deckCount 2 (`lockedCategory.ts:42-44`). Spot-run green this session: 36 value-asserting vectors (D-16 — five deuces asserts strength 10, never mere non-throwing), oracle ≡ stock on 25k clean windows, candidate ≡ oracle full-tuple on 20k dup windows, monotonicity, gate totality. `shoePath.guard.test.ts` `evaluateHand(` call-site allowlist (4 files) structurally blocks future unrouted call sites. Production worker chunk carries the gate (`Int32Array(52)` present in `dist/assets/simulation.worker-*.js`). |
| 3   | SC3: Five of a Kind row in the odds table in 2-deck mode, ranked above Royal Flush, with a correct probability | ✓ VERIFIED | `CATEGORY_LABELS_TWO_DECK = [...CATEGORY_LABELS, 'Five of a Kind']` (derived, `categoryLabels.ts`); `OddsTable.tsx:39` selects the row source by deckCount; last DOM row of the ascending table = above Royal Flush (D-09 amended), conditional testid `category-five-of-a-kind` at `FIVE_OF_A_KIND_INDEX` (derived from `CATEGORY_COUNT`, `protocol.ts:21`). Data flows end-to-end: `runTrials` sizes the histogram `categoryCountFor(deckCount)` (`equity.ts:89`) → grow-on-merge in `simulationApi.ts` `mergeBatch` (`:108-119`) → length-tolerant {10,11} oddsStore guard (`oddsStore.ts:68-75`) → `categoryCounts[index] ?? 0` render. Correct probability: both seeded 200k-trial anchors re-run green this session — conditional 232 ∈ [179,269] (closed form 1.1204e-3), marginal 35 ∈ [15,48] (1.5792e-4). Locked-in tick reaches index 10 via the wrapper's extended return. 1-deck DOM-absence pinned both ways (`OddsTableTwoDeck.test.tsx`). Live addendum: 11 rows with `category-five-of-a-kind` last, in real Chromium. |
| 4   | SC4: Two copies of the same card are visually distinguishable via a visible copy-cue badge | ✓ VERIFIED | `src/ui/copyCue.ts` pure canonical-scan derivation (hero → board in street order → revealed opponents by seat); `PlayingCard.tsx:118-121` renders the aria-hidden `×2` badge (`holdem-copy-cue`) + visually-hidden sentence "Second copy — two physical copies of this card are in play"; threaded through all three face-up felt paths (Seat/FlipCard/HandDisplay/BoardDisplay); styled in `App.css:898-900` (`.card-slot--cued` position:relative) and `:911+` (`.copy-cue`, solid felt-dark fill per A6 contrast fix). 31 tests green (13 derivation vectors + 18 render pins incl. both-ways DOM absence and gate neutrality). Live addendum: first 2-deck deal produced two Sevens of Spades with the badge on exactly the second copy, in real Chromium. A5 pip-clipping half: see Known Limitations. |
| 5   | HE2-01 requirement satisfied in the shipped app | ✓ VERIFIED | = Truth 1 evidence; plus A9 picker titles ("1 of 2 copies used" / "Both copies already used in this hand") byte-present in the production bundle (probe count 1 each). |
| 6   | HE2-02 requirement satisfied (duplicate-aware layer + Five of a Kind above Royal Flush with its own row) | ✓ VERIFIED | = Truths 2 + 3 evidence, jointly. |
| 7   | HE2-03 requirement satisfied (copy cue — a duplicate never reads as a rendering bug) | ✓ VERIFIED | = Truth 4 evidence; screen-reader delivery split (A11) pinned at both deck counts. |
| 8   | D-11: Hold'em 1-deck byte-identity + zero blackjack changes over the phase range | ✓ VERIFIED | Re-run this session: `git diff --stat 343018a..HEAD` over both goldens (`deckParity.golden.test.ts`, `streamingParity.golden.test.ts`), `simulationApi.test.ts`, `lockedCategory.test.ts`, the five frozen v1 App suites, `index.css`, `conditioning.ts` → **EMPTY**. All 27 `git ls-files`-matched blackjack files → **EMPTY** diff. All of these ran green inside this session's full-suite run. 1-deck never pays the gate (hoist, Truth 2). |
| 9   | Trap ledger final state (WR-01 / WR-03 / WR-04 / CR-02 / pickerStore) | ✓ VERIFIED | **WR-01 CLOSED:** `CardPicker.tsx:30` live subscription + `:48` setPick third arg, behavioral regression detector green. **WR-03 RETIRED:** `deckCountValidation.test.ts:106` end-to-end 2-deck acceptance; rejection string `runSimulation: remainingDeck must have exactly 102 cards, got 101` preserved verbatim at `:147` in a plainly-titled sibling; the unrelated "05-REVIEW WR-03" comments intact at `App.tsx:7` and `HoldemGame.tsx:29`. **WR-04 CLOSED:** `shoePath.guard.test.ts:139-144` `noIncludesFiles` covers the five shoe-path files incl. `engine/evaluatorTwoDeck.ts`; `evaluateHand(` allowlist at `:197-221` with the routing failure message. **CR-02 INTACT:** `HoldemGame.tsx:133` dealNonce generation guard, exactly one `cancelSimulation(` call site (`:154`). **pickerStore ADDITIVE-ONLY:** the entire phase-range diff of `pickerStore.ts` is the single `+ hasDuplicatePick` block — zero removed/modified lines. |
| 10  | Review fixes present (IN-01, IN-02) and no regression across the six gates | ✓ VERIFIED | **IN-01:** `OddsTable.tsx:12-13` per-field selectors (`useOddsStore((state) => state.categoryCounts)` / `.trialsCompleted`). **IN-02:** `protocol.ts:48-52` `ProgressSnapshot.categoryCounts` doc now states 10/11 by deck count with "iterate by ARRAY LENGTH, never 0..CATEGORY_COUNT-1". **Regression (all re-run this session):** `npx vitest run` → 62 files / 863 tests, 0 failures, 0 skipped; `npx tsc --noEmit` exit 0; `npx eslint .` exit 0; `npm run build` exit 0 (pre-existing chunk-size advisory only). |

**Score:** 10/10 must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/engine/evaluatorTwoDeck.ts` | Gate + 5oaK + proxy + flush zone + comparator | ✓ VERIFIED (562 lines) | Exists, substantive, wired into `equity.ts` + `lockedCategory.ts`; ships in the production worker chunk |
| `src/engine/twoDeckOracle.ts` | Test-only brute-force arbiter | ✓ VERIFIED | Zero production imports; guard-pinned out of the production graph |
| `src/engine/equity.ts` | Hoisted per-batch evaluator selection | ✓ VERIFIED | `deckCount ===` only above the loop (`:86-88`); one loop serves both counts |
| `src/worker/protocol.ts` | `FIVE_OF_A_KIND_INDEX` / `categoryCountFor` + IN-02 doc fix | ✓ VERIFIED | Derived constants; doc fix present |
| `src/worker/simulationApi.ts` | Grow-on-merge | ✓ VERIFIED | `mergeBatch` zero-extends to batch length; `makeEmptyTotals` stays `CATEGORY_COUNT` |
| `src/state/oddsStore.ts` | Length-tolerant {10,11} dev guard | ✓ VERIFIED | Widened, never switched to 11; sum check unchanged |
| `src/state/gameStore.ts` | `deckCount` + D-02 `setDeckCount` + count-aware `deal()` | ✓ VERIFIED | Full lifecycle incl. A4 refusal via shared `hasDuplicatePick` |
| `src/state/pickerStore.ts` | Additive `hasDuplicatePick` only | ✓ VERIFIED | Phase diff is purely additive |
| `src/ui/CardPicker.tsx` | WR-01 wire (live deckCount → setPick) | ✓ VERIFIED | Both halves present; A9 titles derived from the same counting source |
| `src/ui/HoldemGame.tsx` | D-01 toggle + deckCount-aware effect + CR-02 guard | ✓ VERIFIED | Last control-bar child; dealNonce guard at `:133` |
| `src/ui/copyCue.ts` + `PlayingCard.tsx` + felt paths | Canonical-scan cue + ×2 badge | ✓ VERIFIED | All three face-up paths threaded; DOM-absent at 1 deck |
| `src/ui/categoryLabels.ts` / `OddsTable.tsx` / `lockedCategory.ts` | Derived 11-row source + conditional row + routed tick | ✓ VERIFIED | Derived spread; `git grep "Five of a Kind"` in categoryLabels.ts → exactly 1 occurrence |
| `src/App.css` | `.copy-cue` / `.card-slot--cued` + toggle selector-list extensions | ✓ VERIFIED | Present in source and in the built CSS bundle |
| `src/App.modeShell.guard.test.ts` / `shoePath.guard.test.ts` | Retargeted sweeps + WR-04 extension | ✓ VERIFIED | Both green this session (part of the 178-test targeted run) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Toggle click (`HoldemGame.tsx`) | Fresh deal + cache clear | `setDeckCount` → `deal()` | ✓ WIRED | D-03 suite pins both directions with distinct-values trick; negative control (severed pass-through) turned 4 tests red in 07-05 |
| `deal()` | 104-card shoe | `shoeWithout(deckCount, picked)` | ✓ WIRED | Per-value cap ≤2 asserted via `cardCounts` |
| `runTrials` | Duplicate-aware evaluator | Hoisted `evalFn`/`cmpFn` | ✓ WIRED | E2E worker test completes a real 2-deck run |
| Worker snapshots | Odds table row | grow-on-merge → oddsStore → `categoryCounts[10]` | ✓ WIRED | 11-length snapshots reconcile (sum === trialsCompleted); row renders live value |
| `OddsTable` | Duplicate-safe main-thread evaluation | `lockedInCategory(..., deckCount)` | ✓ WIRED | Memo deps include deckCount; RED evidence in 07-06 showed the unrouted memo crashing |
| Runout/street/mask/deckCount | Copy-cue badge | `copyCuedSlots` → `copyCue` prop → PlayingCard | ✓ WIRED | Live-browser confirmed on a real duplicate deal |
| CardPicker | Count-aware picks | live `deckCount` → `setPick` third arg | ✓ WIRED | Second copy pickable at 2 decks, third blocked (behavioral tests) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `OddsTable.tsx` | `categoryCounts` (index 10) | worker `runTrials` → `mergeBatch` → snapshot → oddsStore | Yes — E2E test: 1000 trials, 11-length, sum reconciles; anchors give nonzero in-band 5oaK counts | ✓ FLOWING |
| `OddsTable.tsx` | `lockedIndex` | `deriveConditionedState` → `lockedInCategory` | Yes — returns 10 on a five-of-a-kind river window (test-pinned) | ✓ FLOWING |
| `PlayingCard.tsx` | `copyCue` | `useCopyCuedSlots` (gameStore runout/street/mask/deckCount) | Yes — live-browser badge on a real dealt duplicate | ✓ FLOWING |
| `HoldemGame.tsx` toggle | `deckCount` | `useGameStore` | Yes — aria-pressed flips, fresh deal fires, payload carries `deckCount: 2` + 102-card remainingDeck | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Oracle parity + property suite + 36 evaluator vectors + anchors + E2E 2-deck worker run | `npx vitest run src/engine/evaluatorTwoDeck.test.ts src/engine/evaluatorTwoDeck.property.test.ts src/engine/fiveOfAKindFrequency.test.ts src/worker/deckCountValidation.test.ts` | 4 files / 62 tests, 0 failures | ✓ PASS |
| Phase 7 UI suites + both guard suites | `npx vitest run` (OddsTableTwoDeck, lockedCategoryTwoDeck, holdemDeckToggle, copyCue ×2, CardPicker, shoePath.guard, modeShell.guard) | 8 files / 178 tests, 0 failures | ✓ PASS |
| Full regression suite | `npx vitest run` | 62 files / 863 tests, 0 failures, 0 skipped | ✓ PASS |
| Type check / lint / build | `npx tsc --noEmit` / `npx eslint .` / `npm run build` | exit 0 / exit 0 / exit 0 (pre-existing chunk advisory only) | ✓ PASS |
| Production bundle carries Phase 7 | grep of fresh `dist/` | "Five of a Kind" ×3, all 3 toggle testids, copy-cue testid + sentence + titles ×1 each; CSS has `.copy-cue`/`.card-slot--cued`/5 toggle selectors; worker chunk has `Int32Array(52)` + frozen boundary string | ✓ PASS |

### Probe Execution

No conventional (`scripts/*/tests/probe-*.sh`) or plan-declared probes exist in this project — not applicable.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| HE2-01 | 07-02, 07-03, 07-05, 07-07 | 2-deck variant: dealing/picker/street-nav/reveal over 104-card shoe | ✓ SATISFIED | Truth 1 |
| HE2-02 | 07-01, 07-03, 07-06, 07-07 | Duplicate-aware evaluation; 5oaK above Royal Flush with own row | ✓ SATISFIED | Truths 2 + 3 |
| HE2-03 | 07-04, 07-05, 07-07 | Copy cue — duplicates visually legible | ✓ SATISFIED | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps exactly HE2-01..03 to Phase 7 and all three are claimed by plans. (Bookkeeping note: the REQUIREMENTS.md traceability table still lists the three as "Pending" — an orchestrator-owned status flip, not a code gap.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | — | — | Zero TBD/FIXME/XXX across all 38 phase-modified src files. All "placeholder" matches are the shipped dashed-card-slot design vocabulary, retired-placeholder documentation in guard tests, or the guard's own `.skip`/`.todo` prohibition assertions — none are stubs. |

### Known Limitations (recorded per the phase checkpoint's routing — not gating)

1. **A5 pip-clipping** — whether the ×2 badge visually clears the card pips at both the hero width and the 64px opponent width, including mid-flip, is unverified by any automated or screenshot means (compositing blocked in the rAF-suspended live-browser pane). The SC4 truth itself (visible badge on the second copy, correct placement, solid high-contrast fill) IS verified in real Chromium. Routed to the recommended ~5-minute human walk (`npm run dev`), as documented in 07-07-SUMMARY step 7 and its live addendum.
2. **Frame-dependent choreography** — deal/flip animation feel, the badge riding the fly-in, and watching the Five of a Kind percentage tick upward live rest on automated end-state assertions plus frame-independent real-browser DOM evidence (11-row table, badge on a real dealt duplicate, fresh-deal on toggle, return direction). Documented in 07-07-SUMMARY.

### Gaps Summary

None. All four ROADMAP success criteria are delivered by concrete, substantive, wired code with value-asserting tests (oracle parity on 20k duplicate windows, two in-band seeded 200k-trial frequency anchors, a real end-to-end 2-deck worker run) and frame-independent live-browser confirmation of the visible payoffs. D-11 byte-identity holds at the git level over the full 43-commit range (empty diffs on both goldens, the five frozen v1 suites, both frozen contract suites, index.css, conditioning.ts, and all 27 blackjack files — all green in this session's full-suite run). The blocker ledger closes exactly as specified: WR-01 closed, WR-03 retired with the rejection string preserved and the unrelated 05-REVIEW WR-03 comments untouched, WR-04 closed with negative-control-demonstrated guards, CR-02 intact, pickerStore additive-only. Both review Info fixes are present. Full suite 863/863 green with tsc/eslint/build clean, re-verified in this session.

---

_Verified: 2026-08-24T20:20:00Z_
_Verifier: Claude (gsd-verifier)_

> **Correction (2026-08-25, v2.0 milestone audit W-01):** this report cites `npx tsc --noEmit` as its typecheck evidence. That gate is **vacuous in this repo** — the root `tsconfig.json` is solution-style (`files: []` + `references`), so it type-checks nothing and passes against deliberately broken code. The type-safety evidence recorded here is therefore void as written. Re-run at the time of the audit, `npx tsc -b` (the real gate) exits 0 across the whole project, so the CONCLUSION holds — but the evidence cited for it did not support it.
