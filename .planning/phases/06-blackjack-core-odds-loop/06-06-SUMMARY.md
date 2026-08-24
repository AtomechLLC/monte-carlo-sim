---
phase: 06-blackjack-core-odds-loop
plan: 06
subsystem: ui
tags: [typescript, react, vitest, blackjack, odds-panel]
status: complete

# Dependency graph
requires:
  - phase: 06-blackjack-core-odds-loop
    plan: 02
    provides: "DEALER_BUCKET_ORDER/DEALER_BUCKET_COUNT wire constants in blackjackProtocol"
  - phase: 06-blackjack-core-odds-loop
    plan: 04
    provides: "useBlackjackOddsStore live tally fields (dealerOutcomeCounts, bustIfHitCount, standOutcomes, hitOutcomes, trialsCompleted) and the A3 displayedDeckCount snapshot field"
provides:
  - src/ui/formatEv.ts — formatEv signed per-unit EV formatter (A8 shape, shared em dash convention)
  - src/ui/dealerBucketLabels.ts — DEALER_BUCKET_LABELS / DEALER_BUCKET_TESTIDS parallel constants with compile-time length lock
  - src/ui/DealerDistributionDisplay.tsx — the 7-bucket dealer final-outcome table (blackjack-dealer-table)
  - src/ui/BustEvDisplay.tsx — A7 rows 1-3 (trials/bust dl, Stand group, EV tiles)
  - src/ui/BlackjackOddsPanel.tsx — the docked cluster root (blackjack-odds-panel, aria-busy)
affects: [06-07, 06-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Round-first-then-sign EV formatting: sign and magnitude both derive from the same Math.round(ev*100) integer, so a rounds-to-zero value can never render '−0.00'/'+0.00'"
    - "Parallel label/testid constants length-locked at compile time via readonly string[] & { length: (typeof DEALER_BUCKET_ORDER)['length'] }, backed by a test-time assertion against DEALER_BUCKET_COUNT"
    - "Locked copy strings as named module-scope constants so a guard can pin them and a reword is one edit"

key-files:
  created:
    - src/ui/formatEv.ts
    - src/ui/formatEv.test.ts
    - src/ui/dealerBucketLabels.ts
    - src/ui/DealerDistributionDisplay.tsx
    - src/ui/BustEvDisplay.tsx
    - src/ui/BlackjackOddsPanel.tsx
    - src/ui/BlackjackOddsPanel.test.tsx
  modified: []

key-decisions:
  - "Dealer table keeps OddsTable's thead as part of the structural mirror (minus the locked-in column) with executor-chosen, non-locked column headers 'Dealer total' / 'Probability' — flagged here for the verifier since only caption/subtitle/row labels are contract-locked copy"
  - "Group captions/subtitles render as <p> elements carrying the bj-odds-group__caption/__subtitle contract classes — no new heading levels introduced (the page has only an h1; an h3 would skip a level)"
  - "Compile-time AND test-time length assertions on the bucket label arrays (plan allowed either); the compile-time lock ties to DEALER_BUCKET_ORDER's tuple length, the test ties to DEALER_BUCKET_COUNT"

requirements-completed: [BJ-03, BJ-04]

# Metrics
duration: 12min
completed: 2026-08-24
---

# Phase 6 Plan 06: Blackjack Odds Cluster Summary

**The full BJ-03/BJ-04 odds cluster as pure store-driven presentation: formatEv's locked signed per-unit shape with a typographic minus and round-first-then-sign zero handling, the label-constant-driven 7-bucket dealer table whose subtitle names the shoe the displayed run was computed under, and the docked aria-busy panel whose pending state provably masks all 13 value cells plus the trial counter — pinned by 22 new tests.**

## Performance

- **Duration:** ~12 min (22:21Z–22:33Z, after base-commit verification at d2bb22c and npm ci)
- **Tasks:** 3 (all RED verified in-session before implementation, GREEN before commit)
- **Files:** 7 created, 0 modified — `git diff --name-only d2bb22c..HEAD` lists exactly the plan's seven files

## Accomplishments

- `formatEv` renders the locked A8 shapes (`'+0.12 units'` / `'−0.18 units'` / `'0.00 units'` / `'—'`): U+2212 MINUS SIGN in a named searchable constant (never ASCII hyphen), sign chosen AFTER rounding so a value that rounds to zero from either side renders unsigned (both directions tested with the plan's 501/500-over-200000 trap), pushes provably contribute zero, and the pending/zero-trials em dash is byte-identical to `formatPct`'s (asserted by comparing the two functions' outputs directly).
- The dealer final-outcome table renders exactly seven rows in the fixed order 17/18/19/20/21/Natural/Bust driven by `DEALER_BUCKET_LABELS` — never by `dealerOutcomeCounts.length` (T-06-30): an empty counts array still renders seven rowheaders with em dashes, and a length-2 malformed snapshot renders seven rows with `?? 0` fallback cells, both asserted.
- The table subtitle interpolates only the deck-count digit into the locked string (`Given the cards you can see · {1|2}-deck shoe`, U+00B7), sourced from the ODDS store's `displayedDeckCount` — the A3 snapshot rule (checker FLAG 1) recorded in a code comment at the read site; `useBlackjackStore` appears nowhere in the file.
- `BustEvDisplay` renders A7 rows 1-3 with every locked copy string verbatim as a named constant; the Hit tile's `hit once, then stand` sub-copy is unconditional JSX text (never `title`/`aria-label`), with the D-05 rationale (single-draw EV vs. optimal-continuation calculators) in a comment beside it, and asserted present in the DOM in both the zero-trials and pending states (T-06-32).
- `BlackjackOddsPanel` is a structural twin of `OddsPanel`: `aria-busy` bound to `pendingAnimationCount > 0`, `odds-panel--pending` applied while pending, docked-outside-the-felt doc comment carried; the pending sweep proves all 13 value cells AND the trial counter mask to the em dash even with non-zero tallies in the store (T-06-31, TBL-04's literal bar / checker FLAG 2).
- A15 double-pin: display wording `Loss` and machine name `blackjack-stand-lose-pct` asserted independently, plus an explicit absence assertion on `blackjack-stand-loss-pct`.
- Full regression bar: 49 test files / 567 tests pass, 0 skipped (baseline 545; +22, all additive, no pre-existing test touched), `npx tsc --noEmit` clean, `npx eslint .` clean, `npm run build` exit 0.

## CSS Class Names Emitted (binding contract — cross-check against plan 06-05's definitions)

New `bj-*` classes (defined by 06-05, emitted character-for-character here):

- `bj-odds-group` — the "If you stand" and "Expected value" group `<section>` wrappers
- `bj-odds-group__caption` — both group captions AND the dealer table's `<caption>`
- `bj-odds-group__subtitle` — the "Per unit wagered" subtitle AND the dealer table's subtitle span
- `bj-ev-tiles` — the tile pair wrapper
- `bj-ev-tile` — each EV tile
- `bj-ev-tile__label` — tile labels ("Stand", "Hit")
- `bj-ev-tile__value` — tile values (testid carriers)
- `bj-ev-tile__sub` — the Hit tile's sub-copy span

Reused shipped classes (unmodified): `odds-stats`, `odds-stat`, `odds-stat__label`, `odds-stat__value`, `odds-panel--pending`.

**No CSS was created or edited** — `src/App.css` and `src/index.css` are untouched (06-05 owns them this wave).

## The 13 Value Testids Covered by the Pending Sweep

`blackjack-bust-pct`, `blackjack-stand-win-pct`, `blackjack-stand-push-pct`, `blackjack-stand-lose-pct`, `blackjack-ev-stand`, `blackjack-ev-hit`, `blackjack-dealer-pct-17`, `blackjack-dealer-pct-18`, `blackjack-dealer-pct-19`, `blackjack-dealer-pct-20`, `blackjack-dealer-pct-21`, `blackjack-dealer-pct-natural`, `blackjack-dealer-pct-bust` — plus `blackjack-trial-counter`, asserted separately in the same sweep (it masks to the em dash while pending and renders a localized count otherwise).

## formatPct Confirmation

`formatPct.ts` was **neither edited nor duplicated**: it is absent from `git diff --name-only d2bb22c..HEAD`, `formatEv.ts` contains no percentage formatting, and the em dash literal is repeated once with a comment pointing at `formatPct.ts` as the source of the convention (that file does not export the literal).

## Task Commits

1. **Task 1: formatEv — the signed per-unit EV formatter** — `d662fc2` (feat) — 11 tests
2. **Task 2: The 7-bucket dealer final-outcome table** — `078e827` (feat) — behavior cases run in Task 3's suite per the plan's acceptance criteria
3. **Task 3: Stat row, Stand group, EV tiles, and the docked panel** — `7acfdf1` (feat) — 11 tests (incl. the dealer table's cases)

## Decisions Made

- **Dealer table thead:** carried OddsTable's `<thead>` as part of the "structural copy minus the locked-in column" instruction, with column headers `Dealer total` / `Probability`. These two strings are NOT in the locked copy list (which locks caption, subtitle, and row labels only) — recorded here so the verifier can flag if the structural mirror should instead omit the thead.
- **Caption elements:** `<p>` (not headings) for the two group captions and the EV subtitle — the CSS contract classes carry the visual treatment and no heading hierarchy is disturbed.
- **Length assertion:** both compile-time (type intersection pinning `.length` to `DEALER_BUCKET_ORDER`'s tuple length — the same 7 as `DEALER_BUCKET_COUNT`) and test-time (explicit `toBe(DEALER_BUCKET_COUNT)` in the panel suite); the plan required one or the other.

## Deviations from Plan

None — plan executed as written. (The three items above are planner-discretion choices within the plan's own grants, recorded for audit; component structure beyond the locked DOM/testids/copy is non-contractual per UI-SPEC line 189.)

## Issues Encountered

None. No auth gates, zero package installs (T-06-SC — `npm ci` from the committed lockfile only).

## User Setup Required

None.

## Next Phase Readiness

- Plan 06-07 can mount `<BlackjackOddsPanel />` as a sibling of the Blackjack table scene — it is self-contained (reads `useBlackjackOddsStore` + `useUiStore` only) and renders correctly in every store state including idle/zero-trials.
- Plan 06-05's CSS definitions for the `bj-*` classes will bind to this markup with zero component changes — the class list above is the exact emitted set.
- The standing D-10 guard extension (06-07) can pin: no Hold'em store token appears in any of this plan's five source files (verified by search during execution).

## Known Stubs

None — every displayed value is wired to `useBlackjackOddsStore`; no placeholder data, no TODO/FIXME markers.

## Threat Flags

None — no new security-relevant surface beyond the plan's threat model. T-06-30/31/32/33/34 mitigations all landed as asserted tests or verified source absences; T-06-SC honored (zero installs).

## Self-Check: PASSED

- All 7 created files verified present on disk.
- All 3 task commits (`d662fc2`, `078e827`, `7acfdf1`) verified in `git log` atop base `d2bb22c`.
- Full suite 49 files / 567 tests green, 0 skipped; `npx tsc --noEmit` clean; `npx eslint .` clean; `npm run build` exit 0.
- `git diff --name-only d2bb22c..HEAD` lists exactly the plan's seven files — no CSS file, no Hold'em component, nothing under `src/state/`, `src/engine/`, `src/worker/`; zero deletions.
