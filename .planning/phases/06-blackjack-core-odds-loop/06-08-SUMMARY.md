---
phase: 06-blackjack-core-odds-loop
plan: 08
subsystem: verification
tags: [regression, coverage-audit, checkpoint, vitest, eslint, vite-build]
status: complete

# Dependency graph
requires:
  - phase: 06-blackjack-core-odds-loop
    plan: 01-07
    provides: "The complete Blackjack vertical slice (engine, worker transport, stores, felt, odds cluster, game root) whose regression record, coverage reconciliation and acceptance verdict this plan produces"
provides:
  - "Phase 6 regression record: 51 files / 679 tests green, 0 skipped; lint clean; build clean"
  - "D-08 gate confirmation: both golden parity detectors + simulationApi.test.ts byte-untouched and green across the whole phase; five v1 acceptance suites unmodified"
  - "Phase 4/5 trap-ledger reconciliation: WR-02 closed, WR-03 respected, 05-REVIEW WR-03 closed, 04-REVIEW WR-01 untouched"
  - "Multi-Source Coverage Audit: every GOAL/REQ/RESEARCH/CONTEXT/UI-SPEC item COVERED and attributed"
  - "Checkpoint verdict (agent-executed, fallback evidence) with per-step live-vs-fallback attribution and named NOT VERIFIED gaps"
affects: [phase-07, phase-08]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/06-blackjack-core-odds-loop/06-08-SUMMARY.md
  modified: []

key-decisions:
  - "Checkpoint resolved agent-executed via the sanctioned fallback chain: no in-app browser tools, no Playwright (installing it would violate T-06-SC's zero-install rule), so evidence = production-preview HTTP probing + the checkpoint-mapped jsdom suites, with per-step attribution and NOT VERIFIED gaps named rather than assumed-pass (T-06-47)"
  - "Plan erratum recorded, not 'fixed': the plan's baseline hash 7d8fb13 is a Phase-1-era docs commit; the actual pre-phase baseline commit is 7b9ca13, where both wave-1 SUMMARYs measured the 37-file/388-test baseline. All diffs in this record run against 7b9ca13"
  - "Plan erratum recorded: 'the 29 new testids' — the UI-SPEC's new-testid table has 35 entries (29 is the HOLDEM_ONLY_TESTIDS count); all 35 new + 2 retained Phase 5 testids = the 37-entry BLACKJACK_ONLY_TESTIDS sweep, audited as such"

requirements-completed: [BJ-02, BJ-03, BJ-04, BJ-05, BJ-06, BJ-07]

# Metrics
duration: ~15min
completed: 2026-08-24
---

# Phase 6 Plan 08: Regression Sweep, Coverage Audit & Acceptance Checkpoint Summary

**Phase 6 gate closed: 51 files / 679 tests green (388-test baseline intact + 291 additions all accounted for), lint and build clean, both golden D-08 detectors byte-untouched through seven plans' diffs, the Phase 4/5 trap ledger fully reconciled (WR-02 closed, WR-03 respected, 05-REVIEW WR-03 closed, pickerStore untouched), every GOAL/REQ/RESEARCH/CONTEXT/UI-SPEC source item confirmed shipped — with the acceptance checkpoint resolved agent-executed on fallback evidence (no browser automation available in this environment) and its NOT VERIFIED live-browser gaps named explicitly.**

## Task 1 — Regression Sweep & D-08 Accounting

### The three gates

| Gate | Command | Result |
|---|---|---|
| Tests | `npx vitest run` | **51 test files / 679 tests, 679 passed, 0 failures, 0 skipped**, exit 0 (27.4s) |
| Lint | `npm run lint` | Exit 0, zero warnings; **zero new inline eslint-disable comments** anywhere in the phase diff (verified: `git diff 7b9ca13..HEAD -- src` added lines contain 0 `eslint-disable` occurrences) |
| Build | `npm run build` | Exit 0 (pre-existing >500 kB chunk-size warning only, unchanged from before the phase) |

### Test-count reconciliation (baseline 37 files / 388 tests at `7b9ca13`)

| Plan | Test files added | Tests added |
|---|---|---|
| 06-01 | 5 | +52 |
| 06-02 | 0 | +19 |
| 06-03 | 3 | +35 |
| 06-04 | 2 | +51 |
| 06-05 | 1 | +28 |
| 06-06 | 2 | +22 |
| 06-07 | 1 | +84 |
| **Total** | **+14 → 51** | **+291 → 679** |

37 + 14 = 51 files; 388 + 291 = 679 tests — the arithmetic closes exactly. The pre-existing 388 are intact: no pre-existing test was deleted, skipped, or relaxed (see enumeration below).

**Plan erratum (baseline hash):** the plan's `<interfaces>` block cites the baseline at commit `7d8fb13`; that hash is a Phase-1-era docs commit ("docs(01): create phase plan"). The actual pre-phase baseline commit is **`7b9ca13`** ("docs(state): begin phase 6 execution"), where both wave-1 executors independently measured 37 files / 388 tests. All range checks in this record use `7b9ca13..HEAD`.

### Enumeration of every pre-existing-test-file adjustment (T-06-48)

`git diff --name-only 7b9ca13..HEAD` over test files shows **five** modified pre-existing files — the plan's enumerated three, plus two additional entries, both mechanical:

1. **`src/state/simulationService.test.ts`** (plan 06-03, enumerated #1) — verified by full diff: exactly (a) the Comlink `wrap` mock's return shape widened to the namespaced `{ poker: { runSimulation, cancel }, blackjack: { … } }` (same spies, same three crash-routing assertions, now reached via `.poker`), and (b) a `beforeEach` comment reword from "constructed once at import time" to "constructed once on the FIRST service call (lazy, 06-03)". No assertion touched. **Mechanical.**
2. **`src/App.modeSwitch.test.tsx` + `src/App.modeIsolation.test.tsx`** (plans 06-02 + 06-07, enumerated #2) — consolidated `HOLDEM_ONLY_TESTIDS` import (sweep GREW 12→29 cases), placeholder-copy → A10 idle-copy retargets, zero-button → one-button-census retarget, Deal-by-accessible-name retargets (both decision tags cited), `./state/blackjackSimulationService` mock factory, mirror-image 37-entry blackjack sweep. Suite counts grew 20→37 and 33→70; nothing deleted. **Mechanical retargets + additions.**
3. **`src/App.modeShell.guard.test.ts`** (plans 06-02 + 06-07, enumerated #3) — D-07 retargets (three pins moved to `ui/HoldemGame.tsx`, each citing the move) + new App.tsx zero-cancellation pin; D-13 retargets (BlackjackScene entries → five successors, Phase 6 locked-copy pins, D-10 no-sharing sweep, BlackjackGame gate/tail/dealerHole pins). Guard grew 32→34→66; no describe/it/expect deleted. **Mechanical retargets per the STANDING RULE.**
4. **`src/state/gameModeStore.test.ts`** (plan 06-04 — beyond the enumerated three) — verified by `git diff --numstat`: **55 insertions, 0 deletions**. A purely additive new describe block for the symmetric `blackjackRestorePending` signal; zero pre-existing cases touched. **Mechanical (strictly additive).**
5. **`src/engine/equity.property.test.ts`** (orchestrator commit `054bd22`, post-06-07 merge — beyond the enumerated three, sanctioned) — verified by full diff: exactly one explicit `30_000` ms timeout argument plus a 3-line comment on the heavy 3000-trial × 100-run property (comfortably fast alone at ~2.4s, but can exceed vitest's 5s default under 51-file CPU contention). No assertion touched. **Mechanical (sanctioned flake-hardening).**

No adjustment anywhere in the phase relaxes an assertion, deletes a case, or adds `.skip`/`.todo` — confirmed by diff inspection and by the suite-count arithmetic above.

### Lazy-transport gate (T-06-49)

- `git grep -n 'new SimWorker()' -- src` → exactly **one** code hit: `src/state/workerClient.ts:56`, inside the `ensureWorker()` function body behind the `handle !== null` cache guard (the other two grep hits are comments). Never module scope.
- `Comlink.wrap(` appears in code exactly once: `src/state/workerClient.ts:75`, also inside `ensureWorker()`. Zero module-scope construction — the wave-4 second-import-path defence holds.

### D-08 gate (T-06-44)

- `git diff --stat 7b9ca13..HEAD -- src/worker/streamingParity.golden.test.ts src/engine/deckParity.golden.test.ts src/worker/simulationApi.test.ts` → **EMPTY**. All three suites green in the full run.
- The five v1 acceptance suites (`App.test.tsx`, `App.acceptance.test.tsx`, `App.phase3.acceptance.test.tsx`, `App.modeErrorBanner.test.tsx`, `App.modeSwitchRace.test.tsx`): `git diff --stat` over the phase range → **EMPTY**; all green in the full run.

### Guard-at-amendment-commits spot-check

`npx vitest run src/App.modeShell.guard.test.ts` at a detached checkout of each amending commit:

| Commit | Plan | Result |
|---|---|---|
| `4551bb9` (extraction + guard retarget, one commit) | 06-02 | **34/34 green** |
| `9a3d5b2` (fork + deletion + retargets, one commit) | 06-07 | **66/66 green** |

No commit boundary in the phase leaves the guard red.

### Phase 4/5 trap-ledger reconciliation (STATE.md Blockers — read only, not edited)

| Trap | Expected state | Confirmed |
|---|---|---|
| **04-REVIEW WR-02** (deckCount wire-shape validation) | Closed this phase (D-09) | ✅ CLOSED — `"deckCount must be 1 or 2"` rejection present in BOTH `src/worker/simulationApi.ts:52` and `src/worker/blackjackSimulationApi.ts:43`, placed before any arithmetic; `deckCountValidation.test.ts` (0/3/1.5/'2'/absent cases for both APIs) green |
| **04-REVIEW WR-03** (no deckCount:2 into the Hold'em trial path until Phase 7) | Respected, not closed | ✅ RESPECTED — `git grep deckCount -- src/engine/conditioning.ts src/state/gameStore.ts` shows only conditioning.ts's `deckCount: DeckCount = 1` default parameter (nothing passes 2); gameStore.ts has zero occurrences; the guard additionally pins `ui/HoldemGame.tsx` as deckCount-free; 06-03's poker deckCount=2 acceptance test deliberately asserts at the validation boundary without entering the trial loop |
| **05-REVIEW WR-03** (HoldemGame extraction) | Closed this phase (D-07) | ✅ CLOSED — `src/ui/HoldemGame.tsx` exists; `src/App.tsx` contains 0 occurrences of `useState`/`startSimulation`/`cancelSimulation(`/`deriveConditionedState` (guard-pinned as well); testid arrays consolidated into `src/test/holdemTestids.ts` |
| **04-REVIEW WR-01** (Phase 8: deckCount into setPick) | Untouched | ✅ UNTOUCHED — `git diff --stat 7b9ca13..HEAD -- src/state/pickerStore.ts` → EMPTY; remains correctly deferred to Phase 8 |

Adjacent ledger notes (no action this plan): 04-REVIEW WR-04 and the Five-of-a-Kind convention flag remain open for Phase 7; the "no SECURITY.md" blocker (Phases 1-4) remains open and out of this plan's scope; the Phase 6 EV-model flag is resolved by D-04/D-05 as implemented in 06-01.

## Multi-Source Coverage Audit

### GOAL — ROADMAP Phase 6 goal + 5 success criteria

| Item | Status | Shipped by |
|---|---|---|
| SC1: Deal + live win/push/lose, bust-if-hit, dealer-distribution convergence with visible trial counter | COVERED | 06-01 (trial loop) · 06-03 (streamed transport) · 06-04 (stores) · 06-05 (felt) · 06-06 (counter + panel) · 06-07 (wiring + BJ-02 loop tests) |
| SC2: Per-unit EV Stand vs Hit under fixed conventions (S17, 3:2) | COVERED | 06-01 (D-04/D-05 engine) · 06-06 (EV tiles, formatEv) · 06-07 (BJ-04 loop test) |
| SC3: Hit/Stand with live recompute; dealer playout; round outcome | COVERED | 06-01 (playDealerHand/compareToDealer) · 06-04 (hit/stand actions) · 06-05 (playout + banner) · 06-07 (BJ-05 loop tests) |
| SC4: Early hole reveal reconditions all odds | COVERED | 06-01 (conditioning readers) · 06-04 (revealHole) · 06-05 (FlipCard reveal button) · 06-07 (BJ-06 loop test: pool 49→48) |
| SC5: 1↔2 deck toggle visibly changes odds, verifiable in-app | COVERED | 06-01 (D-12 anchor) · 06-04 (A3 setDeckCount) · 06-06 (deck-count subtitle) · 06-07 (BJ-07 loop tests) |

### REQ — BJ-02..BJ-07

| Req | Status | Shipped by |
|---|---|---|
| BJ-02 | COVERED | 06-03, 06-04, 06-05, 06-07 |
| BJ-03 | COVERED | 06-01, 06-03, 06-06 |
| BJ-04 | COVERED | 06-01, 06-03, 06-06 |
| BJ-05 | COVERED | 06-04, 06-05, 06-07 |
| BJ-06 | COVERED | 06-04, 06-05, 06-07 |
| BJ-07 | COVERED | 06-01, 06-04, 06-07 |

### RESEARCH — 06-RESEARCH.md load-bearing items

| Item | Status | Shipped by |
|---|---|---|
| Dual-exclusion-set rule (odds pool vs live ledger, two sole readers) | COVERED | 06-01 (`blackjackConditioning.ts`; difference asserted, hole provably in pool / absent from ledger) |
| Single-trial-services-all-stats cursor algorithm (common random numbers) | COVERED | 06-01 (`runBlackjackTrials`: one `drawUnknown()` per trial, disjoint cursor prefixes, overlap-trap test) |
| Fixed 12-card budget + `createDrawer` defensive check | COVERED | 06-01 (`BLACKJACK_TRIAL_CARD_BUDGET=12`) + 06-03 (validate-hook length check — the T-06-06 transfer landed) |
| Option A (no rejection sampling of hypothetical dealer naturals) | COVERED | 06-01 (locked in the trial-loop comment; Option B named as deferred) |
| S17 playout + soft-total demotion loop | COVERED | 06-01 (`while (total > 21 && softAces > 0)`; Pitfall 2/3 vectors pinned) |
| Dealer-natural priority in `compareToDealer` (Pitfall F) | COVERED | 06-01 (asserted directly and through the trial loop: 2-card dealer 21 beats player 21) |
| Natural-frequency anchors (64/1326, 256/5356) | COVERED | 06-01 (D-12 anchor: 2M deals/arm, both bands, negative control demonstrated red) |
| Namespaced Comlink surface (Pattern 4) | COVERED | 06-03 (`Comlink.expose({ poker, blackjack })`, type-level ProxyMarked; confirmed in the production worker chunk this plan) |
| CR-02-safe gate release (Pattern 3, FIXED version) | COVERED | 06-05 (`BlackjackTable` prevRef over four tracked deps, no cleanup; mount/StrictMode/switch-back release zero) |
| Pattern 5 restore signal (blackjack direction) | COVERED | 06-04 (`blackjackRestorePending`/`ackBlackjackRestore`) + 06-05 (`AnimatedCard` mode-select flag read) |
| Pitfall G StrictMode re-implementation (never inherited) | COVERED | 06-07 (odds effect re-implements ignore-flag/gate/cache discipline with the Pitfall G comment) + 06-03 (synchronous check-and-assign singleton, two-concurrent-first-calls test) |

### CONTEXT — D-01..D-14 + D-03a + D-03b

| Decision | Status | Shipped by |
|---|---|---|
| D-01 (predetermine hole at deal; live draws at action time) | COVERED | 06-01 (round shape) + 06-04 (one `drawN` of 4 at deal; hit/stand from the live ledger) |
| D-02 (odds condition only on visible/known; hole never leaks while hidden) | COVERED | 06-01 (sole reader) + 06-05 (DOM-leak tests) + 06-07 (sole call site + loop-suite 49/48 pool proof) |
| D-03 (naturals resolve at deal; win/lose/push banner) | COVERED | 06-01 (`resolveNaturals`) + 06-04 (four natural paths) + 06-05 (banner) |
| D-03a (EITHER side's natural resolves immediately; dealer-only = immediate loss) | COVERED | 06-01 + 06-04 (dealer-only path test) + 06-07 (natural-path loop test) |
| D-03b (random-deal-only; no blackjack picker) | COVERED | 06-04 (`blackjackStore` never imports pickerStore — source-absence asserted); no picker component exists |
| D-04 (S17, 3:2, ±1, push 0 — hard-coded, no settings UI) | COVERED | 06-01 (engine); no settings surface anywhere in the phase |
| D-05 (EV(Hit) = hit once then stand; visible sub-copy) | COVERED | 06-01 (trial loop) + 06-06 (unconditional `hit once, then stand` JSX text, asserted in two states) |
| D-06 (stat set: bust %, 7-bucket distribution, win/push/lose, signed EV tiles, live counter) | COVERED | 06-01 (tallies) + 06-06 (all 13 cells + counter) |
| D-07 (HoldemGame extraction pre-work) | COVERED | 06-02 |
| D-08 (same worker via config; namespaced surface; poker externally unchanged; no evaluator in blackjack) | COVERED | 06-03 (+ 06-01 zero evaluator imports); gate confirmed byte-untouched this plan |
| D-09 (WR-02 closed: deckCount shape validation on BOTH APIs) | COVERED | 06-03 |
| D-10 (new stores, zero key/field sharing; guard extended) | COVERED | 06-04 + 06-07 (D-10 no-sharing guard sweep with demonstrated-red negative control) |
| D-11 (Phase 4 primitives only; without-replacement; property tests) | COVERED | 06-01 (+ 06-04 `cardCounts` full-round shoe-integrity properties at both deck counts) |
| D-12 (natural-frequency anchor; toggle→odds change observable in-app) | COVERED | 06-01 (anchor) + 06-07 (BJ-07 acceptance: blank → retitle → deckCount:2 run over same visible cards) |
| D-13 (scene layout; card-stack/gate reuse; odds cluster docked outside felt) | COVERED | 06-05 (+ 06-06 cluster, 06-07 controls/root) |
| D-14 (disabled conventions; `blackjack-*` lowercase testids; copy block-list; one-way reveal) | COVERED | 06-05, 06-06, 06-07 (guard-pinned locked copy; reveal one-way matrix) |

### UI-SPEC — A1..A16, new testids, copy contract, accessibility contract

| Item | Status | Shipped by |
|---|---|---|
| A1 (no shadcn/component library) | COVERED | All plans (zero installs — T-06-SC held phase-wide) |
| A2 (Deal never disabled; mid-round re-deal silent) | COVERED | 06-07 (disabled-matrix loop test incl. mid-resolved re-deal) |
| A3 (deck-toggle semantics: live mid-turn re-run; idle/resolved pending-only; duplicate guard; snapshot subtitle) | COVERED | 06-04 (full store matrix incl. byte-identical retention) + 06-07 (acceptance + count-aware duplicate guard) |
| A4 (segmented toggle mirrors mode switcher) | COVERED | 06-05 (CSS selector extension) + 06-07 (markup, aria-pressed) |
| A5 (card width tokens: hero 88 / opponent 64) | COVERED | 06-05 |
| A6 (banner badge tokens, `--z-outcome: 4`, role=status, never destructive) | COVERED | 06-05 |
| A7 (odds-cluster internal order) | COVERED | 06-06 |
| A8 (formatEv signed per-unit shape, U+2212, unsigned zero) | COVERED | 06-06 |
| A9 (hole-reveal disabled cursor-only, no art dimming) | COVERED | 06-05 |
| A10 (blackjack-empty-state retained, copy/placement replaced, page-level idle block) | COVERED | 06-07 |
| A11 (live total badges, soft prefix, no upcard-only dealer total) | COVERED | 06-05 |
| A12 (playout pacing 400ms flip / 200ms stride via dealIndex arithmetic) | COVERED | 06-05 (`PLAYOUT_BASE_DEAL_INDEX`/`PLAYOUT_DRAW_STRIDE`) |
| A13 (dealer table mirrors category-table) | COVERED | 06-06 |
| A14 (blackjack error banner + recovery copy) | COVERED | 06-07 (banner + guard copy pin) |
| A15 (display "Loss" / machine `lose`) | COVERED | 06-06 (double-pin + absence assertion on `-loss-`) |
| A16 (resolved retains numbers; naturals/idle zero-state) | COVERED | 06-04 (unconditional deal-time zero; A3 retention) + 06-07 (natural-path zero-state test) |
| New testids (see erratum) | COVERED | 06-05/06-06/06-07 — all 35 new + 2 retained = the 37-entry `BLACKJACK_ONLY_TESTIDS`, every entry swept present-then-absent (06-07) |
| Copy contract (idle, error, controls, stat labels, EV, dealer table, 8 banner paths, block-list) | COVERED | 06-05 (banner) · 06-06 (stats/EV/table) · 06-07 (idle/error/controls); locked strings guard-pinned; verified present in the production bundle this plan |
| Accessibility contract (alt rules, non-hidden badges, role=group toggle, role=status banner, aria-busy, real table semantics, no forced focus, reduced motion) | COVERED | 06-05 (badges/alt/aria-hidden origin) · 06-06 (caption/`th scope=row`/aria-busy) · 06-07 (toggle group/aria-pressed) |

**Plan erratum (testid count):** the plan's audit list says "the 29 new testids"; the UI-SPEC's new-testid table actually contains **35** entries (29 is the `HOLDEM_ONLY_TESTIDS` count). The audit above covers all 35 new + the 2 retained Phase 5 testids (`blackjack-scene`, `blackjack-empty-state`) = the 37 swept entries.

**Zero MISSING rows** — no unplanned or silently-dropped source item found.

## Task 2 — Acceptance Checkpoint (BJ-02..BJ-07)

### Provenance

**Verdict provenance: AGENT-EXECUTED (fallback evidence), not developer-confirmed.**

> Verification performed by the orchestrating Claude agent under the user's standing no-operator-input directive; a human did not personally observe. Re-verify anytime with npm run dev.

**Environment constraints (documented per T-06-47):** this executor environment exposes no in-app browser tools; Playwright is not installed in the project or globally, no browser binaries are cached, and installing it would violate T-06-SC's zero-install rule (a package-legitimacy gate). Per the sanctioned fallback chain, verification used: (a) a **production build preview** served on port 4199 (`npx vite preview --port 4199 --strictPort` — deliberately NOT the user's dev server on 5199, which was left untouched) probed over HTTP, and (b) **automated DOM evidence** from the checkpoint-mapped jsdom suites, re-run as a named evidence artifact: `App.blackjackLoop.test.tsx` + `App.modeIsolation.test.tsx` + `App.modeSwitch.test.tsx` + `BlackjackTable.test.tsx` = **150/150 green**.

**Production-preview evidence (live HTTP, this session):** index.html 200; main bundle 200 (586,331 bytes); CSS 200; the worker chunk `simulation.worker-8QmKkLd1.js` 200 (239,656 bytes) — and the served artifacts contain the namespaced `{ poker:, blackjack: }` expose keys and the WR-02 rejection string (worker chunk), plus the locked copy `hit once, then stand`, `No round dealt yet`, `deck shoe`, `Blackjack — you win`, `Dealer's final hand`, `2 decks`, and the `blackjack-deck-toggle`/`blackjack-hole-reveal` testids (main bundle). The shipped production artifact demonstrably carries the phase's contract.

### Step-by-step results (live vs fallback attribution)

| Step | What | Automated/DOM half | Live-browser half |
|---|---|---|---|
| 1 | Hold'em unharmed (D-08) | **VERIFIED (fallback)** — five frozen v1 suites green with zero edits; both golden detectors + `simulationApi.test.ts` byte-untouched and green; 06-02's extraction proven byte-equivalent DOM | **NOT VERIFIED live** — human walk of the Hold'em loop outstanding |
| 2 | Blackjack idle state | **VERIFIED (fallback)** — idle heading/body copy verbatim, dashed placeholders, badges, dimmed Hit/Stand, counter 0 + em dashes all DOM-asserted; copy confirmed in production bundle | Live look not performed (fully covered by DOM assertions) |
| 3 | Deal + live convergence (BJ-02) | **VERIFIED (fallback)** — deal renders 2+1 cards with hole face-down and DOM-absent; exactly one run started; counter + all seven dealer rows in fixed order render; bucket tallies provably sum to trialsCompleted (≈100%) under property testing | **NOT VERIFIED live** — real-worker streaming/convergence in a browser outstanding |
| 4 | Decision support (BJ-03/04) | **VERIFIED (fallback)** — bust %, Win/Push/Loss group, two signed EV tiles (`−0.07 units` shape), and the always-visible `hit once, then stand` sub-copy (asserted as DOM text in two states, never a tooltip) | Live look not performed (fully covered by DOM assertions) |
| 5 | Early hole reveal (BJ-06) | **VERIFIED (fallback)** — reveal flips the accessible label, total badge appears, a fresh run starts whose pool excludes the now-known hole (49→48), second click provably a no-op (one-way) | **NOT VERIFIED live** — real in-place flip (no row jump/resize) outstanding |
| 6 | Hit and stand (BJ-05) | **VERIFIED (fallback)** — hit appends + fresh run (per-call-distinct values); stand reveals hole, disables both actions, banner shows locked copy naming both totals; banner is role=status with zero `--destructive` in any Phase 6 addition | **NOT VERIFIED live** — real playout pacing (400ms/200ms) outstanding |
| 7 | **Deck-toggle moment (BJ-07/D-12 — headline)** | **VERIFIED (fallback, strongest case)** — the in-app sequence is DOM-asserted end to end: toggle blanks counter to 0 and all 13 cells to `—` in one commit, subtitle retitles to `· 2-deck shoe`, a new run starts with `deckCount: 2` over the SAME visible cards (pool 101 = 104−3); and the settled numbers ARE measurably different by the 2M-deal-per-arm D-12 anchor (1-deck 4.8525% vs 2-deck 4.7885% natural, bands excluding the with-replacement sampler via a demonstrated-red negative control) | **NOT VERIFIED live** — the at-a-glance human findability experience outstanding |
| 8 | Switch mid-deal (CR-01/CR-02 non-recurrence) | Machinery pinned: gate-theft tests prove mount/StrictMode/switch-back release zero units; mode-isolation round trip leaves the panel live serving the cache | **NOT VERIFIED** (recorded per the plan's explicit instruction for non-interleavable steps — a mid-flight click against real Motion cannot be produced without a browser) |
| 9 | Switch back mid-round (WR-02 non-recurrence) | Machinery pinned: symmetric `blackjackRestorePending` + `AnimatedCard` capture-once flag + prevRef release-zero on re-mount + cache-serve with call-count 1 and byte-identical numbers | **NOT VERIFIED** (same instruction — instant-restore visual outstanding) |
| 10 | Rapid toggling + console hygiene | **VERIFIED (fallback)** — `App.modeSwitchRace` + 70-test isolation suite green; zero console errors/warnings across the full 679-test jsdom run | **NOT VERIFIED live** — real DevTools console over rapid real-Motion toggling outstanding |
| 11 | Keyboard and focus | **VERIFIED (fallback)** — every control is a native `<button>` (guard census: the scene contains exactly one button, the reveal; Deal/Hit/Stand/toggle in the control bar), so Enter/Space activation is a platform guarantee; shipped production CSS contains **zero** `outline: none/0` suppressions and carries a `:focus-visible` rule; deck segments never disabled under normal play (A3 guard only on the impossible-duplicate case); the known T-06-11 flag — mode-switch focus lands on `<body>` — is the recorded, accepted consequence of D-07 and NOT a failure per the plan's own step text | **NOT VERIFIED live** — a physical Tab walk (keyboard-trap absence) outstanding |
| 12 | Reduced motion | **VERIFIED (fallback — jsdom is the strong case here)** — every suite in the phase runs under forced reduced motion; the entire BJ-02..07 loop (deal, hit, reveal, stand, toggle, natural path) functions with all durations 0 and all numbers converging — functionality is provably not gated behind an animation playing | **NOT VERIFIED live** — the OS-level toggle in a real browser outstanding |

### Verdict

**All twelve steps pass on their automated/DOM evidence halves; zero defects found.** The real-browser halves of steps 1, 3, 5-12 — real Comlink boundary under user-paced input, real non-zero Motion choreography, real console — are **NOT VERIFIED** and the phase closes with that gap named, exactly as T-06-47 requires. Steps 8 and 9 are explicitly NOT VERIFIED per the plan's mandated labeling for steps requiring action during motion. No step produced contrary evidence; no fix was routed to any owning plan.

**Recommended follow-up (routed, not blocking):** a 5-minute human walk of the 12 steps with `npm run dev` — highest-value items: step 7 (the D-12 findability moment), steps 8-9 (mid-flight switch shapes), and step 10's real console.

### Dev-server hygiene

- The production preview (port 4199, PID 104276) was terminated after evidence collection; process check confirms port 4199 free and the background task exited.
- The user's own dev-server session on port 5199 (PID 3016) predates this executor and was deliberately left untouched (per the orchestrator's directive that it belongs to the user's session).
- No watch process was started by this executor at any point.

## Deviations from Plan

**1. [Rule 3 - Blocking] Checkpoint executed via the fallback evidence chain instead of a live browser**
- **Found during:** Task 2 (tooling probe: no in-app browser tools; no Playwright in package.json, node_modules, global PATH, or `ms-playwright` cache)
- **Issue:** the plan's agent-execution clause assumes a drivable browser; none exists in this environment, and installing automation tooling is forbidden by T-06-SC (zero installs — a package-legitimacy gate this plan must not breach).
- **Fix:** followed the orchestrator's sanctioned fallback: production-preview HTTP probing + checkpoint-mapped jsdom suites, with per-step live-vs-fallback attribution and NOT VERIFIED gaps named rather than assumed-pass.
- **Files modified:** none (this SUMMARY records it)

**2. [Plan errata — recorded, nothing changed]** (a) baseline hash `7d8fb13` → actual `7b9ca13`; (b) "29 new testids" → 35 new per the UI-SPEC table (37 swept incl. the 2 retained). Both are plan-text inaccuracies, not code defects; details inline above.

No other deviations — every gate, grep, diff and audit row executed as written.

## Issues Encountered

None beyond the recorded deviations. No auth gates; zero package installs (T-06-SC: `npm ci` from the committed lockfile only, verified `found 0 vulnerabilities`, no lockfile change).

## User Setup Required

None. (Optional, recommended: the 5-minute human re-verification walk noted above.)

## Known Stubs

None — this plan changes no source files; the seven wave SUMMARYs each report zero stubs and this audit found no contrary evidence.

## Threat Flags

None — no new security-relevant surface (no source changes). T-06-42..48 dispositions all discharged as recorded above; T-06-SC held.

## Self-Check: PASSED

- `.planning/phases/06-blackjack-core-odds-loop/06-08-SUMMARY.md` present on disk (this file).
- All referenced phase commits verified in `git log`: wave bases `7b9ca13`/`a79c80f`/`d2bb22c`/`ea6779b`, task commits `5318c8b`/`bbae8c0`/`0563836`/`d297960`/`4551bb9`/`00370fb`/`fa3dc1f`/`0de1880`/`7db513d`/`e799c28`/`a6a19d9`/`2efbad8`/`c972ae1`/`c3dd128`/`62e288f`/`0635f5a`/`d662fc2`/`078e827`/`7acfdf1`/`25fc388`/`9a3d5b2`/`732829a`, orchestrator `054bd22`, HEAD `4b764f0`.
- Gates re-confirmed at HEAD: 51 files / 679 tests green, 0 skipped; lint exit 0; build exit 0.
- Working tree clean before this SUMMARY; no dev/preview server left running (port check); STATE.md and ROADMAP.md untouched.

## Post-Merge Live-Browser Addendum (orchestrator, same day)

After all 8 plans merged to master, the orchestrating agent drove the real dev server (port 5199, real Chromium via the in-app browser) and upgraded several checkpoint steps from automated-only to LIVE evidence. Environmental constraint unchanged from Phases 4/5: the browser pane reports `visibilityState: "hidden"` with 0 rAF ticks/900ms even when fronted, so Motion callbacks stay suspended and frame-dependent choreography (card landings, gate release, odds convergence display) cannot complete live.

**Verified LIVE in real Chromium (frame-independent):**
1. Blackjack scene mounts with the exact locked empty-state copy; all 8 controls present with the correct idle disabled-matrix (Deal enabled; Hit/Stand/hole-reveal disabled); dealer table + EV tiles + always-visible "hit once, then stand" sub-copy present; zero Hold'em testids in the DOM.
2. **A3 idle-snapshot rule (checker FLAG 1 / plan BLOCKER 2 behavior):** idle toggle 1→2 flipped `aria-pressed` but the dealer-table caption kept reading "· 1-deck shoe" — pending selection never retitles the displayed state.
3. **TBL-04 synchronous half:** clicking Deal instantly produced `aria-busy="true"`, pending class, em-dash trial counter and stats, mounted player cards, and enabled Hit/Stand/reveal.
4. **FLAG 2 mid-flight masking:** mid-player-turn toggle 2→1 flipped the segment while the panel stayed fully masked (all sampled stats "—", aria-busy held) — the pending display wins over any streamed values while the gate holds.
5. **Isolation round-trip with state retention:** → Hold'em (odds-panel present, ALL blackjack testids absent) → back to Blackjack (panel restored, the dealt round retained with Hit still enabled, ALL Hold'em testids absent).
6. Fresh hard-reload loads clean and functional; the only console errors are two pre-reload Vite HMR artifacts from the merge deleting `BlackjackScene.tsx` while the long-running dev server had it hot-loaded (restart clears them; not an app defect).

**Still NOT live-verified (rAF-suspended, automated evidence only):** odds convergence display after gate release, hit/stand dealer-playout outcomes, hole-reveal flip animation, and the full BJ-07 blank→climb→different-numbers arc. Attribution caveat (verbatim): Verification performed by the orchestrating Claude agent under the user's standing no-operator-input directive; a human did not personally observe. Re-verify anytime with npm run dev.
