---
phase: 08-cross-game-deck-toggle
plan: 02
subsystem: ui
tags: [typescript, react, vitest, deck-toggle, consolidation-suite, cross-game, DECK-02]
status: complete

# Dependency graph
requires:
  - phase: 08-cross-game-deck-toggle
    plan: 01
    provides: "src/ui/DeckCountToggle.tsx (prop surface { testidPrefix, deckCount, onSelect, oneDeckDisabled?, oneDeckTitle?, twoDecksTitle? }), both rewired call sites, and the SC1 source-identity + single-source-of-markup guard pins this suite cross-references"
provides:
  - src/ui/DeckCountToggle.test.tsx — the component-level contract suite for the shared control (props-only, prefix-parameterized, unconditional active-segment select, attribute-absence semantics)
  - src/App.deckToggleConsolidation.test.tsx — the cross-game consolidation suite: one describe per success criterion (SC1/SC2/SC3) plus a per-game guard block, both games exercised through the shared component
affects: [08-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-part SC1 proof, cross-referenced by name in both new files: source identity (App.modeShell.guard.test.ts), byte identity (App.deckToggleDom.golden.test.tsx), rendered contract (this plan's consolidation suite) — so the split can never be read as a gap"
    - "Merged two shipped App-level harnesses into one file: both explicit-factory service mocks + the drawN partial mock, one resetStores() covering both games' stores/odds stores/picker/gate/mode, and BOTH distinct-value snapshot fixtures (callIndex for Hold'em, bjCallIndex for blackjack) so a cache-served number is distinguishable from a fresh one in either game"
    - "Props-only proof by contradiction: render the shared control with a deckCount prop that disagrees with BOTH game stores' live values — the observable form of 'reads no store' (D-01)"

key-files:
  created:
    - src/ui/DeckCountToggle.test.tsx
    - src/App.deckToggleConsolidation.test.tsx
  modified: []

key-decisions:
  - "The Hold'em A4 guard row was split into TWO cases (mid-hand and idle) rather than one: the plan's single sentence chained 'guard title wins while a hand is on the table' with 'clearing one pick re-enables the segment with no title left behind', but those hold in DIFFERENT states — at deckCount 2 with runout !== null, clearing the duplicate correctly restores the A3 fresh-deal title (HoldemGame.tsx L243-249). Both readings are now asserted in the state where each is true; nothing was weakened."
  - "SC1's cross-game case drives the REAL game-mode switcher and adds a round trip back to Hold'em, so 'each mode shows its own count' is proven to survive a visit next door, not just at first render"
  - "Blackjack cases select the mode BEFORE the first render (renderInBlackjack helper) everywhere except the SC1 cross-game case — no gate arming, no incidental mode-switch effects inside the behavior under test"

requirements-completed: [DECK-02]

# Metrics
duration: 12min
completed: 2026-08-24
---

# Phase 8 Plan 02: DeckCountToggle Contract Suite + Cross-Game Consolidation Suite Summary

**DECK-02's second clause — "changing the deck count cancels any in-flight simulation and recomputes all odds under the new shoe" — is now asserted as ONE cross-game contract through ONE control: 23 new tests in two new files, zero source changes, zero edits to any pre-existing test.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-24T21:10Z (base `a5a34cc` verified, `npm ci` in a fresh worktree — 249 packages, 0 vulnerabilities, no `npm install`)
- **Completed:** 2026-08-24T21:22Z (final full-suite + tsc + lint + build gates)
- **Tasks:** 2 (three atomic commits: one per file, plus one follow-up on Task 1's file — see Deviations #2)
- **Files modified:** 2 (2 created, 0 modified — exactly the plan's `files_modified` list)

## Task Commits

| Task | Commit | Message | Files |
|------|--------|---------|-------|
| 1 | `a58187b` | `test(08-02): component-level contract suite for the shared DeckCountToggle` | src/ui/DeckCountToggle.test.tsx (ONLY file — verified by `git show --stat`) |
| 2 | `88d403e` | `test(08-02): cross-game deck-toggle consolidation suite (SC1/SC2/SC3)` | src/App.deckToggleConsolidation.test.tsx (ONLY file) |
| 1 (follow-up) | `8cdb7f6` | `test(08-02): make the guard's *.test.tsx exclusion genuinely exercised` | src/ui/DeckCountToggle.test.tsx (+5 lines, no new test case) |

`git diff --name-status a5a34cc..HEAD` lists exactly two lines, both `A` — no source file, no pre-existing test, no CSS, no testid registry, no planning file other than this SUMMARY.

## Test Inventory

### `src/ui/DeckCountToggle.test.tsx` — 11 tests, one describe (component-level contract)

Rendered from prop fixtures only: no `<App />`, no store wiring, no service mocks. Mirrors the `GameModeSwitcher.test.tsx` checklist. Fabricated prefix `test-deck-toggle` everywhere except the one dedicated D-02 case.

| # | Case | Pins |
|---|------|------|
| 1 | wrapper semantics | `role="group"` + `aria-label="Deck count"` as attribute VALUES; the rendered `outerHTML` carries the literal `aria-label="Deck count"` (see Guard-Sweep Tolerance); the wrapper's children are exactly `[{prefix}-1, {prefix}-2]` in locked order; both `type="button"` |
| 2 | locked labels | `textContent` EQUALITY to `1 deck` / `2 decks`, unchanged across a click + re-render that flips the pressed segment (binding rule 3) |
| 3 | aria-pressed from props | serialized on BOTH segments, `true/false` at count 1 and `false/true` at count 2 (binding rule 4) |
| 4-5 | testid derivation (`it.each`) | all three testids for `blackjack-deck-toggle` AND `holdem-deck-toggle`; both segments are children of the wrapper (D-02) |
| 6 | onSelect argument | `mock.calls` equals `[[2]]` then `[[2],[1]]` — the argument, not the fact of firing |
| 7 | **A4 pin** | clicking the ACTIVE segment still calls `onSelect` with that same count, at BOTH counts (`[[1],[2]]`) — no component-internal suppression in front of the stores' early return (T-08-10) |
| 8 | attribute absence | omitted `oneDeckDisabled`/`oneDeckTitle`/`twoDecksTitle` render NO `title` and NO `disabled` attribute on either segment (binding rule 5, PATTERNS trap 2) |
| 9 | guard shape | segment 1 `disabled` + that exact title VALUE; segment 2 still enabled, still title-free, still the pressed one; re-rendering with the OTHER game's locked string renders that string — no title is hard-coded (binding rule 6, T-08-07) |
| 10 | `twoDecksTitle` | renders on segment 2 as a value, never disables it, never bleeds onto segment 1 |
| 11 | **props-only proof (D-01)** | with `gameStore.deckCount = 1` and `blackjackStore.deckCount = 2`, a `deckCount={2}` render presses segment 2 (contradicting gameStore); then with BOTH stores at 2, a `deckCount={1}` render presses segment 1 (contradicting both). Both stores restored in `afterEach`; the control wrote nothing back |

### `src/App.deckToggleConsolidation.test.tsx` — 12 tests, four describes

| Describe | # | Case | Load-bearing assertions |
|----------|---|------|-------------------------|
| **SC1** | 1 | Hold'em rendered contract | prefix wrapper + `role`/`aria-label` values, `textContent` labels, `aria-pressed` = gameStore's 2 |
| **SC1** | 2 | Blackjack rendered contract | same four, `aria-pressed` = blackjackStore's 2 |
| **SC1** | 3 | **cross-game, contradicting stores (T-08-11)** | gameStore 1 / blackjackStore 2, one render, real switcher clicks: Hold'em presses `-1`, all three `blackjack-deck-toggle*` testids `queryByTestId === null`; Blackjack presses `-2`, all three `holdem-deck-toggle*` null; round trip back proves neither store was cross-written |
| **SC2** | 4 | blackjack mid-round | restarted run hangs → trial counter `0`, all 13 `STAT_CELL_TESTIDS` at the em dash, subtitle at `2-deck shoe` with `1-deck shoe` gone, second call with `mock.calls[1][0].deckCount === 2`, `playerHand ['9h','9c']`, `dealerUpcard '7d'`, `remainingDeck` length 101 |
| **SC2** | 5 | blackjack resolved | trial counter + all 13 cells captured into a Map and byte-identical afterwards; `aria-pressed` flipped and store `deckCount === 2`; call count unchanged at 1; subtitle unchanged |
| **SC2** | 6 | Hold'em mid-hand | `dealNonce` 1→2, street `preflop`, `revealedMask` 0, `settledCache.size` 3→1, 4th run started, cached + displayed win is the FRESH `53` with explicit `not.toBe(52)` and `win-pct` `53.0%` `not.toBe('52.0%')`, `startSim.mock.calls[3][0].deckCount === 2`, fresh entry `categoryCounts` length 11, and `category-pct-10` rendering `1.0%` |
| **SC2** | 7 | Hold'em idle | the "no in-flight simulation to cancel" arm: `aria-pressed` flips, `dealNonce` stays 0, `startSim` never called |
| **SC3** | 8 | blackjack same cards | unchanged `roundNonce`, same `playerHand`, same upcard, `revealedHole` false, phase still `player-turn`; rendered: two player card images by alt text, upcard by alt text, hole-reveal still carrying `"Reveal the dealer's hole card"`, hole identity absent from the DOM |
| **SC3** | 9 | Hold'em announced replacement | idle = no title anywhere; mid-hand the INACTIVE segment carries `title="Switching the shoe deals a fresh hand"` and the active one none; after the click `dealNonce` +1, street `preflop`, `runout` non-null, and the disclosure swaps to the newly inactive segment |
| **Guards** | 10 | blackjack hidden-hole (06-REVIEW WR-01) | 2-deck round with hole `5c` duplicating player `5c`, no VISIBLE duplicate: segment 1 `disabled` + locked title verbatim (em dash included); segment 2 not disabled, no `title` attribute |
| **Guards** | 11 | Hold'em mid-hand A4-beats-A3 | guard title displaces the fresh-deal title on segment 1; a click on the disabled segment leaves picks reference-identical, `deckCount` 2, `dealNonce` and call count unchanged; clearing the duplicate re-enables the segment and the A3 disclosure returns (guard title gone) |
| **Guards** | 12 | Hold'em idle clear | clearing the duplicate re-enables segment 1 with NO `title` attribute left behind on either segment |

### Success-criterion coverage map

| Criterion | Where asserted | Both games? |
|-----------|----------------|-------------|
| SC1 (rendered contract) | consolidation describe 1, cases 1-3 | yes (cases 1, 2, 3) |
| SC2 (cancel + recompute, no stale numbers) | consolidation describe 2, cases 4-7 | yes (4-5 blackjack, 6-7 Hold'em) |
| SC3 (no disruptive mid-hand mutation, D-05) | consolidation describe 3, cases 8-9 | yes (8 blackjack, 9 Hold'em) |
| D-03 per-game guard carry-over | consolidation describe 4, cases 10-12 | yes (10 blackjack, 11-12 Hold'em) |
| D-01 props-only / A4 no-suppression | component suite cases 7 and 11 | n/a (component level) |

## SC1 Cross-Reference (the other two thirds, named in both new files' headers)

- **Source identity (08-UI-SPEC A3):** `src/App.modeShell.guard.test.ts` — both call sites import and render the shared module, neither retains inline segmented markup, and exactly one non-test `src/ui` component contains the group markup. Landed by plan 08-01 in the extraction commit `71a2802`.
- **Byte identity (08-UI-SPEC A2):** `src/App.deckToggleDom.golden.test.tsx` — the nine-state `outerHTML` golden captured against the PRE-extraction inline toggles.
- **Rendered contract (this plan):** `src/App.deckToggleConsolidation.test.tsx` SC1 describe.

Both new files name the other two files explicitly in their header comments, so the three-way split is never read as a gap.

## Guard-Sweep Tolerance of the New `src/ui` Test File (explicitly verified)

The SC1 single-source-of-markup sweep enumerates `src/ui/*.tsx` and excludes `*.test.tsx` — that exclusion was written by plan 08-01 in anticipation of this plan's file, and this is the first run where it is actually load-bearing:

- `npx vitest run src/App.modeShell.guard.test.ts -t "exactly ONE non-test src/ui component"` → **1 passed | 91 skipped**, with the new `src/ui/DeckCountToggle.test.tsx` on disk. `grep -c 'aria-label="Deck count"' src/ui/DeckCountToggle.test.tsx` → **1**, so the sweep really does encounter a `src/ui` file carrying the group markup and really does have to exclude it (see Deviations #2 — as first written, the file used only the two-argument `toHaveAttribute` matcher and never contained the literal, which would have left the exclusion inert).
- Whole guard file with the new sibling present: **92 passed**, unchanged from 08-01's count — no assertion drifted, no message changed, the file is byte-untouched.
- The store-token sweep (`gameStore`, `blackjackStore`, …) reads `ui/DeckCountToggle.tsx` by exact path, so the test file's deliberate store imports (the D-01 props-only case) cannot reach it.
- The resetAnimations sweep likewise reads `ui/DeckCountToggle.tsx` by exact path; the new test file is outside every guard file list.

## Test-Count Delta (entirely additive)

| Point | Files | Tests | Delta explained |
|-------|-------|-------|------------------|
| Baseline (`a5a34cc`, wave 1 complete) | 63 | 893 | — |
| After Task 1 (`a58187b`) | 64 | 904 | +1 file, +11 tests (the component contract suite) |
| After Task 2 (`88d403e`) | 65 | 916 | +1 file, +12 tests (the consolidation suite) |
| After the Task 1 follow-up (`8cdb7f6`) | 65 | 916 | +1 assertion inside an existing case, no test-count change |

**+2 files, +23 tests, 0 removed, 0 modified, 0 skipped.** Every pre-existing suite passes byte-untouched: `App.holdemDeckToggle.test.tsx`, `App.blackjackLoop.test.tsx`, `App.modeIsolation.test.tsx`, `App.modeSwitch.test.tsx`, `App.modeShell.guard.test.ts`, `App.deckToggleDom.golden.test.tsx`, both testid registries, the five frozen v1 suites and `App.holdemCachePoison.test.tsx`.

## Verification Gates (all re-run at `8cdb7f6`, the branch tip)

- `npx vitest run`: **65 files / 916 tests, 0 failures, 0 skipped**
- `npx tsc --noEmit`: clean
- `npm run lint` (`eslint .`): clean, zero inline disables added
- `npm run build` (`tsc -b && vite build`): clean (pre-existing 500 kB chunk-size warning only)
- `git status --short`: empty after the commits; `dist/` is gitignored
- `git diff --diff-filter=D a5a34cc..HEAD`: no deletions

## Invariance-Table Conformance

Every one of the 8 rows behaved exactly as the table states when driven through the shared control — **no observed difference, nothing to route back to plan 08-01**. Row-by-row: blackjack idle (not separately re-asserted here; covered by the resolved row's identical "pending only" semantics and by the shipped `App.blackjackLoop.test.tsx`), blackjack mid-round (case 4), blackjack resolved (case 5), blackjack guard incl. the hidden hole (case 10), Hold'em idle (case 7), Hold'em mid-hand (cases 6, 9), Hold'em mid-hand pre-click affordance (case 9), Hold'em picks guard (cases 11, 12).

No assertion was softened, skipped, or deleted at any point; nothing in either file uses `.skip`/`.todo`, and no `expect` is a bare presence check where a value is checkable (D-09/D-16) — the only `toBeInTheDocument()` calls are on card IMAGES located by their alt-text VALUE and on the subtitle located by its exact text, both of which encode the value in the query itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Assertion would have contradicted shipped locked behavior] Hold'em A4 guard row split into a mid-hand case and an idle case**
- **Found during:** Task 2, writing the per-game guard block
- **Issue:** the plan's guard-row sentence asks, in one breath, for (a) "the guard title WINS over the fresh-deal title **while a hand is on the table**" and (b) "clearing one pick re-enables the segment in the same render **with no `title` attribute left behind**". Those two hold in different states. `HoldemGame.tsx` L243-249 computes segment 1's title as `duplicateInPicks ? GUARD : deckCount === 2 && runout !== null ? FRESH_DEAL : undefined` — so with a hand on the table at 2 decks, clearing the duplicate correctly restores the A3 fresh-deal disclosure. Asserting `not.toHaveAttribute('title')` in that state would have contradicted 07 A3, the invariance table's "Hold'em mid-hand pre-click affordance" row, AND the nine-state DOM golden.
- **Fix:** two cases instead of one, each asserting the reading that is true in its state — case 11 (mid-hand): guard title displaces the fresh-deal title, and after clearing, the fresh-deal title returns while the guard title is explicitly gone; case 12 (idle): after clearing, NO `title` attribute is left behind on either segment. Nothing was weakened — the split adds an assertion rather than removing one, and both arms assert VALUES.
- **Files modified:** src/App.deckToggleConsolidation.test.tsx (Task 2 commit)
- **Commit:** `88d403e`

**2. [Rule 2 - Missing critical coverage] The guard's `*.test.tsx` exclusion was inert as first written**
- **Found during:** Task 2 verification, while checking the orchestrator's explicit ask ("verify that exclusion actually holds when you add the file")
- **Issue:** `src/ui/DeckCountToggle.test.tsx` asserted the group label with `toHaveAttribute('aria-label', 'Deck count')`, which does NOT put the literal string `aria-label="Deck count"` in the file. The SC1 single-source-of-markup sweep searches for exactly that literal, so the sweep was green for the wrong reason: it never had to exclude anything. Plan 08-03's verification could reasonably have read that as the exclusion being unnecessary and dropped it, silently re-arming the trap 08-01 defused.
- **Fix:** one added assertion inside the existing wrapper-semantics case — `expect(wrapper.outerHTML).toContain('aria-label="Deck count"')` — with a comment stating why the literal is deliberate. It is also a genuine value assertion on the rendered serialization (D-09), so it earns its place independently. No new test case, no test-count change.
- **Files modified:** src/ui/DeckCountToggle.test.tsx
- **Commit:** `8cdb7f6`

### Otherwise

Plan executed as written: two files, two atomic commits, zero source edits, zero pre-existing test edits, zero CSS, zero package installs (`npm ci` only, T-08-SC honored), no dev/preview server started, no background process left running.

## Known Stubs

None — both files are complete suites with no placeholder cases, no `.skip`, no `.todo`.

## Threat Flags

None — this plan adds only test files; no network endpoint, auth path, file-access pattern or schema at a trust boundary changed. The plan's register was honored: T-08-09 (distinct-value fixtures + explicit `not.toBe` + the 10-vs-11 histogram asymmetry), T-08-10 (the A4 active-segment case), T-08-11 (the contradicting-stores cross-game case with DOM absence), T-08-12 (two positive SC3 assertions plus the D-05 block comment), T-08-13 (no assertion adjusted; the one plan-text ambiguity was resolved by ADDING a case, and the reasoning is recorded above), T-08-14 (the `drawN` mock scripts every blackjack deal), T-08-SC (zero installs).

## Self-Check: PASSED

- FOUND: src/ui/DeckCountToggle.test.tsx
- FOUND: src/App.deckToggleConsolidation.test.tsx
- FOUND: commit a58187b (component suite, single file)
- FOUND: commit 88d403e (consolidation suite, single file)
- FOUND: commit 8cdb7f6 (Task 1 follow-up, single file, +5 lines)
- VERIFIED: `git diff --name-status a5a34cc..HEAD` = exactly the two added files
- VERIFIED: 65 files / 916 tests green; tsc, eslint and build clean
