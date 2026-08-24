---
phase: 05-game-mode-shell-store-separation
verified: 2026-08-24T20:05:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 5: Game-Mode Shell & Store Separation Verification Report

**Phase Goal:** Users can switch between Hold'em and Blackjack via a mode switcher, with each game maintaining fully independent state and odds so neither leaks into or corrupts the other.
**Verified:** 2026-08-24T20:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Merged from ROADMAP.md Success Criteria (Phase 5) + PLAN frontmatter must_haves across 05-01/05-02/05-03, reconciled against the post-checkpoint fix cycle documented in 05-03-SUMMARY.md and 05-REVIEW.md.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can switch between Hold'em and Blackjack via an on-screen segmented switcher, labeled exactly "Hold'em"/"Blackjack", visible in both modes, non-accent active treatment (ROADMAP SC1, D-01) | VERIFIED | `src/ui/GameModeSwitcher.tsx` renders both labels verbatim, `role="group"`, `aria-label="Game mode"`, `aria-pressed` per button, no `disabled`. CSS in `src/App.css` uses only `var(--border)`/`var(--text-h)`, zero `var(--accent)`. Pinned by `App.modeShell.guard.test.ts` (32/32 passing) and exercised end-to-end by `App.modeSwitch.test.tsx`. |
| 2 | Hold'em's full existing interaction loop works identically after the refactor, verified by the full existing acceptance suite passing unchanged (ROADMAP SC2, D-09) | VERIFIED | `src/App.test.tsx`, `src/App.acceptance.test.tsx`, `src/App.phase3.acceptance.test.tsx` are byte-unchanged across the entire phase (`git log 8b78b67..HEAD -- <these 3 files>` returns zero commits). Full suite: 388/388 passing (independently re-run), up from the pinned 281 pre-phase baseline, all additive. |
| 3 | Switching to Blackjack shows an independent screen/state sharing no store fields or odds-cache keys with Hold'em, verified by a store-isolation test (ROADMAP SC3, D-03/D-04/D-05/D-06) | VERIFIED | `BlackjackScene.tsx` imports no Hold'em store (guard-pinned); `App.modeIsolation.test.tsx` proves `gameStore`/`pickerStore` `toEqual` round-trip, `settledCache` key-set byte-identical during a Blackjack dwell, `startSimulation` never called in blackjack mode. DOM-absence sweep (`it.each` over 13 Hold'em testids + untestid'd Deal button) passes after a real deal + open picker. Independently re-run: passing. |
| 4 | Switching modes mid-simulation cleanly cancels any in-flight worker run, no stale odds bleed across modes (ROADMAP SC4, D-07) | VERIFIED | `App.tsx` effect cleanup is the sole `cancelSimulation(` call site (`grep -c` = 1, confirmed independently). `App.modeSwitchRace.test.tsx` proves `cancelSimulation` called exactly once across a switch while a run is genuinely in flight (`toHaveBeenCalledTimes(1)`), with real gate-registered cards mounted. |
| 5 | While in Blackjack mode, no Hold'em testid and no Deal button exist anywhere in the DOM — genuinely unmounted, not hidden (D-04) | VERIFIED | `App.tsx` uses `&&` conditional rendering exclusively at every fork point (no `display:none`/`hidden`). `App.modeIsolation.test.tsx`'s `it.each` sweep (13 testids incl. `card-picker`/`picker-panel`) plus `queryByRole('button', {name: /^deal$/i})` all confirmed absent post-deal, post-picker-open. |
| 6 | The odds effect is mode-scoped and the four Hold'em stores stay byte-unchanged in shape, unaware Blackjack exists (D-05, D-10) | VERIFIED | `App.tsx:51` contains `if (mode !== 'holdem') return;` as first guard; dependency array ends `pendingAnimationCount, mode]` (both independently grepped). `gameStore.ts`/`oddsStore.ts`/`pickerStore.ts`/`uiStore.ts`/`engine/conditioning.ts` contain no `blackjack`/`gamemode` (case-insensitive), confirmed by guard test and independent diff against phase base commit `8b78b67` (zero changes to `src/engine`, `src/worker`, `pickerStore.ts`). `oddsStore.knowledgeKey` unchanged two-part key, confirmed by direct read. |
| 7 | Full regression bar holds: 281-baseline + phase additions green, lint/build clean, Phase 4 traps (deckCount) untripped (D-09, D-10) | VERIFIED | Independently re-ran: `npx vitest run` → 37 files / 388 tests, 0 failures. `npm run lint` → exits 0. `npm run build` (`tsc -b && vite build`) → exits 0. `git grep deckCount -- src/App.tsx src/state/gameModeStore.ts src/ui/GameModeSwitcher.tsx src/ui/BlackjackScene.tsx` → empty. |
| 8 | Post-checkpoint switch-back defense is real: three-layer fix present in source, not just claimed in SUMMARY (CR-01, CR-02, WR-02) | VERIFIED | All four fix commits exist in `git log` (`a6f4ced`, `ab90734`, `28c5e15`, `c9abed0`) with substantive diffs matching their stated purpose. Layer 1: `TableScene.tsx` `prevRef` gates `endAnimation()` on actual dep changes (CR-02). Layer 2: `App.tsx:67` `pendingAnimationCount > 0 \|\| useUiStore.getState().pendingAnimationCount > 0` secondary live-read guard, subscription kept (CR-01). Layer 3: `gameModeStore.holdemRestorePending` set on blackjack→holdem transition, consumed once at mount by `AnimatedCard.tsx`/`FlipCard.tsx` (`initial={false}`, gate never armed for a restore mount), acknowledged by `App.tsx`'s `ackHoldemRestore` effect (WR-02). Race test assertions independently confirmed exact-valued (`toBe(0)`, `toBe(8)`), not `>=0`. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/state/gameModeStore.ts` | Only cross-game store: `mode` + `setMode` | VERIFIED (with noted, justified addition) | Contains `useGameModeStore`, `'holdem' \| 'blackjack'`, imports nothing from Hold'em stores (guard-pinned). Now also holds `holdemRestorePending`/`ackHoldemRestore`, added post-checkpoint to fix WR-02 (05-REVIEW). This is a deviation from Plan 01's literal "exactly `{ mode, setMode }`" wording but is cross-game SHELL state (which mount is a restore), reads nothing from any Hold'em store, and is explicitly justified in 05-REVIEW.md's WR-02 fix and documented in the store's own doc comment. Guard test was not required to pin the exact field count and still passes. |
| `src/ui/GameModeSwitcher.tsx` | Segmented two-button control, `role=group`, `aria-pressed` | VERIFIED | Matches locked labels/testids verbatim; no `disabled`; guard-pinned. |
| `src/ui/BlackjackScene.tsx` | Felt-shell placeholder, locked empty-state copy | VERIFIED | `blackjack-scene`/`blackjack-empty-state` present, both copy strings verbatim, zero `<button>`, zero store imports — all guard-pinned and independently read. |
| `src/App.modeSwitch.test.tsx` | End-to-end happy-path switch proof | VERIFIED | 187 lines, independently run: passing. |
| `src/App.tsx` | Mode-scoped odds effect + conditional render fork | VERIFIED | `useGameModeStore` selector, mode-gated effect, `&&`-only forking confirmed by direct read. |
| `src/App.modeIsolation.test.tsx` | Store/cache/DOM isolation proof | VERIFIED | 277 lines, independently run: passing (part of 62/62 phase-test subset run). |
| `src/App.modeSwitchRace.test.tsx` | Switch-mid-deal race proof | VERIFIED | 228 lines, exact-valued assertions confirmed, independently run: passing. |
| `src/App.modeShell.guard.test.ts` | Source-shape negative-invariant guard | VERIFIED | 251 lines, `@vitest-environment node`, `readFileSync`-based, independently run: 32/32 passing. |
| `src/App.modeErrorBanner.test.tsx` (WR-01 fix artifact) | Error banner cleared on mode leave | VERIFIED | 110 lines, independently run: passing. |
| `src/ui/TableScene.remount.test.tsx` (CR-02 fix artifact) | Gate-theft-on-remount regression guard | VERIFIED | 114 lines, independently run: passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `App.tsx` | `gameModeStore.ts` | `useGameModeStore((state) => state.mode)` subscribed selector in effect deps | WIRED | Confirmed at `App.tsx:37`, dependency array ends `pendingAnimationCount, mode]`. |
| `GameModeSwitcher.tsx` | `gameModeStore.ts` | `setMode('holdem'/'blackjack')` bound to onClick | WIRED | Confirmed directly in source. |
| `App.tsx` | `BlackjackScene.tsx` | `mode === 'blackjack' && <BlackjackScene />` | WIRED | Confirmed at `App.tsx:205`. |
| `App.tsx` effect cleanup | `simulationService.cancelSimulation` | Existing ignore-flag cleanup, mode in dep array | WIRED | Single call site confirmed (`grep -c` = 1); race test proves exactly-once call on switch-away mid-run. |
| `gameModeStore.holdemRestorePending` | `AnimatedCard.tsx` / `FlipCard.tsx` | `useState(restorePendingNow && gateIdleNow)` captured once at mount | WIRED | Confirmed in both files; `ackHoldemRestore()` called from `App.tsx`'s post-mode-change effect. |
| `TableScene.tsx` | `useUiStore.endAnimation` | `prevRef`-gated effect, fires only on real dep change | WIRED | Confirmed; regression-pinned by `TableScene.remount.test.tsx`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npx vitest run` | 37 files / 388 tests, 0 failures | PASS |
| Lint clean | `npm run lint` | exits 0, no output | PASS |
| Build clean (tsc + vite) | `npm run build` | exits 0, dist produced | PASS |
| Single cancellation call site | `grep -c "cancelSimulation(" src/App.tsx` | 1 | PASS |
| No deckCount leakage into Phase 5 files | `git grep -n deckCount -- src/App.tsx src/state/gameModeStore.ts src/ui/GameModeSwitcher.tsx src/ui/BlackjackScene.tsx` | empty | PASS |
| Phase 4 traps untripped | `git diff --stat 8b78b67..HEAD -- src/engine src/worker src/state/pickerStore.ts` | empty | PASS |
| v1 acceptance suites untouched | `git log 8b78b67..HEAD -- src/App.test.tsx src/App.acceptance.test.tsx src/App.phase3.acceptance.test.tsx` | no commits | PASS |
| No dev server left running | `netstat -ano \| grep 5173` | no listener | PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes exist in this repository and none are declared in the PLAN/SUMMARY files for this phase (this is a React/Vite/Vitest project, not a migration/CLI-probe project). Skipped — no applicable probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BJ-01 | 05-01, 05-02, 05-03 | "User can switch between Hold'em and Blackjack; each game keeps its own state and odds (no mode leakage, no shared odds-cache keys)" | SATISFIED | Verified above across truths 1, 3, 5, 6 — switcher works, isolation proven from 3 angles (store/cache/DOM), guard-pinned negative invariants, human-equivalent browser acceptance recorded in 05-03-SUMMARY.md, and the post-checkpoint criticals found by code review were fixed and re-verified in source. |

No orphaned requirements: REQUIREMENTS.md traceability table maps only BJ-01 to Phase 5; all other v2 requirement IDs (DECK-*, BJ-02..07, HE2-*) map to Phases 4/6/7/8, none of which are claimed by this phase's plans.

### Anti-Patterns Found

Scanned all phase-modified/created files (`App.tsx`, `gameModeStore.ts`, `GameModeSwitcher.tsx`, `BlackjackScene.tsx`, `TableScene.tsx`, `AnimatedCard.tsx`, `FlipCard.tsx`, and all new test files) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented".

None found. The only matches were the literal, intentional word "placeholder" describing the deliberately-honest, spec-locked `BlackjackScene` empty-state component itself (D-03's explicit design, not an implementation stub) — not a debt marker.

No blockers or warnings from anti-pattern scanning.

### Human Verification Required

None outstanding. The PLAN 03 checkpoint (Task 3, `gate="blocking"`) was resolved per its documented protocol: agent-verified live-browser evidence for all frame-independent steps (switcher, DOM-absence sweep, round trip, rapid toggling, keyboard, console — all confirmed clean), with frame-dependent steps (Hold'em deal regression, switch-mid-deal race) resting on automated evidence due to a documented, pre-existing environmental condition (hidden browser pane suspending rAF, same condition previously documented in 04-06-SUMMARY.md) rather than a skipped check. This resolution path and its verbatim attribution caveat are recorded in `05-03-SUMMARY.md`.

Subsequently, an independent code review (`05-REVIEW.md`) exercised exactly the frame-dependent switch-back scenario the checkpoint could not directly observe and found two real Critical defects the automated-evidence resolution had missed (CR-01, CR-02) plus two Warnings (WR-01, WR-02). All four were fixed same-day with commits verified present and substantive in this verification pass, and the regression suite grew from 376 to 388 tests (12 additive, including two new regression-guard files: `App.modeErrorBanner.test.tsx` and `TableScene.remount.test.tsx`), with the race test's loose `>=0` assertions tightened to exact values. WR-03 (a structural `<HoldemGame />` extraction recommendation, not a functional defect) was explicitly deferred to Phase 6 by a recorded orchestrator decision, tracked in `.planning/STATE.md`'s Blockers/Concerns section — this is a legitimate deferral, not a hidden gap, since it does not affect BJ-01's observable behavior and is scheduled for the phase where its extraction becomes structurally necessary anyway.

### Gaps Summary

No gaps. All 8 must-have truths verified against the current codebase, independent of SUMMARY.md narrative. The one deviation from a PLAN 01 literal must-have ("gameModeStore holds exactly `{ mode, setMode }`") — the post-checkpoint addition of `holdemRestorePending`/`ackHoldemRestore` — is a necessary, narrowly-scoped, well-documented fix for a real defect (WR-02) found by independent code review, not scope creep or an unverified claim; it was verified directly in source and does not violate the store's core invariant (still the only cross-game store, still imports nothing from Hold'em-owned stores, still holds no `deckCount`).

---

_Verified: 2026-08-24T20:05:00Z_
_Verifier: Claude (gsd-verifier)_
