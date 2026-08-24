---
phase: 06-blackjack-core-odds-loop
plan: 04
subsystem: state
tags: [typescript, vitest, zustand, blackjack, animation-gate]
status: complete

# Dependency graph
requires:
  - phase: 06-blackjack-core-odds-loop
    plan: 01
    provides: "liveShoeLedger/resolveNaturals dual-exclusion-set readers, handTotal/playDealerHand/classifyDealerOutcome/compareToDealer rules engine, blackjackProtocol wire types (DEALER_BUCKET_COUNT, BlackjackProgressSnapshot)"
  - phase: 04-multiset-deck-streaming-foundation
    provides: "shoeWithout/cardCounts count-aware shoe primitives, createRng/drawN unseeded live draws"
provides:
  - src/state/blackjackStore.ts — useBlackjackStore round lifecycle (deal/hit/stand/revealHole/setDeckCount), BlackjackRoundPhase, blackjack-local deckCount, roundNonce identity counter
  - src/state/blackjackOddsStore.ts — useBlackjackOddsStore live display fields + settledCache, blackjackKnowledgeKey, displayedDeckCount A3 snapshot field
  - src/state/gameModeStore.ts — blackjackRestorePending + ackBlackjackRestore, symmetric to the holdem direction
affects: [06-05, 06-06, 06-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Balanced gate accounting: deal() arms unconditionally (roundNonce always changes, so the release effect always has a matching unit); hit/stand/revealHole arm only when state actually changed; setDeckCount never arms"
    - "deal() zeroes the live odds display unconditionally — the only action that can leave a round with no run started (a natural) is the deal itself, so the deal owns reaching A16's zero-trials state"
    - "A3 phase-gated toggle: clearCache() unconditional; reset() + setDisplayedDeckCount() gated on roundPhase === 'player-turn' so resolved/idle retained numbers and their subtitle survive byte-identical"
    - "Every live draw flows through liveShoeLedger; the store never calls the odds-conditioning reader (that reader belongs to the odds effect, plan 06-07)"

key-files:
  created:
    - src/state/blackjackStore.ts
    - src/state/blackjackStore.test.ts
    - src/state/blackjackOddsStore.ts
    - src/state/blackjackOddsStore.test.ts
  modified:
    - src/state/gameModeStore.ts
    - src/state/gameModeStore.test.ts

key-decisions:
  - "stand() draw strategy: shuffle the ENTIRE remaining live ledger once (one without-replacement drawN over the full pool) and thread playDealerHand's drawNext through a cursor over that single pre-drawn slice — chosen over per-draw ledger re-derivation because one shuffle makes the count-aware no-duplicate property hold by construction and the dealer can never outdraw the pool it came from"
  - "setDeckCount with the already-selected value is a FULL early return (no cache clear, no state write, no arm) — the A3/A4 'clicking the active segment is a harmless no-op' precedent; clearing the cache on a no-op click would force a spurious re-run on the next lookup"
  - "hit()'s bust path resolves (roundPhase/outcome/revealedHole) in the SAME set() as the card append — one commit, one release, so the gate ledger stays balanced"
  - "The gameModeStore deck-count comment is worded 'deck count' (two words), never the literal camelCase token — see Deviations"

patterns-established:
  - "Blackjack store actions cite D-NN tags, 05-REVIEW CR-02 and 06-RESEARCH Pattern 1 inline at the code they justify, mirroring the Hold'em stores' doc-comment style"
  - "blackjackKnowledgeKey documents in-code why deckCount is NOT a key dimension (setDeckCount clears the cache instead — the BJ-07 findability mechanism)"

requirements-completed: [BJ-02, BJ-05, BJ-06, BJ-07]

# Metrics
duration: 15min
completed: 2026-08-24
---

# Phase 6 Plan 04: Blackjack Stores & Restore Signal Summary

**Blackjack's round-lifecycle store (single-shuffle deal with all four natural paths, live-ledger hit/stand, one-way reveal, A3-semantics deck toggle) and its own streamed-odds cache store with a blackjack-shaped knowledge key, plus the symmetric blackjackRestorePending mount signal — pinned by 51 new tests including a scripted arm-count invariant and a byte-identical-retention toggle test.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-24T22:00Z (base-commit verification + npm ci in fresh worktree)
- **Completed:** 2026-08-24T22:15Z (final verification)
- **Tasks:** 3 (all RED→GREEN verified in-session before each commit)
- **Files modified:** 6 (4 created, 2 modified — `gameModeStore.ts`/`.test.ts` additions only, 1216 insertions, 0 deletions)

## Accomplishments

- `deal()` draws all four initial cards from ONE `drawN` call (spy-asserted single call, n=4, pairwise distinct at deckCount=1) and resolves naturals at deal for all four paths: neither (player-turn), player-only (win, `playerNaturalWin`, hole revealed), dealer-only (immediate loss, D-03a), both (push).
- `deal()` arms exactly one gate unit UNCONDITIONALLY — including on the natural path, where the four cards still fly in and the release effect fires on the `roundNonce` change regardless (05-REVIEW CR-02's failure class, designed out from the first commit).
- `deal()` zeroes the live odds display unconditionally: the seeded-settled-state → natural-deal → zeroed-display sequence is asserted (trials 0, all seven buckets 0, both outcome objects zeroed, `done` false, cache empty) — a natural round starts no run, so nothing downstream would ever reach A16's zero-trials state without this.
- Every live draw goes through `liveShoeLedger`: the hit-pool argument is spy-asserted equal to the ledger (hole absent), and the T-06-18 trap test proves that with all 51 non-hole cards on the table the ledger is EMPTY — the pool never contains "the hole card" — reinforced by a 10-iteration single-legal-card behavioral loop.
- `setDeckCount` implements the full A3 matrix: player-turn toggle clears cache + zeroes display + moves `displayedDeckCount`; resolved/idle toggle leaves every live display field REFERENCE-identical and the subtitle field untouched while still emptying the cache (BJ-07's next-deal freshness guarantee); same-value click is a total no-op; no path ever arms the gate.
- `blackjackOddsStore` carries the reset/clearCache split, copy-on-write Map caching, and a report-only dev consistency guard tuned to blackjack tallies (7-bucket length, three sum reconciliations, `bustIfHitCount <= trialsCompleted`) that deliberately does NOT relate `bustIfHitCount` to `hitOutcomes.lose` — asserted in both directions (fires on malformed shapes AND still applies state; never fires on the legal bust>lose shape).
- `gameModeStore` gained the symmetric `blackjackRestorePending` computed inside the SAME `setMode` `set` callback (exactly one `set((state) =>` in `setMode`), with the A5 no-op click clearing BOTH flags and `ackBlackjackRestore` idempotent — the mode-shell guard's token sweep is green untouched.
- Full regression bar: 44 test files / 510 tests pass, 0 skipped (baseline 42 / 459; +2 files / +51 tests, all additive, no pre-existing test modified), `npx tsc --noEmit` clean, `npx eslint .` clean, `npm run build` exit 0.

## Arm-Count Invariant Record (D-13, T-06-19)

- **Scripted sequence:** deal (mocked `['2h','3d','7s','9c']`) → hit (`2c`) → hit (`3h`) → revealHole → stand (real shuffle; dealer 16 must draw).
- **Measured:** 5 `beginAnimation()` calls (spy) and 5 simulated release firings (prevRef-style tuple over `roundNonce` / `playerHand.length` / `roundPhase` / `revealedHole` changed on exactly 5 of 5 commits) — `pendingAnimationCount − releases === 0`, balanced by construction.
- Every no-op path (hit/stand/reveal outside player-turn, double reveal, same-value toggle, any toggle) is separately asserted to arm nothing.

## stand() Draw Strategy (recorded per the plan's output spec)

**Chosen: cursor over one pre-drawn pool slice, where the slice is the ENTIRE shuffled ledger** — `drawN(createRng(), ledger, ledger.length)` once, then `playDealerHand`'s `drawNext` walks a cursor over it. Why over per-draw ledger re-derivation: a single without-replacement shuffle makes "no card drawn twice" true by construction (no state to re-thread between draws), the dealer can never exhaust a pool it is a prefix-consumer of, and the cost is trivial (≤104 swaps once per Stand). The count-aware no-duplicate property is asserted over 15 full rounds at each deck count via `cardCounts` (never a Set), per the plan's shape-independent instruction.

## Task Commits

Each task was committed atomically (RED verified in-session before implementation, GREEN before commit):

1. **Task 1: blackjackOddsStore — streamed tallies, own key, own consistency guard** — `e799c28` (feat) — 21 tests
2. **Task 2: blackjackStore — round lifecycle with balanced gate accounting** — `a6a19d9` (feat) — 24 tests
3. **Task 3: Symmetric blackjackRestorePending on the only cross-game store** — `2efbad8` (feat) — 6 tests added, 9 pre-existing pass unedited

## Files Created/Modified

- `src/state/blackjackOddsStore.ts` — live display fields, settledCache, `blackjackKnowledgeKey` (`${playerHandLength}|${revealedHole ? 1 : 0}`), `displayedDeckCount`; contains zero occurrences of the poker key function, the poker stores, or any poker field token
- `src/state/blackjackOddsStore.test.ts` — key-shape/no-collision, reset-vs-clearCache split, copy-on-write, guard report-only cases, displayedDeckCount isolation
- `src/state/blackjackStore.ts` — deal/hit/stand/revealHole/setDeckCount; exactly one `drawN(` inside `deal()`; contains `liveShoeLedger(` and never the odds-conditioning reader
- `src/state/blackjackStore.test.ts` — natural paths, ledger-sourced draws, hole-unreachability trap, full-round shoe integrity at both deck counts, A3 toggle matrix, gate-balance invariant
- `src/state/gameModeStore.ts` — `blackjackRestorePending` + `ackBlackjackRestore`, additions only
- `src/state/gameModeStore.test.ts` — new describe block appended; `git diff` shows 55 insertions, 0 deletions (no pre-existing case touched)

## Decisions Made

- Full-ledger single-shuffle cursor for `stand()` (see above).
- Same-value `setDeckCount` is a total early return — no cache clear — so the A3 "harmless no-op" click can never force a spurious re-run.
- `playerNaturalWin` is computed as `playerNatural && !dealerNatural` (push on double natural is not the 3:2 banner path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 3's comment-wording instruction would have broken the mode-shell guard**
- **Found during:** Task 3 (read of `App.modeShell.guard.test.ts` before implementing)
- **Issue:** The plan said the deck-count comment could contain the literal camelCase token because "the guard strips full-line comments before its count" — but the guard's separate raw-source sweep (`No deckCount anywhere in the Phase 5 mode-shell files`, lines 202-213) checks the UNSTRIPPED source of `gameModeStore.ts`; the literal token even in a comment line would have flipped that assertion, and stripping comments ahead of an absence check would weaken the guard against its own documented discipline ("never ahead of substring-presence/absence assertions").
- **Fix:** Worded the comment as "the blackjack-local deck count does NOT belong in this file — it lives in blackjackStore per D-10" (two words, no camelCase token). The plan's intent (in-file documentation of where the field lives) is fully preserved; the guard is untouched and green.
- **Files modified:** `src/state/gameModeStore.ts`
- **Commit:** `2efbad8`

No other deviations — every behavior, acceptance criterion and source-shape pin executed as written.

## Issues Encountered

- `vi.spyOn` returns the SAME spy when the target method is already spied, so the per-test arm spy accumulated calls across tests on first run; fixed in-task with a `mockClear()` in the harness (test-authoring detail, no production impact).
- No auth gates, no package installs (zero, per T-06-SC — `npm ci` from the committed lockfile only).

## User Setup Required

None.

## Next Phase Readiness

- Plan 06-05/06-06 can compile against `useBlackjackStore` (`BlackjackRoundPhase`, `roundNonce`, `revealedHole`, `dealerPlayoutCards`) and `useBlackjackOddsStore` (`blackjackKnowledgeKey`, `displayedDeckCount`, the live tally fields) exactly as frozen in the plan's interface block.
- Plan 06-07's odds effect owns the only call site of `deriveBlackjackConditionedState` — this store deliberately never imports it (source-absence asserted).
- `BlackjackTable`'s release effect (06-05) must track `roundNonce` / `playerHand.length` / `roundPhase` / `revealedHole` — the invariant test here guarantees every armed unit changes at least one of those in the same commit.
- Do-not-touch files verified untouched: `git diff --stat a79c80f..HEAD` lists exactly the 6 plan files; nothing under `src/ui/`, `src/engine/`, `src/worker/`; golden/parity suites ran green in the full-suite gate.

## Known Stubs

None — all actions are fully implemented and wired; no placeholder values, no TODO/FIXME markers.

## Threat Flags

None — no new security-relevant surface beyond the plan's threat model. T-06-18/19/20/21/22/50/23 mitigations all landed as asserted tests or source-absence pins; T-06-SC honored (zero installs).

## Self-Check: PASSED

- All 4 created and 2 modified files verified present on disk with the committed content.
- All 3 task commits (`e799c28`, `a6a19d9`, `2efbad8`) verified in `git log` atop base `a79c80f`.
- Full suite 44 files / 510 tests green, 0 skipped; `npx tsc --noEmit` clean; `npx eslint .` clean; `npm run build` exit 0.
- Working tree clean; no untracked files; `gameModeStore.test.ts` diff is additions-only (55/0).
