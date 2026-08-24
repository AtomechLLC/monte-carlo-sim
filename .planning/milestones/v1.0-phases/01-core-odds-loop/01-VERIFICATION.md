---
phase: 01-core-odds-loop
verified: 2026-08-23T21:50:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "Human confirms all ten verification steps in the phase acceptance checkpoint (01-04 Task 2), including that percentages visibly settle, the page never freezes, and exactly one worker thread exists"
    reason: "Checkpoint was resolved via the orchestrating agent driving a real Chromium browser through 10+ live deals (quantitative evidence: 40ms JS main-thread sampling with no missed ticks across a full 200,000-trial run, resource-entry count confirming exactly one worker bootstrap, console clean), under the user's explicit standing directive to proceed through all waves without operator input. This is documented verbatim with an attribution caveat in 01-04-SUMMARY.md rather than presented as unqualified human sign-off. The launching verification task explicitly directs this be treated as resolved with agent-observed evidence, not re-opened as a pending human-verify item."
    accepted_by: "orchestrator (per user's standing no-operator-input directive, recorded in 01-04-SUMMARY.md)"
    accepted_at: "2026-08-23T21:30:00Z"
---

# Phase 1: Core Odds Loop Verification Report

**Phase Goal:** Users can deal a random Hold'em hand and watch accurate win/tie/lose and hand-category odds converge live, computed off the main thread, in a minimal (unstyled) UI.
**Verified:** 2026-08-23T21:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can click Deal to get a random hand (own 2 hole cards + 3 hidden opponents) with one click, and re-deal at any time (DEAL-01) | ✓ VERIFIED | `src/ui/DealButton.tsx` calls `useGameStore` `deal()`; `src/state/gameStore.ts` draws 2 cards via `drawN(rng, FULL_DECK, 2)` (seedable, no-replacement Fisher-Yates) and increments `dealNonce`; `src/ui/HandDisplay.tsx` renders `data-testid="hero-hole"` (2 cards) and `data-testid="opponents"` (3 × "Hidden", unconditional). `App.test.tsx` "deals a hero hand..." test passes. |
| 2 | User sees live win/tie/lose probability against 3 opponents, computed by Monte Carlo simulation, updating as trials accumulate (ODDS-01) | ✓ VERIFIED | `src/ui/WinTieLossDisplay.tsx` reads `useOddsStore().outcomes`/`trialsCompleted`, renders `win-pct`/`tie-pct`/`lose-pct`. Values are populated by real trial-loop output (`runTrials` in `src/engine/equity.ts`) streamed via the worker, not placeholders. `App.test.tsx` streaming test asserts exact formatted values from mocked snapshots; `equity.test.ts`/`benchmark.test.ts` prove the underlying numbers are real equity. |
| 3 | User sees a full hand-category table (High Card → Royal Flush) summing to ~100%, updating live (ODDS-02) | ✓ VERIFIED | `src/ui/categoryLabels.ts` exports exactly 10 labels ending in "Royal Flush" (matches `HandStrength` enum verified directly against installed `node_modules/@poker-apprentice/types` — `HighCard=0`..`RoyalFlush=9`). `src/ui/OddsTable.tsx` renders one row per label (data-testid `category-table`, `category-pct-N`), rows always derived from `CATEGORY_LABELS` not stream length. `App.test.tsx` table test confirms 10 rows, exact label order, sum within 0.5 of 100. |
| 4 | User can watch a visible trial counter climb and percentages settle in real time, page staying fully responsive (no freeze) (ODDS-03 / ENG-03) | ✓ VERIFIED | Trials execute inside `src/worker/simulation.worker.ts` (`Comlink.expose`), never on the main thread — confirmed by `npm run build` emitting a separate `dist/assets/simulation.worker-*.js` chunk. `simulationApi.ts` streams throttled snapshots (`DEFAULT_PROGRESS_INTERVAL_MS=100`) with monotonically non-decreasing `trialsCompleted`, proven by `simulationApi.test.ts` (2+ snapshots, ends `done` at `maxTrials=200000`). Live responsiveness/settling behavior confirmed via the phase-acceptance checkpoint evidence in 01-04-SUMMARY.md (see override above) — quantitative 40ms main-thread sampling showed zero missed ticks across a full run. |
| 5 | Displayed odds reflect real Hold'em equity, not placeholder/stub values (ENG-01 / ENG-02) | ✓ VERIFIED | `src/engine/evaluator.ts` wraps `evaluateHoldem`/`compare` from the real `@poker-apprentice/hand-evaluator@4.3.0` library with a sign-normalized `compareHands`. `src/engine/equity.ts`'s `runTrials` no longer contains `STUB:` or `simulateHoldem` (grep confirmed empty). `evaluator.test.ts` (wheel straight, royal-vs-straight-flush distinction, kicker resolution, split pot, raw-comparator sign guard) and `equity.test.ts` (rigged win/lose/tie scenarios, no-duplicate sampling, determinism) all pass — 25/25 tests green, independently re-run. |
| 6 | Displayed probabilities validated against a known benchmark (AA vs. 3 opponents ≈ 63.83% equity) (ENG-04) | ✓ VERIFIED | `src/engine/benchmark.test.ts` runs 200,000 seeded trials, asserts `winRate <= 64.83`, `winRate + tieRate >= 62.83`, and a 55% inversion floor, plus a directional AA > 7-2o sanity check. Independently re-ran full suite — this test passes. |
| 7 | Hand-category and win/tie/lose counts sum exactly to the trial count for arbitrary trial counts, with a dev-mode console guard reporting any violation (ENG-04) | ✓ VERIFIED | `src/engine/equity.property.test.ts` uses `test.prop` from `@fast-check/vitest` to assert exact-sum invariants across `fc.integer({min:1,max:3000})` trial counts and arbitrary seeds/hero hands, plus no-duplicate/no-hero-card sampling. `src/state/oddsStore.ts`'s `applySnapshot` contains `import.meta.env.DEV` guard calling `console.error` (never `throw`) on sum-mismatch or wrong-length `categoryCounts`. |
| 8 | Simulation runs off the main thread via a Web Worker; the main thread never executes the trial loop, and a re-deal cancels the in-flight run and restarts at 0 | ✓ VERIFIED | `src/state/simulationService.ts` instantiates the worker once at module scope (`new SimWorker()`, not inside a `useEffect`), wraps it with `Comlink.wrap`. Generation-tagged `requestId` cancellation enforced on both the worker (`simulationApi.ts`, bails when `requestId !== currentRequestId`) and the main thread (staleness filter before `onProgress`). `simulationApi.test.ts` proves cancellation and supersession-by-newer-requestId behaviorally. `App.tsx`'s `useEffect([heroHole, dealNonce])` resets `oddsStore` and calls `startSimulation` on every deal. |

**Score:** 8/8 truths verified (1 via documented override — see frontmatter)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | TypeScript pinned exactly `6.0.3`, ESLint (not Oxlint) | ✓ VERIFIED | `"typescript": "6.0.3"` exact (no `^`/`~`); `"lint": "eslint ."`; no `oxlint` anywhere |
| `src/engine/cards.ts` | `FULL_DECK`, `OPPONENT_COUNT`, `CARDS_PER_TRIAL`, `deckWithout` | ✓ VERIFIED | All four exported; `FULL_DECK` is `ALL_CARDS` re-export (52 cards) |
| `src/engine/rng.ts` | `createRng`, `drawN`, `createDrawer`, no `sort()` | ✓ VERIFIED | Subpath imports (`pure-rand/generator/xoroshiro128plus`, `pure-rand/distribution/uniformInt`); no `sort(` substring found |
| `src/state/gameStore.ts` | `useGameStore` with `heroHole`, `dealNonce` | ✓ VERIFIED | Present, correct shape |
| `src/worker/protocol.ts` | Shared contract, `CATEGORY_COUNT=10` | ✓ VERIFIED | Matches installed `HandStrength` enum (0-9, 10 values) verified directly against `node_modules/@poker-apprentice/types` |
| `src/worker/simulationApi.ts` | Pure, Comlink-free trial loop | ✓ VERIFIED | No Comlink import; chunked, throttled, generation-tagged |
| `src/worker/simulation.worker.ts` | `Comlink.expose` only | ✓ VERIFIED | 3-line entry point, zero trial-loop logic |
| `src/state/simulationService.ts` | `startSimulation`, module-scope worker | ✓ VERIFIED | `new SimWorker()` at module scope, not in a component/effect |
| `src/state/oddsStore.ts` | `useOddsStore` derived state | ✓ VERIFIED | `categoryCounts`, `outcomes`, `trialsCompleted`, `done`, `reset`, `applySnapshot`, dev consistency guard |
| `src/engine/evaluator.ts` | `evaluateHand`, `compareHands`, `HandStrength` | ✓ VERIFIED | Sign-normalized wrapper; single import site for the hand-evaluator library (grep-confirmed) |
| `src/engine/equity.ts` | Real `runTrials` | ✓ VERIFIED | No `STUB:` / `simulateHoldem`; max-then-count-ties reduction implemented |
| `src/ui/categoryLabels.ts` | `CATEGORY_LABELS`, 10 entries | ✓ VERIFIED | Exact order, last entry `Royal Flush` |
| `src/ui/OddsTable.tsx` | 10-row live table | ✓ VERIFIED | `data-testid="category-table"`, rows from `CATEGORY_LABELS` |
| `src/engine/evaluator.test.ts` | ENG-01 regression suite | ✓ VERIFIED | 6 cases (wheel, royal/straight-flush, kicker, split pot, sign guard) — 63 lines |
| `src/engine/equity.property.test.ts` | fast-check property suite | ✓ VERIFIED | Uses `test.prop`, 2 properties (sum invariants, sampling integrity) |
| `src/engine/benchmark.test.ts` | Benchmark regression | ✓ VERIFIED | Contains literal `63.83`, 200,000-trial run, 60s timeout |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/ui/DealButton.tsx` | `src/state/gameStore.ts` | `useGameStore` selector | ✓ WIRED | `deal` selected and bound to `onClick` |
| `src/state/gameStore.ts` | `src/engine/rng.ts` | `drawN` over full deck | ✓ WIRED | `drawN(rng, FULL_DECK, 2)` called in `deal()` |
| `src/state/simulationService.ts` | `src/worker/simulation.worker.ts` | Vite `?worker` import + `Comlink.wrap` | ✓ WIRED | `import SimWorker from '../worker/simulation.worker?worker'`; production build emits separate worker chunk |
| `src/App.tsx` | `src/state/simulationService.ts` | `useEffect([heroHole, dealNonce])` → `startSimulation` | ✓ WIRED | Confirmed in `App.tsx` |
| `src/worker/simulation.worker.ts` | `src/worker/simulationApi.ts` | `Comlink.expose(createSimulationApi())` | ✓ WIRED | Confirmed |
| `src/engine/equity.ts` | `src/engine/evaluator.ts` | `evaluateHand` + `compareHands` per trial | ✓ WIRED | Confirmed, both hero and 3 opponents evaluated per trial |
| `src/ui/OddsTable.tsx` | `src/state/oddsStore.ts` | `useOddsStore` subscription | ✓ WIRED | Confirmed |
| `src/engine/equity.ts` | categoryCounts histogram | Indexing by hero hand strength | ✓ WIRED | `categoryCounts[hero.strength]++` |
| `src/engine/benchmark.test.ts` | `src/engine/equity.ts` | Seeded `runTrials` at 200,000 trials | ✓ WIRED | Confirmed |
| `src/state/oddsStore.ts` | Consistency invariants | Dev-only check inside `applySnapshot` | ✓ WIRED | Confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `WinTieLossDisplay.tsx` | `outcomes`, `trialsCompleted` (`useOddsStore`) | `applySnapshot` ← worker `onProgress` ← `simulationApi.runSimulation` ← `runTrials` (real evaluator loop, not stub) | Yes | ✓ FLOWING |
| `OddsTable.tsx` | `categoryCounts` (`useOddsStore`) | Same chain; `categoryCounts[hero.strength]++` per real trial | Yes | ✓ FLOWING |
| `HandDisplay.tsx` | `heroHole` (`useGameStore`) | `deal()` → `drawN(rng, FULL_DECK, 2)`, freshly sampled each click | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npx vitest run` (re-run independently) | 6 test files, 25 tests, all passed | ✓ PASS |
| Production build succeeds and worker is code-split | `npm run build` (re-run independently) | Exit 0; `dist/assets/simulation.worker-BXk5k7V5.js` emitted as a separate chunk | ✓ PASS |
| Lint is clean | `npm run lint` (re-run independently) | Exit 0, no output | ✓ PASS |
| `HandStrength` enum matches app's `CATEGORY_COUNT=10` assumption | Read `node_modules/@poker-apprentice/types/dist/types/types.d.ts` directly | `HighCard=0 .. RoyalFlush=9` (10 values) — matches app exactly | ✓ PASS |
| No debt markers in phase-modified source | `grep -rniE "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across `src/` | No matches | ✓ PASS |
| Commit hashes cited in SUMMARYs exist in git history | `git log --oneline -20` | All cited hashes (`66d0da6`, `6b5fcc4`, `bc8f127`, `c6cf9fd`, `2cdb326`, `c3a9ba3`, `d31bc80`, `583d2f8`, etc.) present | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention or PLAN/SUMMARY-declared probes exist for this phase (this is a Vite/Vitest web app, not a migration/CLI tooling phase). Step 7c: SKIPPED — no probes declared or discovered.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DEAL-01 | 01-01 | One-click deal + re-deal | ✓ SATISFIED | Truth 1 |
| ENG-03 | 01-02 | Off-main-thread streaming | ✓ SATISFIED | Truth 4, 8 |
| ODDS-03 | 01-02 | Visible trial counter, live convergence | ✓ SATISFIED | Truth 4 |
| ENG-01 | 01-03 | Correct best-5-of-7 evaluation | ✓ SATISFIED | Truth 5 |
| ENG-02 | 01-03 | No-duplicate conditioned sampling | ✓ SATISFIED | Truth 5, 7 |
| ODDS-01 | 01-03 | Live win/tie/lose vs. 3 opponents | ✓ SATISFIED | Truth 2 |
| ODDS-02 | 01-03 | 10-row hand-category table | ✓ SATISFIED | Truth 3 |
| ENG-04 | 01-04 | Benchmark + invariant accuracy validation | ✓ SATISFIED | Truth 6, 7 |

No orphaned requirements: all 8 IDs declared in the phase (ENG-01/02/03/04, ODDS-01/02/03, DEAL-01) appear in exactly one plan's `requirements` field, and REQUIREMENTS.md maps all 8 to "Phase 1: Core Odds Loop" with no additional unclaimed IDs for this phase.

**Note (non-blocking):** `.planning/REQUIREMENTS.md`'s traceability table still shows these 8 requirements' checkbox/status column as unchecked/"Pending" — this is a documentation-currency gap, not a functional gap (typically updated at milestone close), and does not affect goal achievement.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `index.html` | 7 | `<title>scaffold-tmp</title>` — leftover scaffold title | ℹ️ Info | Cosmetic only; explicitly deferred to Phase 3 (styling/branding) in 01-04-SUMMARY.md; does not affect Phase 1's functional goal |
| `src/worker/simulationApi.ts` + `src/App.tsx` | 48-61 / 15-22 | WR-01 (01-REVIEW.md): duplicate-requestId re-entry can spawn two concurrent simulation loops; no `useEffect` cleanup | ⚠️ Warning | Not reachable in current single-click deal flow (`dealNonce` always increments); latent risk for future phases doing in-place re-renders. Does not fail any Phase 1 must-have. |
| `src/state/simulationService.ts` + `src/App.tsx` | 20-38 / 19 | WR-02 (01-REVIEW.md): no error handling on the async worker path — a worker failure is a silent frozen UI + unhandled rejection | ⚠️ Warning | No Phase 1 success criterion requires error-path UX; noted for future hardening, not a goal-achievement blocker. |
| `src/App.test.tsx` | 47-60 | IN-01 (01-REVIEW.md): mocked snapshot fixtures violate the store's own sum invariant, tripping the dev consistency guard's `console.error` during test runs | ℹ️ Info | Report-only guard, does not fail tests; cosmetic test-fixture inconsistency only |

No debt markers (`TBD`/`FIXME`/`XXX`) found anywhere in phase-modified files — debt marker gate does not trigger.

### Human Verification Required

None. The phase's one blocking human-verify checkpoint (01-04 Task 2, "watch it converge") was already resolved with agent-observed real-browser evidence under the user's explicit standing no-operator-input directive, documented verbatim with an attribution caveat in `01-04-SUMMARY.md`. This is recorded as a formal override in this report's frontmatter rather than silently treated as unqualified human sign-off. No other must-have in this phase depends on unverifiable visual/subjective judgment beyond what that checkpoint's quantitative evidence (40ms main-thread sampling with zero missed ticks, single worker resource-entry, clean console, plausible odds across 10+ dealt hands) already covers.

### Gaps Summary

No gaps. All 8 must-have truths (derived from the 4 ROADMAP Phase 1 Success Criteria plus phase-specific engineering/accuracy truths from the 4 plans' frontmatter) are verified against the actual codebase: real (non-stub) evaluator-backed Monte Carlo engine, off-main-thread Web Worker execution with generation-tagged cancellation, a live win/tie/lose display, a live 10-row hand-category table, and accuracy pinned by both a 2M-sample-derived benchmark regression test and fast-check property invariants with a dev-mode runtime consistency guard. The full automated suite (25/25 tests), production build (worker code-split confirmed), and lint were independently re-run by this verifier and all passed. Two advisory warnings from the prior code review (WR-01 duplicate-requestId re-entry, WR-02 missing error handling) are real but do not fail any Phase 1 must-have; they are carried forward here for visibility and are natural candidates for hardening in Phase 2/3 work that touches the same files.

---

_Verified: 2026-08-23T21:50:00Z_
_Verifier: Claude (gsd-verifier)_
