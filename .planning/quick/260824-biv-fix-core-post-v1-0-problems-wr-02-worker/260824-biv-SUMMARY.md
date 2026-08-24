---
phase: quick/260824-biv
plan: 01
subsystem: ui
tags: [react, typescript, vitest, comlink, web-worker, accessibility]

# Dependency graph
requires:
  - phase: 02-conditioned-odds-engine
    provides: deriveConditionedState (D-02 leak guard), simulationService worker/Comlink wiring
  - phase: 03-casino-table-ui-animation
    provides: OddsPanel/OddsTable/WinTieLossDisplay markup, App.css UI-SPEC conformance pass
provides:
  - Hard worker crash (Worker `error`/`messageerror`) now routes into the existing simulation-error banner via `reportWorkerFailure`, closing WR-02
  - Explicit `strict: true` and Node-type-free `tsconfig.app.json`, with a scoped `node-builtins.d.ts` fallback for the one on-disk-asset test
  - Labelled win/tie/loss stats (`dl`/`dt`/`dd`) and a self-explaining, exclusive-final-category odds table with a per-row "Locked In" indicator derived from visible cards only
  - One shared `formatPct` helper
  - Error banner now shows the captured error detail as a sibling element
  - Query-parsing `matchMedia` polyfill in test setup, and removal of dead Phase 1 scaffold CSS
affects: [ui, testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "reportWorkerFailure(message) pattern: capture the callback into a local, null all module-scope run state (callbacks + requestId), THEN invoke the captured local — guarantees exactly-once delivery and blocks late-arriving events from a dead generation from resurrecting or double-reporting"
    - "lockedInCategory(heroHole, knownBoard) takes only caller-supplied visible cards, never a runout — same D-02 leak-guard discipline as deriveConditionedState, extended into a UI-layer derived value"
    - "Comment hygiene: avoid spelling out literal magic strings (e.g. '@vitest-environment node', 'query.includes(', 'runout.board') inside prose comments when those exact substrings are also used as grep-based acceptance criteria or Vitest docblock directives — Vitest's environment-directive scanner and the plan's own acceptance greps both match anywhere in file text, not just in code"

key-files:
  created:
    - src/state/simulationService.test.ts
    - src/ui/node-builtins.d.ts
    - src/ui/formatPct.ts
    - src/ui/lockedCategory.ts
    - src/ui/lockedCategory.test.ts
  modified:
    - src/state/simulationService.ts
    - tsconfig.app.json
    - src/ui/WinTieLossDisplay.tsx
    - src/ui/OddsTable.tsx
    - src/App.css
    - src/App.tsx
    - src/test/setup.ts

key-decisions:
  - "reportWorkerFailure nulls currentOnProgress/currentOnError/currentRequestId BEFORE invoking the captured onError, not after — this is what makes crash reporting exactly-once and prevents a second error/messageerror event, or a late Comlink rejection for the same dead generation, from double-firing or resurrecting a finished run's onError"
  - "lockedInCategory lives in src/ui/ (not src/engine/) since it's a UI-presentation derivation (which single row to tick) built on top of the read-only engine evaluator, not new engine logic — engine/* stayed untouched per the plan's binding constraint"
  - "Comments describing the tsconfig/setup.ts/OddsTable fixes were reworded twice after real failures: a comment containing the literal substring '@vitest-environment node' silently flipped the test file's environment to node (no jsdom, no ErrorEvent) via Vitest's file-wide docblock scanner, and comments containing 'runout.board' / 'query.includes(' would have failed the plan's own grep-based acceptance checks. Fixed by describing behavior in prose without literally spelling out the matched substrings."

requirements-completed: [IMP-01, IMP-02, IMP-1b-1, IMP-1b-2, IMP-13, IMP-14, IMP-15, IMP-16]

# Metrics
duration: ~25min
completed: 2026-08-24
---

# Quick Task 260824-biv: Post-v1.0 Hardening Pass Summary

**Surfaced hard Worker crashes into the existing error banner (WR-02), made `tsconfig.app.json`'s strictness explicit and Node-type-free, labelled the win/tie/loss stats row, added a self-explaining exclusive-final-category odds table with a leak-safe "Locked In" indicator, deduped `formatPct`, rendered the captured error detail, removed dead scaffold CSS, and hardened the test `matchMedia` polyfill's query parsing — all eight scoped IMPROVEMENTS.md Tier 1/1b/4 items closed in one pass.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (all `type="auto"`, 2 with `tdd="true"`)
- **Files modified:** 11 (5 created, 7 modified — `src/App.css` and `.planning/IMPROVEMENTS.md` each touched twice across separate commits)

## Accomplishments

- **WR-02 closed:** a hard Worker death (script-load failure or an undeserializable `postMessage`) now routes through the exact same `onError` → simulation-error-banner path an in-band Comlink rejection already used, instead of leaving every pending promise hanging with a silently frozen odds panel. Covered by 3 new regression tests (`error`, `messageerror`, and a stale-closure guard proving a finished run's `onError` is never resurrected).
- **Browser tsconfig hardened:** `strict: true` is now explicit rather than relying on a TS 6.0.3 default, and the `"node"` ambient-types entry is gone from the browser build's `types` array. A scoped 6-symbol `node-builtins.d.ts` (not `@types/node`) covers the one on-disk-asset test that still needs `node:fs`/`node:url`/`node:path`.
- **Odds panel UX fixed (first-real-user findings):** the win/tie/loss row is now a labelled `dl`/`dt`/`dd` (Trials / Win / Tie / Loss) instead of an unlabelled run-on string, and the category table gained a "Final hand by the river" caption/subtitle plus a per-row "Locked In" ✓ column — derived exclusively from `deriveConditionedState`'s visible-only output (D-02), never from a raw runout slice, and suppressed while any card animation is in flight.
- **Polish batch cleared:** one shared `formatPct` (was byte-identically duplicated in two components), the captured `errorMessage` is now rendered as a sibling `simulation-error-detail` element, the dead Phase 1 `#next-steps`/`#docs`/`.logo` scaffold CSS block is deleted with its stale comment updated, and the test `matchMedia` polyfill now regex-parses `prefers-reduced-motion` instead of doing a substring match that previously answered `true` for the `no-preference` case — the exact negation of correct behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Surface hard worker crashes (WR-02) and make the app tsconfig explicit** - `998b286` (feat)
2. **Task 2: Label the win/tie/loss row, explain the category table, and dedupe formatPct** - `44142ed` (feat)
3. **Task 3: Show the error detail, delete the dead scaffold CSS, and parse queries in the test matchMedia polyfill** - `c3b8352` (feat)

**IMPROVEMENTS.md update:** `24e7253` (docs)

_Note: Tasks 1 and 2 were `tdd="true"` — each required a RED (failing-test) step before the GREEN implementation; both are folded into their single task commit above since the failing state was caught and fixed before any commit was made (see Deviations)._

## Files Created/Modified

- `src/state/simulationService.ts` - Adds `currentOnError`, `reportWorkerFailure`, and `worker.addEventListener('error'|'messageerror', ...)` routing hard crashes into the existing `onError` path exactly once
- `src/state/simulationService.test.ts` - 3 new tests: `error` event, `messageerror` event, and the finished-run stale-closure guard
- `tsconfig.app.json` - Adds explicit `"strict": true`; `"types"` narrowed to `["vite/client"]`
- `src/ui/node-builtins.d.ts` - Scoped fallback declaring only the 4 Node symbols `PlayingCard.test.tsx` uses
- `src/ui/formatPct.ts` - Single shared `formatPct(count, trialsCompleted, pending)` implementation
- `src/ui/lockedCategory.ts` - `lockedInCategory(heroHole, knownBoard)`: visible-cards-only made-hand category, `null` below 5 known cards
- `src/ui/lockedCategory.test.ts` - 5 tests covering the pre-flop-null case, One Pair/Three of a Kind derivations, `null` heroHole, and the valid-index invariant
- `src/ui/WinTieLossDisplay.tsx` - Bare unlabelled `<div>` of spans replaced with a labelled `<dl>`/`<dt>`/`<dd>` structure; testids/textContent unchanged
- `src/ui/OddsTable.tsx` - Adds `<caption>` + subtitle and a third "Locked In" column driven by `lockedInCategory`/`deriveConditionedState`
- `src/App.css` - Adds `.odds-stats`/`.odds-stat*`/`.category-table__caption`/`.category-table__subtitle` rules; adds `.simulation-error-banner`/`.simulation-error-detail`; deletes the dead `#next-steps`/`#docs`/`#next-steps ul` block and updates the stale comment naming it
- `src/App.tsx` - Error banner now wraps the existing `role="alert"` element and a new sibling `simulation-error-detail` paragraph
- `src/test/setup.ts` - `matchMedia` polyfill now parses `prefers-reduced-motion` via regex instead of a substring match
- `.planning/IMPROVEMENTS.md` - Marks items 1, 2, both Tier 1b bullets, and 13-16 done; updates "Suggested sequencing"

## Decisions Made

- `reportWorkerFailure` nulls all module-scope run state (`currentOnProgress`, `currentOnError`, `currentRequestId`) BEFORE invoking the captured `onError` callback — the ordering is what guarantees exactly-once delivery per crash and prevents a dead generation's late Comlink rejection from double-firing.
- `lockedInCategory` was placed in `src/ui/` rather than `src/engine/`, since it's a UI-presentation derivation (which single category row to tick) layered on the read-only `evaluateHand` engine primitive — `src/engine/*` stayed untouched per the plan's binding constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `messageerror`-test race caused by cumulative mock call counts across tests**
- **Found during:** Task 1, running the new `simulationService.test.ts` for the first time (GREEN phase)
- **Issue:** The plan's test structure explicitly says not to clear the `workers` array between tests (it's a module-scope singleton), but omits an explicit `beforeEach(() => vi.clearAllMocks())`. Without it, `runSimulation`'s call count carried over from the prior test, so `await vi.waitFor(() => expect(runSimulation).toHaveBeenCalled())` in the second test resolved on its very first (already-satisfied) check — racing ahead of the `await cancelSimulation()` tick that assigns `currentOnError` for that test, causing the `messageerror` test to intermittently see `onError` never invoked.
- **Fix:** Added `beforeEach(() => vi.clearAllMocks())` inside the `describe` block, clearing `mock.calls`/`mock.results` (not the `workers` array, which correctly persists) so each test's `vi.waitFor` genuinely waits for that test's own call.
- **Files modified:** `src/state/simulationService.test.ts`
- **Verification:** All 3 tests pass consistently across repeated runs.
- **Committed in:** `998b286` (Task 1 commit)

**2. [Rule 1 - Bug] Explanatory comment literally matched Vitest's environment-directive scanner**
- **Found during:** Task 1, first run of the new test file — failed with `ReferenceError: ErrorEvent is not defined` and `environment 0ms` in the reporter output (vs. ~900ms for a real jsdom boot)
- **Issue:** A comment reading `// jsdom (the default environment — do NOT add \`@vitest-environment node\` here) is required...` contains the literal substring `@vitest-environment node`. Vitest's docblock/comment scanner matches this pattern ANYWHERE in the file text (not only as a genuine leading directive), silently flipping the whole test file to the `node` environment — which has no `window`/`ErrorEvent`.
- **Fix:** Reworded the comment to describe the same guidance without spelling out the literal directive string.
- **Files modified:** `src/state/simulationService.test.ts`
- **Verification:** `environment` timing in the vitest reporter returned to ~870-900ms (real jsdom boot) and `ErrorEvent`/`MessageEvent` construction succeeded.
- **Committed in:** `998b286` (Task 1 commit)

**3. [Rule 1 - Bug] Explanatory comments matched the plan's own grep-based acceptance criteria**
- **Found during:** Task 2 (`OddsTable.tsx`) and Task 3 (`src/test/setup.ts`) verification steps
- **Issue:** A comment in `OddsTable.tsx` explaining the D-02 leak guard contained the literal substring `runout.board`, and a comment in `setup.ts` explaining the `matchMedia` fix contained the literal substring `query.includes(`. Both acceptance criteria in the plan check for the ABSENCE of these exact substrings anywhere in the file (`grep -c` / `grep -q`), so the explanatory comments themselves would have failed the plan's own verification gate.
- **Fix:** Reworded both comments to describe the same behavior in prose without reproducing the literal matched substrings.
- **Files modified:** `src/ui/OddsTable.tsx`, `src/test/setup.ts`
- **Verification:** `grep -c "runout.board" src/ui/OddsTable.tsx` and `grep -n "query.includes(" src/test/setup.ts` both return no matches.
- **Committed in:** `44142ed` (Task 2), `c3b8352` (Task 3)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in the test/verification setup itself, not in shipped behavior)
**Impact on plan:** All three were caught before any task commit landed (RED/GREEN discipline for Tasks 1-2, and re-running acceptance greps for Task 3) — no shipped behavior was affected, no scope creep.

## Issues Encountered

None beyond the three auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All eight scoped `IMPROVEMENTS.md` items (1, 2, both Tier 1b bullets, 13-16) are implemented and marked done; `src/engine/*` and `src/worker/*` are untouched as required.
- Full gate green: `npx vitest run` reports 216/216 passing (208 pre-existing + 3 WR-02 regression tests + 5 `lockedInCategory` tests), `npx tsc -b --force`, `npx eslint .`, and `npm run build` all exit 0.
- `npm run dev` was smoke-tested (HTTP 200, no console-visible boot errors) and cleanly terminated before returning.
- Remaining open `IMPROVEMENTS.md` items (3: retroactive security gate; 4-12, 17) are untouched and available for future `/gsd:quick` passes or the next milestone.

## Self-Check: PASSED

All created files verified present on disk (`src/state/simulationService.test.ts`, `src/ui/node-builtins.d.ts`, `src/ui/formatPct.ts`, `src/ui/lockedCategory.ts`, `src/ui/lockedCategory.test.ts`, this SUMMARY.md). All 4 commit hashes (`998b286`, `44142ed`, `c3b8352`, `24e7253`) verified present in `git log --oneline --all`.

---
*Phase: quick/260824-biv*
*Completed: 2026-08-24*
