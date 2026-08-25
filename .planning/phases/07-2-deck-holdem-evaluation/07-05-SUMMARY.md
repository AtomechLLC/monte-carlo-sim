---
phase: 07-2-deck-holdem-evaluation
plan: 05
subsystem: ui
tags: [typescript, react, vitest, testing-library, holdem, deck-toggle, css, guard-tests]
status: complete

# Dependency graph
requires:
  - phase: 07-2-deck-holdem-evaluation
    plan: 02
    provides: "gameStore.deckCount/setDeckCount (full D-02 lifecycle + A4 store refusal) and pickerStore.hasDuplicatePick — consumed UNMODIFIED"
  - phase: 07-2-deck-holdem-evaluation
    plan: 03
    provides: "grow-on-merge 11-length snapshots + length-tolerant oddsStore dev guard + end-to-end 2-deck worker acceptance — consumed UNMODIFIED"
  - phase: 07-2-deck-holdem-evaluation
    plan: 04
    provides: ".copy-cue / .card-slot--cued emitted class-name contract (unstyled until this plan) — styled here, source untouched"
provides:
  - src/ui/HoldemGame.tsx — the D-01 deck toggle (last control-bar child), A3/A4 title affordances, deckCount-aware odds effect
  - src/App.css — every Phase 7 style; four segmented-control selector-list extensions, the disabled-dimming extension, the .copy-cue/.card-slot--cued block
  - src/App.modeShell.guard.test.ts — retargeted deckCount sweep (shell files only) + the D-11 style-contract source pins
  - src/test/holdemTestids.ts — the three toggle testids
  - src/App.holdemDeckToggle.test.tsx — the D-03 cache guard (both directions) + the full D-02/A2/A3/A4 behavioral suite
affects: [07-07, phase-8 cross-game toggle absorption]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same-commit guard retarget (Phase 6 lesson made checkable): the toggle, the modeShell deckCount-sweep amendment and the testid-list extension landed in ONE commit, guard verified green AT that commit by checkout"
    - "Style contract pinned at source level: each shared CSS rule must contain BOTH games' selectors in one selector list — a duplicated rule block fails the guard before it can diverge the two games' appearance (D-11)"
    - "Snapshot-fixture length follows the run's deck count (10 at one deck, 11 at two) — the asymmetry IS the 07-03 grow-on-merge contract, commented in the harness"

key-files:
  created:
    - src/App.holdemDeckToggle.test.tsx
  modified:
    - src/ui/HoldemGame.tsx
    - src/App.modeShell.guard.test.ts
    - src/test/holdemTestids.ts
    - src/App.css

key-decisions:
  - "A4 disabled expression is `hasDuplicatePick(picks)` alone (no deckCount clause): structurally one-directional — at deckCount 1 the count-aware setPick blocks a second copy and the store refuses a duplicated 2->1 switch, so the boolean is false whenever the segment is active; the active segment is never disabled by construction (commented in-place)"
  - "Title precedence AS SHIPPED: on holdem-deck-toggle-1, A4 guard title > A3 fresh-deal title > none; holdem-deck-toggle-2 carries only the A3 title (inactive + mid-hand). Ternary order in JSX is the precedence."
  - "Style-contract guard uses `}`-split rule chunks: two selectors in the SAME chunk proves one shared rule (extension), a second matching chunk fails the exactly-one assertion (duplication) — no CSS parser needed"
  - "Test suite's default mock reads conditioned.deckCount to size its settled snapshot (10 vs 11), so every toggle direction exercises the correct histogram shape without per-test fixture plumbing"

requirements-completed: [HE2-01, HE2-03]

# Metrics
duration: 18min
completed: 2026-08-25
---

# Phase 7 Plan 05: Hold'em Deck Toggle + Effect Wire + Guard Retarget + All Phase 7 CSS + D-03 Cache Guard Summary

**2-deck Hold'em is now reachable from the UI: a Hold'em-local segmented deck toggle (last control-bar child, shipped pattern verbatim, zero accent) with the D-02 fresh-deal lifecycle and both honesty affordances, the odds effect conditioning on the live deckCount, the modeShell guard that forbade all of it retargeted in the same commit, every Phase 7 style landed as additive selector-list extensions plus the one copy-cue block, and a D-03 suite pinning in both directions that a deck toggle always passes through deal()'s cache clear.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-25T02:28:27Z (base `0eff3a7` verified, npm ci in fresh worktree)
- **Completed:** 2026-08-25T02:46Z (final full-suite + tsc + eslint + build gates)
- **Tasks:** 3 (three atomic commits)
- **Files modified:** 5 (1 created, 4 modified — exactly the plan's files_modified list)

## Task Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `b29b0c4` | feat(07-05): Hold'em-local deck toggle with D-02 fresh-deal semantics, deckCount-aware odds effect, and the same-commit modeShell guard retarget (D-01/D-02/D-12, HE2-01) |
| 2 | `e5e3baf` | feat(07-05): Phase 7 styles — deck-toggle selector-list extensions and the copy-cue badge block (D-01/D-08/A5/A6/A12, HE2-03) |
| 3 | `1adef5e` | test(07-05): D-03 deck-toggle cache guard plus the App-level D-02 lifecycle and A2/A3/A4 affordance suite (D-02/D-03, HE2-01) |

## The Same-Commit Guard Retarget (T-07-25 evidence)

- **The commit that carries the toggle AND the guard retarget AND the testid extension together: `b29b0c4`** (exactly three files: `src/ui/HoldemGame.tsx`, `src/App.modeShell.guard.test.ts`, `src/test/holdemTestids.ts`).
- **Guard green AT that commit, verified by checkout:** `git checkout b29b0c4` → `npx vitest run src/App.modeShell.guard.test.ts` → 65/65 passed. Also verified at `e5e3baf` (71/71 — the +6 style-contract pins) and at `1adef5e` (71/71). Zero red-suite commits in the range.
- **RED evidence before the retarget:** with the toggle added to HoldemGame.tsx but the sweep not yet amended, the guard failed exactly as designed (1 failed / 65 passed — the deckCount sweep firing on `ui/HoldemGame.tsx`).
- The sweep now lists exactly `App.tsx`, `state/gameModeStore.ts`, `ui/GameModeSwitcher.tsx`; its describe title, block comment and assertion message cite D-01, D-12 and D-14; a dated `AMENDED 2026-08-25 (Phase 7 plan 07-05, D-01/D-12)` record joined the two existing header examples. Retargeted, never deleted or weakened.
- The unrelated "05-REVIEW WR-03" comments in `App.tsx` line 7 and `HoldemGame.tsx` (identifier collision, a Phase 5 finding) are byte-untouched — the HoldemGame line appears in the diff only as an unchanged context line.

## Final Control-Bar Child Order (A2)

`GameModeSwitcher` → `DealButton` → `set-up-scenario-button` → `StreetControls` → **`holdem-deck-toggle` (last child)** — pinned by the suite's A2 test (`controlBar.lastElementChild` identity).

## A3/A4 Title Precedence As Shipped

- **`holdem-deck-toggle-1`:** `duplicateInPicks ? DUPLICATE_PICK_GUARD_TITLE : (deckCount === 2 && runout !== null ? FRESH_DEAL_TITLE : undefined)` — the A4 guard title takes precedence over the A3 fresh-deal title when both would apply (commented in-place).
- **`holdem-deck-toggle-2`:** `deckCount === 1 && runout !== null ? FRESH_DEAL_TITLE : undefined` — A3 only.
- Locked strings verbatim: `Switching the shoe deals a fresh hand` (A3) and `Your picked cards include a duplicate — impossible with one deck` (A4). No title on either segment while idle; never a title on the active segment; no confirmation dialog anywhere.
- A4 disabled state: `disabled={hasDuplicatePick(picks)}` — structurally one-directional (false whenever the segment is active), never clears a pick, `holdem-deck-toggle-2` unaffected.

## Effect Wire

- `deriveConditionedState(runout, street, revealedMask, deckCount)` — the conditioned payload carries the live deck count (suite reads `startSimulation`'s first argument: `deckCount: 2`, 102-card `remainingDeck`, empty `knownBoard`, all-null `knownOpponentHoles` at preflop).
- Dependency array: `[runout, street, revealedMask, dealNonce, deckCount, pendingAnimationCount, mode]` — `deckCount` inserted immediately before `pendingAnimationCount`, the guard-pinned `pendingAnimationCount, mode]` tail intact, with the belt-and-braces rationale commented.
- Exactly ONE `cancelSimulation(` call site (guard-pinned count unchanged); the literal `if (mode !== 'holdem') return;` survives as the effect's first check; zero gate-reset calls added.

## CSS: Selector Lists Extended + The New Block

**Shared rules extended (selector-list extension only — no declaration line inside any pre-existing rule body deleted or modified, verified on the range diff):**
1. Segmented-control wrapper rule + `[data-testid='holdem-deck-toggle']`
2. Segment sizing/typography rule + `[data-testid^='holdem-deck-toggle-']`
3. Internal-divider rule + `[data-testid='holdem-deck-toggle-1']`
4. Active-segment rule + `[data-testid^='holdem-deck-toggle-'][aria-pressed='true']`
5. Disabled-dimming list + `[data-testid='holdem-deck-toggle-1']:disabled`

Both extended block comments record that Phase 7's toggle joins by the same logic Phase 6's did — one convention app-wide, zero new accent usage.

**New Hold'em-scoped block (the phase's ONE new block):** `.card-slot--cued { position: relative; }` (A12 — badge positioning survives Motion clearing its inline transform) and `.copy-cue` exactly per the interfaces treatment: xs insets/padding, Label size at the existing semibold, solid `var(--felt-dark)` fill (A6 — the translucent badge token composites to ~3.4:1 on a white card face, below AA; solid felt-dark is ~12:1) with `var(--seat-badge-text)`, badge-radius 12px, `pointer-events: none`. No new z-index token (source-order painting inside the slot's own stacking context, commented). Zero accent, zero destructive, zero new custom properties. Class names match 07-04's emitted contract exactly (`.copy-cue`, `.card-slot--cued`).

**Source-level style guard (additive modeShell describe, +6 tests):** pins each of the four shared rules containing BOTH games' selectors in one `}`-split rule chunk (exactly-one-chunk assertion catches duplication), the A4 segment in the shared dimming list, both copy-cue blocks existing, and the copy-cue chunk using only the felt/badge tokens with neither reserved colour token present.

## D-03 Cache Guard + Behavioral Suite (11 tests)

- **D-03, both directions, callIndex distinct-values trick:** 1→2 and 2→1 each assert a NEW `startSimulation` call, the FRESH run's distinct displayed value (never the settled prior value), the cache entry under the same `preflop|0` key holding the fresh value, and the fresh entry's histogram length matching the new deck count (11 vs 10).
- **D-02:** idle click (aria-pressed flip, dealNonce unchanged, no run), mid-hand click from a non-trivial state (flop + revealed opponent: dealNonce +1 exactly, preflop, mask 0, cache emptied to the fresh hand's single entry, new run), already-active click (whole-store reference identity, no run).
- **A2/A3/A4:** last-child placement + group semantics + exact labels; title matrix (idle none / inactive-only mid-hand / swap after switch); duplicate picks disable segment 1 with the guard title while segment 2 is untouched, picks reference-identical after an attempted blocked click, same-render re-enable on clearing the duplicate.
- **Payload + focus/keyboard:** conditioned first-argument assertions; keyboard activation; focus retained on the clicked segment across the fresh deal.
- **Negative control (run and reverted before commit):** temporarily severing `setDeckCount`'s `deal()` pass-through in gameStore.ts turned exactly the four toggle-through-deal tests red (both D-03 directions, the mid-hand lifecycle test, the focus-across-fresh-deal test); `git checkout -- src/state/gameStore.ts` restored it and the suite re-ran 11/11 green before the commit.
- Harness: explicit `vi.mock` factories for BOTH simulation services (jsdom-Worker rationale), internally-consistent fixtures (category and outcome sums equal `trialsCompleted` at both lengths), `resetStores()` extended with `deckCount: 1` and `clearAll()` with the leakage rationale commented, animation reset placed after the store resets.

## Frozen-Artifact Confirmation

- `git diff --stat 0eff3a7..HEAD` lists exactly the five planned files (plus this SUMMARY after its commit).
- `src/index.css`, both goldens (`deckParity.golden.test.ts`, `streamingParity.golden.test.ts`), `simulationApi.test.ts`, the five frozen v1 suites (`App.test.tsx`, `App.acceptance.test.tsx`, `App.phase3.acceptance.test.tsx`, `App.modeErrorBanner.test.tsx`, `App.modeSwitchRace.test.tsx`), `App.holdemCachePoison.test.tsx`, `App.modeIsolation.test.tsx`, `App.modeSwitch.test.tsx`, and every `blackjack*` file: byte-unmodified (range diff over the set is empty) and green in the final gate.
- `git grep -n "deckCount" -- src/App.tsx src/state/gameModeStore.ts src/ui/GameModeSwitcher.tsx` → empty.
- No engine, worker, or store file touched; no felt component touched; no OddsTable/categoryLabels/lockedCategory (plan 07-06's files) touched.

## Test-Count Delta

- **Baseline (wave-2 HEAD `0eff3a7`):** 59 files / 817 tests.
- **After:** 60 files / **839 tests**, 0 failed, 0 skipped (+1 file, +22 tests: +11 in the new suite, +6 modeShell style-contract pins, +3 each in the modeIsolation/modeSwitch sweeps via the shared testid list, −1 from the deckCount sweep list shrinking 4→3 files).
- `npx tsc --noEmit` clean; `npx eslint .` clean (zero eslint-disable in the range diff); `npm run build` exits 0.

## Deviations from Plan

**1. [Sequencing note] Task-level TDD RED took two non-standard forms**
- Task 1 (`tdd="true"`) names no test file of its own — its RED evidence is the modeShell guard itself firing on the toggle-without-retarget intermediate state (1 failed / 65 passed), captured before the same-commit amendment turned it green. Task 3 (`tdd="true"`) necessarily post-dates the feature (plan task order), so its RED evidence is the reverted negative control described above. No content deviation; all three commits are atomic per task as mandated.

No other deviations — the plan executed as written.

## Known Stubs

None. The toggle, the effect wire, the styles and the guard suite are all live end-to-end; no placeholder values or unwired paths. (Plan 07-06 — running in this same wave, merged before this plan per the frontmatter orchestrator note — owns the Five of a Kind row and the lockedCategory duplicate-aware routing; nothing here waits on a stub for that.)

## Threat Flags

None. No new surface beyond the plan's threat model: T-07-24 (D-03 both-direction guard shipped), T-07-25 (same-commit discipline + per-commit checkout evidence above), T-07-26 (single-cancellation pin unchanged and re-run), T-07-27 (disabled segment + store refusal, no pick ever cleared), T-07-28 (selector-list extension + source-level style guard + range-diff criterion), T-07-29 (three shell files keep the sweep with the retargeted rationale). Zero package installs (T-07-SC: `npm ci` from the committed lockfile only).

## Self-Check: PASSED

- All five files exist on disk and match the range-diff scope exactly.
- All three task commits present in `git log 0eff3a7..HEAD`: b29b0c4, e5e3baf, 1adef5e.
- Full suite 839/839 green (0 skipped); tsc, eslint, build all clean; guard suite verified green at every commit in the range by checkout.

---
*Phase: 07-2-deck-holdem-evaluation*
*Completed: 2026-08-25*
