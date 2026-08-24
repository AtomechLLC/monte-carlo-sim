---
phase: 01-core-odds-loop
plan: 01
subsystem: infra
tags: [vite, react, typescript, zustand, vitest, pure-rand, poker-apprentice, testing-library]

# Dependency graph
requires: []
provides:
  - Vite + React 19 + TypeScript 6.0.3 (exact) project scaffold, building/linting/testing green
  - ESLint flat-config toolchain (not Oxlint)
  - Vitest configured with jsdom, globals, and jest-dom setup file
  - src/engine/cards.ts: FULL_DECK, OPPONENT_COUNT, CARDS_PER_TRIAL, deckWithout
  - src/engine/rng.ts: pure-rand-backed createRng/drawN/createDrawer (seedable, no Math.random, no sort-shuffle)
  - src/state/gameStore.ts: Zustand store (heroHole, dealNonce, deal()) — dealNonce doubles as future worker requestId
  - src/ui/DealButton.tsx and src/ui/HandDisplay.tsx — minimal unstyled UI wired to gameStore
  - tsconfig.app.json lib array includes WebWorker for plan 01-02's worker
affects: [01-core-odds-loop/01-02, 01-core-odds-loop/01-03, 01-core-odds-loop/01-04]

# Tech tracking
tech-stack:
  added: [react@19.2.8, vite@8.2.2, typescript@6.0.3, zustand@5.0.15, comlink@4.4.2, pure-rand@8.4.2, "@poker-apprentice/hand-evaluator@4.3.0", vitest@4.1.11, fast-check@4.9.0, "@fast-check/vitest@0.4.1", "@testing-library/react@16.3.2", "@testing-library/jest-dom@7.0.1", "@testing-library/user-event@14.6.6", jsdom@30.0.1]
  patterns:
    - "Scaffold-into-throwaway-subdirectory-then-merge to avoid create-vite's destructive --overwrite behavior in a non-empty repo root"
    - "pure-rand subpath imports only (no top-level '.' export) — generator/xoroshiro128plus, distribution/uniformInt, types/RandomGenerator"
    - "Partial Fisher-Yates shuffle for no-replacement card draws (never array.sort(() => Math.random() - 0.5))"
    - "dealNonce as a single counter serving both re-deal trigger and future worker requestId"

key-files:
  created:
    - package.json
    - vite.config.ts
    - tsconfig.app.json
    - src/App.test.tsx
    - src/engine/cards.ts
    - src/engine/rng.ts
    - src/state/gameStore.ts
    - src/ui/DealButton.tsx
    - src/ui/HandDisplay.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "Package legitimacy checkpoint (vitest [SUS] false-positive flag) resolved by human approval prior to execution; proceeded with all pinned installs as specified"
  - "package.json name changed from create-vite's scaffold default 'scaffold-tmp' to 'monte-carlo-poker-simulator' (Rule 1 — cosmetic metadata bug, not a plan file but package.json was already in files_modified)"

patterns-established:
  - "Pattern: pure engine code (src/engine/) has zero React/DOM imports, importable from both Vitest (node) and a future Web Worker"
  - "Pattern: TDD RED/GREEN commit pairing — test(...) commit adds a failing acceptance test before any implementation exists, feat(...) commit makes it pass unmodified"

requirements-completed: [DEAL-01]

# Metrics
duration: 8min
completed: 2026-08-24
---

# Phase 1 Plan 01: Project Scaffold & First Deal Summary

**Vite + React 19 + TypeScript 6.0.3 project scaffolded from scratch with a Zustand-backed Deal button that draws a fresh two-card hero hand via a seedable pure-rand shuffle, alongside three hidden opponent seats.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-24T03:44:00Z (approx.)
- **Completed:** 2026-08-24T03:50:19Z
- **Tasks:** 3 (1 human-approved checkpoint, 2 executed)
- **Files modified:** 21 created (Task 2) + 6 created/modified (Task 3)

## Accomplishments
- Package legitimacy checkpoint (Task 1) resolved by human approval — proceeded to install all pinned dependencies
- Scaffolded Vite + React + TypeScript into the repo root via the safe throwaway-subdirectory technique, preserving `.planning/` and `CLAUDE.md`
- Pinned the entire toolchain exactly as specified: TypeScript 6.0.3 (no `^`/`~`), ESLint (not Oxlint), Vitest with jsdom
- Wrote a RED acceptance test (`src/App.test.tsx`) before any implementation existed, confirmed it failed for the right reason
- Implemented the deck/RNG engine primitives, Zustand game store, and minimal UI to turn the RED test GREEN
- Clicking Deal now produces a fresh, uniformly-sampled two-card hero hand and renders three hidden opponent placeholders; re-clicking re-deals

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate (vitest flagged [SUS])** — human-approved via orchestrator prior to spawning this executor; no commit (no files written by this gate per plan spec)
2. **Task 2: Scaffold the project, pin the toolchain, and write the failing Deal test (RED)** — `66d0da6` (test)
3. **Task 3: Deal a random hand — engine deck primitives, game store, and minimal UI (GREEN)** — `6b5fcc4` (feat)

**Plan metadata:** committed separately after this summary (docs: complete plan)

## Files Created/Modified

**Task 2 (scaffold + RED test):**
- `package.json`, `package-lock.json` - Pinned dependency manifest (TypeScript 6.0.3 exact, ESLint not Oxlint, test script added)
- `vite.config.ts` - Vite config merged with Vitest block (jsdom, globals, setupFiles)
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` - Scaffolded TS project references; `tsconfig.app.json` lib array extended with `WebWorker`
- `eslint.config.js` - Flat ESLint config (scaffold default, `--eslint` flag used)
- `index.html`, `.gitignore`, `README.md`, `public/` - Scaffold boilerplate
- `src/main.tsx`, `src/App.css`, `src/index.css`, `src/assets/*` - Scaffold boilerplate (unstyled CSS left in place, unused after Task 3's App.tsx replacement)
- `src/test/setup.ts` - Imports `@testing-library/jest-dom/vitest` for DOM matchers
- `src/App.test.tsx` - RED acceptance test for the Deal happy path (button role/name, hero-hole/opponents testids)

**Task 3 (GREEN implementation):**
- `src/engine/cards.ts` - `FULL_DECK` (re-export of `ALL_CARDS`), `OPPONENT_COUNT=3`, `CARDS_PER_TRIAL=11`, `deckWithout()`
- `src/engine/rng.ts` - `createRng`, `drawN`, `createDrawer` wrapping `pure-rand`'s `xoroshiro128plus` + `uniformInt` via partial Fisher-Yates (subpath imports only, no `sort()`)
- `src/state/gameStore.ts` - Zustand store: `heroHole`, `dealNonce`, `deal()` action
- `src/ui/DealButton.tsx` - Presentational Deal button wired to `useGameStore`
- `src/ui/HandDisplay.tsx` - Renders `data-testid="hero-hole"` and `data-testid="opponents"` containers
- `src/App.tsx` - Replaced scaffolded counter/logo demo with `DealButton` + `HandDisplay`

## Decisions Made
- Resolved the Task 1 package-legitimacy checkpoint per explicit human approval passed down by the orchestrator ("Approved — proceed with installs"); `vitest`'s `[SUS]` flag from `slopcheck` was confirmed a name-similarity false positive in `01-RESEARCH.md` and required no further action beyond the human sign-off already obtained.
- Renamed `package.json`'s `name` field from the scaffold's literal `scaffold-tmp` to `monte-carlo-poker-simulator` — cosmetic correctness fix (Rule 1), `package.json` was already in this task's `files_modified` list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected scaffolded package.json name field**
- **Found during:** Task 2
- **Issue:** `create-vite` scaffolds `_scaffold_tmp` as the project directory name, which becomes the literal `"name": "scaffold-tmp"` in the generated `package.json` — an incorrect artifact of the throwaway-subdirectory scaffolding technique, not a real project name.
- **Fix:** Changed `package.json`'s `name` field to `monte-carlo-poker-simulator`.
- **Files modified:** `package.json`
- **Verification:** `npm run build` and `npm run lint` still exit 0 after the rename; no acceptance criteria reference the `name` field.
- **Committed in:** `66d0da6` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, cosmetic)
**Impact on plan:** No scope creep — a one-line metadata correction within an already-modified file.

## Issues Encountered
None — the plan's documented pitfalls (scaffold destructiveness, Oxlint default, TypeScript version drift, pure-rand subpath exports, `HandStrength` category count) were all pre-empted correctly by following the plan's `<action>` instructions exactly; no rediscovery was needed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/engine/`, `src/state/gameStore.ts`, and the `dealNonce` contract are established and ready for plan 01-02 (Web Worker + Comlink simulation service) to consume without modification.
- `tsconfig.app.json` already includes `WebWorker` in its `lib` array, so plan 01-02's worker file should type-check without needing a `tsconfig.worker.json` split (per the plan's documented fallback, only needed if `tsc -b` reports ambient-global conflicts).
- No blockers or concerns for the next plan.

## Self-Check: PASSED

Verified all created files exist and both commits are present in git history (see below).

---
*Phase: 01-core-odds-loop*
*Completed: 2026-08-24*
