---
phase: 07-2-deck-holdem-evaluation
plan: 06
subsystem: ui
tags: [holdem, two-deck, five-of-a-kind, odds-table, category-labels, locked-in, dom-absence]

# Dependency graph
requires:
  - phase: 07-2-deck-holdem-evaluation
    plan: 01
    provides: evaluateHandTwoDeck / ExtendedStrength (src/engine/evaluatorTwoDeck.ts)
  - phase: 07-2-deck-holdem-evaluation
    plan: 02
    provides: deckCount field in useGameStore (D-14)
  - phase: 07-2-deck-holdem-evaluation
    plan: 03
    provides: FIVE_OF_A_KIND_INDEX / categoryCountFor (src/worker/protocol.ts), 11-length 2-deck snapshots
provides:
  - CATEGORY_LABELS_TWO_DECK derived 11-entry row source (src/ui/categoryLabels.ts)
  - deckCount-aware lockedInCategory returning ExtendedStrength | null (src/ui/lockedCategory.ts)
  - Conditional Five of a Kind row (last tbody row, 2-deck only) with category-five-of-a-kind / category-pct-10 / category-locked-10 testids (src/ui/OddsTable.tsx)
affects: [07 phase verification, phase 8 cross-game toggle absorption]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived label constant: the 11-row source spreads the shipped 10-entry constant and appends one label — never a second hand-written list (blackjackProtocol BUCKET_INDEX discipline)"
    - "Conditional row-level testid by index: undefined attribute on every shipped row keeps 1-deck DOM byte-identical; only the appended index-10 row carries one"
    - "Default-parameter deck routing: deckCount: DeckCount = 1 keeps every shipped caller and its frozen test suite untouched (conditioning.ts convention)"

key-files:
  created:
    - src/ui/lockedCategoryTwoDeck.test.ts
    - src/ui/OddsTableTwoDeck.test.tsx
  modified:
    - src/ui/categoryLabels.ts
    - src/ui/lockedCategory.ts
    - src/ui/OddsTable.tsx

key-decisions:
  - "Row injection shipped as a deckCount-selected label source (labels = deckCount === 2 ? CATEGORY_LABELS_TWO_DECK : CATEGORY_LABELS) mapped by the existing row renderer — zero structural change to the shipped rows"
  - "The categoryLabels.ts doc comment deliberately avoids the literal row-label string so `git grep \"Five of a Kind\"` finds exactly one occurrence: the derived constant itself"
  - "lockedInCategory keeps a single return expression (ternary over the two engine wrappers) — the file remains free of any direct library import in both branches"

patterns-established:
  - "DOM-absence pinned both ways in a dedicated sibling suite: one describe block per deck count so a failure names which half of the isolation contract broke"

requirements-completed: [HE2-02]

# Metrics
duration: 7min
completed: 2026-08-25
---

# Phase 7 Plan 06: Five of a Kind Row + Derived Label Source + lockedInCategory Routing Summary

**Five of a Kind renders as a live 11th row at the strength end of the 2-deck category table (with a working locked-in tick at index 10), sourced from a derived constant that can never drift from the frozen 10-entry original, while the last main-thread evaluator call site now routes duplicate-capable visible cards through the duplicate-aware wrapper**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-08-25T02:26:40Z (base `0eff3a7`, verified before any work)
- **Completed:** 2026-08-25T02:33:30Z
- **Tasks:** 2 (both TDD, RED verified failing before GREEN, one atomic commit per task)
- **Files modified:** 5 (2 new test files, 3 planned edits) — exactly the plan's `files_modified` list

## Task Commits

1. **Task 1: Derived 11-row label source and deck-count-aware lockedInCategory routing** — `7c47951` (feat)
   - RED: 3 failing (missing `CATEGORY_LABELS_TWO_DECK`; the stock evaluator throwing from `lockedCategory.ts` on the duplicate five-of-a-kind river window)
2. **Task 2: Conditional Five of a Kind row and the deckCount-aware lockedIndex memo** — `efe49bc` (feat)
   - RED: 7 failing (the entire 2-deck presence half, including the un-routed memo crashing on duplicate visible cards)

## Row-Injection Mechanism As Shipped

`OddsTable` selects the row source once per render — `const labels = deckCount === 2 ? CATEGORY_LABELS_TWO_DECK : CATEGORY_LABELS;` — and maps over that source. The row-level testid is applied conditionally by index: `data-testid={index === FIVE_OF_A_KIND_INDEX ? 'category-five-of-a-kind' : undefined}`, so React omits the attribute on all ten shipped rows and their `<tr>` markup stays byte-identical. The lines 45-46 contract comment survives with its original reasoning, retargeted to "the LABEL SOURCE": rows are never derived from `categoryCounts.length`, so a malformed or short snapshot cannot shrink the table. The index-10 cells inherit `category-pct-10`/`category-locked-10` from the shipped index-derived cell testids for free; `key={label}` stays unique. Caption, subtitle, `<thead>`, and `formatPct` are byte-unmodified (A10).

## Final lockedInCategory Signature

```typescript
// src/ui/lockedCategory.ts
export function lockedInCategory(
  heroHole: readonly [Card, Card] | null,
  knownBoard: readonly Card[],
  deckCount: DeckCount = 1,
): ExtendedStrength | null;
```

At `deckCount === 2` the single evaluation routes through `evaluateHandTwoDeck`; otherwise through the stock `evaluateHand` — both via engine wrappers, keeping the file free of any `@poker-apprentice/hand-evaluator` import (grep-verified: zero occurrences). The `MIN_EVALUABLE_CARDS` guard and leak-proof framing are preserved exactly. The wrapper's extended return of 10 makes the odds table's tick work on the appended row with no further change (`lockedIndex === index` matches index 10).

## Frozen-Surface Confirmation

- `CATEGORY_LABELS` array literal: byte-unmodified, still exactly 10 entries (the derived constant was appended below it); an explicit test now asserts its length so a future widening fails loudly in the sibling suite, not the frozen one
- `src/ui/lockedCategory.test.ts`: byte-unmodified (`git diff --stat 0eff3a7` shows no entry) and green
- `src/App.test.tsx`: byte-unmodified and green (line 132's `expect(rowLabels).toEqual([...CATEGORY_LABELS])` passes — the 1-deck render still produces exactly the shipped ten rows)
- Both goldens, the other four frozen v1 App suites, `simulationApi.test.ts`: no diff vs base, all green
- `git grep -n "Five of a Kind" -- src/ui/categoryLabels.ts`: exactly one occurrence, inside the derived constant
- Guard suites (`shoePath.guard.test.ts` + `App.modeShell.guard.test.ts`): 87/87 green — `lockedCategory.ts` stays inside the `evaluateHand(` call-site allowlist, `evaluator.ts` stays the sole library importer

## Exact DOM-Absence Assertions Used At One Deck

From `src/ui/OddsTableTwoDeck.test.tsx`, deckCount-1 describe block:

- `expect(screen.queryByTestId('category-five-of-a-kind')).toBeNull()`
- `expect(screen.queryByTestId('category-pct-10')).toBeNull()`
- `expect(screen.queryByTestId('category-locked-10')).toBeNull()`
- `expect(rows).toHaveLength(10)` on `tbody tr` plus `expect(rowLabels).toEqual([...CATEGORY_LABELS])` with Royal Flush last
- `expect(row.hasAttribute('data-testid')).toBe(false)` for every `<tbody>` row (no hidden/conditional row-level attribute anywhere)
- `expect(screen.queryByTestId('category-locked-10')).toBeNull()` re-asserted with a locked-category fixture on the table (tick lands on `category-locked-1`, nothing above index 9 exists)
- Caption + subtitle asserted verbatim (`'Final hand by the riverEach row is the hand you end up with — the rows are exclusive and add up to 100%.'`) in BOTH deck modes

The presence half mirrors each of these at deckCount 2 (11 rows, Royal Flush → Five of a Kind as the last two, testid on the last row only, tick on `category-locked-10` for a visible five-of-a-kind with all ten other locked cells empty, pending em-dash short-circuit unchanged, and the 10-entry-snapshot-at-2-decks moment rendering `0.0%` via the shipped `?? 0` read).

## Verification Results

- `npx vitest run`: **61 files / 841 tests, 0 failures, 0 skipped** — vs the wave-2 baseline of 59 / 817 (**+2 files, +24 tests**: lockedCategoryTwoDeck +11, OddsTableTwoDeck +13; count strictly increased)
- `npx tsc --noEmit`: clean; `npm run lint` / `npx eslint .`: clean, zero new inline eslint-disable comments (grep over the diff: 0)
- `npm run build`: exit 0
- `git diff --stat 0eff3a7..HEAD` lists exactly the five `files_modified` paths (plus this SUMMARY)
- No file deletions in either commit; no untracked files left behind

## Deviations from Plan

None - plan executed exactly as written. (Both TDD tasks were executed RED→GREEN with a single atomic commit per task, matching the wave-1/wave-2 executor precedent and the plan's one-commit-message-per-task instruction.)

## Known Stubs

None — the row is live end-to-end: plan 07-03's 11-length snapshots flow through the shipped `categoryCounts[index] ?? 0` read into `formatPct`, and the tick flows from the wrapper-routed `lockedInCategory`. No placeholder values, no unwired data paths.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes beyond the plan's own threat model (T-07-30..T-07-34 all implemented as specified; zero package installs, `npm ci` from the committed lockfile only).

## User Setup Required

None.

## Next Plan Readiness

- The phase's visible payoff is wired: once plan 07-05's toggle sets `deckCount: 2` and deals, the table renders the eleventh row with a live converging percentage — no further UI plumbing needed in this file
- `OddsTable` now subscribes to `state.deckCount`; any future test rendering it must reset `useGameStore` (the new sibling suite's `beforeEach` shows the shape)

## Self-Check: PASSED

- All 5 source/test files + this SUMMARY exist on disk
- Commits `7c47951`, `efe49bc` present on `worktree-agent-a185707b0c151e73f` atop base `0eff3a7`

---
*Phase: 07-2-deck-holdem-evaluation*
*Completed: 2026-08-25*
