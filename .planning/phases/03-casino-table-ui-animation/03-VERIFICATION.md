---
phase: 03-casino-table-ui-animation
verified: 2026-08-24T06:00:00Z
status: passed
score: 20/20 must-haves verified
overrides_applied: 0
process_notes:
  - "Phase mode is 'mvp' in ROADMAP.md, but the phase goal text ('Users interact with a full
    casino-table interface...') does not conform to the required User Story format
    ('As a ..., I want to ..., so that ....'), confirmed via `gsd-sdk query user-story.validate`
    (valid: false — missing 'As a'/'I want to'/'so that'). Per the MVP-mode verification
    contract, an invalid User Story goal means the MVP User Flow Coverage table must NOT be
    fabricated against it. This phase already carries four well-formed, standard 'Success
    Criteria (what must be TRUE)' entries plus per-plan must_haves in normal (non-MVP) shape, so
    this report proceeds with the standard goal-backward methodology (Steps 1-9) instead —
    the substance of verification is unaffected, only the MVP-specific presentation format is
    skipped. Human decision requested: either reformat the ROADMAP Phase 3 goal into User Story
    form via `/gsd mvp-phase 3`, or clear the `mode: mvp` flag if it was inherited by template
    rather than intentionally set for this phase."
  - "The 03-06 human-verify checkpoint (blocking gate) was resolved by the orchestrating agent
    driving a real Chromium browser rather than by the human developer personally, under an
    explicitly documented standing user directive (same precedent already accepted for Phases 1
    and 2, per this report's launch context). This verifier did not re-run that browser
    walkthrough (out of scope: no dev server was started per this task's constraints) but did
    independently confirm the walkthrough's most safety-critical claim — the CR-01/02/03
    exit-gate deadlock fixes — via direct code reading, the fix commits' diffs, and a live run of
    the full automated test suite (208/208 passing, including 8 new hook-level regression tests
    covering all 5 documented release paths). Reduced-motion (step 10) was verified via the
    forced-reduced-motion suite rather than an OS-level toggle, also documented and accepted in
    03-06-SUMMARY.md.
---

# Phase 3: Casino Table UI & Animation Verification Report

**Phase Goal:** Users interact with a full casino-table interface — felt table layout, seated opponents, and detailed animated card components — so the odds feel embedded in a real poker scene rather than a bare calculator, without ever contradicting cards still mid-animation.
**Verified:** 2026-08-24T06:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Independent Automated Re-Run (this verifier, not trusting SUMMARY claims)

| Command | Result |
|---|---|
| `npm test` | 208/208 tests passing (21 test files), matches SUMMARY claim exactly |
| `npx tsc -b` | exit 0 |
| `npx eslint .` | exit 0 |
| `npm run build` | exit 0; `dist/cards/` contains 53 vendored SVGs; `dist/index.html` has correct title |
| `npx vitest run src/App.acceptance.test.tsx src/App.phase3.acceptance.test.tsx src/ui/ src/state/` | 131/131 passing (subset re-run for focused confidence) |
| `git status --short` | clean apart from unrelated `.planning/config.json`/`.claude/` — no uncommitted phase changes |
| Fix commits `aff5672`, `d1e7ac4`, `e0512f3`, `751ee47` | all present in `git log`, all contain real code diffs (not doc-only), matching 03-REVIEW.md's exact proposed fixes |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees a full casino-table scene: felt table, own seat, 3 anonymous opponent seats, and a community card area (ROADMAP SC1 / TBL-01) | VERIFIED | `src/ui/TableScene.tsx` renders `table-scene`/`.felt` containing `HandDisplay` (hero + 3 opponent seats) + `BoardDisplay` (`.community-area`) + `deck-origin`; `src/App.css` has locked oval geometry (`aspect-ratio: 16/10`, radial gradient, absolute-percentage seat placement); `App.phase3.acceptance.test.tsx` asserts all elements co-exist in one composed render |
| 2 | User sees detailed playing cards with proper pips/court-card art replacing Phase 1-2 placeholders (ROADMAP SC2 / TBL-02) | VERIFIED | 53 vendored CC0-1.0 SVGs in `public/cards/` (pinned commit SHA in LICENSE), `PlayingCard.tsx` is the sole exhaustive `Record<Rank,...>/Record<Suit,...>` bridge (`getRank`/`getSuit`, never string-slicing), `dist/cards/` contains all 53 files post-build |
| 3 | User sees cards animate when dealt, flipped, and revealed (ROADMAP SC3 / TBL-03) | VERIFIED | `AnimatedCard.tsx` (deck fly-in, dealer-rotation stagger via `tableGeometry.dealIndex`), `BoardDisplay.tsx` (`AnimatePresence`-wrapped street-advance enter + rewind exit), `FlipCard.tsx` (true `perspective`+`preserve-3d`+`backfaceVisibility:hidden` 3D flip, not a squash) |
| 4 | User never sees odds numbers contradict/spoil cards mid-animation — odds update only after the corresponding animation completes (ROADMAP SC4 / TBL-04) | VERIFIED | `App.tsx`'s odds effect gates on `pendingAnimationCount` FIRST, above the cache-hit branch; **critically, 03-REVIEW.md found 3 real deadlocks in the exit-gate half of this mechanism (CR-01/02/03) that would have permanently frozen odds in a full-motion browser — independently confirmed fixed in this verification** (see dedicated section below) |
| 5 | Card art served from committed repo files — no runtime network dependency, works offline (D-01) | VERIFIED | `grep -rn "raw.githubusercontent\|letele" src/` returns 0 hits; all assets referenced via `/cards/...` from `public/` |
| 6 | Screen-reader user hears "Ace of Spades" not "As" for hero/board cards; no duplicated card names inside an opponent seat button (D-03) | VERIFIED | `cardAltText()` produces full names; opponent seat cards render `decorative` (`alt=""`) since the button's own `aria-label` is the authoritative name; `App.phase3.acceptance.test.tsx` asserts alt pattern `^[A-Za-z]+ of [A-Za-z]+$` |
| 7 | Odds panel docked beside/below the felt, never on top of or nested inside it (D-05) | VERIFIED | `OddsPanel` is a sibling of `TableScene` in `App.tsx`'s `.table-row`; test asserts `table-scene.contains(odds-panel) === false` |
| 8 | Set Up Scenario control opens the identical Phase 2 seven-slot picker (D-06) | VERIFIED | `set-up-scenario-button` toggles `aria-expanded`/`aria-controls`; `CardPicker.tsx` internals/testid untouched; `App.acceptance.test.tsx` opens the disclosure before picker-slot interactions |
| 9 | Deal/Rewind/Advance/seats remain keyboard-reachable with 44px hit areas and a visible focus ring (D-06) | VERIFIED | `src/App.css` sets `min-width/height: 44px` on control-bar buttons and seats; `:focus-visible` rule present; independently confirmed by 03-06's browser walkthrough (0 unreachable buttons, all ≥44px) |
| 10 | Whole scene is DOM+SVG+CSS, no canvas, no new rendering runtime (D-07) | VERIFIED | `grep -rn "<canvas\|react-konva\|pixi" src/` returns 0; only `motion` (DOM-based) added to `package.json` |
| 11 | Simulation for a new knowledge state does not start until the animation describing it completes — gate is structural on BOTH live and cache-hit branches (D-11) | VERIFIED | `if (pendingAnimationCount > 0) return;` is the first statement of `App.tsx`'s odds effect, before `getCached`; `grep -c "useUiStore.getState().pendingAnimationCount" src/App.tsx` = 0 (subscribed value only, no stale-read footgun) |
| 12 | Interrupted or unmounted card can never strand the gate — pending count always returns to 0 (D-10) | VERIFIED (post-fix) | `useAnimationGate`'s per-card path was always safe; **the container-level `useExitGate` path had 3 real stranding bugs (CR-01/02/03), all fixed same-day with 8 new hook-level regression tests exercising the previously-untested `enabled: true` path** — see below |
| 13 | Animation state changes at most twice per card (start/completion), never per frame (D-07) | VERIFIED | `grep -rn "onUpdate\|useMotionValueEvent" src/ui/AnimatedCard.tsx` = 0; store writes only in registration/completion effects |
| 14 | Reduced-motion user sees cards in final position immediately; gate still resolves (D-09) | VERIFIED | `useReducedMotion()` zeroes transitions and disables gate registration in `AnimatedCard`/`FlipCard`; entire 208-test suite runs under forced `prefers-reduced-motion: reduce` and passes, exercising exactly this path end-to-end |
| 15 | Re-deal mid-animation cancels cleanly: no orphaned/duplicate elements, counter returns to 0 (D-10) | VERIFIED | Slot+`dealNonce` keying forces full remount; dedicated `App.test.tsx` tests assert post-re-deal DOM shape and counter-to-zero after manual arm/release |
| 16 | Worker error surfaces through the gate; stale error banner clears on next success including cache-hit path (D-13, 02-REVIEW WR-01) | VERIFIED | `App.tsx` cache-hit branch now `queueMicrotask(() => setErrorMessage(null))`; regression test locks this in (`src/App.test.tsx:690-721` per 03-REVIEW, re-confirmed present) |
| 17 | Browser tab title/favicon corrected, scaffold assets removed (D-14) | VERIFIED | `index.html` title is exactly "Monte Carlo Poker Simulator"; `public/favicon.svg` contains `#aa3bff` spade path, no Vite reference; `src/assets/{react,vite}.svg`, `hero.png`, `public/icons.svg` all absent; STATE.md blocker entry struck |
| 18 | All four ROADMAP Phase 3 success criteria are under automated assertion, not just eye-check (D-11 verification requirement) | VERIFIED | `src/App.phase3.acceptance.test.tsx` — 4 `describe` blocks quoting ROADMAP criteria verbatim, 6 tests, all independently re-run and passing |
| 19 | Every Phase 1-2 testid/aria-label/disabled contract survives the re-skin unchanged | VERIFIED | 208/208 total suite includes the full Phase 1-2 regression harness; `git diff` scoping assertions in each plan's acceptance criteria confirmed narrow, documented test adjustments only |
| 20 | Requirement IDs TBL-01..04 all accounted for and mapped to this phase | VERIFIED | REQUIREMENTS.md traceability table maps all four to "Phase 3: Casino Table UI & Animation"; plan frontmatter (`requirements:`) collectively covers TBL-01 (03-02), TBL-02 (03-01), TBL-03 (03-03/03-04), TBL-04 (03-03/03-04/03-05) — no orphaned IDs |

**Score:** 20/20 truths verified

## Critical Finding: Exit-Gate Deadlocks Found and Fixed (independently confirmed)

03-REVIEW.md (code review, same day as execution) found **3 CRITICAL bugs** that would have violated Truth #4/#12 above in any real (non-reduced-motion) browser:

- **CR-01**: Rewinding a full board to pre-flop unmounted `<AnimatePresence>` in the same commit `useExitGate` armed a hold for, so `onExitComplete` could never fire — odds frozen at em dashes **permanently**, recoverable only by a page reload. The orchestrator reproduced this live in a browser (Deal → Advance → Rewind) before fixing it.
- **CR-02**: `useExitGate` could double-arm on overlapping rewinds (only one release ever fires) and leaked a hold across a re-deal's reset-key branch.
- **CR-03**: An interrupted exit (rewind then re-advance within the 150ms exit window) relies on `AnimatePresence` behavior that silently drops the re-entering child from its exit-tracking map without invoking `onExitComplete` — stranding the hold.

This verifier independently confirmed, by reading the current source (not the SUMMARY's narrative):
- `src/ui/useAnimationGate.ts` lines 96-196 (`useExitGate`) implement exactly the fixes 03-REVIEW.md proposed: guarded single-arm (`!pendingRef.current`), release-on-count-rise, release-on-resetKey-change, and release-on-`enabled`-false — the hook's own doc comment now documents "5 release paths" as a closed lifecycle.
- `src/ui/BoardDisplay.tsx` line 63 passes `enabled = !reduce && visibleBoard.length > 0` exactly as CR-01's fix prescribes.
- `git show --stat` on commits `aff5672`, `d1e7ac4`, `e0512f3` shows real, substantive diffs to both the hook and its test file (not documentation-only commits).
- `src/ui/useAnimationGate.test.ts` contains 8 dedicated hook-level regression tests (lines 126-232) that explicitly drive the previously-unexercised `enabled: true` code path for all three CR scenarios plus the underlying overlapping/rise/resetKey/disable transitions — these are NEW tests, not pre-existing coverage, confirmed by reading the full file.
- Running `npm test` now (independently, not trusting the SUMMARY's "208/208" claim) reproduces 208/208 passing.

This is exactly the kind of "tasks completed but goal not achieved until reviewed" gap this verification process exists to catch — and in this case, the gap was caught by the project's own code-review gate the same day, with commit-level evidence of a real fix, not merely a documentation update. Verification treats this as **VERIFIED (post-fix)**, not as a residual gap, because the fix is code-complete, test-locked, and independently confirmed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `public/cards/*.svg` (53 files) + `LICENSE` | Vendored CC0 deck | VERIFIED | 53 files present; LICENSE has ≥1 "CC0" mention and a 40-char SHA |
| `src/ui/PlayingCard.tsx` | D-03 card-code→art bridge | VERIFIED | Exports `PlayingCard`/`cardAssetPath`/`cardAltText`; exhaustive Record maps; `getRank`/`getSuit` used, no string-slicing |
| `src/ui/CardBack.tsx` | Face-down rendering | VERIFIED | Single-element leaf, `alt=""` |
| `src/ui/TableScene.tsx` | Felt composition root | VERIFIED | `table-scene`/`.felt`, composes HandDisplay+BoardDisplay+deck-origin, zero extraneous store reads beyond the documented gate-release effect |
| `src/ui/Seat.tsx` | Hero/opponent seat variants | VERIFIED | Discriminated union; opponent branch preserves Phase 1-2 contract byte-for-byte |
| `src/ui/OddsPanel.tsx` | Off-felt odds dock | VERIFIED | `odds-panel` testid, `aria-busy` reflects gate |
| `src/state/uiStore.ts` | `pendingAnimationCount` counter | VERIFIED | Clamped `Math.max(0, count-1)`; `resetAnimations` doc now correctly states test-only (WR-01 fix in `751ee47`) |
| `src/ui/useAnimationGate.ts` | Gate registration + exit gate | VERIFIED (post-fix) | `useAnimationGate` + `useExitGate`, closed 5-path release lifecycle |
| `src/ui/AnimatedCard.tsx` | Deck-to-slot fly-in | VERIFIED | `motion.span`, reduced-motion short-circuit, no per-frame store writes |
| `src/ui/FlipCard.tsx` | 3D reveal, leak-guarded | VERIFIED | `perspective`+`preserve-3d`+`backfaceVisibility:hidden`; face element conditionally rendered only when `faceUp && card !== undefined` |
| `src/ui/tableGeometry.ts` | Deck offsets + dealer rotation | VERIFIED | `POSITIONS`/`dealOriginOffset`/`dealIndex` match target contracts exactly |
| `src/App.phase3.acceptance.test.tsx` | 4 SC describe blocks | VERIFIED | Present, 6 tests, all passing, quotes ROADMAP criteria verbatim |
| `index.html` / `public/favicon.svg` | Title + favicon fix | VERIFIED | Title exact match; favicon has `#aa3bff`, no Vite reference |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/App.tsx` | `src/ui/TableScene.tsx` | siblings, never nested | WIRED | `.table-row` contains `<TableScene />` + `<OddsPanel />` as direct siblings |
| `src/ui/TableScene.tsx` | `src/ui/HandDisplay.tsx` | seats rendered inside felt | WIRED | Confirmed in JSX |
| `src/ui/BoardDisplay.tsx` | `src/ui/AnimatedCard.tsx` | community cards enter from deck | WIRED | `<AnimatedCard>` wraps each visible community card |
| `src/ui/BoardDisplay.tsx` | `useExitGate`/`onExitComplete` | exit release | WIRED (post-fix) | `<AnimatePresence key={dealNonce} onExitComplete={releaseExitGate}>` |
| `src/ui/Seat.tsx` | `src/ui/FlipCard.tsx` | opponent hole cards flip | WIRED | `renderHoleSlot` always renders `FlipCard`, never branches render shape on `revealed` |
| `src/App.tsx` | `src/state/uiStore.ts` | odds effect gated on counter | WIRED | Subscribed value only, checked before cache lookup |
| `src/state/gameStore.ts` | `src/state/uiStore.ts` | 4 actions arm the gate conditionally | WIRED | `grep -c "beginAnimation" src/state/gameStore.ts` = 4 |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| TBL-01 | 03-02 | Full casino-table scene | SATISFIED | TableScene/Seat/OddsPanel composition, verified above |
| TBL-02 | 03-01 | Detailed playing card faces | SATISFIED | Vendored deck + PlayingCard bridge |
| TBL-03 | 03-03, 03-04 | Cards animate (deal/street/rewind/reveal) | SATISFIED | AnimatedCard + FlipCard + AnimatePresence choreography |
| TBL-04 | 03-03, 03-04, 03-05 | Odds never contradict mid-animation cards | SATISFIED (post-fix) | Structural gate on both branches; 3 critical deadlocks found and fixed same day, independently confirmed |

No orphaned requirements: REQUIREMENTS.md maps exactly TBL-01..04 to Phase 3, and all four are claimed across the six plans' frontmatter.

**Note:** REQUIREMENTS.md's traceability table still lists all four TBL-* rows as "Pending" status text, while ROADMAP.md and the plan trail show the phase complete. This is a documentation-sync gap in REQUIREMENTS.md, not a functional gap — flagged for housekeeping, not blocking.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD`/`FIXME`/`XXX` | none found | `grep -rn "TBD\|FIXME\|XXX" src/` returns 0 hits in phase-modified files |
| — | — | `TODO`/`HACK`/`PLACEHOLDER` | none found | 0 hits outside legitimate `.card-placeholder` CSS class names |
| `src/test/setup.ts:40` | matchMedia substring match | INFO (03-REVIEW IN-05, unfixed, pre-existing) | Low | `query.includes('prefers-reduced-motion')` would also match the semantically-opposite `no-preference` form; harmless today only because the installed Motion queries the boolean form. Not a Phase-3-goal blocker; a future Motion upgrade could silently flip test behavior. |
| `tsconfig.app.json` | `"strict": true` absent | WARNING (03-REVIEW WR-02, unfixed, pre-existing since Phase 1) | Medium | The T-03-12 no-peek leak guard is expressed entirely via nullable types (`card?: Card`) that are compiler-unenforced without `strictNullChecks`. Documented and open, not a regression introduced by this phase. |
| `src/App.tsx` | `errorMessage` string never rendered | INFO (03-REVIEW IN-03, unfixed) | Low | Cosmetic/documentation mismatch, not a functional bug. |
| `tsconfig.app.json:7` | `"node"` in browser-app `types` | INFO (03-REVIEW IN-04, unfixed) | Low | Scoping concern, not a functional bug. |
| `src/ui/OddsTable.tsx` + `WinTieLossDisplay.tsx` | `formatPct` duplicated | INFO (03-REVIEW IN-01, unfixed) | Low | Maintenance debt, not a functional bug. |
| `src/App.css:1-184` | Dead Phase-1 scaffold CSS | INFO (03-REVIEW IN-02, unfixed) | Low | Logged in `deferred-items.md`, explicitly out of this phase's task scope. |

None of the remaining INFO/WARNING items were newly introduced as stubs or incomplete work by Phase 3 — all are either pre-existing (WR-02, dating to Phase 1) or explicitly-scoped-out cleanup items with a paper trail (`deferred-items.md`). The three CRITICAL findings were the load-bearing risk to Truth #4/#12 and are confirmed fixed.

### Human Verification Required

None required beyond what has already been completed and documented. The 03-06 blocking human-verify checkpoint was executed (by the orchestrating agent, under an explicitly documented standing user directive matching the accepted Phase 1-2 precedent) and its most safety-critical claim (the exit-gate deadlock fixes) has been independently re-confirmed by this verifier via source inspection, commit diffs, and a fresh full-suite test run — not merely by re-reading the SUMMARY's narrative.

One item is flagged for the developer's own future real-browser confirmation, not required to close this phase: reduced-motion (D-09, walkthrough step 10) was validated via the forced-reduced-motion automated suite rather than a literal OS-level "reduce motion" toggle in a real browser, per 03-06-SUMMARY.md's own documented deviation. If a genuinely human, OS-toggle pass has not yet occurred for this app, it would still be worth doing at the developer's convenience — but this is a UX-polish confirmation, not a functional gap; the underlying gate mechanics are proven correct at the code and test level and did not, unlike the exit-gate hold, exhibit a mode-dependent bug class.

## Process Note: MVP Mode / User Story Format Mismatch

Phase 3 is marked `mode: mvp` in ROADMAP.md, but its goal text ("Users interact with a full casino-table interface...") fails the required User Story format check (`gsd-sdk query user-story.validate` → `valid: false`, missing "As a"/"I want to"/"so that"). Per the MVP-mode verification contract, an invalid User Story goal means the MVP-specific "User Flow Coverage" table must not be fabricated against it.

This phase already has four well-formed, standard "Success Criteria (what must be TRUE)" entries (matching the non-MVP roadmap convention) plus six plans each carrying their own correctly-formatted "As a ... I want to ... so that ..." Phase Goal at the plan level. This report therefore proceeded with the standard (non-MVP) goal-backward methodology against those criteria, which is fully rigorous and produced the 20-truth table above — the MVP mismatch did not block or degrade the substance of this verification, only its optional MVP-specific presentation layer.

**Recommended action (human decision, not blocking phase completion):** either run `/gsd mvp-phase 3` to reformat the ROADMAP goal into User Story form, or clear the `mode: mvp` flag on Phase 3 if it was inherited from an earlier phase's template rather than intentionally set — Phase 3's actual content (4 explicit testable Success Criteria, 6 standard-shaped execution plans) reads as a standard v1 phase, not an MVP-mode phase.

## Gaps Summary

No blocking gaps. The one class of finding that would have been a BLOCKER — the exit-gate deadlocks (CR-01/02/03) that could permanently freeze the odds panel in a real, full-motion browser, directly contradicting the ROADMAP's Success Criterion 4 and requirement TBL-04 — was caught by the project's own same-day code review, fixed with real code changes, and locked in with 8 new hook-level regression tests. This verifier independently confirmed the fix is present in the current source, is exercised by dedicated tests (not merely claimed), and that the full 208-test suite (matching the SUMMARY's claimed count) passes on a fresh run.

Two informational process items are surfaced for the developer's attention but do not block this phase: (1) the MVP-mode/User-Story-format mismatch described above, and (2) REQUIREMENTS.md's traceability table still reading "Pending" for TBL-01..04 despite the phase being functionally complete — a documentation-sync task, not a code gap.

---

_Verified: 2026-08-24T06:00:00Z_
_Verifier: Claude (gsd-verifier)_
