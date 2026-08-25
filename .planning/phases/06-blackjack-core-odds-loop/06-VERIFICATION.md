---
phase: 06-blackjack-core-odds-loop
verified: 2026-08-25T00:10:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 6: Blackjack Core Odds Loop Verification Report

**Phase Goal:** Users can play a full Blackjack round on its own table screen — deal, watch live bust/dealer-outcome/EV odds converge, hit or stand, reveal the dealer's hole card, and see deck count change the odds — mirroring Hold'em's live-convergence experience.
**Verified:** 2026-08-25T00:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

All evidence below was independently gathered from the codebase at HEAD (`9217234`), never taken from SUMMARY claims. Full suite, tsc, eslint, and build were re-run in this verification session.

## Goal Achievement

### Observable Truths

Merged from ROADMAP.md Phase 6 Success Criteria (SC1–SC5, the contract) + phase-level invariants (D-08 Hold'em preservation, regression bar, trap ledger) reconciled against the post-review fix cycle (06-REVIEW.md, commits `4c16c78`/`09563b8`/`07d4624`/`d6c2b72`/`efb9699`).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can deal a Blackjack round (player hand + upcard face-up, hole face-down) and watch live win/push/lose, bust-if-hit, and dealer-outcome-distribution odds converge over streamed worker trials with a visible trial counter (ROADMAP SC1) | ✓ VERIFIED | `blackjackStore.deal()` draws all 4 cards in one `drawN`, resolves naturals (D-03/D-03a), arms the gate, resets odds. `BlackjackGame.tsx` odds effect (gates: mode → animation → roundPhase → cache → run) calls `deriveBlackjackConditionedState` (sole D-02 reader) → `startBlackjackSimulation` over the namespaced `{ poker, blackjack }` Comlink surface (`simulation.worker.ts:10`, lazy singleton in `workerClient.ts`). `BustEvDisplay` renders `blackjack-trial-counter` (`toLocaleString`) + `blackjack-bust-pct` + Win/Push/Loss; `DealerDistributionDisplay` renders 7 label-driven rows (`DEALER_BUCKET_LABELS`, never counts.length). Loop suite `App.blackjackLoop.test.tsx` BJ-02/BJ-03 cases green (re-run this session: 4 targeted files / 35 tests pass). |
| 2 | User sees per-unit EV for Stand vs. Hit under fixed conventions — dealer stands on soft 17, natural pays 3:2 (ROADMAP SC2) | ✓ VERIFIED | Engine: `DEALER_STANDS_ON = 17` with NO soft/hard branch (S17 = stand on all 17s, `blackjackHandValue.ts:70,104-106`); `isNatural` 2-card guard; naturals resolve at deal (D-03a) so EV trial outcomes are provably {−1, 0, +1} and 3:2 is the resolution/banner path ("Your natural pays 3:2."). `runBlackjackTrials` tallies `standOutcomes`/`hitOutcomes` per trial; `formatEv` computes `(win − lose)/trials` with U+2212 sign, round-first-then-sign zero handling. Both EV tiles in `BustEvDisplay` with the mandatory always-visible "hit once, then stand" D-05 sub-copy (DOM text, never tooltip). |
| 3 | User can Hit or Stand; hitting updates the hand and recomputes odds live, standing plays the dealer out per fixed rules and shows the round outcome (ROADMAP SC3) | ✓ VERIFIED | `blackjackStore.hit()` draws from `liveShoeLedger` (never the odds pool), bust resolves in the same `set()` commit; `stand()` shuffles the entire ledger once and threads `playDealerHand`'s `drawNext` through a cursor, classifies via `classifyDealerOutcome`/`compareToDealer`, resolves with `revealedHole: true`. Odds effect re-runs on `playerHand`/`roundPhase` dependency changes. `BlackjackOutcomeBanner` renders the 8-path locked-copy outcome. Loop suite BJ-05 cases prove hit-starts-fresh-run (per-call-distinct values) and stand → hole reveal + banner + zero new runs. |
| 4 | User can reveal the dealer's hole card early and watch all odds recondition on the newly known card (ROADMAP SC4) | ✓ VERIFIED | `revealHole()` one-way per round (guarded, reset only by `deal()`). **CR-01 fix confirmed in source:** `BlackjackConditionedState.knownDealerHole?: Card` (`blackjackEquity.ts:32`); trial loop uses `state.knownDealerHole ?? drawn[cursor++]` (`blackjackEquity.ts:138`) so post-reveal every trial's dealer hole IS the revealed card, not a resampled hypothetical; `deriveBlackjackConditionedState` sets it iff revealed and excludes the copy from `remainingDeck` (`blackjackConditioning.ts:86-94`); `validateBlackjackConditionedState` budgets the known hole in the overlap check (`blackjackSimulationApi.ts:65-69`). CR-01 RED tests present in 4 files (`blackjackConditioning.test.ts`, `blackjackEquity.property.test.ts`, `blackjackSimulationApi.test.ts`, `App.blackjackLoop.test.tsx`) — all green. Hidden-state DOM leak guard: `card={revealedHole ? round.dealerHole : undefined}` (`BlackjackDealerArea.tsx:105`). |
| 5 | Toggling deck count (1 vs. 2) for Blackjack visibly changes the odds, verifiable in-app (ROADMAP SC5) | ✓ VERIFIED | `setDeckCount` implements the full A3 matrix (player-turn: clearCache + reset + retitle, fresh run under new shoe; idle/resolved: pending-only, retained numbers byte-identical; same-value: total no-op; WR-01 refusal on impossible 2→1). D-12 statistical anchor `blackjackNaturalFrequency.test.ts` (2M deals/arm, seeded: 1-deck 4.8525% vs 2-deck 4.7885%, bands excluding a with-replacement sampler) re-run green this session. Loop suite BJ-07 cases prove the in-app arc: toggle blanks counter + 13 cells, retitles to "· 2-deck shoe", starts a run with `deckCount: 2` over the same visible cards (pool 101 = 104 − 3). `deckCount` REQUIRED (no default) on `BlackjackConditionedState` and both conditioning readers. |
| 6 | Hold'em is externally unchanged (D-08): goldens + frozen v1 suites byte-untouched; the CR-02 HoldemGame guard is the sanctioned additive bugfix exception | ✓ VERIFIED | `git diff --stat 7b9ca13..HEAD` over `streamingParity.golden.test.ts`, `deckParity.golden.test.ts`, `simulationApi.test.ts`, `App.test.tsx`, `App.acceptance.test.tsx`, `App.phase3.acceptance.test.tsx`, `App.modeErrorBanner.test.tsx`, `App.modeSwitchRace.test.tsx`, `streamingRunner.ts`, `protocol.ts`, `gameStore.ts`, `oddsStore.ts`, `uiStore.ts`, `pickerStore.ts`, `conditioning.ts`, `equity.ts`, `evaluator.ts`, `shoe.ts` → **all EMPTY**. Sanctioned touches verified in-diff: `simulationApi.ts` (+12 lines, WR-02 validation only, `?? 1` default preserved), `simulation.worker.ts` (namespaced expose), `simulationService.ts` (transport refactor, public surface unchanged), `App.tsx` (D-07 extraction), `AnimatedCard.tsx` (one mode-select selector), `equity.property.test.ts` (timeout only). CR-02 commit `09563b8` is 233 insertions / **0 deletions**; the HoldemGame diff is a 9-line additive `dealNonce` guard inside `onProgress`. All 8 frozen suites green in the full run. |
| 7 | No regression: full suite green, tsc/eslint/build clean | ✓ VERIFIED | Re-run this session: `npx vitest run` → **52 files / 697 tests, 697 passed, 0 skipped** (13.0s). `npx tsc --noEmit` → clean. `npx eslint . --max-warnings 0` → clean. `npm run build` → exit 0 (pre-existing >500 kB chunk-size warning only). |
| 8 | Trap ledger reconciled: WR-02 closed, WR-03 respected, 05-WR-03 closed, pickerStore untouched | ✓ VERIFIED | **04-WR-02 CLOSED:** `deckCount must be 1 or 2` value-based rejection present in BOTH `simulationApi.ts:47-52` (absent-means-1 preserved) and `blackjackSimulationApi.ts:41-45` (REQUIRED field), before any arithmetic; `deckCountValidation.test.ts` green. **04-WR-03 RESPECTED:** `git grep deckCount` over `conditioning.ts`/`gameStore.ts`/`HoldemGame.tsx` shows only conditioning's `= 1` default — nothing passes 2 into the Hold'em trial path; 06-03's poker deckCount=2 acceptance asserts at the validation boundary only. **05-WR-03 CLOSED:** `src/ui/HoldemGame.tsx` exists (game root with odds effect + WR-01/WR-02 effects); `App.tsx` is the slim two-fork shell (`mode === 'holdem' && <HoldemGame />` / `mode === 'blackjack' && <BlackjackGame />`, zero game state). **04-WR-01 UNTOUCHED:** `git diff --stat 7b9ca13..HEAD -- src/state/pickerStore.ts` → EMPTY (correctly deferred to Phase 8). |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/engine/blackjackHandValue.ts` | Rules engine: totals, naturals, S17 playout, comparison | ✓ VERIFIED | Soft-ace demotion loop (`while (total > 21 && softAces > 0)`), 2-card natural guard, `DEALER_STANDS_ON = 17` no-soft-branch, dealer-natural priority in `compareToDealer`. 30 exact-value vectors green. |
| `src/engine/blackjackConditioning.ts` | Dual-exclusion-set sole readers + naturals + duplicate check | ✓ VERIFIED | `deriveBlackjackConditionedState` (hole in pool while hidden, `knownDealerHole` + pool exclusion once revealed), `liveShoeLedger` (hole ALWAYS spent, structurally no `revealedHole` param), `hasPhysicalDuplicate` (WR-01, count-aware via `cardCounts`), `resolveNaturals` (D-03a all four paths). |
| `src/engine/blackjackEquity.ts` | Trial loop servicing all 4 stats, 12-card budget | ✓ VERIFIED | One `drawUnknown()` per trial, disjoint cursor prefixes, `knownDealerHole` short-circuit (CR-01), playout delegated to `playDealerHand`, own `bustIfHitCount` tally. Property tests + reconciliation green. |
| `src/worker/blackjackSimulationApi.ts` + `simulation.worker.ts` | Streaming config on shared runner, namespaced expose | ✓ VERIFIED | `createStreamingRunner` config (not a fork), WR-02 deckCount validation + budget check + count-aware overlap check at the validate hook; `Comlink.expose({ poker, blackjack })` with type-level `ProxyMarked`. |
| `src/state/workerClient.ts` | Lazy cached worker singleton + crash recovery | ✓ VERIFIED | Zero workers at import, synchronous check-and-assign; WR-02 fix `onHardFailure` nulls the handle (identity-guarded against zombie events), terminates, fans out — next call constructs a fresh worker. |
| `src/state/blackjackStore.ts` + `blackjackOddsStore.ts` | Round lifecycle + odds cache, no Hold'em sharing | ✓ VERIFIED | deal/hit/stand/revealHole/setDeckCount with balanced gate accounting; A3 toggle matrix + WR-01 store-boundary refusal; `blackjackKnowledgeKey` = `${playerHandLength}|${revealedHole}`; D-10 no-sharing guard-pinned. |
| `src/ui/BlackjackGame.tsx` | Game root: gated odds effect, error banner, idle block | ✓ VERIFIED | 5-gate effect with single cancellation call site (teardown), CR-02 generation guard (`roundNonce` + `deckCount`) before applySnapshot/cacheIfSettled, restore ack, A14 error banner, A10 idle block. |
| `src/ui/BlackjackTable.tsx` + areas + banner | Felt with CR-02-safe gate release, hole FlipCard, banner | ✓ VERIFIED | prevRef release over `{roundNonce, playerHandLength, roundPhase, revealedHole}`; hidden-hole DOM-absence guard; 8-path locked-copy banner. 28 table tests green. |
| `src/ui/BlackjackControls.tsx` | Deal/Hit/Stand + deck toggle with A3 duplicate guard | ✓ VERIFIED | Count-aware `hasPhysicalDuplicate` guard (WR-01 fix — physical set incl. hidden hole) disabling the "1 deck" segment; disabled matrix per D-14. |
| `src/ui/BlackjackOddsPanel.tsx` + `BustEvDisplay` + `DealerDistributionDisplay` + `formatEv` | Odds cluster: 13 cells + counter, EV tiles, 7-bucket table | ✓ VERIFIED | aria-busy pending masking of all 13 cells + counter; IN-01 fix confirmed (per-field selectors: 4 + 3); label-driven 7 rows; A3 `displayedDeckCount` subtitle. |
| `src/ui/HoldemGame.tsx` + slim `src/App.tsx` | D-07 extraction (05-WR-03 closure) | ✓ VERIFIED | Extracted game root with `dealNonce` CR-02 guard; App is MotionConfig + h1 + two mode forks only. |
| `src/App.blackjackLoop.test.tsx` | End-to-end BJ-02..BJ-07 acceptance over the real tree | ✓ VERIFIED | Named describes per requirement; re-run green this session. |
| `src/ui/BlackjackScene.tsx` (Phase 5 placeholder) | DELETED, guards retargeted | ✓ VERIFIED | Absent from `src/ui/`; `D` in phase diff; guard assertions retargeted in `App.modeShell.guard.test.ts` (66 tests green). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `BlackjackGame` odds effect | worker `blackjack` namespace | `startBlackjackSimulation` → `getApi().blackjack.runSimulation` | ✓ WIRED | Conditioned state from the sole D-02 reader; streamed snapshots → `applySnapshot`/`cacheIfSettled` behind ignore-flag + CR-02 generation guard. |
| `blackjackStore` actions | animation gate | `useUiStore.getState().beginAnimation()` | ✓ WIRED | Balanced accounting: deal unconditional, hit/stand/reveal guarded, setDeckCount never arms; `BlackjackTable` prevRef releases exactly one per commit. |
| `revealHole()` | trial loop conditioning | `knownDealerHole` through derive → validate → `runBlackjackTrials` | ✓ WIRED | CR-01 chain verified at all three layers (derive sets it, validate budgets it, loop consumes it). |
| `setDeckCount` | odds re-run | `deckCount` in the effect dependency array + `clearCache()` | ✓ WIRED | Mid-turn toggle triggers a fresh `deckCount: 2` run over the same visible cards (loop-suite-asserted); CR-02 guard blocks late 1-deck snapshots. |
| Odds stores | display cells | per-field Zustand selectors → 13 testid'd cells + counter | ✓ WIRED | All 13 value cells + trial counter driven by `useBlackjackOddsStore`; pending state masks all to em dash (TBL-04). |
| Worker crash | recovery | `error`/`messageerror` → `onHardFailure` → handle invalidation → fresh worker on next start | ✓ WIRED | WR-02 fix; crash-then-restart streaming test green. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `BustEvDisplay` | `trialsCompleted`, `bustIfHitCount`, `standOutcomes`, `hitOutcomes` | `blackjackOddsStore.applySnapshot` ← worker streamed snapshots ← `runBlackjackTrials` real Monte Carlo tallies | Yes | ✓ FLOWING |
| `DealerDistributionDisplay` | `dealerOutcomeCounts`, `displayedDeckCount` | Same snapshot pipeline; subtitle from A3 snapshot field set by store actions | Yes | ✓ FLOWING |
| `BlackjackTable`/areas | `round`, `playerHand`, `dealerPlayoutCards`, `revealedHole` | `blackjackStore` real shoe draws (`drawN` over `shoeWithout`/`liveShoeLedger`) | Yes | ✓ FLOWING |
| `BlackjackOutcomeBanner` | `outcome`, `playerNaturalWin`, totals | Store resolution paths (naturals/bust/stand playout) | Yes | ✓ FLOWING |

No hardcoded-empty props, no static returns, no disconnected fetches found in any Phase 6 component.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full regression | `npx vitest run` | 52 files / 697 tests, 0 failures, 0 skipped | ✓ PASS |
| BJ-02..07 loop + CR-02 poison (both games) + D-12 anchor + WR-02 validation | `npx vitest run src/App.blackjackLoop.test.tsx src/App.holdemCachePoison.test.tsx src/engine/blackjackNaturalFrequency.test.ts src/worker/deckCountValidation.test.ts` | 4 files / 35 tests, all pass (incl. the 2M-deal-per-arm seeded anchor: 1-deck > 2-deck natural frequency inside bands) | ✓ PASS |
| Type check | `npx tsc --noEmit` | Exit 0 | ✓ PASS |
| Lint | `npx eslint . --max-warnings 0` | Exit 0, zero warnings | ✓ PASS |
| Production build | `npm run build` | Exit 0 (pre-existing chunk-size warning only) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes exist or are declared in this project — probe execution N/A. The test suite + build gates above are the runnable verification surface.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| BJ-02 | 06-03, 06-04, 06-05, 06-07 | Deal a round with live streamed odds + visible trial counter | ✓ SATISFIED | Truth 1; loop suite BJ-02 describes; `blackjack-trial-counter` wired to streamed `trialsCompleted`. |
| BJ-03 | 06-01, 06-03, 06-06 | Bust-if-hit % + dealer 7-bucket distribution conditioned on upcard | ✓ SATISFIED | Truths 1, 4; `runBlackjackTrials` tallies; `DealerDistributionDisplay` 7 fixed-order rows; loop suite BJ-03 exact-value case. |
| BJ-04 | 06-01, 06-03, 06-06 | Win/push/lose + per-unit EV Stand vs Hit (S17, 3:2, no bankroll) | ✓ SATISFIED | Truth 2; `formatEv` signed per-unit; conventions hard-coded in engine; no settings UI exists. |
| BJ-05 | 06-04, 06-05, 06-07 | Hit/Stand with recompute; dealer playout; round outcome | ✓ SATISFIED | Truth 3; store actions + banner; loop suite BJ-05 fresh-run + playout + disabled-matrix cases. |
| BJ-06 | 06-04, 06-05, 06-07 | Early one-way hole reveal; odds recondition on the known card | ✓ SATISFIED | Truth 4 (CR-01 fix makes the reconditioning real, not just pool-shrink); one-way matrix tested. |
| BJ-07 | 06-01, 06-04, 06-07 | Deck count visibly changes blackjack odds, verifiable in-app | ✓ SATISFIED | Truth 5; D-12 anchor (4.85% vs 4.79%, seeded, bands) + in-app toggle arc loop-suite-asserted. |

No orphaned requirements: REQUIREMENTS.md maps exactly BJ-02..BJ-07 to Phase 6; all six are claimed across plan frontmatters and verified above. (Note: REQUIREMENTS.md traceability checkboxes still read "Pending" — a bookkeeping update owned by the milestone workflow, not a code gap.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | Zero TODO/FIXME/XXX/HACK/TBD/placeholder markers, zero empty-implementation returns, zero hardcoded-empty display props across all 53 phase-touched source files. The deleted `BlackjackScene.tsx` placeholder was fully retired with guards retargeted. |

### Code-Review Fix Verification (06-REVIEW.md)

| Finding | Fix Commit | Verified in Source | Tests |
|---------|-----------|--------------------|-------|
| CR-01 (post-reveal odds ignored revealed hole) | `4c16c78` | `knownDealerHole` threaded derive → validate → trial loop (exact lines cited in Truth 4) | Known-hole script, Natural-bucket-0, pre/post-reveal direction pins — green |
| CR-02 (settled-cache generation poisoning) | `09563b8` | Generation guard in BOTH roots: `bj.roundNonce !== roundNonce \|\| bj.deckCount !== deckCount` (`BlackjackGame.tsx:132`), `dealNonce` (`HoldemGame.tsx:116`); commit is 233 insertions / 0 deletions | `App.holdemCachePoison.test.tsx` + blackjack late-snapshot + mid-turn toggle variants — green |
| WR-01 (2→1 toggle ignored hidden hole) | `07d4624` | `hasPhysicalDuplicate` sole reader; store-boundary refusal (`blackjackStore.ts:195`) + control disable (`BlackjackControls.tsx:48`); documented one-bit leak | Hidden/revealed-duplicate refusal + clean-2→1-allowed — green |
| WR-02 (dead worker proxy forever) | `d6c2b72` | `onHardFailure` nulls handle (identity-guarded), terminates, fans out (`workerClient.ts:66-72`) | Crash-then-restart streaming + stale-event case — green |
| IN-01 (selector-less subscriptions) | `efb9699` | Per-field selectors: 4 in `BustEvDisplay`, 3 in `DealerDistributionDisplay` | Behavior unchanged, suite green |

### Known Limitations (recorded, not failures)

1. **Frame-dependent live-browser steps rest on automated evidence.** The agent browser environment suspends requestAnimationFrame (`visibilityState: "hidden"`, 0 rAF ticks), so Motion choreography cannot complete live. NOT live-verified: odds-convergence display after gate release, hit/stand dealer-playout animation pacing (400ms/200ms), the hole-reveal flip animation, and the full BJ-07 blank→climb→different-numbers visual arc. Each has complete jsdom/DOM + property-test coverage, and 06-08's live-browser addendum verified the frame-independent halves in real Chromium (locked idle copy + controls matrix, A3 idle-snapshot rule, TBL-04 synchronous masking, FLAG-2 mid-flight masking, mode-isolation round trip with state retention, clean hard reload).
2. **jsdom forces reduced motion** — all 697 tests run with durations 0; the suites prove functionality is not gated behind an animation playing, but real-motion feel remains a human check.
3. **Recommended (non-blocking) human walk:** 5 minutes with `npm run dev` — the D-12 deck-toggle findability moment (SC5), mid-flight mode switches (steps 8-9 of the 06-08 checkpoint), and the real DevTools console under rapid toggling.

### Gaps Summary

None. All 5 ROADMAP success criteria hold in the codebase as it exists at HEAD; all six requirements (BJ-02..BJ-07) are satisfiable by a user in the shipped app; all 5 code-review findings are fixed in source with green RED-first tests; D-08 held (frozen Hold'em surface byte-untouched, the CR-02 Hold'em guard strictly additive); the Phase 4/5 trap ledger is fully reconciled; and the full regression bar (697 tests / tsc / eslint / build) is green as independently re-run in this session.

---

_Verified: 2026-08-25T00:10:00Z_
_Verifier: Claude (gsd-verifier)_

> **Correction (2026-08-25, v2.0 milestone audit W-01):** this report cites `npx tsc --noEmit` as its typecheck evidence. That gate is **vacuous in this repo** — the root `tsconfig.json` is solution-style (`files: []` + `references`), so it type-checks nothing and passes against deliberately broken code. The type-safety evidence recorded here is therefore void as written. Re-run at the time of the audit, `npx tsc -b` (the real gate) exits 0 across the whole project, so the CONCLUSION holds — but the evidence cited for it did not support it.
