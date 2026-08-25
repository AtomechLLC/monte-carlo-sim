---
phase: 08-cross-game-deck-toggle
plan: 01
subsystem: ui
tags: [typescript, react, vitest, deck-toggle, extraction, dom-golden, guard-tests]
status: complete

# Dependency graph
requires:
  - phase: 06-blackjack-core-odds-loop
    plan: 05
    provides: "BlackjackControls' inline deck toggle (A3/A4 locked semantics) — consumed as the blackjack extraction source"
  - phase: 07-2-deck-holdem-evaluation
    plan: 05
    provides: "HoldemGame's inline deck toggle (D-02 lifecycle, A3/A4 titles) — consumed as the Hold'em extraction source"
provides:
  - src/ui/DeckCountToggle.tsx — the ONE shared, props-driven deck-count segmented control (SC1); prop shape { testidPrefix, deckCount, onSelect, oneDeckDisabled?, oneDeckTitle?, twoDecksTitle? }
  - src/App.deckToggleDom.golden.test.tsx — the byte-frozen nine-state outerHTML contract, captured on the PRE-extraction tree (permanent D-06 drift detector)
  - src/ui/BlackjackControls.tsx — rewired onto the shared component; guard predicate + DUPLICATE_GUARD_TITLE stay at the call site
  - src/ui/HoldemGame.tsx — rewired onto the shared component; A4-beats-A3 precedence, both title constants and duplicateInPicks stay at the call site
  - src/App.modeShell.guard.test.ts — Phase 8 additive pins (resetAnimations sweep entry, store-free sweep, locked labels, SC1 source-identity + single-source-of-markup sweeps)
affects: [08-02, 08-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden-first extraction proof: the nine-state outerHTML golden was committed ALONE, green against the INLINE toggles, one commit BEFORE the extraction — so it pins what the old code did, not what the new code happens to do (T-08-08)"
    - "Pre-computed per-segment title props: guard-title precedence (A4 beats A3) and blackjack's never-a-title segment 2 never enter the shared component — the component owns only markup, two labels, role and aria-label (T-08-07)"
    - "Attribute-absence via omission: segment 2 carries NO disabled prop at all in the shared JSX (not disabled={false}); title={undefined} renders no attribute — the simplest byte-identical guarantee (PATTERNS trap 2)"

key-files:
  created:
    - src/App.deckToggleDom.golden.test.tsx
    - src/ui/DeckCountToggle.tsx
  modified:
    - src/ui/BlackjackControls.tsx
    - src/ui/HoldemGame.tsx
    - src/App.modeShell.guard.test.ts

key-decisions:
  - "Prop shape as shipped: { testidPrefix: string; deckCount: DeckCount; onSelect: (deckCount: DeckCount) => void; oneDeckDisabled?: boolean; oneDeckTitle?: string; twoDecksTitle?: string } — titles arrive PRE-COMPUTED per segment, DeckCountToggleProps deliberately unexported, the only import is `import type { DeckCount } from '../engine/shoe'`"
  - "Guard predicates stayed INLINE at both call sites (duplicateOnTable, duplicateInPicks) — one-line derivations over a single count-aware predicate; no helper module created (planner discretion recorded in the plan, executed as written)"
  - "The SC1 source-identity pins landed in the extraction commit itself, so every new assertion flipped red->green exactly at the commit that caused it (the guard file's STANDING RULE)"
  - "Single-source-of-markup sweep keys on aria-label=\"Deck count\" with a .test.tsx exclusion — NOT on '1 deck'/'2 decks' (polluted by BlackjackGame's locked idle copy and BlackjackControls' surviving WR-01 essay); the exclusion keeps the sweep green when 08-02 adds src/ui/DeckCountToggle.test.tsx"

requirements-completed: [DECK-02]

# Metrics
duration: 13min
completed: 2026-08-25
---

# Phase 8 Plan 01: Characterization Golden + DeckCountToggle Extraction Summary

**Both games' inline deck toggles are now ONE shared, props-driven `DeckCountToggle` component (SC1), proven byte-identical per state by a nine-state outerHTML golden that was captured and committed against the INLINE toggles one commit BEFORE the extraction existed — and left byte-untouched, still green, by the extraction commit.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-08-25T03:55:42Z (base `b44f6c6` verified, npm ci in fresh worktree)
- **Completed:** 2026-08-25T04:08Z (final full-suite + tsc + eslint + build gates)
- **Tasks:** 2 (two atomic commits, golden-first ordering)
- **Files modified:** 5 (2 created, 3 modified — exactly the plan's files_modified list)

## Task Commits

| Task | Commit | Message | Files |
|------|--------|---------|-------|
| 1 | `4d85066` | `test(08-01): freeze pre-extraction deck-toggle DOM as a nine-state outerHTML golden` | src/App.deckToggleDom.golden.test.tsx (ONLY file — verified by `git show --stat`) |
| 2 | `71a2802` | `refactor(08-01): extract DeckCountToggle onto both games, guard amended same-commit` | src/ui/DeckCountToggle.tsx (new), src/ui/BlackjackControls.tsx, src/ui/HoldemGame.tsx, src/App.modeShell.guard.test.ts |

## Golden Provenance (T-08-08 — the ordering IS the proof)

- **Capture commit/tree:** the golden's constants were captured at base commit `b44f6c6`, whose tree still contained BOTH inline toggles; the golden itself is commit `4d85066`, whose parent is `b44f6c6` and whose own tree ALSO still contains both inline toggles — verified: `git show 4d85066:src/ui/BlackjackControls.tsx` contains the inline `role="group"` markup (plan 08-03 re-verifies this git fact).
- **Nine state strings: captured, not authored.** Written from the documented serialization rules, then PROVEN byte-identical to the live inline render by nine passing full-string `toBe` assertions against the unmodified inline toggles at commit `4d85066` (a mismatch would have failed with the actual string in the assertion diff for transcription). Em dashes verified as true U+2014 characters by grep before commit. See Deviations for the console.log procedural note.
- **Untouched by the extraction:** `git diff --stat 4d85066..71a2802` lists only the four Task 2 files — the golden is byte-unmodified — and all 9 states pass at `71a2802` against the shared component. That green-across-an-untouched-file is the D-06 / UI-SPEC A2 byte-identity proof (attribute order included; states 8 and 9 share one constant, and state 9 additionally asserts the fresh-deal title is ABSENT — the A4-beats-A3 precedence tripwire).

## Final Prop Shape (as shipped)

```tsx
interface DeckCountToggleProps {          // unexported
  testidPrefix: string;                    // 'blackjack-deck-toggle' | 'holdem-deck-toggle' at the call sites (D-02)
  deckCount: DeckCount;                    // type-only import from '../engine/shoe' — the component's ONLY import
  onSelect: (deckCount: DeckCount) => void; // invoked unconditionally, incl. the active segment (store's same-value early return is the no-op)
  oneDeckDisabled?: boolean;               // segment 1 only; segment 2 has NO disabled prop at all
  oneDeckTitle?: string;                   // pre-computed at the call site (precedence never enters the component)
  twoDecksTitle?: string;                  // blackjack never passes it; React omits the attribute
}
```

Module-scope named `function` export, no hooks, no state, no store read, no gate arming (trap 1: focus retention across Hold'em's toggle-triggered fresh deal passes unmodified — `App.holdemDeckToggle.test.tsx` L360-374).

## Guard Amendments (src/App.modeShell.guard.test.ts — ALL ADDED, same commit as the component)

Line ranges refer to the file as committed at `71a2802`:

| # | Amendment | Lines | Status |
|---|-----------|-------|--------|
| 1 | File-header `AMENDED 2026-08-25 (Phase 8 plan 08-01, D-01/D-02/D-07)` block | L59-71 | ADDED |
| 2 | `'ui/DeckCountToggle.tsx'` joins the resetAnimations `it.each` sweep (+ list comment) | L207-210 | ADDED |
| 3 | resetAnimations assertion message extended with "…and ui/DeckCountToggle.tsx on its creation, Phase 8 D-01" | L220-221 | SANCTIONED message extension (assertion unchanged) |
| 4 | deckCount-zero sweep: comment-only Phase 8 citation; file list byte-unchanged | L259-264 | SANCTIONED comment citation (COMMENT ONLY) |
| 5 | NEW describe: `ui/DeckCountToggle.tsx — store-free by construction, locked labels verbatim` — 7-token raw-source sweep (gameStore/oddsStore/pickerStore/uiStore/blackjackStore/gameModeStore/zustand, comments included) + 3 locked-label pins (`1 deck`, `2 decks`, `Deck count`) | L314-354 | ADDED (10 tests) |
| 6 | NEW describe: `SC1 — the deck-count markup lives in exactly ONE shared component…` — comment-stripped import/render pins (×2 call sites each), raw `role="group"` + `aria-label="Deck count"` absence pins (×2 each), call-site testid-prefix + `${testidPrefix}-1/-2` construction pin, readdirSync single-source-of-markup sweep with the load-bearing `.test.tsx` exclusion | L356-442 | ADDED (11 tests) |
| 7 | fs import extended: `readFileSync` → `readFileSync, readdirSync` | L3 | ADDED (import extension only) |

**deckCount-zero sweep explicitly NOT extended** (trap 4): its file list remains exactly `['App.tsx', 'state/gameModeStore.ts', 'ui/GameModeSwitcher.tsx']` and `ui/DeckCountToggle.tsx` is absent from it — the markup moved, the wire did not.

**Additive proof:** `git diff HEAD~1 -- src/App.modeShell.guard.test.ts` contains zero removed `expect(` lines and zero removed `it(` lines (verified by grep before commit; the only removed lines are the extended fs-import line and the extended message-continuation line).

## Negative Controls (06-02 precedent item 5 — both went red, both reverted)

1. **resetAnimations sweep:** temporarily inserted a `// …resetAnimations` comment into `DeckCountToggle.tsx` → guard went RED with the exact extended message (`ui/DeckCountToggle.tsx must never call resetAnimations — … and ui/DeckCountToggle.tsx on its creation, Phase 8 D-01…`). Reverted.
2. **SC1 absence pin:** temporarily re-added an inline `<div role="group" />` to `BlackjackControls.tsx` → guard went RED with the exact SC1 message (`ui/BlackjackControls.tsx must not contain role="group" anywhere… single-source claim regressed`). Reverted.

Suite confirmed green again after both reverts, before committing.

## Test-Count Delta (all-additive)

| Point | Files | Tests | Delta explained |
|-------|-------|-------|------------------|
| Baseline (`b44f6c6`) | 62 | 863 | — |
| After Task 1 (`4d85066`) | 63 | 872 | +1 file (the golden), +9 tests (the nine states) |
| After Task 2 (`71a2802`) | 63 | 893 | +21 guard tests: resetAnimations +1, store-free sweep +7, locked labels +3, SC1 pins +10 |

Zero pre-existing test modifications anywhere: `App.holdemDeckToggle.test.tsx`, `App.blackjackLoop.test.tsx`, `App.modeIsolation.test.tsx`, `App.modeSwitch.test.tsx`, both testid registries, the five frozen v1 suites and `App.holdemCachePoison.test.tsx` are all byte-untouched (the guard file's additive amendment is the plan's sole sanctioned test-file edit).

## Guard-Green-At-Every-Commit (verified by checkout, D-07)

- Detached checkout of `4d85066`: `App.modeShell.guard.test.ts` (71) + golden (9) = **80 passed** — the pre-amendment guard is green against the still-inline toggles.
- Branch tip `71a2802`: guard (92) + golden (9) = **101 passed** — the amended guard is green against the extraction.

## Verification Gates (all at `71a2802`)

- `npx vitest run`: **63 files / 893 tests, 0 failures, 0 skipped**
- `npx tsc --noEmit`: clean
- `npm run lint` (`eslint .`): clean, zero new inline disables
- `npm run build` (`tsc -b && vite build`): clean (pre-existing chunk-size warning only)
- `git status`: zero changes to `src/App.css`, `src/index.css`, `src/test/holdemTestids.ts`, `src/test/blackjackTestids.ts` — the phase's CSS diff is EMPTY as designed (D-06, T-08-02)
- `git grep -c 'role="group"' -- src/ui/BlackjackControls.tsx src/ui/HoldemGame.tsx`: zero matches in both call sites

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] readdirSync call shape vs. the repo's narrow node-builtins shim**
- **Found during:** Task 2 (`npm run build` — `tsc -b` type-checks test files that `npx tsc --noEmit` does not reach the same way)
- **Issue:** the new single-source-of-markup sweep called `readdirSync(path)` with one argument; the repo's deliberately narrow `src/test/node-builtins.d.ts` shim (IMP-02) types `readdirSync` with a REQUIRED options argument, so `tsc -b` failed with TS2554
- **Fix:** call `readdirSync(join(SRC_DIR, 'ui'), { recursive: false })` — matches both the shim signature and Node's runtime behavior; a source comment records why the argument is load-bearing. The shim itself was NOT edited (outside files_modified)
- **Files modified:** src/App.modeShell.guard.test.ts (inside the Task 2 commit — no intermediate red state was ever committed)
- **Commit:** `71a2802`

**2. [Procedural note] Golden capture via assertion equality rather than console.log transcription**
- **Found during:** Task 1
- **Issue:** the plan's capture procedure (temporary `console.log` of each `outerHTML`, transcribe, remove) could not surface output — the repo's vitest config suppresses console output in run mode
- **Resolution:** the constants were written from the plan's documented serialization rules and then PROVEN equal to the live capture by the nine full-string `toBe` assertions passing against the unmodified inline toggles (a wrong prediction would have failed with the actual captured string printed in the assertion diff, which is the same transcription source). Em-dash characters verified as U+2014 by grep. Identical proof strength: the committed constants are byte-identical to the pre-extraction render by test-passing construction; the temporary logs were removed before commit as planned
- **Files modified:** none beyond the plan's own file

### Otherwise

Plan executed exactly as written: golden-first commit ordering, one extraction commit, additive-only guard amendment, zero CSS/copy/testid changes, zero pre-existing test modifications.

## Known Stubs

None — the shared component is fully wired at both call sites; no placeholder values, no unwired props.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns or trust-boundary changes; the plan's threat register dispositions (T-08-01…T-08-08 mitigate, T-08-SC accept with zero installs) were all honored: `npm ci` only, no `npm install`, no new packages.

## Self-Check: PASSED

- FOUND: src/App.deckToggleDom.golden.test.tsx
- FOUND: src/ui/DeckCountToggle.tsx
- FOUND: commit 4d85066 (golden, single-file, pre-extraction tree)
- FOUND: commit 71a2802 (extraction + rewires + guard, four files)
- VERIFIED: golden byte-unmodified between the two commits, green at both
