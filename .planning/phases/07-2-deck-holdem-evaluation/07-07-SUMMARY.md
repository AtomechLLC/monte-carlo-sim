---
phase: 07-2-deck-holdem-evaluation
plan: 07
subsystem: verification
tags: [regression-sweep, coverage-audit, blocker-ledger, browser-acceptance, phase-gate]
status: complete

# Dependency graph
requires:
  - phase: 07-2-deck-holdem-evaluation
    plan: 01
    provides: "evaluatorTwoDeck module, oracle, D-13 anchors (audited)"
  - phase: 07-2-deck-holdem-evaluation
    plan: 02
    provides: "gameStore deckCount + D-02 lifecycle + WR-01 close (audited)"
  - phase: 07-2-deck-holdem-evaluation
    plan: 03
    provides: "category-index spine, WR-03 retirement, WR-04 guard extension (audited)"
  - phase: 07-2-deck-holdem-evaluation
    plan: 04
    provides: "copy cue derivation + badge + three felt paths (audited)"
  - phase: 07-2-deck-holdem-evaluation
    plan: 05
    provides: "deck toggle, Phase 7 CSS, modeShell retarget, D-03 cache guard (audited)"
  - phase: 07-2-deck-holdem-evaluation
    plan: 06
    provides: "Five of a Kind row + lockedInCategory routing (audited)"
provides:
  - "Phase 7 regression record: 62 files / 863 tests green, all three gates clean"
  - "Blocker-ledger reconciliation: WR-01 CLOSED, WR-03 RETIRED, WR-04 CLOSED, ranking flag RESOLVED, CR-02 intact"
  - "Multi-Source Coverage Audit: every GOAL/REQ/RESEARCH/CONTEXT/UI-SPEC item COVERED"
  - "Checkpoint verdict (agent-executed) with NOT VERIFIED live-browser halves named"
affects: [phase-8, roadmap-phase-7-close]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/07-2-deck-holdem-evaluation/07-07-SUMMARY.md
  modified: []

key-decisions:
  - "Checkpoint resolved agent-verified under the user's standing no-operator-input directive; every live-browser half that automation cannot reach is labelled NOT VERIFIED rather than assumed-pass (T-07-41)"
  - "Preview served on port 4199 (orchestrator checkpoint protocol) instead of the plan's 4319 — both satisfy the distinct-port requirement; a stale out-of-session server holds 5199 and was left untouched"

requirements-completed: [HE2-01, HE2-02, HE2-03]

# Metrics
duration: 14min
completed: 2026-08-25
---

# Phase 7 Plan 07: Regression Sweep, Blocker-Ledger Reconciliation, Coverage Audit and Acceptance Summary

**Phase 7 closes with 62 files / 863 tests green (697-baseline intact plus exactly the six plans' 166 additions), all four drift detectors and 27 blackjack files byte-untouched across the whole range, every carried blocker reconciled with evidence, every source item confirmed shipped, and an agent-executed acceptance pass over the production bundle — with the A5 pip-clipping check and every live-browser half explicitly NOT VERIFIED and routed to the orchestrator's in-app pass.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-08-25T02:42:41Z (base `82b5465` verified, npm ci in fresh worktree)
- **Completed:** 2026-08-25T02:56Z
- **Tasks:** 2 (Task 1 audit auto; Task 2 checkpoint resolved agent-verified per standing directive)
- **Files modified:** 0 source files (this SUMMARY only — the plan changes NO source files by design)

## Task 1 — Regression Sweep

### The three gates (exact figures)

| Gate | Result |
|------|--------|
| `npx vitest run` | **62 test files / 863 tests, 0 failures, 0 skipped**, exit 0 |
| `npm run lint` (`eslint .`) | exit 0, zero output; zero new inline eslint-disable comments anywhere in the phase (each plan's SUMMARY verified this on its own diff; the range diff confirms) |
| `npm run build` (`tsc -b && vite build`) | exit 0 (pre-existing chunk-size advisory only, not a failure) |

### Test-count reconciliation against the 52-file / 697-test baseline

| Stage | Files | Tests | Delta source |
|-------|-------|-------|--------------|
| Pre-phase baseline (`7d8fb13`) | 52 | 697 | — |
| + 07-01 | +3 | +46 | evaluatorTwoDeck, property suite, anchors |
| + 07-02 | +0 | +21 | store suites +13, CardPicker +8 (all additive) |
| + 07-03 | +2 | +22 | equityTwoDeck +7, oddsStoreTwoDeck +5, deckCountValidation +1, shoePath.guard +9 |
| + 07-04 | +2 | +31 | copyCue +13, copyCueRender +18 |
| + 07-05 | +1 | +22 | new suite +11, modeShell style pins +6, testid-list ripple +6, sweep −1 |
| + 07-06 | +2 | +24 | lockedCategoryTwoDeck +11, OddsTableTwoDeck +13 |
| **Final (`82b5465`)** | **62** | **863** | **697 + 166 — arithmetic exact, no unexplained gain or loss** |

The pre-existing 697 are intact: the five frozen v1 App suites, both goldens, `simulationApi.test.ts`, `lockedCategory.test.ts`, `App.holdemCachePoison.test.tsx`, `App.modeIsolation.test.tsx` and `App.modeSwitch.test.tsx` all ran green in this plan's final sweep, and no pre-existing test was deleted, skipped or relaxed (removed-line audit below).

### Pre-existing-test adjustments — full enumeration (exactly the six the plan sanctions, plus the one support file)

The phase-range diff (`343018a..HEAD`) modifies exactly six pre-existing test files. Every removed line across all six was individually audited (31 removed lines total): all are import-list extensions, `beforeEach` reset extensions, comment/title retargets, or the one mandated D-12 test retarget. **Zero deleted cases, zero relaxed assertions, zero `.skip`/`.todo`/`.only` additions** (grep over the six diffs: no match).

1. **`src/state/gameStore.test.ts`** (07-02) — both pre-existing `beforeEach` resets gained `deckCount: 1` (2-deck-leak isolation, 07-PATTERNS trap 8); import line extended (`vi`, `MockInstance`, `cardCounts`); additive `setDeckCount`/deal-pool describe blocks. Mechanical.
2. **`src/state/pickerStore.test.ts`** (07-02) — import extended with `hasDuplicatePick`; additive describe block only. Mechanical.
3. **`src/ui/CardPicker.test.tsx`** (07-02) — `beforeEach` gained `useGameStore.setState({ deckCount: 1 })` (new subscription surface, trap 9); import extended; additive 2-deck describe block. Mechanical.
4. **`src/worker/deckCountValidation.test.ts`** (07-03) — the D-12 retarget of the WR-03 acceptance test (proxy `102 cards, got 101` ride-along → real end-to-end 2-deck run, 11-length reconciling categoryCounts) with the malformed-length rejection preserved as a plainly-titled sibling pinning the exact frozen boundary string. Mandated by D-12; never deleted.
5. **`src/engine/shoePath.guard.test.ts`** (07-03) — one-line `noSetFiles` extension adding `engine/evaluatorTwoDeck.ts`; additive WR-04 `.includes(` prohibition and evaluator call-site/library-import allowlist blocks. Mechanical + mandated (D-07/WR-04).
6. **`src/App.modeShell.guard.test.ts`** (07-05) — the deckCount-sweep retarget (file list 4→3: `ui/HoldemGame.tsx` legitimately owns the wire post-D-12; `App.tsx`, `state/gameModeStore.ts`, `ui/GameModeSwitcher.tsx` keep the sweep with retargeted rationale citing D-01/D-12/D-14, dated AMENDED record added); additive Phase 7 style-contract block (+6 pins). Mandated (D-12, Pitfall 4); retargeted, never weakened.

Plus one non-test support file: **`src/test/holdemTestids.ts`** (07-05) — exactly three additions (`holdem-deck-toggle`, `holdem-deck-toggle-1`, `holdem-deck-toggle-2`) plus a rationale comment, verified on the range diff. No other pre-existing test or test-support file was touched.

### D-11 gates (all confirmed on the phase range `343018a..HEAD`)

| Gate | Result |
|------|--------|
| Four byte-frozen drift detectors (`deckParity.golden.test.ts`, `streamingParity.golden.test.ts`, `simulationApi.test.ts`, `lockedCategory.test.ts`) | `git diff --stat` **EMPTY**; all four green in a named run (part of the 118-test guard/drift artifact run) |
| Five frozen v1 App suites (`App.test.tsx`, `App.acceptance.test.tsx`, `App.phase3.acceptance.test.tsx`, `App.modeErrorBanner.test.tsx`, `App.modeSwitchRace.test.tsx`) | `git diff --stat` **EMPTY**; all green in a named run (162 tests incl. modeIsolation/modeSwitch/cachePoison siblings) |
| Blackjack sweep — all 27 `git ls-files` blackjack-named files (source AND test) | `git diff --stat` **EMPTY** — zero blackjack files touched; all 11 blackjack suites green in a named run (170 tests) |
| `src/index.css` | unmodified (empty diff) |
| `src/engine/conditioning.ts` | unmodified (empty diff); its `deckCount: DeckCount = 1` default intact |
| `src/App.css` removed-line audit | 7 removed lines, ALL selector lines or comment lines rewritten as comma-joined selector-list extensions (each paired with its `+` counterpart adding a `holdem-deck-toggle` selector) — **no removed declaration line inside any pre-existing rule body** |

### Structural invariants (all confirmed at HEAD)

- `git grep -n "deckCount" -- src/App.tsx src/state/gameModeStore.ts src/ui/GameModeSwitcher.tsx` → **empty**.
- `git grep -in "blackjack\|gamemode" -- src/state/gameStore.ts src/state/oddsStore.ts src/state/pickerStore.ts src/state/uiStore.ts src/engine/conditioning.ts` → **empty**.
- `evaluateHand(` call-site allowlist + `@poker-apprentice/hand-evaluator` import allowlist: green (shoePath.guard 21/21 in a named run).
- `git grep -n "cancelSimulation(" -- src/ui/HoldemGame.tsx` → exactly one non-comment call site (line 154).
- CR-02 generation guard not regressed: `HoldemGame.tsx:133` still carries `if (useGameStore.getState().dealNonce !== dealNonce) return;` (the same-key/wrong-generation check); the blackjack equivalent is untouched by construction (blackjack sweep empty).

### Per-commit guard health (independently re-verified by detached checkout, not just SUMMARY claims)

Exactly three commits in the phase range touch a guard suite. Each was checked out and its guard suite run AT that commit:

| Commit | Plan | Guard suite at that commit | Result |
|--------|------|---------------------------|--------|
| `13af0a6` | 07-03 | `shoePath.guard.test.ts` | **21/21 green** |
| `b29b0c4` | 07-05 | `App.modeShell.guard.test.ts` | **65/65 green** (the same-commit toggle + retarget + testid extension) |
| `e5e3baf` | 07-05 | `App.modeShell.guard.test.ts` | **71/71 green** (+6 style-contract pins landed with the styles) |

No red-then-fixed pair exists anywhere in the range — the Phase 6 commit-discipline lesson held. (Worktree HEAD restored to `worktree-agent-ad10e682cfc3e07b4` at `82b5465` after verification.)

### Wave-3 merge order (checker MINOR-2)

Confirmed satisfied: merge commit `064cfce` (07-06) precedes merge `9e32afa` (07-05) in the first-parent history, and the 07-06 merge message itself records "merged before 07-05 per checker MINOR-2 ordering". 07-05's SUMMARY correctly acknowledges running against the post-07-06 tree.

## Blocker-Ledger Reconciliation (STATE.md read-only; reported here, never edited)

| Blocker | Status | Evidence |
|---------|--------|----------|
| **WR-01** (Phase 8 must pass deckCount into setPick) | **CLOSED EARLY this phase (07-02, D-15)** | `src/ui/CardPicker.tsx:30` — live `useGameStore((state) => state.deckCount)` subscription; `:48` — `setPick(openSlot, card, deckCount)` third argument. Behavioral regression detector in `CardPicker.test.tsx`: at 2 decks the SECOND pick of the same card succeeds, asserted against both rendered slots and the store draft — red if either half reverts. |
| **WR-03** (nothing passes deckCount:2 into the Hold'em trial path) | **RETIRED this phase (07-03, D-12)** | `deckCountValidation.test.ts` now runs a real end-to-end 2-deck poker simulation (1000 trials, ≥1 snapshot, `done: true`, categoryCounts length 11, sum === trialsCompleted); the exact `102 cards, got 101` rejection preserved in a sibling. `ui/HoldemGame.tsx` left the modeShell deckCount sweep with rationale retargeted (D-01/D-12/D-14); the three shell files (`App.tsx`, `gameModeStore.ts`, `GameModeSwitcher.tsx`) still carry it — grep-verified empty. The two unrelated "05-REVIEW WR-03" comments (`App.tsx:7`, `HoldemGame.tsx:29` — a Phase 5 identifier collision) are byte-untouched, grep-verified present. |
| **WR-04** (strengthen shoe-path guard vs `.includes()`; behavioral 2-deck picker tests) | **CLOSED this phase (07-03 + 07-02, D-07)** | `shoePath.guard.test.ts` `noIncludesFiles` covers exactly the five shoe-path files: `engine/shoe.ts`, `engine/conditioning.ts`, `state/pickerStore.ts`, `ui/CardPicker.tsx`, `engine/evaluatorTwoDeck.ts` (read from source this session). Negative controls were demonstrated and reverted in 07-03 (both failure messages recorded in its SUMMARY). Behavioral 2-deck picker tests (both copies pickable, third blocked) shipped in 07-02. |
| **Five-of-a-Kind ranking-convention flag** | **RESOLVED (07-RESEARCH sourcing; implementation confirmed)** | STATE.md already marks it resolved (pagat.com + Bicycle Cards). Shipped comparator confirmed this session: `evaluatorTwoDeck.ts:484` — "index 10 tops the stock 0-9 range" (above Royal Flush); `:504-505` — fives of a kind tie by rank only, citing pagat's convention as adopted by D-05; `:297` — the A1 dup-flush multiset tiebreak explicitly cited as "a DEFINED working convention". |
| **CR-02 generation guards** | **NOT REGRESSED** | `HoldemGame.tsx:133` same-key/wrong-generation dealNonce check intact; blackjack equivalent untouched by construction (empty blackjack diff). The D-02 toggle path rides this guard (dealNonce +1 on mid-hand switch, pinned in 07-05's suite). |
| **06-REVIEW WR-01 leak-acceptance precedent** | **Does NOT apply to Phase 7 — distinction recorded for Phase 8** | Blackjack's guard disables its "1 deck" segment based on the HIDDEN hole card, leaking ~one bit (accepted, documented). Phase 7's A4 guard reads only the PICKS — user-authored, fully visible state — via `hasDuplicatePick(picks)`. **No hidden information flows into any Phase 7 UI affordance; there is no leak here and no precedent to carry.** Phase 8's cross-game toggle absorption should carry the blackjack convention for the blackjack side only, not treat Hold'em's guard as a second instance of it. |

## Multi-Source Coverage Audit

Every source item is **COVERED** — zero MISSING rows. Attribution and evidence per item:

### GOAL (ROADMAP Phase 7 — goal + 4 success criteria)

| Item | Status | Plan(s) | Evidence |
|------|--------|---------|----------|
| Goal: Hold'em over a 104-card shoe, correct duplicate evaluation, Five of a Kind category, legible duplicates | COVERED | 07-01..07-06 | The four criteria below, jointly |
| SC1: enable 2-deck; deal/picker/street-nav/reveal over the 104-card shoe | COVERED | 07-02, 07-03, 07-05 | `deal()` over `shoeWithout(deckCount, picked)` (07-02); worker E2E 2-deck acceptance (07-03); toggle + deckCount-aware odds effect (07-05); checkpoint steps 5/12 artifacts |
| SC2: duplicate hands evaluate correctly, never crash; gate routes away from stock evaluator | COVERED | 07-01, 07-03, 07-06 | Stamped gate + oracle parity on 20k dup windows (07-01); hoisted evalFn in runTrials (07-03); lockedInCategory routing (07-06) |
| SC3: Five of a Kind row, above Royal Flush, correct probability | COVERED | 07-01, 07-03, 07-06 | Comparator index 10 + both seeded anchors in-band (07-01); 11-length snapshots (07-03); last-tbody-row render + tick (07-06) |
| SC4: copy-cue badge makes duplicates legible | COVERED | 07-04, 07-05 | Canonical-scan derivation + ×2 badge on three felt paths (07-04); `.copy-cue`/`.card-slot--cued` styles (07-05) |

### REQ

| Item | Status | Plan(s) |
|------|--------|---------|
| HE2-01 (2-deck loop end to end) | COVERED | 07-02, 07-03, 07-05 |
| HE2-02 (Five of a Kind, correct probability) | COVERED | 07-01, 07-03, 07-06 |
| HE2-03 (copy cue) | COVERED | 07-04, 07-05 |

### RESEARCH

| Item | Status | Plan | Evidence |
|------|--------|------|----------|
| Stamped-array gate (zero-allocation, every dup shape) | COVERED | 07-01 | `Int32Array(52)` + generation counter; GATE_SHAPES sweep + gate-totality property vs `cardCounts` recount |
| Five-of-a-Kind branch | COVERED | 07-01 | Strength 10; five-deuces (the silent-High-Card garbage case) asserts strength 10 |
| Suit-remap proxy + step-5 exactness assertion | COVERED | 07-01 | Full-window counts before choosing substitution suits; step-5 defense assertion committed |
| One-suit flush scorer + max-with-proxy step | COVERED | 07-01 | Dup-flush zone vectors + oracle parity |
| Extended comparator | COVERED | 07-01 | +1/0/-1 never −0; totality property |
| Brute-force oracle methodology as committed tests | COVERED | 07-01 | `twoDeckOracle.ts` (test-only, zero production imports); oracle ≡ stock on 25k clean, candidate ≡ oracle on 20k dup windows |
| Both probability anchors (conditional 1.1204e-3 band [179,269]; marginal 1.5792e-4 band [15,48]) | COVERED | 07-01 | Measured 232 and 35 respectively, both in-band first run, seed 20260824, N=200,000 each |
| Hoisted evaluator selection | COVERED | 07-03 | `deckCount ===` only above the loop; no sibling trial loop |
| Grow-on-merge | COVERED | 07-03 | `mergeBatch` extends totals to the batch's length with zeros |
| Odds-store guard widening | COVERED | 07-03 | {10, 11} family, never switched to 11; 10-length fixtures still pass silently |
| `lockedInCategory` routing | COVERED | 07-06 | `deckCount: DeckCount = 1` default; 2-deck branch through `evaluateHandTwoDeck`; zero library imports in the file |
| Copy-cue canonical scan order | COVERED | 07-04 | Hero slots → board in street order → revealed opponents by seat index; seat-order tiebreak pinned under two mask construction orders |
| 12-point integration map | COVERED | 07-01..07-06 | Every mapped surface touched by exactly its owning plan; the phase-range file inventory (38 src files) reconciles 13 created + 25 modified with no stray file |
| Pitfall-7 correction (VALUE-asserting tests, never mere non-throwing) | COVERED | 07-01 | D-16: all 36 vectors assert values; five-deuces asserts strength 10 explicitly |
| Pitfall 1 (no-crash not an acceptance signal) | COVERED | 07-01 | Same as above |
| Pitfall 2 (dev guard fires on 2-deck snapshots) | COVERED | 07-03 | Length-tolerant guard + `oddsStoreTwoDeck.test.ts` (11-length accepted silently) |
| Pitfall 3 (`lockedInCategory` left on raw evaluator) | COVERED | 07-06 | RED evidence: un-routed memo crashed on duplicate visible cards; now routed |
| Pitfall 4 (modeShell guard blocks the toggle) | COVERED | 07-05 | Same-commit retarget `b29b0c4`, guard green at that commit by checkout |
| Pitfall 5 (proxy hand-array leakage into physical accounting) | COVERED | 07-01, 07-04 | `HandTwoDeck.hand` documented display-only; the cue derives from the runout, never from evaluation output |
| Pitfall 6 (growing totals in the wrong hook) | COVERED | 07-03 | Growth in `mergeBatch` only; `makeEmptyTotals` still `CATEGORY_COUNT` |
| Pitfall 7 (badge migrating between copies) | COVERED | 07-04 | Pure canonical-scan derivation; determinism + both-directions rewind vectors |
| Pitfall 8 (new property tests weakening pinned v1 invariants) | COVERED | 07-01 + this plan | All property files additive; the frozen-suite empty-diff sweep is this plan's mechanical confirmation |
| Assumption A1 (dup-flush multiset tiebreak working convention) | COVERED | 07-01 | Explicit vectors + oracle pin; convention cited in-module (`evaluatorTwoDeck.ts:297`) |
| Assumption A2 (row at the strength end — D-09 amended) | COVERED | 07-06 | Last tbody row after Royal Flush; both-ways DOM-absence pins |
| Assumption A3 (anchor draw-order stability) | COVERED | 07-01 | Band-not-exact-count assertion style; provenance comments in the committed test |

### CONTEXT (D-01..D-16)

| Decision | Status | Plan(s) | Evidence |
|----------|--------|---------|----------|
| D-01 Hold'em-local toggle mirroring the segmented control | COVERED | 07-05 | Shared selector-list membership (CSS source guard); labels verbatim; zero accent |
| D-02 fresh-deal lifecycle (idle set / mid-hand re-deal) | COVERED | 07-02, 07-05 | Every branch pinned at store level (07-02) and App level (07-05) |
| D-03 no cache deckCount dimension; toggle always through `deal()`'s clear | COVERED | 07-02, 07-05 | `knowledgeKey` verbatim `${street}|${revealedMask}`; D-03 suite both directions with distinct-values trick + negative control |
| D-04 wrapper around stock; 1-deck never pays the gate | COVERED | 07-01, 07-03 | Hoisted selection; deck-parity golden byte-untouched and green |
| D-05 Five of a Kind above Royal Flush, 2-deck-only row | COVERED | 07-01, 07-06 | Comparator + row placement + both-ways absence |
| D-06 researcher's algorithm implemented as specified | COVERED | 07-01 | Decision tree verbatim; oracle arbiter |
| D-07 WR-04 fold-in | COVERED | 07-03, 07-02 | Includes-prohibition + behavioral picker tests |
| D-08 copy cue rides the card | COVERED | 07-04, 07-05 | Badge inside AnimatedCard/FlipCard content; `card-slot--cued` position:relative (A12) |
| D-09 (amended) row at strength end | COVERED | 07-06 | Last DOM row; 1-deck zero trace |
| D-10 testid conventions | COVERED | 07-04, 07-05, 07-06 | All seven new testids lowercase-hyphenated, `holdem-`/`category-` per spec |
| D-11 1-deck byte-identical; blackjack untouched | COVERED | all + this plan | The full Task 1 sweep above — empty diffs, green suites |
| D-12 WR-03 retirement | COVERED | 07-03, 07-05 | E2E retarget + sweep retarget; ledger row above |
| D-13 property tests + seeded anchors mandatory | COVERED | 07-01 | 7 properties + 2 anchors + clean companion |
| D-14 deckCount lives in gameStore | COVERED | 07-02 | Store field + D-10 store-locality comment discipline |
| D-15 WR-01 closes early | COVERED | 07-02 | Ledger row above |
| D-16 value-asserting acceptance (Pitfall-7 correction) | COVERED | 07-01 | Ledger of vectors above |

### UI-SPEC

| Item | Status | Plan(s) | Evidence |
|------|--------|---------|----------|
| A1 skip shadcn | COVERED | all | No `components.json`; zero new dependencies (lockfile unchanged all phase) |
| A2 toggle last control-bar child | COVERED | 07-05 | `controlBar.lastElementChild` identity pin |
| A3 fresh-deal affordances (choreography + inactive-segment title) | COVERED | 07-05 | Exact string pinned; title matrix (idle none / inactive-only / never active) |
| A4 guard scope (picks only; nothing ever cleared) | COVERED | 07-02, 07-05 | Store refusal + disabled segment + picks reference-identity pin |
| A5 badge treatment (×2, top-right, inside bounds) | COVERED | 07-04, 07-05 | Markup + CSS per spec. **Pip-clipping half: NOT VERIFIED here — see checkpoint step 7** |
| A6 solid `--felt-dark` fill (contrast fix) | COVERED | 07-05 | CSS block with the checker-corrected rationale in-source; token-only guard pin |
| A7 no independent choreography; gate neutrality | COVERED | 07-04 | `pendingAnimationCount` cued-vs-uncued equality pin |
| A8 both testid schemes on the new row | COVERED | 07-06 | `category-five-of-a-kind` + `category-pct-10`/`category-locked-10` |
| A9 picker copy titles | COVERED | 07-02 | All three exact strings pinned at both deck counts |
| A10 caption/subtitle verbatim both modes | COVERED | 07-06 | Asserted verbatim in BOTH deck-mode describe blocks |
| A11 SR delivery split (hidden glyph + sentence; aria-label suffix) | COVERED | 07-04 | Exact-string pins at both deck counts; suffix branch unreachable at 1 deck |
| A12 stacking via `card-slot--cued` position:relative, no new z-token | COVERED | 07-04, 07-05 | Class emission + CSS + guard pin |
| Seven new testids (complete list) | COVERED | 07-05 (×3), 07-06 (×3), 07-04 (×1) | `holdem-deck-toggle`, `-1`, `-2`; `category-five-of-a-kind`, `category-pct-10`, `category-locked-10`; `holdem-copy-cue` — all present in the production bundle (HTTP probe) |
| Copywriting Contract — every locked string | COVERED | 07-02/04/05/06 | All eight Phase 7 strings verified byte-present in the served production bundle: `1 deck`/`2 decks` labels, both toggle titles, `Five of a Kind`, `×2` sentence, aria suffix, both picker titles. Block-list respected (no Cancel/OK/warning language — lint + copy pins) |
| Accessibility Contract | COVERED | 07-04, 07-05 | role=group/aria-pressed/aria-label pins; focus retention across fresh deal; DOM-absence as accessibility property |
| Isolation Contract rule 1 (blackjack zero changes) | COVERED | this plan | 27-file empty diff + 170 blackjack tests green + CSS selector-list-extension-only audit |
| Isolation Contract rule 2 (1-deck no amendment) | COVERED | this plan | Frozen suites empty-diff + green; every conditional element DOM-absent at 1 deck |
| Isolation Contract rule 3 (DOM-absence pinned both ways) | COVERED | 07-04, 07-06 | Both-ways describe blocks in `copyCueRender.test.tsx` and `OddsTableTwoDeck.test.tsx` |

**No unplanned items found. No MISSING rows.**

## Task 2 — Browser Acceptance Checkpoint (HE2-01..03)

> **Attribution caveat (verbatim, as required):** "Verification performed by the orchestrating Claude agent under the user's standing no-operator-input directive; a human did not personally observe. Re-verify anytime with npm run dev."

**Provenance label: agent-executed, HTTP-probe + named-suite methodology.** No browser automation tools exist in this executor's environment and installs are forbidden (T-07-SC), so the checkpoint was resolved with: a fresh production build (`npm run build`, exit 0), `npx vite preview --port 4199 --strictPort` (port 4199 per the orchestrator's checkpoint protocol; distinct from the stale out-of-session listener on 5199, satisfying the plan's distinct-port intent), HTTP probes of the served artifacts, and the checkpoint-mapped test suites re-run as named artifacts. Each step below records its automated evidence and labels its live-browser half **NOT VERIFIED** where applicable. The orchestrator holds in-app browser access and will strengthen the frame-independent steps after merge.

### Shipped-artifact evidence (production bundle over HTTP, port 4199)

- `GET /` → 200; `index-BtHlMAJF.js`, `index-bSIHiRJ9.css`, `simulation.worker-BrRvdIw1.js` all served.
- Main bundle contains: `Five of a Kind` (3×), `category-five-of-a-kind`, `holdem-deck-toggle` (3×), `holdem-copy-cue`, `Second copy — two physical copies…`, `Switching the shoe deals a fresh hand`, `Your picked cards include a duplicate…`, `1 of 2 copies used`, `Both copies already used in this hand`.
- CSS bundle contains: 5 `holdem-deck-toggle` selector occurrences (the five selector-list extensions), `.card-slot--cued`, `.copy-cue`.
- Worker chunk contains: `Int32Array(52)` (the evaluatorTwoDeck stamped-gate signature — the duplicate-aware evaluator shipped INTO the production worker chunk) and the frozen boundary string `remainingDeck must have exactly`.

### Step-by-step results

| Step | Automated evidence (named artifacts) | Live-browser half |
|------|--------------------------------------|-------------------|
| 1. 1-deck Hold'em unharmed (D-11) | 4 drift detectors + 5 frozen suites: empty diff AND green (162-test named run); `App.test.tsx` pins exactly 10 rows ending `Royal Flush`; no-cue path returns the shipped `<img>` byte-identically | **NOT VERIFIED** (live walk) — routed to orchestrator |
| 2. Blackjack untouched (D-11) | 27-file empty diff; 11 suites / 170 tests green (named run) | **NOT VERIFIED** (live walk) — routed to orchestrator |
| 3. Toggle placement (A2) | Last-child identity pin + group semantics + labels (holdemDeckToggle suite); shared-rule selector membership pinned at CSS-source level | **NOT VERIFIED** (visual treatment comparison) |
| 4. Idle switch silent (D-02) | Idle-click test: aria-pressed flips, dealNonce unchanged, zero runs, no titles idle | **NOT VERIFIED** (live) |
| 5. **Five of a Kind converges (HE2-02, headline)** | 11 rows with `Five of a Kind` last (OddsTableTwoDeck); real E2E 2-deck worker run completes with reconciling 11-length counts (deckCountValidation); **the probability is nonzero and CORRECT**: seeded anchors measured 232 ∈ [179,269] and 35 ∈ [15,48]; caption/subtitle verbatim both modes; bundle strings present | **NOT VERIFIED** (watching live convergence tick) — routed to orchestrator |
| 6. Locked-in tick reaches the row | `lockedInCategory` returns 10 on a five-of-a-kind river window (lockedCategoryTwoDeck); tick renders on `category-locked-10` with all other locked cells empty (OddsTableTwoDeck) | **NOT VERIFIED** (live) |
| 7. **Copy cue reads as a feature (HE2-03) + A5 pip clipping** | Exactly one badge on the second copy (both-ways pins); badge inside `.card-slot`; ×2 aria-hidden + felt-dark treatment (CSS token guard). Fly-in ride structurally guaranteed (badge is fragment content INSIDE AnimatedCard/FlipCard — inherits transforms; gate-neutrality pin) | **A5 pip-clipping: NOT VERIFIED — jsdom cannot verify SVG occlusion. Routed to the orchestrator's live pass AND the recommended human walk (both hero and 64px opponent widths, incl. mid-flip). Motion-observation half (badge travels with card): NOT VERIFIED** |
| 8. Badge follows knowledge, not chronology | Street-progression + rewind vectors in BOTH directions; boarded-twin appears/disappears/returns on the same card (copyCue vectors + render rewind pin) | **NOT VERIFIED** (live) |
| 9. Fresh-deal toggle (D-02/A3) | Exact A3 title on inactive segment only while mid-hand; mid-hand click: dealNonce +1, preflop, mask 0, cache emptied, new run from 0; already-active click: whole-store reference identity, no run | **NOT VERIFIED** (live choreography) |
| 10. 2-to-1 guard never eats a pick (A4) | Disabled + exact guard title; segment 2 unaffected; picks reference-identical after a blocked click; same-render re-enable on clearing; store-boundary refusal (gameStore suite) | **NOT VERIFIED** (live) |
| 11. Picker copy states (A9) | All three exact title strings pinned at both deck counts; `(used)` suffix + third-copy structural block; 1→2 same-render re-enable | **NOT VERIFIED** (live hover) |
| 12. Street nav + reveal at 2 decks (HE2-01) | E2E worker acceptance; conditioned-payload assertions (`deckCount: 2`, 102-card remainingDeck); reveal recondition covered by the shipped effect deps + copyCue reveal vectors | **NOT VERIFIED** (live) |
| 13. Console hygiene (Pitfall 2) | `oddsStoreTwoDeck.test.ts` pins the DEV guard accepts 10- AND 11-length snapshots silently (it cannot fire on a legitimate 2-deck snapshot) and still reports out-of-family/sum-mismatch | **NOT VERIFIED** (live dev-console observation requires `npm run dev` + browser — the guard is DEV-only by design) — routed to orchestrator |
| 14. Keyboard and focus | Keyboard activation + focus retained on the clicked segment across the fresh deal (holdemDeckToggle suite); native buttons throughout | **NOT VERIFIED** (visible focus-ring appearance) |
| 15. Screen-reader delivery (A11) | aria-hidden glyph + visually-hidden sentence exact-string pins; revealed-seat aria-label suffix exact-string pins at both counts | **NOT VERIFIED** (real AT tree) |
| 16. Reduced motion | The entire jsdom suite runs under forced reduced motion (durations 0) and every end-state assertion passes — nothing is gated behind an animation playing; `MotionConfig reducedMotion="user"` shipped in v1, byte-untouched | **NOT VERIFIED** (OS-setting walk) |
| 17. Production build | **Agent-executed LIVE over HTTP:** fresh build exit 0; preview on 4199 (strictPort — a stale server cannot be mistaken for it); index 200; all Phase 7 strings/classes present in the served bundles; worker chunk intact with the evaluator gate signature (no worker-chunk or asset-path breakage) | **NOT VERIFIED** (in-browser repeat of steps 5/7/9 against the bundle) — routed to orchestrator |

### Checkpoint verdict

**PASS (agent-executed) on every mechanically-checkable half; zero defects found.** No step produced a failure to route to an owning plan. The live-browser halves enumerated above are **NOT VERIFIED** and are named explicitly per T-07-41 — the phase closes with that gap documented, per the standing directive. The A5 pip-clipping item is the single check with NO automated substitute (UI-SPEC labels it ASSERTED, not evidenced); it is routed to the orchestrator's live pass plus the recommended human walk.

### Server hygiene

- Preview server (PID 105732, port 4199) terminated with `taskkill //F`; post-kill netstat shows only TIME_WAIT residue, **no LISTENING socket on 4199**.
- No dev server was started by this executor at any point (the dev-console check is explicitly NOT VERIFIED rather than half-run).
- Observed a pre-existing listener on port 5199 (PID 3016, node.exe) — **outside this worktree session** (likely the orchestrator's own dev server); deliberately left untouched. No server process from this session remains running.

## Deviations from Plan

**1. [Protocol] Checkpoint resolved agent-verified instead of BLOCKING**
- The plan's Task 2 says "BLOCK... never auto-advanceable". The orchestrator's checkpoint protocol for this execution carries the user's standing no-operator-input directive: resolve agent-verified, label live halves NOT VERIFIED, record the attribution caveat verbatim. That is what was done; provenance is labelled agent-executed throughout and T-07-41's mitigation (NOT VERIFIED over assumed-pass) is applied to every unreachable half.

**2. [Protocol] Preview port 4199 instead of the plan's 4319**
- Per the orchestrator's checkpoint protocol. Both ports satisfy the plan's actual requirement (a port distinct from any dev server — the stale 5199 listener was avoided); `--strictPort` guarantees the fresh build was the thing probed.

**3. [Method] Dev-server surface not exercised**
- The plan's dual-surface instruction (`npm run dev` for the DEV-only console guard) requires a live browser console to mean anything; with no browser automation available, starting a dev server would verify nothing an HTTP probe can see. Step 13's live half is NOT VERIFIED; its automated substitute (the guard's length-tolerance pins) is named. No half-measure was recorded as a pass.

No other deviations. **No source file was changed by this plan** (as designed): the phase-range file inventory before and after this plan is identical except for this SUMMARY.

## Observations routed to follow-up (not fixed in-phase)

- **A5 pip-clipping visual QA** → orchestrator's live browser pass + recommended human walk (`npm run dev`), both card widths, including mid-flip.
- **Live-convergence watch (step 5), badge-rides-fly-in (step 7 motion half), fresh-deal choreography (step 9), dev-console hygiene (step 13)** → orchestrator's live pass (frame-independent steps to be strengthened after merge, per the execution directive).
- **Phase 8 note:** do not carry the 06-REVIEW WR-01 leak-acceptance precedent onto Hold'em's A4 guard — it reads visible picks, not hidden state (distinction recorded in the ledger above).

## Self-Check: PASSED

- `07-07-SUMMARY.md` exists on disk at the planned path.
- Gates re-confirmed this session: vitest 62/863 exit 0, lint exit 0, build exit 0.
- Worktree HEAD back on `worktree-agent-ad10e682cfc3e07b4` at `82b5465` after the per-commit checkout verification; working tree clean before the SUMMARY commit.
- No server process from this session running (verified by netstat after kill).
- STATE.md and ROADMAP.md untouched by this plan (orchestrator-owned).

---
*Phase: 07-2-deck-holdem-evaluation*
*Completed: 2026-08-25*
