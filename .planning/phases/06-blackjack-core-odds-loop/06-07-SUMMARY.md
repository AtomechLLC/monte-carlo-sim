---
phase: 06-blackjack-core-odds-loop
plan: 07
subsystem: ui
tags: [typescript, react, vitest, blackjack, odds-effect, guard-tests]
status: complete

# Dependency graph
requires:
  - phase: 06-blackjack-core-odds-loop
    plan: 03
    provides: "startBlackjackSimulation/cancelBlackjackSimulation over the lazy namespaced worker transport (side-effect-free on import — the wave-4 second-import-path defence this plan relies on)"
  - phase: 06-blackjack-core-odds-loop
    plan: 04
    provides: "useBlackjackStore round lifecycle (A3 toggle semantics, unconditional deal-time odds reset), useBlackjackOddsStore (blackjackKnowledgeKey cache, displayedDeckCount), blackjackRestorePending/ackBlackjackRestore"
  - phase: 06-blackjack-core-odds-loop
    plan: 05
    provides: "BlackjackTable felt composition (CR-02-safe release), dealer/player areas, outcome banner, ALL Phase 6 CSS incl. the control/deck-toggle rules this plan's markup binds to"
  - phase: 06-blackjack-core-odds-loop
    plan: 06
    provides: "BlackjackOddsPanel cluster (13 stat cells + trial counter, formatEv, dealer table with the A3 displayedDeckCount subtitle)"
provides:
  - src/ui/BlackjackGame.tsx — the blackjack game root: gated odds effect (mode -> animation -> roundPhase -> cache -> run), restore ack, error banner, A10 idle block, control bar, scene row
  - src/ui/BlackjackControls.tsx — Deal / Hit / Stand + the blackjack-local deck-count segmented toggle with the count-aware A3 duplicate guard
  - src/App.tsx — slimmed to exactly two mode guards; the 06-02 blackjack shim and its GameModeSwitcher/BlackjackScene imports removed
  - "src/ui/BlackjackScene.tsx DELETED — both retained testids relocated (blackjack-scene -> BlackjackTable felt root, blackjack-empty-state -> BlackjackGame's page-level idle block)"
  - src/test/blackjackTestids.ts — BLACKJACK_ONLY_TESTIDS, the mirror-image DOM-absence sweep list
  - src/App.blackjackLoop.test.tsx — end-to-end BJ-02..BJ-07 acceptance over the real component tree
  - "Guard retargets per the STANDING RULE: D-05 store sweep -> real blackjack tree, D-03 button ban -> D-13 control census, Phase 6 locked-copy pins, new D-10 no-sharing sweep, BlackjackGame cancellation/gate/tail/dealerHole pins"
affects: [06-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Blackjack odds effect re-implements (never inherits) the Hold'em gate discipline: mode gate first with teardown-as-cancellation, CR-01 dual animation check (subscribed dep + live read), roundPhase gate (resolved/idle runs zero trials), cache gate with closure-captured keys, ignore-flag live run"
    - "Mirror-image testid sweeps: HOLDEM_ONLY_TESTIDS absent in blackjack mode, BLACKJACK_ONLY_TESTIDS absent in holdem mode, both present-then-absent (non-vacuous)"
    - "Deterministic click-driven deals in App-level suites via the drawN vi.fn seam (blackjackStore.test.ts precedent) — kills the ~4.8% random-natural flake class"

key-files:
  created:
    - src/ui/BlackjackGame.tsx
    - src/ui/BlackjackControls.tsx
    - src/test/blackjackTestids.ts
    - src/App.blackjackLoop.test.tsx
  modified:
    - src/App.tsx
    - src/App.modeShell.guard.test.ts
    - src/App.modeSwitch.test.tsx
    - src/App.modeIsolation.test.tsx
  deleted:
    - src/ui/BlackjackScene.tsx

key-decisions:
  - "playerHand added to the odds-effect dependency array beside the plan's pinned entries (tail unchanged): the derive input is the closure array itself, satisfying react-hooks/exhaustive-deps with zero warnings and zero live reads"
  - "The idle block emits the shipped .empty-hand-state class (A10's 'same document slot as Hold'em's empty-hand-state'), matching 06-05's retired-CSS comment naming that slot as the reuse target"
  - "The retired uiStore prohibition retargets at BlackjackControls only: BlackjackGame/BlackjackTable legitimately read the shared animation gate (TBL-04/D-11), while controls arm nothing (store actions own arming)"
  - "Deal-by-accessible-name assertions retargeted (D-04 -> D-13/BJ-05): blackjack now owns a Deal-named button, so D-04 is expressed as 'every Deal-named button carries the blackjack testid' (the Hold'em Deal is the untestid'd one)"

patterns-established:
  - "Guard supersession citations: every retargeted assertion names BOTH the superseded and superseding decision tags (D-03 -> D-13, D-04 -> D-13/BJ-05, D-01/D-03 -> D-13/D-14)"

requirements-completed: [BJ-02, BJ-05, BJ-06, BJ-07]

# Metrics
duration: 26min
completed: 2026-08-24
---

# Phase 6 Plan 07: BlackjackGame Root, Placeholder Retirement & BJ-02..07 Loop Suite Summary

**The blackjack vertical slice is wired end to end: a gated odds effect whose teardown is the only cancellation path and whose conditioning goes through the sole D-02 reader, Deal/Hit/Stand plus the A3 deck toggle with its count-aware duplicate guard, the Phase 5 placeholder retired with every superseded assertion retargeted (never deleted), a mirror-image 37-entry testid sweep, and a 15-test end-to-end loop suite proving BJ-02 through BJ-07 over the real component tree.**

## Performance

- **Duration:** ~26 min (22:38:55Z base-commit verification + npm ci -> 23:04:44Z final gate)
- **Tasks:** 4 (Task 2 staged only; committed atomically with Task 3 per the plan's locked commit discipline)
- **Files:** 4 created, 4 modified, 1 deleted — `git diff --name-only ea6779b..HEAD` lists exactly the plan's files

## Final Odds-Effect Dependency Array (recorded per the plan's output spec)

```
[round, playerHand, playerHandLength, revealedHole, roundPhase, deckCount, roundNonce, pendingAnimationCount, mode]
```

- Ends exactly `pendingAnimationCount, mode]` (guard-pinned).
- `playerHand` sits beside the plan's pinned entries (see Deviations #1) so the derive input is the closure array itself — never a live `getState()` read.
- `roundNonce` retained per the plan's audit note: a re-deal into an identical-shaped state is otherwise indistinguishable; the nonce makes each deal a distinct generation with no reliance on reference identity (comment carried into the source).

## Gate Order (implemented and pinned)

1. `if (mode !== 'blackjack') return;` — FIRST; the effect teardown IS the mode-switch cancellation, single `cancelBlackjackSimulation(` call site (guard-counted).
2. `if (pendingAnimationCount > 0 || useUiStore.getState().pendingAnimationCount > 0) return;` — CR-01 dual check re-implemented (Pitfall G comment records that nothing here is inherited).
3. `if (roundPhase !== 'player-turn' || round === null) return;` — a natural-resolved deal runs zero trials (loop-suite-asserted).
4. Settled-cache lookup on the closure-captured `(playerHandLength, revealedHole)`; hit applies + microtask error-clear + returns with NO cleanup.
5. Live run: `reset()` -> `deriveBlackjackConditionedState(round, playerHand, revealedHole, deckCount)` -> `startBlackjackSimulation`, ignore-flag cleanup calling the single cancel site.

`BlackjackGame.tsx` contains zero occurrences of the raw hole-card field name (guard-pinned, T-06-35) — the sole reader boundary is observed end to end in the loop suite (pre-reveal run pool 49 cards, post-reveal 48).

## BLACKJACK_ONLY_TESTIDS (full list, 37 entries)

`blackjack-scene`, `blackjack-empty-state`, `blackjack-deal-button`, `blackjack-hit-button`, `blackjack-stand-button`, `blackjack-deck-toggle`, `blackjack-deck-toggle-1`, `blackjack-deck-toggle-2`, `blackjack-dealer-area`, `blackjack-dealer-cards`, `blackjack-hole-reveal`, `blackjack-dealer-label`, `blackjack-dealer-total`, `blackjack-player-area`, `blackjack-player-cards`, `blackjack-player-label`, `blackjack-player-total`, `blackjack-deck-origin`, `blackjack-outcome-banner`, `blackjack-odds-panel`, `blackjack-trial-counter`, `blackjack-bust-pct`, `blackjack-stand-win-pct`, `blackjack-stand-push-pct`, `blackjack-stand-lose-pct`, `blackjack-ev-stand`, `blackjack-ev-hit`, `blackjack-dealer-table`, `blackjack-dealer-pct-17`, `blackjack-dealer-pct-18`, `blackjack-dealer-pct-19`, `blackjack-dealer-pct-20`, `blackjack-dealer-pct-21`, `blackjack-dealer-pct-natural`, `blackjack-dealer-pct-bust`, `blackjack-simulation-error`, `blackjack-simulation-error-detail`

Every entry is swept present-then-absent in `App.modeIsolation.test.tsx` (seeded player-turn/resolved/revealed/error states establish each presence precondition, so no absence check is vacuous).

## Phase 5 Assertions Retargeted (before -> after, both tags cited)

| # | File | Before | After | Tags |
|---|------|--------|-------|------|
| 1 | guard | `resetAnimations` sweep entry `ui/BlackjackScene.tsx` | Five successors: `ui/BlackjackGame.tsx`, `ui/BlackjackTable.tsx`, `ui/BlackjackControls.tsx`, `state/blackjackStore.ts`, `state/blackjackOddsStore.ts` | D-07/D-08 -> +D-13 |
| 2 | guard | `deckCount` sweep entry `ui/BlackjackScene.tsx` | `ui/HoldemGame.tsx` (blackjack successors legitimately own deckCount per D-10/BJ-07; the Hold'em root must never grow one before Phase 7) | D-10/WR-02/WR-03 -> +D-13 |
| 3 | guard | `BlackjackScene.tsx — honest, control-free placeholder`: `<button`/`gameStore`/`oddsStore`/`pickerStore`/`uiStore` all forbidden | D-05 half survives at the 3 real UI files (`gameStore`/`oddsStore`/`pickerStore`); `uiStore` retargets at `BlackjackControls.tsx` only (Game/Table read the shared gate by design); `<button` ban retired and retargeted behaviourally (see #6) | D-03/D-05 -> D-13 |
| 4 | guard | Locked-copy pin of the placeholder heading/body ("The Blackjack table deals next…") | Phase 6 pins: A10 idle heading + body, A14 error copy (BlackjackGame), five outcome-banner headings (BlackjackOutcomeBanner), `hit once, then stand` (BustEvDisplay), `Dealer's final hand` (DealerDistributionDisplay) | D-01/D-03 -> D-13/D-14 |
| 5 | modeSwitch | `BLACKJACK_HEADING`/`BLACKJACK_BODY` placeholder-copy constants + copy test | `BLACKJACK_IDLE_HEADING`/`BLACKJACK_IDLE_BODY` (A10 locked copy), empty-state deliberately no longer queried as a scene child (page-level placement) | D-03 -> D-13/A10 |
| 6 | modeSwitch | `the blackjack-scene subtree contains zero <button> elements` | Scene contains exactly ONE button and it is `blackjack-hole-reveal`; Deal/Hit/Stand/deck-toggle asserted present in the control bar | D-03 -> D-13 |
| 7 | modeSwitch | Deal button (by accessible name) absent in blackjack mode | Every Deal-named button carries `data-testid="blackjack-deal-button"` (exactly one) — the untestid'd Hold'em Deal is provably unmounted | D-04 -> D-13/BJ-05 |
| 8 | modeIsolation | Deal button present (holdem) / absent (blackjack) | Present AND untestid'd in holdem; in blackjack every Deal-named button is blackjack's own | D-04 -> D-13/BJ-05 |

No describe block was deleted wholesale; `git diff` on the guard shows each transformed in place.

## Guard Negative Controls (both demonstrated red, then reverted)

1. **`street` token appended to `state/blackjackOddsStore.ts`** -> guard red: `1 failed | 65 passed` (the D-10 no-sharing sweep). Reverted via `git checkout -- state/blackjackOddsStore.ts`; grep confirms 0 occurrences.
2. **Second `cancelBlackjackSimulation(` call site appended to `ui/BlackjackGame.tsx`** -> guard red: `1 failed | 65 passed` (the single-cancellation-owner count). Reverted from the index; grep confirms the marker gone, guard green again (66/66).

## BJ-02..BJ-07 Loop Suite Results (App.blackjackLoop.test.tsx — 15 tests, all green)

- **BJ-02 (3):** scripted deal renders 2 player cards + face-up upcard; hole identity absent from the DOM with the hidden-state reveal label; exactly one `startBlackjackSimulation` call; counter `1,000` + non-dash bust and all seven dealer cells; conditioned state proves D-02 (remainingDeck 49 = 52 − 3 visible, hole retained in pool).
- **BJ-03 (1):** all 11 percentage cells exact for the injected tally (17.0/15.0/13.0/11.0/9.0/5.0/30.0, bust 25.0, stand 42.0/9.0/49.0).
- **BJ-04 (1):** `−0.07 units` / `−0.10 units` (U+2212, formatEv shape) + always-visible `hit once, then stand`.
- **BJ-05 (3):** Hit appends the third card and provably starts a FRESH run (per-call-distinct 42.0% -> 42.1%); Stand against a 2-card 17 reveals the hole (`Dealer's hole card: Seven of Clubs`, total badge `17`), disables both actions, shows `You win` / `Your 20 beats the dealer's 17.`, starts no new run; full idle/player-turn/resolved disabled matrix incl. A2 (Deal never disabled, mid-resolved re-deal dismisses the banner).
- **BJ-06 (1):** early reveal flips the label, shows total `13`, starts a new run whose pool excludes the now-known hole (49 -> 48), disables the one-way reveal button, and lands fresh numbers.
- **BJ-07 (4):** player-turn toggle (against a hanging run) flips `aria-pressed`, blanks counter to `0` and all 13 cells to `—`, retitles to `· 2-deck shoe`, and starts a run with `deckCount: 2` over the same visible cards (pool 101 = 104 − 3); resolved toggle changes only the pending selection — no new call, subtitle still `· 1-deck shoe`, and all 14 captured texts (counter + 13 cells) byte-identical; A3 duplicate guard disables only the `1 deck` segment with the locked title; active-segment click is a total no-op.
- **Mode isolation (1):** the Hold'em round trip cancels via the effect teardown, leaves roundNonce and the felt intact, and serves the cache (call count 1, 42.0% unchanged — provably not a fresh run).
- **Natural path (1):** with a settled 1,000-trial display seeded first, a scripted natural deal calls `startBlackjackSimulation` ZERO times, shows `Blackjack — you win` / `Your natural pays 3:2.`, reveals the hole (total `15`), and reads counter `0` + thirteen em dashes with the gate drained — deal()'s unconditional reset observed end to end (A16, D-03a).

## Full-Suite Count Delta

- **Baseline (wave-3, ea6779b):** 50 files / 595 tests.
- **Final:** 51 files / 679 tests, 0 failures, 0 skipped — **+1 file / +84 tests** (guard 40->66, modeSwitch 31->37, modeIsolation 33->70, loop suite +15; all changes additive or retargeted-in-place, nothing weakened or deleted).
- `npx tsc --noEmit` clean; `npx eslint .` clean (zero warnings); `npm run build` exit 0.

## Guard-At-Every-Commit Confirmation

`npx vitest run src/App.modeShell.guard.test.ts src/App.modeSwitch.test.tsx` executed at a detached checkout of EVERY commit in the plan range:

| Commit | Result |
|--------|--------|
| `25fc388` (Task 1: controls) | 2 files / 71 tests green (pre-amendment suites — the fork had not landed) |
| `9a3d5b2` (Tasks 2+3: fork + deletion + retargets, ONE commit) | 2 files / 103 tests green |
| `732829a` (Task 4: loop suite) | 2 files / 103 tests green |

The fork/deletion and its guard amendments share commit `9a3d5b2` precisely so no red-suite commit exists.

## Task Commits

1. **Task 1: BlackjackControls — Deal / Hit / Stand and the deck-count toggle** — `25fc388` (feat)
2. **Tasks 2+3: BlackjackGame root, App fork, placeholder retirement, retargeted guards + mirror sweep** — `9a3d5b2` (feat; single atomic commit per the plan's locked discipline)
3. **Task 4: end-to-end BJ-02..BJ-07 loop acceptance** — `732829a` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `playerHand` added to the odds-effect dependency array**
- **Found during:** Task 2 (writing the effect against the locked eslint config)
- **Issue:** the plan's array (`[round, playerHandLength, …]`) omits `playerHand`, but the effect body must pass the actual card array to `deriveBlackjackConditionedState` — referencing it without listing it violates `react-hooks/exhaustive-deps`, and reading it via `getState()` instead would break the plan's own closure-capture discipline (a mixed-generation derive input in the commit-to-effect window).
- **Fix:** subscribe `playerHand` and list it beside the pinned entries; identity changes exactly when length or nonce changes, so re-run semantics are identical and the guard-pinned tail `pendingAnimationCount, mode]` is untouched. Recorded in a source comment at the array.
- **Files modified:** `src/ui/BlackjackGame.tsx`
- **Commit:** `9a3d5b2`

**2. [Rule 3 - Blocking] BlackjackControls doc comment reworded to avoid the literal gate-store token**
- **Found during:** Task 3 (pre-flight grep before writing the retargeted guard sweep)
- **Issue:** Task 1's committed comment said "no uiStore" in prose; the retargeted D-05 guard checks the RAW source of `BlackjackControls.tsx` for that token (absence checks are never comment-stripped, per the guard's own documented discipline) — the exact wording-tension class 06-04 recorded and resolved the same way.
- **Fix:** reworded to "no animation-gate store"; intent fully preserved, guard green.
- **Files modified:** `src/ui/BlackjackControls.tsx`
- **Commit:** `9a3d5b2` (the reword landed with the guard that made it necessary)

**3. [Rule 1 - Bug] Deterministic deals in the loop suite via the established drawN seam**
- **Found during:** Task 4 (designing the click-driven BJ-02 path)
- **Issue:** the plan says to drive the random path through real clicks "where the exact cards do not matter" — but a genuinely random Deal click lands a natural ~4.8% of the time, silently flipping "starts one run" into "starts zero runs" (and a random hit can bust, flipping BJ-05's fresh-run assertion). That is a latent flake across every click-driven test.
- **Fix:** the suite mocks `./engine/rng` with `drawN: vi.fn(actual.drawN)` and scripts exact deals via `mockReturnValueOnce` — the codebase's own sanctioned deterministic seam (`blackjackStore.test.ts` uses it verbatim). No engine file was touched.
- **Files modified:** `src/App.blackjackLoop.test.tsx`
- **Commit:** `732829a`

**4. [Rule 2 - Missing critical amendment] Deal-by-accessible-name assertions retargeted in both pre-existing App suites**
- **Found during:** Task 3 (the suites query `role: button, name: /^deal$/i` and assert absence in blackjack mode — blackjack's own Deal button now matches, turning both tests red)
- **Fix:** retargeted (rows 7-8 of the table above) with both decision tags cited: the Hold'em Deal is identified by its LACK of a testid, so "every Deal-named button carries the blackjack testid" expresses exactly what D-04 pinned. No assertion deleted.
- **Files modified:** `src/App.modeSwitch.test.tsx`, `src/App.modeIsolation.test.tsx`
- **Commit:** `9a3d5b2`

## Scope & Frozen-File Confirmation

- `git diff --name-only ea6779b..HEAD` lists exactly the plan's nine files: nothing under `src/state/`, `src/engine/`, `src/worker/`; no CSS file; none of 06-05/06-06's components. The only deletion in any commit is the plan-mandated `src/ui/BlackjackScene.tsx`.
- Both negative-control edits to out-of-plan files (`blackjackOddsStore.ts`, staged `BlackjackGame.tsx`) were transient and reverted in-session, as the plan instructs.
- No dev server was started; jsdom coverage proves wiring and gate accounting only — plan 06-08's browser checkpoint owns real-motion verification.

## Issues Encountered

None beyond the recorded deviations. No auth gates; zero package installs (T-06-SC — `npm ci` from the committed lockfile only).

## User Setup Required

None.

## Next Phase Readiness

- Plan 06-08's checkpoint can read this suite's result as the automated half of the phase acceptance; every ROADMAP Phase 6 success criterion 1-5 has a named describe.
- The guard now enforces D-10's no-sharing rule and the blackjack gate order at source level; the mirror-image sweep closes the DOM-absence contract in both directions.

## Known Stubs

None — every control, effect and display is wired to real stores/services; no placeholder values, no TODO/FIXME markers.

## Threat Flags

None — no new network, auth, file-access or schema surface beyond the plan's threat model. T-06-35/36/37/38/39/40/41 mitigations all landed as source pins or loop-suite assertions recorded above; T-06-SC honoured (zero installs).

## Self-Check: PASSED

- All 4 created files, 4 modified files and this SUMMARY verified present on disk; `src/ui/BlackjackScene.tsx` verified absent.
- All 3 task commits (`25fc388`, `9a3d5b2`, `732829a`) verified in `git log` atop base `ea6779b`.
- Full suite 51 files / 679 tests green, 0 skipped (baseline 50 / 595); `npx tsc --noEmit` clean; `npx eslint .` clean (zero warnings); `npm run build` exit 0.
- Guard + modeSwitch verified green at a detached checkout of EVERY commit in the range; working tree clean on return to the branch.
