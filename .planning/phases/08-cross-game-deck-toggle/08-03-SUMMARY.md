---
phase: 08-cross-game-deck-toggle
plan: 03
subsystem: verification
tags: [regression-sweep, coverage-audit, blocker-reconciliation, browser-checkpoint, DECK-02, phase-gate]
status: complete

# Dependency graph
requires:
  - phase: 08-cross-game-deck-toggle
    plan: 01
    provides: "src/ui/DeckCountToggle.tsx, the nine-state pre-extraction DOM golden, both rewired call sites and the additive guard amendment — the artifacts this plan audits"
  - phase: 08-cross-game-deck-toggle
    plan: 02
    provides: "src/ui/DeckCountToggle.test.tsx and src/App.deckToggleConsolidation.test.tsx — the SC1/SC2/SC3 coverage this plan confirms shipped"
provides:
  - .planning/phases/08-cross-game-deck-toggle/08-03-SUMMARY.md — the phase regression record, blocker reconciliation, Multi-Source Coverage Audit and checkpoint verdict
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Negative-claim gating: a behavior-preserving extraction is audited by looking for unintended CHANGE (empty CSS diff, enumerated test-path diff, per-commit guard health) rather than for a feature"
    - "Golden provenance as a git fact: ancestry + tree-content + single-commit + detached-checkout re-run, so the byte-identity claim rests on proof rather than assertion"
    - "Shipped-artifact probing as the checkpoint's automatable half: fetch the production bundle over HTTP and read the minified component and the compiled CSS rules directly, which mechanically answers the computed-style and single-source questions a jsdom suite cannot reach"

key-files:
  created:
    - .planning/phases/08-cross-game-deck-toggle/08-03-SUMMARY.md
  modified: []

key-decisions:
  - "Phase base re-derived independently as b44f6c6 (parent of 08-01's first commit 4d85066) and its 62-file / 863-test baseline CONFIRMED by detached checkout rather than taken from the plan text"
  - "The pre-existing vite dev server on port 5199 (PID 3016, started 2026-08-24T08:14 from the MAIN repo) was NOT killed — it is foreign to this worktree and predates this session. This is precisely the stale-server hazard the plan's port-4321 choice defends against; my own preview was confirmed dead by both a port probe and a full node-process enumeration"
  - "The browser checkpoint is resolved AGENT-EXECUTED under the standing no-operator-input directive. No browser automation exists in this environment and installs are forbidden, so each of the 13 steps was split into an artifact/suite half (verified) and a live-render half (recorded NOT VERIFIED) — no step is recorded assumed-pass"

requirements-completed: [DECK-02]

# Metrics
duration: 22min
completed: 2026-08-25
---

# Phase 8 Plan 03: Phase Gate — Regression Sweep, Coverage Audit and Browser Acceptance Summary

**Phase 8's negative claim holds mechanically: the consolidation changed nothing. CSS is byte-identical, exactly four test paths changed (three new files plus one purely additive guard amendment), zero pre-existing tests were retargeted, the DOM golden is proven by git ancestry to predate the extraction and still passes nine states against the INLINE toggles it was captured on, and all 11 commits in the range leave the mode-shell guard green.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-08-25T04:13Z (base `ea0702f` verified, `npm ci` in a fresh worktree — 249 packages, 0 vulnerabilities, no `npm install`)
- **Completed:** 2026-08-25T04:35Z
- **Tasks:** 2 (Task 1 audit; Task 2 checkpoint resolved agent-executed)
- **Source files modified:** 0 — this plan changes no source and no test file, exactly as specified

## Task Commits

| Task | Commit | Message | Files |
|------|--------|---------|-------|
| 1-2 | (this SUMMARY) | `docs(08-03): phase gate — regression sweep, coverage audit and browser acceptance` | `.planning/phases/08-cross-game-deck-toggle/08-03-SUMMARY.md` |

---

## 1. Verification Gates (at `ea0702f`)

| Gate | Command | Result |
|------|---------|--------|
| Full suite | `npx vitest run` | **65 files / 916 tests, 0 failures, 0 skipped** — exit 0 |
| Types | `npx tsc --noEmit` | clean |
| Lint | `npm run lint` (`eslint .`) | clean, **zero** new inline `eslint-disable` comments in the whole phase range |
| Build | `npm run build` (`tsc -b && vite build`) | clean — 484 modules, only the pre-existing 500 kB chunk-size warning |

## 2. Baseline Reconciliation — every delta additive

The phase base was re-derived independently rather than taken on trust: `4d85066` (08-01's first commit) has parent `b44f6c6`, so **`b44f6c6` is the phase base**. Its baseline was confirmed by detached checkout, not quoted:

```
BASELINE AT PHASE BASE b44f6c6:  Test Files  62 passed (62)   Tests  863 passed (863)
```

| Point | Commit | Files | Tests | Delta explained |
|-------|--------|-------|-------|------------------|
| Phase base | `b44f6c6` | 62 | 863 | — (confirmed by checkout) |
| Golden | `4d85066` | 63 | 872 | +1 file, +9 tests (the nine DOM states) |
| Extraction | `71a2802` | 63 | 893 | +21 guard tests (resetAnimations +1, store-free sweep +7, locked labels +3, SC1 pins +10) |
| Component suite | `a58187b` | 64 | 904 | +1 file, +11 tests |
| Consolidation suite | `88d403e` | 65 | 916 | +1 file, +12 tests |
| Exclusion follow-up | `8cdb7f6` | 65 | 916 | +1 assertion inside an existing case, no count change |
| **HEAD** | `ea0702f` | **65** | **916** | **+3 files, +53 tests, 0 removed, 0 modified, 0 skipped** |

**863 pre-existing tests are intact.** 9 + 21 + 11 + 12 = 53 — the arithmetic closes with no unexplained residue. Nothing was adjusted to make anything pass.

## 3. The Zero-Retargets Gate (the phase's headline non-negotiable) — HELD

`git diff --name-status b44f6c6..HEAD` over test paths lists **exactly four** entries:

| File | Status | Sanction |
|------|--------|----------|
| `src/App.deckToggleDom.golden.test.tsx` | `A` new | 08-01 |
| `src/ui/DeckCountToggle.test.tsx` | `A` new | 08-02 |
| `src/App.deckToggleConsolidation.test.tsx` | `A` new | 08-02 |
| `src/App.modeShell.guard.test.ts` | `M` additive amendment | 08-01 (the ONE sanctioned edit to a pre-existing test file) |

> **Method note.** The plan's literal pathspec `'src/**/*.test.*'` under-matches: git wildmatch without `WM_PATHNAME` still requires the literal `/` after `**`, so root-level files like `src/App.deckToggleDom.golden.test.tsx` are invisible to it and the gate would have silently reported a single file. Re-run with `:(glob)` magic and cross-checked against the unrestricted `git diff --name-status b44f6c6..HEAD -- src/`, which lists 7 entries total (4 test + 3 source) and confirms nothing was missed.

**Guard amendment is purely additive.** `git diff b44f6c6..HEAD -- src/App.modeShell.guard.test.ts` removes exactly **2** lines, both extensions of a line that survives:

1. `-import { readFileSync } from 'node:fs';` → re-added as `readFileSync, readdirSync`
2. `-'the 06-07 placeholder retirement, D-13); uiStore.resetAnimations is TEST-ONLY and '` → re-added with the Phase 8 message continuation appended

- Removed `expect(` lines: **0**
- Removed `it(` / `it.each` lines: **0**
- `.skip` / `.todo` / `.only` added anywhere in `src/` this phase: **0**
- No sweep-list entry removed; the `deckCount`-zero sweep's file list is byte-unchanged (trap 4 respected)

## 4. The Zero-Visual-Change Gate (D-06) — CSS IS BYTE-UNTOUCHED

```
git diff --stat b44f6c6..HEAD -- src/App.css src/index.css   →   (EMPTY)
```

**Why this subsumes the computed-styles claim, spelled out as the plan requires.** Every toggle style in `App.css` is delivered by `data-testid` **attribute selectors** — there is no class rule anywhere on the control (the rendered `className` list is empty by contract, UI-SPEC binding rule 2, and the served stylesheet contains **zero** `.deck-toggle` and **zero** `.game-mode-switcher` class selectors, confirmed by reading the compiled CSS). Computed style is therefore a pure function of (a) the CSS text and (b) the rendered attributes. The CSS text is byte-identical by the diff above; the rendered attributes are byte-identical by the nine-state DOM golden (§5). Two identical inputs to the same function give an identical output — so **every computed style, including the dimmed guard segment, is unchanged by construction**, not by observation.

This gate, not the 08-UI-SPEC invariance table's abbreviated dimming row, is what governs. For the record, the actual shipped disabled declaration — read out of the served production stylesheet, which is the strongest form of the step-8 DevTools check available without a browser — is:

```css
[data-testid=blackjack-deck-toggle-1]:disabled,
[data-testid=holdem-deck-toggle-1]:disabled
{ color: var(--text); opacity: .4; cursor: not-allowed }
```

Reduced opacity, `not-allowed` cursor, **normal** text colour — **not** the destructive red. Both games' `-1` segments sit in the *same rule*, so the "dimming matches Hold'em byte for byte" requirement of step 9 is true by shared declaration rather than by comparison.

## 5. Commit-Ordering Proof for the DOM Golden (D-06 / UI-SPEC A2 / T-08-15)

The golden is only a baseline if it predates the extraction. All four sub-proofs pass:

| # | Proof | Result |
|---|-------|--------|
| a | `git merge-base --is-ancestor 4d85066 71a2802` | **YES** — the golden's commit is an ancestor of the extraction commit |
| b | Golden's parent | `b44f6c6` — the golden is literally the **first** commit of the phase |
| c | Tree still held BOTH inline toggles at `4d85066` | `git show 4d85066:src/ui/BlackjackControls.tsx` → 1 × `role="group"`; `:src/ui/HoldemGame.tsx` → 1 × `role="group"` |
| c2 | `DeckCountToggle.tsx` at `4d85066` | **absent** (`fatal: … exists on disk, but not in '4d85066'`) — the shared component did not yet exist |
| d | Commits touching the golden in range | **exactly one** (`4d85066`); `git diff --stat 4d85066..HEAD` over the file is EMPTY — byte-untouched afterwards |

**The decisive run** — detached checkout of `4d85066`, executing the golden against the still-INLINE toggles:

```
GOLDEN AT ITS OWN COMMIT 4d85066:   Test Files  1 passed (1)    Tests  9 passed (9)
```

Nine states pass against the pre-extraction inline markup, the file is then never edited again, and the same nine pass at HEAD against the shared component. That is the whole byte-identity argument, and it rests on git facts rather than on the executor's word.

## 6. Per-Commit Guard Health (D-07, 06-02 precedent item 4) — ALL GREEN

Detached checkout of **every** commit in `b44f6c6..HEAD`, running `src/App.modeShell.guard.test.ts`:

| # | Commit | Guard | Subject |
|---|--------|-------|---------|
| 1 | `4d85066` | **GREEN** 71 | test(08-01): freeze pre-extraction deck-toggle DOM as a nine-state outerHTML golden |
| 2 | `71a2802` | **GREEN** 92 | refactor(08-01): extract DeckCountToggle onto both games, guard amended same-commit |
| 3 | `1455ce3` | **GREEN** 92 | docs(08-01): complete characterization-golden + DeckCountToggle extraction plan |
| 4 | `e2bdfa1` | **GREEN** 92 | merge(08-01): DOM golden + DeckCountToggle extraction onto both games |
| 5 | `a5a34cc` | **GREEN** 92 | docs(08): wave 1 complete (1/3 plans) |
| 6 | `a58187b` | **GREEN** 92 | test(08-02): component-level contract suite for the shared DeckCountToggle |
| 7 | `88d403e` | **GREEN** 92 | test(08-02): cross-game deck-toggle consolidation suite (SC1/SC2/SC3) |
| 8 | `8cdb7f6` | **GREEN** 92 | test(08-02): make the guard's *.test.tsx exclusion genuinely exercised |
| 9 | `916c783` | **GREEN** 92 | docs(08-02): complete deck-toggle contract + consolidation suite plan |
| 10 | `3c2b6d4` | **GREEN** 92 | merge(08-02): DeckCountToggle contract suite + cross-game consolidation suite |
| 11 | `ea0702f` | **GREEN** 92 | docs(08): wave 2 complete (2/3 plans) |

**No red-then-fixed pair anywhere.** The 71 → 92 step happens exactly at `71a2802`, the same commit that creates the component — every new assertion flipped red→green at the commit that caused it, honouring the guard file's STANDING RULE and the 06-02 same-commit convention.

## 7. Structural Invariants — every grep returned its stated result

| # | Check | Expected | Actual |
|---|-------|----------|--------|
| 1 | `role="group"` in `BlackjackControls.tsx` / `HoldemGame.tsx` | zero both | **zero both** |
| 2 | non-test `src/ui/*.tsx` containing `aria-label="Deck count"` | exactly 1 = `DeckCountToggle.tsx` | **exactly 1** (`DeckCountToggle.tsx`; the only other match is `DeckCountToggle.test.tsx`, which is why 08-02's exclusion fix is load-bearing — see §9) |
| 3 | `deckCount` in `App.tsx` / `gameModeStore.ts` / `GameModeSwitcher.tsx` | nothing | **nothing** — shell stays deckCount-free (D-10/D-14); the component correctly NOT added to that sweep (trap 4) |
| 4 | store tokens in `DeckCountToggle.tsx` (7 tokens, comments included) | nothing | **nothing** — D-01 store-freedom holds |
| 5 | `cancelSimulation(` in `HoldemGame.tsx` | exactly 1 | **exactly 1**; `BlackjackGame.tsx` byte-unmodified this phase |
| 6 | `*-deck-toggle` entries in both testid registries | same six as at base, files byte-unmodified | **six entries** (3 + 3); `git diff --stat` over both files EMPTY (D-02) |
| 7 | Locked copy verbatim, em dashes intact | all six strings | **all six present**; em dash hex-verified as `e2 80 94` = U+2014 |

**Locked-copy locations** (call-site retention confirmed, PATTERNS §1): `1 deck` / `2 decks` / `Deck count` in `DeckCountToggle.tsx`; `The dealt cards include a duplicate — impossible with one deck` in `BlackjackControls.tsx` L6; `Your picked cards include a duplicate — impossible with one deck` in `HoldemGame.tsx` L27; `Switching the shoe deals a fresh hand` in `HoldemGame.tsx` L23. All three title constants stayed in their original files exactly as PATTERNS specified.

## 8. Scope-Guard Confirmation (D-10) — nothing from the OUT list shipped

`git diff --stat b44f6c6..HEAD` lists **exactly** ten paths and nothing else:

- Source (3): `src/ui/DeckCountToggle.tsx` (new), `src/ui/BlackjackControls.tsx`, `src/ui/HoldemGame.tsx`
- Tests (4): the three new suites + the additively amended guard
- Planning (3): `.planning/ROADMAP.md`, `08-01-SUMMARY.md`, `08-02-SUMMARY.md`

| OUT item (D-10) | Shipped? | Evidence |
|-----------------|----------|----------|
| Deck counts above 2 | **No** | `src/engine/shoe.ts` L8 still `export type DeckCount = 1 \| 2` |
| Store unification | **No** | `git diff --name-only b44f6c6..HEAD -- src/state/` is EMPTY — not one store file touched; `deckCount` still declared independently in `gameStore.ts` L30 and `blackjackStore.ts` L43 |
| Toggle-semantics change | **No** | both call-site ternaries moved verbatim (§9); all pre-existing toggle suites pass byte-untouched |
| Delta-callout UI | **No** | no new copy, no new testid, no new component beyond the extraction |
| Visual excellence pass | **No** | CSS diff EMPTY |

`git diff --diff-filter=D b44f6c6..HEAD` → **no deletions anywhere in the phase.**

## 9. Behaviour-Preservation Spot-Checks

**Both rewires are verbatim moves.** `BlackjackControls.tsx`: the WR-01 guard-predicate comment essay (L33–47) and `duplicateOnTable` (L48–49) are outside the diff entirely — untouched. `HoldemGame.tsx`: the three-way segment-1 ternary carrying the **A4-beats-A3 precedence** moved character-for-character into the `oneDeckTitle` prop, and segment 2's `deckCount === 1 && runout !== null` condition into `twoDecksTitle`. The toggle remains the last child of each control bar.

**Attribute order preserved in the shipped bundle** (UI-SPEC binding rule 1). Read directly out of the served production JS:

```js
function bm({testidPrefix:e,deckCount:t,onSelect:n,oneDeckDisabled:r,oneDeckTitle:i,twoDecksTitle:a}){
  return jsxs(`div`,{"data-testid":e,role:`group`,"aria-label":`Deck count`,children:[
    jsx(`button`,{type:`button`,"data-testid":`${e}-1`,"aria-pressed":t===1,disabled:r,title:i,onClick:()=>n(1),children:`1 deck`}),
    jsx(`button`,{type:`button`,"data-testid":`${e}-2`,"aria-pressed":t===2,title:a,onClick:()=>n(2),children:`2 decks`})]})}
```

Wrapper `data-testid`, `role`, `aria-label`; segments `type`, `data-testid`, `aria-pressed`, [`disabled`], [`title`], `onClick` — the exact order both inline originals used. **Segment 2 carries no `disabled` key at all** (trap 2 honoured — omission, not `disabled={false}`).

**08-02's exclusion fix verified genuinely load-bearing.** `aria-label="Deck count"` appears in two `src/ui` files: the component and `DeckCountToggle.test.tsx`. The SC1 single-source sweep enumerates `src/ui/*.tsx` and must actively exclude the latter. Had 08-02 not added the literal-bearing assertion (its Deviation #2), this plan could reasonably have read the exclusion as dead and removed it. It is not dead. **Recommendation: never drop that exclusion.**

## 10. Blocker Reconciliation — 06-REVIEW WR-01 CARRIED INTACT

The STATE.md entry reads: *"06-REVIEW WR-01 resolution accepted a documented ~one-bit D-02 leak: the blackjack '1 deck' toggle segment disables when the HIDDEN hole duplicates a visible card… Carry this convention if Phase 8's cross-game toggle absorbs the blackjack-local toggle."* Phase 8 did absorb it. The convention was **carried, not silently altered**:

| Obligation | Status | Evidence |
|-----------|--------|----------|
| Segment disables on a hidden-hole duplicate | **carried** | `duplicateOnTable = round !== null && hasPhysicalDuplicate(round, playerHand, dealerPlayoutCards)` — `BlackjackControls.tsx` L48-49, outside the phase diff |
| Locked title unchanged | **carried** | `DUPLICATE_GUARD_TITLE`, `BlackjackControls.tsx` L6, verbatim with U+2014 |
| Store-boundary refusal still the backstop | **carried** | `blackjackStore.setDeckCount` L186-197 still refuses a 2→1 switch under `hasPhysicalDuplicate`; **no store file was touched this phase** |
| Behavioural pin still green byte-untouched | **carried** | `App.blackjackLoop.test.tsx` byte-unmodified (`git diff --stat` EMPTY) and green (149 tests across the six pre-existing toggle-adjacent suites) |
| Re-asserted through the shared component | **added** | 08-02 consolidation guards case 10: 2-deck round, hole `5c` duplicating player `5c`, **no visible duplicate** → segment 1 `disabled` + locked title verbatim; segment 2 not disabled, no `title` |
| Documentation survives | **carried** | the WR-01 rationale essay is byte-intact, and the new call-site comment repeats "the hidden hole counts — it is a dealt card" |

**Blast-radius statement (required by the plan, T-08-21).** The guard predicate stayed **at the blackjack call site**. `DeckCountToggle` owns **no guard logic whatsoever** — it receives a pre-computed boolean and a pre-computed string and renders them; grep confirms it contains zero store tokens and it hard-codes no title. Therefore **the leak's blast radius did not widen to Hold'em**: the shared component cannot propagate a blackjack-specific inference because it holds none.

**Hold'em has no equivalent leak** (the distinction 07-07 recorded so it would not be carried forward as a false precedent). Hold'em's A4 guard reads `duplicateInPicks = hasDuplicatePick(picks)` — **user-authored picks, every one of them already visible to the user who typed them**. A disabled `1 deck` segment there discloses nothing the user does not already know. Blackjack's leak exists only because the hole card is hidden state; Hold'em's guard has no hidden input, so the trade-off does not arise and must not be cited as precedent for one.

**WR-01 ledger note satisfied.** The STATE note's conditional — *"carry this convention if Phase 8 absorbs the blackjack-local toggle"* — is now discharged: the toggle was absorbed into the shared component and the convention travelled with it, intact, at the call site. This is a reconciliation record only; **STATE.md was not edited by this plan** (the orchestrator owns it).

---

## 11. Multi-Source Coverage Audit

Every source item, one row each, with the plan that shipped it and the evidence. **Zero MISSING rows.**

### GOAL — ROADMAP Phase 8

| Item | Status | Plan | Evidence |
|------|--------|------|----------|
| Goal: one consistent shared control across both games that cancels and recomputes | **COVERED** | 08-01 + 08-02 | `DeckCountToggle.tsx` rendered by both control bars; consolidation suite asserts cancel+recompute through it in both games |
| **SC1** — a single shared component in both bars, always reflecting the active game's count | **COVERED** | 08-01 (source+byte identity), 08-02 (rendered contract) | Three-part proof: source identity (guard SC1 pins, 11 tests), byte identity (nine-state golden), rendered contract (consolidation cases 1-3 incl. the contradicting-stores cross-game round trip). Shipped-bundle corroboration: `Deck count` appears **once** in the production JS and exactly one minified function emits the group markup |
| **SC2** — changing deck count cancels in-flight simulation and recomputes, no stale numbers | **COVERED** | 08-02 (D-04: asserting shipped behaviour, changing no logic) | Consolidation cases 4-7: blackjack mid-round (counter→0, all 13 stat cells at the em dash, `mock.calls[1][0].deckCount === 2`); blackjack resolved (retained numbers byte-identical via Map capture); Hold'em mid-hand (`dealNonce` 1→2, `settledCache.size` 3→1, fresh `53` with explicit `not.toBe(52)`); Hold'em idle (the no-in-flight-run arm) |
| **SC3** — "takes effect on next deal" discipline, no disruptive mid-hand mutation | **COVERED — satisfied by interpretation, citing D-05** | 08-02 | See the dedicated reasoning block below |

**SC3 satisfied-by-interpretation, reasoning restated in full (T-08-20 requires this on the record).** SC3's roadmap wording predates the shipped, locked per-game semantics. It is recorded COVERED **as interpreted by 08-CONTEXT D-05**, on these grounds: (1) **neither game silently mutates a hand in place** — which is the substance the criterion protects; (2) **blackjack re-runs its odds over the SAME visible cards** — nothing is re-dealt, positively asserted by consolidation case 8 (unchanged `roundNonce`, same `playerHand`, same upcard, `revealedHole` still false, phase still `player-turn`, hole identity still absent from the DOM); (3) **Hold'em visibly replaces the hand with the full fresh-deal choreography** — an announced, unmissable replacement, not a silent mutation, and disclosed *before* the click by the `Switching the shoe deals a fresh hand` title (case 9); (4) a literal "next deal only" reading would **undo Phase 6's locked BJ-07 findability behaviour**, which is shipped, verified and checker-approved — so forcing it would be a regression, not a fix. No UI assertion anywhere forces the literal reading.

### REQ — DECK-02

| Clause | Status | Plan | Evidence |
|--------|--------|------|----------|
| "User can toggle deck count (1 or 2) **per game**" | **COVERED** | 08-01 + 08-02 | Per-game testids preserved (D-02); consolidation case 3 proves each control reflects its OWN store with contradicting values and survives a round trip to the other game and back |
| "changing it **cancels any in-flight simulation and recomputes** all odds under the new shoe" | **COVERED** | 08-02 | Consolidation SC2 describe, cases 4-7, both games — including the conditioned-payload check that the restarted run really carries the new `deckCount` |

### PATTERNS — 08-PATTERNS.md

| Item | Status | Plan | Evidence |
|------|--------|------|----------|
| Six-file classification | **COVERED** | 08-01 + 08-02 | All six shipped; the phase diff contains exactly those six plus planning artifacts |
| Parameterization table (7 aspects) | **COVERED** | 08-01 | Prop shape `{ testidPrefix, deckCount, onSelect, oneDeckDisabled?, oneDeckTitle?, twoDecksTitle? }` expresses every row |
| Three call-site-retained title constants | **COVERED** | 08-01 | `DUPLICATE_GUARD_TITLE` (BJ L6), `FRESH_DEAL_TITLE` (HE L23), `DUPLICATE_PICK_GUARD_TITLE` (HE L27) — all still in their original files (§7) |
| Guard impact audit — **all 11 rows** | **COVERED** | 08-01 | Rows 1-3, 5, 8-9, 11 required no change and none was made; row 4 resetAnimations **+`ui/DeckCountToggle.tsx`**; row 6 deckCount-zero **correctly NOT extended** (list byte-unchanged, trap 4); row 7 store-free sweep **added** (7 tokens); row 10 locked-label pins **added** (3 strings). *Note: the plan text says "ten rows"; the PATTERNS table as written has **11**. All 11 audited — no gap, an off-by-one in the plan's prose only.* |
| Zero-CSS-edit finding | **COVERED** | 08-01 | CSS diff EMPTY (§4) — the finding held exactly |
| Zero-retargets Test Impact Map (DEFINITIVE) | **COVERED** | 08-01 + 08-02 | §3 — held; all eight listed suites byte-untouched and green |
| 06-02 precedent, all six conventions | **COVERED** | 08-01 | (1) verbatim move §9; (2) same-commit amendment — `71a2802` carries component + both rewires + guard; (3) retarget/add never delete — 0 removed `expect(`/`it(`; (4) guard green at every commit by checkout — §6; (5) negative controls — two run, both went red with the exact expected message, both reverted (08-01); (6) behaviour-preservation proof — §2 and §3 |
| Component + component-test conventions | **COVERED** | 08-01 + 08-02 | Named function export, decision-citing doc comment, `role="group"` + `aria-label`, `type="button"` + `aria-pressed`, never-disabled active segment; the test suite mirrors the `GameModeSwitcher.test.tsx` checklist |
| **Trap 1** focus retention / no remount | **COVERED** | 08-01 | Module-scope function component, no hooks, no state-derived `key`; `App.holdemDeckToggle.test.tsx` L346-375 focus-retention test passes **byte-untouched** |
| **Trap 2** attribute-absence semantics | **COVERED** | 08-01 + 08-02 | Segment 2 has no `disabled` key at all in the shipped bundle (§9); component case 8 pins the omission |
| **Trap 3** raw-source sweeps read comments | **COVERED** | 08-01 | Store-token sweep over `DeckCountToggle.tsx` returns nothing **including comments** (§7 check 4) |
| **Trap 4** do NOT add to deckCount-zero sweep | **COVERED** | 08-01 | Sweep list byte-unchanged; `DeckCountToggle.tsx` absent from it; it IS in the resetAnimations sweep |
| **Trap 5** same-wave file ownership | **COVERED** | 08-01 | All four coupled files owned by one plan, sequenced commits, each independently green (§6) |
| **Trap 6** A4-beats-A3 precedence is call-site logic | **COVERED** | 08-01 | Three-way ternary moved verbatim into `oneDeckTitle`; golden state 9 asserts the fresh-deal title is ABSENT when the guard title wins |
| **Trap 7** no snapshot serialization | **COVERED** | 08-01 | Attribute order matched anyway (§9) — the zero-thought-required choice was taken |

### CONTEXT — 08-CONTEXT.md D-01 … D-10

| Decision | Status | Plan | Evidence |
|----------|--------|------|----------|
| **D-01** shared props-driven component, no shared store | **COVERED** | 08-01 | Zero store tokens; zero runtime imports (only `import type { DeckCount }`); component case 11 proves props-only by contradicting BOTH live stores |
| **D-02** per-game testids contractual and unchanged | **COVERED** | 08-01 | Both registries byte-unmodified, six entries; isolation sweeps green byte-untouched |
| **D-03** all locked per-game semantics carry exactly | **COVERED** | 08-01 + 08-02 | Invariance table conformance, all 8 rows; every pre-existing toggle test green unmodified |
| **D-04** SC2 already satisfied; add assertions, change no logic | **COVERED** | 08-02 | Consolidation SC2 describe; zero source edits in 08-02 |
| **D-05** SC3 interpreted against shipped locked semantics | **COVERED** | 08-02 + this plan | Cases 8-9; reasoning restated above |
| **D-06** zero visual/copy change, byte-identical DOM | **COVERED** | 08-01 | CSS diff EMPTY; nine-state golden green across the extraction |
| **D-07** guard discipline, green at every commit by checkout | **COVERED** | 08-01 + this plan | §6 — 11/11 green |
| **D-08** suites/goldens/frozen/isolation green, zero pre-existing modifications | **COVERED** | 08-01 + 08-02 | §3; frozen v1 suites + drift detectors byte-untouched and green (9 files / 74 tests) |
| **D-09** value-assertion discipline on any test touched | **COVERED** | 08-02 | No bare presence check where a value is checkable; the only `toBeInTheDocument()` calls encode the value in the query |
| **D-10** scope guard — nothing from the OUT list | **COVERED** | all | §8 |

### UI-SPEC — 08-UI-SPEC.md

| Item | Status | Plan | Evidence |
|------|--------|------|----------|
| Defaults **A1** skip shadcn | **COVERED** | 08-01 | No `components.json`, no new packages |
| **A2** byte-identical incl. attribute order | **COVERED** | 08-01 | Golden + shipped-bundle attribute order (§9) |
| **A3** source pins, no DOM marker | **COVERED** | 08-01 | 11 SC1 guard pins; zero DOM footprint — no class, no marker attribute |
| **A4** prop capabilities not shape; unconditional select | **COVERED** | 08-01 + 08-02 | Component case 7: clicking the ACTIVE segment still calls `onSelect`, at both counts |
| **A5** one describe per SC | **COVERED** | 08-02 | Four describes: SC1, SC2, SC3, per-game guards |
| Rendered-DOM contract, **binding rule 1** byte-identical per state | **COVERED** | 08-01 | Nine-state golden |
| **rule 2** zero classes | **COVERED** | 08-01 | No `className` in source; zero class selectors in served CSS |
| **rule 3** div wrapper, native buttons, labels never change | **COVERED** | 08-01 + 08-02 | Component case 2 asserts label equality across a pressed-state flip |
| **rule 4** `aria-pressed` always serialized on both | **COVERED** | 08-02 | Component case 3, both counts |
| **rule 5** `disabled`/`title` only when supplied | **COVERED** | 08-02 | Component case 8 |
| **rule 6** active segment never disabled | **COVERED** | 08-01 | No disabled path on segment 2; guards structurally one-directional |
| **rule 7** placement unchanged (last control-bar child) | **COVERED** | 08-01 | `App.holdemDeckToggle.test.tsx` L255-257 `lastElementChild` assertion green byte-untouched |
| Per-game parameterization table | **COVERED** | 08-01 | Every row expressible and expressed |
| Prop contract — **5 capabilities** | **COVERED** | 08-01 | active count; unconditional select; per-segment disabled+title; testid prefix; optional pre-click title (`twoDecksTitle`) |
| Prop contract — **2 constraints** | **COVERED** | 08-01 | props-driven only (no store/gate/state); no game-specific logic |
| Invariance table — **all 8 rows** | **COVERED** | 08-02 | BJ idle (covered by the resolved row's identical pending-only semantics + shipped loop suite); BJ mid-round (case 4); BJ resolved (case 5); BJ guard incl. hidden hole (case 10); HE idle (case 7); HE mid-hand (cases 6, 9); HE pre-click affordance (case 9); HE picks guard (cases 11, 12). 08-02 reports **no observed difference** on any row |
| Zero-animation claim | **COVERED** | 08-01 | Component has no motion, no gate arming; it is in the resetAnimations prohibition sweep |
| Testid contract — zero new/renamed/removed | **COVERED** | 08-01 | §7 check 6 |
| DOM-absence contract (both ways) | **COVERED** | 08-01 + 08-02 | `App.modeIsolation.test.tsx` byte-untouched and green; consolidation case 3 asserts all three testids of the absent game `=== null` |
| Consolidation-suite assertions SC1 / SC2 / SC3 | **COVERED** | 08-02 | Cases 1-3 / 4-7 / 8-9 |
| Copywriting contract — **5 strings** + no destructive confirmation | **COVERED** | 08-01 | All five verbatim with U+2014 (§7 check 7); no confirmation dialog added |
| Accessibility contract | **COVERED** | 08-01 | `role="group"` + `aria-label="Deck count"`, `aria-pressed` per segment, active never disabled, native `:focus-visible` intact (**zero** outline-suppressing rules in the served CSS), DOM-absence both ways |
| Registry safety | **COVERED** | all | Zero new packages, zero new assets; `npm ci` only across all three plans (T-08-SC honoured) |

**Result: zero MISSING rows. No `## ⚠ Source Audit: Unplanned Items Found` section is warranted.**

---

## 12. Task 2 — Browser Acceptance Checkpoint

### Provenance and attribution

> **Verification performed by the orchestrating Claude agent under the user's standing no-operator-input directive; a human did not personally observe. Re-verify anytime with `npm run dev`.**

**Label: AGENT-EXECUTED — not developer-confirmed.**

**Environment constraint (recorded so the verdict is not over-read).** This executor has **no browser automation** available (no Playwright driver, no Chrome MCP in this agent's toolset) and **installs are forbidden** by the phase's T-08-SC disposition. The checkpoint was therefore resolved by the two strongest substitutes available, and **every step is split into a verified half and, where applicable, an explicitly NOT VERIFIED live half. No step is recorded assumed-pass.**

**Surface used.** Production build → `npm run preview -- --port 4321 --strictPort`, served at `http://localhost:4321/`. Port 4321 was used deliberately and the choice proved load-bearing: **a foreign `vite --port 5199` dev server (PID 3016) was already running**, started 2026-08-24T08:14 from the **main repo**, not this worktree. Had the script reused 5199 the audit would have probed a 13-hour-old dev bundle. It was left running (not mine to kill) and is named here so the orchestrator can account for it.

**Artifacts served (all HTTP 200 from the preview server):**

| Asset | Status | Size |
|-------|--------|------|
| `/` (index.html) | 200 | — |
| `/assets/index-Dg4tVJMz.js` | 200 | 593,984 B |
| `/assets/index-bSIHiRJ9.css` | 200 | 11,601 B |
| `/assets/simulation.worker-BrRvdIw1.js` | 200 | 244,688 B |

The worker chunk resolving 200 is itself the T-08-22 check: the extraction added a module to the graph and the production chunking survived it.

### Step-by-step results

| Step | Claim | Verified half (agent-executed) | Live half |
|------|-------|-------------------------------|-----------|
| 1 | Hold'em toggle unchanged, last child, no accent | Placement pinned by `App.holdemDeckToggle.test.tsx` `lastElementChild` (byte-untouched, green). Treatment: served CSS puts `holdem-deck-toggle` in the **same rule** as `game-mode-switcher` (border, radius, inline-flex, overflow hidden) and the same segment rule (44×44 min, 8px 16px, `font-family:inherit`, 16px/400/1.5). **Zero** toggle rules reference `--accent` or `--destructive` | **NOT VERIFIED** (live pixels) |
| 2 | Blackjack toggle identical treatment, last child | Same CSS rules — literally the same selectors list, so the two are interchangeable *by shared declaration*. Order Deal→Hit→Stand→toggle confirmed in `BlackjackControls.tsx` L59-79 | **NOT VERIFIED** (live pixels) |
| 3 | Each control shows its OWN count (SC1) | **VERIFIED** — consolidation case 3: contradicting stores (gameStore 1 / blackjackStore 2), real switcher clicks, Hold'em presses `-1` while all three blackjack testids are `null`, Blackjack presses `-2` while all three Hold'em testids are `null`, round trip proves neither store cross-wrote | NOT VERIFIED (live clicks) |
| 4 | Hold'em idle switch silent, no tooltip | **VERIFIED** — consolidation case 7 (`aria-pressed` flips, `dealNonce` stays 0, `startSim` never called) + case 12 (no `title` on either segment) | NOT VERIFIED |
| 5 | Hold'em mid-hand fresh deal (SC2/SC3), exact tooltip | **VERIFIED** — case 9 asserts `title="Switching the shoe deals a fresh hand"` on the inactive segment and none on the active; case 6 asserts `dealNonce` 1→2, street `preflop`, `revealedMask` 0, cache 3→1, displayed win is the fresh `53` with explicit `not.toBe(52)` and `53.0%` `not.toBe('52.0%')`. Active-segment click is a no-op via the store's same-value early return (component case 7) | NOT VERIFIED (live choreography) |
| 6 | Blackjack mid-round re-runs over SAME cards (SC3) | **VERIFIED** — case 8: unchanged `roundNonce`, same `playerHand`, same upcard, `revealedHole` false, phase still `player-turn`, hole identity absent from DOM; case 4: counter 0, all 13 cells at the em dash, subtitle flips to `2-deck shoe`, `remainingDeck` 101 | NOT VERIFIED |
| 7 | Resolved switch changes only pending selection | **VERIFIED** — case 5: trial counter + all 13 stat cells captured into a Map and byte-identical after the click; `aria-pressed` flipped, store `deckCount === 2`, service call count unchanged at 1, subtitle unchanged | NOT VERIFIED |
| 8 | Hold'em 2→1 guard **with its dimming** | Guard **VERIFIED** — cases 11/12: guard title displaces the fresh-deal title, click on the disabled segment leaves picks reference-identical and `dealNonce` unchanged, clearing one pick re-enables in the same render and the other pick survives. Dimming **VERIFIED AT ARTIFACT LEVEL** — served CSS: `color:var(--text); opacity:.4; cursor:not-allowed`, **not** destructive red | **NOT VERIFIED** (live DevTools computed-style read) |
| 9 | Blackjack guard incl. accepted hidden-hole leak | **VERIFIED** — case 10: hole `5c` duplicating player `5c` with no visible duplicate → segment 1 `disabled` + locked title verbatim (em dash included), segment 2 unaffected. Dimming identical to Hold'em **by shared CSS rule**. Recorded as **expected behaviour (06-REVIEW WR-01), not a bug** | NOT VERIFIED (live) |
| 10 | Keyboard + focus retention (trap 1) | Focus **retention** **VERIFIED** — `App.holdemDeckToggle.test.tsx` L346-375 asserts `document.activeElement` stays on the clicked segment across the fresh deal, green **byte-untouched**. Focus **ring**: served CSS has **zero** `outline:none/0` rules, so the native `:focus-visible` ring is intact | **NOT VERIFIED** (live ring visibility) |
| 11 | Screen-reader delivery | Structure **VERIFIED** — shipped bundle emits `role="group"` + `aria-label="Deck count"`, `aria-pressed` on **both** segments, exactly one pressed; only ONE such group can exist at a time, proven by the DOM-absence sweeps (`App.modeIsolation.test.tsx` byte-untouched + case 3's `queryByTestId === null` triples) | **NOT VERIFIED** (real AT / accessibility-tree inspection) |
| 12 | Reduced motion gates nothing | **VERIFIED (strong)** — jsdom **forces** reduced motion, and the entire **916-test** suite passes under it, including every toggle-driven fresh deal and re-run. That IS a full reduced-motion run. `MotionConfig`/`reducedMotion` machinery present in the shipped bundle | NOT VERIFIED (OS-level setting in a real browser) |
| 13 | Console hygiene — zero errors, zero React warnings | **VERIFIED** — full-run log scanned for `Warning:`, `act()`, `unmounted`, key warnings and any `stderr`: **0 occurrences**, 0 failures. The absence of key/unmounted-update warnings is the specific signature a remount-inducing extraction would have left | **NOT VERIFIED** (live browser console) |

### Checkpoint verdict

**AGENT-EXECUTED PASS on every automatable half; the live-render halves of steps 1, 2, 8, 10, 11 (and the live-surface halves of 3-7, 9, 12, 13) are NOT VERIFIED.**

**No defect was found by any step.** Nothing was routed back to 08-01 or 08-02.

The residual gap is narrow and specific: **nobody has looked at the pixels.** Everything reachable without a rendering engine — DOM structure, attribute order, the compiled CSS declarations that produce the dimming and the segmented treatment, focus retention, console cleanliness, and all three success criteria — is confirmed. What remains unconfirmed is that a real browser paints those confirmed declarations as expected. Given the CSS is **byte-identical** to the pre-phase file and the DOM is **byte-identical** per the golden, the risk of a live-only visual regression is close to nil by construction — but it is not zero-by-observation, and this record does not claim otherwise.

**Handoff:** the orchestrator holds in-app browser access and will strengthen the frame-independent steps after merge.

### Server hygiene

- Preview server (PID 95348) on 4321: **terminated**.
- Port probe after kill: no listener on 4321/4173/5173.
- Full `node.exe` enumeration: **no worktree or preview process survives**. The only remaining node processes are PID 94836 + PID 3016 — the **pre-existing main-repo dev server on 5199**, which this plan did not start and deliberately did not kill.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's test-path pathspec under-matched and would have under-reported the zero-retargets gate**
- **Found during:** Task 1, the zero-retargets gate
- **Issue:** the plan specifies `git diff --name-only <base>..HEAD -- 'src/**/*.test.*' 'src/test/*'`. Git pathspecs use wildmatch, and `src/**/*.test.*` still requires a literal `/` after the `**` segment, so **root-level** files such as `src/App.deckToggleDom.golden.test.tsx`, `src/App.deckToggleConsolidation.test.tsx` and `src/App.modeShell.guard.test.ts` do not match. As written the gate returned a **single** file (`src/ui/DeckCountToggle.test.tsx`) — which would have looked like a *stricter* pass while actually hiding three of the four sanctioned changes, and would equally have hidden an unsanctioned root-level test edit.
- **Fix:** re-ran with `:(glob)` pathspec magic and independently cross-checked against the unrestricted `git diff --name-status b44f6c6..HEAD -- src/` (7 entries: 4 test + 3 source). Both agree on the same four test paths. No file or test was modified — this is a correction to the *audit method*, not to the repo.
- **Files modified:** none

### Observations recorded, not fixed (out of Phase 8 scope)

**1. PATTERNS guard-impact audit row count**
The plan's Task 1 text says the audit has "ten rows including the resetAnimations addition and the deckCount-zero non-addition". The 08-PATTERNS table as written has **11** rows. All 11 were audited and all 11 are COVERED — this is an off-by-one in the plan's prose with no coverage consequence.

**2. Dead scaffold CSS: `.counter`**
The served stylesheet retains `.counter`, `.counter:hover` and `.counter:focus-visible` rules (which reference `--accent`), but `counter` appears **zero** times as a className in the shipped JS — it is dead Vite-scaffold CSS. It does **not** affect the accent reserved-list claim for this phase (no toggle selector touches accent) and `App.css` is byte-untouched here, so fixing it is explicitly out of D-10 scope. Logged for a future cleanup pass; **not** a Phase 8 defect and **not** routed to 08-01 or 08-02.

**3. Foreign dev server on port 5199**
PID 3016 (`vite --port 5199 --strictPort`, main repo, started 2026-08-24T08:14) plus its npm wrapper PID 94836 were running before this plan began and are still running. Not started by this plan, not safe for a worktree-isolated agent to kill. Flagged for the orchestrator.

### Otherwise

Plan executed as written: zero source changes, zero test changes, `npm ci` only (no `npm install`, no new packages), production build + preview on the mandated port 4321, all servers this plan started terminated and verified dead.

## Known Stubs

None — this plan produces a verification record only. The phase itself ships no stub: 08-01 reported none and this audit found no hardcoded empty value, placeholder string or unwired prop in `DeckCountToggle.tsx` (57 lines, fully wired at both call sites, every prop consumed).

## Threat Flags

None — no network endpoint, auth path, file-access pattern or schema at a trust boundary changed. This plan reads the repo and probes its own localhost preview.

**Register dispositions honoured:** T-08-15 (golden provenance proven four ways plus a detached re-run, §5); T-08-16 (CSS diff EMPTY plus the served disabled declaration read directly, §4); T-08-17 (exactly four test paths, zero removed `expect(`/`it(`, zero `.skip`/`.todo`, §3); T-08-18 (focus-retention test green byte-untouched + zero React warnings, steps 10/13); T-08-19 (11/11 commits green by checkout, §6); T-08-20 (D-05 reasoning restated in full + case 8's positive same-cards assertion, §11); T-08-21 (blast-radius statement + Hold'em no-equivalent-leak note, §10); T-08-22 (production preview on 4321, worker chunk 200); **T-08-23 (the verdict is labelled agent-executed and every unobservable half is recorded NOT VERIFIED rather than assumed-pass)**; T-08-SC (zero installs).

## Self-Check: PASSED

- FOUND: `.planning/phases/08-cross-game-deck-toggle/08-03-SUMMARY.md`
- VERIFIED: phase base `b44f6c6` re-derived as the parent of `4d85066`, baseline 62/863 confirmed by detached checkout
- VERIFIED: HEAD `ea0702f` — 65 files / 916 tests, 0 failures, 0 skipped; tsc, eslint and build clean
- VERIFIED: `git diff --stat b44f6c6..HEAD -- src/App.css src/index.css` EMPTY
- VERIFIED: exactly four test-path changes; guard diff removes 0 `expect(` and 0 `it(` lines
- VERIFIED: golden `4d85066` is an ancestor of `71a2802`, its tree holds both inline toggles, `DeckCountToggle.tsx` absent there, one commit in range, 9/9 pass at that commit
- VERIFIED: all 11 commits leave `src/App.modeShell.guard.test.ts` green (71 → 92 at the extraction commit)
- VERIFIED: every structural grep returned its stated result; both testid registries byte-unmodified
- VERIFIED: STATE.md and ROADMAP.md NOT modified by this plan
- VERIFIED: no preview/dev process started by this plan survives
